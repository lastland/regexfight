/**
 * YAML loaders for content authored under `data/`. Pure of side effects until
 * called; module evaluation does no I/O (per project rules).
 *
 * Each loader parses YAML text → unknown, then runs the matching Zod schema's
 * `.parse(...)` and surfaces validation failures by throwing the (already
 * descriptive) ZodError.
 *
 * These loaders are NOT reached from runtime code — runtime fetches
 * pre-validated JSON from `./fetch.ts`. They live here for use by:
 *   - tests (`./load.test.ts`, `./schemas.test.ts`, `src/app/App.test.tsx`),
 *   - the build-time content validator (`scripts/validate-content.ts`),
 *   - and the Vite plugin's projection mirror (`vite-plugins/content.ts`
 *     does not import this file but its `project*` functions are paired
 *     with the schemas referenced here).
 *
 * Importing this module pulls `yaml` and `zod` into the call graph. Keep
 * runtime barrels (`./index.ts`, `./fetch.ts`) free of any reference to it.
 *
 * See ADR-0002 (content): data is fetched as JSON, not bundled.
 */

import { parse as parseYaml } from 'yaml';
import type { PlayerProfile } from '../run/types';
import { EnemySchema, PlayerProfileSchema } from './schemas';
import type { Enemy } from './types';

// eslint-disable-next-line @typescript-eslint/require-await -- async preserves Promise-rejection semantics for callers that surface schema failures via `.rejects.toThrow(...)` and matches the async signature of the URL-loading variants below.
export async function loadEnemyYaml(yamlText: string): Promise<Enemy> {
  const raw: unknown = parseYaml(yamlText);
  return EnemySchema.parse(raw);
}

// eslint-disable-next-line @typescript-eslint/require-await -- see loadEnemyYaml
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
