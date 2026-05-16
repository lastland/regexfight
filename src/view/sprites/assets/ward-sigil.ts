/**
 * Ward Sigil sprites.
 *
 * v1.1 ships only `wardSigilStyle: 'circle'`. Two states: idle (dim) and
 * active (bright). No palette slots — per ADR-0006, "magic has its own
 * colour." Colours are literal.
 *
 * Sprite size: 12 × 12 logical pixels.
 *
 * Pixel legend:
 *   .  transparent
 *   K  outline / rune-mark   #000000
 *   d  dim glow              #5a7aa8  (cool, low-energy)
 *   l  light dim             #8aa0d0
 *   b  bright (active)       #c0d8ff
 *   w  white-hot core        #ffffff
 *
 * Other styles in the type union (`triangle`, `rune`) are not yet authored.
 */

import type { AsciiSprite } from '../decoder';
import { decodePixelArt } from '../decoder';
import type { PlayerSkin, WardSigilState } from '../api';

const SIGIL_PALETTE = {
  '.': 'transparent',
  K: '#000000',
  d: '#5a7aa8',
  l: '#8aa0d0',
  b: '#c0d8ff',
  w: '#ffffff',
} as const;

// Idle: thin circle ring with a dim glow. Faint cross-hair tick marks for
// "this is a magical circle, not just a circle".
const CIRCLE_IDLE = decodePixelArt(
  `
....KKKK....
..KKddddKK..
..KdddddddK.
.Kdd....ddK.
.Kd......dK.
KdK......KdK
KdK......KdK
.Kd......dK.
.Kdd....ddK.
..KdddddddK.
..KKddddKK..
....KKKK....
`,
  SIGIL_PALETTE,
);

// Active: brighter ring, glowing fill, white-hot core, larger tick marks.
const CIRCLE_ACTIVE = decodePixelArt(
  `
....KKKK....
..KKbbbbKK..
..KblllllbK.
.Kbll..llbK.
.Kbl.ww.lbK.
KblK.ww.KlbK
KblK....KlbK
.Kbll..llbK.
.Kbll..llbK.
..KbllllllK.
..KKbbbbKK..
....KKKK....
`,
  SIGIL_PALETTE,
);

export const wardSigilSprites: Record<
  PlayerSkin['wardSigilStyle'],
  Record<WardSigilState, AsciiSprite>
> = {
  circle: {
    idle: CIRCLE_IDLE,
    active: CIRCLE_ACTIVE,
  },
  triangle: makeUnauthored('triangle'),
  rune: makeUnauthored('rune'),
};

function makeUnauthored(
  style: PlayerSkin['wardSigilStyle'],
): Record<WardSigilState, AsciiSprite> {
  return new Proxy({} as Record<WardSigilState, AsciiSprite>, {
    get(_target, state: string): AsciiSprite {
      throw new Error(
        `ward-sigil: wardSigilStyle '${style}' is not yet authored (requested state '${state}').`,
      );
    },
  });
}
