# ADR-0003 (view): Five-phase per-spell animation, branched at Resolution by Outcome

**Date**: 2026-05-16
**Status**: Accepted

## Context

The v1 Encounter Canvas animates each `SpellResolved` event as a single coloured rectangle flying across the screen — labelled with the Spell's text, tinted by Kind, fading after travel. It's the minimum viable visualisation.

The v1.1 polish brief calls for:

- Per-spell animations with *visible cause-and-effect*: the player should see the Enemy cast, the spell travel, the Ward react (or not), the player react (or not).
- A pacing rhythm with *slow beats* at the moments of dramatic tension — the user specified "slower during spell invocation and when the spell is countered or impact."
- Distinct visual feedback for each of the four Outcomes (Counterattack / Hit / Backfire / Dodge) so the player can tell at a glance what kind of error they made.

A single linear animation can't deliver any of this. We need a structured per-spell sequence with named phases, durations, and branching behaviour.

## Decision

Every Spell on the Encounter Canvas passes through **five Animation Phases**, in order:

| # | Phase           | ms @ 1× | Speed bucket | What's on screen |
|---|-----------------|---------|--------------|------------------|
| 1 | **Invocation**  | ~500    | slow         | Enemy → Casting pose. Spell Text appears glyph-by-glyph above the enemy (~40 ms/glyph). Spell Projectile materialises at the enemy. |
| 2 | **Travel**      | ~400    | normal       | Spell Projectile crosses left-to-right. Spell Text rides above it. |
| 3 | **Pre-impact**  | ~150    | slow         | Projectile slows; small zoom; Ward Sigil pulses. Anticipation moment. |
| 4 | **Resolution**  | ~600    | slow         | Branches by Outcome — see below. |
| 5 | **Aftermath**   | ~150    | fast         | Spell Text vanishes; projectile dissolves; HP bar tweens (~250 ms, NOT scaled by speed); damage number floats up and fades. |

Total ~1.8 s per Spell at 1×. With the Speed Multiplier at 10×, ~0.18 s. A full encounter against the baseHp=4 tutorial Enemy runs ~14 s at 1× and ~1.4 s at 10×.

The next Spell does not begin until phase 5 finishes, gated by the event-driven pacing model (see `docs/adr/0003-event-driven-encounter-pacing.md`).

### Resolution branching by Outcome

Phase 4 has four distinct sequences, one per `Outcome` (see `combat/docs/adr/0005-outcome-rename-counterattack.md`):

- **Counterattack** — Player Figure → Counterattack pose; Ward Sigil → Active; Spell Projectile reverses direction, travels back to the enemy, impacts. Enemy Figure → Hit pose. **Green flash** on the enemy. Damage number floats off the enemy. No screen shake (the player is in control).
- **Hit** — Spell Projectile passes through where the Ward Sigil should have caught it; Ward Sigil stays Idle (a visible failure to react). Strikes the player. Player Figure → Hit pose. **Red flash**. **Screen shake** (2–4 px offset, 100–150 ms decay). Damage number floats off the player.
- **Backfire** — Ward Sigil briefly Active — the Ward "tries to catch" — then the projectile dissolves through it and detonates on the player. Player Figure → Hit pose. **Orange/amber flash** (deliberately distinct from Hit's red, so the player can tell what kind of error they made). Damage number floats off the player. No screen shake (it's a trap, not a strike).
- **Dodge** — Spell Projectile phases past the player and fizzles out. Subtle **blue shimmer** behind the player. No damage, no shake, no pose change.

### Spell Text lifecycle

Spell Text is a separate visual entity from the Spell Projectile. Its lifecycle:

