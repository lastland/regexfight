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

**Match semantics.** The engine tests the Ward end-to-end (full match) against each Spell — it wraps the Ward as `^(?:source)$` at resolution time. The player just writes the body; player-typed `^`/`$` are accepted but redundant. See the Amendment in `docs/adr/0003-full-anchored-match.md`.

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
The result of testing a Ward against a single Spell. Four cases, partitioned by Kind × Ward-matches. The names are *narrative-effect* names (what happens in the fiction) rather than matching-semantics names — see `docs/adr/0005-outcome-rename-counterattack.md`.

```ts
type Outcome = 'Counterattack' | 'Hit' | 'Backfire' | 'Dodge';
```

|              | Ward matches      | Ward rejects |
|--------------|-------------------|--------------|
| Spell is Real  | **Counterattack** | **Hit**       |
| Spell is Decoy | **Backfire**      | **Dodge**     |

- **Counterattack** — correct match against a Real Spell. The Ward catches the Enemy's incoming attack and reflects it back; deals `player.attack` damage to the Enemy.
- **Hit** — missed a Real Spell. The Enemy's attack lands; deals `enemy.attack` damage to the Player.
- **Backfire** — fooled by a Decoy. The Ward "tries to catch" a feint and the trap springs; deals `enemy.attack` damage to the Player (symmetric with Hit).
- **Dodge** — correctly rejected a Decoy. No damage; the Decoy phases past.

**Counterattack-only damage model**: the Player has no separate attack action. The Player damages the Enemy *only* by Counterattacking a Real Spell — the Ward catches the Enemy's incoming attack and reflects it. Decoys are *not* real attacks, so even matching them (Backfire) does not damage the Enemy; the Enemy never takes damage from a Decoy. Practical consequence for content authors: enemy `baseHp` should be tuned to the Real-spell rate of the spell stream, not its total length. With a ~50/50 Real/Decoy mix, expected ticks-to-win is ~`2 × baseHp / player.attack`.

### Phase
A stage of an Encounter. Each Phase carries its own Spell pool (Reals + Decoys, both consistent with the Enemy's single Pattern) and its own `attack` value. Phases transition at HP thresholds.

The Pattern does *not* change across Phases. What changes is the *sample* the Player gets to see: later Phases reveal distinguishing edge cases that separate the true Pattern from plausible-but-wrong approximations.

### Encounter
One fight against one Enemy, from start to one HP hitting 0. Composed of an ordered sequence of **Phases** the Enemy moves through as its HP drops.

An Encounter is a pure state machine driven by a deterministic Spell stream and a frozen Ward.

### Real Rate
A Phase-scoped probability — the chance that any given drawn Spell from this Phase is a Real (versus a Decoy). Each Phase carries its own resolved Real Rate; if the YAML omits a per-Phase value, the Phase falls back to the Enemy-level default (which itself defaults to `0.5` when also omitted). See `src/combat/docs/adr/0006-per-phase-real-rate.md` for the design rationale.

In `EncounterState`, the resolved Real Rate lives on each `phases[i]` entry as a non-optional `number`, set once at `startEncounter()` and never mutated. `pickSpell()` reads from the *currently-active* Phase, so changing Phases naturally changes the kind distribution.

Floating Phantasm authors `realRate: 0.7` on Phase 1 (brisk shape-learning) and `realRate: 0.5` on Phase 2 (max edge-Decoy exposure when the player most needs to *see* the boundary cases).

Real Rate affects expected encounter duration: only Counterattacks damage the Enemy, so higher Real Rate means faster Encounters (more counter-opportunities per second). `baseHp` should be tuned with the Phase-by-Phase Real Rates in mind — at average rate `r` and player attack `a`, expected ticks-to-win is roughly `baseHp / (r × a)`.

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
