# view — agent notes

## Encounter view contract (ADR-0007 view)

Displayed HP lags sim HP. The view derives HP from `events[lastImpactedEventIdx].playerHp/enemyHp` — never from `sim.*`. New visual effects that need to land "with the hit" should hook `EncounterCanvas`'s `onSpellImpact(idx)` callback, not the sim state. In `autoTick` test mode, `onSpellImpact` must be fired synchronously in the autoTick block — otherwise tests that depend on displayed HP see stale values.
