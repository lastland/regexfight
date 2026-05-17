/**
 * App composition root.
 *
 * Orchestrates the four contexts:
 *   - content : loads enemy + player YAML at startup
 *   - persist : restores / persists the Run
 *   - combat  : steps the encounter sim during combat
 *   - view    : renders the three screens
 *
 * This is the only place that knows about all four. The contexts themselves
 * never reach across.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { startEncounter, stepEncounter } from '../combat';
import type { EncounterEvent, EncounterState } from '../combat';
import { loadEnemyYaml, loadPlayerYaml } from '../content';
import type { Enemy } from '../content/types';
import {
  CURRENT_SCHEMA_VERSION,
  SAVE_SLOT_KEY,
  loadRunFromStorage,
  saveRunToStorage,
} from '../persist';
import { score } from '../run/types';
import type { Run } from '../run/types';
import {
  EncounterScreen,
  PostMortemScreen,
  PrepScreen,
} from '../view';
import type { AttemptLogEntry } from '../view';

// Vite raw imports: bundles the YAML text into the JS at build time.
import playerYamlText from '../../data/player.yaml?raw';
import tutorialYamlText from '../../data/enemies/00-tutorial.yaml?raw';

import {
  addScore,
  createRun,
  mergeObservations,
  recordAttempt,
  seedOnArrival,
  summariseAttempt,
  advanceRun,
} from './runState';

// --- Screen state machine ---------------------------------------------------

type ScreenState =
  | { tag: 'loading' }
  | { tag: 'load-error'; message: string }
  | { tag: 'prep'; lastWardSrc: string; lastFlags: string }
  | {
      tag: 'encounter';
      ward: RegExp;
      lastWardSrc: string;
      lastFlags: string;
      sim: EncounterState;
      events: EncounterEvent[];
      ended: boolean;
    }
  | {
      tag: 'postmortem';
      lastWardSrc: string;
      lastFlags: string;
      attemptLog: AttemptLogEntry[];
      result: 'Victory' | 'Defeat';
      scoreEarned: ReturnType<typeof score>;
      damageTakenThisAttempt: number;
      isFirstDeath: boolean;
    }
  | { tag: 'run-complete' };

/**
 * The encounter sim is no longer driven by `setInterval`. Each per-spell
 * animation in the EncounterCanvas calls `onRequestNextEvent` when its
 * Aftermath finishes, and that callback is what advances the sim. See
 * `src/view/docs/adr/0003-event-driven-encounter-pacing.md`.
 *
 * `END_PAUSE_MS` is a transition delay between EncounterEnded and the
 * post-mortem screen — it is NOT the encounter clock, so it survives the
 * refactor unchanged.
 */
const END_PAUSE_MS = 1200;

export type AppProps = {
  /**
   * Test-only escape hatch. When true, the EncounterCanvas auto-requests
   * the next event on every animation frame, driving the encounter to
   * completion synchronously without depending on the per-spell animation
   * state machine. See `EncounterCanvasProps.autoTick`. Production code
   * must NOT pass this.
   */
  autoTick?: boolean | undefined;
};

