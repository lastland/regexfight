# ADR-0001 (view): Prep-screen test bench deferred from v1; architectural slot reserved

**Date**: 2026-05-16
**Status**: Accepted

## Context

The Prep Screen could include a *live test bench*: as the player types their Ward, every Spell in the Observation Log is re-tested in real time, showing match/no-match per Spell and live precision/recall stats. This would let the player iterate on the Ward in milliseconds instead of waiting for a death.

But a test bench changes the soul-like feel materially. With it, the iteration cycle is "type → see result → adjust → submit." Without it, the iteration cycle is "type → submit → die → observe → adjust → resubmit." The latter is slower and harsher; the former is more productive.

The user picked: *"Only dying teaches in this milestone; but design the code in the way that we can add test bench later."*

This ADR captures both halves of that decision — the v1 absence *and* the architectural reservation that makes the future addition cheap.

## Decision

**v1 ships without a live test bench.** The Prep Screen shows:

- The Enemy's name and visual.
- The Observation Log (Spells with Kind, deduped). Read-only display.
- The Ward Editor with **inline regex syntax validation only** — no per-Spell evaluation. An unparseable Ward disables the "Start encounter" button.
- A reserved layout region where the future test bench will go (visible as empty white space, *not* hidden — present-but-empty signals that something is planned here).

**The architecture supports adding a test bench later without refactor.** Specifically:

- The Ward-against-Spell evaluation function (`resolveSpell(spell, ward)` in `combat`) is already a pure exported function. The test bench will call it `O(|log|)` times per keystroke; no new types needed.
- The Observation Log is already queryable from the Prep Screen via a `run`-context selector. v1 reads it for display; the test bench will read it for evaluation.
- The Ward Editor's React component layout reserves a clearly-named slot (`<TestBenchSlot />`) that v1 leaves empty.

**Trigger for adding the test bench:** if v1 playtesting shows iteration cost is the dominant frustration (i.e. players give up before reaching a correct Ward), prioritize the test bench. The shape of the feature is already designed; only the React components are new.

## Consequences

**Positive:**

- v1 ships sooner. The test bench has UI/UX surface (per-Spell highlight, precision/recall meter, error display) that takes real design work; cutting it shrinks v1.
- The soul-like flavor is intact at launch. "Die to learn" is the core ethos; v1 honors it literally.
- Future addition is cheap. When the test bench ships, the `combat` and `run` contexts don't change; only `view` gains components.

**Negative:**

- v1 iteration cost is high. A player whose first Ward is half-right will:
  1. Submit it.
  2. Die.
  3. Read the Observation Log on the post-mortem and the prep screen.
  4. Decide what to change.
  5. Submit a new one.
  Steps 1–2 take seconds-to-minutes; steps 3–4 take longer. This is *intended* but may be too punishing for some players. The Seed Spells (pre-populating the log) and the persistent log (accumulating across deaths) are partial mitigations.
- Empty slot in the Prep Screen is visible to early users — they may wonder what's missing. Mitigated by labeling the slot honestly: "Test bench (coming soon)." This makes the v1 absence intentional rather than missing.

## Alternatives considered

### A. Full test bench from v1
Live evaluation, precision/recall meter, per-Spell highlight.

**Why not:** User explicitly chose to defer. Adds substantial UI/UX work to v1 scope.

### B. Minimal test bench: live syntax validation + per-keystroke "passes-all-known-spells" toggle
Smaller than full bench but still gives some feedback.

**Why not:** Awkward middle ground. The full test bench has a coherent design; the "minimal" version requires its own UX investigation. Either ship the whole thing or nothing.

### C. No reserved slot in v1; add organically later
Skip the architectural reservation; restructure the Prep Screen when the bench lands.

**Why not:** The slot is cheap to reserve and prevents a layout-refactor cycle when the feature lands. Visible empty space signals the future addition, which is honest user-communication.

### D. Replace dying-as-iteration with a "practice mode"
A separate Prep Screen mode where the player can run "mock encounters" against the Observation Log without HP cost.

**Why not:** Effectively the test bench by another name, but more cumbersome (a whole mode toggle). The full test bench is the cleaner expression.

## See also

- `src/view/CONTEXT.md` — Ward Editor, Prep Screen, reserved slot.
- `src/combat/CONTEXT.md` — `resolveSpell` is the function the future test bench will consume.
- `~/.claude/plans/i-want-to-design-drifting-origami.md` — full design plan, including the deferred-features list.
