# ADR-0004 (combat): Multi-phase Enemies share one Pattern; later phases reveal distinguishing edge cases

**Date**: 2026-05-16
**Status**: Accepted

## Context

Soul-like fights typically have phases — the boss changes behavior as it loses HP. A naive port to this game would be "each phase has its own Pattern, and the player must rewrite the Ward to handle the new one." But the Ward is *frozen* during an Encounter (ADR-0001), so phase-distinct Patterns would either:

- Require unfreezing the Ward mid-fight (contradicts ADR-0001), or
- Force the player to write a Ward that handles a union of unknown patterns simultaneously (cognitively unfair when only Phase 1 is observable).

Neither option is acceptable. But phases-as-a-mechanic is too good to discard — the user explicitly wants them.

The user proposed an elegant resolution: *the Pattern stays the same across all Phases; what changes is the **sample** the player observes.* Phase 2 emits Spells from the same Pattern's language as Phase 1, but the Spells are chosen to be **distinguishing edge cases** — strings that test whether the Ward fits the *shape* of the Pattern rather than just the easy examples it saw first.

## Decision

**Each Enemy owns exactly one Pattern, shared across all its Phases.**

**Each Enemy has an ordered list of Phases. Each Phase carries:**

- Its own `realPool` (strings *matching* the Pattern, drawn from a distinct slice of the Pattern's language).
- Its own `decoyPool` (strings *not matching* the Pattern, designed to fool a *plausibly-wrong* Ward).
- Its own `attack` value, typically higher than earlier Phases.
- An `hpThreshold` at which this Phase begins.

**The Ward stays frozen across phase transitions.** Even when the Enemy transforms, the Player's regex is unchanged. The user re-confirmed this explicitly: "they will be using the same pattern, just more edge cases."

**Design philosophy for content authors:**

- Phase 1 pool is *under-specified*: several almost-right Wards would pass Phase 1.
- Phase 2 pool contains the *distinguishing edge cases* that separate the true Pattern from the most common almost-right approximations.
- Phase 3 (if present) adds yet finer edge cases.
- A player with a perfectly correct Ward sails through every Phase. A player with a Phase-1-sufficient Ward dies in Phase 2, learning exactly what edge case they missed.

This is the **active learning** setting from program synthesis: each Phase is a teacher that picks examples designed to disambiguate the learner's current hypothesis.

## Consequences

**Positive:**

- The Ward-frozen constraint and the phase mechanic coexist with no contradiction.
- The soul-like surprise lands: "I thought I solved it" → Phase 2 starts → "oh, I missed the edge case." That's a perfect death beat.
- Re-reuses the existing combat sim: Phases are just pool switches at HP thresholds. No new types of computation.
- Authors with regex-design instinct will find the "what's the distinguishing edge case?" question fun. Anti-pattern: it's *not* "what's a harder pattern?" — it's "what's the strings that distinguish the right Pattern from the most common wrong guesses?"

**Negative:**

- Authoring multi-phase Enemies is harder than authoring single-phase ones. The author must internalize what the *plausibly-wrong* Wards are and design Decoy + Real strings around them. This is a real content-design skill; v1's single Enemy is partly a vehicle for learning what authoring rhythms work.
- Architectural risk: an Enemy with a single Phase is just a degenerate case. The code path "advance phase on HP threshold" must handle the trivial 1-Phase case correctly. Verified by a property test: 1-Phase Encounter never emits `PhaseAdvanced`.
- The "edge case escalation" content rule is unenforced by code. A lazy author could put trivially-easy spells in Phase 3; nothing would break. The discipline is documented in `src/content/CONTEXT.md` under Authoring Discipline.

## Alternatives considered

### A. Each Phase has its own Pattern
Different regex per Phase. Player must adapt mid-fight.

**Why not:** Contradicts ADR-0001 (Ward frozen). Player has no way to handle multiple Patterns with a single regex unless the union happens to be expressible — which is fragile and arbitrary.

### B. Single-phase Enemies only
Drop phases from the design.

**Why not:** Loses a strong soul-like beat. The user explicitly wanted multi-phase with the same-pattern constraint. The active-learning mechanic is too good to give up.

### C. Phases change non-Pattern things (e.g. spell rate, music, visual style) but the pool stays the same
Cosmetic phases.

**Why not:** Doesn't actually challenge the player to refine their Ward. A Phase-1-sufficient Ward would beat the whole Encounter.

### D. Phases unlock by Attempt count, not HP
Each retry advances to a new pool ("you've earned the next sample").

**Why not:** Decouples Phases from the dramatic structure of the fight. The user's design intent is that phases *happen during the fight*, not between fights.

## See also

- `src/combat/CONTEXT.md` — Phase, Encounter definitions.
- `src/combat/docs/adr/0001-ward-frozen-during-encounter.md` — the constraint this ADR's design is reconciled with.
- `src/content/CONTEXT.md` — Authoring Discipline section, where the edge-case escalation rule lives for content designers.
