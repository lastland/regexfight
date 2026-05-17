# ADR-0001 (content): All game data in YAML, validated with Zod

**Date**: 2026-05-16
**Status**: Accepted

## Context

The game's content — Enemies, Patterns, Phase Pools, stats, Seed Spells — could live in TypeScript modules (typed at compile time, ergonomic for the developer) or in external data files (typed at load time via validation, ergonomic for the designer audience).

User's explicit requirement: *"All the data should be in yaml or other static files that are easily configurable."*

This is a real design choice with downstream consequences:

- TS modules give compile-time type safety and IDE autocomplete on every field, but require recompilation to change content and embed regex literals as syntax (`/^[a-z]+\d{2,3}$/`).
- External data files require a runtime validation layer (the *schema*), but enable non-developers to author content and decouple content cycles from code cycles.

The user picked external data files. The remaining decision is *how* to bridge the on-disk shape to the typed runtime model without drift.

## Decision

**All game content lives in YAML files under `data/`.**

```
data/
├── enemies/
│   └── 00-java-float.yaml    # one file per Enemy
└── player.yaml               # base Player stats (HP, Attack)
```

**Zod is the single source of truth for the typed domain model.** Every Schema is defined as a `z.object({...})`; the corresponding TypeScript type is *derived*:

```ts
const EnemySchema = z.object({ /* ... */ });
type Enemy = z.infer<typeof EnemySchema>;
```

This means the schema and the type cannot drift — they are the same artifact viewed from runtime and compile-time respectively.

**Load pipeline (per file):**

1. Read raw YAML string from disk (Vite static import).
2. Parse to `unknown` via the `yaml` library.
3. Run the appropriate Zod Schema's `.parse()`. On failure, throw with the structured error.
4. Hand the typed value to consumers.

**Regex patterns are YAML strings**, validated by a Zod refinement that attempts `new RegExp(s)`:

```ts
const PatternSrc = z.string().refine(
  (s) => { try { new RegExp(s); return true; } catch { return false; } },
  { message: "invalid regex" }
);
```

Invalid patterns abort content load with a precise authoring error.

**Cross-field constraints are enforced in the schema**, not at consumer code. Example: each Seed Spell's `text` must appear in the corresponding Phase 1 Pool. This is a `.refine()` at the Enemy level.

## Consequences

**Positive:**

- Non-code content cycles. Changing an Enemy's spells doesn't require a code commit; it doesn't even require a build (Vite serves YAML in dev with HMR).
- The Schema is the live documentation of the data shape. Authors editing YAML get precise errors pointing at the offending field; they don't have to read TS types.
- Cross-context use is type-safe: `Enemy` (the `z.infer`'d type) flows through `run` and `combat` with full TS coverage downstream.
- The validation layer doubles as authoring discipline enforcement (e.g. seed spells must be subset of phase 1 pool — a real authoring mistake to catch).

**Negative:**

- YAML regex authoring is finicky. Backslashes need escaping (`pattern: "^\\d+$"`) or block scalars. Mitigation: Zod's regex refinement gives a precise error message at load time pointing to the offending field.
- Compile-time changes to schemas don't auto-detect content drift. If a Schema gains a required field, existing YAML files become invalid only at runtime, not at compile time. Mitigation: load all content at build time via a build-time script that aborts the build on validation failure. (v1: load eagerly at startup; later: pre-validate at build.)
- Bundle size: the YAML library + Zod ship with the app. A few extra kilobytes; not a blocker.

## Alternatives considered

### A. TS modules with hand-typed Enemy objects
Each Enemy is a `.ts` file exporting `{ pattern: /^[a-z]+\d{2,3}$/, ... }` with full TS coverage.

**Why not:** User explicitly required configurable static files. Loses content-iteration speed; recompile-per-edit is painful.

### B. JSON files (no YAML)
Easier syntactic safety (no significant whitespace, simpler escaping), but worse human-authoring ergonomics (no comments, more punctuation, longer files).

**Why not:** YAML is materially nicer for human authoring of content with comments, structured nesting, and multi-line strings. The escaping pain is real but bounded (mainly affects regex patterns).

### C. Hand-written type guards (no Zod)
Write `function isEnemy(x: unknown): x is Enemy { … }` by hand for each type.

**Why not:** Drift risk is the whole reason we're using a schema library. Hand-rolling validation duplicates effort across the type definition and the validator, and they tend to diverge under refactoring.

### D. JSON Schema + `json-schema-to-ts` codegen
Standards-based; types generated from schemas via a codegen step.

**Why not:** Adds a codegen step to the build, splits the source of truth into a schema file *and* a generated type file, and worsens DX compared to Zod's inline `z.infer`. Zod's developer ergonomics in TS-first projects are materially better.

### E. Valibot
Same shape as Zod, smaller bundle, more modular.

**Why not:** Genuinely competitive — would also be a good choice. Picked Zod because of ecosystem maturity, error-message quality, and the user explicitly confirmed it as the recommended choice. Switching costs are low if Valibot's bundle-size advantage becomes important.

## See also

- `src/content/CONTEXT.md` — Schema, Validation, authoring discipline.
- `docs/adr/0001-five-bounded-contexts.md` — why `content` is its own context.
- `~/.claude/plans/i-want-to-design-drifting-origami.md` — full design plan, including the example Enemy YAML.
