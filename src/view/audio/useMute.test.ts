import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMute, MUTE_STORAGE_KEY } from './useMute';
import { __resetAudioContextForTests, isMuted } from './audioContext';

// happy-dom's built-in localStorage is incomplete in our setup; install a
// simple in-memory Storage matching the pattern from App.test.tsx.
function makeMemoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => { m.clear(); },
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    key: (i) => Array.from(m.keys())[i] ?? null,
  };
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: makeMemoryStorage(),
  });
  __resetAudioContextForTests();
});

afterEach(() => {
  __resetAudioContextForTests();
});

describe('useMute', () => {
  it('defaults to unmuted when no preference is stored', () => {
    const { result } = renderHook(() => useMute());
    expect(result.current.muted).toBe(false);
    expect(isMuted()).toBe(false);
  });

  it('reads a persisted muted preference', () => {
    window.localStorage.setItem(MUTE_STORAGE_KEY, JSON.stringify({ muted: true }));
    const { result } = renderHook(() => useMute());
    expect(result.current.muted).toBe(true);
    expect(isMuted()).toBe(true);
  });

  it('toggleMute writes the new value to localStorage', () => {
    const { result } = renderHook(() => useMute());
    act(() => {
      result.current.toggleMute();
    });
    expect(result.current.muted).toBe(true);
    expect(window.localStorage.getItem(MUTE_STORAGE_KEY)).toBe(
      JSON.stringify({ muted: true }),
    );
    act(() => {
      result.current.toggleMute();
    });
    expect(result.current.muted).toBe(false);
    expect(window.localStorage.getItem(MUTE_STORAGE_KEY)).toBe(
      JSON.stringify({ muted: false }),
    );
  });

  it('ignores malformed storage and falls back to default', () => {
    window.localStorage.setItem(MUTE_STORAGE_KEY, 'not json');
    const { result } = renderHook(() => useMute());
    expect(result.current.muted).toBe(false);
  });

  it('M key toggles mute when focus is not in an input', () => {
    const { result } = renderHook(() => useMute());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
    });
    expect(result.current.muted).toBe(true);
  });

  it('M key is ignored while focus is in an input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    const { result } = renderHook(() => useMute());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM' }));
    });
    expect(result.current.muted).toBe(false);
    document.body.removeChild(input);
  });
});
