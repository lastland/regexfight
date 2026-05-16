/**
 * ObservationLog — DOM list of Spells the player has observed against
 * the current Enemy, split into two clearly-labelled sections:
 *   - Counterattack — Real spells; the Ward should match these.
 *   - Dodge         — Decoy spells; the Ward should reject these.
 *
 * Read-only. Dedup is `run`'s responsibility; this component renders
 * whatever it is given.
 */

import type { Spell } from '../combat/types';
import { KIND_CLASS, OUTCOME_CLASS, OUTCOME_LABEL } from './colors';

export type ObservationLogProps = {
  log: readonly Spell[];
  emptyMessage?: string;
};

export function ObservationLog(props: ObservationLogProps): JSX.Element {
  const { log } = props;
  const emptyMessage = props.emptyMessage ?? 'No spells observed yet.';

  if (log.length === 0) {
    return (
      <p className="text-sm italic text-zinc-500" role="status">
        {emptyMessage}
      </p>
    );
  }

  const reals = log.filter((s) => s.kind === 'Real');
  const decoys = log.filter((s) => s.kind === 'Decoy');

  return (
    <div aria-label="Observation log" className="flex flex-col gap-3">
      <SpellGroup
        outcome="Counterattack"
        instruction="your Ward must match these"
        emptyText="No Real spells observed yet."
        spells={reals}
      />
      <SpellGroup
        outcome="Dodge"
        instruction="your Ward must reject these"
        emptyText="No Decoys observed yet."
        spells={decoys}
      />
    </div>
  );
}

type SpellGroupProps = {
  outcome: 'Counterattack' | 'Dodge';
  instruction: string;
  emptyText: string;
  spells: readonly Spell[];
};

function SpellGroup(props: SpellGroupProps): JSX.Element {
  const { outcome, instruction, emptyText, spells } = props;
  const headingClass = OUTCOME_CLASS[outcome];

  return (
    <section
      aria-label={`${outcome} group`}
      className="rounded border border-zinc-800 bg-zinc-950/40 p-3"
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h3
          className={`text-xs font-semibold uppercase tracking-wide ${headingClass}`}
        >
          {OUTCOME_LABEL[outcome]}{' '}
          <span className="text-zinc-400 normal-case">— {instruction}</span>
        </h3>
        <span className="font-mono text-xs text-zinc-500">
          {spells.length}
        </span>
      </header>
      {spells.length === 0 ? (
        <p className="text-sm italic text-zinc-600">{emptyText}</p>
      ) : (
        <ul className="flex flex-wrap gap-2 font-mono text-sm">
          {spells.map((spell, idx) => (
            <li
              key={`${spell.text}-${idx}`}
              className={`rounded border border-zinc-700 bg-zinc-950 px-2 py-1 ${KIND_CLASS[spell.kind]}`}
              title={`${spell.kind} spell`}
            >
              {spell.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
