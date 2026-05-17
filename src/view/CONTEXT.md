# View — Context Glossary

The view context owns *rendering*: React components, Canvas drawing, screen-level wiring, and the pacing of visual feedback. It consumes immutable state and events from `combat` and `run`; it does not own any game logic.

The audience here is anyone working on UI/UX, animation, or visual feedback. The vocabulary describes screens, components, animation phases, sprites, and pacing — not domain entities.

## Screens & components

### Screen
A top-level UI surface that owns the entire viewport. Three exist in v1:

- **Prep Screen** — the bonfire. Shows the current Enemy, the Player's Observation Log against that Enemy, and the Ward Editor. Player commits a Ward and starts an Attempt.
- **Encounter Screen** — the fight. Hosts the Encounter Canvas plus HP bars, Phase indicator, the Speed control, and a live event ticker. Pulls EncounterEvents from `combat`'s sim via an event-driven pacing model (see Animation Phase below).
- **Post-mortem Screen** — the receipt. Shows the Attempt Log with explicit Outcome and Kind labels, the Score earned this Attempt, and retry/advance buttons.

Switching between Screens is routed by `app`, not by `view` itself.

### Ward Editor
The text input in the Prep Screen where the player composes their regex. Provides:

- Live regex syntax validation. Invalid Wards mark "Start encounter" as disabled and surface a parse error inline.
- Flag selector (only `i` is enabled in v1).
- *Reserved slot* for the future Test Bench — the component lays out the slot, v1 leaves it empty. See `docs/adr/0001-test-bench-deferred.md`.

### Encounter Canvas
The single Canvas 2D element on the Encounter Screen. Owns its own `<canvas>` ref and animation loop, reads from props-supplied state and the current `EncounterEvent`, and renders:

- Player Figure and Enemy Figure (composed sprites — see Player Skin and Enemy Figure below).
- Ward Sigil (visible glyph in front of the player).
- Spell projectile and Spell Text (the "magic words" being uttered).
- Outcome animations (Counterattack reflection, Hit impact, Backfire trap, Dodge fizzle).
- HP flashes, damage numbers, phase-transition effects.

The Encounter Canvas is the single point where Canvas rendering is used; every other Screen is DOM.

### Observation Log (view component)
The DOM-rendered list of Spells in the Prep Screen, showing each Spell's text and Kind via color coding. Read-only in v1. The component subscribes to the `run`-owned Observation Log; it does not mutate it.

### Event Ticker
The live feed of EncounterEvents on the Encounter Screen — a compact line-by-line log of "Countered `dragon42`", "Hit by `phoenix99`", "Backfire on `DRAGON42`", "Dodged `meow`", etc. Complements the Canvas animation, which is dramatic but ephemeral; the ticker is the persistent breadcrumb during a fight.

Entries appear only **after** the Canvas has finished animating the event — the event-driven pacing model guarantees the ticker never leads the visual.

### Speed Control
A small HUD button on the Encounter Screen that cycles the Speed Multiplier through 1× / 2× / 5× / 10×. Number keys `1`/`2`/`3`/`4` are equivalent shortcuts. Persists in `localStorage` under `regexfight:speed:v1`, separate from the Run save (cosmetic preference, not gameplay state).

## Animation pacing

### Animation Phase
One of five discrete stages a Spell passes through on the Encounter Canvas. Each Spell goes through all five in order; the next Spell does not begin until the current one's phase 5 (Aftermath) finishes. See `docs/adr/0004-five-phase-spell-animation.md`.

| # | Phase | ms @ 1× | What's on screen |
|---|-------|---------|------------------|
| 1 | **Invocation** | ~500 | Enemy → Casting pose; Spell Text appears glyph-by-glyph above enemy; Spell projectile materialises. Slow beat for tension. |
| 2 | **Travel** | ~400 | Projectile crosses canvas; Spell Text rides above the projectile. |
| 3 | **Pre-impact** | ~150 | Projectile slows; Ward Sigil pulses; subtle hang. |
| 4 | **Resolution** | ~600 | Branches by Outcome — see Outcome Animations. Slow beat. |
| 5 | **Aftermath** | ~150 | Spell Text vanishes; projectile dissolves; HP bar tweens; damage number floats. |

Total ~1.8 s/spell at 1×, ~0.18 s at 10×.

