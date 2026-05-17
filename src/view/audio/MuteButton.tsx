/**
 * MuteButton — the HUD widget that toggles the audio Mute Toggle.
 *
 * Shape mirrors `SpeedControl`: a small bordered button, same padding,
 * same typography. Lives in the HUD row on the Encounter Screen and
 * next to the Start-encounter button on the Prep Screen.
 *
 * Visual: a single ASCII glyph (`♪` unmuted, `♪̸` / `✕` muted) to match
 * the project's pixel-text aesthetic — no icon font dependency.
 */

import type { JSX } from 'react';
import { useMute } from './useMute';

export function MuteButton(): JSX.Element {
  const { muted, toggleMute } = useMute();
  const label = muted ? 'Audio muted. Click to unmute (M).' : 'Audio on. Click to mute (M).';
  return (
    <button
      type="button"
      onClick={toggleMute}
      aria-label={label}
      aria-pressed={muted}
      title={muted ? 'Unmute (M)' : 'Mute (M)'}
      className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 hover:bg-zinc-800"
    >
      {muted ? '♪̸' : '♪'}
    </button>
  );
}
