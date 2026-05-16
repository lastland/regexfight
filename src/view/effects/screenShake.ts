/**
 * Screen shake — a small per-frame `{offsetX, offsetY}` the Encounter
 * Canvas applies to its draw transform during a Hit's Resolution.
 *
 * Only Hit triggers shake (ADR-0004): Counterattack, Backfire, and Dodge
 * are explicitly shake-less. The caller owns the "is a shake active?"
 * state by holding the `startTime`; this module is pure.
 *
 * Duration scales with the Speed Multiplier. Magnitude decays linearly
 * from `SHAKE_MAGNITUDE_PX` to 0 over the lifetime. The offset is driven
 * by `Math.sin` with different phases on X and Y — visually busy enough
 * to read as "impact" without being deterministic across runs (the user
 * won't notice and we don't want a stable phase artefact).
 */

import type { SpeedMultiplier } from '../useSpeedMultiplier';

export const SHAKE_DURATION_MS = 150;
export const SHAKE_MAGNITUDE_PX = 3;

/**
 * Returns the offset to apply this frame, or `null` if no shake is
 * active (`startTime === null`) or the shake has finished.
 *
 * Callers typically:
 *
 *     const off = getShakeOffset(shakeStartRef.current, now, speed);
 *     if (off === null) shakeStartRef.current = null;
 *     ctx.translate(off?.offsetX ?? 0, off?.offsetY ?? 0);
 */
export function getShakeOffset(
  startTime: number | null,
  now: number,
  speed: SpeedMultiplier,
): { offsetX: number; offsetY: number } | null {
  if (startTime === null) return null;
  const effectiveDuration = SHAKE_DURATION_MS / speed;
  const age = now - startTime;
  if (age < 0) return { offsetX: 0, offsetY: 0 };
  if (age >= effectiveDuration) return null;

  const t = age / effectiveDuration; // 0..1
  const magnitude = SHAKE_MAGNITUDE_PX * (1 - t);
  // Two independent sinusoids — different frequencies and a Y-phase
  // offset so the figure doesn't oscillate along a diagonal line.
  const offsetX = Math.sin(now * 0.08) * magnitude;
  const offsetY = Math.sin(now * 0.11 + 1.3) * magnitude;
  return { offsetX, offsetY };
}