> **Disambiguation.** `combat` also uses the word **Phase** for an Enemy's HP-threshold-triggered stage (Phase 1 / Phase 2). When ambiguity matters, write **Animation Phase** for the view-context meaning and **Enemy Phase** for the combat-context meaning.

### Speed Multiplier
A global view-context number — currently one of `{1, 2, 5, 10}` — that scales the duration of every Animation Phase uniformly. Specific exceptions:

- **Glyph-by-glyph spell text reveal** caps at a readable floor: at ≥2× the text reveals instantly.
- **HP-bar tween duration** does NOT scale with speed (stays ~250 ms regardless), so the "I see damage land" beat survives high multipliers.

Stored in `localStorage`; mutated via the Speed Control or number keys.

### Event-Driven Pacing
The Encounter Screen *pulls* events from `combat` via an `onRequestNextEvent` callback that fires when the current Spell's Aftermath finishes. There is no `setInterval` driving the sim. See `docs/adr/0003-event-driven-encounter-pacing.md`.

### Impact Moment
The instant *within* the Resolution Animation Phase at which a Spell's visible consequence lands. Per-Outcome:

- **Counterattack** — end of Resolution (when the reversed projectile arrives back at the enemy).
- **Hit / Backfire** — start of Resolution (when the projectile reaches the player).
- **Dodge** — none (the projectile phases past; there is no consequence to gate on).

The Encounter Canvas fires `onSpellImpact(eventIdx)` at the Impact Moment. The Encounter Screen uses this to advance **displayed HP** — distinct from sim HP, which is correct-but-early. Without this lag, the HP bar would drop ~1.6 s before the visible impact. See `docs/adr/0007-impact-tick-and-hp-lag.md`.

The Impact Moment also gates other Resolution-time visuals: per-Outcome flash and damage number spawn.

## Outcome animations

The Resolution Animation Phase branches by Outcome. All four branches reuse the same projectile + Spell Text setup; only what happens *to* them differs.

### Counterattack Animation
Player → Counterattack pose. Ward Sigil → Active. Projectile reverses direction, travels back to enemy, impacts at the **Impact Moment** (end of Resolution). Enemy → Hit pose at impact. Green flash on enemy at impact. Damage number floats off enemy at impact. No screen shake (player is in control).

### Hit Animation
Projectile passes through where the Ward Sigil should have caught it (Sigil stays Idle — a visible failure to react). Strikes the player. Player → Hit pose. Red flash. **Screen shake** (small offset, 100–150 ms decay). Damage number floats off player.

