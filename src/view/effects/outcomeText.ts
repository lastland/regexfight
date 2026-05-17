/**
 * Outcome Text Overlay — large center-screen pixel text at the Impact Moment.
 *
 * COUNTER! / DODGE! celebrate the player's correct Ward decision. Hit and
 * Backfire intentionally have no text; flash + HP drop already convey the
 * failure (see ADR-0007 view; CONTEXT.md "Outcome Text Overlay").
 *
 * Animation curve (over `OUTCOME_TEXT_DURATION_MS`):
 *
 *     t ∈ [0,    0.12) → scale-pop from 0.6 → 1.15
 *     t ∈ [0.12, 0.25) → settle from 1.15 → 1.0
 *     t ∈ [0.25, 0.75) → hold at scale 1.0, full alpha
 *     t ∈ [0.75, 1.0)  → fade out alpha 1 → 0, scale 1.0 → 1.05
 *
 * Duration scales with the Speed Multiplier but clamped to a perceptibility
 * floor so the text registers even at 10×.
 */

import type { SpeedMultiplier } from '../useSpeedMultiplier';

export type OutcomeTextKind = 'COUNTER' | 'DODGE';

export const OUTCOME_TEXT_DURATION_MS = 600;

/** Minimum effective duration after speed scaling — so 10× still shows text long enough to read. */
export const OUTCOME_TEXT_MIN_DURATION_MS = 250;

const COLOR_BY_KIND: Record<OutcomeTextKind, string> = {
  COUNTER: '#3df089', // green — matches Counterattack flash colour
  DODGE: '#3da8f0', // blue — matches Dodge shimmer colour
};

const LABEL_BY_KIND: Record<OutcomeTextKind, string> = {
  COUNTER: 'COUNTER!',
  DODGE: 'DODGE!',
};

/** Base font size in CSS pixels at scale 1.0. */
const FONT_SIZE_PX = 36;

/**
 * Returns the effective on-screen duration in ms — `BASE / speed`, clamped
 * upward by the perceptibility floor.
 */
export function effectiveOutcomeTextDuration(speed: SpeedMultiplier): number {
  return Math.max(OUTCOME_TEXT_MIN_DURATION_MS, OUTCOME_TEXT_DURATION_MS / speed);
}

export type OutcomeTextState = {
  kind: OutcomeTextKind;
  startTime: number;
  /** Canvas center in CSS pixels — caller computes from layout. */
  cx: number;
  cy: number;
};

/**
 * Draw the outcome text for one frame. Returns `true` while alive,
 * `false` once it has aged out. Saves/restores the ctx properties it
 * touches.
 */
export function drawOutcomeText(
  ctx: CanvasRenderingContext2D,
  state: OutcomeTextState,
  now: number,
  speed: SpeedMultiplier,
): boolean {
  const duration = effectiveOutcomeTextDuration(speed);
  const age = now - state.startTime;
  if (age < 0) return true;
  if (age >= duration) return false;

  const t = age / duration; // 0..1
  const { scale, alpha } = curve(t);
  const color = COLOR_BY_KIND[state.kind];
  const label = LABEL_BY_KIND[state.kind];

  const prevAlpha = ctx.globalAlpha;
  const prevFill = ctx.fillStyle;
  const prevStroke = ctx.strokeStyle;
  const prevLineWidth = ctx.lineWidth;
  const prevFont = ctx.font;
  const prevTextAlign = ctx.textAlign;
  const prevTextBaseline = ctx.textBaseline;

  const px = Math.round(FONT_SIZE_PX * scale);
  ctx.font = `${px}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = prevAlpha * alpha;

  // Thick black stroke for legibility over any background.
  ctx.lineWidth = Math.max(3, Math.round(px * 0.12));
  ctx.strokeStyle = '#000000';
  ctx.strokeText(label, state.cx, state.cy);

  ctx.fillStyle = color;
  ctx.fillText(label, state.cx, state.cy);

  ctx.globalAlpha = prevAlpha;
  ctx.fillStyle = prevFill;
  ctx.strokeStyle = prevStroke;
  ctx.lineWidth = prevLineWidth;
  ctx.font = prevFont;
  ctx.textAlign = prevTextAlign;
  ctx.textBaseline = prevTextBaseline;
  return true;
}

function curve(t: number): { scale: number; alpha: number } {
  if (t < 0.12) {
    // Scale-pop: 0.6 → 1.15
    const u = t / 0.12;
    return { scale: 0.6 + u * (1.15 - 0.6), alpha: u };
  }
  if (t < 0.25) {
    // Settle: 1.15 → 1.0
    const u = (t - 0.12) / (0.25 - 0.12);
    return { scale: 1.15 + u * (1.0 - 1.15), alpha: 1 };
  }
  if (t < 0.75) {
    return { scale: 1.0, alpha: 1 };
  }
  // Fade out: alpha 1 → 0, scale 1.0 → 1.05
  const u = (t - 0.75) / (1.0 - 0.75);
  return { scale: 1.0 + u * 0.05, alpha: 1 - u };
}
