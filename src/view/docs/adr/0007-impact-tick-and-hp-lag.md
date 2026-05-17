# ADR-0007 (view): Per-Outcome Impact Tick and Displayed-HP Lag

**Date**: 2026-05-16
**Status**: Accepted

## Context

Two visual-pacing bugs surfaced after the v1.1 polish pass shipped:

1. **HP drops before the spell visibly hits.** The HP bar is bound to `screen.sim.playerHp` in `src/app/App.tsx`. As soon as `stepEncounter` resolves a Spell, the sim HP updates — but the Encounter Canvas is just *starting* the Spell's five-phase animation (Invocation → Travel → Pre-impact → Resolution → Aftermath). At 1× speed, the projectile takes ~1050 ms (Invocation + Travel + Pre-impact) to reach the player. HP visibly drops *before* the projectile arrives — the cause-and-effect is broken.

2. **Counterattack's enemy-flash fires at the wrong moment.** The per-Outcome flash overlay is scheduled in `onResolutionEnter`. For Hit and Backfire, that's correct — the projectile is already at the player at t=0 of Resolution. For Counterattack, the projectile *reverses* during Resolution: it leaves the player at t=0 and arrives at the enemy at t=1. Firing the green flash at t=0 lights up the enemy before the projectile gets there.

Both bugs share the same root: there was no single concept of *when in the Resolution phase a Spell's consequence visibly lands*. Visual side-effects were scheduled at convenient moments (event ingest, Resolution-enter) rather than at the actual narrative impact.

## Decision

Introduce a **per-Outcome Impact Moment** within the Resolution Animation Phase. The Encounter Canvas fires `onSpellImpact(eventIdx: number)` at this moment; everything that should land *with the visible impact* is gated on it.

### Where the Impact Moment falls

| Outcome       | Impact Moment              | Why                                                       |
|---------------|----------------------------|-----------------------------------------------------------|
| Counterattack | end of Resolution (t=1.0)  | Reversed projectile arrives at the enemy.                 |
| Hit           | start of Resolution (t=0.0)| Projectile reaches the player.                            |
| Backfire      | start of Resolution (t=0.0)| Projectile reaches the player.                            |
| Dodge         | *none*                     | No consequence to gate on; projectile phases past.        |

### What lands at the Impact Moment

- Per-Outcome flash overlay (already existed; moved off `onResolutionEnter` to the impact tick).
- Damage number spawn.
- Outcome Text Overlay (`COUNTER!` for Counterattack; Dodge uses its own start-of-Resolution trigger since it has no Impact Moment).
- **Displayed HP advance** (see below).

### Displayed HP separated from sim HP

The Encounter Screen now tracks `lastImpactedEventIdx` (a `useState`). Displayed HP is derived:

```ts
const displayedPlayerHp = impactIdx >= 0 ? events[impactIdx].playerHp : playerMaxHp;
const displayedEnemyHp  = impactIdx >= 0 ? events[impactIdx].enemyHp  : enemyMaxHp;
```

The sim HP (which the App still owns and persists) remains the source of truth for game logic, post-mortem framing, and Run persistence. The displayed HP lags it, advancing one event at a time as the Canvas fires `onSpellImpact`. The existing `HpBarTween` smoothly animates between displayed values; no changes there.

`SpellResolved` already carries `playerHp` and `enemyHp` post-state, so no combat-layer plumbing changes.

### autoTick mode

The test-only `autoTick=true` path in `EncounterCanvas` bypasses the per-spell animation. To keep test assertions valid, autoTick also calls `onSpellImpact` synchronously for each ingested `SpellResolved` event.

## Consequences

**Positive**

- HP visibly drops *when the spell hits*, not before. The cause-and-effect chain is preserved at any Speed Multiplier.
- Counterattack's enemy-flash lands at the projectile arrival, not its departure.
- A single concept ("Impact Moment") owns the cluster of side-effects that should land together. New visual effects can hook the same callback without recreating the pattern.
- The split between sim HP (authoritative) and displayed HP (lagging, visual-only) is explicit and localised to the view layer. App stays focused on sim/run orchestration.

**Negative**

- The Canvas now exposes a second callback (`onSpellImpact`) in addition to `onRequestNextEvent`. Two-callback APIs are slightly harder to reason about than one.
- Displayed HP can lag sim HP by one full encounter cycle on encounter-end: the last `SpellResolved` impacts, then `EncounterEnded` arrives in the sim before the Canvas fires the final `onSpellImpact`. Mitigated because `EncounterEnded` triggers an end-pause (`END_PAUSE_MS = 1200 ms`) during which the displayed HP catches up via the still-playing final animation.
- autoTick mode has to mirror the production path's impact callback. A small but real source of drift if the two ever diverge.

## Alternatives considered

### A. Fix each bug separately (no unifying concept)

- Move Counterattack's flash to end-of-Resolution as a one-line patch (#1).
- Lag the HP independently inside App with a polling/diff mechanism (#6).

**Why not.** The two bugs are the same bug. Solving them with two mechanisms accrues complexity without buying anything; future visual effects with the same timing requirement would invent a third mechanism. Worse, the App-side HP lag has no good signal to advance on without inventing a callback from the Canvas — which is exactly the unified mechanism, just spelled differently.

### B. Canvas owns displayed HP

Pass `playerMaxHp` and event stream to the Canvas; let it compute and own the displayed values, exposing them upward as props.

**Why not.** The Canvas was previously HP-blind by design (it knows about animation phases and figures, not damage values). Pushing HP into it leaks game-state semantics into a presentational component. Easier to keep the Canvas dumb and let the Screen own the lag.

### C. Defer HP sync, fix flash only

Ship the cheap fix (Counterattack flash timing) and leave the HP-sync bug for later.

**Why not.** Partial fix; the more jarring of the two bugs is the HP one. The user can see HP drop a full second before the projectile arrives — that is the dominant complaint. Leaving it unfixed undermines the v1.1 polish narrative.

## See also

- `src/view/CONTEXT.md` — *Impact Moment*, *Outcome Text Overlay*, *Phase Transformation* glossary entries.
- `src/view/docs/adr/0003-event-driven-encounter-pacing.md` — the request-next-event pacing that this layers on top of.
- `src/view/docs/adr/0004-five-phase-spell-animation.md` — the Resolution phase whose interior we now subdivide.
- `src/combat/docs/adr/0005-outcome-rename-counterattack.md` — the Outcome vocabulary referenced here.
