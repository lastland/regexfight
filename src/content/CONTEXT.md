# Content — Context Glossary

The content context owns *authoring*: the YAML files in `data/`, the Zod schemas that validate them, and the rules an Enemy designer must follow when writing new content.

The audience for this context is *enemy designers* (in v1, just the developer), not players. The vocabulary reflects that.

## Terms

### Enemy
A typed configured entity assembled from one YAML file under `data/enemies/`. Holds the Pattern, the Phase pools, the stat values (HP, defeat bounty, flawless bonus), the Seed Spells, and an optional **Real Rate**.

```ts
type Enemy = {
  id: string;
  name: string;
  pattern: PatternSrc;
  baseHp: HP;
  defeatBounty: Score;
  flawlessBonus: Score;
  realRate?: number;   // 0..1 (exclusive); default 0.5 (even mix)
  phases: Phase[];
  seedSpells: Spell[];
};
```

`realRate` biases the Spell stream toward Reals (>0.5) or Decoys (<0.5). The tutorial uses `0.7` so the player sees more counter-opportunities and the fight feels combat-paced. See `combat/CONTEXT.md` for the gameplay implications and baseHp tuning advice.

Used downstream by `run` (Campaign roster) and `combat` (consumed during an Encounter).

### Pattern Source
The unvalidated regex string as written in YAML. Validated at load time by attempting `new RegExp(s)` inside a Zod refinement; an invalid Pattern Source aborts content load with a precise authoring error.

```ts
type PatternSrc = string & { readonly __brand: 'PatternSrc' };
```

### Phase Pool
The pair of arrays (Reals, Decoys) attached to a Phase. The designer asserts that every entry in `realPool` is a string matching the Enemy's Pattern, and every entry in `decoyPool` is a string *not* matching it. Schema validation enforces this at load time.

```ts
type PhasePool = {
  realPool: string[];
  decoyPool: string[];
};
```

### Phase (content view)
Authored config for a stage of an Encounter. Holds an HP threshold (the fraction of Enemy max HP at which this Phase begins), an Attack value, and a Phase Pool. Authored as an entry in the Enemy's `phases` array.

```ts
type Phase = {
  hpThreshold: number;
  attack: Attack;
  realPool: string[];
  decoyPool: string[];
};
```

`combat` sees the same data as a runtime entity.

### Seed Spells
A small list of (Spell text, Kind) pairs declared per Enemy. Pre-populates the Player's Observation Log when they first reach this Enemy — so the first prep screen has *something* for the player to start inferring a Ward from.

**Authoring constraints (enforced by schema):**

- Each Seed Spell's `text` must appear in the corresponding Phase 1 Pool (in the Real pool if `kind: Real`, in the Decoy pool if `kind: Decoy`).
- Seed Spells should be drawn only from Phase 1 — never from later Phases — so the player isn't spoiled on the distinguishing edge cases before they ever fight.
- Size guidance: 4–6 Seed Spells per Enemy (2–3 Reals + 2–3 Decoys). Enough to suggest the shape, not enough to make the regex trivial.

### Spell Pool
The union, across all Phases, of an Enemy's Real and Decoy strings. Not a stored type — `combat` derives this from the Phase array at runtime. Named here because authors think in terms of "the Enemy's pool" as a whole.

### Schema
A Zod schema validating a piece of YAML against the typed domain model. The schemas are the *single source of truth* for the runtime types — TS types are derived via `z.infer<typeof Schema>`, never written separately.

```ts
const EnemySchema = z.object({
  id: z.string(),
  pattern: z.string().refine(s => { try { new RegExp(s); return true; } catch { return false; } }, "invalid regex"),
  /* ... */
});
type Enemy = z.infer<typeof EnemySchema>;
```

See `docs/adr/0001-yaml-data-zod.md`.

### Validation
The act of running an authored YAML file through its Zod schema. Validation produces either a typed value or a precise structured error pointing at the offending field. Validation runs at load time, before `combat` or `run` ever see the data.

### Authoring Discipline
A set of *unenforced-by-code* design conventions the content author follows when designing an Enemy:

- The Pattern should be *learnable* — players should be able to infer it from a corpus of examples in a few attempts.
- Phase 1 spells should be ambiguous: multiple almost-right regexes should pass them.
- Each subsequent Phase should add *distinguishing edge cases* — strings that reject the almost-right regexes while still satisfying the true Pattern (or violating it, for Decoys).
- See `docs/adr/0004-multi-phase-shared-pattern.md` for the design philosophy.

## Terms borrowed from other contexts

| Term       | Owning context | Why it shows up here                                              |
|------------|----------------|--------------------------------------------------------------------|
| `Spell`    | `combat`       | Seed Spells are Spells with text + kind.                           |
| `Kind`     | `combat`       | Each Seed Spell is labeled `Real` or `Decoy`.                      |
| `HP`       | `run`          | Enemy `baseHp` is authored here.                                   |
| `Attack`   | `run`          | Phase `attack` values are authored here.                           |
| `Score`    | `run`          | `defeatBounty` and `flawlessBonus` are authored here.              |

## What the content context does NOT own

- *Runtime sim behavior* — `combat`.
- *Player state, score accumulation* — `run`.
- *Where the data lives between sessions* — `persist`.
- *How the data is displayed* — `view`.
