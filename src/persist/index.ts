/**
 * Public surface of the persist context.
 *
 * See src/persist/CONTEXT.md for terminology and src/persist/save.ts for
 * implementation notes.
 */

export {
  SAVE_SLOT_KEY,
  CURRENT_SCHEMA_VERSION,
  loadRunFromStorage,
  saveRunToStorage,
  clearSaveSlot,
} from './save';

export type { Migration, LoadResult, SerializedRun } from './save';
