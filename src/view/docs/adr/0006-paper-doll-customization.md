# ADR-0005 (view): Paper-doll Player customization with palette substitution

**Date**: 2026-05-16
**Status**: Accepted

## Context

The user's v1.1 brief: *"For now, the player is a simple human figure, but we want players to be able to customize this later."* Clarified to include skin colour, hair colour, eye colour, cloth colour, body shape (male/female), weapon (visual only), plus Ward Sigil style.

Two questions follow:

1. What's the **type shape** that captures the customizable surface, and where does the value live?
2. How much of the customization surface actually ships in v1.1 — type only, palette UI only, full UI?

The type shape is load-bearing because the *rendering pipeline* differs dramatically depending on whether the Player Figure is a single sprite or a composition of layers. If we ship "one composed sprite per pose" in v1.1 and later try to retrofit layered composition, that's a renderer rewrite. If we ship the composition pipeline now with one variant per layer, adding variants later is content-only.

## Decision

Ship the **full type and the composition renderer** in v1.1. Ship **one default variant per dimension** and no customization UI. Adding more variants later is sprite authoring; adding the UI is a follow-on milestone.

### Type shape

```ts
type PlayerSkin = {
  readonly bodyShape: 'male' | 'female';
  readonly hairStyle: 'short' | 'long' | 'curly' | 'bald';
  readonly clothStyle: 'robe' | 'tunic' | 'cape';
  readonly weapon: 'none' | 'staff' | 'wand';
  readonly wardSigilStyle: 'circle' | 'triangle' | 'rune';
  readonly palette: {
    readonly skin: string;     // CSS color
    readonly hair: string;
    readonly eye: string;
    readonly cloth: string;
  };
};
```

User-facing labels match the user's wording exactly (e.g. `'male' | 'female'`); per the project's "treat user-authored content as read-only" rule, those labels are not paraphrased to "masculine/feminine" or similar without an explicit instruction.

Weapon is *visual only* — no gameplay effect. (Locked separately by user.)

### Composition pipeline

For each pose ∈ `{ idle, hit, counterattack }`:

1. Draw `bodySprites[bodyShape][pose]`, substituting palette slots `@skin`, `@eye`, plus a fixed black outline.
2. Composite `hairSprites[hairStyle][pose]` on top, substituting `@hair`.
3. Composite `clothSprites[clothStyle][pose]` on top, substituting `@cloth`.
4. Composite `weaponSprites[weapon][pose]` on top (for `weapon: 'none'`, a transparent same-sized sprite — no special-casing).
5. Cache the composed pose in an off-screen Canvas, keyed by `(pose, skinPaletteHash)`.

Cache invalidates when `PlayerSkin` changes. At v1.1 — when there's no UI — the skin never changes after startup, so the cache is paid once.

The Ward Sigil is composed separately (`wardSigilStyle` lookup, no palette substitution — magic has its own colour).

### Storage

Active `PlayerSkin` lives in `localStorage` under `regexfight:skin:v1`, **separate from the Run save**. Rationale:

- Cosmetic preference, not gameplay state.
- A player switching skins shouldn't dirty their Run save.
- A single skin choice should persist across multiple Runs and saves.

If the key is missing or invalid, the default skin (`DEFAULT_SKIN` constant in `view/skin/defaults.ts`) is used.

### v1.1 ship state

- One variant per dimension authored:
  - `bodyShape: 'male'` (default — could be `'female'`; the user named both, neither is privileged in the spec).
  - `hairStyle: 'short'`.
  - `clothStyle: 'robe'`.
  - `weapon: 'none'`.
  - `wardSigilStyle: 'circle'`.
- Default palette: neutral skin tone, brown hair, brown eye, blue-grey cloth (concrete values picked during sprite authoring).
- **No customization UI in v1.1.** No selector, no colour pickers. The skin is fixed at the default.
- All layers animate per pose (locked separately) — three pose sprites per layer.

### Adding variants later

Strictly additive:

- Add a new sprite (e.g. `hairSprites['long']['idle']`, etc.).
- Extend the literal type's union (`hairStyle: 'short' | 'long' | …`).
- TypeScript's exhaustiveness check forces the renderer to handle the new variant (it doesn't — variant lookup is `hairSprites[skin.hairStyle][pose]` which is dynamic).

### Building the customization UI later

A planned future milestone. Out of scope for v1.1. The shape it'll take:

- A Prep Screen panel with dropdowns for body / hair / cloth / weapon / Ward Sigil and four colour pickers for the palette slots.
- Mutates the localStorage value.
- Preview pane showing the composed Player Figure in idle pose.

The architectural prep done in v1.1 means this UI is a self-contained component; the renderer doesn't change.

## Consequences

**Positive:**

- **Customization is a content addition, not a refactor.** Once a sprite for a new haircut is authored, it ships.
- **Cosmetic state is properly separated from gameplay state.** Switching skins never affects a Run.
- **Type discipline.** Palette slots are typed strings; misuse is a compile error.
- **Renderer is honest.** It composes layers all the time, even when there's only one option per layer. No "pretend it's a composed figure" lie.

**Negative:**

- **v1.1 authoring cost.** One pose was one sprite; one pose is now four (body + hair + cloth + weapon). ~12 player layer sprites total for v1.1, instead of 3. Mitigated by ASCII sprite ergonomics; still real.
- **Renderer complexity now.** Building the composition pipeline before there's anything to customize is upfront investment. Justified by avoiding the eventual rewrite.
- **Customization "is shipping" with no UI to use it.** A reasonable concern. The alternative (ship one composed sprite, build composition when UI lands) trades upfront cost for downstream refactor cost — and the refactor cost is higher because it touches the renderer that's now spread across the codebase.

## Alternatives considered

### A. Single composed sprite per pose; build composition when UI ships
Defer the architecture.

**Why not:** When the UI ships, every place that touches the Player Figure has to change. The renderer rewrite is non-trivial and re-introduces drift risk (caches, palette substitution, layer ordering). Build the right thing once.

### B. Palette-only customization in v1.1 (no body/hair/cloth styles)
Ship colour sliders. Geometry stays single.

**Why not:** Half the customization surface the user named. The renderer would have a partial composition system (palette substitution only) that we'd have to extend later anyway. Not materially simpler than the full architecture.

### C. Three skin "presets" in v1.1 instead of free composition
Hardcode three composed Player Figures; player picks one.

**Why not:** Reduces to "no customization, just a sprite swap" — the type carries no information about WHY one skin differs from another, so we can't later let the player tweak just the cloth colour or just the hair style.

### D. Make `weapon` affect gameplay
Wand: faster, lower damage. Staff: slower, higher damage.

**Why not:** User explicitly said visual only. Adding gameplay coupling would conflict with the counterattack-only damage model.

### E. Make Ward Sigil customizable down to palette colours too
Full freedom on the magic's appearance.

**Why not:** The Ward is a *game-world artifact*, not a player persona. Keeping its appearance constrained to a small set of shape variants preserves the metaphor (different magical styles, not different paint jobs). Easy to relax later if desired.

## See also

- `src/view/CONTEXT.md` — Player Skin, Player Figure, Ward Sigil, Palette Slot, ASCII Sprite glossary entries.
- `src/view/docs/adr/0005-ascii-sprite-source.md` — the sprite source that the composition system consumes.
- `src/view/docs/adr/0004-five-phase-spell-animation.md` — which Player Figure poses are used during which phase.
