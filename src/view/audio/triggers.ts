/**
 * Trigger surface — what `EncounterCanvas` calls at each sound moment.
 *
 * Every trigger is best-effort: if the AudioContext doesn't exist yet
 * (e.g. happy-dom tests, or before the first user gesture), or if the
 * sample hasn't finished decoding, the call is a silent no-op.
 *
 * Triggers map 1:1 onto the 8 moments decided in the plan:
 *
 *   - playCast()                         — Invocation phase enter
 *   - playOutcome(outcome)               — per-Outcome Impact Moment
 *     (Counterattack / Hit / Backfire / Dodge)
 *   - playPhaseTransform()               — PhaseAdvanced ingest
 *   - playVictory() / playDefeat()       — EncounterEnded by result
 */

import type { Outcome } from '../../combat/types';
import type { SpeedMultiplier } from '../useSpeedMultiplier';
import { getAudioContext, getMasterGain } from './audioContext';
import { computeReleaseScale, makeReleaseEnvelope } from './envelope';
import { getSample, type SampleName } from './sampleRegistry';

const OUTCOME_SAMPLE: Record<Outcome, SampleName> = {
  Counterattack: 'counterattack',
  Hit: 'hit',
  Backfire: 'backfire',
  Dodge: 'dodge',
};

function playSample(name: SampleName, speed: SpeedMultiplier): void {
  const ctx = getAudioContext();
  const master = getMasterGain();
  if (ctx === null || master === null) return;
  const buffer = getSample(name);
  if (buffer === null) return;

  const when = ctx.currentTime;
  const scale = computeReleaseScale(speed);
  const { gain, stopAt } = makeReleaseEnvelope(ctx, when, buffer.duration, scale);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(gain).connect(master);
  src.start(when);
  src.stop(stopAt);
}

export function playCast(speed: SpeedMultiplier): void {
  playSample('cast', speed);
}

export function playOutcome(outcome: Outcome, speed: SpeedMultiplier): void {
  playSample(OUTCOME_SAMPLE[outcome], speed);
}

export function playPhaseTransform(speed: SpeedMultiplier): void {
  playSample('phaseTransform', speed);
}

export function playVictory(speed: SpeedMultiplier): void {
  playSample('victory', speed);
}

export function playDefeat(speed: SpeedMultiplier): void {
  playSample('defeat', speed);
}
