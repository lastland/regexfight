/**
 * Zod schemas for content authored in YAML.
 *
 * These schemas are the single source of truth for the typed domain model
 * (see src/content/docs/adr/0001-yaml-data-zod.md). TypeScript types are
 * derived via z.infer in src/content/types.ts.
 *
 * Cross-field invariants enforced here:
 *  - Pattern source compiles to a valid RegExp.
 *  - Phases are ordered by strictly decreasing hpThreshold.
 *  - Every realPool entry matches the compiled Pattern; every decoyPool
 *    entry does NOT match it. (Per Phase.)
 *  - Every Seed Spell's text appears in the matching Phase-1 pool.
 */

import { z } from 'zod';
import {
  attack as toAttack,
  enemyId as toEnemyId,
  hp as toHp,
  score as toScore,
} from '../run/types';
import type {
  Attack,
  HP,
  Score,
  EnemyId,
  PlayerProfile,
} from '../run/types';
import type { PatternSrc } from '../combat/types';

// --- Primitive enums / leaf schemas -----------------------------------------

export const KindSchema = z.enum(['Real', 'Decoy']);

export const SpellSchema = z.object({
  text: z.string().min(1),
  kind: KindSchema,
});

/**
 * A YAML-authored regex source string. Validated by attempting to
 * `new RegExp(...)` it; the transform brands it as PatternSrc for downstream
 * consumers.
 */
export const PatternSrcSchema = z
  .string()
  .min(1)
  .refine(
    (s) => {
      try {
        new RegExp(s);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'invalid regex' },
  )
  .transform((s): PatternSrc => s as PatternSrc);

// --- Phase ------------------------------------------------------------------

export const PhaseSchema = z.object({
  hpThreshold: z.number().gt(0).lte(1),
  attack: z
    .number()
    .int()
    .nonnegative()
    .transform((n): Attack => toAttack(n)),
  realPool: z.array(z.string().min(1)).min(1).readonly(),
  decoyPool: z.array(z.string().min(1)).min(1).readonly(),
});

// --- Enemy ------------------------------------------------------------------

/**
 * The raw object schema, before cross-field refinement. Kept separate so the
 * superRefine can see the parsed-and-transformed fields together.
 */
const EnemyBaseSchema = z.object({
  id: z
    .string()
    .min(1)
    .transform((s): EnemyId => toEnemyId(s)),
  name: z.string().min(1),
  pattern: PatternSrcSchema,
  baseHp: z
    .number()
    .int()
    .positive()
    .transform((n): HP => toHp(n)),
  defeatBounty: z
    .number()
    .int()
    .nonnegative()
    .transform((n): Score => toScore(n)),
  flawlessBonus: z
    .number()
    .int()
    .nonnegative()
    .transform((n): Score => toScore(n)),
  phases: z.array(PhaseSchema).min(1).readonly(),
  seedSpells: z.array(SpellSchema).readonly(),
});

export const EnemySchema = EnemyBaseSchema.superRefine((enemy, ctx) => {
  // 1) Phases ordered by strictly decreasing hpThreshold.
  for (let i = 1; i < enemy.phases.length; i++) {
    const prev = enemy.phases[i - 1];
    const cur = enemy.phases[i];
    if (!prev || !cur) continue;
    if (!(cur.hpThreshold < prev.hpThreshold)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phases', i, 'hpThreshold'],
        message: `hpThreshold must be strictly less than previous phase's (${prev.hpThreshold}); got ${cur.hpThreshold}`,
      });
    }
  }

  // 2) Pattern compiles — guaranteed by PatternSrcSchema. Build the RegExp.
  let re: RegExp;
  try {
    re = new RegExp(enemy.pattern);
  } catch {
    // PatternSrcSchema should have caught this; defensive bail-out.
    return;
  }

  // 3) Per-phase pool invariants.
  enemy.phases.forEach((phase, pIdx) => {
    phase.realPool.forEach((text, tIdx) => {
      if (!re.test(text)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phases', pIdx, 'realPool', tIdx],
          message: `realPool entry ${JSON.stringify(text)} does not match pattern /${enemy.pattern}/`,
        });
      }
    });
    phase.decoyPool.forEach((text, tIdx) => {
      if (re.test(text)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phases', pIdx, 'decoyPool', tIdx],
          message: `decoyPool entry ${JSON.stringify(text)} unexpectedly matches pattern /${enemy.pattern}/`,
        });
      }
    });
  });

  // 4) Seed Spells must appear in the matching Phase-1 pool.
  const phase1 = enemy.phases[0];
  if (phase1) {
    enemy.seedSpells.forEach((seed, sIdx) => {
      const pool = seed.kind === 'Real' ? phase1.realPool : phase1.decoyPool;
      if (!pool.includes(seed.text)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['seedSpells', sIdx, 'text'],
          message: `Seed Spell ${JSON.stringify(seed.text)} (kind=${seed.kind}) must appear in phases[0].${seed.kind === 'Real' ? 'realPool' : 'decoyPool'}`,
        });
      }
    });
  }
});

// --- PlayerProfile ----------------------------------------------------------

/**
 * Player base stats authored in data/player.yaml. The schema accepts plain
 * numbers and transforms them into the branded HP / Attack types. Modifiers
 * default to the empty list (v1 — see run/types.ts).
 */
export const PlayerProfileSchema = z
  .object({
    baseHp: z.number().nonnegative(),
    baseAttack: z.number().nonnegative(),
  })
  .transform(
    ({ baseHp, baseAttack }): PlayerProfile => ({
      baseHp: toHp(baseHp),
      baseAttack: toAttack(baseAttack),
      modifiers: [],
    }),
  );
