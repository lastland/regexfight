/**
 * Public surface of the view context.
 *
 * Re-exports the screens, the editor + log primitives they compose with, and
 * the color-coding constants. The EncounterCanvas is intentionally NOT
 * re-exported — it is an internal detail of EncounterScreen.
 */

export { PrepScreen } from './PrepScreen';
export type { PrepScreenProps } from './PrepScreen';

export { EncounterScreen } from './EncounterScreen';
export type { EncounterScreenProps } from './EncounterScreen';

export { PostMortemScreen } from './PostMortemScreen';
export type {
  PostMortemScreenProps,
  AttemptLogEntry,
} from './PostMortemScreen';

export { WardEditor } from './WardEditor';
export type { WardEditorProps } from './WardEditor';

export { ObservationLog } from './ObservationLog';
export type { ObservationLogProps } from './ObservationLog';

export { KIND_CLASS, KIND_BORDER_CLASS, OUTCOME_CLASS, OUTCOME_LABEL } from './colors';
