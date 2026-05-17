/**
 * Pure-projection tests for `vite-plugins/content.ts`.
 *
 * These bypass Vite and exercise the projection functions directly. They
 * assert the load-bearing property: `pattern` never appears in what the
 * plugin would emit for an Enemy.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { ENTRIES, projectEnemy, projectPlayer } from './content';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

function readYamlObject(rel: string): Record<string, unknown> {
  const text = readFileSync(path.join(ROOT, rel), 'utf8');
  return parseYaml(text) as Record<string, unknown>;
}

describe('content plugin — projectEnemy', () => {
  it('strips pattern from the emitted Enemy JSON', () => {
    const raw = readYamlObject('data/enemies/00-java-float.yaml');
    expect(raw).toHaveProperty('pattern'); // sanity: source HAS pattern
    const projected = projectEnemy(raw);
    expect(projected).not.toHaveProperty('pattern');
  });

  it('preserves all runtime-relevant Enemy fields', () => {
    const raw = readYamlObject('data/enemies/00-java-float.yaml');
    const projected = projectEnemy(raw);
    for (const field of [
      'id',
      'name',
      'baseHp',
      'defeatBounty',
      'flawlessBonus',
      'phases',
      'seedSpells',
    ]) {
      expect(projected).toHaveProperty(field);
    }
  });

  it('defaults realRate to 0.5 when absent at the Enemy level', () => {
    const projected = projectEnemy({
      id: 'x',
      name: 'X',
      baseHp: 1,
      defeatBounty: 0,
      flawlessBonus: 0,
      phases: [],
      seedSpells: [],
    });
    expect(projected.realRate).toBe(0.5);
  });

  it('preserves an explicit realRate', () => {
    const projected = projectEnemy({ realRate: 0.7 });
    expect(projected.realRate).toBe(0.7);
  });
});

describe('content plugin — projectPlayer', () => {
  it('emits {baseHp, baseAttack, modifiers: []}', () => {
    const raw = readYamlObject('data/player.yaml');
    const projected = projectPlayer(raw);
    expect(projected).toEqual({
      baseHp: raw.baseHp,
      baseAttack: raw.baseAttack,
      modifiers: [],
    });
  });
});

describe('content plugin — manifest', () => {
  it('includes the two known entries', () => {
    const srcs = ENTRIES.map((e) => e.src).sort();
    expect(srcs).toEqual([
      'data/enemies/00-java-float.yaml',
      'data/player.yaml',
    ]);
  });

  it('emitted JSON for the enemy contains no answer regex source', () => {
    const raw = readYamlObject('data/enemies/00-java-float.yaml');
    const projected = projectEnemy(raw);
    const serialized = JSON.stringify(projected);
    // None of the regex anchors / pattern fragments from the YAML may
    // appear in the emitted JSON.
    expect(serialized).not.toContain('[+-]?');
    expect(serialized).not.toContain('(0|[1-9]');
    expect(serialized).not.toMatch(/"pattern"/);
  });
});
