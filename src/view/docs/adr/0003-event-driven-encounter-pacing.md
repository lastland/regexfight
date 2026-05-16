# ADR-0002 (view): Event-driven encounter pacing with a global Speed Multiplier

**Date**: 2026-05-16
**Status**: Accepted

## Context

The v1 encounter loop in `src/app/App.tsx` drives the sim with a fixed-period `setInterval(stepEncounter, TICK_MS=700)`. Events arrive on a metronome. The `EncounterCanvas` ingests them into a flying-list and animates each independently at its own 1.4 s pace, so animations overlap (often 2–3 spells on screen at once).

The v1.1 visual-polish design (see `docs/adr/0004-five-phase-spell-animation.md`) introduces a five-phase per-spell animation with deliberate slow beats at Invocation and Resolution. Overlapping animations break this:

- Slow-mo on a Counterattack is meaningless if the *next* spell's Invocation is already happening over it.
- The "magic words" text reveal during Invocation can't be readable if it's competing with a previous spell's Aftermath flash.
- Per-Outcome flash colours (Hit red, Backfire orange) need to *land alone* to teach the player what kind of error they made.

Beyond that, the user requested an explicit speedup feature: 1× / 2× / 5× / 10× — useful for soul-like replays where the player has already memorised the early content and wants to skip through it.

A fixed `setInterval` can't deliver either requirement.

## Decision

**Switch the encounter loop to event-driven pacing.**

- Remove `setInterval` and `TICK_MS` from `src/app/App.tsx`.
- Add `onRequestNextEvent: () => void` as a prop to `EncounterScreen`.
- The Encounter Screen calls `onRequestNextEvent()` exactly once per Spell, at the moment the current Spell's Aftermath finishes.
- `App.tsx`'s handler for `onRequestNextEvent` calls `stepEncounter(state, ward)`, appends the new event, and that re-triggers the screen.
- When the Encounter Screen receives an `EncounterEnded` event, it does *not* request a next event — it just animates the Aftermath, holds the end pose for the user-set `END_PAUSE_MS`, and signals the parent via `onEnded`.

**Introduce a global Speed Multiplier.**

```ts
type SpeedMultiplier = 1 | 2 | 5 | 10;
```

- Stored in `localStorage` under `regexfight:speed:v1`, separate from the Run save. Cosmetic preference, not gameplay state.
- Surfaced via a small HUD button on the Encounter Screen that cycles 1× → 2× → 5× → 10× → 1×. Number keys `1` / `2` / `3` / `4` are equivalent shortcuts during combat.
- Scales the duration of every Animation Phase uniformly, with two principled exceptions:
  - **Glyph-by-glyph Spell Text reveal** caps at a readable floor: at ≥2× it reveals instantly.
  - **HP-bar tween duration** does *not* scale — stays ~250 ms at any speed so the "damage land" beat survives.

## Consequences

**Positive:**

- Per-spell animation pacing becomes a view-context concern only. The combat sim remains a pure deterministic state machine driven by `stepEncounter`; nothing about combat changes.
- The "slow beat on Resolution" is now possible — only one spell animates at a time.
- Pause, rewind, fast-forward, and step-through-by-spell all become trivial extensions (just gate or batch `onRequestNextEvent`).
- **Integration tests run in milliseconds instead of seconds.** The test harness either sets the Speed Multiplier to 10× or replaces `onRequestNextEvent` with a synchronous immediate-fire callback. The current 6 s integration test reduces to <100 ms.

**Negative:**

- `App.tsx` gains complexity in how it coordinates "request next event" with the React render cycle. We need a ref to track "encounter ended" so we don't keep requesting events. (Equivalent complexity to the current `setInterval` cleanup, just re-shaped.)
- The Speed Multiplier introduces a new piece of localStorage state. Migration framework already exists in `persist`; the speed key is independent so it doesn't need versioning yet.
- Glyph-cap rule is a special case. Document it inline and in `CONTEXT.md` so it doesn't drift.

## Alternatives considered

### A. Keep `setInterval`, vary `TICK_MS` based on the next event's intended animation length
Each tick decides "I'm about to render a Counterattack — make `TICK_MS = 1200`."

**Why not:** Conflates the sim's clock with the animation's timing. The sim's purity was a load-bearing decision (see `docs/adr/0001-five-bounded-contexts.md`). Letting per-event animation lengths leak back into the sim's tick rate violates the layering.

### B. Keep current overlap, just slow individual animations
Increase per-spell durations to 2–3 s; let them keep overlapping.

**Why not:** Overlap is the actual problem. Even with longer per-spell animations, the slow-mo Resolution beats land *during* the next spell's Invocation. The dramatic moments can't be felt.

### C. Pre-compute the entire encounter at submit time, then play it back as a fixed-length video
Resolve every spell up-front; the view plays a fully-determined sequence.

**Why not:** Loses the option to add "interrupt" mechanics later (e.g. a future feature where the player can spend something to skip an unresolved spell). Also makes pacing inflexible — the Speed Multiplier would have to recompute or skip frames.

### D. Web Worker for the sim, message-driven
Sim runs in a worker, posts events as it pleases, view consumes from a queue at its own pace.

**Why not:** Over-engineering for a pure deterministic state machine. Worker overhead is real; we'd gain isolation we don't need; we'd lose stack traces and test ergonomics.

## See also

- `src/view/CONTEXT.md` — Animation Phase, Speed Multiplier, Event-Driven Pacing glossary entries.
- `src/view/docs/adr/0004-five-phase-spell-animation.md` — the storyboard that this pacing model serves.
- `src/combat/docs/adr/0001-ward-frozen-during-encounter.md` — why the sim is a pure state machine to begin with.
