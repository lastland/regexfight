# ADR-0002 (content): Game data is fetched as JSON, not bundled into the JS

**Date**: 2026-05-16
**Status**: Accepted
**Supersedes (partially)**: [ADR-0001 (content)](0001-yaml-data-zod.md) — keeps YAML as the authoring format, but rescinds the implication that YAML is parsed in the browser.

## Context

ADR-0001 established that all game content lives in YAML files under `data/` and is validated with Zod. The original implementation imported each YAML file into `src/app/App.tsx` via Vite's `?raw` query suffix, baking the YAML text directly into the production JS bundle. `loadEnemyYaml` / `loadPlayerYaml` then ran `yaml.parse` and `EnemySchema.parse` in the browser at startup.

This was discovered to leak the puzzle answer key. The `data/enemies/00-java-float.yaml` content includes:

- `pattern: '...'` — the regex that defines the Real / Decoy boundary; the literal answer to the puzzle.
- `realPool: [...]` and `decoyPool: [...]` — every Spell text paired with its true class label.

A casual player opens devtools, searches the JS for `pattern:` or any pool text, and reads the answer. Combat code never actually consults `pattern` at resolution (`spell.ts:resolveSpell` works off `spell.kind`), so it served only as a build-time validation key — yet it shipped in full.

`zod` and `yaml` also occupy ~80 KB minified in the runtime bundle, even though their only runtime job was to parse content that's now known to be authored offline.

## Decision

1. **The production JS bundle holds engine code only.** No game content ever appears in `dist/assets/index-*.js`.
2. **Per YAML file, a separate JSON asset is emitted at build time.** Vite's content plugin (`vite-plugins/content.ts`) reads each YAML, projects to a runtime-shaped object, and emits to `dist/data/<path>.json`. App fetches these JSONs at startup.
3. **The `pattern` field is stripped from the emitted Enemy JSON.** It never reaches the browser via any channel — not JS, not Network. This is free because no runtime code reads `enemy.pattern`. (See the matching removal of the dead `EncounterState.pattern` field in `src/combat/types.ts`.)
4. **Validation moves to build time.** `scripts/validate-content.ts` runs `EnemySchema.parse` / `PlayerProfileSchema.parse` on every YAML and is chained into `npm run build` ahead of `vite build`. `yaml` and `zod` move to `devDependencies`.
5. **The user-facing trust boundary widens by one step.** A determined player can still open the Network tab and read the JSON — including the per-text Real/Decoy labels. The regex pattern itself never leaks. The Network-tab leak is explicitly accepted; closing it would require server-side validation, which is out of scope for a static GitHub Pages deployment.

## Consequences

**Positive.**

- The bundle no longer contains the puzzle answer key. Casual cheating via Ctrl-F on the JS is closed off.
- `yaml` and `zod` are tree-shaken out of the runtime bundle, saving ~80 KB minified / ~15 KB gzip.
- The build pipeline now fails fast on malformed content. Validation errors surface at `npm run build` time, never in production.

**Negative.**

- The plugin and the Zod schemas are two places where the YAML → runtime-shape transformation is described. The plugin's `projectEnemy` / `projectPlayer` must be kept in sync with the schemas' `.transform` and `.default` clauses. A failure to do so manifests at runtime as a missing field or a missing default, not at build time. Mitigation: keep the schemas minimal and lean on the explicit comment in `vite-plugins/content.ts`.
- The Network tab reveals pool labels; a determined cheater is undeterred.
- One more file kind in `dist/` and one more fetch on cold load.

## Alternatives considered

- **Vite-native `?url` + parse in browser.** Keeps `yaml` and `zod` in the runtime bundle. Cheaper code change but leaves the dep weight in place and still ships `pattern` (in the fetched YAML). Rejected because the user explicitly asked to drop the runtime dependency surface.
- **A community YAML-import plugin (`@modyfi/vite-plugin-yaml`, etc.).** All such plugins inline the parsed YAML *into the JS module*, which is the exact leak this ADR closes. None match the YAML→strip-pattern→emit-JSON shape.
- **Run the Zod schema inside the Vite plugin.** Would remove the schema/projection drift risk but pull `zod` into the build plugin's transitive deps (still devDep-only, but two extra files in the plugin's import closure). Kept the plugin small and put validation in a sibling script instead.
- **Server-side validation.** Closes the Network-tab leak too but requires moving off static GitHub Pages. Rejected as out of scope.
