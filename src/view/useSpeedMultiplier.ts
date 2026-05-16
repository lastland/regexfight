/**
 * useSpeedMultiplier — view-context hook for the global Speed Multiplier.
 *
 * The Speed Multiplier scales the duration of every Animation Phase
 * uniformly (with documented exceptions for the glyph-by-glyph spell text
 * reveal and the HP-bar tween — see `CONTEXT.md` / ADR-0003). It is a
 * cosmetic preference: stored in `localStorage` under `regexfight:speed:v1`,
 * separate from the Run save.
 *
 * Exposed surface:
 *
 *   - `speed`        — the current multiplier.
 *   - `setSpeed(s)`  — jump to a specific multiplier.
 *   - `cycleSpeed()` — advance 1 → 2 → 5 → 10 → 1.
 *
 * The hook installs a single window keydown listener for the digit keys
 * 1 / 2 / 3 / 4 (by `code`, so layout-independent) that maps to
 * `SPEED_VALUES[0..3]`. The listener is suppressed while focus is in an
 * `<input>` or `<textarea>` to avoid stealing keystrokes from the Ward
 * Editor or any future text field.
 */

import { useCallback, useEffect, useState } from 'react';

export type SpeedMultiplier = 1 | 2 | 5 | 10;

export const SPEED_VALUES: readonly SpeedMultiplier[] = [1, 2, 5, 10] as const;
export const SPEED_STORAGE_KEY = 'regexfight:speed:v1';

function isSpeed(v: unknown): v is SpeedMultiplier {
  return v === 1 || v === 2 || v === 5 || v === 10;
}

function readInitial(): SpeedMultiplier {
  // SSR-safe: no window means no persisted preference.
  if (typeof window === 'undefined') return 1;
  try {
    const raw = window.localStorage.getItem(SPEED_STORAGE_KEY);
    if (raw === null) return 1;
    const parsed = JSON.parse(raw) as unknown;
    return isSpeed(parsed) ? parsed : 1;
  } catch {
    return 1;
  }
}

function write(speed: SpeedMultiplier): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SPEED_STORAGE_KEY, JSON.stringify(speed));
  } catch {
    // localStorage may be unavailable (private window, quota); ignore.
  }
}

const DIGIT_CODE_TO_INDEX: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
};

export function useSpeedMultiplier(): {
  speed: SpeedMultiplier;
  cycleSpeed: () => void;
  setSpeed: (s: SpeedMultiplier) => void;
} {
  const [speed, setSpeedState] = useState<SpeedMultiplier>(() => readInitial());

  const setSpeed = useCallback((s: SpeedMultiplier) => {
    setSpeedState(s);
    write(s);
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeedState((cur) => {
      const idx = SPEED_VALUES.indexOf(cur);
      const nextIdx = idx < 0 ? 0 : (idx + 1) % SPEED_VALUES.length;
      const next = SPEED_VALUES[nextIdx] ?? 1;
      write(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (ev: KeyboardEvent): void => {
      // Don't steal keystrokes while the player is typing into the Ward
      // Editor (or any future text input).
      const tag = (
        typeof document !== 'undefined' ? document.activeElement?.tagName : ''
      )?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // Modifier-key combos are reserved for the browser / shortcuts.
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const idx = DIGIT_CODE_TO_INDEX[ev.code];
      if (idx === undefined) return;
      const target = SPEED_VALUES[idx];
      if (target === undefined) return;
      ev.preventDefault();
      setSpeedState(target);
      write(target);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return { speed, cycleSpeed, setSpeed };
}
