/**
 * PrepScreen — the bonfire. Shows the current Enemy, the Observation Log
 * accumulated against it, and the Ward Editor. The player commits a Ward
 * here, which begins an Attempt.
 *
 * No domain logic lives here: the Observation Log is sourced from `run`,
 * the Ward submission callback routes to whoever spins up the Encounter.
 */

import type { Enemy } from '../content/types';
import type { Spell } from '../combat/types';
import type { Score } from '../run/types';
import { ObservationLog } from './ObservationLog';
import { WardEditor } from './WardEditor';

export type PrepScreenProps = {
  enemy: Enemy;
  observationLog: readonly Spell[];
  progressScore: Score;
  onStartEncounter: (ward: RegExp) => void;
};

export function PrepScreen(props: PrepScreenProps): JSX.Element {
  const { enemy, observationLog, progressScore, onStartEncounter } = props;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 text-zinc-100">
      <header className="flex items-baseline justify-between border-b border-zinc-700 pb-3">
        <div>
          <h1 className="text-2xl font-bold">{enemy.name}</h1>
          <p className="text-sm text-zinc-400">Prep — choose your Ward.</p>
        </div>
        <div className="text-right font-mono">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Score
          </div>
          <div className="text-xl text-amber-300">{progressScore as number}</div>
        </div>
      </header>

      <section
        aria-label="Observation log section"
        className="flex flex-col gap-2"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
          Observation log
        </h2>
        <ObservationLog log={observationLog} />
      </section>

      <WardEditor onSubmit={onStartEncounter} />
    </main>
  );
}
