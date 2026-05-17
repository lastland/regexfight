/**
 * Encounter sim: pure state machine producing one EncounterEvent per step.
 *
 * Determinism contract — given (enemy, player, seed, ward), the entire event
 * trace is reproducible. The encounter.test.ts property tests depend on this.
 *
 * Spell selection (per step):
 *   We seed a step-local PRNG from (state.seed, currentPhaseIdx, stepCount)
 *   via a small mixing function. The first draw decides Real vs Decoy
 *   (~50/50 — if the chosen pool is empty we fall back to the other pool).
 *   The second draw picks an index into the chosen pool.
 *
 *   This is functionally equivalent to "shuffle each pool once per phase
 *   entry and step through it" for the purposes of the determinism property,
 *   and is simpler because we don't have to carry shuffled-pool state in
 *   EncounterState.
 *
 * Phase advancement:
 *   Each Phase has an hpThreshold expressed as a fraction of enemyMaxHp.
 *   When applying damage drops enemyHp at or below the *next* phase's
 *   threshold (and the enemy is still alive), we emit PhaseAdvanced for
 *   that step INSTEAD of SpellResolved, advance currentPhaseIdx, and the
 *   damage from the spell is still applied to enemyHp.
 *
 * Encounter end:
 *   playerHp <= 0 → EncounterEnded { result: 'Defeat' }.
 *   enemyHp  <= 0 → EncounterEnded { result: 'Victory' }.
 *   Encounter end takes priority over phase advance.
 */

import type { Enemy } from '../content/types';
import type { Attack, HP, PlayerProfile } from '../run/types';
import { attack as mkAttack, hp as mkHp } from '../run/types';
import { mulberry32 } from './rng';
import { damageDelta, resolveSpell } from './spell';
import type { EncounterEvent, EncounterState, Spell } from './types';

export function startEncounter(params: {
  enemy: Enemy;
  player: PlayerProfile;
  seed: number;
}): EncounterState {
  const { enemy, player, seed } = params;
  const pattern = new RegExp(enemy.pattern);
  return {
    enemyId: enemy.id,
    pattern,
    phases: enemy.phases.map((p) => ({
      hpThreshold: p.hpThreshold,
      attack: p.attack,
      realPool: p.realPool,
      decoyPool: p.decoyPool,
      realRate: p.realRate ?? enemy.realRate,
    })),
    currentPhaseIdx: 0,
    playerMaxHp: player.baseHp,
    enemyMaxHp: enemy.baseHp,
    playerHp: player.baseHp,
    enemyHp: enemy.baseHp,
    playerAttack: player.baseAttack,
    seed,
    stepCount: 0,
    damageTakenThisAttempt: 0,
  };
}

/**
 * Mix three integers into a 32-bit seed. Order-sensitive, deterministic.
 */
