# ADR-0002: Frontend stack — Vite + React + TypeScript + Tailwind + Canvas-hybrid + Vitest

**Date**: 2026-05-16
**Status**: Accepted

## Context

`regexfight` is a pure-frontend game. The technology choices need to satisfy:

- **Type-driven development.** User explicitly required TypeScript and types-first design.
- **Testable core sim** independent of the rendering layer (user's "separate functionality from graphics" requirement).
- **Retro pixel aesthetic** with sharp pixel-grid rendering on high-DPI displays.
- **Form-heavy menus** (Prep Screen, Post-mortem Screen) and **animation-heavy combat** (Encounter Screen with many concurrent on-screen Spells).
- **Alignment with `/frontend-design:frontend-design`** for later UI/UX validation, which assumes a modern web stack centered on React + Tailwind + shadcn/ui.

A single stack must serve all of these. The choice is not just framework — bundler, language, CSS solution, render target, and test runner all need to compose.

## Decision

The full stack is locked as:

| Layer            | Choice                                       |
|------------------|----------------------------------------------|
| Language         | **TypeScript** (`strict: true`)              |
| Bundler          | **Vite**                                     |
| Framework        | **React**                                    |
| CSS              | **Tailwind**                                 |
| Render target    | **Hybrid**: DOM + CSS for menus; Canvas 2D for the Encounter scene |
| Data parser      | **`yaml`** library (loaded via Vite's built-in YAML support or a plugin) |
| Schema/types     | **Zod** (covered separately by `src/content/docs/adr/0001-yaml-data-zod.md`) |
| Test runner      | **Vitest**                                   |
| Property tests   | **`fast-check`**                             |
| UI tests         | **React Testing Library** (optional, not required for v1) |
| E2E tests        | None in v1                                   |

**Build order discipline** (per `~/.claude/CLAUDE.md`): a minimal hello-world end-to-end scaffold is compiled and verified to render before any domain code is written. This catches toolchain quirks (Vite config, Tailwind setup, YAML plugin, TS strict mode interactions) cheaply against ~30 lines of code rather than against several hundred.

## Consequences

**Positive:**

- **TypeScript + strict** catches type errors at compile time. With Zod-derived types for the data layer, the entire game's types are inferred from one source per concept.
- **Vite** gives fast HMR for development, native YAML loader support, native Vitest integration, and modern ES output.
- **React + Tailwind** is the dominant idiom for modern frontend tooling. Future use of `/frontend-design:frontend-design` and shadcn/ui components is straightforward.
- **Canvas for the Encounter** handles many concurrent animated Spells smoothly. The Canvas is wrapped in a single React component that owns its `<canvas>` ref and animation loop, isolating Canvas's imperative API from the rest of React.
- **Hybrid render** — DOM for forms, Canvas for animation — is a standard pattern for retro web games and aligns DOM/Canvas to their natural strengths.
- **Vitest + fast-check** lets the `combat` context be property-tested without React. Determinism, score additivity, phase invariants, and damage symmetry are all expressible as fast-check properties.

**Negative:**

- **Bundle weight.** React + Tailwind + Zod + `yaml` is heavier than a hand-rolled solution. Mitigation: target audience is desktop browsers; first-paint perf is not a primary concern for an indie puzzle game.
- **Canvas + React boundary** is a real interface to manage. A naive integration re-renders React tree on every Canvas frame, causing jank. The mitigation is to keep Canvas in a single component that subscribes to a state stream and never re-renders itself on frame ticks — only on logical transitions (phase change, encounter end).
- **Multiple test paradigms.** Property tests (`fast-check`) and example tests (Vitest) both live in the same suite; developers must know when to reach for which.

## Alternatives considered

### A. Solid + TypeScript instead of React
React-like API, lighter runtime, fine-grained reactivity. Bundle and HMR are also smaller/faster.

**Why not:** Loses alignment with `/frontend-design:frontend-design` and the shadcn/ui ecosystem, both of which assume React. Solid is a fine choice for projects that don't need that alignment; this project does.

### B. Svelte + TypeScript
Minimal runtime, distinctive component syntax, compiled away. Lightest of the framework options.

**Why not:** Same alignment cost as Solid, plus a more idiosyncratic component model that doesn't map onto React idioms when reading `/frontend-design` output.

### C. Plain TypeScript + DOM (no framework)
Smallest dependency tree; hand-rolled reactivity.

**Why not:** Loses framework alignment with the UI tooling. Form-heavy screens become much more work to compose. Possible if the game stayed very small; v1 has three Screens with non-trivial state already.

### D. Pure Canvas (no DOM for any screen)
All three Screens (Prep, Encounter, Post-mortem) drawn on Canvas. Truest "pixel game" feel.

**Why not:** Form input (the Ward editor in particular) on Canvas requires re-implementing the text-input event model. Hostile to keyboard input, accessibility, copy/paste, and inline error display. The retro pixel aesthetic can be achieved with DOM + `image-rendering: pixelated` plus pixel-tuned Tailwind tokens.

### E. Pure DOM (no Canvas anywhere)
CSS animations for spells, `image-rendering: pixelated` throughout.

**Why not:** CSS animations are fine for a few concurrent transitions, but the Encounter Screen will have many Spells animating concurrently with arrival, hit-flash, and dismissal effects. Canvas's imperative model handles this load better. The Encounter is the only place this matters; hence the hybrid.

### F. Webpack instead of Vite
Mature, lots of plugins.

**Why not:** Vite is faster, simpler to configure, and the de facto standard in 2026 for TypeScript-first projects. Webpack's plugin breadth doesn't compensate for its DX cost on a small project.

### G. Jest instead of Vitest
Older test runner, large ecosystem.

**Why not:** Vitest is Vite-native (same TS transform pipeline, faster start), has equivalent API surface, and runs Vitest UI as a sidecar. Jest is mostly legacy at this point for new TypeScript projects.

## See also

- `~/.claude/plans/i-want-to-design-drifting-origami.md` — full design plan with stack rationale.
- `src/content/docs/adr/0001-yaml-data-zod.md` — the data-layer half of the stack.
- `docs/adr/0001-five-bounded-contexts.md` — the architectural shape this stack populates.
- `src/view/CONTEXT.md` — Render Boundary, Encounter Canvas definitions.
