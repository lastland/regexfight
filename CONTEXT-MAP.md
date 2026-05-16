# Context Map — regexfight

`regexfight` is split into five bounded contexts. Each owns its own vocabulary, its own ADRs, and its own slice of the source tree. The split is documented in `docs/adr/0001-five-bounded-contexts.md`.

When you're working in one context, **its** glossary is authoritative. If a term appears in two contexts with different shades of meaning, that's a cross-context translation point — name it explicitly rather than silently aliasing.

| Context    | Location                  | Glossary                                       | ADRs                              | One-line role                                            |
|------------|---------------------------|------------------------------------------------|-----------------------------------|----------------------------------------------------------|
| `combat`   | `src/combat/`             | [`src/combat/CONTEXT.md`](src/combat/CONTEXT.md)   | `src/combat/docs/adr/`            | The puzzle/sim layer — Pattern, Ward, Spell, Phase, Encounter. |
| `run`      | `src/run/`                | [`src/run/CONTEXT.md`](src/run/CONTEXT.md)         | `src/run/docs/adr/`               | The meta-game — Run, Campaign, Score, Stats, Modifiers.  |
| `content`  | `src/content/`            | [`src/content/CONTEXT.md`](src/content/CONTEXT.md) | `src/content/docs/adr/`           | The authoring/data layer — Enemy YAML, Schemas, Pools.   |
| `persist`  | `src/persist/`            | [`src/persist/CONTEXT.md`](src/persist/CONTEXT.md) | `src/persist/docs/adr/`           | The save/load adapter — localStorage, versioning.        |
| `view`     | `src/view/`               | [`src/view/CONTEXT.md`](src/view/CONTEXT.md)       | `src/view/docs/adr/`              | The rendering layer — React screens, Canvas encounter.   |

System-wide architectural decisions live at [`docs/adr/`](docs/adr/) (e.g. the bounded-context decomposition itself, top-level import rules).

## Cross-context shared terms

A few terms cross context boundaries. Each context's glossary names *its* meaning; this table indexes the cross-cutters so authors notice when they're translating:

| Term                | Where it lives             | Where it shows up elsewhere                                 |
|---------------------|----------------------------|-------------------------------------------------------------|
| **Spell**           | `combat` (primary)         | `content` (as YAML data), `view` (as rendered chip)         |
| **Attempt**         | `combat` (encounter try)   | `run` (an element of the Run's history)                     |
| **Pattern**         | `combat`                   | `content` (validated `PatternSrc` string at load)           |
| **Run**             | `run`                      | `persist` (the serialized payload)                          |
| **HP / Attack**     | `run` (player & enemy stats) | `combat` (consumed during damage resolution)               |
| **Modifier**        | `run` (architectural slot) | reserved for the roguelike pivot; empty union in v1         |

## Adding a new context

Before adding a sixth context, justify it by an ADR at `docs/adr/`. Contexts are expensive — each one duplicates glossary upkeep, makes refactors harder, and adds boundary translation cost. New contexts are warranted when a coherent body of code develops its own distinct vocabulary that doesn't reduce to any of the five above.
