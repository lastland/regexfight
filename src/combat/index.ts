/**
 * Combat context — public surface.
 *
 * Consumers (view, run, app) import only from this module. Internal modules
 * (rng.ts, spell.ts, encounter.ts, score.ts) are implementation details.
 */

export { resolveSpell, damageDelta } from './spell';
export { startEncounter, stepEncounter } from './encounter';
export { scoreFromOutcome, defeatBounty, flawlessBonus } from './score';

export type {
  Spell,
  Kind,
  Outcome,
  EncounterEvent,
  EncounterState,
  WardSrc,
  PatternSrc,
} from './types';