export function App(props: AppProps = {}) {
  const [enemies, setEnemies] = useState<Enemy[] | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [screen, setScreen] = useState<ScreenState>({ tag: 'loading' });

  // --- Boot: load assets, restore/create Run --------------------------------

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [player, tutorial] = await Promise.all([
          loadPlayerYaml(playerYamlText),
          loadEnemyYaml(tutorialYamlText),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cleanup may flip `cancelled` between the await and here; the typechecker can't see closure mutation.
        if (cancelled) return;
        const enemiesLoaded = [tutorial];
        setEnemies(enemiesLoaded);

        // Try to restore from localStorage. If anything fails or there's no
        // save, start a fresh Run.
        // For v1 there is no RunSchema in content yet (we model Run within
        // run/), so the validate callback is a permissive cast that asserts
        // the basic shape. A future ADR + RunSchema will tighten this.
        const validate = makeRunValidator(enemiesLoaded);
        const loadResult = loadRunFromStorage(window.localStorage, validate);
        const initialRun =
          loadResult.tag === 'loaded'
            ? loadResult.run
            : createRun(enemiesLoaded, player);

        const currentEnemy = enemiesLoaded[initialRun.currentIdx];
        const seeded = currentEnemy
          ? seedOnArrival(initialRun, currentEnemy)
          : initialRun;
        setRun(seeded);
        setScreen(
          currentEnemy
            ? { tag: 'prep', lastWardSrc: '', lastFlags: '' }
            : { tag: 'run-complete' },
        );
      } catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see above
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setScreen({ tag: 'load-error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Persist on every Run change ------------------------------------------

  useEffect(() => {
    if (run) {
      try {
        saveRunToStorage(window.localStorage, run);
      } catch {
        // localStorage may be unavailable (private window, etc.); failure to
        // save is non-fatal in v1.
      }
    }
  }, [run]);

  // --- Event-driven pacing --------------------------------------------------
  //
  // Replaces the v1 setInterval loop. The EncounterCanvas calls
  // `onRequestNextEvent` when each per-spell animation finishes. We step
  // the sim, append the event, and (on EncounterEnded) schedule the
  // post-mortem transition after END_PAUSE_MS.
  //
  // `endedRef` guards against re-entry: the canvas may briefly fire one
  // more request between the EncounterEnded event arriving and the
  // post-mortem render replacing the EncounterScreen.

  const endedRef = useRef(false);
  useEffect(() => {
    if (screen.tag !== 'encounter') {
      endedRef.current = false;
    }
  }, [screen.tag]);

  // Held in a ref so `onRequestNextEvent` (memoized with `[]` deps so the
  // EncounterCanvas effect-dep is stable) always sees the latest
  // `commitEncounterEnd` closure over the current `run`/`enemies`.
  const commitEncounterEndRef = useRef<(events: EncounterEvent[]) => void>(
    () => undefined,
  );

  const onRequestNextEvent = useCallback(() => {
    if (endedRef.current) return;
    setScreen((prev) => {
      if (prev.tag !== 'encounter' || prev.ended) return prev;
      const { state, event } = stepEncounter(prev.sim, prev.ward);
      const nextEvents = [...prev.events, event];
      if (event.tag === 'EncounterEnded') {
        endedRef.current = true;
        const commit = commitEncounterEndRef.current;
        window.setTimeout(() => { commit(nextEvents); }, END_PAUSE_MS);
        return { ...prev, sim: state, events: nextEvents, ended: true };
      }
      return { ...prev, sim: state, events: nextEvents };
    });
  }, []);

  // --- Transitions ----------------------------------------------------------

  const currentEnemy = enemies && run ? enemies[run.currentIdx] : undefined;

  const onStartEncounter = useCallback(
    (ward: RegExp) => {
      if (!run || !currentEnemy) return;
      const seed = Math.floor(Math.random() * 0x7fffffff);
      const sim = startEncounter({
        enemy: currentEnemy,
        player: run.player,
        seed,
      });
      setScreen((prev) => ({
        tag: 'encounter',
        ward,
        lastWardSrc: prev.tag === 'prep' ? prev.lastWardSrc : '',
        lastFlags: prev.tag === 'prep' ? prev.lastFlags : '',
        sim,
        events: [],
        ended: false,
      }));
    },
    [run, currentEnemy],
  );

  const commitEncounterEnd = useCallback(
    (events: EncounterEvent[]) => {
      if (!run || !currentEnemy) return;
      const summary = summariseAttempt(events, currentEnemy, run.player.baseAttack);
      const merged = mergeObservations(
        run,
        currentEnemy.id,
        summary.attemptSpells,
      );
      const scored = addScore(merged, summary.scoreEarned);
      const recorded = recordAttempt(scored, currentEnemy.id, summary.result);
      setRun(recorded);
      // First-death framing fires only when this Defeat brings the
      // run-wide death count from 0 → 1. Subsequent defeats render the
      // plain post-mortem.
      const isFirstDeath =
        summary.result === 'Defeat' && recorded.deathCount === 1;
      setScreen((prev) => ({
        tag: 'postmortem',
        lastWardSrc: prev.tag === 'encounter' ? prev.lastWardSrc : '',
        lastFlags: prev.tag === 'encounter' ? prev.lastFlags : '',
        attemptLog: summary.attemptLog,
        result: summary.result,
        scoreEarned: summary.scoreEarned,
        damageTakenThisAttempt: summary.damageTakenThisAttempt,
        isFirstDeath,
      }));
    },
    [run, currentEnemy],
  );

  // Keep the ref synced so `onRequestNextEvent` (stable identity) can
  // reach the most recent closure when the encounter ends.
  useEffect(() => {
    commitEncounterEndRef.current = commitEncounterEnd;
  }, [commitEncounterEnd]);

  const onRetry = useCallback(() => {
    setScreen((prev) => ({
      tag: 'prep',
      lastWardSrc: prev.tag === 'postmortem' ? prev.lastWardSrc : '',
      lastFlags: prev.tag === 'postmortem' ? prev.lastFlags : '',
    }));
  }, []);

  const onAdvance = useCallback(() => {
    if (!run || !enemies) return;
    const next = advanceRun(run);
    const nextEnemy = enemies[next.currentIdx];
    if (!nextEnemy) {
      setRun(next);
      setScreen({ tag: 'run-complete' });
      return;
    }
    const seeded = seedOnArrival(next, nextEnemy);
    setRun(seeded);
    setScreen({ tag: 'prep', lastWardSrc: '', lastFlags: '' });
  }, [run, enemies]);

  const onRestart = useCallback(() => {
    if (!run || !enemies) return;
    // Fresh Run reusing the loaded enemy roster and the current PlayerProfile.
    // Observation logs, score, attempt counts, and death count are discarded
    // — Restart means "start a new run from zero". The save useEffect will
    // overwrite localStorage with the fresh Run.
    const fresh = createRun(enemies, run.player);
    const firstEnemy = enemies[fresh.currentIdx];
    if (!firstEnemy) {
      setRun(fresh);
      setScreen({ tag: 'run-complete' });
      return;
    }
    const seeded = seedOnArrival(fresh, firstEnemy);
    setRun(seeded);
    setScreen({ tag: 'prep', lastWardSrc: '', lastFlags: '' });
  }, [run, enemies]);

  // --- Render ----------------------------------------------------------------

  if (screen.tag === 'loading') {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }
  if (screen.tag === 'load-error') {
    return (
      <CenteredMessage tone="error">
        Failed to load game data:
        <pre className="mt-2 text-sm whitespace-pre-wrap">{screen.message}</pre>
      </CenteredMessage>
    );
  }
  if (screen.tag === 'run-complete') {
    return (
      <CenteredMessage>
        <h1 className="text-3xl">Run complete.</h1>
        <p className="text-zinc-400 mt-2">
          Score: {run ? (run.progressScore) : 0}
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-6 rounded border border-zinc-600 bg-zinc-800 px-4 py-2 font-mono text-sm text-zinc-100 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          Restart
        </button>
      </CenteredMessage>
    );
  }
  if (!run || !currentEnemy) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  const obsLog = run.observationLogs[currentEnemy.id] ?? [];

  if (screen.tag === 'prep') {
    const foresight =
      (run.enemyAttemptCounts[currentEnemy.id as unknown as string] ?? 0) === 0;
    return (
      <PrepScreen
        enemy={currentEnemy}
        observationLog={obsLog}
        progressScore={run.progressScore}
        foresight={foresight}
        onStartEncounter={(ward) => {
          // Remember the submitted source for potential future use (e.g.
          // pre-filling the WardEditor on retry once it exposes that prop).
          setScreen((prev) => ({
            ...prev,
            lastWardSrc: ward.source,
            lastFlags: ward.flags,
          }));
          onStartEncounter(ward);
        }}
      />
    );
  }

  if (screen.tag === 'encounter') {
    return (
      <EncounterScreen
        enemy={currentEnemy}
        events={screen.events}
        playerMaxHp={screen.sim.playerMaxHp}
        enemyMaxHp={screen.sim.enemyMaxHp}
        currentPhaseIdx={screen.sim.currentPhaseIdx}
        onRequestNextEvent={onRequestNextEvent}
        autoTick={props.autoTick}
      />
    );
  }

  // postmortem
  const postMortemBaseProps = {
    enemy: currentEnemy,
    attemptLog: screen.attemptLog,
    result: screen.result,
    scoreEarned: screen.scoreEarned,
    damageTakenThisAttempt: screen.damageTakenThisAttempt,
    isFirstDeath: screen.isFirstDeath,
    onRetry,
  };
  return screen.result === 'Victory' ? (
    <PostMortemScreen {...postMortemBaseProps} onAdvance={onAdvance} />
  ) : (
    <PostMortemScreen {...postMortemBaseProps} />
  );
}

// --- Helpers ---------------------------------------------------------------

function CenteredMessage({
  children,
  tone = 'normal',
}: {
  children: React.ReactNode;
  tone?: 'normal' | 'error';
}) {
  return (
    <main className="flex h-full items-center justify-center font-mono p-8">
      <div
        className={
          tone === 'error'
            ? 'text-red-300 text-center max-w-xl'
            : 'text-zinc-100 text-center'
        }
      >
        {children}
      </div>
    </main>
  );
}

/**
 * Permissive runtime validator for Run shape, used while restoring from
 * localStorage. Returns the value with light shape coercion. A future
 * content-context ADR can introduce a proper `RunSchema` (Zod) and replace
 * this; for v1 we accept the round-trip risk in exchange for not blocking
 * the milestone.
 */
function makeRunValidator(enemies: Enemy[]) {
  return (payload: unknown): Run => {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Run payload is not an object');
    }
    const p = payload as Record<string, unknown>;
    if (!Array.isArray(p.enemies) || typeof p.currentIdx !== 'number') {
      throw new Error('Run payload missing required fields');
    }
    // Sanity check: the persisted Enemy ids must match the loaded roster.
    const loadedIds = new Set(enemies.map((e) => e.id as unknown as string));
    for (const ref of p.enemies as unknown[]) {
      if (typeof ref !== 'object' || ref === null) {
        throw new Error('Run.enemies entry is not an object');
      }
      const refId = (ref as Record<string, unknown>).id;
      if (typeof refId !== 'string' || !loadedIds.has(refId)) {
        throw new Error(
          `Run references unknown enemy id ${String(refId)}; save likely from a different content version`,
        );
      }
    }
    if (typeof p.progressScore !== 'number') {
      throw new Error('Run.progressScore must be a number');
    }
    if (typeof p.observationLogs !== 'object' || p.observationLogs === null) {
      throw new Error('Run.observationLogs missing');
    }
    if (typeof p.visited !== 'object' || p.visited === null) {
      throw new Error('Run.visited missing');
    }
    if (typeof p.player !== 'object' || p.player === null) {
      throw new Error('Run.player missing');
    }
    // enemyAttemptCounts and deathCount were added after the initial save
    // format; coalesce defaults so saves from the prior build still load.
    const base = payload as Run;
    const coalesced: Run = {
      ...base,
      enemyAttemptCounts:
        typeof p.enemyAttemptCounts === 'object' && p.enemyAttemptCounts !== null
          ? (p.enemyAttemptCounts as Run['enemyAttemptCounts'])
          : {},
      deathCount: typeof p.deathCount === 'number' ? p.deathCount : 0,
    };
    return coalesced;
  };
}

// Stamp schema version for grep-ability in this file.
void CURRENT_SCHEMA_VERSION;
void SAVE_SLOT_KEY;
