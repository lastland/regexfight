/**
 * PostMortemScreen — the receipt.
 *
 * Shows the result (Victory/Defeat), score earned, optional flawless badge,
 * and the full Attempt Log grouped by Outcome with counts.
 *
 * No domain logic: groupings and counts are simple presentation work over
 * the entries the caller hands us.
 */

import type { Outcome, Spell } from '../combat/types';
import type { Score } from '../run/types';
import type { Enemy } from '../content/types';
import { KIND_CLASS, OUTCOME_CLASS, OUTCOME_LABEL } from './colors';

export type AttemptLogEntry = { spell: Spell; outcome: Outcome };

export type PostMortemScreenProps = {
  enemy: Enemy;
  attemptLog: readonly AttemptLogEntry[];
  result: 'Victory' | 'Defeat';
  scoreEarned: Score;
  damageTakenThisAttempt: number;
  // True exactly once per Run: on the post-mortem of the player's first
  // Defeat. Renders the soul-like "you can learn from this" framing above
  // the result header.
  isFirstDeath?: boolean;
  onRetry: () => void;
  onAdvance?: () => void;
};

const OUTCOME_ORDER: Outcome[] = ['Counterattack', 'Dodge', 'Hit', 'Backfire'];

function groupByOutcome(
  entries: readonly AttemptLogEntry[],
): Record<Outcome, AttemptLogEntry[]> {
  const groups: Record<Outcome, AttemptLogEntry[]> = {
    Counterattack: [],
    Hit: [],
    Backfire: [],
    Dodge: [],
  };
  for (const e of entries) {
    groups[e.outcome].push(e);
  }
  return groups;
}

export function PostMortemScreen(props: PostMortemScreenProps): JSX.Element {
  const {
    enemy,
    attemptLog,
    result,
    scoreEarned,
    damageTakenThisAttempt,
    isFirstDeath,
    onRetry,
    onAdvance,
  } = props;

  const groups = groupByOutcome(attemptLog);
  const flawless = result === 'Victory' && damageTakenThisAttempt === 0;
  const advanceEnabled = result === 'Victory' && onAdvance !== undefined;
  const showFirstDeathCallout = isFirstDeath === true && result === 'Defeat';

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 text-zinc-100">
      {showFirstDeathCallout ? (
        <aside
          role="note"
          aria-label="First-death message"
          className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200"
        >
          <p className="font-semibold">You died.</p>
          <p className="mt-1 text-sm">
            But your special ability lets you learn from mistakes. Review what
            happened below and come back.
          </p>
        </aside>
      ) : null}
      <header className="flex flex-col items-center gap-2 border-b border-zinc-700 pb-4">
        <h1
          className={`text-4xl font-bold ${
            result === 'Victory' ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {result}
        </h1>
        <p className="text-sm text-zinc-400">
          vs. <span className="text-zinc-200">{enemy.name}</span>
        </p>
        <div className="flex items-center gap-3 font-mono">
          <span className="text-zinc-400">Score earned</span>
          <span className="text-xl text-amber-300">
            +{scoreEarned as unknown as number}
          </span>
          {flawless ? (
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-300">
              Flawless!
            </span>
          ) : null}
        </div>
      </header>

      <section
        aria-label="Attempt log"
        className="flex flex-col gap-3"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
          Attempt log
        </h2>
        {attemptLog.length === 0 ? (
          <p className="text-sm italic text-zinc-500">
            No spells resolved this attempt.
          </p>
        ) : (
          OUTCOME_ORDER.map((outcome) => {
            const items = groups[outcome];
            if (items.length === 0) return null;
            return (
              <div
                key={outcome}
                className="rounded border border-zinc-700 bg-zinc-900/50 p-3"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className={`font-semibold ${OUTCOME_CLASS[outcome]}`}>
                    {OUTCOME_LABEL[outcome]}
                  </span>
                  <span className="font-mono text-xs text-zinc-400">
                    {items.length}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-2 font-mono text-sm">
                  {items.map((entry, idx) => (
                    <li
                      key={`${entry.spell.text}-${idx}`}
                      className={`rounded border border-zinc-700 bg-zinc-950 px-2 py-1 ${KIND_CLASS[entry.spell.kind]}`}
                    >
                      {entry.spell.text}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded bg-zinc-700 px-4 py-2 font-semibold text-white transition hover:bg-zinc-600"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onAdvance}
          disabled={!advanceEnabled}
          className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          Advance
        </button>
      </div>
    </main>
  );
}
