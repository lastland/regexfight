/**
 * ObservationLog — DOM list of Spells the player has observed against
 * the current Enemy. Read-only. Dedup is `run`'s responsibility; this
 * component renders whatever it is given.
 */

import type { Spell } from '../combat/types';
import { KIND_CLASS } from './colors';

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

  return (
    <ul
      aria-label="Observation log"
      className="flex flex-wrap gap-2 font-mono text-sm"
    >
      {log.map((spell, idx) => (
        <li
          key={`${spell.text}-${idx}`}
          className={`rounded border border-zinc-700 bg-zinc-950 px-2 py-1 ${KIND_CLASS[spell.kind]}`}
          title={`${spell.kind} spell`}
        >
          {spell.text}
        </li>
      ))}
    </ul>
  );
}
