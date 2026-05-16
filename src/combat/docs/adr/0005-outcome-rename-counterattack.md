# ADR-0005 (combat): Rename Outcome to narrative-effect names — Counterattack / Hit / Backfire / Dodge

**Date**: 2026-05-16
**Status**: Accepted

## Context

ADR-0002 (combat) named the four `Outcome` variants by their *matching semantics* — what the engine did internally:

- `Capture` — Ward matched a Real Spell.
- `Hit` — Ward missed a Real Spell.
- `FalseCapture` — Ward matched a Decoy.
- `Dodge` — Ward rejected a Decoy.

These names describe the *cross-table cell* the result fell into, not the *narrative event* the player observes.

The design intent — surfaced repeatedly in conversation — is that the Player does not initiate attacks. The Player *counterattacks* by catching the Enemy's incoming spell with the Ward. The matching-semantics names obscure this:

- "Capture" sounds like the Player is grabbing something for themselves; the actual event is *reflecting an attack back*.
- "FalseCapture" derives its meaning from "Capture", inheriting the same vocabulary mismatch — and "false" carries a moral connotation that doesn't fit "you fell for a trap."
- A future enemy-author or visual designer reading the code has to mentally translate "Capture → player counterattack" every time.

A second concern surfaced during the v1.1 visual-polish design pass: the *visuals* themselves (animation poses, flash colors, screen shake behavior) hinge on the Player figure having a **Counterattack pose**. Naming the Outcome `Capture` while naming the Player's matching pose "counterattack" creates an immediate drift point.

## Decision

Rename the `Outcome` union to use **narrative-effect names**:

```ts
type Outcome = 'Counterattack' | 'Hit' | 'Backfire' | 'Dodge';
```

|              | Ward matches      | Ward rejects |
|--------------|-------------------|--------------|
| Spell is Real  | **Counterattack** | **Hit**       |
| Spell is Decoy | **Backfire**      | **Dodge**     |

Semantically identical to the prior names; only the labels change.

The renames:

- `Capture` → **`Counterattack`**.
- `FalseCapture` → **`Backfire`** (the Ward attempts to catch, the trap springs, the Player takes the hit).
- `Hit` and `Dodge` are unchanged — they're already narrative-effect names.

This rename propagates through:

- `src/combat/types.ts` (`Outcome` union).
- `src/combat/spell.ts` (`resolveSpell` return values).
- `src/combat/score.ts` (`scoreFromOutcome` cases).
- `src/combat/spell.test.ts`, `src/combat/encounter.test.ts` (test assertions).
- `src/view/colors.ts` (`OUTCOME_LABEL`, `OUTCOME_CLASS`).
- `src/view/PostMortemScreen.tsx` (outcome grouping).
- `src/app/runState.ts`, `src/app/App.test.tsx` (uses).
- `src/combat/CONTEXT.md`, `src/run/CONTEXT.md`, `src/content/CONTEXT.md` (glossary entries).
- `src/combat/docs/adr/0002-decoys-precision-recall.md` and `src/run/docs/adr/0001-stat-driven-damage-and-modifiers.md` (text references).

`Capture` and `FalseCapture` are not aliased or preserved for backwards-compatibility — the rename is a hard cut. Saved Runs in `localStorage` do not store Outcome strings (only Spells), so this rename has no save-format impact.

## Consequences

**Positive:**

- **Vocabulary alignment.** The code uses the same terms as the design conversations, the README, and the visual layer. No mental translation when reading.
- **Visual layer doesn't drift.** The Player's Counterattack pose, the Counterattack Outcome, and the Counterattack damage flash all share a name. Renames in one place no longer create drift.
- **Future content is honest.** A future enemy author reading `Outcome` sees "Counterattack / Hit / Backfire / Dodge" and understands what each *means narratively*. The old names taught nothing.

**Negative:**

- **Refactor cost (~10 files).** Bounded — TypeScript catches every miss. Mechanical.
- **Diff noise** in the rename commit. Tolerable; it's a one-time event.
- **External references to old names** (chat history, prior commits) won't auto-update. Mitigated by a clear ADR cross-reference (this file) and `git log` searchability.

**Why "Backfire" specifically:**

Alternatives considered: `Trap`, `Misread`, `Misfire`, `FalseCounterattack`, `Snare`. Reasoning for `Backfire`:

- Describes the **player-facing effect**: the player's *counter* attempt fired back at them.
- Is a real English word with a single, well-understood meaning. `Misread` is slightly more accurate (the player misread the pattern) but is more abstract and less visceral.
- Parallel structure to `Counterattack`: both name a *kind of action gone right or wrong*. `Trap` and `Snare` name the *enemy's tool*; from the Player's perspective, the salient event is their own action backfiring.
- `FalseCounterattack` was rejected as a clumsy compound and harder to render visually as a flash label.

## Alternatives considered

### A. Keep the old names
Leave `Capture` / `FalseCapture`; just label the new player pose "counterattack" without renaming the Outcome.

**Why not:** Drift surface keeps growing. Visual code says "Counterattack", combat code says "Capture", and every cross-context reader pays a translation tax. The cost of renaming compounds the longer we wait.

### B. Alias the old names
Keep the new names canonical but export `Capture = Counterattack` etc. as type aliases for migration.

**Why not:** Aliasing means *both* names are in scope; readers will choose at random; the rename never actually completes. The current codebase is small enough that a hard cut is cheaper than carrying alias debt.

### C. Rename only Capture, keep FalseCapture
Counterattack reads well; FalseCapture is "fine."

**Why not:** Inconsistent vocabulary. If the cross-table cell for `Real + match` is `Counterattack`, the cell for `Decoy + match` should also be a narrative-effect name; otherwise the table has mixed naming conventions.

### D. More general/abstract name space (e.g. `Outcome.WinReal`, `Outcome.LoseReal`)
Purely abstract names with no narrative loading.

**Why not:** Loses all readability. Code review and onboarding would degrade.

## See also

- `src/combat/CONTEXT.md` — the live glossary, now using the new names.
- `src/combat/docs/adr/0002-decoys-precision-recall.md` — the original decoy mechanic ADR; text references updated to new names.
- `src/run/docs/adr/0001-stat-driven-damage-and-modifiers.md` — references the damage rules per Outcome; text updated.
- `src/view/docs/adr/0004-five-phase-spell-animation.md` — the visual storyboard uses the new names from inception.
