/**
 * Public surface of the view-context audio module.
 *
 * The Encounter Canvas imports the trigger functions directly (matching
 * the `flashOverlay` / `damageNumbers` / `screenShake` / `outcomeText`
 * pattern in `../effects/`). External consumers — `App.tsx` for the
 * audio-context resume gesture, and the Prep / Encounter screens for the
 * mute button — go through `./index.ts`.
 */

export { ensureAudioContextResumed, getAudioContext } from './audioContext';
export {
  playCast,
  playOutcome,
  playPhaseTransform,
  playVictory,
  playDefeat,
} from './triggers';
export { loadAllSamples } from './sampleRegistry';
export { MuteButton } from './MuteButton';
export { useMute, MUTE_STORAGE_KEY } from './useMute';
