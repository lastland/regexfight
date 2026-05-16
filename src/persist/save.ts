/**
 * Persist context — localStorage adapter for Run.
 *
 * Implements the Load Pipeline from src/persist/CONTEXT.md:
 *   1. Read raw string from the Save Slot.
 *   2. JSON.parse to `unknown`.
 *   3. Read `schemaVersion`.
 *   4. Run any needed Migrations to bring it to current.
 *   5. Validate the migrated payload with a caller-supplied validator.
 *   6. Return a typed Run wrapped in a LoadResult.
 *
 * Design notes:
 *
 * - All Storage access is explicit: every exported function takes a
 *   `Storage` parameter. There are NO direct `localStorage` references in
 *   this module. The app composition root passes `window.localStorage`;
 *   tests pass an in-memory stub. This keeps the module SSR-safe and
 *   trivially testable.
 *
 * - Validation is injected, not imported. The `content` context owns the
 *   Run schema (Zod), and at the time this module was authored the
 *   `RunSchema` does not yet exist in `src/content/`. We chose to keep
 *   persist decoupled from content by accepting `validate: (unknown) =>
 *   Run` as a parameter to `loadRunFromStorage`. The caller (app
 *   composition root) wires `RunSchema.parse` in. This stays the safer
 *   design even after content lands — persist depends only on the
 *   Run type (compile-time), never on content (runtime).
 *
 * - `loadRunFromStorage` never throws on bad input. It returns a discriminated
 *   `LoadResult`. The caller decides whether to start a fresh Run, surface
 *   a warning, etc.
 *
 * See src/persist/CONTEXT.md for terminology.
 */

import type { Run } from '../run/types';

export const SAVE_SLOT_KEY = 'regexfight:save:v1';
export const CURRENT_SCHEMA_VERSION = 1;

export type SerializedRun = {
  schemaVersion: number;
  payload: unknown;
};

export type LoadResult =
  | { tag: 'loaded'; run: Run }
  | { tag: 'no-save' }
  | { tag: 'invalid'; reason: string };

/**
 * A Migration transforms a payload from version `fromVersion` to version
 * `fromVersion + 1`. Migrations chain: MIGRATIONS[i] migrates from
 * version (i+1) to version (i+2). Concretely:
 *
 *   MIGRATIONS[0] : v1 -> v2
 *   MIGRATIONS[1] : v2 -> v3
 *   ...
 *
 * v1 ships with zero migrations. The framework is present so the first
 * real schema change is a data delta, not an architecture delta.
 */
export type Migration = (payload: unknown, fromVersion: number) => unknown;

export const MIGRATIONS: Migration[] = [];

/**
 * Apply the chain of migrations needed to bring `payload` from
 * `fromVersion` up to `CURRENT_SCHEMA_VERSION`.
 *
 * Returns the migrated payload, or throws if no migration covers a
 * required step (which the caller catches and converts to an `invalid`
 * LoadResult).
 *
 * Exposed only for unit-testability. Callers should use
 * `loadRunFromStorage`.
 */
function runMigrations(
  payload: unknown,
  fromVersion: number,
  migrations: ReadonlyArray<Migration>,
  targetVersion: number,
): unknown {
  if (fromVersion === targetVersion) {
    return payload;
  }
  if (fromVersion > targetVersion) {
    throw new Error(
      `save schemaVersion ${fromVersion} is newer than supported ${targetVersion}`,
    );
  }
  let current = payload;
  for (let v = fromVersion; v < targetVersion; v++) {
    // MIGRATIONS[i] migrates from version (i+1) to version (i+2),
    // i.e. MIGRATIONS[v-1] migrates from v to v+1.
    const migration = migrations[v - 1];
    if (!migration) {
      throw new Error(
        `no migration registered from schemaVersion ${v} to ${v + 1}`,
      );
    }
    current = migration(current, v);
  }
  return current;
}

/**
 * Read the save slot, parse, migrate as needed, validate, and return
 * a typed Run. Never throws — all error paths produce an `invalid` or
 * `no-save` result.
 *
 * The `validate` callback is the schema parser; it should throw on
 * invalid input. `RunSchema.parse` from `content` matches this shape.
 */
export function loadRunFromStorage(
  storage: Storage,
  validate: (payload: unknown) => Run,
): LoadResult {
  const raw = storage.getItem(SAVE_SLOT_KEY);
  if (raw === null) {
    return { tag: 'no-save' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      tag: 'invalid',
      reason: `could not parse save slot as JSON: ${stringifyError(err)}`,
    };
  }

  if (!isSerializedRun(parsed)) {
    return {
      tag: 'invalid',
      reason: 'save slot does not have the shape { schemaVersion, payload }',
    };
  }

  const { schemaVersion, payload } = parsed;

  let migrated: unknown;
  try {
    migrated = runMigrations(
      payload,
      schemaVersion,
      MIGRATIONS,
      CURRENT_SCHEMA_VERSION,
    );
  } catch (err) {
    return {
      tag: 'invalid',
      reason: `migration failed: ${stringifyError(err)}`,
    };
  }

  let run: Run;
  try {
    run = validate(migrated);
  } catch (err) {
    return {
      tag: 'invalid',
      reason: `validation failed: ${stringifyError(err)}`,
    };
  }

  return { tag: 'loaded', run };
}

/**
 * Serialize a Run and write it to the save slot. Always stamps the
 * current schema version. Idempotent — overwrites any prior save.
 */
export function saveRunToStorage(storage: Storage, run: Run): void {
  const envelope: SerializedRun = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    payload: run,
  };
  storage.setItem(SAVE_SLOT_KEY, JSON.stringify(envelope));
}

/**
 * Remove the save slot entirely. After this, `loadRunFromStorage`
 * returns `{ tag: 'no-save' }`.
 */
export function clearSaveSlot(storage: Storage): void {
  storage.removeItem(SAVE_SLOT_KEY);
}

// -- internal helpers --

function isSerializedRun(value: unknown): value is SerializedRun {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj['schemaVersion'] === 'number' && 'payload' in obj;
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  try {
    return String(err);
  } catch {
    return '<unstringifiable error>';
  }
}

// Re-exported for tests that want to exercise the migration framework
// without going through the full load pipeline.
export const __testing = { runMigrations };
