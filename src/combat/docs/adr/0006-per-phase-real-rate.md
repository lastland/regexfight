# ADR-0006 (combat): Per-Phase Real Rate override with Enemy-level fallback

**Date**: 2026-05-16
**Status**: Accepted

## Context

Real Rate (`realRate`) — the probability that a drawn Spell is a Real (versus a Decoy) — was originally authored at the Enemy level. Optional in YAML, defaulting to `0.5`. The `combat` engine snapshotted the value into `EncounterState.realRate` once at `startEncounter()` and used it for every draw, regardless of Phase.

The constraint that Real Rate is constant across Phases turned out to fight the design of Floating Phantasm — the signature enemy themed on Java FP literal syntax:

- **Phase 1** teaches the *shape* of the Pattern with vanilla examples, signed mantissas, and lowercase exponents. The author wants a brisk *tutorial-paced* cadence here, biased toward Reals so the player sees the Pattern's positive examples rapidly. Target ~0.7.
- **Phase 2** emits exclusively edge cases — both edge-Reals (`.5`, `5.`, `5E+0`, `-1e10`) and edge-Decoys (`1.0f`, `0x1p0`, `01.0`, `-.5`). The *pedagogical* moment of Phase 2 is in the Decoys: the player's near-correct Ward Backfires on an edge-Decoy, the player sees the Decoy text in the Attempt Log, and refines their Ward for the next attempt. Maximizing edge-Decoy density per attempt argues for an even (or even Decoy-leaning) mix. Target ~0.5.

A single Enemy-wide Real Rate cannot serve both intents — anything chosen sacrifices either Phase 1 pacing or Phase 2 learning density.

The shape of the YAML already permits per-Phase tuning of other dimensions (each Phase carries its own `attack`, its own pools). The asymmetry of *not* letting Phase tune Real Rate was a v1 simplification, not a design principle.

## Decision

Add an **optional** `realRate` field to `PhaseSchema`. When present, the Phase uses that value; when absent, the Phase falls back to the Enemy-level `realRate` (which itself still defaults to `0.5`).

In the combat engine, the resolved per-Phase Real Rate is stored on each `EncounterState.phases[i].realRate` entry — a non-optional `number` set once at `startEncounter()` via `phase.realRate ?? enemy.realRate`, then never mutated. `pickSpell()` reads `state.phases[state.currentPhaseIdx].realRate` directly, so Phase advancement automatically changes the Real Rate without any explicit handler.

The top-level `EncounterState.realRate` scalar is removed (it would have been redundant and a source of "which one is the truth?" confusion).

## Alternatives considered

### Move `realRate` entirely to Phase, no Enemy-level field

Cleaner schema (one place for the field) but breaks the *content authoring ergonomic* of "set one rate and inherit". Most enemies don't need per-Phase variation — forcing them to repeat the same value on every Phase is noise that fights the author's intent. Rejected.

### Keep `realRate` at the Enemy level only; add a separate `realRateMultiplier` per Phase

Avoids the schema change but introduces a *new* concept (multiplier) the author has to reason about, and produces awkward arithmetic (`0.5 × 1.4 = 0.7`). Worse expressiveness for a contrived saving. Rejected.

### Compute Phase-specific rates from `(realPool.length, decoyPool.length)`

Tempting: bigger Real pool → higher Real Rate. But this couples *kind distribution* (a pacing knob) to *pool size* (a content-variety knob), and forces the author to pad pools with duplicates to tune pacing. Rejected.

## Consequences

- Per-Phase Real Rate is now authorable. Floating Phantasm uses `0.7` / `0.5` across its two Phases.
- `EncounterState` shape changes: per-Phase `realRate: number` is added; the top-level `realRate` scalar is gone. The combat sim is the only consumer; one call-site in `pickSpell()` reads it.
- The schema and engine retain *backwards compatibility for authoring*: Enemy YAMLs that don't author per-Phase rates work exactly as before.
- `baseHp` tuning becomes Phase-aware. The previous rule-of-thumb (`baseHp ≈ targetTicks × realRate × playerAttack`) is replaced with a weighted-by-phase version. The `combat/CONTEXT.md` "Real Rate" entry documents the new shape.
- Future ADRs that introduce more Phase-scoped knobs (per-Phase pool size cap, per-Phase Ward-edit penalty, etc.) follow the same override-with-fallback pattern.
