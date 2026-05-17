/**
 * App-level smoke / integration test.
 *
 * Mounts the composition root, waits for YAML to load, then walks the
 * happy-path: prep → encounter (with a correct Ward) → post-mortem with
 * Victory.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { loadEnemyYaml, loadPlayerYaml } from '../content/load';

// happy-dom's built-in localStorage is incomplete in our setup; polyfill a
// simple in-memory Storage for the duration of these tests.
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

// In production App fetches the JSON assets emitted by
// `vite-plugins/content.ts`. There's no dev server under Vitest, so we stub
// `fetch` to serve the same content from the source YAML — parsed and
// (for the enemy) `pattern`-stripped to match what the plugin emits.
const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

async function buildContentResponses(): Promise<{
  player: unknown;
  enemy: unknown;
}> {
  const playerYaml = readFileSync(
    path.join(PROJECT_ROOT, 'data/player.yaml'),
    'utf8',
  );
  const enemyYaml = readFileSync(
    path.join(PROJECT_ROOT, 'data/enemies/00-java-float.yaml'),
    'utf8',
  );
  const player = await loadPlayerYaml(playerYaml);
  const enemy = (await loadEnemyYaml(enemyYaml)) as Record<string, unknown>;
  // Match the plugin's projection (`vite-plugins/content.ts` → projectEnemy):
  // strip pattern, keep everything else.
  const { pattern: _pattern, ...enemyStripped } = enemy;
  return { player, enemy: enemyStripped };
}

function fetchUrlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function makeFetchStub(responses: { player: unknown; enemy: unknown }) {
  return vi.fn((input: RequestInfo | URL): Promise<Response> => {
    const url = fetchUrlOf(input);
    const body =
      url.endsWith('data/player.json')
        ? responses.player
        : url.endsWith('data/enemies/00-java-float.json')
          ? responses.enemy
          : null;
    if (body === null) {
      return Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve(null),
      } as unknown as Response);
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(body),
    } as unknown as Response);
  });
}

beforeEach(async () => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: makeMemoryStorage(),
  });
  const responses = await buildContentResponses();
  vi.stubGlobal('fetch', makeFetchStub(responses));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('boots, loads the Floating Phantasm enemy, and renders the PrepScreen', async () => {
    render(<App />);

    // After the async YAML load resolves, PrepScreen should be visible.
    await waitFor(
      () => {
        expect(screen.getByText(/Floating Phantasm/i)).toBeTruthy();
      },
      { timeout: 2000 },
    );

    // Before the first attempt against this Enemy, the seed spells render
    // under the Foresight/clairvoyance framing (PrepScreen.foresight = true).
    expect(screen.getByText(/Foresight/i)).toBeTruthy();
    expect(screen.getByText('1.0')).toBeTruthy();
    expect(screen.getByText('-2.5')).toBeTruthy();
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('persists the Run to localStorage after the seed-on-arrival step', async () => {
    render(<App />);
    await waitFor(
      () => {
        expect(screen.getByText(/Floating Phantasm/i)).toBeTruthy();
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
    expect(parsed.payload.observationLogs['java-float']).toBeDefined();
    expect(parsed.payload.observationLogs['java-float']!.length).toBeGreaterThan(0);
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
        expect(screen.queryByText(/Floating Phantasm/i)).toBeTruthy();
      },
      { timeout: 2000 },
    );

    // Floating Phantasm's exact Pattern (style-narrowed Java FP literal).
    // A perfect Ward — sweeps both phases.
    const wardInput = document.querySelector(
      '#ward-source',
    );
    expect(wardInput).toBeTruthy();
    fireEvent.change(wardInput!, {
      target: {
        value: '^([+-]?(0|[1-9]\\d*)\\.\\d*|\\.\\d+|[+-]?(0|[1-9]\\d*)(?=[eE]))([eE][+-]?\\d+)?$',
      },
    });

    // Find and click the Start encounter button.
    const startBtn = Array.from(
      document.querySelectorAll('button'),
    ).find((b) => /start encounter/i.test(b.textContent));
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
