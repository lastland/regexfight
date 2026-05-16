/**
 * Spell Projectile sprite.
 *
 * A single glowing-orb shape, palette-tinted by Kind. The Kind colour is
 * applied via the `@orb` palette slot, resolved at composition time to
 * the canonical green-for-Real / red-for-Decoy colours (see colors.ts in
 * the parent view module — these are the same tokens used everywhere).
 *
 * Sprite size: 12 × 12 logical pixels.
 *
 * Pixel legend:
 *   .  transparent
 *   K  outline               #000000
 *   o  orb base              @orb        (tinted by Kind)
 *   c  orb core              #ffffff     (constant white-hot center)
 *   g  orb glow halo         @orbGlow    (lighter Kind tint)
 */

import type { AsciiSprite } from '../decoder';
import { decodePixelArt } from '../decoder';
import type { SpellKindForVisual } from '../api';

const PROJECTILE_PALETTE = {
  '.': 'transparent',
  K: '#000000',
  o: '@orb',
  c: '#ffffff',
  g: '@orbGlow',
} as const;

// A round orb with a bright core and a faint halo ring. Symmetric L/R + T/B.
const ORB = decodePixelArt(
  `
....KKKK....
..KKgooKKK..
.KgooooooKK.
.KooocccoooK
KooccccccoK.
KoocccccccoK
KooccccccooK
.KoocccoooKK
.KoooooooKK.
..KKooooKK..
....KKKK....
............
`,
  PROJECTILE_PALETTE,
);

/**
 * Single sprite used for both Kinds — the difference is the palette slot
 * resolution at raster time, which the cache keys on (so we get two
 * distinct canvases per Kind, as desired).
 */
export const projectileSprite: AsciiSprite = ORB;

/** Canonical orb tints per Kind. Matches the project's Kind colour tokens. */
export const ORB_PALETTE_BY_KIND: Record<
  SpellKindForVisual,
  { orb: string; orbGlow: string }
> = {
  Real: { orb: '#7cf07c', orbGlow: '#bcffbc' },
  Decoy: { orb: '#f07c7c', orbGlow: '#ffbcbc' },
};