function mixSeed(a: number, b: number, c: number): number {
  let h = (a | 0) ^ Math.imul(b | 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= Math.imul(c | 0, 0x27d4eb2d);
  h ^= h >>> 16;
  return h | 0;
}

function pickSpell(state: EncounterState): Spell {
  const phase = state.phases[state.currentPhaseIdx];
  if (!phase) {
    throw new Error(
      `encounter: currentPhaseIdx ${state.currentPhaseIdx} out of bounds`,
    );
  }
  const stepRng = mulberry32(mixSeed(state.seed, state.currentPhaseIdx, state.stepCount));
  const kindDraw = stepRng();
  const indexDraw = stepRng();

  const wantReal = kindDraw < phase.realRate;
  const primary = wantReal ? phase.realPool : phase.decoyPool;
  const fallback = wantReal ? phase.decoyPool : phase.realPool;
  const pool = primary.length > 0 ? primary : fallback;
  if (pool.length === 0) {
    throw new Error(
      `encounter: phase ${state.currentPhaseIdx} has empty realPool and decoyPool`,
    );
  }
  const idx = Math.floor(indexDraw * pool.length);
  const text = pool[idx] ?? pool[0];
  if (text === undefined) {
    throw new Error(
      `encounter: pool sample produced undefined (phase ${state.currentPhaseIdx})`,
    );
  }
  const kind: Spell['kind'] = pool === phase.realPool ? 'Real' : 'Decoy';
  return { text, kind };
}

/**
 * Returns the highest phase index whose hpThreshold is satisfied by the given
 * enemyHp/enemyMaxHp ratio, starting from currentIdx. Used to decide whether
 * to advance phase. We only advance forward — never regress.
 *
 * A phase with hpThreshold = t becomes "current" once enemyHp/enemyMaxHp <= t.
 * Phase 0 typically has hpThreshold 1.0 (active from start).
 */
function nextPhaseIdxFor(
  phases: EncounterState['phases'],
  currentIdx: number,
  enemyHp: number,
  enemyMaxHp: number,
): number {
  const ratio = enemyMaxHp > 0 ? enemyHp / enemyMaxHp : 0;
  let idx = currentIdx;
  while (idx + 1 < phases.length) {
    const candidate = phases[idx + 1];
    if (!candidate) break;
    if (ratio <= candidate.hpThreshold) {
      idx += 1;
    } else {
      break;
    }
  }
  return idx;
}

export function stepEncounter(
  state: EncounterState,
  ward: RegExp,
): { state: EncounterState; event: EncounterEvent } {
  // 1) If a previous step left HP at 0 (the killing blow already animated),
  //    emit EncounterEnded NOW. This ensures the SpellResolved that brought
  //    HP to 0 was visible in the event stream before the encounter ends —
  //    otherwise the canvas never sees the last round of combat.
  if ((state.playerHp as number) <= 0) {
    return {
      state,
      event: {
        tag: 'EncounterEnded',
        result: 'Defeat',
        damageTakenThisAttempt: state.damageTakenThisAttempt,
      },
    };
  }
  if ((state.enemyHp as number) <= 0) {
    return {
      state,
      event: {
        tag: 'EncounterEnded',
        result: 'Victory',
        damageTakenThisAttempt: state.damageTakenThisAttempt,
      },
    };
  }

  // 2) If a previous step's HP drop crossed a Phase threshold (and the
  //    SpellResolved that crossed it already animated), emit PhaseAdvanced
  //    NOW. Same reason as above: the threshold-crossing spell needs to
  //    appear in the stream before the transformation animation plays.
  const pendingPhaseIdx = nextPhaseIdxFor(
    state.phases,
    state.currentPhaseIdx,
    state.enemyHp,
    state.enemyMaxHp,
  );
  if (pendingPhaseIdx !== state.currentPhaseIdx) {
    return {
      state: { ...state, currentPhaseIdx: pendingPhaseIdx },
      event: { tag: 'PhaseAdvanced', phaseIdx: pendingPhaseIdx },
    };
  }

  // 3) Normal step: pick a spell, resolve, emit SpellResolved. If this
  //    spell brings HP to 0 (killing blow) or crosses a Phase threshold,
  //    the NEXT call will emit the corresponding boundary event — but the
  //    SpellResolved is always emitted for the spell that was cast.
  const spell = pickSpell(state);
  const outcome = resolveSpell(spell, ward);

  const phase = state.phases[state.currentPhaseIdx];
  if (!phase) {
    throw new Error(
      `encounter: currentPhaseIdx ${state.currentPhaseIdx} out of bounds`,
    );
  }
  const enemyAttackForPhase: Attack = phase.attack;
  const { playerHpDelta, enemyHpDelta } = damageDelta(
    outcome,
    state.playerAttack,
    enemyAttackForPhase,
  );

  const newPlayerHpRaw = (state.playerHp as number) + playerHpDelta;
  const newEnemyHpRaw = (state.enemyHp as number) + enemyHpDelta;
  const newPlayerHp: HP = mkHp(Math.max(0, newPlayerHpRaw));
  const newEnemyHp: HP = mkHp(Math.max(0, newEnemyHpRaw));
  const damageTakenThisStep = playerHpDelta < 0 ? -playerHpDelta : 0;
  const newDamageTaken = state.damageTakenThisAttempt + damageTakenThisStep;

  return {
    state: {
      ...state,
      playerHp: newPlayerHp,
      enemyHp: newEnemyHp,
      stepCount: state.stepCount + 1,
      damageTakenThisAttempt: newDamageTaken,
    },
    event: {
      tag: 'SpellResolved',
      spell,
      outcome,
      playerHp: newPlayerHp,
      enemyHp: newEnemyHp,
    },
  };
}

// Re-export branded constructors so consumers don't need to know which module
// owns them. Avoids tempting view/run code to drill into combat internals.
export { mkAttack, mkHp };
