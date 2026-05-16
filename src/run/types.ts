/**
 * Branded primitives and run-context types.
 *
 * See src/run/CONTEXT.md for the glossary entries that name each of these.
 * See src/run/docs/adr/0001-stat-driven-damage-and-modifiers.md for the
 * stats-as-`base + Σ modifiers` commitment that shapes PlayerProfile.
 */

import type { Spell } from '../combat/types';

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type HP = Brand<number, 'HP'>;
export type Attack = Brand<number, 'Attack'>;
export type Score = Brand<number, 'Score'>;

export const hp = (n: number): HP => n as HP;
export const attack = (n: number): Attack => n as Attack;
export const score = (n: number): Score => n as Score;

// Modifier is the empty union in v1. The roguelike pivot fills it with real
// variants (e.g. { kind: 'AttackBoost'; delta: number }). The empty type is
// deliberate — every read of a stat goes through a resolver, so introducing
// the first variant is a content change, not a refactor.
export type Modifier = never;

export type PlayerProfile = {
  baseHp: HP;
  baseAttack: Attack;
  modifiers: Modifier[];
};

export type ObservationLog = Spell[]; // deduped by text

export type EnemyId = string & { readonly [__brand]: 'EnemyId' };
export const enemyId = (s: string): EnemyId => s as EnemyId;

export type Run = {
  // The Enemy roster is owned by `content` (Enemy type). To avoid an import
  // cycle here we keep `enemies` typed via a placeholder — `app` is the
  // composition root that supplies the concrete Enemy[].
  enemies: ReadonlyArray<{ id: EnemyId }>;
  currentIdx: number;
  progressScore: Score;
  observationLogs: Record<string, ObservationLog>;
  visited: Record<string, boolean>;
  player: PlayerProfile;
};
