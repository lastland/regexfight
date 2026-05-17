import { describe, expect, it } from 'vitest';
import {
  FADE_OUT_SEC,
  computeReleaseScale,
  makeReleaseEnvelope,
} from './envelope';

describe('computeReleaseScale', () => {
  it('returns 1.0 at 1× (full natural sample)', () => {
    expect(computeReleaseScale(1)).toBe(1);
  });

  it('shrinks with speed (2× < 1×, 5× < 2×, 10× < 5×)', () => {
    const s1 = computeReleaseScale(1);
    const s2 = computeReleaseScale(2);
    const s5 = computeReleaseScale(5);
    const s10 = computeReleaseScale(10);
    expect(s2).toBeLessThan(s1);
    expect(s5).toBeLessThan(s2);
    expect(s10).toBeLessThanOrEqual(s5);
  });

  it('clamps to a minimum floor so impact still registers at 10×', () => {
    expect(computeReleaseScale(10)).toBeGreaterThanOrEqual(0.1);
  });
});

describe('makeReleaseEnvelope', () => {
  it('schedules a sustain at 1.0 then a linear fade to 0', () => {
    // Stub a minimal BaseAudioContext for the gain-node scheduling calls.
    const scheduled: Array<{ kind: string; value: number; time: number }> = [];
    const gainNode = {
      gain: {
        setValueAtTime: (value: number, time: number) => {
          scheduled.push({ kind: 'set', value, time });
        },
        linearRampToValueAtTime: (value: number, time: number) => {
          scheduled.push({ kind: 'ramp', value, time });
        },
      },
    };
    const ctx = {
      createGain: () => gainNode,
    } as unknown as BaseAudioContext;

    const when = 5.0;
    const dur = 0.4;
    const scale = 0.5;
    const { stopAt } = makeReleaseEnvelope(ctx, when, dur, scale);

    // Two `set` calls (sustain at 1.0 at `when` and at `when + dur*scale`)
    // followed by a `ramp` to 0 at the fade end.
    expect(scheduled.length).toBe(3);
    expect(scheduled[0]).toEqual({ kind: 'set', value: 1, time: when });
    expect(scheduled[1]).toEqual({
      kind: 'set',
      value: 1,
      time: when + dur * scale,
    });
    expect(scheduled[2]).toEqual({
      kind: 'ramp',
      value: 0,
      time: when + dur * scale + FADE_OUT_SEC,
    });
    expect(stopAt).toBe(when + dur * scale + FADE_OUT_SEC);
  });
});
