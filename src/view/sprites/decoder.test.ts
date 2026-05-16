// @vitest-environment jsdom
/**
 * decodePixelArt tests. These run in jsdom because some other tests in the
 * sprite module require document.createElement for canvases; happy-dom's
 * canvas stubs are flimsier here, so we standardise on jsdom across the
 * sprite test suite.
 */

import { describe, expect, it } from 'vitest';
import { decodePixelArt } from './decoder';

describe('decodePixelArt', () => {
  it('throws on a fully empty template', () => {
    expect(() => decodePixelArt('', { '.': 'transparent' })).toThrow(
      /empty template/,
    );
  });

  it('throws on whitespace-only template', () => {
    expect(() =>
      decodePixelArt('   \n\n   \n', { '.': 'transparent' }),
    ).toThrow(/empty template/);
  });

  it('parses a single-row template', () => {
    const sprite = decodePixelArt('##.##', {
      '.': 'transparent',
      '#': '#ff0000',
    });
    expect(sprite.width).toBe(5);
    expect(sprite.height).toBe(1);
    expect(sprite.pixels).toEqual([
      ['#ff0000', '#ff0000', 'transparent', '#ff0000', '#ff0000'],
    ]);
    expect(sprite.paletteSlots.size).toBe(0);
  });

  it('preserves @slot palette entries as slot references in pixels', () => {
    const sprite = decodePixelArt('s.s', {
      '.': 'transparent',
      s: '@skin',
    });
    expect(sprite.pixels[0]).toEqual(['@skin', 'transparent', '@skin']);
    expect(sprite.paletteSlots.has('skin')).toBe(true);
  });

  it('mixes literal colours and slot references in one sprite', () => {
    const sprite = decodePixelArt(
      `
      Ksh
      hsK
      `,
      {
        K: '#000000',
        s: '@skin',
        h: '@hair',
      },
    );
    expect(sprite.width).toBe(3);
    expect(sprite.height).toBe(2);
    expect(sprite.pixels[0]).toEqual(['#000000', '@skin', '@hair']);
    expect(sprite.pixels[1]).toEqual(['@hair', '@skin', '#000000']);
    expect(sprite.paletteSlots).toEqual(new Set(['skin', 'hair']));
  });

  it('trims edge whitespace per row but keeps internal spaces significant', () => {
    // Internal space here is a real pixel — mapped via the palette.
    const sprite = decodePixelArt(
      `
        # #
        ###
      `,
      {
        ' ': 'transparent',
        '#': '#abcdef',
      },
    );
    expect(sprite.width).toBe(3);
    expect(sprite.height).toBe(2);
    expect(sprite.pixels[0]).toEqual(['#abcdef', 'transparent', '#abcdef']);
    expect(sprite.pixels[1]).toEqual(['#abcdef', '#abcdef', '#abcdef']);
  });

  it('throws when rows are not all the same width (rectangular check)', () => {
    expect(() =>
      decodePixelArt(
        `
        ###
        ##
        ###
        `,
        { '#': '#000' },
      ),
    ).toThrow(/rectangular/);
  });

  it('throws when a character has no palette entry', () => {
    expect(() =>
      decodePixelArt('XY', { X: '#000' }),
    ).toThrow(/no palette entry/);
  });
});
