/**
 * Class-feature choices (D&D 5.5e / 2024): how many picks each class feature
 * owes at the character's class levels, how many are spent, and which options
 * are valid. Same pattern as logic/expertise.ts: pure; counts come from the
 * class tables (cited per grant); over-allocation is a non-blocking WARNING,
 * never a block (homebrew, house rules and unmodelled sources can add picks).
 *
 * Multiclass: each grant uses the level of THAT class's own entry (PHB 2024
 * "Multiclassing"), via allClasses(character), exactly like earnedExpertiseGrants.
 *
 * Choices persist in the additive-optional `Character.classChoices`
 * (Partial<Record<ClassChoiceKey, string[]>>). Parametrised Warlock invocations
 * are stored as "<invocationId>#<param>" (e.g. "agonizing-blast#fire-bolt").
 */

import type { Character, ClassChoiceKey, ClassChoices, SkillId } from '../types/character';
import { SKILLS } from '../types/character';
import { getClass } from '../data/classes';
import { getSpell } from '../data/spells';
import { METAMAGIC_CATALOG } from '../data/metamagic';
import { INVOCATION_CATALOG } from '../data/invocations';
import { MANEUVER_CATALOG } from '../data/maneuvers';
import {
  ARTISANS_TOOLS,
  BLESSED_STRIKES_OPTIONS,
  DIVINE_ORDER_OPTIONS,
  ELEMENTAL_FURY_OPTIONS,
  MUSICAL_INSTRUMENTS,
  PRIMAL_ORDER_OPTIONS,
  SUBCLASS_PICK_OPTIONS,
} from '../data/class-options';
import { allClasses, entrySubclass } from './classes';
import type { Breakdown } from './breakdown';

export interface ChoiceGrant {
  key: ClassChoiceKey;
  classId: string;
  /** Grant applies only with this subclass chosen (and reached). */
  subclassId?: string;
  /** Display label, e.g. "Metamagic options". */
  label: string;
  /** [classLevel, cumulativeOwed] steps ascending; the last step reached applies. */
  steps: ReadonlyArray<readonly [number, number]>;
  kind: 'options' | 'skills' | 'tool' | 'spells';
  /** Informational: the PHB lets the player replace picks (no budget tracked). */
  swappable: boolean;
  source: string;
}

