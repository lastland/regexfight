# ADR-0003 (combat): Full anchored match; player writes `^...$`

**Date**: 2026-05-16
**Status**: Accepted

## Context

Once Decoys are introduced (see ADR-0002), the match semantics need to be unambiguous. JavaScript's default `RegExp.prototype.test()` is a *partial* match — `/abc/.test("xabcy")` returns `true`. For a defensive-spell-blocking metaphor, partial match feels wrong: did the Ward "block" the spell, or merely contain a fragment of it? And the precision/recall puzzle becomes murky — a Decoy pool author would have to ensure no Decoy contains any matchable substring of any plausible Ward, which is impractical.

Additionally, anchoring is a real regex *concept* the player should learn. Hiding it from them (auto-wrapping their Ward as `^(...)$`) trades a known-pedagogical-cost for less typing.

Flag handling needs a default policy too. Of the JS regex flags (`g`, `i`, `m`, `s`, `u`, `y`, `d`), most are meaningless under full anchored single-line strings.

## Decision

**A Spell is Captured iff the Ward matches its `text` end-to-end.** The Ward must satisfy `^...$` semantics over the entire spell string.

**The player writes the anchors themselves.** The engine does NOT auto-wrap. Forgetting an anchor produces a real, visible failure mode (e.g. a `/dragon\d+/` Ward without `^` will match decoys like `Xdragon42Y` and take FalseCapture damage), which is exactly the kind of teachable mistake the soul-like death loop should expose.

**Only the `i` flag is allowed.** Other flags are either irrelevant under single-line full-match (`g`, `m`, `s`, `y`, `d`) or beyond v1 scope (`u`). The Ward editor restricts flag input to `i`.

**Capture groups are syntactically allowed but have no mechanical meaning.** `(\d+)` is fine; the captured substring is discarded. This keeps the core sim minimal. (A future feature could give capture groups gameplay meaning — e.g. "captured substring becomes counterattack damage" — but it would be a different game.)

## Consequences

**Positive:**

- The precision/recall framing stays crisp. Each Spell yields a clean boolean (matches end-to-end, or doesn't). Decoy authoring is simple: any string that doesn't match the Pattern end-to-end is a valid Decoy.
- Anchors are visible in the Ward, so the player can *see* their regex's shape commitment.
- Allowing `i` is an ergonomics win — `/[Dd][Rr][Aa][Gg][Oo][Nn]/` is hostile to write — without expanding the surface area meaningfully.

**Negative:**

- The behavior diverges from JS's default `.test()`. Players coming from real-world regex use may be momentarily confused. Mitigated by: (a) explicit `^...$` makes the divergence visible; (b) the prep screen surfaces the match shape in the Ward editor.
- A missed anchor is a *silent* failure mode (Ward parses and accepts spells, just lets through Decoys it shouldn't). Diagnostic surface lives in the post-mortem: a FalseCapture on `Xpattern_textY` strongly hints the Ward lacks anchors.

## Alternatives considered

### A. Engine auto-wraps Ward as `^(...)$`
Same end-to-end semantics, but the player never types anchors.

**Why not:** Anchors are a core regex concept. Auto-wrapping deprives the player of learning them. The "easily teachable mistake" of a forgotten `^` is a pedagogical *feature*, not a UX bug.

### B. Partial (substring) match
Match the JS default. Ward captures a Spell iff `ward.test(spell.text)` returns true.

**Why not:** (1) makes Decoy authoring nearly impossible (any substring containment trips a match); (2) weakens the precision/recall puzzle (loose-but-localized regexes win); (3) "did the Ward 'catch' the spell or just sniff it?" is unsatisfying from a metaphor standpoint.

### C. Allow all JS flags
Allow `g`, `m`, `s`, `u`, etc.

**Why not:** Most of these are no-ops under single-line full-match. Allowing them expands the learning surface without adding gameplay depth. `i` carries actual ergonomic value (avoiding `[Aa][Bb][Cc]`-style classes); the others don't.

### D. Forbid all flags
Even forbid `i`. Force the player to express case-insensitivity via character classes.

**Why not:** Authoring some Enemies (e.g. one whose Pattern intentionally mixes cases) would require huge regexes. The pedagogical gain over allowing `i` is marginal.

### E. Capture groups carry gameplay meaning
Captured substrings determine counter-attack damage, or feed back into the Ward.

**Why not:** Genuinely interesting but a substantially different game. Defer. Recorded as a potential future ADR-0XX in this same context.

## See also

- `src/combat/CONTEXT.md` — Ward, Outcome, match semantics.
- `src/combat/docs/adr/0002-decoys-precision-recall.md` — why we need unambiguous match semantics in the first place.
