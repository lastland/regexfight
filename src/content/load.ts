/**
 * YAML loaders for content authored under `data/`. Pure of side effects until
 * called; module evaluation does no I/O (per project rules).
 *
 * Each loader parses YAML text → unknown, then runs the matching Zod schema's
 * `.parse(...)` and surfaces validation failures by throwing the (already
 * descriptive) ZodError.
 */

import { parse as parseYaml } from 'yaml';
import type { PlayerProfile } from '../run/types';
import { EnemySchema, PlayerProfileSchema } from './schemas';
import type { Enemy } from './types';

export async function loadEnemyYaml(yamlText: string): Promise<Enemy> {
  const raw: unknown = parseYaml(yamlText);
  return EnemySchema.parse(raw);
}

export async function loadPlayerYaml(yamlText: string): Promise<PlayerProfile> {
  const raw: unknown = parseYaml(yamlText);
  return PlayerProfileSchema.parse(raw);
}

export async function loadEnemyFromUrl(url: string): Promise<Enemy> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `loadEnemyFromUrl: HTTP ${res.status} ${res.statusText} fetching ${url}`,
    );
  }
  const text = await res.text();
  return loadEnemyYaml(text);
}

export async function loadPlayerFromUrl(url: string): Promise<PlayerProfile> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `loadPlayerFromUrl: HTTP ${res.status} ${res.statusText} fetching ${url}`,
    );
  }
  const text = await res.text();
  return loadPlayerYaml(text);
}
