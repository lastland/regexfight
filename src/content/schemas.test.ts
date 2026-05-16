/**
 * Schema-level tests: cross-field invariants, branding, error precision.
 */

import { describe, expect, it } from 'vitest';
import { EnemySchema, PlayerProfileSchema } from './schemas';

// A minimal valid Enemy as a parsed-YAML object literal. Tests below mutate
// shallow copies of this to exercise individual invariant failures.
const validEnemyInput = () => ({
  id: 'tutorial',
  name: 'The First Lexer',
  pattern: '^[a-z]+\\d{2,3}$',
  baseHp: 6,
  defeatBounty: 10,
  flawlessBonus: 5,
  phases: [
    {
      hpThreshold: 1.0,
      attack: 1,
      realPool: ['cat12', 'dog99'],
      decoyPool: ['12cat', 'meow'],
    },
    {
      hpThreshold: 0.5,
      attack: 2,
      realPool: ['zoo10', 'pig999'],
      decoyPool: ['cat1', 'Cat12'],
    },
  ],
  seedSpells: [
    { text: 'cat12', kind: 'Real' as const },
    { text: 'meow', kind: 'Decoy' as const },
  ],
});

describe('EnemySchema', () => {
  it('accepts a fully valid Enemy and brands its primitives', () => {
    const parsed = EnemySchema.parse(validEnemyInput());
    expect(parsed.id).toBe('tutorial');
    expect(parsed.name).toBe('The First Lexer');
    expect(parsed.pattern).toBe('^[a-z]+\\d{2,3}$');
    expect(parsed.baseHp).toBe(6);
    expect(parsed.defeatBounty).toBe(10);
    expect(parsed.flawlessBonus).toBe(5);
    expect(parsed.phases).toHaveLength(2);
    expect(parsed.phases[0]?.attack).toBe(1);
    expect(parsed.phases[1]?.attack).toBe(2);
    expect(parsed.seedSpells).toHaveLength(2);
  });

  it('rejects an invalid regex pattern with a precise error', () => {
    const bad = validEnemyInput();
    bad.pattern = '[unterminated';
    const result = EnemySchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const patternIssue = result.error.issues.find((i) =>
        i.path.includes('pattern'),
      );
      expect(patternIssue?.message).toBe('invalid regex');
    }
  });

  it('rejects a realPool entry that does not match the pattern', () => {
    const bad = validEnemyInput();
    bad.phases[0]!.realPool = ['cat12', 'NOT_MATCHING_42'];
    const result = EnemySchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) =>
          i.path[0] === 'phases' &&
          i.path[1] === 0 &&
          i.path[2] === 'realPool' &&
          i.path[3] === 1,
      );
      expect(issue).toBeDefined();
      expect(issue?.message).toMatch(/does not match pattern/);
    }
  });

  it('rejects a decoyPool entry that DOES match the pattern', () => {
    const bad = validEnemyInput();
    // 'cat12' is a real-shape string; placing it in a decoy pool must fail.
    bad.phases[0]!.decoyPool = ['12cat', 'cat12'];
    const result = EnemySchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) =>
          i.path[0] === 'phases' &&
          i.path[1] === 0 &&
          i.path[2] === 'decoyPool' &&
          i.path[3] === 1,
      );
      expect(issue).toBeDefined();
      expect(issue?.message).toMatch(/unexpectedly matches pattern/);
    }
  });

  it('rejects a Seed Spell whose text is not in phase 1 pool', () => {
    const bad = validEnemyInput();
    bad.seedSpells = [
      { text: 'cat12', kind: 'Real' },
      { text: 'zoo10', kind: 'Real' }, // zoo10 only appears in phase 2
    ];
    const result = EnemySchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) =>
          i.path[0] === 'seedSpells' &&
          i.path[1] === 1 &&
          i.path[2] === 'text',
      );
      expect(issue).toBeDefined();
      expect(issue?.message).toMatch(/must appear in phases\[0\]\.realPool/);
    }
  });

  it('rejects phases not in strictly descending hpThreshold order', () => {
    const bad = validEnemyInput();
    bad.phases[0]!.hpThreshold = 0.5;
    bad.phases[1]!.hpThreshold = 1.0;
    const result = EnemySchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) =>
          i.path[0] === 'phases' &&
          i.path[1] === 1 &&
          i.path[2] === 'hpThreshold',
      );
      expect(issue).toBeDefined();
      expect(issue?.message).toMatch(/strictly less than/);
    }
  });

  it('rejects equal hpThresholds (not strictly decreasing)', () => {
    const bad = validEnemyInput();
    bad.phases[0]!.hpThreshold = 0.7;
    bad.phases[1]!.hpThreshold = 0.7;
    const result = EnemySchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('PlayerProfileSchema', () => {
  it('parses base stats and brands them', () => {
    const profile = PlayerProfileSchema.parse({ baseHp: 3, baseAttack: 1 });
    expect(profile.baseHp).toBe(3);
    expect(profile.baseAttack).toBe(1);
    expect(profile.modifiers).toEqual([]);
  });

  it('rejects negative HP', () => {
    expect(() =>
      PlayerProfileSchema.parse({ baseHp: -1, baseAttack: 1 }),
    ).toThrow();
  });
});
