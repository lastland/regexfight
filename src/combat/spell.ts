/**
 * Per-spell resolution and damage delta.
 *
 * resolveSpell tests the Ward end-to-end against the Spell text (full match).
 * The engine wraps the Ward as `^(?:source)$` at resolution time, so the
 * player can just write the body. Player-typed `^`/`$` remain valid (they
 * become redundant inner anchors); see the Amendment in
 * `docs/adr/0003-full-anchored-match.md`.
 *
 * Damage is symmetric: Hit and Backfire both deal `enemyAttack` to the
 * player; Counterattack deals `attackerAttack` to the enemy; Dodge does nothing.
 */

import type { Attack } from '../run/types';
import type { Outcome, Spell } from './types';

function fullMatch(ward: RegExp, text: string): boolean {
  const anchored = new RegExp(`^(?:${ward.source})$`, ward.flags);
  return anchored.test(text);
}

export function resolveSpell(spell: Spell, ward: RegExp): Outcome {
  const matches = fullMatch(ward, spell.text);
  if (spell.kind === 'Real') {
    return matches ? 'Counterattack' : 'Hit';
  }
  // spell.kind === 'Decoy'
  return matches ? 'Backfire' : 'Dodge';
}

export function damageDelta(
  outcome: Outcome,
  attackerAttack: Attack,
  enemyAttack: Attack,
): { playerHpDelta: number; enemyHpDelta: number } {
  switch (outcome) {
    case 'Counterattack':
      return { playerHpDelta: 0, enemyHpDelta: -(attackerAttack as number) };
    case 'Hit':
    case 'Backfire':
      return { playerHpDelta: -(enemyAttack as number), enemyHpDelta: 0 };
    case 'Dodge':
      return { playerHpDelta: 0, enemyHpDelta: 0 };
  }
}
