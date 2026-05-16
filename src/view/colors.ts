/**
 * Visual contract tokens for Kinds and Outcomes.
 *
 * The `text-spell-real` / `text-spell-decoy` classes resolve via the
 * `spell.real` / `spell.decoy` color tokens in `tailwind.config.js`.
 *
 * Per `src/view/CONTEXT.md` (Color Coding for Kinds), the same Kind must
 * look the same across every Screen — these constants are the single source.
 */

import type { Kind, Outcome } from '../combat/types';

export const KIND_CLASS: Record<Kind, string> = {
  Real: 'text-spell-real',
  Decoy: 'text-spell-decoy',
};

export const KIND_BORDER_CLASS: Record<Kind, string> = {
  Real: 'border-spell-real',
  Decoy: 'border-spell-decoy',
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  Counterattack: '✓ Counterattack',
  Hit: '✗ Hit',
  Backfire: '✗ Backfire',
  Dodge: '✓ Dodge',
};

/**
 * Tailwind text-color classes for each Outcome. Counterattack/Dodge are
 * "good" (player-side); Hit/Backfire are "bad" (enemy-side). Aligning
 * these to the Kind palette would conflate "Real spell" with "good outcome"
 * — which is wrong (a Real spell is bad if missed). So Outcome colors are
 * independent.
 */
export const OUTCOME_CLASS: Record<Outcome, string> = {
  Counterattack: 'text-emerald-400',
  Hit: 'text-rose-400',
  Backfire: 'text-rose-400',
  Dodge: 'text-emerald-400',
};
