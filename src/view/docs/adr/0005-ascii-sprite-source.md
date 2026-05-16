# ADR-0004 (view): ASCII-encoded sprites in source, PNG ingestion reserved

**Date**: 2026-05-16
**Status**: Accepted

## Context

The v1.1 polish brief introduces figures for the Player and the Enemy, a Ward Sigil, and a Spell Projectile, all in retro pixel style. They need to be *somewhere* on disk — but the project has no asset pipeline, no art assets, and no artist on retainer for this milestone.

Common options for retro pixel sprite source in a small web game:

- **PNG files** imported via Vite's asset handling. Standard.
- **Aseprite / spritesheet** with a custom metadata schema. Stronger animation tooling.
- **Procedural pixel sprites in source code**, rendered to off-screen canvases at init.
- **SVG**, with `image-rendering: pixelated`. Loses the pixel-grid crispness in practice.
- **Per-pixel `fillRect`** every frame, no caching.

The decision shapes:

- Authoring ergonomics for the *first* round of sprites.
- The extension path for the eventual user-supplied customization (PNG upload, custom palettes).
- The cross-context boundary: where does sprite *data* live, and who owns the renderer?

## Decision

Use **ASCII-encoded pixel arrays in source code** as the v1.1 sprite source. Each sprite is a multi-line string template plus a character-to-CSS-colour palette mapping:

```ts
const PLAYER_IDLE = decodePixelArt(`
  ..####..
  .#....#.
  .#.##.#.
  .#....#.
  ..####..
  ...##...
  ..####..
  .#.##.#.
`, {
  '.': 'transparent',
  '#': '@skin',     // palette slot — resolved at composition time
});
```

The decoder produces a `{ width, height, pixels: Color[][], paletteSlots: Set<string> }` shape. At init time the renderer paints each decoded sprite (with its current resolved palette) to a small off-screen Canvas, then `drawImage`s from those caches during the encounter.

### Palette slots and `@slot` syntax

Palette entries beginning with `@` are *slot references*, resolved at composition time from the active `PlayerSkin.palette` (for the player) or a shared default palette (for shared sprites). Literal CSS colours like `#7cf07c` are baked in.

This lets the *body sprite* declare which pixels are skin (`@skin`), hair-line accents (`@hair`), eye dots (`@eye`), cloth (`@cloth`), and outline (a fixed `#000000`). At render time the sprite cache is regenerated when any slot's colour changes; for the default palette this happens once at startup.

### Rendering pipeline

1. **Decode** all ASCII sprites at module import. Cheap; runs once.
2. **Compose** Player Figure for the active `PlayerSkin` by walking layers (body → hair → cloth → weapon), substituting palette slots, and rasterising the union to an off-screen Canvas per (pose, skin-version). Cache keyed by `(pose, skinPaletteHash)`.
3. **Render** each frame by `drawImage`ing the appropriate pose Canvas at the figure's screen position, with `imageSmoothingEnabled = false`.
4. **Invalidate** the cache when `PlayerSkin` changes (only when there's customization UI, which is post-v1.1).

### Reserved extension: PNG ingestion

The internal representation is `{ width, height, pixels: Color[][] }`. PNG support is one parser away — read a `File` or `Blob`, `createImageBitmap`, `getImageData`, build the pixels array. PNG-sourced sprites can have either literal colours (no slot semantics) or — for advanced customization — slot-tagged pixels via an accompanying metadata file.

v1.1 does not implement PNG ingestion. The architectural slot is named in code and noted here.

### Scope

The following sprites are authored in source for v1.1:

- Player body (1 shape × 3 poses) = 3.
- Player hair (1 style × 3 poses) = 3.
- Player cloth (1 style × 3 poses) = 3.
- Player weapon (1 style × 3 poses) = 3 — for `weapon: 'none'`, all three are empty sprites of the correct size.
- Ward Sigil (1 style × 2 states) = 2.
- Enemy (4 poses) = 4.
- Spell Projectile = 1.

**Total: ~19 sprites.** Each ~16–24 px square. Authorable in a focused session.

## Consequences

**Positive:**

- **Zero asset pipeline for v1.1.** No `public/sprites/`, no async image loading, no missing-file failure modes, no licensing entanglement. Sprites ship as version-controlled TypeScript data.
- **Diff-readable changes.** A sprite edit shows up in the diff as character changes; a reviewer can mentally read the pose change.
- **Type-checked.** Palette slot names are typed; misspelling `@skn` instead of `@skin` is a compile error.
- **Cheap to extend.** A second body shape is one new ASCII block; a second hairstyle is three more.
- **Cleanly compatible with later PNG support.** The renderer reads `{ width, height, pixels }` regardless of source.

**Negative:**

- **Authoring ergonomics for large sprites are poor.** ASCII becomes unreadable past ~32 × 32. We're staying inside that limit for v1.1; if we want larger sprites later, the PNG path lands.
- **Palette-slot system is custom.** New collaborators must learn the `@slot` convention. Documented in `CONTEXT.md` and inline.
- **Per-pose layer authoring grows.** With "all layers animate per pose" (locked separately), we get 3 sprites per layer per style. With one variant per layer at v1.1, that's 9 player sprites; that scales linearly when adding variants.

## Alternatives considered

### A. PNG files in `public/` or `src/view/assets/`
Standard, well-understood.

**Why not for v1.1:** Requires producing PNG content *now*. Either we draw it (real artist time) or we generate placeholders (more complex than just writing ASCII). The PNG path is the right place to *end up*, but starting with ASCII gets us functional sprites this milestone.

### B. Spritesheet + Aseprite metadata
The "professional" path for retro pixel games.

**Why not:** Overkill for 19 small sprites. Tooling overhead doesn't pay off until we have dozens of sprites or animations with many frames.

### C. SVG sprites
Vector, scalable, no aliasing concerns.

**Why not:** SVG loses the pixel-grid crispness that defines "retro pixel." `image-rendering: pixelated` doesn't apply to SVG element rendering, and SVG-from-Image-to-canvas adds steps without the right end result.

### D. Per-pixel `fillRect` every frame, no caching
Maximally simple in the render loop.

**Why not:** ~19 sprites × ~16 × 16 pixels × 60 fps × multiple draw calls per sprite = real CPU work. Caching to off-screen Canvases is the obvious right answer and is what every retro 2D web game does.

### E. Web Components or React for sprite rendering
Use the DOM to render each pixel as a `<div>`.

**Why not:** Performance is bad; the DOM isn't the right abstraction for animated pixel art. The encounter scene's whole reason to be a Canvas is to dodge this.

## See also

- `src/view/CONTEXT.md` — ASCII Sprite, Palette Slot, Player Figure, Enemy Figure, Ward Sigil, Spell Projectile glossary entries.
- `src/view/docs/adr/0006-paper-doll-customization.md` — the composition system that consumes the sprite cache.
- `src/view/docs/adr/0004-five-phase-spell-animation.md` — the animation pipeline that uses the rendered sprites.
