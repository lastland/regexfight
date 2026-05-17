/**
 * Loader tests: actually load and validate the on-disk YAML files in `data/`.
 *
 * We pull the YAML files in as raw strings via Vite's `?raw` import (works
 * in both Vite dev and Vitest), so the tests don't depend on @types/node
 * being installed.
 */

import { describe, expect, it } from 'vitest';
import { loadEnemyYaml, loadPlayerYaml } from './load';

// Vite/Vitest support `?raw` to load any file as a string at module-load
// time. The relative paths reach out from src/content/ to data/. Module
// declarations are provided by `src/vite-env.d.ts`.
import javaFloatYaml from '../../data/enemies/00-java-float.yaml?raw';
import playerYaml from '../../data/player.yaml?raw';

describe('loadEnemyYaml', () => {
  it('parses and validates data/enemies/00-java-float.yaml', async () => {
    const enemy = await loadEnemyYaml(javaFloatYaml);
    expect(enemy.id).toBe('java-float');
    expect(enemy.name).toBe('Floating Phantasm');
    expect(enemy.baseHp).toBe(20);
    expect(enemy.phases.length).toBeGreaterThanOrEqual(2);
    expect(enemy.phases[0]?.hpThreshold).toBe(1.0);
    expect(enemy.seedSpells.length).toBeGreaterThan(0);
  });

  it('throws on validation failure', async () => {
    const bogus = 'id: x\nname: y\npattern: "["\nbaseHp: 1\n';
    await expect(loadEnemyYaml(bogus)).rejects.toThrow();
  });
});

/**
 * Pattern-coverage tests: enumerate every authored pool entry and seed
 * Spell, and assert that the loaded Pattern accepts the Reals and rejects
 * the Decoys. The schema's `superRefine` already checks this at load time,
 * but those failures are emitted as a single ZodError. Per-example `it`s
 * here make the failure message name the exact offending string, which is
 * what you want when editing pools or tightening the Pattern.
 */
describe('Floating Phantasm — Pattern coverage', () => {
  // Top-level await isn't available in Vitest's describe body, so we resolve
  // synchronously inside each `it`. Loading is cheap (string parse + Zod).
  it('Pattern compiles', async () => {
    const enemy = await loadEnemyYaml(javaFloatYaml);
    expect(() => new RegExp(enemy.pattern)).not.toThrow();
  });

  it('every realPool entry across all phases is matched by the Pattern', async () => {
    const enemy = await loadEnemyYaml(javaFloatYaml);
    const re = new RegExp(enemy.pattern);
    const failures: string[] = [];
    enemy.phases.forEach((phase, pIdx) => {
      for (const text of phase.realPool) {
        if (!re.test(text))
          failures.push(`phase[${pIdx}].realPool: Pattern rejected ${JSON.stringify(text)}`);
      }
    });
    expect(failures).toEqual([]);
  });

  it('every decoyPool entry across all phases is rejected by the Pattern', async () => {
    const enemy = await loadEnemyYaml(javaFloatYaml);
    const re = new RegExp(enemy.pattern);
    const failures: string[] = [];
    enemy.phases.forEach((phase, pIdx) => {
      for (const text of phase.decoyPool) {
        if (re.test(text))
          failures.push(`phase[${pIdx}].decoyPool: Pattern accepted ${JSON.stringify(text)}`);
      }
    });
    expect(failures).toEqual([]);
  });

  it('every Seed Spell matches the Pattern iff its kind is Real', async () => {
    const enemy = await loadEnemyYaml(javaFloatYaml);
    const re = new RegExp(enemy.pattern);
    const failures: string[] = [];
    enemy.seedSpells.forEach((seed, sIdx) => {
      const matches = re.test(seed.text);
      const wantMatch = seed.kind === 'Real';
      if (matches !== wantMatch)
        failures.push(
          `seedSpells[${sIdx}] ${JSON.stringify(seed.text)} (kind=${seed.kind}): expected match=${wantMatch}, got match=${matches}`,
        );
    });
    expect(failures).toEqual([]);
  });
});

describe('loadPlayerYaml', () => {
  it('parses and validates data/player.yaml', async () => {
    const profile = await loadPlayerYaml(playerYaml);
    expect(profile.baseHp).toBe(3);
    expect(profile.baseAttack).toBe(1);
    expect(profile.modifiers).toEqual([]);
  });
});
