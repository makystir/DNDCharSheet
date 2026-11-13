import { getClass } from '../data/classes';
import { getBackground } from '../data/backgrounds';
import { getSpecies } from '../data/species';

/**
 * A saved, unfinished character-creation wizard, so closing or reloading the
 * page doesn't throw away a build in progress. Pure helpers over a Storage
 * (localStorage in the app, an in-memory stub in tests). A draft that doesn't
 * look like one this version wrote, or names a class/background/species the
 * app doesn't know, is discarded rather than half-applied.
 */

export const WIZARD_DRAFT_KEY = 'dnd-wizard-draft-v1';

export interface WizardDraft {
  v: 1;
  savedAt: number;
  step: number;
  furthest: number;
  name: string;
  classId: string;
  backgroundId: string;
  allocation: Record<string, number>;
  speciesId: string;
  speciesChoices: Record<string, string>;
  chosenLanguages: string[];
  grantedLanguages: string[];
  toolProficiency: string;
  skillChoices: string[];
  spellPicks: { cantrips?: string[]; prepared?: string[]; spellbook?: string[] };
  abilityMethod: 'standard-array' | 'point-buy' | 'roll';
  arrayAssignment: Record<string, number>;
  pointBuyScores: Record<string, number>;
  rolledPool: number[] | null;
  rolledAssignment: Record<string, number>;
  gender: 'male' | 'female' | 'neutral';
  alignment: string;
  details: Record<string, string>;
  equipmentChoice: 'A' | 'B';
  classOption: string;
  classPicks: Record<string, string>;
  cart: Record<string, number>;
  trinketRoll: number | null;
  /** Class Features step picks (optional: older drafts have none). */
  features?: {
    fightingStyle?: string;
    classChoices?: Record<string, string[]>;
    expertise?: string[];
    weaponMasteries?: string[];
  };
}

/** A well-formed (optional) Class Features block. */
function isFeatures(v: unknown): boolean {
  if (v === undefined) return true;
  if (!isObj(v)) return false;
  return (
    (v.fightingStyle === undefined || typeof v.fightingStyle === 'string') &&
    (v.classChoices === undefined || (isObj(v.classChoices) && Object.values(v.classChoices).every(isStrArr))) &&
    (v.expertise === undefined || isStrArr(v.expertise)) &&
    (v.weaponMasteries === undefined || isStrArr(v.weaponMasteries))
  );
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isNumRecord = (v: unknown) => isObj(v) && Object.values(v).every((x) => typeof x === 'number' && Number.isFinite(x));
const isStrRecord = (v: unknown) => isObj(v) && Object.values(v).every((x) => typeof x === 'string');
const isInt = (v: unknown, min: number) => typeof v === 'number' && Number.isInteger(v) && v >= min;

/** True when `value` is a well-formed draft naming only known content. */
export function isWizardDraft(value: unknown): value is WizardDraft {
  if (!isObj(value) || value.v !== 1) return false;
  const d = value;
  const known =
    typeof d.classId === 'string' &&
    (d.classId === '' || getClass(d.classId) !== undefined) &&
    typeof d.backgroundId === 'string' &&
    (d.backgroundId === '' || getBackground(d.backgroundId) !== undefined) &&
    typeof d.speciesId === 'string' &&
    (d.speciesId === '' || getSpecies(d.speciesId) !== undefined);
  const spellPicks = d.spellPicks;
  return (
    known &&
    isInt(d.savedAt, 0) &&
    isInt(d.step, 0) &&
    isInt(d.furthest, 0) &&
    typeof d.name === 'string' &&
    isNumRecord(d.allocation) &&
    isStrRecord(d.speciesChoices) &&
    isStrArr(d.chosenLanguages) &&
    isStrArr(d.grantedLanguages) &&
    typeof d.toolProficiency === 'string' &&
    isStrArr(d.skillChoices) &&
    isObj(spellPicks) &&
    ['cantrips', 'prepared', 'spellbook'].every((k) => spellPicks[k] === undefined || isStrArr(spellPicks[k])) &&
    (d.abilityMethod === 'standard-array' || d.abilityMethod === 'point-buy' || d.abilityMethod === 'roll') &&
    isNumRecord(d.arrayAssignment) &&
    isNumRecord(d.pointBuyScores) &&
    (d.rolledPool === null || (Array.isArray(d.rolledPool) && d.rolledPool.every((x) => isInt(x, 1)))) &&
    isNumRecord(d.rolledAssignment) &&
    (d.gender === 'male' || d.gender === 'female' || d.gender === 'neutral') &&
    typeof d.alignment === 'string' &&
    isStrRecord(d.details) &&
    (d.equipmentChoice === 'A' || d.equipmentChoice === 'B') &&
    typeof d.classOption === 'string' &&
    isStrRecord(d.classPicks) &&
    isNumRecord(d.cart) &&
    (d.trinketRoll === null || (isInt(d.trinketRoll, 1) && (d.trinketRoll as number) <= 100)) &&
    isFeatures(d.features)
  );
}

/** Whether a draft holds anything worth resuming (a class or a name). */
export const draftHasProgress = (d: WizardDraft): boolean => d.classId !== '' || d.name.trim() !== '';

export function loadWizardDraft(storage: Storage | undefined = globalThis.localStorage): WizardDraft | null {
  try {
    const raw = storage?.getItem(WIZARD_DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isWizardDraft(parsed) ? parsed : null;
  } catch {
    // Unreadable storage or corrupt JSON: behave as if there is no draft.
    return null;
  }
}

export function saveWizardDraft(draft: WizardDraft, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the draft is a convenience, so creation goes on.
  }
}

export function clearWizardDraft(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.removeItem(WIZARD_DRAFT_KEY);
  } catch {
    // Nothing to do: a blocked storage has no draft to clear.
  }
}
