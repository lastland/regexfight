/**
 * decodePixelArt — parses an ASCII pixel-art template into an AsciiSprite.
 *
 * Template format: a multi-line string where each row is one pixel row. Leading
 * and trailing whitespace on each row is trimmed (so the template can be
 * indented for readability); internal spaces are significant pixels. Empty
 * lines (after trim) at the top and bottom are skipped; empty lines *between*
 * rows are an error — the sprite must be a rectangle.
 *
 * Palette: a `Record<char, color>`. A color is either:
 *   - the literal string `'transparent'` (skipped at raster time),
 *   - a `@slot` reference (e.g. `'@skin'`), resolved at composition time from
 *     the active PlayerSkin's palette,
 *   - any other CSS color string (e.g. `'#000000'`, `'#7cf07c'`), baked in.
 *
 * The returned AsciiSprite holds the *unresolved* pixel grid — slot strings
 * (`@skin` etc.) live in the cells. The cache resolves them when it
 * rasterises to a canvas.
 *
 * See `src/view/docs/adr/0005-ascii-sprite-source.md`.
 */

export type AsciiPalette = Readonly<Record<string, string>>;

export type AsciiSprite = {
  readonly width: number;
  readonly height: number;
  /**
   * pixels[y][x] is the *resolved-or-slot* color string for that pixel.
   * Possible values:
   *   - 'transparent' — leave the pixel alone at raster time.
   *   - '@<slot>' — slot reference (e.g. '@skin'), resolved by the cache.
   *   - any other string — a literal CSS color.
   */
  readonly pixels: ReadonlyArray<ReadonlyArray<string>>;
  /** All `@slot` names referenced by this sprite. */
  readonly paletteSlots: ReadonlySet<string>;
};

export function decodePixelArt(
  template: string,
  palette: AsciiPalette,
): AsciiSprite {
  // Split, trim each line, drop leading/trailing all-empty lines.
  const rawLines = template.split('\n').map((l) => l.trim());
  let start = 0;
  let end = rawLines.length;
  while (start < end && rawLines[start] === '') start++;
  while (end > start && rawLines[end - 1] === '') end--;
  const lines = rawLines.slice(start, end);

  if (lines.length === 0) {
    throw new Error('decodePixelArt: empty template');
  }

  const height = lines.length;
  const width = lines[0]!.length;

  if (width === 0) {
    throw new Error('decodePixelArt: zero-width row');
  }

  const pixels: string[][] = [];
  const paletteSlots = new Set<string>();

  for (let y = 0; y < height; y++) {
    const row = lines[y]!;
    if (row.length !== width) {
      throw new Error(
        `decodePixelArt: row ${y} has width ${row.length}, expected ${width} (sprite must be rectangular)`,
      );
    }
    const rowPixels: string[] = [];
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      const color = palette[ch];
      if (color === undefined) {
        throw new Error(
          `decodePixelArt: row ${y}, col ${x}: character '${ch}' has no palette entry`,
        );
      }
      if (color.startsWith('@')) {
        paletteSlots.add(color.slice(1));
      }
      rowPixels.push(color);
    }
    pixels.push(rowPixels);
  }

  return {
    width,
    height,
    pixels: pixels.map((row) => Object.freeze(row.slice())),
    paletteSlots,
  };
}
