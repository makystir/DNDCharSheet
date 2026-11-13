/**
 * Personal-details & random-character generation (D&D 5.5e / 2024),
 * Stage A7 PART 2 — PURE logic with an injected RNG.
 *
 * Mirrors the WFRP usePersonalDetailsGeneration + random-character framework
 * (d:/Git/PWACharSheet): a set of per-field flavor generators plus a whole
 * `generateRandomCharacter` that assembles a COMPLETE, valid Character. Every
 * function takes an injected RNG (src/logic/random.ts) and is DETERMINISTIC
 * under a fixed sequence — no function calls Math.random.
 *
 * RULES-COMPLIANCE: the name/appearance/personality tables are NON-RAW flavor
 * (src/data/name-tables.ts) and carry no mechanic. The mechanical pieces reuse
 * audited logic: ability scores via standardArray (PHB 2024 "Step 3", L1674),
 * the background via applyBackground (PHB 2024 "Parts of a Background"), and
 * equipment via the equipment-resolver. Alignment is a descriptive label only
 * (PHB 2024 "Alignment"; no mechanic — rules-compliance rule 1).
 */

import type { Ability, Character } from '../types/character';
import { ABILITIES, ALIGNMENTS, type Alignment } from '../types/character';
import { createCharacter } from '../storage/character-store';
import { SPECIES_LIST, getSpecies, type SpeciesId } from '../data/species';
import { CLASS_LIST, type ClassId } from '../data/classes';
import { BACKGROUND_LIST, type BackgroundId } from '../data/backgrounds';
import { DEITY_LIST } from '../data/deities';
import { SKILLS, type SkillId } from '../types/character';
import {
  firstNamesFor,
  eyeColorsFor,
  hairColorsFor,
  skinsFor,
  heightRangeFor,
  weightRangeFor,
  ageRangeFor,
  type NameGender,
} from '../data/name-tables';
import { standardArray } from './ability-score-generation';
import {
  classEquipmentOptions,
  grantStartingEquipment,
  resolveOptionItems,
  trinketItem,
} from './starting-equipment';
import { rollTrinket } from '../data/trinkets';
import { applyBackground, type BackgroundAbilityAllocation } from './backgrounds';
import { createSeededRng, pick, type RNG } from './random';
import { generateProfile, speciesLineage } from './character-description';
import { applyWizardFeatures, autoPickFeatures } from './creation-features';
import { extraCantrips } from './class-choice-effects';
import { speciesGrantedSkills } from './skills';
import { CREATION_LANGUAGE_CHOICES, LANGUAGES, featureLanguageGrants, knownLanguages } from './languages';
import { speciesLanguageSuggestions, suggestedBackgroundIncrease, toolChoicesFor } from './creation-guidance';
import { pickStartingSpells, startingSpellPools } from './starting-spells';

/** Generated appearance fields (all NON-RAW flavor). */
export interface GeneratedAppearance {
  eyes: string;
  hair: string;
  skin: string;
  /** Height as a human-readable string, e.g. `5'10"`. */
  height: string;
  /** Weight as a human-readable string, e.g. `180 lb`. */
  weight: string;
}

/** Pick an integer in [min, max] (inclusive) from the RNG. */
function pickInt(rng: RNG, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Format inches as feet-and-inches, e.g. 70 -> `5'10"`. */
function formatHeight(totalInches: number): string {
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}'${inches}"`;
}

/**
 * Upper-case the first character of a generated flavour value so every
 * Personal Detail reads as a proper label (e.g. `dark brown` -> `Dark brown`).
 * The underlying NON-RAW pools (name-tables.ts) are stored lower-case; this is
 * a display-casing fix applied at generation time, leaving the data untouched.
 * Empty strings pass through unchanged.
 */
