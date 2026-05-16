/**
 * Tests for resolveSpell: the cross of Spell.kind × ward.test().
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { resolveSpell, damageDelta } from './spell';
import { attack } from '../run/types';
import type { Outcome, Spell } from './types';

describe('resolveSpell — example cases', () => {
  it('Real + ward matches → Capture', () => {
    expect(resolveSpell({ text: 'dragon42', kind: 'Real' }, /^dragon\d+$/)).toBe(
      'Capture',
    );
  });

  it('Real + ward rejects → Hit', () => {
    expect(resolveSpell({ text: 'dragon42', kind: 'Real' }, /^cat\d+$/)).toBe(
      'Hit',
    );
  });

  it('Decoy + ward matches → FalseCapture', () => {
    expect(resolveSpell({ text: 'dragon42', kind: 'Decoy' }, /^dragon\d+$/)).toBe(
      'FalseCapture',
    );
  });

  it('Decoy + ward rejects → Dodge', () => {
    expect(resolveSpell({ text: 'dragon42', kind: 'Decoy' }, /^cat\d+$/)).toBe(
      'Dodge',
    );
  });

  // The teachable mistake from ADR-0003: un-anchored Ward partial-matches a
  // Decoy that *contains* a substring matching the Pattern → FalseCapture.
  it('ADR-0003 canonical mistake: /dragon\\d+/ (no anchors) FalseCaptures Xdragon42Y', () => {
    expect(
      resolveSpell({ text: 'Xdragon42Y', kind: 'Decoy' }, /dragon\d+/),
    ).toBe('FalseCapture');
  });
});

describe('resolveSpell — property: outcome follows kind × match truth table', () => {
  it('returns one of four outcomes consistent with the truth table', () => {
    fc.assert(
      fc.property(
        fc.record({
          text: fc.string(),
          kind: fc.constantFrom('Real', 'Decoy') as fc.Arbitrary<Spell['kind']>,
        }),
        // Use a small set of stable regexes so .test() is well-defined.
        fc.constantFrom(/^[a-z]+$/, /^\d+$/, /foo/, /.*/, /^$/, /[A-Z]/),
        (spell, ward) => {
          const matches = ward.test(spell.text);
          const outcome = resolveSpell(spell as Spell, ward);
          const allowed: Outcome[] = ['Capture', 'Hit', 'FalseCapture', 'Dodge'];
          expect(allowed).toContain(outcome);

          if (spell.kind === 'Real' && matches) expect(outcome).toBe('Capture');
          if (spell.kind === 'Real' && !matches) expect(outcome).toBe('Hit');
          if (spell.kind === 'Decoy' && matches)
            expect(outcome).toBe('FalseCapture');
          if (spell.kind === 'Decoy' && !matches) expect(outcome).toBe('Dodge');
        },
      ),
    );
  });
});

describe('damageDelta', () => {
  const aAtk = attack(7);
  const eAtk = attack(11);

  it('Capture deals attackerAttack to enemy, none to player', () => {
    expect(damageDelta('Capture', aAtk, eAtk)).toEqual({
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

  it('FalseCapture deals enemyAttack to player (symmetric with Hit)', () => {
    expect(damageDelta('FalseCapture', aAtk, eAtk)).toEqual({
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
