/**
 * Combat-context types: Spell, Kind, Outcome, EncounterEvent, EncounterState.
 *
 * See src/combat/CONTEXT.md for the glossary that names each of these.
 * See ADRs in src/combat/docs/adr/ for the design constraints they encode.
 */

import type { HP, Attack } from '../run/types';

export type Kind = 'Real' | 'Decoy';

export type Spell = {
  readonly text: string;
  readonly kind: Kind;
};

export type Outcome = 'Capture' | 'Hit' | 'FalseCapture' | 'Dodge';

export type EncounterEvent =
  | {
      readonly tag: 'SpellResolved';
      readonly spell: Spell;
      readonly outcome: Outcome;
      readonly playerHp: HP;
      readonly enemyHp: HP;
    }
  | {
      readonly tag: 'PhaseAdvanced';
      readonly phaseIdx: number;
    }
  | {
      readonly tag: 'EncounterEnded';
      readonly result: 'Victory' | 'Defeat';
      readonly damageTakenThisAttempt: number;
    };

/**
 * Brand for an unvalidated regex source string as written by the player.
 * Construction implies syntax validation has already happened.
 */
declare const __wardBrand: unique symbol;
export type WardSrc = string & { readonly [__wardBrand]: 'WardSrc' };

/**
 * Brand for an unvalidated regex source string as authored in YAML.
 * Validated by the content schema at load time.
 */
declare const __patternBrand: unique symbol;
export type PatternSrc = string & { readonly [__patternBrand]: 'PatternSrc' };

/**
 * EncounterState is the running state of one Attempt. Combat owns
 * its evolution via stepEncounter().
 *
 * The skeleton here pins the shape the combat agent will implement against.
 */
export type EncounterState = {
  readonly enemyId: string;
  readonly pattern: RegExp;
  readonly phases: ReadonlyArray<{
    readonly hpThreshold: number;
    readonly attack: Attack;
    readonly realPool: readonly string[];
    readonly decoyPool: readonly string[];
  }>;
  readonly currentPhaseIdx: number;
  readonly playerMaxHp: HP;
  readonly enemyMaxHp: HP;
  readonly playerHp: HP;
  readonly enemyHp: HP;
  readonly playerAttack: Attack;
  readonly seed: number;
  readonly stepCount: number;
  readonly damageTakenThisAttempt: number;
};
