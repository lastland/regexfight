/**
 * Public surface of the v1.1 visual effects toolkit.
 *
 * The Encounter Canvas animation state machine composes these primitives
 * into the per-spell five-phase sequence (see
 * `src/view/docs/adr/0004-five-phase-spell-animation.md`).
 */

export {
  DAMAGE_NUMBER_DURATION_MS,
  drawDamageNumber,
  pickDamageColor,
  type DamageNumber,
  type DamageNumberStyle,
} from './damageNumbers';

export {
  HP_BAR_FLASH_MS,
  HP_BAR_TWEEN_MS,
  HpBarTween,
  type HpBarTweenProps,
} from './hpBarTween';

export {
  FLASH_BY_OUTCOME,
  FLASH_DURATION_MS,
  drawFlash,
  type FlashColor,
} from './flashOverlay';

export {
  SHAKE_DURATION_MS,
  SHAKE_MAGNITUDE_PX,
  getShakeOffset,
} from './screenShake';
