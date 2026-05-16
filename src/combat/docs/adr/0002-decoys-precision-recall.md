# ADR-0002 (combat): Decoys make the puzzle precision-and-recall

**Date**: 2026-05-16
**Status**: Accepted

## Context

If an Enemy only emits Real Spells (strings matching its Pattern) and the player's job is simply to match them, the game is broken on day one: the Ward `/.*/`  matches everything. Even with a full-anchored match, trivial patterns like `/.+/` would defeat most Enemies whose spells are nonempty.

The game needs a mechanism that forces the Ward to be *tight* enough to discriminate, not just loose enough to match. The mechanism has to be intrinsic to the combat loop, not a meta-system bolted on (e.g. "score the regex's specificity").

## Decision

**Each Enemy emits two kinds of Spells: Real Spells (strings matching the Pattern, which the Ward must match) and Decoy Spells (strings that do NOT match the Pattern, which the Ward must reject).** Both kinds appear in the live spell stream during an Encounter; their Kind is rendered to the player via color coding.

The four per-spell Outcomes (Capture, Hit, FalseCapture, Dodge) follow directly from the cross of Kind × Ward-matches.

This makes the player's task literally *precision and recall*: their Ward must achieve high recall (catch all Reals) AND high precision (reject all Decoys). Either failure mode is fatal.

## Consequences

**Positive:**

- Trivial regexes are unsafe by construction. `/.*/`  matches every Decoy → FalseCapture damage every Spell → fast death. A regex with high recall but low precision dies. A regex with high precision but low recall dies. Only correct-shape Wards survive.
- The game maps cleanly to real cognitive science. "Pattern inference from positive *and* negative examples" is the active-learning setting; the player is doing genuinely useful brain work.
- Decoys are dirt cheap to author: just include strings adjacent-to-but-not-matching the pattern (off-by-one length, near-miss character class, etc.) in the Decoy pool.
- The visual design gets a natural dichotomy — two distinguishable spell kinds on screen, which is good for readability.

**Negative:**

- Authoring effort per Enemy doubles, in expectation: every Phase needs a Real pool *and* a Decoy pool. Mitigated by the fact that Decoys are usually small perturbations of Reals, so authoring is fast.
- Damage symmetry (Hit and FalseCapture both deal `enemy.attack`) is a calibration choice. See the v1 calibration in `~/.claude/plans/i-want-to-design-drifting-origami.md`. Asymmetric punishment was considered and rejected in `combat/docs/adr/0001-ward-frozen-during-encounter.md` discussions; the user confirmed symmetric.
- Players unfamiliar with regex must learn that *not matching* is also a goal, not just *matching*. The Seed Spells (with Kind labels visible from the start) make this discoverable on the very first prep screen.

## Alternatives considered

### A. Positives only, with regex-specificity scoring
Only Real Spells. The damage model rewards "tight" regexes via some scoring rule on the regex shape (e.g. fewer wildcards, shorter pattern).

**Why not:** Any such rule is a meta-game on the regex's syntax rather than its semantic discrimination power. Players would learn to game the rule (e.g. avoid `.*` even when it's correct). The mapping to real pattern-recognition cognition is weaker — precision is an emergent property of the player's choices, not an intrinsic damage event.

### B. Positives only, with full-anchored match and varying lengths
Only Real Spells, full-anchored. Anti-cheese comes from spells of varying length so `/.*/`  still works but a single literal regex doesn't.

**Why not:** `/.*/`  still wins — it matches any length. Even `/^.*$/` matches every spell. Decoys are the principled solution; this option papers over the problem.

### C. Positives only, with a "match count" penalty
Each Capture is penalty-free; the Ward is silently scored against an oracle's specificity and at-end-of-encounter the player takes residual damage proportional to over-generality.

**Why not:** Hidden math. The player can't see why they're losing HP — feels arbitrary. Decoys are *visible*; the player sees the FalseCapture happen and learns from it immediately.

## See also

- `src/combat/CONTEXT.md` — Outcome table; Capture / Hit / FalseCapture / Dodge definitions.
- `src/combat/docs/adr/0003-full-anchored-match.md` — the match-semantics ADR; complements this one.
- `src/content/CONTEXT.md` — Phase Pool, authoring conventions for Decoy pools.
