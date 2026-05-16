/**
 * EncounterScreen — the fight surface.
 *
 * Composition: HP bars at top, phase indicator, the EncounterCanvas as the
 * central animation surface, and an event ticker showing the most recent
 * EncounterEvents color-coded by Outcome.
 *
 * No domain logic. We consume an accumulating `events` array and the current
 * HP / phase values, and we call back `onEnded(result)` exactly once when
 * the terminal `EncounterEnded` event arrives.
 */

import { useEffect, useMemo, useRef, type JSX } from 'react';
import type { EncounterEvent } from '../combat/types';
import type { HP } from '../run/types';
import type { Enemy } from '../content/types';
import { EncounterCanvas } from './EncounterCanvas';
import { KIND_CLASS, OUTCOME_CLASS, OUTCOME_LABEL } from './colors';
import { SpeedControl } from './SpeedControl';
import { useSpeedMultiplier } from './useSpeedMultiplier';
import { HpBarTween } from './effects/hpBarTween';

export type EncounterScreenProps = {
  enemy: Enemy;
  events: readonly EncounterEvent[];
  playerHp: HP;
  enemyHp: HP;
  playerMaxHp: HP;
  enemyMaxHp: HP;
  currentPhaseIdx: number;
  /**
   * Pull contract: called when the canvas's current per-spell animation
   * completes (Aftermath finished). The screen forwards the call from
   * the canvas to App, which steps the sim and produces the next event.
   * Required — see `docs/adr/0003-event-driven-encounter-pacing.md`.
   */
  onRequestNextEvent: () => void;
  onEnded?: (result: 'Victory' | 'Defeat') => void;
  /**
   * Test-only: forwarded to the canvas. Production code must NOT pass
   * this. See `EncounterCanvasProps.autoTick`.
   */
  autoTick?: boolean | undefined;
};

const TICKER_WINDOW = 20;

export function EncounterScreen(props: EncounterScreenProps): JSX.Element {
  const {
    enemy,
    events,
    playerHp,
    enemyHp,
    playerMaxHp,
    enemyMaxHp,
    currentPhaseIdx,
    onRequestNextEvent,
    onEnded,
    autoTick,
  } = props;

  const { speed, cycleSpeed } = useSpeedMultiplier();

  // Phase-transition white flash on the enemy HP bar. Each PhaseAdvanced
  // event bumps the key, which the HpBarTween component watches.
  const phaseFlashKey = useMemo(
    () => events.filter((e) => e.tag === 'PhaseAdvanced').length,
    [events],
  );

  // Fire `onEnded` exactly once when the terminal event appears.
  const endedFiredRef = useRef(false);
  useEffect(() => {
    if (endedFiredRef.current) return;
    const last = events.length > 0 ? events[events.length - 1] : undefined;
    if (last && last.tag === 'EncounterEnded') {
      endedFiredRef.current = true;
      onEnded?.(last.result);
    }
  }, [events, onEnded]);

  const ticker = events
    .filter(
      (e): e is Extract<EncounterEvent, { tag: 'SpellResolved' }> =>
        e.tag === 'SpellResolved',
    )
    .slice(-TICKER_WINDOW);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6 text-zinc-100">
      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Player</span>
          <HpBarTween
            current={playerHp as unknown as number}
            max={playerMaxHp as unknown as number}
            side="player"
          />
        </div>
        <div className="flex flex-col gap-1 text-right">
          <span className="font-semibold">{enemy.name}</span>
          <HpBarTween
            current={enemyHp as unknown as number}
            max={enemyMaxHp as unknown as number}
            side="enemy"
            flashKey={phaseFlashKey}
          />
        </div>
      </div>
      <div className="flex items-center justify-between font-mono text-sm text-zinc-400">
        <span aria-hidden="true" className="invisible">spacer</span>
        <span>
          Phase {currentPhaseIdx + 1} / {enemy.phases.length}
        </span>
        <SpeedControl speed={speed} onCycle={cycleSpeed} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <EncounterCanvas
            events={events}
            onRequestNextEvent={onRequestNextEvent}
            speed={speed}
            autoTick={autoTick}
          />
        </div>
        <aside
          aria-label="Event ticker"
          className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded border border-zinc-700 bg-zinc-950 p-2 font-mono text-xs"
        >
          <h3 className="border-b border-zinc-700 pb-1 text-zinc-400">
            Events
          </h3>
          {ticker.length === 0 ? (
            <p className="italic text-zinc-600">awaiting first spell…</p>
          ) : (
            ticker.map((e, idx) => (
              <div key={idx} className="flex justify-between gap-2">
                <span className={KIND_CLASS[e.spell.kind]}>
                  {e.spell.text}
                </span>
                <span className={OUTCOME_CLASS[e.outcome]}>
                  {OUTCOME_LABEL[e.outcome]}
                </span>
              </div>
            ))
          )}
        </aside>
      </div>
    </main>
  );
}

