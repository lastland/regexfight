/**
 * Per-spell resolution and damage delta.
 *
 * resolveSpell uses JavaScript's default partial-match semantics
 * (ward.test(spell.text)) per ADR-0003 — the player is expected to write
 * `^...$` themselves to express end-to-end intent. The engine never
 * auto-anchors.
 *
 * Damage is symmetric: Hit and FalseCapture both deal `enemyAttack` to the
 * player; Capture deals `attackerAttack` to the enemy; Dodge does nothing.
 */

import type { Attack } from '../run/types';
import type { Outcome, Spell } from './types';

export function resolveSpell(spell: Spell, ward: RegExp): Outcome {
  const matches = ward.test(spell.text);
  if (spell.kind === 'Real') {
    return matches ? 'Capture' : 'Hit';
  }
  // spell.kind === 'Decoy'
  return matches ? 'FalseCapture' : 'Dodge';
}

export function damageDelta(
  outcome: Outcome,
  attackerAttack: Attack,
  enemyAttack: Attack,
): { playerHpDelta: number; enemyHpDelta: number } {
  switch (outcome) {
    case 'Capture':
      return { playerHpDelta: 0, enemyHpDelta: -(attackerAttack as number) };
    case 'Hit':
    case 'FalseCapture':
      return { playerHpDelta: -(enemyAttack as number), enemyHpDelta: 0 };
    case 'Dodge':
      return { playerHpDelta: 0, enemyHpDelta: 0 };
  }
}