export const CLASS_CHOICE_GRANTS: readonly ChoiceGrant[] = [
  // Sorcerer: counts are prose-only (no table column): two at 2, two more at 10, two more at 17.
  { key: 'sorcerer.metamagic', classId: 'sorcerer', label: 'Metamagic options', steps: [[2, 2], [10, 4], [17, 6]], kind: 'options', swappable: true, source: 'PHB 2024 "Sorcerer: Metamagic" (L6341-6347)' },
  // Warlock: Eldritch Invocations column of the Warlock Features table (OCR-damaged; prose cross-checked).
  { key: 'warlock.invocations', classId: 'warlock', label: 'Eldritch Invocations', steps: [[1, 1], [2, 3], [5, 5], [7, 6], [9, 7], [12, 8], [15, 9], [18, 10]], kind: 'options', swappable: true, source: 'PHB 2024 "Warlock: Eldritch Invocations" (L6811-6817, table L6831-6853)' },
  { key: 'fighter.maneuvers', classId: 'fighter', subclassId: 'battleMaster', label: 'Maneuvers', steps: [[3, 3], [7, 5], [10, 7], [15, 9]], kind: 'options', swappable: true, source: 'PHB 2024 "Battle Master: Combat Superiority" (L4235-4237)' },
  { key: 'cleric.divineOrder', classId: 'cleric', label: 'Divine Order', steps: [[1, 1]], kind: 'options', swappable: false, source: 'PHB 2024 "Cleric: Divine Order" (L3228-3234)' },
  { key: 'cleric.blessedStrikes', classId: 'cleric', label: 'Blessed Strikes', steps: [[7, 1]], kind: 'options', swappable: false, source: 'PHB 2024 "Cleric: Blessed Strikes" (L3260-3266)' },
  { key: 'druid.primalOrder', classId: 'druid', label: 'Primal Order', steps: [[1, 1]], kind: 'options', swappable: false, source: 'PHB 2024 "Druid: Primal Order" (L3664-3670)' },
  { key: 'druid.elementalFury', classId: 'druid', label: 'Elemental Fury', steps: [[7, 1]], kind: 'options', swappable: false, source: 'PHB 2024 "Druid: Elemental Fury" (L3722-3730)' },
  { key: 'barbarian.primalKnowledge', classId: 'barbarian', label: 'Primal Knowledge skill', steps: [[3, 1]], kind: 'skills', swappable: false, source: 'PHB 2024 "Barbarian: Primal Knowledge" (L2493-2497)' },
  { key: 'barbarian.aspectOfTheWilds', classId: 'barbarian', subclassId: 'wildHeart', label: 'Aspect of the Wilds', steps: [[6, 1]], kind: 'options', swappable: true, source: 'PHB 2024 "Wild Heart: Aspect of the Wilds" (L2593)' },
  { key: 'fighter.studentOfWarSkill', classId: 'fighter', subclassId: 'battleMaster', label: 'Student of War skill', steps: [[3, 1]], kind: 'skills', swappable: false, source: 'PHB 2024 "Battle Master: Student of War" (L4249-4251)' },
  { key: 'fighter.studentOfWarTool', classId: 'fighter', subclassId: 'battleMaster', label: "Student of War Artisan's Tools", steps: [[3, 1]], kind: 'tool', swappable: false, source: 'PHB 2024 "Battle Master: Student of War" (L4249-4251)' },
  { key: 'bard.loreSkills', classId: 'bard', subclassId: 'lore', label: 'Bonus Proficiencies (Lore)', steps: [[3, 3]], kind: 'skills', swappable: false, source: 'PHB 2024 "College of Lore: Bonus Proficiencies" (L3057)' },
  { key: 'ranger.glamourSkill', classId: 'ranger', subclassId: 'feyWanderer', label: 'Otherworldly Glamour skill', steps: [[3, 1]], kind: 'skills', swappable: false, source: 'PHB 2024 "Fey Wanderer: Otherworldly Glamour" (L5745)' },
  { key: 'ranger.huntersPrey', classId: 'ranger', subclassId: 'hunter', label: "Hunter's Prey", steps: [[3, 1]], kind: 'options', swappable: true, source: 'PHB 2024 "Hunter: Hunter\'s Prey" (L5825)' },
  { key: 'ranger.defensiveTactics', classId: 'ranger', subclassId: 'hunter', label: 'Defensive Tactics', steps: [[7, 1]], kind: 'options', swappable: true, source: 'PHB 2024 "Hunter: Defensive Tactics" (L5833)' },
  { key: 'ranger.primalCompanion', classId: 'ranger', subclassId: 'beastMaster', label: 'Primal Companion', steps: [[3, 1]], kind: 'options', swappable: true, source: 'PHB 2024 "Beast Master: Primal Companion" (L5583-5591)' },
  { key: 'sorcerer.elementalAffinity', classId: 'sorcerer', subclassId: 'draconic', label: 'Elemental Affinity', steps: [[6, 1]], kind: 'options', swappable: false, source: 'PHB 2024 "Draconic Sorcery: Elemental Affinity" (L6679)' },
  { key: 'wizard.spellMastery', classId: 'wizard', label: 'Spell Mastery spells', steps: [[18, 2]], kind: 'spells', swappable: true, source: 'PHB 2024 "Wizard: Spell Mastery" (L7479-7483)' },
  { key: 'wizard.signatureSpells', classId: 'wizard', label: 'Signature Spells', steps: [[20, 2]], kind: 'spells', swappable: false, source: 'PHB 2024 "Wizard: Signature Spells" (L7489-7491)' },
];

/** Bard multiclass instrument (not a class-table grant; see logic/multiclass-picks.ts). */
export const MULTICLASS_INSTRUMENT_KEY: ClassChoiceKey = 'bard.multiclassInstrument';

/** Every choice key the sanitiser accepts. */
export const CLASS_CHOICE_KEYS: readonly ClassChoiceKey[] = [
  ...CLASS_CHOICE_GRANTS.map((g) => g.key),
  MULTICLASS_INSTRUMENT_KEY,
];

/** Choices a character makes at class level 1 (shown in the Overview setup card). */
export const CREATION_CHOICE_KEYS: readonly ClassChoiceKey[] = ['cleric.divineOrder', 'druid.primalOrder', 'warlock.invocations'];

const MAX_ENTRY_LENGTH = 64;
const MAX_GROUP_SIZE = 40;

const SKILL_IDS: readonly string[] = SKILLS.map((s) => s.id);

