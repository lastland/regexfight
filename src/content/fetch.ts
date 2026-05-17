/**
 * Runtime JSON fetchers for content. These are the only loaders reached by
 * the production bundle.
 *
 * Kept in a separate module from `./load.ts` so that the runtime import graph
 * never touches `yaml` or `zod`. The build-time JSON projection lives in
 * `vite-plugins/content.ts`; runtime trusts that pipeline.
 *
 * See ADR-0002 (content): data is fetched as JSON, not bundled.
 */

import type { PlayerProfile } from '../run/types';
import type { Enemy } from './types';

export async function fetchEnemyJson(url: string): Promise<Enemy> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `fetchEnemyJson: HTTP ${res.status} ${res.statusText} fetching ${url}`,
    );
  }
  return (await res.json()) as Enemy;
}

export async function fetchPlayerJson(url: string): Promise<PlayerProfile> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `fetchPlayerJson: HTTP ${res.status} ${res.statusText} fetching ${url}`,
    );
  }
  return (await res.json()) as PlayerProfile;
}
