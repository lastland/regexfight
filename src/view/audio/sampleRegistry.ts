/**
 * Sample registry — loads the 8 encounter SFX once and caches the decoded
 * AudioBuffers for the page lifetime.
 *
 * Source files live in `data/audio/` (CC0; see `data/audio/LICENSE.md`).
 * Each is a small `.wav` (≤ 70 KB).
 *
 * Load is triggered by the first user gesture (Start-encounter click).
 * If the first trigger fires before decode completes (typically a window
 * of tens of ms after the click) the trigger is a silent no-op.
 */

import castUrl from '../../../data/audio/cast.wav';
import counterattackUrl from '../../../data/audio/counterattack.wav';
import hitUrl from '../../../data/audio/hit.wav';
import backfireUrl from '../../../data/audio/backfire.wav';
import dodgeUrl from '../../../data/audio/dodge.wav';
import phaseTransformUrl from '../../../data/audio/phaseTransform.wav';
import victoryUrl from '../../../data/audio/victory.wav';
import defeatUrl from '../../../data/audio/defeat.wav';

export type SampleName =
  | 'cast'
  | 'counterattack'
  | 'hit'
  | 'backfire'
  | 'dodge'
  | 'phaseTransform'
  | 'victory'
  | 'defeat';

const URLS: Record<SampleName, string> = {
  cast: castUrl,
  counterattack: counterattackUrl,
  hit: hitUrl,
  backfire: backfireUrl,
  dodge: dodgeUrl,
  phaseTransform: phaseTransformUrl,
  victory: victoryUrl,
  defeat: defeatUrl,
};

const buffers = new Map<SampleName, AudioBuffer>();
let loadPromise: Promise<void> | null = null;

async function fetchAndDecode(
  ctx: BaseAudioContext,
  name: SampleName,
  url: string,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`audio: failed to fetch ${name} (${res.status})`);
  const arrayBuf = await res.arrayBuffer();
  const decoded = await ctx.decodeAudioData(arrayBuf);
  buffers.set(name, decoded);
}

/**
 * Idempotent: starts loading all 8 samples on the first call, returns
 * the same Promise on subsequent calls. Resolves when every sample has
 * been decoded into its AudioBuffer.
 */
export function loadAllSamples(ctx: BaseAudioContext): Promise<void> {
  if (loadPromise !== null) return loadPromise;
  const names = Object.keys(URLS) as SampleName[];
  loadPromise = Promise.all(
    names.map((name) => {
      const url = URLS[name];
      return fetchAndDecode(ctx, name, url);
    }),
  ).then(() => undefined);
  return loadPromise;
}

/**
 * Returns the decoded AudioBuffer for `name`, or `null` if decode hasn't
 * completed yet (or hasn't been started). Callers no-op on null.
 */
export function getSample(name: SampleName): AudioBuffer | null {
  return buffers.get(name) ?? null;
}

/** Test-only: clears cached buffers + load promise. Not exported from index.ts. */
export function __resetSampleRegistryForTests(): void {
  buffers.clear();
  loadPromise = null;
}
