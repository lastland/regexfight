/**
 * Run lifecycle helpers — initialize, seed-on-first-arrival, merge attempt
 * spells, score derivation. Pure functions; the React composition root
 * applies them via setState.
 */

import type { Spell, EncounterEvent, Outcome } from '../combat';
import type { Enemy } from '../content/types';
import { score } from '../run/types';
import type {
  Attack,
  EnemyId,
  PlayerProfile,
  Run,
  Score,
} from '../run/types';

export function createRun(enemies: Enemy[], player: PlayerProfile): Run {
  return {
    enemies: enemies.map((e) => ({ id: e.id })),
    currentIdx: 0,
    progressScore: score(0),
    observationLogs: {},
    visited: {},
    enemyAttemptCounts: {},
    deathCount: 0,
    player,
  };
}

/**
 * Bump the per-enemy attempt counter and (on defeat) the run-wide death
 * counter. Called once per resolved Encounter.
 */
export function recordAttempt(
  run: Run,
  enemyId: EnemyId,
  result: 'Victory' | 'Defeat',
): Run {
  const key = enemyId as unknown as string;
  const prevCount = run.enemyAttemptCounts[key] ?? 0;
  return {
    ...run,
    enemyAttemptCounts: { ...run.enemyAttemptCounts, [key]: prevCount + 1 },
    deathCount: run.deathCount + (result === 'Defeat' ? 1 : 0),
  };
}

/**
 * Pre-populate the Observation Log with this Enemy's Seed Spells the first
 * time the player reaches its Prep Screen. Idempotent on re-arrival.
 */
export function seedOnArrival(run: Run, enemy: Enemy): Run {
  if (run.visited[enemy.id]) return run;
  const seeds: Spell[] = enemy.seedSpells.map((s) => ({
    text: s.text,
    kind: s.kind,
  }));
  return {
    ...run,
    visited: { ...run.visited, [enemy.id]: true },
    observationLogs: { ...run.observationLogs, [enemy.id]: seeds },
  };
}

/**
 * Merge the Spells encountered in an Attempt into the persistent Observation
 * Log, deduplicated by text. Seed-spell entries already in the log are
 * preserved.
 */
export function mergeObservations(
  run: Run,
  enemyId: EnemyId,
  attemptSpells: ReadonlyArray<Spell>,
): Run {
  const existing = run.observationLogs[enemyId] ?? [];
  const seen = new Set(existing.map((s) => s.text));
  const additions: Spell[] = [];
  for (const s of attemptSpells) {
    if (!seen.has(s.text)) {
      seen.add(s.text);
      additions.push(s);
    }
  }
  if (additions.length === 0) return run;
  return {
    ...run,
    observationLogs: {
      ...run.observationLogs,
      [enemyId]: [...existing, ...additions],
    },
  };
}

export function advanceRun(run: Run): Run {
  return { ...run, currentIdx: Math.min(run.currentIdx + 1, run.enemies.length) };
}

export type AttemptSummary = {
  result: 'Victory' | 'Defeat';
  attemptSpells: Spell[];
  attemptLog: { spell: Spell; outcome: Outcome }[];
  scoreEarned: Score;
  damageTakenThisAttempt: number;
  flawless: boolean;
};

/**
 * Derive the AttemptSummary from the accumulated event stream of an
 * Encounter. Pure; no Run mutation here — callers apply the summary's
 * components separately via mergeObservations / score addition.
 */
export function summariseAttempt(
  events: ReadonlyArray<EncounterEvent>,
  enemy: Enemy,
  playerAttack: Attack,
): AttemptSummary {
  let counterattackCount = 0;
  let result: 'Victory' | 'Defeat' | null = null;
  let damageTakenThisAttempt = 0;
  const attemptSpells: Spell[] = [];
  const attemptLog: { spell: Spell; outcome: Outcome }[] = [];

  for (const ev of events) {
    if (ev.tag === 'SpellResolved') {
      attemptSpells.push(ev.spell);
      attemptLog.push({ spell: ev.spell, outcome: ev.outcome });
      if (ev.outcome === 'Counterattack') counterattackCount++;
    } else if (ev.tag === 'EncounterEnded') {
      result = ev.result;
      damageTakenThisAttempt = ev.damageTakenThisAttempt;
    }
  }

  if (result === null) {
    throw new Error('summariseAttempt called before EncounterEnded fired');
  }

  let earned = counterattackCount * (playerAttack as unknown as number);
  if (result === 'Victory') {
    earned += enemy.defeatBounty as unknown as number;
    if (damageTakenThisAttempt === 0) {
      earned += enemy.flawlessBonus as unknown as number;
    }
  }

  return {
    result,
    attemptSpells,
    attemptLog,
    scoreEarned: score(earned),
    damageTakenThisAttempt,
    flawless: result === 'Victory' && damageTakenThisAttempt === 0,
  };
}

export function addScore(run: Run, earned: Score): Run {
  return {
    ...run,
    progressScore: score(
      (run.progressScore as unknown as number) +
        (earned as unknown as number),
    ),
  };
}
