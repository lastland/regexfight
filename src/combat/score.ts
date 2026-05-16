/**
 * Per-outcome and per-encounter scoring helpers.
 *
 * Pure. The `run` context owns the actual accumulator; combat only reports
 * what each outcome / completion is worth.
 */

import type { Attack, Score } from '../run/types';
import { score } from '../run/types';
import type { Enemy } from '../content/types';
import type { Outcome } from './types';

export function scoreFromOutcome(outcome: Outcome, playerAttack: Attack): Score {
  if (outcome === 'Counterattack') {
    return score(playerAttack as number);
  }
  return score(0);
}

export function defeatBounty(enemy: Enemy): Score {
  return enemy.defeatBounty;
}

export function flawlessBonus(enemy: Enemy, damageTaken: number): Score {
  return damageTaken === 0 ? enemy.flawlessBonus : score(0);
}
