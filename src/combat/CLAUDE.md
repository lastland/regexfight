# combat — agent notes

## Encounter sim event ordering

`stepEncounter` emits `SpellResolved` for every cast spell, including the killing blow and the threshold-crossing spell. The boundary events (`EncounterEnded`, `PhaseAdvanced`) arrive on the **next** tick after the SpellResolved that triggered them. Code that needs to react to the spell that caused a boundary should listen to `SpellResolved` and check its post-state HP — do not assume the boundary event itself carries the triggering spell.
