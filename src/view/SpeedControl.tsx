/**
 * SpeedControl — the HUD button that cycles the Speed Multiplier.
 *
 * Click cycles 1× → 2× → 5× → 10× → 1×. Number keys 1/2/3/4 are
 * equivalent shortcuts, installed by `useSpeedMultiplier`'s window
 * listener (so the control works even when this button isn't focused).
 */

import type { JSX } from 'react';
import type { SpeedMultiplier } from './useSpeedMultiplier';

export type SpeedControlProps = {
  speed: SpeedMultiplier;
  onCycle: () => void;
};

export function SpeedControl(props: SpeedControlProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onCycle}
      aria-label={`Speed ${props.speed}x. Click to cycle. Number keys 1-4 also work.`}
      title="Cycle speed (1/2/3/4)"
      className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200 hover:bg-zinc-800"
    >
      {props.speed}×
    </button>
  );
}
