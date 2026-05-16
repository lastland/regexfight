# Combat — Context Glossary

The combat context owns the puzzle. It defines what a fight *is* and how each tick of a fight resolves.

Everything in this glossary is pure, deterministic given inputs, and free of I/O. The combat sim never touches the DOM, the network, or the disk; it consumes data prepared by `content` and emits events consumed by `view`.

## Terms

### Pattern
The regular expression that defines an Enemy's repertoire. *Authored, hidden from the player.* All of an Enemy's Spells either satisfy or violate this single Pattern across every Phase. The Pattern never changes mid-Encounter.

Type: `RegExp` (constructed from a validated `PatternSrc` string at load time).

### Ward
The player's regular expression. Submitted at the prep screen, **frozen** for the duration of an Attempt. The Ward's purpose is to discriminate Real spells from Decoys — that is, to approximate the Pattern from observation alone.

Type: `RegExp` (constructed from a `WardSrc` string after syntax validation).

### Spell
A single string emitted by an Enemy. Has both a `text` and a `kind`.

```ts
type Spell = { text: string; kind: Kind };
```

### Kind
The truth-value-relative-to-the-Pattern that each Spell carries.

```ts
type Kind = 'Real' | 'Decoy';
```

- **Real** — `text` matches the Pattern. The Ward *should* match it.
- **Decoy** — `text` does *not* match the Pattern. The Ward *should* reject it.

A Spell's Kind is a fixed property of the Spell as authored; it is rendered to the player live (color-coded). Truth here is not a secret — what's a puzzle is the *Pattern*.

### Outcome
The result of testing a Ward against a single Spell. Four cases, partitioned by Kind × Ward-matches:

```ts
type Outcome = 'Capture' | 'Hit' | 'FalseCapture' | 'Dodge';
```

|              | Ward matches | Ward rejects |
|--------------|--------------|--------------|
| Spell is Real  | **Capture**  | **Hit**       |
| Spell is Decoy | **FalseCapture** | **Dodge**     |

- **Capture** — correct match against a Real. Deals `player.attack` damage to the Enemy.
- **Hit** — missed a Real. Deals `enemy.attack` damage to the Player.
- **FalseCapture** — fooled by a Decoy. Deals `enemy.attack` damage to the Player (symmetric with Hit).
- **Dodge** — correctly rejected a Decoy. No damage.

**Counterattack-only damage model**: the Player has no separate attack action. The Player damages the Enemy *only* by Capturing a Real Spell — the Ward catches the Enemy's incoming attack and reflects it. Decoys are *not* real attacks, so even matching them (FalseCapture) does not damage the Enemy; the Enemy never takes damage from a Decoy. Practical consequence for content authors: enemy `baseHp` should be tuned to the Real-spell rate of the spell stream, not its total length. With a ~50/50 Real/Decoy mix, expected ticks-to-win is ~`2 × baseHp / player.attack`.

### Phase
A stage of an Encounter. Each Phase carries its own Spell pool (Reals + Decoys, both consistent with the Enemy's single Pattern) and its own `attack` value. Phases transition at HP thresholds.

The Pattern does *not* change across Phases. What changes is the *sample* the Player gets to see: later Phases reveal distinguishing edge cases that separate the true Pattern from plausible-but-wrong approximations.

### Encounter
One fight against one Enemy, from start to one HP hitting 0. Composed of an ordered sequence of **Phases** the Enemy moves through as its HP drops.

An Encounter is a pure state machine driven by a deterministic Spell stream and a frozen Ward.

### Attempt
A single instance of an Encounter — one start, one outcome (Victory or Defeat). The Player may have many Attempts against the same Encounter; each Attempt produces its own ephemeral **Attempt Log**.

`Attempt` is a `combat` term for "one try"; the `run` context also has a notion of Attempt as an element of the Run's history. Cross-context translation point.

### Attempt Log
Ephemeral record of every Spell encountered in the current Attempt with its resolved Outcome. Feeds the post-mortem screen. Merged into the `run`-owned Observation Log when the Attempt ends.

```ts
type AttemptLogEntry = { spell: Spell; outcome: Outcome };
```

### EncounterEvent
The events emitted by the combat sim as state advances. Consumed by `view` to drive rendering.

```ts
type EncounterEvent =
  | { tag: 'SpellResolved'; spell: Spell; outcome: Outcome; playerHp: HP; enemyHp: HP }
  | { tag: 'PhaseAdvanced'; phaseIdx: number }
  | { tag: 'EncounterEnded'; result: 'Victory' | 'Defeat'; damageTakenThisAttempt: number };
```

## Terms borrowed from other contexts

| Term       | Owning context | Why it shows up here                                   |
|------------|----------------|---------------------------------------------------------|
| `HP`       | `run`          | Consumed during damage resolution.                      |
| `Attack`   | `run`          | Consumed during damage resolution; effective Attack comes from `run`'s stat resolver. |
| `Enemy`    | `content`      | An Enemy *as a configured entity* is content; combat consumes its Pattern, Phases, and Pools. |

## What the combat context does NOT own

- *Player progression, score, or run state* — `run`.
- *Enemy authoring or YAML schemas* — `content`.
- *Rendering* — `view`.
- *Save/load* — `persist`.