/** The cumulative count owed at a class level (last step reached), 0 below the first step. */
export function stepsOwed(steps: ChoiceGrant['steps'], level: number): number {
  let owed = 0;
  for (const [stepLevel, cumulative] of steps) {
    if (stepLevel <= level) owed = cumulative;
  }
  return owed;
}

function grantFor(key: ClassChoiceKey): ChoiceGrant | undefined {
  return CLASS_CHOICE_GRANTS.find((g) => g.key === key);
}

/** The class level a grant applies at for this character (0 when the grant does not apply). */
function grantLevel(character: Character, grant: ChoiceGrant): number {
  let level = 0;
  for (const entry of allClasses(character)) {
    if (entry.id !== grant.classId) continue;
    if (grant.subclassId !== undefined && entrySubclass(entry)?.id !== grant.subclassId) continue;
    level = Math.max(level, entry.level);
  }
  return level;
}

/** Picks owed for one choice group at the character's class levels. */
export function choiceOwed(character: Character, key: ClassChoiceKey): number {
  const grant = grantFor(key);
  if (!grant) return 0;
  return stepsOwed(grant.steps, grantLevel(character, grant));
}

/**
 * Breakdown of the owed count: one component per step reached (the increments
 * of the class table), so the tooltip shows where the total comes from.
 */
export function choiceOwedBreakdown(character: Character, key: ClassChoiceKey): Breakdown {
  const grant = grantFor(key);
  if (!grant) return { total: 0, components: [] };
  const level = grantLevel(character, grant);
  const className = getClass(grant.classId)?.name ?? grant.classId;
  const components: Breakdown['components'] = [];
  let previous = 0;
  for (const [stepLevel, cumulative] of grant.steps) {
    if (stepLevel > level) break;
    components.push({ label: `${className} level ${stepLevel} (${grant.label})`, value: cumulative - previous });
    previous = cumulative;
  }
  if (components.length === 0) components.push({ label: `${className} (${grant.label}) not yet gained`, value: 0 });
  return { total: previous, components };
}

// â”€â”€ Invocation entries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Split "id#param" into its parts (param is undefined when there is none). */
export function parseInvocationEntry(entry: string): { id: string; param?: string } {
  const i = entry.indexOf('#');
  if (i < 0) return { id: entry };
  return { id: entry.slice(0, i), param: entry.slice(i + 1) };
}

export function formatInvocationEntry(id: string, param?: string): string {
  return param ? `${id}#${param}` : id;
}

export interface InvocationEligibility {
  ok: boolean;
  reasons: string[];
}

/**
 * Whether the character meets an invocation's prerequisites (PHB 2024 "Eldritch
 * Invocation Options"): the WARLOCK class level (not character level) and any
 * required invocation among `held` (invocation ids, params stripped). The
 * damaging / attack-roll cantrip prerequisites cannot be checked against spell
 * data (no damage flag), so they are not validated here.
 */
export function invocationEligibility(
  character: Character,
  invocationId: string,
  held: readonly string[],
): InvocationEligibility {
  const inv = INVOCATION_CATALOG[invocationId];
  if (!inv) return { ok: false, reasons: ['Unknown invocation'] };
  const warlockLevel = allClasses(character).find((e) => e.id === 'warlock')?.level ?? 0;
  const reasons: string[] = [];
  if (warlockLevel < inv.minLevel) reasons.push(`Requires Warlock level ${inv.minLevel}`);
  if (inv.requiresInvocation && !held.includes(inv.requiresInvocation)) {
    const req = INVOCATION_CATALOG[inv.requiresInvocation];
    reasons.push(`Requires ${req?.name ?? inv.requiresInvocation}`);
  }
  return { ok: reasons.length === 0, reasons };
}

// â”€â”€ Option validity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Whether a spell fits a Wizard spell-pick group. Spell Mastery (PHB 2024 L7481):
 * level 1 or 2 with a casting time of an action. Signature Spells (L7491): level 3.
 */
export function spellChoiceEligible(key: ClassChoiceKey, level: number, castingTime: string | undefined): boolean {
  return key === 'wizard.spellMastery' ? (level === 1 || level === 2) && castingTime === 'Action' : level === 3;
}

