/**
 * Content-context types: Enemy, Phase, SeedSpell.
 *
 * These types are derived from the Zod schemas in `./schemas.ts` — the
 * schemas are the single source of truth (see
 * `src/content/docs/adr/0001-yaml-data-zod.md`). The shape here matches the
 * downstream-consumer expectations established by the placeholder interfaces
 * that previously lived in this file; downstream contexts (`combat`, `run`,
 * `view`, `app`) keep importing from this path.
 *
 * Consumers outside `content/` import these types only; they do NOT reach
 * into `./schemas.ts`.
 */

import type { z } from 'zod';
import type {
  EnemySchema,
  PhaseSchema,
  SpellSchema,
} from './schemas';

export type Phase = z.infer<typeof PhaseSchema>;
export type SeedSpell = z.infer<typeof SpellSchema>;
export type Enemy = z.infer<typeof EnemySchema>;
