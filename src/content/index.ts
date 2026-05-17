/**
 * Public surface of the `content` context.
 *
 * Runtime callers (`src/app/App.tsx`) should import only what is reachable
 * here. The intentional shape:
 *
 *   - `fetchEnemyJson` / `fetchPlayerJson` — runtime data fetchers; they
 *     consume the JSON assets emitted by `vite-plugins/content.ts` and pull
 *     in no `yaml` or `zod` code.
 *   - The structural types (`Enemy`, `Phase`, `SeedSpell`).
 *
 * The YAML loaders and Zod schemas are intentionally NOT re-exported. Tests
 * and `scripts/validate-content.ts` import them directly from `./load` and
 * `./schemas` so the runtime barrel can never accidentally drag `zod` into
 * the production bundle.
 *
 * See ADR-0002 (content): data is fetched as JSON, not bundled.
 */

export { fetchEnemyJson, fetchPlayerJson } from './fetch';

export type { Enemy, Phase, SeedSpell } from './types';
