/**
 * Tests for the persist context.
 *
 * Uses an in-memory Storage stub so tests are fully isolated from the
 * happy-dom global localStorage. Verifies the Load Pipeline contract
 * described in src/persist/CONTEXT.md.
 */

import { describe, expect, it } from 'vitest';

import type { Run } from '../run/types';
import { attack, enemyId, hp, score } from '../run/types';

import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  SAVE_SLOT_KEY,
  __testing,
  clearSaveSlot,
  loadRunFromStorage,
  saveRunToStorage,
  type Migration,
} from './save';

// -- helpers --

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => { m.clear(); },
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    key: (i: number) => Array.from(m.keys())[i] ?? null,
  };
}

function makeRun(): Run {
  const goblinId = enemyId('goblin');
  return {
    enemies: [{ id: goblinId }],
    currentIdx: 0,
    progressScore: score(42),
    observationLogs: {
      [goblinId]: [
        { text: 'foo', kind: 'Real' },
        { text: 'bar', kind: 'Decoy' },
      ],
    },
    visited: { [goblinId]: true },
    enemyAttemptCounts: { [goblinId]: 3 },
    deathCount: 2,
    player: {
      baseHp: hp(20),
      baseAttack: attack(3),
      modifiers: [],
    },
  };
}

// An identity validator: accepts whatever it's given as a Run. Sufficient
// for round-trip tests; the real validator (content's RunSchema.parse)
// is injected by the app composition root.
const identityValidate = (payload: unknown): Run => payload as Run;

describe('saveRunToStorage / loadRunFromStorage', () => {
  it('round-trips a Run', () => {
    const storage = memoryStorage();
    const run = makeRun();

    saveRunToStorage(storage, run);
    const result = loadRunFromStorage(storage, identityValidate);

    expect(result.tag).toBe('loaded');
    if (result.tag === 'loaded') {
      // JSON-encodable deep equality
      expect(JSON.parse(JSON.stringify(result.run))).toEqual(
        JSON.parse(JSON.stringify(run)),
      );
    }
  });

  it('returns no-save when the slot is empty', () => {
    const storage = memoryStorage();
    const result = loadRunFromStorage(storage, identityValidate);
    expect(result).toEqual({ tag: 'no-save' });
  });

  it('stamps schemaVersion: CURRENT_SCHEMA_VERSION on save', () => {
    const storage = memoryStorage();
    saveRunToStorage(storage, makeRun());

    const raw = storage.getItem(SAVE_SLOT_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as {
      schemaVersion: number;
      payload: unknown;
    };
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.payload).toBeDefined();
  });

  it('returns invalid when the stored value is not JSON', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_SLOT_KEY, '{not valid json');
    const result = loadRunFromStorage(storage, identityValidate);
    expect(result.tag).toBe('invalid');
    if (result.tag === 'invalid') {
      expect(result.reason).toMatch(/JSON/i);
    }
  });

  it('returns invalid when the envelope shape is wrong', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_SLOT_KEY, JSON.stringify({ foo: 'bar' }));
    const result = loadRunFromStorage(storage, identityValidate);
    expect(result.tag).toBe('invalid');
    if (result.tag === 'invalid') {
      expect(result.reason).toMatch(/schemaVersion/);
    }
  });

  it('returns invalid for an unknown future schemaVersion', () => {
    const storage = memoryStorage();
    storage.setItem(
      SAVE_SLOT_KEY,
      JSON.stringify({ schemaVersion: 999, payload: {} }),
    );
    const result = loadRunFromStorage(storage, identityValidate);
    expect(result.tag).toBe('invalid');
    if (result.tag === 'invalid') {
      expect(result.reason).toMatch(/newer than supported|migration/i);
    }
  });

  it('returns invalid when validate throws', () => {
    const storage = memoryStorage();
    saveRunToStorage(storage, makeRun());

    const rejectingValidate = (_payload: unknown): Run => {
      throw new Error('schema mismatch: expected foo');
    };
    const result = loadRunFromStorage(storage, rejectingValidate);
    expect(result.tag).toBe('invalid');
    if (result.tag === 'invalid') {
      expect(result.reason).toMatch(/validation failed/);
      expect(result.reason).toMatch(/schema mismatch/);
    }
  });

  it('passes a v1 save through with no migrations', () => {
    const storage = memoryStorage();
    saveRunToStorage(storage, makeRun());

    // Confirm the global MIGRATIONS is empty in v1 (architectural commitment).
    expect(MIGRATIONS).toEqual([]);

    const result = loadRunFromStorage(storage, identityValidate);
    expect(result.tag).toBe('loaded');
  });

  it('clears the save slot', () => {
    const storage = memoryStorage();
    saveRunToStorage(storage, makeRun());
    expect(storage.getItem(SAVE_SLOT_KEY)).not.toBeNull();

    clearSaveSlot(storage);
    expect(storage.getItem(SAVE_SLOT_KEY)).toBeNull();

    const result = loadRunFromStorage(storage, identityValidate);
    expect(result).toEqual({ tag: 'no-save' });
  });
});

describe('migration framework', () => {
  // Test the migration chain directly without mutating the module-level
  // MIGRATIONS array — pass a local migrations array to the internal
  // helper so we can verify the chain works once a real migration exists.
  it('chains migrations from older versions to the target version', () => {
    const v0ToV1: Migration = (payload, fromVersion) => {
      expect(fromVersion).toBe(1);
      // Imagine v1 -> v2 renames `score` to `progressScore`.
      const p = payload as { score?: number; progressScore?: number };
      return { ...p, progressScore: p.score ?? 0 };
    };
    const v2ToV3: Migration = (payload, fromVersion) => {
      expect(fromVersion).toBe(2);
      const p = payload as Record<string, unknown>;
      return { ...p, addedInV3: true };
    };

    // migrations[0] = v1->v2, migrations[1] = v2->v3
    const migrations: Migration[] = [v0ToV1, v2ToV3];

    const result = __testing.runMigrations({ score: 7 }, 1, migrations, 3) as {
      progressScore: number;
      addedInV3: boolean;
    };
    expect(result.progressScore).toBe(7);
    expect(result.addedInV3).toBe(true);
  });

  it('is a no-op when fromVersion equals the target', () => {
    const value = { hello: 'world' };
    expect(__testing.runMigrations(value, 1, [], 1)).toBe(value);
  });

  it('throws when a migration step is missing', () => {
    expect(() => __testing.runMigrations({}, 1, [], 2)).toThrow(
      /no migration registered from schemaVersion 1 to 2/,
    );
  });

  it('throws when the save is newer than the target', () => {
    expect(() => __testing.runMigrations({}, 5, [], 1)).toThrow(
      /newer than supported/,
    );
  });
});