### Backfire Animation
Ward Sigil briefly Active — the Ward "tries to catch" — then the projectile dissolves through it and detonates on the player. Player → Hit pose. **Orange/amber flash** (distinct from Hit's red, so the player can tell what kind of error they made). Damage number floats off player. No screen shake.

### Dodge Animation
Projectile phases past the player and fizzles out. Subtle blue shimmer behind the player. No damage, no shake. Dodge has no **Impact Moment** since there is no consequence to gate on.

### Phase Transition Effect
When an Enemy Phase advances (see `combat` glossary), the HP bar briefly flashes white as the Phase indicator increments. Fires within the Aftermath of the Spell that triggered the transition.

## Sprites & composition

### Pixel Rendering
The visual style. Asset images are rendered with CSS `image-rendering: pixelated` to preserve the retro pixel aesthetic on high-DPI displays. Both DOM-rendered surfaces and the Canvas adhere to the pixel grid.

### ASCII Sprite
A pixel-art sprite authored in source code as a multi-line string template with character-to-color mappings:

```ts
decodePixelArt(`
  ..####..
  .#....#.
  .#.##.#.
  ..####..
`, { '.': 'transparent', '#': '#e0c8a0', /* … */ });
```

Decodes to `{ width, height, pixels[][], palette }`. At init time the decoder paints each sprite to a small off-screen Canvas; during the encounter the renderer `drawImage`s from those caches. See `docs/adr/0005-ascii-sprite-source.md`.

PNG ingestion is a reserved extension point (same internal shape, different parser).

### Palette Slot
A symbolic role within a sprite's palette that can be re-coloured at composition time, e.g. `'skin'`, `'hair'`, `'eye'`, `'cloth'`. The sprite's static palette declares which slot each colour represents; the Player Skin's `palette` field supplies concrete CSS colours per slot.

### Player Skin
The composed visual identity of the Player Figure. Built up from layer choices + palette colours:

```ts
type PlayerSkin = {
  bodyShape: 'male' | 'female';
  hairStyle: 'short' | 'long' | 'curly' | 'bald' | …;
  clothStyle: 'robe' | 'tunic' | 'cape' | …;
  weapon: 'none' | 'staff' | 'wand' | …;
  wardSigilStyle: 'circle' | 'triangle' | 'rune' | …;
  palette: {
    skin: string;
    hair: string;
    eye: string;
    cloth: string;
  };
};
```

Cosmetic only — no gameplay effect. Stored in `localStorage` under `regexfight:skin:v1`, separate from the Run save. See `docs/adr/0006-paper-doll-customization.md`.

v1.1 ships with one variant per dimension + default palette and no customization UI. Adding variants is content-only.

### Player Figure
The composed sprite that represents the Player on the Encounter Canvas. Rendered at draw time as `body[shape][pose] + hair[style][pose] + cloth[style][pose] + weapon[style][pose]` with palette substitution for the slots above. Three poses: Idle, Hit, Counterattack.

### Enemy Figure
The composed sprite that represents an Enemy on the Encounter Canvas. Four poses: Idle, Casting, Hit, Defeated. Authored per Enemy as a single sprite per pose (no paper-doll composition — Enemies are content, not customization). For v1.1, one Enemy (the tutorial) is authored.

> *Defeated* is implemented as desaturation + fade applied to the Idle pose, not a separate sprite, unless an Enemy specifies one.

### Ward Sigil
A small glyph drawn in front of the Player Figure. Visible throughout combat. Two states:

- **Idle** — dim glyph, ambient pulse.
- **Active** — bright, flaring during a Counterattack or briefly during a Backfire attempt.

Shape is determined by `PlayerSkin.wardSigilStyle`; no palette substitution (the magic has its own colour).

### Spell Projectile
A small animated sprite that represents an incoming Spell during Travel. Single shared sprite, tinted by Kind (greenish for Real, reddish for Decoy). Carries no text — Spell Text is rendered separately above it.

### Spell Text
The Spell's string, rendered as floating glyphs near the projectile during phases 1–3. Appears glyph-by-glyph above the enemy during Invocation, rides above the projectile during Travel, persists through Pre-impact, vanishes at Resolution.

## Other terms

### Color Coding for Kinds
The visual contract that distinguishes Real Spells from Decoy Spells. Used consistently across:

- The Encounter Canvas (Spell Projectile tint, Spell Text colour).
- The Observation Log (Prep Screen).
- The Attempt Log (Post-mortem Screen).

Same Kind looks the same across Screens. Drift across surfaces is a bug.

### Color Coding for Outcomes
Distinct from Kind colouring. Each Outcome has its own visual flash colour during Resolution:

- **Counterattack** — green flash on the enemy.
- **Hit** — red flash on the player.
- **Backfire** — orange/amber flash on the player (distinct from Hit).
- **Dodge** — subtle blue shimmer behind the player.

### Render Boundary
The line between `combat`/`run` (which produce state and events) and `view` (which consumes them). React components consume via props/hooks; they never mutate domain state directly. Mutations route back through the app layer.

## Terms borrowed from other contexts

| Term            | Owning context | Why it shows up here                                       |
|-----------------|----------------|------------------------------------------------------------|
| EncounterEvent  | `combat`       | The Encounter Canvas and Event Ticker consume them.        |
| Outcome (Counterattack / Hit / Backfire / Dodge) | `combat` | Drives the Resolution Animation branch; labels in Post-mortem. |
| Observation Log | `run`          | Prep Screen reads it to populate the on-screen log.        |
| Spell, Kind     | `combat`       | Color coding and chip rendering reference these.           |
| Run, Score      | `run`          | Score display on Prep Screen and Post-mortem Screen.       |
| Enemy Phase     | `combat`       | The Encounter Canvas indicates phase transitions; cross-context disambiguation against Animation Phase. |

## What the view context does NOT own

- *Domain logic* — `combat`, `run`.
- *Data on disk* — `content`, `persist`.
- *Test bench evaluation* — when added, the evaluator itself is in `combat`; only its UI wrapping lives here.
- *Enemy authoring* — Enemy Figures are part of `content`; only their rendering lives here.
