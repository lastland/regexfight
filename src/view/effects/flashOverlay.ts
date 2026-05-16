/**
 * Per-Outcome flash overlay — the wash of colour that lands at Resolution.
 *
 * Each Outcome has its own colour (ADR-0004, Color Coding for Outcomes):
 *
 *  - Counterattack → green   (on the enemy figure)
 *  - Hit           → red     (on the player figure)
 *  - Backfire      → amber   (on the player figure; distinct from Hit's red)
 *  - Dodge         → blue    (on the player figure; subtle shimmer)
 *
 * The animation state machine in the Encounter Canvas supplies the bounding
 * rect (whichever figure should be highlighted) and the colour mapping.
 * Duration scales with the Speed Multiplier (Resolution scales).
 */

import type { SpeedMultiplier } from '../useSpeedMultiplier';

export type FlashColor = 'green' | 'red' | 'amber' | 'blue';

export const FLASH_BY_OUTCOME: Record<
  'Counterattack' | 'Hit' | 'Backfire' | 'Dodge',
  FlashColor
> = {
  Counterattack: 'green',
  Hit: 'red',
  Backfire: 'amber',
  Dodge: 'blue',
};

/** Duration at 1× speed. Scales as `FLASH_DURATION_MS / speed`. */
export const FLASH_DURATION_MS = 250;

/** Peak alpha at t=0. Decays linearly to 0 over the duration. */
const PEAK_ALPHA = 0.6;

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
 * Saves/restores `globalAlpha` and `fillStyle` so the caller doesn't have
 * to wrap the call in its own save/restore.
 */
export function drawFlash(
  ctx: CanvasRenderingContext2D,
  color: FlashColor,
  rect: { x: number; y: number; w: number; h: number },
  startTime: number,
  now: number,
  speed: SpeedMultiplier,
): boolean {
  const effectiveDuration = FLASH_DURATION_MS / speed;
  const age = now - startTime;
  if (age < 0) return true; // future-spawn safety
  if (age >= effectiveDuration) return false;

  const t = age / effectiveDuration; // 0..1
  const alpha = PEAK_ALPHA * (1 - t);

  const prevAlpha = ctx.globalAlpha;
  const prevFill = ctx.fillStyle;
  ctx.globalAlpha = prevAlpha * alpha;
  ctx.fillStyle = FLASH_HEX[color];
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = prevAlpha;
  ctx.fillStyle = prevFill;
  return true;
}
