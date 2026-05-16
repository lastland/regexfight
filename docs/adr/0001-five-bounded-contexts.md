# ADR-0001: Five bounded contexts and the import direction rule

**Date**: 2026-05-16
**Status**: Accepted

## Context

`regexfight` has competing requirements that make a single-blob `src/` painful:

- The user explicitly required "clearly separate key functionalities from graphics so that I can test them separately." The combat sim must be unit-testable without instantiating React or a DOM.
- The architecture must accommodate a roguelike pivot — items, modifiers, stat upgrades — without rewriting the combat sim.
- Game content is authored in YAML by a designer audience whose vocabulary (`Spell Pool`, `Phase Pool`, `Authoring Discipline`) differs from the runtime sim's vocabulary (`Encounter`, `Outcome`).
- Persistence shape (`Save Slot`, `Schema Version`, `Migration`) is a third vocabulary again, owned by the localStorage adapter.
- The view layer (`Screen`, `Encounter Canvas`, `Render Boundary`) is a fourth.

Each of these has its own audience and its own ubiquitous language. Mixing them into a single namespace causes vocabulary drift — `Spell` means subtly different things in `content/` (an authored string) and `combat/` (a runtime value with a Kind tag). A bounded-context split makes these distinctions explicit and forces translation points to be named.

## Decision

The source tree is split into **five bounded contexts**, each with its own `CONTEXT.md` and its own `docs/adr/` directory:

| Context    | Location         | Owns                                                       |
|------------|------------------|------------------------------------------------------------|
| `combat`   | `src/combat/`    | The puzzle/sim: Pattern, Ward, Spell, Phase, Encounter.    |
| `run`      | `src/run/`       | The meta-game: Run, Campaign, Score, Stats, Modifiers.     |
| `content`  | `src/content/`   | Authoring/data: Enemy YAML, Schemas, Pools.                |
| `persist`  | `src/persist/`   | Save/load: localStorage adapter, versioning, migration.    |
| `view`     | `src/view/`      | Rendering: React Screens, Encounter Canvas.                |

A `CONTEXT-MAP.md` at the repo root indexes all five and surfaces the cross-context shared terms.

Top-level wiring (the `app/` directory) is *not* a context — it is the composition root, allowed to import from any of the five.

### Import direction rule

To enforce the testability requirement, imports flow in one direction:

```
view  ── depends on ──>  combat, run
persist ── depends on ──>  run, content
content ── depends on ──>  combat, run    (for types only)
combat  ── depends on ──>  run           (for HP, Attack, Score types)
run     ── depends on ──>  (nothing)
```

- `combat` MAY import types from `run` (HP, Attack, Score) but never the reverse.
- `view` MAY import from `combat` and `run` but never from `persist` or `content` directly (data reaches `view` through `app`).
- `persist` MAY import from `run` and `content` but never from `combat` or `view`.
- No context may import from `view`.

These rules are enforced mechanically with `eslint-plugin-boundaries` or `import/no-restricted-paths`. Violations break the build.

## Consequences

**Positive:**

- The combat sim is testable with zero React, zero DOM, zero YAML parsing. Property tests against `combat` exercise the puzzle math directly.
- A roguelike modifier addition is a `run` change (new modifier types, new modifier-aware stat resolution) plus a `content` change (new YAML schema fields for items). `combat` is *untouched*.
- Adding a new content format (e.g. JSON) requires changes only in `content`. Adding a new persistence backend (e.g. IndexedDB) requires changes only in `persist`.
- Vocabulary drift is detected at the boundary. A term that means two things in two contexts is a cross-context translation point — `CONTEXT-MAP.md` names them explicitly.

**Negative:**

- Five `CONTEXT.md` files to keep in sync. Glossary maintenance cost is real.
- New developers (or AI agents) must learn five vocabularies, not one.
- Refactors that cross a boundary are heavier: renaming a `Spell` field touches `combat`, `content` (Zod schema), `run` (Observation Log), `view` (chip rendering), and `persist` (serialized payload).
- For a project as small as v1, this is overkill. The justification is that the roguelike pivot and multi-Enemy authoring expand the surface enough that the structure pays off, even if v1 alone wouldn't need it.

## Alternatives considered

### A. Single-context layout
One `CONTEXT.md` at the root, one `docs/adr/` tree, layered src/ directories with no per-layer glossaries.

**Why not:** A previous iteration of this plan recommended single-context as "more honest for v1." User explicitly overrode in favor of multi-context. The roguelike pivot is going to introduce a new audience (item designers) whose vocabulary truly differs from combat's, and pre-establishing the bounded-context discipline is cheaper than introducing it under pressure later.

### B. Three contexts (combat / run / content), with persist + view as infrastructure
Five-minus-two. Persist and view "speak the language of the contexts they serve" rather than having their own.

**Why not:** User chose the five-context split explicitly. The argument for it: persist *does* have its own jargon (Schema Version, Migration, Save Slot) that doesn't appear elsewhere, and view *does* (Screen, Encounter Canvas, Render Boundary). Maximum separation up front is cheap when the contexts are empty.

### C. Per-feature vertical slices (e.g. `src/features/encounter/`, `src/features/prep/`)
Components, logic, and data co-located by user-facing feature.

**Why not:** Inverts the testability requirement. Vertical slices encourage feature-local mixing of logic and view, which the user explicitly rejected. The encounter "feature" would import React; combat-only tests would no longer compile in isolation.

## See also

- `CONTEXT-MAP.md` — the live index of the five contexts and their cross-cutting terms.
- `~/.claude/plans/i-want-to-design-drifting-origami.md` — the design plan that this ADR codifies a fragment of.
