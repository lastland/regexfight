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
import tutorialYaml from '../../data/enemies/00-tutorial.yaml?raw';
import playerYaml from '../../data/player.yaml?raw';

describe('loadEnemyYaml', () => {
  it('parses and validates data/enemies/00-tutorial.yaml', async () => {
    const enemy = await loadEnemyYaml(tutorialYaml);
    expect(enemy.id).toBe('tutorial');
    expect(enemy.phases.length).toBeGreaterThanOrEqual(2);
    expect(enemy.phases[0]?.hpThreshold).toBe(1.0);
    expect(enemy.seedSpells.length).toBeGreaterThan(0);

    const re = new RegExp(enemy.pattern);
    for (const phase of enemy.phases) {
      for (const r of phase.realPool) expect(re.test(r)).toBe(true);
      for (const d of phase.decoyPool) expect(re.test(d)).toBe(false);
    }
  });

  it('throws on validation failure', async () => {
    const bogus = 'id: x\nname: y\npattern: "["\nbaseHp: 1\n';
    await expect(loadEnemyYaml(bogus)).rejects.toThrow();
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