function capitalizeFirst(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

/**
 * Generate a first name for a (species, gender) from the NON-RAW pools. Falls
 * back to the neutral pool only if a specific pool is somehow empty (the pools
 * guarantee this never happens for a supported species).
 */
export function generateName(species: SpeciesId, gender: NameGender, rng: RNG): string {
  const pool = firstNamesFor(species, gender);
  const names = pool.length > 0 ? pool : firstNamesFor(species, 'neutral');
  return pick(rng, names);
}

/**
 * Generate an appearance (eyes/hair/skin from the species pools, height/weight
 * drawn from the species ranges). NON-RAW flavor.
 */
export function generateAppearance(
  species: SpeciesId,
  _gender: NameGender,
  rng: RNG,
): GeneratedAppearance {
  // Eyes/hair/skin pools are stored lower-case (NON-RAW flavor); capitalize the
  // first letter so the generated Personal Detail reads as a proper label.
  const eyes = capitalizeFirst(pick(rng, eyeColorsFor(species)));
  const hair = capitalizeFirst(pick(rng, hairColorsFor(species)));
  const skin = capitalizeFirst(pick(rng, skinsFor(species)));
  const h = heightRangeFor(species);
  const w = weightRangeFor(species);
  const height = formatHeight(pickInt(rng, h.min, h.max));
  const weight = `${pickInt(rng, w.min, w.max)} lb`;
  return { eyes, hair, skin, height, weight };
}

/**
 * Generate an age (in years) for a species from the NON-RAW age band. The PHB
 * 2024 has no age table, so the band is invented flavor (src/data/name-tables.ts)
 * that merely respects the species' lifespan. Returns a value inside that
 * species' inclusive [min, max] band as a human-readable string, e.g. `34`.
 */
export function generateAge(species: SpeciesId, rng: RNG): string {
  const range = ageRangeFor(species);
  return String(pickInt(rng, range.min, range.max));
}

/**
 * Pick an alignment label (PHB 2024 "Alignment"). Descriptive only; no mechanic
 * (rules-compliance rule 1). Mutable copy so `pick`'s array type is satisfied.
 */
export function generateAlignment(rng: RNG): Alignment {
  return pick(rng, [...ALIGNMENTS]);
}

// The personality / description generator lives in ./character-description
// (description, ideal, flaw, short- and long-term goals by class and alignment).
export { alignmentParts } from './character-description';

/**
 * Pick a deity NAME from the Gods of Greyhawk catalog (DMG 2024, src/data/
 * deities.ts). Descriptive flavour only (the stored `faith` stays free text);
 * the catalog carries no mechanic (rules-compliance rule 1).
 */
export function generateDeity(rng: RNG): string {
  return pick(rng, DEITY_LIST.map((d) => d.name));
}

/** Options to steer random-character generation. */
export interface RandomCharacterOptions {
  /** Force a species; otherwise random from SPECIES_LIST. */
  speciesId?: SpeciesId;
  /** Force a class; otherwise random from CLASS_LIST. */
  classId?: ClassId;
  /** Force a background; otherwise random from BACKGROUND_LIST. */
  backgroundId?: BackgroundId;
  /** Force a gender; otherwise random from male/female/neutral. */
  gender?: NameGender;
  /** Character name; otherwise generated from species + gender. */
  name?: string;
}

const GENDERS: NameGender[] = ['male', 'female', 'neutral'];

/** Fill any required species sub-choices with a legal value (first option). */
function applySpeciesSubChoices(
  speciesId: SpeciesId,
  rng: RNG,
): Character['species'] {
  const species = getSpecies(speciesId);
  const selection: NonNullable<Character['species']> = { id: speciesId };
  if (!species?.choices) return selection;

  for (const choice of species.choices) {
    if (choice.field === 'skillfulSkill') {
      // Human Skillful: the options list is empty in the catalog (filled by the
      // UI from SKILLS); pick any skill here so the generated character is valid.
      selection.skillfulSkill = pick(rng, SKILLS.map((s) => s.id)) as SkillId;
      continue;
    }
    if (choice.options.length === 0) continue;
    const chosen = pick(rng, [...choice.options]).id;
    // Write to the named field; the union is wide enough for every choice kind.
    (selection as unknown as Record<string, unknown>)[choice.field] = chosen;
  }
  return selection;
}

/**
 * Standard-array scores assigned to the six abilities in a class-aware order:
 * the class's primary ability(ies) first, then the rest, highest-first.
 * PHB 2024 "Standard Array" (L1674) + "Standard Array by Class" guidance.
 */
function assignStandardArray(classId: ClassId): Record<Ability, number> {
  const array = standardArray(); // [15,14,13,12,10,8], highest-first
  const cls = CLASS_LIST.find((c) => c.id === classId);
  const primaries = cls?.primaryAbilities ?? [];
  const order: Ability[] = [
    ...primaries,
    ...ABILITIES.filter((a) => !primaries.includes(a)),
  ];
  const scores = {} as Record<Ability, number>;
  order.forEach((ability, i) => {
    scores[ability] = array[i] ?? 10;
  });
  return scores;
}

/**
 * Produce a COMPLETE, valid Character deterministically from the injected RNG.
 * Assembles: class, species (+ required sub-choices), gender, ability scores
 * (standard array, class-aware), a background applied via `applyBackground`
 * with a legal +2/+1 allocation on its first two abilities, equipment resolved
 * randomly from the background package, alignment, personality, and
 * name/appearance. Mirrors the WFRP random-character framework.
 */
export function generateRandomCharacter(
  rng: RNG,
  options: RandomCharacterOptions = {},
): Character {
  const speciesId = options.speciesId ?? pick(rng, [...SPECIES_LIST]).id;
  const classId = options.classId ?? pick(rng, [...CLASS_LIST]).id;
  const backgroundId = options.backgroundId ?? pick(rng, [...BACKGROUND_LIST]).id;
  const gender = options.gender ?? pick(rng, GENDERS);

  const name = options.name ?? generateName(speciesId, gender, rng);
  let character = createCharacter(name);

  // Class (single-class at level 1; classes[0] = initial class — PHB 2024).
  character = {
    ...character,
    level: 1,
    classes: [{ id: classId, level: 1, skillChoices: [] }],
  };

  // Species + required sub-choices.
  character = { ...character, species: applySpeciesSubChoices(speciesId, rng) };

  // Ability scores via the Standard Array, class-aware assignment.
  character = { ...character, abilities: assignStandardArray(classId) };

  // Gender + alignment + personality (flavor).
  const alignment = generateAlignment(rng);
  character = {
    ...character,
    gender,
    alignment,
    faith: generateDeity(rng),
    // One draw seeds the description generator (as the single personality
    // draw did before), so every later seeded result is unchanged. The
    // description is stored in `personality` (shown as "Character description").
    ...(() => {
      const profile = generateProfile(createSeededRng(Math.floor(rng() * 2 ** 32)), {
        name,
        gender,
        classId,
        alignment,
        speciesId: character.species?.id,
        lineage: speciesLineage(character.species),
      });
      return {
        personality: profile.description,
        ideal: profile.ideal,
        flaw: profile.flaw,
        shortTermGoal: profile.shortTermGoal,
        longTermGoal: profile.longTermGoal,
      };
    })(),
  };

  // Appearance + age (flavor).
  const appearance = generateAppearance(speciesId, gender, rng);
  const age = generateAge(speciesId, rng);
  character = {
    ...character,
    age,
    eyes: appearance.eyes,
    hair: appearance.hair,
    skin: appearance.skin,
    height: appearance.height,
    weight: appearance.weight,
  };

  // Background via the audited A6b path, with a legal +2/+1 allocation on the
  // two background abilities the class ranks highest (the same suggestion the
  // wizard offers, from the PHB "Standard Array by Class" table) and equipment
  // resolved randomly.
  const bg = BACKGROUND_LIST.find((b) => b.id === backgroundId)!;
  const suggested = suggestedBackgroundIncrease(classId, bg.abilities);
  const abilityAllocation: BackgroundAbilityAllocation[] = [
    { ability: suggested?.plusTwo ?? bg.abilities[0], amount: 2 },
    { ability: suggested?.plusOne ?? bg.abilities[1], amount: 1 },
  ];
  // A "choose one kind of ..." tool is picked at random from the real options.
  const toolProficiency =
    bg.tool.id ?? (bg.tool.category ? pick(rng, toolChoicesFor(bg.tool.category)).name : undefined);
  character = applyBackground(
    character,
    backgroundId,
    { abilityAllocation, toolProficiency, equipmentChoice: 'A', rng },
    character.createdAt,
  );

  // Class skill proficiencies (PHB 2024 Core <Class> Traits: Skill Proficiencies).
  // Drawn last so every earlier draw from the injected RNG is unchanged.
  const classData = CLASS_LIST.find((c) => c.id === classId)!;
  const skillChoices = pickClassSkills(
    rng,
    classData.skillChoices,
    new Set<SkillId>([...bg.skills, ...(Object.keys(speciesGrantedSkills(character)) as SkillId[])]),
  );
  character = { ...character, classes: [{ id: classId, level: 1, skillChoices }] };

  // Starting spells (casters only), drawn after every other draw so earlier seeded
  // results are unchanged. Stored exactly as the Spells page stores them.
  const startingSpells = pickStartingSpells(classId, rng);
  if (startingSpells) {
    character = { ...character, spellcasting: { byClass: { [classId]: startingSpells } } };
  }

  // Class starting equipment, option A (the gear package), drawn after every other
  // draw so earlier seeded results are unchanged. PHB 2024 "Choose Starting
  // Equipment": the class provides equipment as well as the background.
  const packageA = classEquipmentOptions(classId).find((o) => o.id === 'A');
  if (packageA) {
    const granted = resolveOptionItems(packageA, {}, rng);
    character = grantStartingEquipment(character, {
      items: granted.items,
      goldGp: packageA.goldGp,
      spentCopper: 0,
    });
  }

  // One free trinket (PHB 2024 "Trinkets").
  const trinket = trinketItem(rollTrinket(rng).roll);
  if (trinket) character = { ...character, inventory: [...(character.inventory ?? []), trinket] };

  // Languages, the last draws: Common plus two standard languages (PHB 2024
  // "Choose Languages", L1625), the species' own language first when it has
  // one, then any class feature picks (Rogue Thieves' Cant +1, Ranger +2).
  const chosen = pickLanguages(rng, CREATION_LANGUAGE_CHOICES, speciesLanguageSuggestions(speciesId), new Set(['common']));
  const grant = featureLanguageGrants(character);
  const known = new Set<string>([...knownLanguages({ ...character, languages: { chosen } }), ...grant.fixed]);
  const granted = pickLanguages(rng, grant.chooseCount, [], known);
  character = {
    ...character,
    languages: { chosen, ...(granted.length > 0 ? { granted } : {}) },
  };

  // Level 1 class-feature picks (Fighting Style, Divine / Primal Order,
  // Invocations, Expertise, Weapon Mastery), the very last draws so every
  // earlier seeded result is unchanged. Leaves nothing owed.
  const features = autoPickFeatures(character, classId, (n) => Math.floor(rng() * n));
  character = applyWizardFeatures(character, classId, features, character.createdAt);
  // An Order that grants extra cantrips (Thaumaturge / Magician) gets them now.
  const extra = extraCantrips(character, classId);
  const classSpells = character.spellcasting?.byClass?.[classId];
  const pools = startingSpellPools(classId);
  if (extra > 0 && classSpells && pools) {
    const have = classSpells.cantrips ?? [];
    const options = pools.cantrips.map((s) => s.id).filter((id) => !have.includes(id));
    const added: typeof have = [];
    while (added.length < extra && options.length > 0) added.push(options.splice(Math.floor(rng() * options.length), 1)[0]);
    character = {
      ...character,
      spellcasting: {
        ...character.spellcasting,
        byClass: { ...character.spellcasting?.byClass, [classId]: { ...classSpells, cantrips: [...have, ...added] } },
      },
    };
  }

  return { ...character, abilityGenMethod: 'standard-array' };
}

/**
 * Picks `count` distinct languages from the standard list (data/rules-text
 * LANGUAGE_INFO via logic/languages LANGUAGES), taking `prefer` first, never one
 * already in `exclude`.
 */
function pickLanguages(rng: RNG, count: number, prefer: readonly string[], exclude: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const l of prefer) {
    if (out.length < count && !exclude.has(l) && (LANGUAGES as readonly string[]).includes(l)) out.push(l);
  }
  const rest = (LANGUAGES as readonly string[]).filter((l) => !exclude.has(l) && !out.includes(l));
  while (out.length < count && rest.length > 0) {
    out.push(rest.splice(Math.floor(rng() * rest.length), 1)[0]);
  }
  return out;
}

/**
 * Picks exactly count distinct class skills from the class list ('any' = every
 * skill), preferring skills not already held from the background or species (the
 * Proficiency Bonus is never added twice, PHB 2024 L525). Falls back to held
 * skills only if the list is too short to fill the count.
 */
function pickClassSkills(
  rng: RNG,
  rule: { count: number; from: SkillId[] | 'any' },
  held: ReadonlySet<SkillId>,
): SkillId[] {
  const list: SkillId[] = rule.from === 'any' ? SKILLS.map((s) => s.id) : [...rule.from];
  const chosen: SkillId[] = [];
  const draw = (from: SkillId[]) => {
    const remaining = [...from];
    while (chosen.length < rule.count && remaining.length > 0) {
      const [skill] = remaining.splice(Math.floor(rng() * remaining.length), 1);
      chosen.push(skill);
    }
  };
  draw(list.filter((s) => !held.has(s)));
  draw(list.filter((s) => held.has(s)));
  return chosen;
}
