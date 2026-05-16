import { describe, expect, it } from 'vitest';
import {
  DAMAGE_NUMBER_DURATION_MS,
  drawDamageNumber,
  pickDamageColor,
  type DamageNumber,
} from './damageNumbers';

/**
 * happy-dom does not implement a real 2D canvas; fall back to a minimal
 * stub that satisfies the operations `drawDamageNumber` actually performs.
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
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    strokeText: () => {},
    fillText: () => {},
    fillRect: () => {},
  };
  return stub as unknown as CanvasRenderingContext2D;
}

function num(spawnTime: number, side: 'player' | 'enemy' = 'player'): DamageNumber {
  return { id: 1, value: -3, x: 50, y: 50, side, spawnTime };
}

describe('pickDamageColor', () => {
  it('maps Counterattack damage to green', () => {
    expect(pickDamageColor('enemy', 'Counterattack')).toBe('green');
    expect(pickDamageColor('player', 'Counterattack')).toBe('green');
  });

  it('maps Hit damage to red', () => {
    expect(pickDamageColor('player', 'Hit')).toBe('red');
  });

  it('maps Backfire damage to amber (distinct from Hit red)', () => {
    expect(pickDamageColor('player', 'Backfire')).toBe('amber');
  });
});

describe('drawDamageNumber lifecycle', () => {
  it('renders while alive', () => {
    const ctx = makeCtx();
    const d = num(0);
    expect(drawDamageNumber(ctx, d, 100, 1, 'red')).toBe(true);
  });

  it('returns false once duration has elapsed at 1×', () => {
    const ctx = makeCtx();
    const d = num(0);
    const t = DAMAGE_NUMBER_DURATION_MS + 1;
    expect(drawDamageNumber(ctx, d, t, 1, 'red')).toBe(false);
  });

  it('duration scales with speed: at 10× it ages out 10× sooner', () => {
    const ctx = makeCtx();
    const d = num(0);
    // At 10×, effective duration = 60ms. Still alive at 30ms; dead at 70ms.
    expect(drawDamageNumber(ctx, d, 30, 10, 'red')).toBe(true);
    expect(drawDamageNumber(ctx, d, 70, 10, 'red')).toBe(false);
    // Same age (70ms) at 1× is still well within the 600ms lifetime.
    expect(drawDamageNumber(ctx, d, 70, 1, 'red')).toBe(true);
  });

  it('handles future spawn times defensively (no crash, still alive)', () => {
    const ctx = makeCtx();
    const d = num(1000);
    expect(drawDamageNumber(ctx, d, 0, 1, 'red')).toBe(true);
  });
});
