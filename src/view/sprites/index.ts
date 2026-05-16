/**
 * Public surface of the sprite system. Other agents import from
 * `../view/sprites` (this file). Everything else is internal.
 */

export type {
  PlayerPose,
  EnemyPose,
  WardSigilState,
  SpellKindForVisual,
  PlayerSkin,
} from './api';
export {
  SKIN_STORAGE_KEY,
  getPlayerFigure,
  getEnemyFigure,
  getWardSigil,
  getSpellProjectile,
} from './api';
export {
  DEFAULT_SKIN,
  loadSkinFromStorage,
  saveSkinToStorage,
} from './skin';
