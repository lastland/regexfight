/**
 * App-level smoke / integration test.
 *
 * Mounts the composition root, waits for YAML to load, then walks the
 * happy-path: prep → encounter (with a correct Ward) → post-mortem with
 * Victory.
 */

import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

// happy-dom's built-in localStorage is incomplete in our setup; polyfill a
// simple in-memory Storage for the duration of these tests.
function makeMemoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
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
});

afterEach(() => {
  vi.useRealTimers();
});

describe('App', () => {
  it('boots, loads the tutorial enemy, and renders the PrepScreen', async () => {
    render(<App />);

    // After the async YAML load resolves, PrepScreen should be visible.
    await waitFor(
      () => {
        expect(screen.getByText(/The First Lexer/i)).toBeTruthy();
      },
      { timeout: 2000 },
    );

    // Before the first attempt against this Enemy, the seed spells render
    // under the Foresight/clairvoyance framing (PrepScreen.foresight = true).
    expect(screen.getByText(/Foresight/i)).toBeTruthy();
    expect(screen.getByText('cat12')).toBeTruthy();
    expect(screen.getByText('dog99')).toBeTruthy();
    expect(screen.getByText('12cat')).toBeTruthy();
  });

  it('persists the Run to localStorage after the seed-on-arrival step', async () => {
    render(<App />);
    await waitFor(
      () => {
        expect(screen.getByText(/The First Lexer/i)).toBeTruthy();
      },
      { timeout: 2000 },
    );
    const raw = window.localStorage.getItem('regexfight:save:v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as {
      schemaVersion: number;
      payload: { observationLogs: Record<string, unknown[]> };
    };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.payload.observationLogs['tutorial']).toBeDefined();
    expect(parsed.payload.observationLogs['tutorial']!.length).toBeGreaterThan(0);
  });

  it('runs a full encounter through to post-mortem on a correct Ward', async () => {
    // Under event-driven pacing (see view/docs/adr/0003), the sim only
    // advances when the canvas requests the next event. We pass the
    // test-only `autoTick` prop so the canvas fires `onRequestNextEvent`
    // on every animation frame, driving the encounter to completion
    // without waiting on the per-spell animation state machine. End-pause
    // (1200 ms) is still real wall-time, so we wait up to 5 s.
    render(<App autoTick={true} />);

    // Wait for PrepScreen.
    await waitFor(
      () => {
        expect(screen.queryByText(/The First Lexer/i)).toBeTruthy();
      },
      { timeout: 2000 },
    );

    // The tutorial pattern is /^[a-z]+\d{2,3}$/. A correct Ward.
    const wardInput = document.querySelector(
      '#ward-source',
    ) as HTMLInputElement | null;
    expect(wardInput).toBeTruthy();
    fireEvent.change(wardInput!, { target: { value: '^[a-z]+\\d{2,3}$' } });

    // Find and click the Start encounter button.
    const startBtn = Array.from(
      document.querySelectorAll('button'),
    ).find((b) => /start encounter/i.test(b.textContent ?? ''));
    expect(startBtn).toBeTruthy();
    act(() => {
      startBtn!.click();
    });

    await waitFor(
      () => {
        expect(screen.queryByText(/Victory/i)).toBeTruthy();
      },
      { timeout: 5000, interval: 50 },
    );
  }, 10000);
});
