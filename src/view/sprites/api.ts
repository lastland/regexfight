/**
 * Public API for the sprite system.
 *
 * Other agents (notably the animation state machine in EncounterCanvas)
 * consume this module via `./sprites`. The types and signatures here are
 * the contract named in the v1.1 sprite-system brief and ADR-0005/ADR-0006.
 *
 * Each `get*` function returns a same-instance `HTMLCanvasElement` per
 * cache key, ready to be `drawImage`-d into the encounter canvas. Cache
 * canvases are sized in *logical* pixels — DPR scaling is the caller's
 * responsibility at draw time.
 */

import {
  composePlayerFigure,
  rasterizeEnemy,
  rasterizeWardSigil,
  rasterizeSpellProjectile,
} from './composition';

export type PlayerPose = 'idle' | 'hit' | 'counterattack';
export type EnemyPose = 'idle' | 'casting' | 'hit' | 'defeated';
export type WardSigilState = 'idle' | 'active';
export type SpellKindForVisual = 'Real' | 'Decoy';

export type PlayerSkin = {
  readonly bodyShape: 'male' | 'female';
  readonly hairStyle: 'short' | 'long' | 'curly' | 'bald';
  readonly clothStyle: 'robe' | 'tunic' | 'cape';
  readonly weapon: 'none' | 'staff' | 'wand';
  readonly wardSigilStyle: 'circle' | 'triangle' | 'rune';
  readonly palette: {
    readonly skin: string;
    readonly hair: string;
    readonly eye: string;
    readonly cloth: string;
  };
};

/** localStorage key for the active PlayerSkin. */
export const SKIN_STORAGE_KEY = 'regexfight:skin:v1';

export function getPlayerFigure(
  pose: PlayerPose,
  skin: PlayerSkin,
): HTMLCanvasElement {
  return composePlayerFigure(pose, skin);
}

export function getEnemyFigure(pose: EnemyPose): HTMLCanvasElement {
  return rasterizeEnemy(pose);
}

export function getWardSigil(
  state: WardSigilState,
  style: PlayerSkin['wardSigilStyle'],
): HTMLCanvasElement {
  return rasterizeWardSigil(state, style);
}

export function getSpellProjectile(
  kind: SpellKindForVisual,
): HTMLCanvasElement {
  return rasterizeSpellProjectile(kind);
}

// DEFAULT_SKIN, loadSkinFromStorage, saveSkinToStorage live in ./skin and
// are re-exported via ./index alongside the symbols defined here.
