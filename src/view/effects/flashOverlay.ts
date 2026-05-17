/**
 * Per-Outcome flash overlay — the visual that lands at Resolution.
 *
 * Two styles, mapped per Outcome (ADR-0004, Color Coding for Outcomes):
 *
 *  - Counterattack → green   wash    (on the enemy figure)
 *  - Hit           → red     wash    (on the player figure)
 *  - Backfire      → amber   wash    (on the player figure; distinct from Hit)
 *  - Dodge         → blue    shimmer (around the player; an expanding ring
 *                                     pulse, geometrically distinct from the
 *                                     solid wash so it cannot be misread as Hit)
 *
 * The animation state machine in the Encounter Canvas supplies the bounding
 * rect (whichever figure should be highlighted) and the style mapping.
 * Duration scales with the Speed Multiplier (Resolution scales).
 */

import type { SpeedMultiplier } from '../useSpeedMultiplier';

export type FlashColor = 'green' | 'red' | 'amber' | 'blue';
export type FlashStyle = 'wash' | 'shimmer';

export const FLASH_BY_OUTCOME: Record<
  'Counterattack' | 'Hit' | 'Backfire' | 'Dodge',
  FlashColor
> = {
  Counterattack: 'green',
  Hit: 'red',
  Backfire: 'amber',
  Dodge: 'blue',
};

export const FLASH_STYLE_BY_OUTCOME: Record<
  'Counterattack' | 'Hit' | 'Backfire' | 'Dodge',
  FlashStyle
> = {
  Counterattack: 'wash',
  Hit: 'wash',
  Backfire: 'wash',
  Dodge: 'shimmer',
};

/** Wash duration at 1× speed. Scales as `FLASH_DURATION_MS / speed`. */
export const FLASH_DURATION_MS = 250;

/** Shimmer duration at 1× speed — longer than wash so the pulses are readable. */
export const SHIMMER_DURATION_MS = 450;

const WASH_PEAK_ALPHA = 0.6;
const SHIMMER_PEAK_ALPHA = 0.8;
const SHIMMER_PULSES = 3;
const SHIMMER_LINE_WIDTH = 3;
const SHIMMER_EXPAND_PX = 14;

const FLASH_HEX: Record<FlashColor, string> = {
  green: '#3df089',
  red: '#f0563d',
  amber: '#f0a83d',
  blue: '#3da8f0',
};

/**
 * Draw the flash overlay at the given rect for one frame.
 *
 * Returns `true` while the flash is still alive; `false` once it has aged
 * out (caller should clear its "active flash" state).
 *
 * Saves/restores the canvas state it touches so the caller doesn't have to
 * wrap the call in its own save/restore.
 */
export function drawFlash(
  ctx: CanvasRenderingContext2D,
  color: FlashColor,
  rect: { x: number; y: number; w: number; h: number },
  startTime: number,
  now: number,
  speed: SpeedMultiplier,
  style: FlashStyle = 'wash',
): boolean {
  const baseDuration = style === 'shimmer' ? SHIMMER_DURATION_MS : FLASH_DURATION_MS;
  const effectiveDuration = baseDuration / speed;
  const age = now - startTime;
  if (age < 0) return true; // future-spawn safety
  if (age >= effectiveDuration) return false;

  const t = age / effectiveDuration; // 0..1
  if (style === 'shimmer') {
    drawShimmer(ctx, color, rect, t);
  } else {
    drawWash(ctx, color, rect, t);
  }
  return true;
}

function drawWash(
  ctx: CanvasRenderingContext2D,
  color: FlashColor,
  rect: { x: number; y: number; w: number; h: number },
  t: number,
): void {
  const alpha = WASH_PEAK_ALPHA * (1 - t);
  const prevAlpha = ctx.globalAlpha;
  const prevFill = ctx.fillStyle;
  ctx.globalAlpha = prevAlpha * alpha;
  ctx.fillStyle = FLASH_HEX[color];
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = prevAlpha;
  ctx.fillStyle = prevFill;
}

function drawShimmer(
  ctx: CanvasRenderingContext2D,
  color: FlashColor,
  rect: { x: number; y: number; w: number; h: number },
  t: number,
): void {
  // Multi-pulse envelope: sin oscillation modulated by (1-t) so the pulses
  // get quieter as they expand. Geometrically an expanding stroke rect —
  // unmistakably different from the solid wash used for Hit/Backfire.
  const pulse = Math.abs(Math.sin(t * Math.PI * SHIMMER_PULSES));
  const envelope = 1 - t;
  const alpha = SHIMMER_PEAK_ALPHA * pulse * envelope;
  const expand = SHIMMER_EXPAND_PX * t;

  const prevAlpha = ctx.globalAlpha;
  const prevStroke = ctx.strokeStyle;
  const prevLineWidth = ctx.lineWidth;
  ctx.globalAlpha = prevAlpha * alpha;
  ctx.strokeStyle = FLASH_HEX[color];
  ctx.lineWidth = SHIMMER_LINE_WIDTH;
  ctx.strokeRect(
    rect.x - expand,
    rect.y - expand,
    rect.w + expand * 2,
    rect.h + expand * 2,
  );
  ctx.globalAlpha = prevAlpha;
  ctx.strokeStyle = prevStroke;
  ctx.lineWidth = prevLineWidth;
}