- *Phase 1 (Invocation)* — materialises glyph-by-glyph above the enemy. ~40 ms per glyph at 1×. At Speed Multiplier ≥2× the glyph reveal caps and shows the full text instantly (otherwise it's too fast to register).
- *Phase 2 (Travel)* — detaches from the enemy and rides above the Spell Projectile across the canvas.
- *Phase 3 (Pre-impact)* — stays above the projectile.
- *Phase 4 (Resolution)* — vanishes. The Outcome animation owns the visual; the spell *string* has done its job.
- *Phase 5 (Aftermath)* — gone.

Total readable window at 1×: ~1.05 s. The Event Ticker captures the text post-resolution so the player can scroll back.

### Layout

Fixed left-right composition on the canvas:

- Enemy Figure: left side.
- Player Figure: right side.
- Ward Sigil: immediately in front of (left of) the Player Figure.
- Spell Text: above the enemy in phase 1; above the projectile in phases 2–3.
- Spell Projectile: travels left-to-right (enemy → player). On Counterattack, reverses in phase 4.

### Phase-transition effect

When `stepEncounter` emits a `PhaseAdvanced` event (an Enemy Phase change), the HP bar briefly flashes white as the Enemy Phase indicator increments. This fires within the Aftermath of the Spell that triggered the transition, so it does not compete with Resolution.

## Consequences

**Positive:**

- Each Spell has a clear visual narrative the player can read in real time. No more "what just happened?"
- Per-Outcome flash colours teach the player what kind of error they made *without* reading the post-mortem.
- The slow beats land — Invocation builds tension, Resolution lands the impact.
- Speed Multiplier interaction is well-defined per phase.
- The architecture maps directly onto a small state machine inside the EncounterCanvas: one `CurrentSpellAnimation` value, one phase index, one phase-start timestamp, advance on each `requestAnimationFrame` tick.

**Negative:**

- Total encounter duration grows. Baseline ~14 s at 1× for the tutorial vs. ~6 s under the old pacing. Mitigation: the Speed Multiplier (1.4 s at 10×) recovers it for replays.
- More animation surface to author and tune. 19 sprites + animations, vs. the v1's single rectangle. Mitigated by the sprite system in `docs/adr/0005-ascii-sprite-source.md` keeping authoring tight.
- Cross-phase state. A canvas component owning a phase-state machine is more code than the v1's "draw all flying spells". Justified by what it buys.

## Alternatives considered

### A. Three-phase template (Invocation → Resolution → Aftermath)
Drop Travel and Pre-impact. Spell materialises at the enemy, then directly resolves.

**Why not:** Loses the spatial cue of the spell crossing the screen — the player has no time to read the Spell Text. Pre-impact's anticipation moment is also where the player's regex either has caught the spell or hasn't — that moment of suspense is the whole game.

### B. Two-phase template (Resolved-with-flash; everything else is Aftermath)
Even simpler: a brief flash showing the Outcome, then update HP.

**Why not:** No reading time for the Spell Text. The puzzle requires the player to *see* the spell before the Ward acts on it.

### C. Per-Outcome phase counts (different lengths per Outcome)
Counterattack has more phases (because the projectile travels back); Dodge has fewer.

**Why not:** Considered briefly. Rejected because uniform phase count keeps the timing predictable for the player. "The next spell will arrive in roughly 1.8 s" is a useful expectation; making it vary per Outcome adds cognitive load.

### D. Sub-frame interpolation tuned per outcome instead of phase boundaries
Smooth easing curves throughout, no discrete phases — animations look continuous, slow-mo emerges from the curve.

**Why not:** Harder to reason about, harder to test, harder to tune. The phase-boundary model is easier to debug ("the slowness happens at the start of phase 4") and easier to wire up a "step through one phase" debug tool against.

## See also

- `src/view/CONTEXT.md` — Animation Phase, Outcome Animations, Spell Text, Ward Sigil, Spell Projectile glossary entries.
- `src/view/docs/adr/0003-event-driven-encounter-pacing.md` — the pacing mechanism that makes phase boundaries meaningful.
- `src/view/docs/adr/0005-ascii-sprite-source.md` — the sprite pipeline serving the figures referenced in each phase.
- `src/combat/docs/adr/0005-outcome-rename-counterattack.md` — the Outcome names used here.
