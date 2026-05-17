/**
 * PrepScreen — the bonfire. Shows the current Enemy, the Observation Log
 * accumulated against it, and the Ward Editor. The player commits a Ward
 * here, which begins an Attempt.
 *
 * No domain logic lives here: the Observation Log is sourced from `run`,
 * the Ward submission callback routes to whoever spins up the Encounter.
 */

import type { JSX } from 'react';
import type { Enemy } from '../content/types';
import type { Spell } from '../combat/types';
import type { Score } from '../run/types';
import { ObservationLog } from './ObservationLog';
import { WardEditor } from './WardEditor';
import { MuteButton } from './audio';

export type PrepScreenProps = {
  enemy: Enemy;
  observationLog: readonly Spell[];
  progressScore: Score;
  // True before the player's first resolved Attempt against this Enemy.
  // Flips the seed-spell section to the clairvoyant-foresight framing;
  // becomes false forever after the first attempt completes.
  foresight: boolean;
  onStartEncounter: (ward: RegExp) => void;
};

export function PrepScreen(props: PrepScreenProps): JSX.Element {
  const { enemy, observationLog, progressScore, foresight, onStartEncounter } =
    props;

  const sectionLabel = foresight ? 'Foresight section' : 'Observation log section';
  const heading = foresight ? 'Foresight (clairvoyance)' : 'Observation log';

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 text-zinc-100">
      <header className="flex items-baseline justify-between border-b border-zinc-700 pb-3">
        <div>
          <h1 className="text-2xl font-bold">{enemy.name}</h1>
          <p className="text-sm text-zinc-400">Prep — choose your Ward.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right font-mono">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Score
            </div>
            <div className="text-xl text-amber-300">{progressScore as number}</div>
          </div>
          <MuteButton />
        </div>
      </header>

      <section aria-label={sectionLabel} className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
          {heading}
        </h2>
        {foresight ? (
          <p className="text-sm italic text-zinc-400">
            You haven&apos;t faced this enemy yet. Your clairvoyance reveals a
            few of the strings it will weave — Real spells and Decoys both.
            Study them; the rest you&apos;ll learn by dying.
          </p>
        ) : null}
        <ObservationLog log={observationLog} />
      </section>

      <WardEditor onSubmit={onStartEncounter} />
    </main>
  );
}
