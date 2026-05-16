/**
 * Content-context types: Enemy, Phase, SeedSpell.
 *
 * These are placeholder TypeScript interfaces that the content agent will
 * convert to Zod-inferred types — see src/content/CONTEXT.md and
 * src/content/docs/adr/0001-yaml-data-zod.md. The shape must match exactly;
 * type-driven development means runtime validation and compile-time types
 * are one source of truth.
 *
 * Consumers outside `content/` import these types only.
 */

import type { Attack, EnemyId, HP, Score } from '../run/types';
import type { Kind, PatternSrc } from '../combat/types';

export type Phase = {
  readonly hpThreshold: number;
  readonly attack: Attack;
  readonly realPool: readonly string[];
  readonly decoyPool: readonly string[];
};

export type SeedSpell = {
  readonly text: string;
  readonly kind: Kind;
};

export type Enemy = {
  readonly id: EnemyId;
  readonly name: string;
  readonly pattern: PatternSrc;
  readonly baseHp: HP;
  readonly defeatBounty: Score;
  readonly flawlessBonus: Score;
  readonly phases: readonly Phase[];
  readonly seedSpells: readonly SeedSpell[];
};
