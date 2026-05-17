/**
 * Enemy Death animation — plays at the Impact Moment of the killing-blow
 * Counterattack (when `event.enemyHp === 0`). Anchors the encounter ending
 * to the hit, instead of letting the postmortem transition appear in a
 * separate beat after the Aftermath.
 *
 * Curve over the effective duration:
 *
 *     t ∈ [0,    0.2) → white flash ramps in (silhouette alpha 0 → 1)
 *     t ∈ [0.2,  0.4) → peak hold (silhouette full white)
 *     t ∈ [0.4,  1.0) → silhouette + enemy sprite both fade to 0
 *
 * Sprite alpha stays at 1 until the peak, then fades linearly to 0 with
 * the silhouette. So during the flash the enemy is visible behind the
 * white; during the fade-out the white fade reveals the disappearing
 * sprite, ending on transparent.
 *
 * Duration scales with the Speed Multiplier (the whole "boss kill" beat
 * compresses at higher multipliers).
 */

import type { SpeedMultiplier } from '../useSpeedMultiplier';

export const ENEMY_DEATH_DURATION_MS = 1000;

const FLASH_IN_END = 0.2;
const PEAK_END = 0.4;
const SILHOUETTE_COLOR = '#ffffff';

export type EnemyDeathFrame = {
  /** Multiplier on the enemy sprite's alpha (1 = fully visible, 0 = gone). */
  spriteAlpha: number;
  /** Alpha of the white silhouette overlay (0 = no overlay, 1 = full white). */
  silhouetteAlpha: number;
  /** False once the animation has completed; caller can clear state. */
  alive: boolean;
};

export function enemyDeathFrame(
  startTime: number,
  now: number,
  speed: SpeedMultiplier,
): EnemyDeathFrame {
  const duration = ENEMY_DEATH_DURATION_MS / speed;
  const age = now - startTime;
  if (age < 0) {
    return { spriteAlpha: 1, silhouetteAlpha: 0, alive: true };
  }
  if (age >= duration) {
    return { spriteAlpha: 0, silhouetteAlpha: 0, alive: false };
  }
  const t = age / duration;
  if (t < FLASH_IN_END) {
    const u = t / FLASH_IN_END;
    return { spriteAlpha: 1, silhouetteAlpha: u, alive: true };
  }
  if (t < PEAK_END) {
    return { spriteAlpha: 1, silhouetteAlpha: 1, alive: true };
  }
  const u = (t - PEAK_END) / (1 - PEAK_END); // 0..1 through the fade-out
  const fade = 1 - u;
  return { spriteAlpha: fade, silhouetteAlpha: fade, alive: true };
}

/**
 * Draw the white silhouette overlay for one frame. Caller is responsible
 * for drawing the underlying enemy sprite (with `frame.spriteAlpha` applied)
 * BEFORE invoking this — the silhouette sits on top.
 */
export function drawEnemyDeathSilhouette(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  frame: EnemyDeathFrame,
): void {
  if (frame.silhouetteAlpha <= 0) return;
  const prevAlpha = ctx.globalAlpha;
  const prevFill = ctx.fillStyle;
  ctx.globalAlpha = prevAlpha * frame.silhouetteAlpha;
  ctx.fillStyle = SILHOUETTE_COLOR;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = prevAlpha;
  ctx.fillStyle = prevFill;
}
