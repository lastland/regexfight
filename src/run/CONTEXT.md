# Run — Context Glossary

The run context owns the meta-game: progression through a campaign, accumulated knowledge per Enemy, and the player's evolving stats. It sits *above* an Encounter — a Run is a sequence of Encounters with persistent state.

This is the context the eventual roguelike pivot lands in. Stats, modifiers, and progress score all live here.

## Terms

### Run
The player's session-spanning state. A Run holds the Campaign roster, where the player is within it, what they know about each Enemy, their accumulated score, and the Player's current stats including any Modifiers.

```ts
type Run = {
  enemies: Enemy[];
  currentIdx: number;
  progressScore: Score;
  observationLogs: Record<Enemy['id'], Spell[]>;
  visited: Record<Enemy['id'], boolean>;
  player: PlayerProfile;
};
```

A Run is the unit of save state — `persist` serializes Runs.

### Campaign
The ordered list of Enemies that constitutes a Run's intended journey. In v1 this is a static list (hand-authored content order). In the roguelike pivot, the Campaign becomes a procedural selector. The Run type does not change between v1 and the pivot — only how `enemies` is populated changes.

### Attempt (run-side meaning)
An Attempt in the `run` context is an element of the Player's history against a specific Enemy. It's *the same thing* as an `combat` Attempt — same start, same outcome — but Run cares about the *aggregate* of Attempts (Attempts-against-enemy-X count, Attempts-since-last-victory streak), where Combat cares about the *individual* one currently in progress.

### Observation Log
What the player *knows* about an Enemy: every Spell ever observed against that Enemy, deduplicated by text. Each entry carries Spell text and Kind. Outcome is *not* part of the Observation Log — Outcomes are per-Attempt and live in the `combat` Attempt Log.

```ts
type ObservationLog = Spell[];   // deduped by text
```

Populated in two ways:

1. **Seed**: when the player first reaches an Enemy, that Enemy's `seedSpells` (a `content`-owned config) are inserted.
2. **Merge**: at the end of each Attempt, the Attempt Log's Spells are merged in (dedup by text).

### Visited
A boolean per Enemy, tracking whether the player has ever reached that Enemy's prep screen. Used to guard against re-seeding the Observation Log on every visit — Seed Spells should only populate *once*, on first arrival.

### HP
A Player or Enemy's hit-point pool. Damage subtracts; reaching 0 ends the Encounter.

```ts
type HP = number & { readonly __brand: 'HP' };
```

The Run owns the Player's `baseHp`. The Enemy's `baseHp` is configured by `content`. The *current* HP during an Encounter lives in the Encounter state, which is in `combat`.

### Attack
A Player or Enemy's damage stat. Damage dealt per successful Capture or per Hit landed equals the attacker's effective Attack.

```ts
type Attack = number & { readonly __brand: 'Attack' };
```

Effective Attack is computed by `effectiveAttack(player) = base + Σ modifiers.attackDelta`. In v1, `modifiers` is empty, so effective Attack = base. The roguelike pivot adds Modifiers; the calculation does not change.

### Modifier
A typed adjustment applied to Player stats. In v1, the `Modifier` type exists but its union is empty (no shipped Modifiers). The architectural commitment is that *every* read of a stat must go through the stat resolver, so introducing the first real Modifier in the roguelike pivot is a data change, not a code change.

```ts
type Modifier = never;   // empty in v1
```

See `docs/adr/0001-stat-driven-damage-and-modifiers.md`.

### Progress Score
The accumulating reward currency. Earned by:

- `+ player.attack` per **Capture** (i.e. score-per-Capture equals damage-dealt-per-Capture).
- `+ enemy.defeatBounty` on Enemy defeat.
- `+ enemy.flawlessBonus` on defeat *with zero damage taken in that Attempt*.

Score accumulates across the entire Run. In v1 it is tracked but not spent. The roguelike pivot will introduce a shop that consumes Score for Modifiers.

```ts
type Score = number & { readonly __brand: 'Score' };
```

### Defeat Bounty
A per-Enemy lump-sum Score reward granted on defeat. Authored in YAML; scales with intended difficulty.

### Flawless Bonus
An *additional* per-Enemy Score reward granted only when an Attempt ends in defeat-of-Enemy with `damageTakenThisAttempt === 0`. Rewards perfect play.

### PlayerProfile
The mutable, Run-scoped Player. Holds `baseHp`, `baseAttack`, and `modifiers`.

```ts
type PlayerProfile = {
  baseHp: HP;
  baseAttack: Attack;
  modifiers: Modifier[];
};
```

`baseHp` and `baseAttack` come from `data/player.yaml`; `modifiers` is the slot the roguelike pivot fills.

## Terms borrowed from other contexts

| Term       | Owning context | Why it shows up here                                  |
|------------|----------------|--------------------------------------------------------|
| `Enemy`    | `content`      | The Campaign is a list of them; the player has logs per Enemy. |
| `Spell`    | `combat`       | The Observation Log stores them (text + kind only).    |
| `Outcome`  | `combat`       | The damage resolution rules reference them.            |

## What the run context does NOT own

- *Spell-by-spell evaluation* — `combat`.
- *Enemy authoring or pool definitions* — `content`.
- *Serialization of the Run to disk* — `persist`.
- *Screens or UI* — `view`.
