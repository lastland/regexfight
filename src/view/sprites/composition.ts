/**
 * Sprite composition + cache-key construction.
 *
 * Exposes one function per public-API consumer:
 *   - composePlayerFigure(pose, skin) — paper-doll: body + hair + cloth + weapon
 *   - rasterizeEnemy(pose)            — single sprite, no composition
 *   - rasterizeWardSigil(state, style)
 *   - rasterizeSpellProjectile(kind)
 *
 * Cache keys include the bits that affect rendering:
 *   - For the player, the palette goes into the key so changing skin
 *     colour produces a different canvas (not a stale one).
 *   - For the enemy, the pose alone — no palette substitution.
 *   - For the Ward Sigil, the state+style (no palette).
 *   - For the projectile, the Kind (palette slot resolves to a Kind-tint).
 */

import type { AsciiSprite } from './decoder';
import {
  getComposedCanvas,
  getRasterizedSprite,
  type SlotResolver,
} from './cache';
import type {
  EnemyPose,
  PlayerPose,
  PlayerSkin,
  SpellKindForVisual,
  WardSigilState,
} from './api';
import { bodySprites } from './assets/player-body';
import { hairSprites } from './assets/player-hair';
import { clothSprites } from './assets/player-cloth';
import { weaponSprites } from './assets/player-weapon';
import { enemySprites } from './assets/enemy';
import { wardSigilSprites } from './assets/ward-sigil';
import {
  ORB_PALETTE_BY_KIND,
  projectileSprite,
} from './assets/spell-projectile';

export function composePlayerFigure(
  pose: PlayerPose,
  skin: PlayerSkin,
): HTMLCanvasElement {
  const body = bodySprites[skin.bodyShape][pose];
  const hair = hairSprites[skin.hairStyle][pose];
  const cloth = clothSprites[skin.clothStyle][pose];
  const weapon = weaponSprites[skin.weapon][pose];

  // All four layers share the same dimensions by author-contract. We trust
  // that and assert it here so a misauthored sprite fails loudly.
  const width = body.width;
  const height = body.height;
  assertSameSize('hair', hair, width, height);
  assertSameSize('cloth', cloth, width, height);
  assertSameSize('weapon', weapon, width, height);

  const resolvePlayerSlot = makePlayerSlotResolver(skin);

  // Per-layer raster caches — same layer + same palette → same canvas.
  const bodyId = `body:${skin.bodyShape}:${pose}`;
  const hairId = `hair:${skin.hairStyle}:${pose}`;
  const clothId = `cloth:${skin.clothStyle}:${pose}`;
  const weaponId = `weapon:${skin.weapon}:${pose}`;

  const bodyCanvas = getRasterizedSprite(bodyId, body, resolvePlayerSlot);
  const hairCanvas = getRasterizedSprite(hairId, hair, resolvePlayerSlot);
  const clothCanvas = getRasterizedSprite(clothId, cloth, resolvePlayerSlot);
  const weaponCanvas = getRasterizedSprite(
    weaponId,
    weapon,
    resolvePlayerSlot,
  );

  // The composed-canvas key MUST include the palette so a skin-colour change
  // doesn't hand back a stale canvas.
  const compositeKey = [
    'player',
    pose,
    skin.bodyShape,
    skin.hairStyle,
    skin.clothStyle,
    skin.weapon,
    paletteKey(skin),
  ].join('|');

  return getComposedCanvas(compositeKey, width, height, [
    bodyCanvas,
    hairCanvas,
    clothCanvas,
    weaponCanvas,
  ]);
}

export function rasterizeEnemy(pose: EnemyPose): HTMLCanvasElement {
  const sprite = enemySprites[pose];
  if (sprite === null) {
    // Defeated is null by design — the renderer is expected to apply
    // desaturation + alpha to the idle sprite (ADR-0006). We surface the
    // contract by returning the idle canvas here so a caller that hasn't
    // implemented the effect still draws *something*; documented as such.
    return getRasterizedSprite(
      `enemy:idle`,
      enemySprites.idle as AsciiSprite,
      passthroughResolver,
    );
  }
  return getRasterizedSprite(`enemy:${pose}`, sprite, passthroughResolver);
}

export function rasterizeWardSigil(
  state: WardSigilState,
  style: PlayerSkin['wardSigilStyle'],
): HTMLCanvasElement {
  const sprite = wardSigilSprites[style][state];
  return getRasterizedSprite(
    `ward:${style}:${state}`,
    sprite,
    passthroughResolver,
  );
}

export function rasterizeSpellProjectile(
  kind: SpellKindForVisual,
): HTMLCanvasElement {
  const tint = ORB_PALETTE_BY_KIND[kind];
  const resolver: SlotResolver = (slot) => {
    if (slot === 'orb') return tint.orb;
    if (slot === 'orbGlow') return tint.orbGlow;
    throw new Error(`projectile: unknown palette slot '${slot}'`);
  };
  return getRasterizedSprite(`projectile:${kind}`, projectileSprite, resolver);
}

function makePlayerSlotResolver(skin: PlayerSkin): SlotResolver {
  return (slot: string): string => {
    switch (slot) {
      case 'skin':
        return skin.palette.skin;
      case 'hair':
        return skin.palette.hair;
      case 'eye':
        return skin.palette.eye;
      case 'cloth':
        return skin.palette.cloth;
      default:
        throw new Error(`player composition: unknown palette slot '${slot}'`);
    }
  };
}

function passthroughResolver(slot: string): string {
  // Used for sprites with no @slot references. If a sprite *does* reference
  // a slot and ends up here, that's an authoring bug — fail loudly.
  throw new Error(
    `unexpected @slot '${slot}' in sprite with no slot resolver`,
  );
}

function paletteKey(skin: PlayerSkin): string {
  return `${skin.palette.skin}/${skin.palette.hair}/${skin.palette.eye}/${skin.palette.cloth}`;
}

function assertSameSize(
  layer: string,
  sprite: AsciiSprite,
  width: number,
  height: number,
): void {
  if (sprite.width !== width || sprite.height !== height) {
    throw new Error(
      `composition: ${layer} sprite is ${sprite.width}x${sprite.height}, expected ${width}x${height}`,
    );
  }
}
