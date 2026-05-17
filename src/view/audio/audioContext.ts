/**
 * AudioContext lifecycle and master gain.
 *
 * Web Audio policy: a page must receive a user gesture before its
 * `AudioContext` may transition out of the `'suspended'` state. We
 * therefore construct the context **lazily** — on the first call to
 * `ensureAudioContextResumed()`, which is wired to the Start-encounter
 * click in `App.tsx`. Subsequent calls are no-ops.
 *
 * In environments without Web Audio (happy-dom tests, SSR), every
 * accessor returns `null` and the trigger functions silently no-op.
 * Production code never sees null.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Returns the singleton AudioContext, creating it on first call. Returns
 * null if Web Audio is unsupported in this environment.
 */
export function getAudioContext(): AudioContext | null {
  if (ctx !== null) return ctx;
  const Ctor = audioContextCtor();
  if (Ctor === null) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  return ctx;
}

/** Master gain node. Null when Web Audio is unsupported or the context hasn't been created yet. */
export function getMasterGain(): GainNode | null {
  return master;
}

/**
 * Idempotent: ensures the AudioContext exists and is in the `'running'`
 * state. Safe to call from any user gesture handler.
 */
export async function ensureAudioContextResumed(): Promise<void> {
  const c = getAudioContext();
  if (c === null) return;
  if (c.state === 'suspended') {
    try {
      await c.resume();
    } catch {
      // Resume can reject if the gesture didn't unlock the context;
      // the next gesture will retry.
    }
  }
}

/**
 * Set the mute state. Affects future creation (if the context hasn't been
 * built yet) and the existing master gain (if it has). Smooth ramp avoids
 * a click when toggling during playback.
 */
export function setMuted(next: boolean): void {
  muted = next;
  if (master !== null && ctx !== null) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(next ? 0 : 1, now + 0.02);
  }
}

export function isMuted(): boolean {
  return muted;
}

/**
 * Test-only: reset the module's singleton state so each test starts clean.
 * Not exported from `./index.ts` — only the test file imports it.
 */
export function __resetAudioContextForTests(): void {
  ctx = null;
  master = null;
  muted = false;
}
