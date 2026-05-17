# regexfight

A soul-like, browser-only puzzle game where combat is mediated by regular expressions.

Each enemy hides a **Pattern** (a regex). During an encounter the enemy emits a stream of strings — **Real spells** (matching the Pattern) interleaved with **Decoys** (not matching it). Your job is to write a **Ward** (your own regex) that *catches every Real spell* and *rejects every Decoy*. The Ward is frozen during combat. Die, observe more spells, refine the Ward, retry.

## Run it

```bash
npm install
npm run dev          # starts Vite at http://localhost:5173
```

Open the URL the dev server prints. You'll land on the Prep Screen for the **Floating Phantasm** — the signature enemy themed on Java floating-point literal syntax.

### Other useful commands

```bash
npm run build        # tsc -b && vite build  →  dist/
npm run preview      # serve the built dist/ for verification
npm run typecheck    # tsc --noEmit (strict, with exactOptionalPropertyTypes)
npm run lint         # eslint . (typescript-eslint strictTypeChecked)
npm test             # vitest run — 151 tests across 18 files
npm run test:watch   # vitest in watch mode
```

## Continuous integration

GitHub Actions runs typecheck + lint + tests (with coverage) + build on every PR
to `main` and every push to `main`. See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).
The four scripts above are the local equivalents.

Node version is pinned in [`.nvmrc`](.nvmrc) (also surfaced via `engines.node`
in `package.json`). CI reads the same file via `actions/setup-node`'s
`node-version-file`, so dev and CI never drift.

## How to play (v1)

1. **Prep Screen.** Before your first fight against an Enemy, the section is labelled **Foresight (clairvoyance)** — you glimpse a few seed spells with their Kind (green = Real, red = Decoy). After your first resolved Attempt against that Enemy, the section becomes the persistent **Observation Log** of everything you've seen so far. Type a regex into the Ward editor; the engine matches it end-to-end (`^(?:your-source)$`), so you can just write the body. The `i` flag toggle is supported; other flags are not. See the **Supported syntax** disclosure under the Ward editor for the curated v1 feature set.
2. **Start encounter.** Combat plays out automatically — spells fly across the canvas, your HP drops on Hits and Backfires, the enemy's HP drops on Counterattacks. The Ward cannot be edited during combat.
3. **Post-mortem.** You see every spell you faced this attempt, grouped by Outcome (Counterattack / Hit / Backfire / Dodge) and what it cost. Retry (always available) or Advance (only on Victory).
4. **Repeat.** Spells you've seen accumulate in the Observation Log across deaths. Use them to infer the underlying Pattern. The Floating Phantasm has two phases — Phase 1 broadens you across the basic shape, and Phase 2 emits exclusively *edge cases* designed to expose almost-right Wards.

There is **no live test bench in v1** — only dying teaches. The WardEditor reserves a slot for it; see [`src/view/docs/adr/0001-test-bench-deferred.md`](src/view/docs/adr/0001-test-bench-deferred.md) for why.

Your progress is saved automatically to `localStorage` under `regexfight:save:v1`. Clear it from devtools to start over.

## Floating Phantasm pattern (spoiler)

<details>
<summary>The signature enemy's Pattern</summary>

`^([+-]?(0|[1-9]\d*)\.\d*|\.\d+|[+-]?(0|[1-9]\d*)(?=[eE]))([eE][+-]?\d+)?$` — a stylistic subset of Java floating-point literal syntax: decimal-only (no hex), optional leading sign, optional `e`/`E` exponent with optional sign on the exponent, **no `f`/`F`/`d`/`D` type suffix**, **no underscore digit separators**, **no leading-zero integer parts** (`01.0` is rejected), and **a sign requires a digit before the decimal point** (`-.5` and `+.5` are rejected; bare `.5` is accepted).

Phase 1 broadens the shape with vanilla decimals, signed mantissas (`-1.0`, `+3.14`), and lowercase exponents (`1e10`, `2.5e3`). Phase 2 emits exclusively edge cases: the leading-dot Reals (`.5`, `5.`, `.5e10`), uppercase-`E` exponents (`5E+0`), and the Decoys that look-like-but-aren't (`1`, `.`, `1.5e`, `1.0f`, `0x1p0`, `1_000.5`, `++1.0`, `1.5.6`, `NaN`, `01.0`, `-.5`).

If you nail the right shape in Phase 1, you'll sail through Phase 2; if you guessed too loose, you'll Backfire your way to instruction.

</details>

## Where things live

The codebase is split into **five bounded contexts**. Start here:

- [`CONTEXT-MAP.md`](CONTEXT-MAP.md) — top-level index, cross-context shared terms.
- [`docs/adr/`](docs/adr/) — system-wide architectural decisions (bounded contexts, frontend stack).
- [`src/combat/`](src/combat/) — the puzzle/sim: `Pattern`, `Ward`, `Spell`, `Phase`, `Encounter`. Pure TS; no React or DOM.
- [`src/run/`](src/run/) — the meta-game: `Run`, `Score`, `Modifier` (reserved for the future roguelike pivot).
- [`src/content/`](src/content/) — Zod schemas + YAML loaders + the Floating Phantasm enemy. Authoring boundary.
- [`src/persist/`](src/persist/) — localStorage adapter with schema versioning + migration framework.
- [`src/view/`](src/view/) — React screens (Prep / Encounter / Post-mortem), the WardEditor, and the Canvas-rendered encounter scene.
- [`src/app/`](src/app/) — composition root that wires the five contexts together.

Each context has its own `CONTEXT.md` (glossary) and `docs/adr/` (decisions). The plan that produced all of this lives in `~/.claude/plans/i-want-to-design-drifting-origami.md`.

## Adding an enemy

1. Author `data/enemies/NN-name.yaml`. Pattern (a regex string), `baseHp`, `defeatBounty`, `flawlessBonus`, `seedSpells`, and one or more `phases` with `realPool` + `decoyPool` per phase. Each phase may also carry an optional `realRate` override (see [`src/combat/docs/adr/0006-per-phase-real-rate.md`](src/combat/docs/adr/0006-per-phase-real-rate.md)); when omitted it falls back to the enemy-level `realRate`, which itself defaults to `0.5`. The schema validates that every Real-pool entry matches the Pattern, every Decoy-pool entry doesn't, and that Seed Spells appear in the Phase-1 pool with the right Kind.
2. Wire it into the campaign roster in [`src/app/App.tsx`](src/app/App.tsx) (the boot sequence currently loads `00-java-float.yaml`; add yours alongside).
3. Tune `baseHp` to the **Real-spell rate**, not the total spell rate — only Counterattacks damage the enemy (the counterattack-only model). With a ~50/50 mix, expected ticks-to-win is roughly `2 × baseHp / player.attack`.

See [`src/content/CONTEXT.md`](src/content/CONTEXT.md) for the full authoring discipline.

## Stack

TypeScript (strict) · Vite · React 18 · Tailwind 3 · Zod · `yaml` · Vitest · `fast-check` · happy-dom

The choices and trade-offs are in [`docs/adr/0002-frontend-stack.md`](docs/adr/0002-frontend-stack.md).

## v1 scope and what's deferred

**In v1:** one enemy, full prep → encounter → post-mortem loop, persistent observation log, color-coded Kinds, deterministic seeded encounter sim, Canvas spell animation with sprite-based actors, screen shake, damage numbers, flash overlay, and HP-bar tween (v1.1 polish pass).

**Deferred (architectural slots reserved):** live test bench in the Prep Screen, roguelike progression (`Modifier` union is empty in v1; the stat resolver already routes through it), additional enemies, audio, accessibility polish, mobile layout.
