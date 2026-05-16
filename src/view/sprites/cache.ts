/**
 * Sprite raster cache.
 *
 * Rasterises an AsciiSprite (whose pixels may contain `@slot` references)
 * into a logical-pixel-sized HTMLCanvasElement, resolving slots via the
 * supplied SlotResolver. The returned canvas instance is cached by composite
 * key so repeated calls return the same canvas — the EncounterCanvas can
 * `drawImage` from it every frame without thrash.
 *
 * The cache lives in logical pixels. DPR scaling is the caller's job at
 * draw time (per the brief).
 */

import type { AsciiSprite } from './decoder';

export type SlotResolver = (slot: string) => string;

/** A sub-cache keyed by paletteHash → canvas. Each sprite ID gets its own. */
const cachesById = new Map<string, Map<string, HTMLCanvasElement>>();

export function getRasterizedSprite(
  spriteId: string,
  sprite: AsciiSprite,
  resolveSlot: SlotResolver,
): HTMLCanvasElement {
  const paletteHash = hashSlots(sprite.paletteSlots, resolveSlot);
  let sub = cachesById.get(spriteId);
  if (sub === undefined) {
    sub = new Map();
    cachesById.set(spriteId, sub);
  }
  const cached = sub.get(paletteHash);
  if (cached !== undefined) return cached;
  const canvas = rasterize(sprite, resolveSlot);
  sub.set(paletteHash, canvas);
  return canvas;
}

/**
 * Compose multiple already-rasterised canvases (in order) onto a new
 * canvas of the given size. Result is cached by composite key.
 *
 * Used by the paper-doll composer to fuse body + hair + cloth + weapon
 * into one canvas per (pose, skin) so the encounter renderer draws one
 * canvas per figure instead of four.
 */
const composedCache = new Map<string, HTMLCanvasElement>();

export function getComposedCanvas(
  compositeKey: string,
  width: number,
  height: number,
  layers: readonly HTMLCanvasElement[],
): HTMLCanvasElement {
  const cached = composedCache.get(compositeKey);
  if (cached !== undefined) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('getComposedCanvas: 2D context unavailable');
  }
  ctx.imageSmoothingEnabled = false;
  for (const layer of layers) {
    ctx.drawImage(layer, 0, 0);
  }
  composedCache.set(compositeKey, canvas);
  return canvas;
}

/** Test-only: drop all cached canvases. */
export function __resetCacheForTests(): void {
  cachesById.clear();
  composedCache.clear();
}

function hashSlots(
  slots: ReadonlySet<string>,
  resolveSlot: SlotResolver,
): string {
  if (slots.size === 0) return '_';
  // Stable order.
  const sorted = Array.from(slots).sort();
  return sorted.map((s) => `${s}=${resolveSlot(s)}`).join('|');
}

function rasterize(
  sprite: AsciiSprite,
  resolveSlot: SlotResolver,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('rasterize: 2D context unavailable');
  }
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < sprite.height; y++) {
    const row = sprite.pixels[y]!;
    for (let x = 0; x < sprite.width; x++) {
      const cell = row[x]!;
      if (cell === 'transparent') continue;
      const color = cell.startsWith('@') ? resolveSlot(cell.slice(1)) : cell;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}
