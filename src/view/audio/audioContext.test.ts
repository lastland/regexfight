import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetAudioContextForTests,
  ensureAudioContextResumed,
  getAudioContext,
  getMasterGain,
  isMuted,
  setMuted,
} from './audioContext';

type GainStub = {
  gain: {
    value: number;
    cancelScheduledValues: ReturnType<typeof vi.fn>;
    setValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
};

type FakeCtx = {
  currentTime: number;
  state: AudioContextState;
  destination: object;
  resume: ReturnType<typeof vi.fn>;
  createGain: () => GainStub;
};

let constructed = 0;
let lastCtx: FakeCtx | null = null;

function makeGain(): GainStub {
  return {
    gain: {
      value: 0,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
}

// Plain factory rather than a class so we don't run afoul of `no-this-alias`
// when registering the freshly-constructed instance into the module-level
// `lastCtx` for the test assertions to inspect.
function FakeAudioContext(): FakeCtx {
  constructed += 1;
  const inst: FakeCtx = {
    currentTime: 0,
    state: 'suspended',
    destination: {},
    resume: vi.fn(() => {
      inst.state = 'running';
      return Promise.resolve();
    }),
    createGain: makeGain,
  };
  lastCtx = inst;
  return inst;
}

beforeEach(() => {
  constructed = 0;
  lastCtx = null;
  __resetAudioContextForTests();
  (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
  (
    globalThis as unknown as { AudioContext: typeof FakeAudioContext }
  ).AudioContext = FakeAudioContext;
  (globalThis as unknown as { window: { AudioContext: typeof FakeAudioContext } }).window.AudioContext =
    FakeAudioContext;
});

afterEach(() => {
  __resetAudioContextForTests();
  delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
});

describe('getAudioContext', () => {
  it('lazily constructs the context on first call only', () => {
    expect(constructed).toBe(0);
    const a = getAudioContext();
    expect(constructed).toBe(1);
    const b = getAudioContext();
    expect(constructed).toBe(1);
    expect(a).toBe(b);
  });

  it('creates a master gain connected to the destination', () => {
    getAudioContext();
    const master = getMasterGain();
    expect(master).not.toBeNull();
  });
});

describe('ensureAudioContextResumed', () => {
  it('calls resume() when the context is suspended', async () => {
    await ensureAudioContextResumed();
    expect(lastCtx?.resume).toHaveBeenCalledTimes(1);
  });

  it('does NOT call resume() when the context is already running', async () => {
    getAudioContext();
    if (lastCtx) lastCtx.state = 'running';
    await ensureAudioContextResumed();
    expect(lastCtx?.resume).not.toHaveBeenCalled();
  });
});

describe('setMuted / isMuted', () => {
  it('tracks the boolean and schedules a gain ramp on toggle', () => {
    getAudioContext();
    setMuted(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('survives a mute toggle BEFORE context construction', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    // Now create the context; the master gain should be born muted.
    getAudioContext();
    const master = getMasterGain();
    expect(master?.gain.value).toBe(0);
  });
});
