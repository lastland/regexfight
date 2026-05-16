/**
 * Floating damage numbers — a primitive of the v1.1 visual effects toolkit.
 *
 * The animation state machine in the Encounter Canvas owns a list of "live"
 * damage numbers (spawned at Resolution / Aftermath). Each frame it calls
 * `drawDamageNumber` for every entry and drops those that return `false`
 * (aged out).
 *
 * Duration scales with the Speed Multiplier — per ADR-0004, damage numbers
 * are part of Aftermath, which scales. (The HP-bar tween, by contrast,
 * does NOT scale — see `hpBarTween.tsx`.)
 *
 * Color is picked separately via `pickDamageColor` so the caller can decide
 * at spawn time (the caller has the Outcome; this module doesn't).
 */

import type { SpeedMultiplier } from '../useSpeedMultiplier';

export type DamageNumber = {
  readonly id: number;
  /** Negative for damage taken; positive reserved for future heal/buff numbers. */
  readonly value: number;
  /** Origin in CSS px on the canvas. */
  readonly x: number;
  readonly y: number;
  readonly side: 'player' | 'enemy';
  /** `performance.now()` (or any monotonic clock) at spawn. */
  readonly spawnTime: number;
};

export type DamageNumberStyle = 'red' | 'amber' | 'green';

/**
 * The duration of a single floating-number sprite at 1× speed.
 * Scales as `DAMAGE_NUMBER_DURATION_MS / speed` per ADR-0004 Aftermath.
 */
export const DAMAGE_NUMBER_DURATION_MS = 600;

/** Vertical float distance over the full lifetime, in CSS px. */
const FLOAT_DISTANCE_PX = 24;

/** Fraction of the lifetime over which we fade out, measured from the end. */
const FADE_TAIL = 0.3;

const COLOR_HEX: Record<DamageNumberStyle, string> = {
  red: '#f0563d',
  amber: '#f0a83d',
  green: '#3df089',
};

/**
 * Per Outcome × side, pick the damage-number colour.
 *
 *  - Counterattack damage lands on the enemy → green (player-positive feedback).
 *  - Hit damage lands on the player → red.
 *  - Backfire damage lands on the player → amber (distinct from Hit's red,
 *    so the player can tell what kind of error they made).
 *
 * The (side, outcome) combinations not enumerated by the Outcome → side
 * convention above (e.g. Counterattack on the player) shouldn't occur in
 * practice; we return the side-appropriate default rather than throw, so
 * the renderer never crashes mid-animation.
 */
export function pickDamageColor(
  side: DamageNumber['side'],
  outcome: 'Counterattack' | 'Hit' | 'Backfire',
): DamageNumberStyle {
  switch (outcome) {
    case 'Counterattack':
      return 'green';
    case 'Hit':
      return 'red';
    case 'Backfire':
      return 'amber';
    default: {
      // Exhaustiveness guard — silences TS and keeps the function total.
      const _exhaustive: never = outcome;
      void _exhaustive;
      void side;
      return 'red';
    }
  }
}

/**
 * Draw a single floating damage number to the given 2D context. Returns
 * `true` while the number is still alive; `false` once it has aged out
 * (the caller should drop it from its list).
 *
 * The function is pure w.r.t. the canvas state in the sense that it
 * saves and restores transient context state (alpha, font, fill, stroke),
 * so a caller drawing many numbers in a row doesn't need to do its own
 * save/restore between them.
 */
export function drawDamageNumber(
  ctx: CanvasRenderingContext2D,
  num: DamageNumber,
  now: number,
  speed: SpeedMultiplier,
  style: DamageNumberStyle,
): boolean {
  const effectiveDuration = DAMAGE_NUMBER_DURATION_MS / speed;
  const age = now - num.spawnTime;
  if (age < 0) return true; // future-spawn safety
  if (age >= effectiveDuration) return false;

  const t = age / effectiveDuration; // 0..1
  const dy = -FLOAT_DISTANCE_PX * t;
  const alpha = t < 1 - FADE_TAIL ? 1 : Math.max(0, 1 - (t - (1 - FADE_TAIL)) / FADE_TAIL);

  const text = formatValue(num.value);
  const x = num.x;
  const y = num.y + dy;

  const prevAlpha = ctx.globalAlpha;
  const prevFont = ctx.font;
  const prevFill = ctx.fillStyle;
  const prevStroke = ctx.strokeStyle;
  const prevLineWidth = ctx.lineWidth;
  const prevAlign = ctx.textAlign;
  const prevBaseline = ctx.textBaseline;

  ctx.globalAlpha = prevAlpha * alpha;
  // Chunky monospace for pixel-art readability.
  ctx.font = '16px "JetBrains Mono", "Fira Code", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Hard black outline first, then the coloured fill on top.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#000000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = COLOR_HEX[style];
  ctx.fillText(text, x, y);

  ctx.globalAlpha = prevAlpha;
  ctx.font = prevFont;
  ctx.fillStyle = prevFill;
  ctx.strokeStyle = prevStroke;
  ctx.lineWidth = prevLineWidth;
  ctx.textAlign = prevAlign;
  ctx.textBaseline = prevBaseline;
  return true;
}

function formatValue(v: number): string {
  if (v === 0) return '0';
  // Damage numbers are conventionally written with their sign so a stray
  // positive (heal/buff) is unambiguous.
  return v > 0 ? `+${v}` : `${v}`;
}
