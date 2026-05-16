/**
 * HpBarTween — React component that tweens an HP bar's width between
 * values, with a fixed duration that does NOT scale with the Speed
 * Multiplier (ADR-0004: "HP-bar tween duration does NOT scale with speed,
 * so the 'I see damage land' beat survives high multipliers").
 *
 * Designed as a drop-in replacement for the inline `HpBar` in
 * `EncounterScreen.tsx`; the wiring swap is owned by the animation /
 * pacing agent, not this module.
 *
 * The flash overlay (a brief white wash) fires whenever `flashKey`
 * *changes*. The intended caller increments it on Enemy Phase advance,
 * but any monotonically-changing value works.
 */

import { useEffect, useRef, useState, type JSX } from 'react';

export type HpBarTweenProps = {
  /** Current HP value. Tweened smoothly toward each new value. */
  current: number;
  /** Maximum HP. Used to compute the ratio and to render `current / max`. */
  max: number;
  /** Affects fill colour and fill direction. */
  side: 'player' | 'enemy';
  /**
   * Bump this to trigger a brief white flash over the bar.
   * Intended for Enemy Phase transitions (per ADR-0004 Phase-transition effect).
   * Optional — pass nothing if you never want a flash.
   */
  flashKey?: number;
};

/** Fixed at 250 ms — does NOT scale with speed. See ADR-0004. */
export const HP_BAR_TWEEN_MS = 250;

/** Duration of the white phase-transition flash. */
export const HP_BAR_FLASH_MS = 200;

export function HpBarTween(props: HpBarTweenProps): JSX.Element {
  const { current, max, side, flashKey } = props;
  const safeMax = Math.max(1, max);
  const clamped = Math.max(0, Math.min(current, safeMax));
  const ratio = clamped / safeMax;
  const pct = ratio * 100;

  // Flash bookkeeping — we render a keyed overlay whose CSS animation
  // re-runs every time the key changes.
  const [flashRunId, setFlashRunId] = useState(0);
  const prevFlashKey = useRef<number | undefined>(flashKey);
  useEffect(() => {
    if (flashKey !== prevFlashKey.current && flashKey !== undefined) {
      prevFlashKey.current = flashKey;
      setFlashRunId((n) => n + 1);
    }
  }, [flashKey]);

  const fillColor = side === 'player' ? 'bg-emerald-600' : 'bg-rose-600';
  const trackColor = 'bg-zinc-800';

  // `transform-origin` + a single horizontal scaleX gives a tween that's
  // direction-agnostic; we pick the origin by side so the bar drains
  // from the *inside* of the layout (player drains right-to-left from
  // the right edge inward; enemy drains left-to-right). For a tween
  // that's purely a CSS transition we use width %, however, because that
  // matches the ADR's wording ("transition: width 250ms ease-out").
  // Direction is encoded by `flex-row-reverse` on the enemy track.
  return (
    <div className="flex flex-col gap-1" data-testid={`hpbar-${side}`}>
      <div className="font-mono text-xs text-zinc-300 tabular-nums">
        {clamped} / {safeMax}
      </div>
      <div
        className={`relative h-3 w-full overflow-hidden rounded-sm ${trackColor} ${
          side === 'enemy' ? 'flex flex-row-reverse' : 'flex flex-row'
        }`}
      >
        <div
          data-testid={`hpbar-fill-${side}`}
          className={`h-full ${fillColor}`}
          style={{
            width: `${pct}%`,
            transition: `width ${HP_BAR_TWEEN_MS}ms ease-out`,
          }}
        />
        {/* Flash overlay — re-mounted by key to restart the CSS animation. */}
        {flashRunId > 0 && (
          <span
            key={flashRunId}
            data-testid={`hpbar-flash-${side}`}
            className="pointer-events-none absolute inset-0 bg-white"
            style={{
              animation: `regexfight-hpbar-flash ${HP_BAR_FLASH_MS}ms ease-out forwards`,
            }}
          />
        )}
      </div>
      {/*
        Keyframes inlined as a <style> tag so this component is fully
        self-contained — no Tailwind config edits, no global CSS edits.
        Using a unique name (`regexfight-hpbar-flash`) to avoid clobber.
      */}
      <style>{`
        @keyframes regexfight-hpbar-flash {
          0%   { opacity: 0.85; }
          100% { opacity: 0;    }
        }
      `}</style>
    </div>
  );
}
