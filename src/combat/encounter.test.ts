/**
 * Tests for startEncounter / stepEncounter.
 *
 * Covers: determinism, pattern invariance across phases, damage symmetry,
 * and two hand-built example encounters (correct Ward sweeps; .* Ward dies).
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { startEncounter, stepEncounter } from './encounter';
import type { EncounterEvent, EncounterState } from './types';
import type { Enemy } from '../content/types';
import { attack, enemyId, hp, score } from '../run/types';
import type { PlayerProfile } from '../run/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function mkEnemy(overrides?: Partial<Enemy>): Enemy {
  const base: Enemy = {
    id: enemyId('test-dragon'),
    name: 'Test Dragon',
    pattern: 'dragon\\d+' as Enemy['pattern'],
    baseHp: hp(100),
    defeatBounty: score(50),
    flawlessBonus: score(25),
    realRate: 0.5,
    phases: [
      {
        hpThreshold: 1.0,
        attack: attack(5),
        realPool: ['dragon1', 'dragon2', 'dragon42', 'dragon999'],
        decoyPool: ['cat1', 'wolf2', 'orc3', 'goblin4'],
      },
      {
        hpThreshold: 0.5,
        attack: attack(10),
        realPool: ['dragon7', 'dragon88'],
        decoyPool: ['Xdragon42Y', 'dragonABC'],
      },
    ],
    seedSpells: [],
  };
  return { ...base, ...(overrides ?? {}) };
}

function mkPlayer(): PlayerProfile {
  return {
    baseHp: hp(100),
    baseAttack: attack(8),
    modifiers: [],
  };
}

function runEncounter(
  enemy: Enemy,
  player: PlayerProfile,
  seed: number,
  ward: RegExp,
  maxSteps = 10000,
): EncounterEvent[] {
  let state: EncounterState = startEncounter({ enemy, player, seed });
  const events: EncounterEvent[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const { state: next, event } = stepEncounter(state, ward);
    events.push(event);
    state = next;
    if (event.tag === 'EncounterEnded') return events;
  }
  throw new Error(
    `runEncounter: exceeded maxSteps=${maxSteps} without EncounterEnded`,
  );
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('encounter — determinism', () => {
  it('same (enemy, player, seed, ward) produces identical event traces', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const enemy = mkEnemy();
        const player = mkPlayer();
        const ward = /dragon\d+/;
        const a = runEncounter(enemy, player, seed, ward);
        const b = runEncounter(enemy, player, seed, ward);
        expect(b).toEqual(a);
      }),
      { numRuns: 50 },
    );
  });
});

describe('encounter — pattern invariance', () => {
  it('the Enemy pattern string is unchanged for the full Encounter', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const enemy = mkEnemy();
        const player = mkPlayer();
        const ward = /dragon\d+/;
        const state0 = startEncounter({ enemy, player, seed });
        const expectedSource = state0.pattern.source;

        let state = state0;
        for (let i = 0; i < 5000; i++) {
          const { state: next, event } = stepEncounter(state, ward);
          // Pattern source must never change across steps.
          expect(next.pattern.source).toBe(expectedSource);
          state = next;
          if (event.tag === 'EncounterEnded') break;
        }
      }),
      { numRuns: 25 },
    );
  });

  it('realRate biases the kind distribution of drawn Spells', () => {
    // A large sample size + property test over seeds is needed because any
    // single seed's distribution can drift from the underlying probability.
    // We compare two encounters with the same seed but realRate 0.9 vs 0.1.
    // Use a never-matching, never-rejecting Ward so the encounter doesn't
    // end early — actually, use a Ward that only Counters Reals so player
    // doesn't die. Easiest: use a perfect Ward so player never dies and
    // the encounter ends only when enemy dies. We make the enemy unkillable
    // via huge baseHp so we get many samples.
    const ward = /dragon\d+/;
    const player = mkPlayer();
    const enemyHi = mkEnemy({ baseHp: hp(10_000), realRate: 0.9 });
    const enemyLo = mkEnemy({ baseHp: hp(10_000), realRate: 0.1 });

    const sample = (enemy: Enemy): { real: number; decoy: number } => {
      let state = startEncounter({ enemy, player, seed: 12345 });
      let real = 0;
      let decoy = 0;
      for (let i = 0; i < 2000; i++) {
        const { state: next, event } = stepEncounter(state, ward);
        if (event.tag === 'SpellResolved') {
          if (event.spell.kind === 'Real') real++;
          else decoy++;
        }
        state = next;
        if (event.tag === 'EncounterEnded') break;
      }
      return { real, decoy };
    };

    const hiStats = sample(enemyHi);
    const loStats = sample(enemyLo);
    const hiRatio = hiStats.real / (hiStats.real + hiStats.decoy);
    const loRatio = loStats.real / (loStats.real + loStats.decoy);
    // Both should be near their nominal rates within statistical wiggle.
    expect(hiRatio).toBeGreaterThan(0.85);
    expect(loRatio).toBeLessThan(0.15);
  });

  it('1-phase encounter never emits PhaseAdvanced', () => {
    const enemy = mkEnemy({
      phases: [
        {
          hpThreshold: 1.0,
          attack: attack(5),
          realPool: ['dragon1', 'dragon2'],
          decoyPool: ['cat1', 'wolf2'],
        },
      ],
    });
    const player = mkPlayer();
    const events = runEncounter(enemy, player, 1234, /dragon\d+/);
    for (const ev of events) {
      expect(ev.tag).not.toBe('PhaseAdvanced');
    }
  });
});

describe('encounter — damage symmetry (Hit vs Backfire)', () => {
  // Per ADR-0002: Hit and Backfire both deal enemy.attack to the player.
  // Verified per-step: for any individual SpellResolved event whose outcome is
  // Hit or Backfire, the playerHp delta equals -(current phase's attack).
  it('every Hit and Backfire deals exactly the current phase attack to the player', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const enemy = mkEnemy();
        const player = mkPlayer();
        // A deliberately-imperfect Ward — matches some Reals but also some Decoys.
        const ward = /dragon/;
        let state = startEncounter({ enemy, player, seed });
        let lastPlayerHp = state.playerHp as number;
        let currentPhaseAttack = enemy.phases[0]!.attack as number;
        for (let i = 0; i < 10000; i++) {
          const { state: next, event } = stepEncounter(state, ward);
          if (event.tag === 'SpellResolved') {
            const delta = (event.playerHp as number) - lastPlayerHp;
            if (event.outcome === 'Hit' || event.outcome === 'Backfire') {
              // delta should equal -currentPhaseAttack (clamped at 0 lower bound).
              const expected = Math.max(
                0,
                lastPlayerHp - currentPhaseAttack,
              ) - lastPlayerHp;
              expect(delta).toBe(expected);
            } else {
              // Remaining outcomes (Counterattack / Dodge) are damage-neutral.
              expect(delta).toBe(0);
            }
            lastPlayerHp = event.playerHp;
          } else if (event.tag === 'PhaseAdvanced') {
            const nextPhase = next.phases[next.currentPhaseIdx];
            if (nextPhase) {
              currentPhaseAttack = nextPhase.attack;
            }
          }
          state = next;
          if (event.tag === 'EncounterEnded') break;
        }
      }),
      { numRuns: 25 },
    );
  });
});

// ---------------------------------------------------------------------------
// Example tests
// ---------------------------------------------------------------------------

describe('encounter — example: correct Ward sweeps', () => {
  it('a Ward identical to the Pattern wins every Encounter regardless of seed', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const enemy = mkEnemy();
        const player = mkPlayer();
        // Pattern is `dragon\d+`; engine full-matches end-to-end so the
        // body alone is the correct Ward (no anchors needed).
        const events = runEncounter(enemy, player, seed, /dragon\d+/);
        const last = events[events.length - 1]!;
        expect(last.tag).toBe('EncounterEnded');
        if (last.tag === 'EncounterEnded') {
          expect(last.result).toBe('Victory');
        }
      }),
      { numRuns: 25 },
    );
  });

  it("the correct Ward takes zero damage (flawless)", () => {
    const enemy = mkEnemy();
    const player = mkPlayer();
    const events = runEncounter(enemy, player, 42, /dragon\d+/);
    const last = events[events.length - 1]!;
    expect(last.tag).toBe('EncounterEnded');
    if (last.tag === 'EncounterEnded') {
      expect(last.damageTakenThisAttempt).toBe(0);
      expect(last.result).toBe('Victory');
    }
  });
});

describe('encounter — example: /.*/ Ward dies', () => {
  // With a beefier enemy (more HP, stronger attack than the player), `/.*/`
  // ward Backfires every Decoy faster than it Captures Reals — so the
  // player dies before the enemy does. This is the canonical anti-cheese
  // demonstration from ADR-0002.
  const beefyEnemy: Enemy = mkEnemy({
    baseHp: hp(500),
    phases: [
      {
        hpThreshold: 1.0,
        attack: attack(20),
        realPool: ['dragon1', 'dragon2', 'dragon42', 'dragon999'],
        decoyPool: ['cat1', 'wolf2', 'orc3', 'goblin4'],
      },
    ],
  });

  it('matches everything → Backfires every Decoy → death (beefy enemy)', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const player = mkPlayer();
        const events = runEncounter(beefyEnemy, player, seed, /.*/);
        const last = events[events.length - 1]!;
        expect(last.tag).toBe('EncounterEnded');
        if (last.tag === 'EncounterEnded') {
          expect(last.result).toBe('Defeat');
        }
      }),
      { numRuns: 25 },
    );
  });
});

describe('encounter — phase advance', () => {
  it('emits PhaseAdvanced (not SpellResolved) on the step that crosses the threshold', () => {
    const enemy = mkEnemy();
    const player = mkPlayer();
    const events = runEncounter(enemy, player, 99, /dragon\d+/);
    const phaseEvents = events.filter((e) => e.tag === 'PhaseAdvanced');
    // The correct Ward Captures every Real (and we have a 50/50 Real/Decoy
    // split). 100 enemy HP, attack 8 → ~13 captures to kill the enemy. We
    // should cross the 0.5 threshold along the way.
    expect(phaseEvents.length).toBe(1);
    expect(phaseEvents[0]).toEqual({ tag: 'PhaseAdvanced', phaseIdx: 1 });
  });
});
