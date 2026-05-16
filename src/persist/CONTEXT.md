# Persist — Context Glossary

The persist context owns *durability*: how a Run survives a page reload. In v1 the only durable medium is localStorage; the design leaves room for other adapters later.

The vocabulary here is small. Persistence is intentionally a thin layer — its job is to round-trip Runs without leaking storage concerns into `run` or `combat`.

## Terms

### Save Slot
The named key under which a serialized Run lives in localStorage. v1 uses a single slot: `regexfight:save:v1`.

Multiple slots are *not* a v1 feature. The naming convention reserves the key namespace (`regexfight:save:*`) for future slot variants (e.g. per-character, per-difficulty).

### Serialized Run
The JSON-encoded form of a `Run` value, including a `schemaVersion` field at the top level. Produced by stringifying the runtime Run state; consumed by the loader on page boot.

```ts
type SerializedRun = {
  schemaVersion: number;
  payload: unknown;       // validated by RunSchema after load
};
```

### Schema Version
A monotonically increasing integer identifying the shape of `payload`. The loader uses it to decide whether a saved Run is current, needs Migration, or must be rejected.

v1 ships at `schemaVersion: 1`. Versions are bumped whenever the on-disk shape of Run changes in an incompatible way; the loader gains a corresponding Migration step.

### Migration
A function `(prev: SerializedPayload, fromVersion: number) => SerializedPayload` that transforms a save from one Schema Version to the next. Migrations chain: v1 → v2 → v3 … each migration is a separate function.

v1 has *zero* migrations. The framework is in place so the first real migration is a data change, not an architecture change.

### Save Boundary
The set of operations that *cause* a save: any change to Run state (after each Attempt; after each Observation Log update; after Score changes). v1 saves on every mutation eagerly — there is no manual "save" UI. Frequency is fine because Runs are small (kilobytes, not megabytes).

### Load Pipeline
The boot-time sequence:

1. Read raw string from the Save Slot.
2. `JSON.parse` to `unknown`.
3. Read `schemaVersion`.
4. Run any needed Migrations to bring it to current.
5. Validate the migrated payload with the current `RunSchema` (the `content`-context-owned schema).
6. Hand the typed `Run` to `app` for use.

Any step failing yields a fresh empty Run rather than corrupting state.

## Terms borrowed from other contexts

| Term      | Owning context | Why it shows up here                                            |
|-----------|----------------|------------------------------------------------------------------|
| `Run`     | `run`          | The thing being persisted.                                       |
| `Schema`  | `content`      | The Zod schema for Run is reused at load time for validation.    |

## What the persist context does NOT own

- *Run domain logic* — `run`.
- *Schemas themselves* — `content` (although persist references them).
- *Cloud sync, exporting, importing saves* — out of v1 scope; would extend persist if added.
