import { describe, expect, it } from 'vitest';
import { SHAKE_DURATION_MS, SHAKE_MAGNITUDE_PX, getShakeOffset } from './screenShake';

describe('getShakeOffset', () => {
  it('returns null when startTime is null (no shake active)', () => {
    expect(getShakeOffset(null, 0, 1)).toBeNull();
    expect(getShakeOffset(null, 9999, 10)).toBeNull();
  });

  it('returns null after the duration has elapsed at 1×', () => {
    expect(getShakeOffset(0, SHAKE_DURATION_MS + 1, 1)).toBeNull();
  });

  it('returns an offset within magnitude bound while alive', () => {
    // Sample multiple times across the lifetime to catch any sin spike.
    for (let now = 0; now < SHAKE_DURATION_MS; now += 5) {
      const off = getShakeOffset(0, now, 1);
      expect(off).not.toBeNull();
      if (off) {
        expect(Math.abs(off.offsetX)).toBeLessThanOrEqual(SHAKE_MAGNITUDE_PX + 1e-9);
        expect(Math.abs(off.offsetY)).toBeLessThanOrEqual(SHAKE_MAGNITUDE_PX + 1e-9);
      }
    }
  });

  it('magnitude decays toward 0 over the lifetime', () => {
    // At the very end (just before duration) the bound is ~0.
    const off = getShakeOffset(0, SHAKE_DURATION_MS - 0.001, 1);
    expect(off).not.toBeNull();
    if (off) {
      expect(Math.abs(off.offsetX)).toBeLessThan(0.01);
      expect(Math.abs(off.offsetY)).toBeLessThan(0.01);
    }
  });

  it('duration scales with speed: at 10× it ages out 10× sooner', () => {
    // 10× → effective duration 15ms. Alive at 10ms; dead at 20ms.
    expect(getShakeOffset(0, 10, 10)).not.toBeNull();
    expect(getShakeOffset(0, 20, 10)).toBeNull();
  });

  it('treats negative age (future startTime) as alive with zero offset', () => {
    const off = getShakeOffset(1000, 0, 1);
    expect(off).not.toBeNull();
    if (off) {
      expect(off.offsetX).toBe(0);
      expect(off.offsetY).toBe(0);
    }
  });
});
