# ADR-0001 (run): Stat-driven damage with a modifier hook

**Date**: 2026-05-16
**Status**: Accepted

## Context

A naive damage model would hardcode constants — "each Hit takes 1 HP, each Counterattack deals 1 to enemy." This works for v1 but blocks the roguelike pivot the user explicitly intends: *"In a later iteration, I want to make it rogue-like so every time a player dies, they can use their progress score to purchase bonuses."*

Bonuses = stat modifications. Retrofitting stat-driven damage onto a game that hardcodes `−1` everywhere is a refactor that touches every combat-resolution path. Worse, it changes the test surface — tests that asserted `playerHp -= 1` would all need updating.

The user's framing was: *"Both player and enemy have an attack stat. Let's start simple by making the attack stat the same; but I want to be able to add items/bonuses/debuffs that impact attack stat later."*

## Decision

**Damage flows through stats, not constants.** Specifically:

- `combat`'s damage resolution rule reads:
  - On **Hit** or **Backfire**: `playerHp -= enemy.attack`.
  - On **Counterattack**: `enemyHp -= player.attack`.
- The `player.attack` and `enemy.attack` values are typed `Attack`, not raw `number`.

**Stats are computed as `base + Σ modifiers`, not stored as a primitive.** Every read of a Player stat goes through a stat resolver:

```ts
function effectiveAttack(player: PlayerProfile): Attack {
  return player.baseAttack + sumModifierAttackDeltas(player.modifiers);
}
```

In v1, `Modifier` is the empty union (no Modifier values exist). `effectiveAttack` reduces to `player.baseAttack`. But the *call site* in `combat` calls `effectiveAttack`, not `player.baseAttack` — so adding the first Modifier in the roguelike pivot is a `run`-context data change with no `combat` changes.

**v1 calibration:** `player.attack === enemy.attack === 1`. Damage events therefore subtract `1` in v1, mathematically identical to the naive model — but the *call shape* preserves the architectural commitment.

## Consequences

**Positive:**

- The roguelike pivot is a *content addition*, not a refactor. Adding "+2 Attack" as a Modifier:
  1. Define `Modifier = { kind: 'AttackBoost'; delta: number }` in `run`.
  2. Update `sumModifierAttackDeltas` to switch on the new tag.
  3. Author the modifier as content (e.g. an item description in YAML).
  4. `combat` is untouched.

- Stat-driven damage is also the cleanest way to express enemy-side scaling. Phase 2 of an Enemy has `attack: 2`; the same damage resolution rule applies, no special-casing.

- Tests are robust to v1 calibration changes. Property tests state invariants like "damage dealt by a Counterattack equals `player.attack`" — calibration knob movement doesn't break tests.

**Negative:**

- The indirection adds cognitive overhead for v1, where the only call to `effectiveAttack` is over a one-element-summing pipeline. Worth it for the future-proofing; explicitly noted to prevent a future developer "simplifying" it away.
- Branded `Attack` and `HP` types require explicit construction. Slightly more ceremony at type-construction sites. Worth it to prevent confusable mixing — `playerHp -= enemy.attack` should be type-safe in a way that raw `number - number` is not.
- Score coupling: `progressScore += player.attack` per Counterattack (see `~/.claude/plans/i-want-to-design-drifting-origami.md`). The roguelike pivot will create a positive feedback loop (more Attack → more Score per Counterattack → more bonuses → more Attack). The user is aware and has accepted this as a design lever.

## Alternatives considered

### A. Hardcoded `−1` everywhere, refactor at pivot time
Simplest v1; biggest pivot pain.

**Why not:** The pivot is not a "maybe later." The user has committed to it as a design direction. Refactoring damage call sites later carries (a) test churn, (b) cross-context coordination cost, (c) high risk of introducing damage-math regressions during the refactor. Cheap to do now; expensive to do later.

### B. Hybrid: damage is hardcoded but stats exist
Modifiers exist; combat ignores them in v1.

**Why not:** Worst of both worlds. The architectural commitment is half-made — the combat call sites are inconsistent. The pivot is *still* a refactor, just slightly smaller. Make the commitment fully or not at all.

### C. Damage as a more general resolution function: `resolve(attacker, defender, outcome) → DamageEvent`
A richer abstraction with attack/defense matchups, damage types, resistances.

**Why not:** Genuinely useful, but overengineered for the v1 design. The current rules are simple: Hit/Backfire deal `enemy.attack`, Counterattack deals `player.attack`, Dodge deals nothing. If a future ADR introduces damage types (e.g. arcane vs physical), the abstraction can grow then.

## See also

- `src/run/CONTEXT.md` — HP, Attack, Modifier, PlayerProfile.
- `src/combat/CONTEXT.md` — the four Outcomes and where damage is dealt.
- `docs/adr/0001-five-bounded-contexts.md` — the layer boundaries that make this clean.
- `~/.claude/plans/i-want-to-design-drifting-origami.md` — full design plan, including the v1 calibration values and the score coupling note.
