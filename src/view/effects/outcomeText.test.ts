import { describe, expect, it } from 'vitest';
import {
  OUTCOME_TEXT_DURATION_MS,
  OUTCOME_TEXT_MIN_DURATION_MS,
  drawOutcomeText,
  effectiveOutcomeTextDuration,
  type OutcomeTextState,
} from './outcomeText';

type DrawCall = {
  label: string;
  cx: number;
  cy: number;
  fillStyle: string;
  strokeStyle: string;
  font: string;
};

function makeCtx(): {
  ctx: CanvasRenderingContext2D;
  fillCalls: DrawCall[];
  strokeCalls: DrawCall[];
} {
  const fillCalls: DrawCall[] = [];
  const strokeCalls: DrawCall[] = [];
  let fillStyle = '';
  let strokeStyle = '';
  let font = '';
  const snapshot = (label: string, cx: number, cy: number): DrawCall => ({
    label,
    cx,
    cy,
    fillStyle,
    strokeStyle,
    font,
  });
  const stub = {
    get globalAlpha() {
      return 1;
    },
    set globalAlpha(_v: number) {
      // discard
    },
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string) {
      fillStyle = v;
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(v: string) {
      strokeStyle = v;
    },
    get font() {
      return font;
    },
    set font(v: string) {
      font = v;
    },
    lineWidth: 1,
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    fillText: (label: string, cx: number, cy: number) => {
      fillCalls.push(snapshot(label, cx, cy));
    },
    strokeText: (label: string, cx: number, cy: number) => {
      strokeCalls.push(snapshot(label, cx, cy));
    },
  };
  return {
    ctx: stub as unknown as CanvasRenderingContext2D,
    fillCalls,
    strokeCalls,
  };
}

function state(overrides: Partial<OutcomeTextState> = {}): OutcomeTextState {
  return {
    kind: 'COUNTER',
    startTime: 0,
    cx: 100,
    cy: 50,
    ...overrides,
  };
}

describe('effectiveOutcomeTextDuration', () => {
  it('scales with speed', () => {
    expect(effectiveOutcomeTextDuration(1)).toBe(OUTCOME_TEXT_DURATION_MS);
    expect(effectiveOutcomeTextDuration(2)).toBe(OUTCOME_TEXT_DURATION_MS / 2);
  });

  it('clamps upward at the perceptibility floor so 10× still reads', () => {
    expect(effectiveOutcomeTextDuration(10)).toBe(OUTCOME_TEXT_MIN_DURATION_MS);
    // floor only kicks in past the floor — confirm
    expect(OUTCOME_TEXT_DURATION_MS / 10).toBeLessThan(OUTCOME_TEXT_MIN_DURATION_MS);
  });
});

describe('drawOutcomeText lifecycle', () => {
  it('returns true while alive', () => {
    const { ctx } = makeCtx();
    expect(drawOutcomeText(ctx, state(), 100, 1)).toBe(true);
  });

  it('returns false past effective duration', () => {
    const { ctx } = makeCtx();
    expect(drawOutcomeText(ctx, state(), OUTCOME_TEXT_DURATION_MS + 1, 1)).toBe(false);
  });

  it('respects the perceptibility floor at 10× — still alive at DURATION/10 + 50ms', () => {
    const { ctx } = makeCtx();
    // Without the floor, 60ms at 10× would already be past DURATION/10 (60ms).
    // With the floor, the effective duration is MIN_DURATION (250ms), so 100ms is alive.
    expect(drawOutcomeText(ctx, state(), 100, 10)).toBe(true);
  });

  it('handles future-spawn defensively', () => {
    const { ctx } = makeCtx();
    expect(drawOutcomeText(ctx, state({ startTime: 1000 }), 0, 1)).toBe(true);
  });
});

describe('drawOutcomeText label & style', () => {
  it('draws "COUNTER!" for COUNTER kind in the green outcome colour', () => {
    const { ctx, fillCalls } = makeCtx();
    drawOutcomeText(ctx, state({ kind: 'COUNTER' }), 100, 1);
    expect(fillCalls.length).toBe(1);
    expect(fillCalls[0]?.label).toBe('COUNTER!');
    expect(fillCalls[0]?.fillStyle.toLowerCase()).toBe('#3df089');
  });

  it('draws "DODGE!" for DODGE kind in the blue outcome colour', () => {
    const { ctx, fillCalls } = makeCtx();
    drawOutcomeText(ctx, state({ kind: 'DODGE' }), 100, 1);
    expect(fillCalls[0]?.label).toBe('DODGE!');
    expect(fillCalls[0]?.fillStyle.toLowerCase()).toBe('#3da8f0');
  });

  it('uses Press Start 2P font family', () => {
    const { ctx, fillCalls } = makeCtx();
    drawOutcomeText(ctx, state(), 100, 1);
    expect(fillCalls[0]?.font).toContain('Press Start 2P');
  });

  it('strokes for legibility before filling', () => {
    const { ctx, strokeCalls, fillCalls } = makeCtx();
    drawOutcomeText(ctx, state(), 100, 1);
    expect(strokeCalls.length).toBe(1);
    expect(fillCalls.length).toBe(1);
  });
});
