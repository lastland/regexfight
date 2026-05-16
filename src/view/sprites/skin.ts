/**
 * Player Skin defaults + persistence.
 *
 * The active PlayerSkin is cosmetic state. It survives across runs (per
 * ADR-0006) and is stored under `regexfight:skin:v1` — separate from the
 * Run save so switching skins never dirties the Run. Validation is
 * deliberately minimal: invalid JSON or a malformed object returns
 * DEFAULT_SKIN. The cost of "wrong colour for one load" is zero; the cost
 * of a startup crash on a corrupted localStorage entry is total.
 */

import type { PlayerSkin } from './api';
import { SKIN_STORAGE_KEY } from './api';

/**
 * Default Player Skin shipped with v1.1.
 *
 * Geometry: male body, short hair, robe, no weapon, circle Ward Sigil
 * (the only variants authored for v1.1 per ADR-0006).
 *
 * Palette colours (per the brief):
 *   - skin  #e0c8a0  warm pale skin
 *   - hair  #5b3a1d  dark brown
 *   - eye   #2b2b2b  near-black
 *   - cloth #3d4b69  blue-grey, reads as "robe"
 */
export const DEFAULT_SKIN: PlayerSkin = {
  bodyShape: 'male',
  hairStyle: 'short',
  clothStyle: 'robe',
  weapon: 'none',
  wardSigilStyle: 'circle',
  palette: {
    skin: '#e0c8a0',
    hair: '#5b3a1d',
    eye: '#2b2b2b',
    cloth: '#3d4b69',
  },
};

export function loadSkinFromStorage(storage: Storage): PlayerSkin {
  let raw: string | null;
  try {
    raw = storage.getItem(SKIN_STORAGE_KEY);
  } catch {
    return DEFAULT_SKIN;
  }
  if (raw === null) return DEFAULT_SKIN;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SKIN;
  }
  if (!isPlayerSkin(parsed)) return DEFAULT_SKIN;
  return parsed;
}

export function saveSkinToStorage(storage: Storage, skin: PlayerSkin): void {
  try {
    storage.setItem(SKIN_STORAGE_KEY, JSON.stringify(skin));
  } catch {
    // Storage may be unavailable (private browsing, quota). Silent fail —
    // cosmetic state being lost is not game-breaking.
  }
}

function isPlayerSkin(v: unknown): v is PlayerSkin {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o['bodyShape'] !== 'male' && o['bodyShape'] !== 'female') return false;
  if (
    o['hairStyle'] !== 'short' &&
    o['hairStyle'] !== 'long' &&
    o['hairStyle'] !== 'curly' &&
    o['hairStyle'] !== 'bald'
  )
    return false;
  if (
    o['clothStyle'] !== 'robe' &&
    o['clothStyle'] !== 'tunic' &&
    o['clothStyle'] !== 'cape'
  )
    return false;
  if (
    o['weapon'] !== 'none' &&
    o['weapon'] !== 'staff' &&
    o['weapon'] !== 'wand'
  )
    return false;
  if (
    o['wardSigilStyle'] !== 'circle' &&
    o['wardSigilStyle'] !== 'triangle' &&
    o['wardSigilStyle'] !== 'rune'
  )
    return false;
  const p = o['palette'];
  if (typeof p !== 'object' || p === null) return false;
  const pp = p as Record<string, unknown>;
  if (typeof pp['skin'] !== 'string') return false;
  if (typeof pp['hair'] !== 'string') return false;
  if (typeof pp['eye'] !== 'string') return false;
  if (typeof pp['cloth'] !== 'string') return false;
  return true;
}