/** Valid plain option ids for a group (undefined = spell groups, validated against the spellbook). */
export function choiceOptionIds(key: ClassChoiceKey): readonly string[] | undefined {
  switch (key) {
    case 'sorcerer.metamagic': return Object.keys(METAMAGIC_CATALOG);
    case 'warlock.invocations': return Object.keys(INVOCATION_CATALOG);
    case 'fighter.maneuvers': return Object.keys(MANEUVER_CATALOG);
    case 'cleric.divineOrder': return DIVINE_ORDER_OPTIONS.map((o) => o.id);
    case 'cleric.blessedStrikes': return BLESSED_STRIKES_OPTIONS.map((o) => o.id);
    case 'druid.primalOrder': return PRIMAL_ORDER_OPTIONS.map((o) => o.id);
    case 'druid.elementalFury': return ELEMENTAL_FURY_OPTIONS.map((o) => o.id);
    case 'barbarian.primalKnowledge': {
      const from = getClass('barbarian')?.skillChoices.from;
      return Array.isArray(from) ? from : SKILL_IDS;
    }
    case 'fighter.studentOfWarSkill': {
      const from = getClass('fighter')?.skillChoices.from;
      return Array.isArray(from) ? from : SKILL_IDS;
    }
    case 'bard.loreSkills': return SKILL_IDS;
    case 'fighter.studentOfWarTool': return ARTISANS_TOOLS.map((o) => o.id);
    case 'bard.multiclassInstrument': return MUSICAL_INSTRUMENTS.map((o) => o.id);
    case 'ranger.glamourSkill': return SUBCLASS_PICK_OPTIONS.glamourSkill.map((o) => o.id);
    case 'ranger.huntersPrey': return SUBCLASS_PICK_OPTIONS.huntersPrey.map((o) => o.id);
    case 'ranger.defensiveTactics': return SUBCLASS_PICK_OPTIONS.defensiveTactics.map((o) => o.id);
    case 'ranger.primalCompanion': return SUBCLASS_PICK_OPTIONS.primalCompanion.map((o) => o.id);
    case 'barbarian.aspectOfTheWilds': return SUBCLASS_PICK_OPTIONS.aspectOfTheWilds.map((o) => o.id);
    case 'sorcerer.elementalAffinity': return SUBCLASS_PICK_OPTIONS.elementalAffinity.map((o) => o.id);
    case 'wizard.spellMastery':
    case 'wizard.signatureSpells':
      return undefined;
  }
}

export interface ChoiceStatus {
  key: ClassChoiceKey;
  label: string;
  /** Picks owed at the current class levels. */
  owed: number;
  /** Distinct VALID picks held. */
  chosen: number;
  /** Picks still to make (never negative). */
  remaining: number;
  /** Valid picks beyond what the class grants (never negative); a warning, not a block. */
  over: number;
  /** Entries held that are unknown or fail a prerequisite (kept, never deleted). */
  invalid: string[];
  /** Exact repeats of an entry already held (counted once). */
  duplicates: string[];
  /** The stored entries, in order. */
  entries: string[];
}

/**
 * Validate the stored entries of one group. Valid entries are distinct (an exact
 * repeat counts once and is listed in `duplicates`); unknown ids, an invocation
 * whose prerequisite is unmet, and a param on a non-repeatable invocation go to
 * `invalid`.
 */
function classify(
  character: Character,
  key: ClassChoiceKey,
  entries: readonly string[],
): { valid: string[]; invalid: string[]; duplicates: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  const options = choiceOptionIds(key);

  if (key === 'warlock.invocations') {
    // Prerequisite invocations may be held in any order, so collect bases first.
    const held = entries.map((e) => parseInvocationEntry(e).id).filter((id) => id in INVOCATION_CATALOG);
    for (const entry of entries) {
      const { id, param } = parseInvocationEntry(entry);
      const inv = INVOCATION_CATALOG[id];
      if (!inv || (param !== undefined && (!inv.repeatable || param.length === 0))) {
        invalid.push(entry);
        continue;
      }
      if (seen.has(entry)) {
        duplicates.push(entry);
        continue;
      }
      seen.add(entry);
      if (!invocationEligibility(character, id, held).ok) invalid.push(entry);
      else valid.push(entry);
    }
    return { valid, invalid, duplicates };
  }

  if (key === 'wizard.spellMastery' || key === 'wizard.signatureSpells') {
    const book = character.spellcasting?.byClass?.wizard?.spellbook ?? [];
    // Spell Mastery: exactly one level 1 and one level 2 spell (L7481); a second spell of an
    // already-taken level is invalid (kept, not counted). Signature Spells: two level 3 spells (L7491).
    const takenLevels = new Set<number>();
    for (const entry of entries) {
      const spell = entry.length > 0 ? getSpell(entry) : undefined;
      if (!spell || !book.includes(entry) || !spellChoiceEligible(key, spell.level, spell.castingTime)) {
        invalid.push(entry);
      } else if (seen.has(entry)) {
        duplicates.push(entry);
      } else if (key === 'wizard.spellMastery' && takenLevels.has(spell.level)) {
        invalid.push(entry);
      } else {
        seen.add(entry);
        takenLevels.add(spell.level);
        valid.push(entry);
      }
    }
    return { valid, invalid, duplicates };
  }

  for (const entry of entries) {
    if (options !== undefined && !options.includes(entry)) invalid.push(entry);
    else if (options === undefined && entry.length === 0) invalid.push(entry);
    else if (seen.has(entry)) duplicates.push(entry);
    else {
      seen.add(entry);
      valid.push(entry);
    }
  }
  return { valid, invalid, duplicates };
}

