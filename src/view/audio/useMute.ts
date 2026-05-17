/**
 * useMute — view-context hook for the global audio Mute Toggle.
 *
 * Persists `{ muted: boolean }` to `localStorage` under `regexfight:audio:v1`,
 * separate from the Run save (cosmetic preference, not gameplay state).
 *
 * The hook keeps React state in sync with the audio module's runtime
 * master-gain mute, and installs a single keyboard shortcut: `M` toggles
 * mute (suppressed while focus is in an input/textarea so it doesn't
 * steal Ward-Editor keystrokes).
 */

import { useCallback, useEffect, useState } from 'react';
import { isMuted, setMuted } from './audioContext';

export const MUTE_STORAGE_KEY = 'regexfight:audio:v1';

type AudioPrefs = { muted: boolean };
const DEFAULT: AudioPrefs = { muted: false };

function readInitial(): boolean {
  if (typeof window === 'undefined') return DEFAULT.muted;
  try {
    const raw = window.localStorage.getItem(MUTE_STORAGE_KEY);
    if (raw === null) return DEFAULT.muted;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'muted' in parsed &&
      typeof parsed.muted === 'boolean'
    ) {
      return parsed.muted;
    }
    return DEFAULT.muted;
  } catch {
    return DEFAULT.muted;
  }
}

function write(prefs: AudioPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage may be unavailable (private window, quota); ignore.
  }
}

export function useMute(): { muted: boolean; toggleMute: () => void } {
  const [muted, setMutedState] = useState<boolean>(() => {
    const initial = readInitial();
    // Prime the audio module so even the first playback respects the
    // persisted preference.
    setMuted(initial);
    return initial;
  });

  // Belt-and-braces: if the audio module's runtime state somehow diverges
  // from ours (it shouldn't, but module singletons are easy to corrupt in
  // tests), keep React the source of truth.
  useEffect(() => {
    if (isMuted() !== muted) setMuted(muted);
  }, [muted]);

  const toggleMute = useCallback(() => {
    setMutedState((cur) => {
      const next = !cur;
      setMuted(next);
      write({ muted: next });
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (ev: KeyboardEvent): void => {
      const tag = (
        typeof document !== 'undefined' ? document.activeElement?.tagName : ''
      )?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.code !== 'KeyM') return;
      ev.preventDefault();
      toggleMute();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [toggleMute]);

  return { muted, toggleMute };
}
