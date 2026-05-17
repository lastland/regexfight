/**
 * Speed-aware release envelope.
 *
 * Combat fires sound triggers at the Speed Multiplier's pace. At 10× the
 * full per-spell window is ~180 ms, so the natural ~500 ms decay of a
 * sample would overlap the next two casts. This envelope truncates the
 * decay inversely with speed: full at 1×, shrinking linearly down to a
 * floor at high speeds.
 *
 * The envelope is the *gain side* of the voice; the BufferSourceNode is
 * still scheduled to stop at the truncated end + a small post-fade.
 */

import type { SpeedMultiplier } from '../useSpeedMultiplier';

/** Floor — even at 10× we keep ~12% of the natural duration so the impact still registers. */
const MIN_SCALE = 0.12;

/** Headroom multiplier on `1 / speed` to keep tails breathing a bit longer than the strict ratio. */
const SCALE_FUDGE = 1.2;

/** Short fade-out at the truncated end so a clipped sample doesn't click. */
export const FADE_OUT_SEC = 0.015;

/**
 * Map Speed Multiplier → fraction of the sample's natural duration to play.
 *
 *   1×  → 1.00  (full sample)
 *   2×  → 0.60
 *   5×  → 0.24
 *   10× → 0.12  (floor)
 */
export function computeReleaseScale(speed: SpeedMultiplier): number {
  const raw = (1 / speed) * SCALE_FUDGE;
  if (raw >= 1) return 1;
  if (raw <= MIN_SCALE) return MIN_SCALE;
  return raw;
}

/**
 * Build a GainNode whose envelope holds at 1.0 until `dur * releaseScale`
 * and then fades to 0 over `FADE_OUT_SEC`. The total scheduled gain
 * lifetime is `dur * releaseScale + FADE_OUT_SEC`.
 *
 * Returns the node and the wall-clock time at which the voice's BufferSource
 * should be stopped (for `src.stop(stopAt)`).
 */
export function makeReleaseEnvelope(
  ctx: BaseAudioContext,
  when: number,
  naturalDurSec: number,
  releaseScale: number,
): { gain: GainNode; stopAt: number } {
  const playFor = naturalDurSec * releaseScale;
  const fadeEnd = when + playFor + FADE_OUT_SEC;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1, when);
  gain.gain.setValueAtTime(1, when + playFor);
  gain.gain.linearRampToValueAtTime(0, fadeEnd);
  return { gain, stopAt: fadeEnd };
}
