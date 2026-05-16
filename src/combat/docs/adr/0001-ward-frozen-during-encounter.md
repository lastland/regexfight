# ADR-0001 (combat): Ward is frozen during an Encounter

**Date**: 2026-05-16
**Status**: Accepted

## Context

The player's regex (the Ward) needs a clearly-defined lifecycle relative to combat:

- When can the player edit it?
- Is editing allowed mid-fight?
- Can the player iterate on the Ward while spells are arriving?

The game is positioned as soul-like with pattern-recognition puzzle mechanics. "Easily die if you didn't capture one spell" was the user's framing — implying severe per-error consequences. But the *cognitive task* (writing a regex) is not compatible with twitch reaction times.

## Decision

**The Ward is composed and submitted at the Prep Screen, then frozen for the duration of an Encounter.** Once an Attempt begins, the player cannot change the regex. Editing resumes only after the Attempt ends (in victory or defeat).

The soul-like learning loop is therefore: *die → observe more Spells in the Observation Log → return to Prep Screen → refine Ward → retry.* The cost of an error is dying; the benefit of dying is observing more samples to refine against.

## Consequences

**Positive:**

- The encounter sim becomes a pure function `(Ward, EncounterSeed, Enemy) → Outcome[]`. No mid-run mutation; fully testable with `fast-check` property tests; fully deterministic given inputs.
- The puzzle stays a *cognitive* puzzle (regex inference), not a typing-speed contest.
- The soul-like beats land: death is a learning event, the prep screen is the bonfire, retry is cheap.

**Negative:**

- Combat is *mathematically determined* the moment the player submits the Ward. The encounter playback is dramatic but not interactive — the player watches the result unfold and can't change the outcome. This is by design but should be communicated visually (pacing, animation) so the player still feels engaged.
- Players cannot "feel out" the pattern by trial and error during a single fight. They must commit before they have all the information. Mitigated by Seed Spells (pre-populated Observation Log) and the persistent observation log accumulating across deaths.

## Alternatives considered

### A. Live during combat
Player can edit the regex at any moment, including mid-spell.

**Why not:** Reduces the game to typing speed under pressure. The cognitive task is pattern inference; mixing it with twitch input is a category error. It also breaks the sim's purity — no more `(Ward, …) → outcome` function — and turns property testing into a much harder problem.

### B. Hybrid: pause-to-edit
Combat is real-time; the player can pause to edit at a cost (consumes a resource).

**Why not:** Adds a real-time pause mechanic on top of the already-complex puzzle. The cost mechanic would compete with score/HP for the player's attention. The simpler "frozen Ward + retry" achieves the same learning outcome with less UX surface.

### C. Hybrid: edit between spells
Regex locks while a spell is in-flight, unlocks briefly between spells.

**Why not:** Encourages spell-by-spell tuning rather than pattern-level reasoning. Player would learn to "catch" the next specific spell rather than infer the underlying Pattern.

## See also

- `src/combat/CONTEXT.md` — Ward, Encounter, Attempt definitions.
- `src/combat/docs/adr/0002-decoys-precision-recall.md` — the mechanic that makes a frozen Ward genuinely a puzzle.
