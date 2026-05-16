/**
 * Tests for resolveSpell: the cross of Spell.kind × ward.test().
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { resolveSpell, damageDelta } from './spell';
import { attack } from '../run/types';
import type { Outcome } from './types';

describe('resolveSpell — example cases', () => {
  it('Real + ward matches → Counterattack', () => {
    expect(resolveSpell({ text: 'dragon42', kind: 'Real' }, /dragon\d+/)).toBe(
      'Counterattack',
    );
  });

  it('Real + ward rejects → Hit', () => {
    expect(resolveSpell({ text: 'dragon42', kind: 'Real' }, /cat\d+/)).toBe(
      'Hit',
    );
  });

  it('Decoy + ward matches → Backfire', () => {
    expect(resolveSpell({ text: 'dragon42', kind: 'Decoy' }, /dragon\d+/)).toBe(
      'Backfire',
    );
  });

  it('Decoy + ward rejects → Dodge', () => {
    expect(resolveSpell({ text: 'dragon42', kind: 'Decoy' }, /cat\d+/)).toBe(
      'Dodge',
    );
  });

  // ADR-0003 amendment: the engine now full-matches, so an un-anchored Ward
  // no longer partial-matches a decoy that merely *contains* the pattern.
  it('ADR-0003 amendment: /dragon\\d+/ no longer backfires on Xdragon42Y', () => {
    expect(
      resolveSpell({ text: 'Xdragon42Y', kind: 'Decoy' }, /dragon\d+/),
    ).toBe('Dodge');
  });

  // Player-typed anchors remain valid (redundant, harmless).
  it('player-typed ^...$ anchors still work', () => {
    expect(resolveSpell({ text: 'dragon42', kind: 'Real' }, /^dragon\d+$/)).toBe(
      'Counterattack',
    );
    expect(
      resolveSpell({ text: 'Xdragon42Y', kind: 'Decoy' }, /^dragon\d+$/),
    ).toBe('Dodge');
  });
});

describe('resolveSpell — property: outcome follows kind × match truth table', () => {
  it('returns one of four outcomes consistent with the truth table', () => {
    fc.assert(
      fc.property(
        fc.record({
          text: fc.string(),
          kind: fc.constantFrom<'Real' | 'Decoy'>('Real', 'Decoy'),
        }),
        // Use a small set of stable regexes so the engine's full-match
        // semantics are well-defined for each.
        fc.constantFrom(/[a-z]+/, /\d+/, /foo/, /.*/, /[A-Z]/),
        (spell, ward) => {
          const matches = new RegExp(`^(?:${ward.source})$`, ward.flags).test(
            spell.text,
          );
          const outcome = resolveSpell(spell, ward);
          const allowed: Outcome[] = ['Counterattack', 'Hit', 'Backfire', 'Dodge'];
          expect(allowed).toContain(outcome);

          if (spell.kind === 'Real' && matches) expect(outcome).toBe('Counterattack');
          if (spell.kind === 'Real' && !matches) expect(outcome).toBe('Hit');
          if (spell.kind === 'Decoy' && matches)
            expect(outcome).toBe('Backfire');
          if (spell.kind === 'Decoy' && !matches) expect(outcome).toBe('Dodge');
        },
      ),
    );
  });
});

describe('damageDelta', () => {
  const aAtk = attack(7);
  const eAtk = attack(11);

  it('Counterattack deals attackerAttack to enemy, none to player', () => {
    expect(damageDelta('Counterattack', aAtk, eAtk)).toEqual({
      playerHpDelta: 0,
      enemyHpDelta: -7,
    });
  });

  it('Hit deals enemyAttack to player', () => {
    expect(damageDelta('Hit', aAtk, eAtk)).toEqual({
      playerHpDelta: -11,
      enemyHpDelta: 0,
    });
  });

  it('Backfire deals enemyAttack to player (symmetric with Hit)', () => {
    expect(damageDelta('Backfire', aAtk, eAtk)).toEqual({
      playerHpDelta: -11,
      enemyHpDelta: 0,
    });
  });

  it('Dodge does nothing', () => {
    expect(damageDelta('Dodge', aAtk, eAtk)).toEqual({
      playerHpDelta: 0,
      enemyHpDelta: 0,
    });
  });
});