function statusFor(character: Character, key: ClassChoiceKey, label: string, owed: number): ChoiceStatus {
  const entries = character.classChoices?.[key] ?? [];
  const { valid, invalid, duplicates } = classify(character, key, entries);
  return {
    key,
    label,
    owed,
    chosen: valid.length,
    remaining: Math.max(0, owed - valid.length),
    over: Math.max(0, valid.length - owed),
    invalid,
    duplicates,
    entries: [...entries],
  };
}

/**
 * Status of every choice group that is owed or already holds entries (grants
 * that do not apply to the character and are empty are omitted). Multiclass
 * Bard instrument status lives in logic/multiclass-picks.ts.
 */
export function choiceStatus(character: Character): ChoiceStatus[] {
  const result: ChoiceStatus[] = [];
  for (const grant of CLASS_CHOICE_GRANTS) {
    const owed = choiceOwed(character, grant.key);
    const held = character.classChoices?.[grant.key]?.length ?? 0;
    if (owed === 0 && held === 0) continue;
    result.push(statusFor(character, grant.key, grant.label, owed));
  }
  return result;
}

/** Groups with picks still to make (non-zero `remaining`). */
export function pendingClassChoices(character: Character): ChoiceStatus[] {
  return choiceStatus(character).filter((s) => s.remaining > 0);
}

/** The pending subset granted at class level 1 (Divine Order, Primal Order, Invocations). */
export function pendingCreationChoices(character: Character): ChoiceStatus[] {
  return pendingClassChoices(character).filter((s) => CREATION_CHOICE_KEYS.includes(s.key));
}

// â”€â”€ Mutators (pure) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function withChoices(character: Character, next: ClassChoices): Character {
  const { classChoices: _drop, ...rest } = character;
  void _drop;
  return Object.keys(next).length === 0 ? (rest as Character) : { ...rest, classChoices: next } as Character;
}

/** Replace one group's entries; an empty list removes the key (and the whole field when empty). */
export function setClassChoice(character: Character, key: ClassChoiceKey, ids: readonly string[]): Character {
  const next: ClassChoices = { ...(character.classChoices ?? {}) };
  if (ids.length === 0) delete next[key];
  else next[key] = [...ids];
  return withChoices(character, next);
}

/**
 * Add the entry when absent, remove it when present. Adding is never capped
 * (over-allocation only warns).
 */
export function toggleClassChoice(character: Character, key: ClassChoiceKey, id: string): Character {
  const current = character.classChoices?.[key] ?? [];
  return setClassChoice(character, key, current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
}

export function removeClassChoice(character: Character, key: ClassChoiceKey, id: string): Character {
  const current = character.classChoices?.[key] ?? [];
  return setClassChoice(character, key, current.filter((x) => x !== id));
}

// â”€â”€ Sanitiser (untrusted input) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Normalise an untrusted `classChoices` value: unknown keys, non-array values
 * and non-string / empty / over-long entries are dropped; groups are capped;
 * the result is undefined when nothing survives.
 */
export function sanitizeClassChoices(value: unknown): ClassChoices | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out: ClassChoices = {};
  for (const key of CLASS_CHOICE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const raw = (value as Record<string, unknown>)[key];
    if (!Array.isArray(raw)) continue;
    const entries = raw
      .filter((e): e is string => typeof e === 'string' && e.length > 0 && e.length <= MAX_ENTRY_LENGTH)
      .slice(0, MAX_GROUP_SIZE);
    if (entries.length > 0) out[key] = entries;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Skill ids as a typed list (for pickers). */
export function isSkillId(id: string): id is SkillId {
  return SKILL_IDS.includes(id);
}
