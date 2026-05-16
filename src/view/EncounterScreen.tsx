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

import { useEffect, useRef } from 'react';
import type { EncounterEvent } from '../combat/types';
import type { HP } from '../run/types';
import type { Enemy } from '../content/types';
import { EncounterCanvas } from './EncounterCanvas';
import { KIND_CLASS, OUTCOME_CLASS, OUTCOME_LABEL } from './colors';

export type EncounterScreenProps = {
  enemy: Enemy;
  events: readonly EncounterEvent[];
  playerHp: HP;
  enemyHp: HP;
  playerMaxHp: HP;
  enemyMaxHp: HP;
  currentPhaseIdx: number;
  onEnded?: (result: 'Victory' | 'Defeat') => void;
};

const TICKER_WINDOW = 20;

function pct(cur: HP, max: HP): number {
  const c = cur as unknown as number;
  const m = max as unknown as number;
  if (m <= 0) return 0;
  return Math.max(0, Math.min(100, (c / m) * 100));
}

export function EncounterScreen(props: EncounterScreenProps): JSX.Element {
  const {
    enemy,
    events,
    playerHp,
    enemyHp,
    playerMaxHp,
    enemyMaxHp,
    currentPhaseIdx,
    onEnded,
  } = props;

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
        <HpBar label="Player" hp={playerHp} max={playerMaxHp} side="left" />
        <HpBar
          label={enemy.name}
          hp={enemyHp}
          max={enemyMaxHp}
          side="right"
        />
      </div>
      <div className="text-center font-mono text-sm text-zinc-400">
        Phase {currentPhaseIdx + 1} / {enemy.phases.length}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <EncounterCanvas events={events} />
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

type HpBarProps = {
  label: string;
  hp: HP;
  max: HP;
  side: 'left' | 'right';
};

function HpBar(props: HpBarProps): JSX.Element {
  const filled = pct(props.hp, props.max);
  const align = props.side === 'left' ? 'text-left' : 'text-right';
  const fillJustify = props.side === 'left' ? 'left-0' : 'right-0';
  const color = props.side === 'left' ? 'bg-emerald-600' : 'bg-rose-600';
  return (
    <div className={`flex flex-col gap-1 ${align}`}>
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{props.label}</span>
        <span className="font-mono text-sm text-zinc-400">
          {props.hp as unknown as number} / {props.max as unknown as number}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded border border-zinc-700 bg-zinc-900">
        <div
          className={`absolute top-0 h-full transition-[width] duration-200 ${fillJustify} ${color}`}
          style={{ width: `${filled}%` }}
        />
      </div>
    </div>
  );
}
