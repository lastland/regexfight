import { describe, expect, it } from 'vitest';
import { FLASH_BY_OUTCOME, FLASH_DURATION_MS, drawFlash } from './flashOverlay';

/**
 * happy-dom does not implement a real 2D canvas; fall back to a minimal
 * stub that satisfies the operations `drawFlash` actually performs.
 * The lifecycle return value (true/false) is what these tests assert on —
 * the drawing side-effects are intentionally inert.
 */
function makeCtx(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 100;
  const real = canvas.getContext('2d');
  if (real) return real;
  const stub = {
    globalAlpha: 1,
    fillStyle: '',
    fillRect: () => {},
  };
  return stub as unknown as CanvasRenderingContext2D;
}

describe('FLASH_BY_OUTCOME', () => {
  it('maps each Outcome to its documented colour', () => {
    expect(FLASH_BY_OUTCOME.Counterattack).toBe('green');
    expect(FLASH_BY_OUTCOME.Hit).toBe('red');
    expect(FLASH_BY_OUTCOME.Backfire).toBe('amber');
    expect(FLASH_BY_OUTCOME.Dodge).toBe('blue');
  });
});

describe('drawFlash lifecycle', () => {
  const rect = { x: 10, y: 10, w: 50, h: 50 };

  it('returns true while alive at 1×', () => {
    const ctx = makeCtx();
    expect(drawFlash(ctx, 'red', rect, 0, 100, 1)).toBe(true);
  });

  it('returns false past duration at 1×', () => {
    const ctx = makeCtx();
    expect(drawFlash(ctx, 'red', rect, 0, FLASH_DURATION_MS + 1, 1)).toBe(false);
  });

  it('duration scales with speed: at 5× it ages out 5× sooner', () => {
    const ctx = makeCtx();
    // 5× → effective duration 50ms. Alive at 30ms; dead at 60ms.
    expect(drawFlash(ctx, 'green', rect, 0, 30, 5)).toBe(true);
    expect(drawFlash(ctx, 'green', rect, 0, 60, 5)).toBe(false);
  });

  it('handles future-spawn defensively (no crash, still alive)', () => {
    const ctx = makeCtx();
    expect(drawFlash(ctx, 'blue', rect, 1000, 0, 1)).toBe(true);
  });
});
