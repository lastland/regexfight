# regexfight

A soul-like, browser-only puzzle game where combat is mediated by regular expressions.

Each enemy hides a **Pattern** (a regex). During an encounter the enemy emits a stream of strings — **Real spells** (matching the Pattern) interleaved with **Decoys** (not matching it). Your job is to write a **Ward** (your own regex) that *catches every Real spell* and *rejects every Decoy*. The Ward is frozen during combat. Die, observe more spells, refine the Ward, retry.

## Run it

```bash
npm install
npm run dev          # starts Vite at http://localhost:5173
```

Open the URL the dev server prints. You'll land on the Prep Screen for the tutorial enemy.

### Other useful commands

```bash
npm run build        # tsc -b && vite build  →  dist/
npm run preview      # serve the built dist/ for verification
npm run typecheck    # tsc --noEmit (strict, with exactOptionalPropertyTypes)
npm test             # vitest run — 46 tests across 6 files
npm run test:watch   # vitest in watch mode
```

## How to play (v1)

1. **Prep Screen.** The Observation Log shows a few seed spells with their Kind (green = Real, red = Decoy). Type a regex into the Ward editor. Anchors matter — the engine uses plain `RegExp.prototype.test()`, so a Ward like `/dragon\d+/` will match the decoy `Xdragon42Y`. Use `^...$` if you mean end-to-end. The `i` flag toggle is supported; other flags are not.
2. **Start encounter.** Combat plays out automatically — spells fly across the canvas, your HP drops on Hits and FalseCaptures, the enemy's HP drops on Captures. The Ward cannot be edited during combat.
3. **Post-mortem.** You see every spell you faced this attempt, grouped by Outcome (Capture / Hit / False Capture / Dodge) and what it cost. Retry (always available) or Advance (only on Victory).
4. **Repeat.** Spells you've seen accumulate in the Observation Log across deaths. Use them to infer the underlying Pattern. The tutorial enemy has two phases — later phases reveal *distinguishing edge cases* designed to expose almost-right Wards.

There is **no live test bench in v1** — only dying teaches. The WardEditor reserves a slot for it; see [`src/view/docs/adr/0001-test-bench-deferred.md`](src/view/docs/adr/0001-test-bench-deferred.md) for why.

Your progress is saved automatically to `localStorage` under `regexfight:save:v1`. Clear it from devtools to start over.

## Tutorial pattern (spoiler)

<details>
<summary>The first enemy's Pattern</summary>

`^[a-z]+\d{2,3}$` — one or more lowercase letters, then 2 or 3 digits, anchored.

Phase 1 sample is intentionally ambiguous between several almost-right Wards. Phase 2 throws the distinguishing edge cases (`cat1`, `cat1234`, `Cat12`, `cat_12`). If you nail the right shape in Phase 1, you'll sail through Phase 2; if you guessed too loose, you'll die there and learn.

</details>

## Where things live

The codebase is split into **five bounded contexts**. Start here:

- [`CONTEXT-MAP.md`](CONTEXT-MAP.md) — top-level index, cross-context shared terms.
- [`docs/adr/`](docs/adr/) — system-wide architectural decisions (bounded contexts, frontend stack).
- [`src/combat/`](src/combat/) — the puzzle/sim: `Pattern`, `Ward`, `Spell`, `Phase`, `Encounter`. Pure TS; no React or DOM.
- [`src/run/`](src/run/) — the meta-game: `Run`, `Score`, `Modifier` (reserved for the future roguelike pivot).
- [`src/content/`](src/content/) — Zod schemas + YAML loaders + the tutorial enemy. Authoring boundary.
- [`src/persist/`](src/persist/) — localStorage adapter with schema versioning + migration framework.
- [`src/view/`](src/view/) — React screens (Prep / Encounter / Post-mortem), the WardEditor, and the Canvas-rendered encounter scene.
- [`src/app/`](src/app/) — composition root that wires the four contexts together.

Each context has its own `CONTEXT.md` (glossary) and `docs/adr/` (decisions). The plan that produced all of this lives in `~/.claude/plans/i-want-to-design-drifting-origami.md`.

## Adding an enemy

1. Author `data/enemies/NN-name.yaml`. Pattern (a regex string), `baseHp`, `defeatBounty`, `flawlessBonus`, `seedSpells`, and one or more `phases` with `realPool` + `decoyPool` per phase. The schema validates that every Real-pool entry matches the Pattern, every Decoy-pool entry doesn't, and that Seed Spells appear in the Phase-1 pool with the right Kind.
2. Wire it into the campaign roster in [`src/app/App.tsx`](src/app/App.tsx) (the boot sequence currently loads `00-tutorial.yaml`; add yours alongside).
3. Tune `baseHp` to the **Real-spell rate**, not the total spell rate — only Captures damage the enemy (the counterattack-only model). With a ~50/50 mix, expected ticks-to-win is roughly `2 × baseHp / player.attack`.

See [`src/content/CONTEXT.md`](src/content/CONTEXT.md) for the full authoring discipline.

## Stack

TypeScript (strict) · Vite · React 18 · Tailwind 3 · Zod · `yaml` · Vitest · `fast-check` · happy-dom

The choices and trade-offs are in [`docs/adr/0002-frontend-stack.md`](docs/adr/0002-frontend-stack.md).

## v1 scope and what's deferred

**In v1:** one enemy, full prep → encounter → post-mortem loop, persistent observation log, color-coded Kinds, deterministic seeded encounter sim, basic Canvas spell animation.

**Deferred (architectural slots reserved):** live test bench in the Prep Screen, roguelike progression (`Modifier` union is empty in v1; the stat resolver already routes through it), additional enemies, audio, accessibility polish, mobile layout. The visual layer is intentionally minimal pending a `/frontend-design:frontend-design` polish pass.
