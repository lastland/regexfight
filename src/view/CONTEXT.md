# View — Context Glossary

The view context owns *rendering*: React components, Canvas drawing, screen-level wiring. It consumes immutable state and events from `combat` and `run`; it does not own any game logic.

The audience here is anyone working on UI/UX, animation, or visual feedback. The vocabulary describes screens, components, and rendering choices — not domain entities.

## Terms

### Screen
A top-level UI surface that owns the entire viewport. Three exist in v1:

- **Prep Screen** — the bonfire. Shows the current Enemy, the Player's Observation Log against that Enemy, and the Ward Editor. Player commits a Ward and starts an Attempt.
- **Encounter Screen** — the fight. Hosts the Encounter Canvas plus HP bars, Phase indicator, and a live event ticker. Receives a stream of EncounterEvents from `combat`'s sim.
- **Post-mortem Screen** — the receipt. Shows the Attempt Log with explicit Outcome and Kind labels, the Score earned this Attempt, and retry/advance buttons.

Switching between Screens is routed by `app`, not by `view` itself.

### Ward Editor
The text input in the Prep Screen where the player composes their regex. Provides:

- Live regex syntax validation. Invalid Wards mark "Start encounter" as disabled and surface a parse error inline.
- Flag selector (only `i` is enabled in v1).
- *Reserved slot* for the future Test Bench — the component lays out the slot, v1 leaves it empty. See `docs/adr/0001-test-bench-deferred.md`.

### Encounter Canvas
The single Canvas 2D element on the Encounter Screen. Owns its own `<canvas>` ref and animation loop, reads from props-supplied EncounterState, and renders:

- Spell strings flying toward the player, color-coded by Kind.
- The player and enemy sprites (retro pixel).
- Hit flashes on damage events.
- Phase transition effects.

The Encounter Canvas is the single point where Canvas rendering is used; every other Screen is DOM.

### Observation Log (view component)
The DOM-rendered list of Spells in the Prep Screen, showing each Spell's text and Kind via color coding. Read-only in v1. The component subscribes to the `run`-owned Observation Log; it does not mutate it.

### Color Coding for Kinds
The visual contract that distinguishes Real Spells from Decoy Spells. Used consistently across:

- The Encounter Canvas (live combat).
- The Observation Log (prep screen).
- The Attempt Log (post-mortem).

The specific palette is determined by the visual design pass (`/frontend-design:frontend-design`); the *contract* is that the same Kind looks the same across Screens. Color drift across surfaces is a bug.

### Pixel Rendering
The visual style. Asset images are rendered with CSS `image-rendering: pixelated` to preserve the retro pixel aesthetic on high-DPI displays. Both DOM-rendered surfaces and the Canvas adhere to the pixel grid.

### Event Ticker
The live feed of EncounterEvents on the Encounter Screen — a compact line-by-line log of "Captured `dragon42`", "Hit by `phoenix99`", etc. Complements the Canvas animation, which is dramatic but ephemeral; the ticker is the persistent breadcrumb during a fight.

### Render Boundary
The line between `combat`/`run` (which produce state and events) and `view` (which consumes them). React components consume via props/hooks; they never mutate domain state directly. Mutations route back through the app layer.

## Terms borrowed from other contexts

| Term            | Owning context | Why it shows up here                                       |
|-----------------|----------------|------------------------------------------------------------|
| EncounterEvent  | `combat`       | The Encounter Canvas and Event Ticker consume them.        |
| Observation Log | `run`          | Prep Screen reads it to populate the on-screen log.        |
| Spell, Kind     | `combat`       | Color coding and chip rendering reference these.           |
| Outcome         | `combat`       | Post-mortem Screen labels each entry with its Outcome.     |
| Run, Score      | `run`          | Score display on Prep Screen and Post-mortem Screen.       |

## What the view context does NOT own

- *Domain logic* — `combat`, `run`.
- *Data on disk* — `content`, `persist`.
- *Test bench evaluation* — when added, the evaluator itself is in `combat`; only its UI wrapping lives here.
