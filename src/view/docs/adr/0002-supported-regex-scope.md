# ADR-0002 (view): Document the supported regex scope; do not enforce it

**Date**: 2026-05-16
**Status**: Accepted

## Context

ADR-0003 (combat) — as amended — has the engine full-match the Ward end-to-end. With that change, the player no longer needs to learn anchors as a survival skill; the surface area we *do* want them learning is the curated set of core regex features (character classes, repetitions, `\d`/`\w`/`\s`, alternation, grouping). The question for the view layer is whether to *enforce* that subset (parse-and-reject features outside it) or just *document* it.

## Decision

**Document only.** The `WardEditor` continues to accept any JS regex that `new RegExp(...)` compiles. Beside the input we render a static **Supported syntax** disclosure listing the curated subset and a one-line note that other JS regex features (lookahead/behind, backreferences, named groups, Unicode property escapes) are out of scope for v1.

The curated subset:

- Literal characters (`abc`).
- `.` — any single character.
- `[abc]`, `[^abc]`, `[a-z]` — character class, negated class, range.
- `\d` / `\D`, `\w` / `\W`, `\s` / `\S`.
- `?`, `*`, `+`, `{n}`, `{n,}`, `{n,m}` — repetitions.
- `(...)` and `(?:...)` — groups (capture has no mechanics).
- `|` — alternation.
- `\` to escape metacharacters.
- The `i` flag (toggled in the editor).

`^` and `$` are accepted but unnecessary, since the engine anchors.

## Consequences

**Positive.**

- Lower-risk change: no token scanner to write, no false-positive risk on edge cases (Unicode escapes, regex-source quirks).
- Players who *want* to experiment with `(?=...)` etc. aren't blocked; the cheat sheet just doesn't teach them.
- The cheat sheet doubles as a tutorial surface — the player can read the supported features without having to know "what regex is" upfront.

**Negative.**

- The visible feature surface and the *actual* feature surface diverge. A player who uses lookahead and wins will think it's a sanctioned tool; future content authors may not realise unsupported features are in play.
- If we later want to ship lookaround-free Enemy puzzles whose decoys *exploit* the player's lookaround behavior, we'd need to either backfill enforcement or call out the situation in copy.

We accept both. The cheat sheet sets the expectation; if/when we find we need enforcement, we add it then.

## Alternatives considered

### A. Active enforcement

Parse the Ward source and reject features outside the curated set with a friendly message.

**Why not:** writing a JS-regex-source scanner that correctly classifies escapes, classes, and grouping flavors is enough surface area to deserve its own ADR and its own bug budget. v1 doesn't need it.

### B. Silent restriction

Quietly normalize away unsupported constructs (e.g. strip `^`/`$`).

**Why not:** silent rewrites are the kind of thing players curse when they can't figure out why their Ward "works differently from a regex tester". The amendment to ADR-0003 keeps anchors literal-passthrough precisely to avoid this.

## See also

- `src/combat/docs/adr/0003-full-anchored-match.md` (amended) — the engine-side decision this leans on.
- `src/view/WardEditor.tsx` — the `SupportedSyntaxCheatSheet` component embeds the curated list.
