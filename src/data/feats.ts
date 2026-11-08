/**
 * Feat catalog (D&D 5.5e / 2024).
 *
 * The complete PHB 2024 feat list (Chapter 5, "Feat List"): 75 feats, held as
 * 77 records because Magic Initiate is modelled per spell list (Cleric, Druid,
 * Wizard) — each record non-repeatable on its own id, so repeating the PHB feat
 * means taking a DIFFERENT variant (PHB "Magic Initiate": choose a different
 * spell list each time).
 *
 * CONVENTIONS (match data/classes.ts / data/conditions.ts):
 *  - One keyed record (FEAT_CATALOG); the FeatId union is DERIVED from it so the
 *    persisted FeatSelection.featId and the catalog cannot drift.
 *  - Every entry carries a line-anchored PHB citation (`source`). Line numbers
 *    are the `## NAME` heading lines of Docs/PlayersHandbook.md as counted by
 *    PowerShell Get-Content (the grep tool numbers the file ~1 higher in places).
 *  - Benefit prose is PARAPHRASED, never verbatim (rules-compliance rule 5);
 *    every number, die, distance, level, prerequisite and cap is exact.
 *  - `mechanics` is a prose-free, structured summary of what a player must pick
 *    (skill/tool counts, restricted lists, other choices) and the fixed grants.
 *    Benefits the app cannot compute (attack/AC/damage riders etc.) are carried
 *    as `effect` text only, with a `fixed` tag for traceability.
 *
 * RULES-COMPLIANCE: ability increases are modelled; caps are 20 for General/ASI
 * feats and 30 for Epic Boon feats (PHB 2024 "Ability Score Improvement" L8558,
 * "Epic Boon Feats" L9124+).
 */

import type { Ability } from '../types/character';
import type { OwnUses } from './classes';

/** The four feat categories (PHB 2024 "Parts of a Feat", L8356). */
export type FeatCategory = 'origin' | 'general' | 'fighting-style' | 'epic-boon';

/** Armor training a prerequisite can require (PHB "Medium Armor Training" etc.). */
export type FeatArmorTraining = 'light' | 'medium' | 'heavy' | 'shield';

/**
 * A feat's prerequisite. All parts are optional; an Origin feat has none. A
 * class prerequisite needs at least 1 level in that class (PHB 2024 "Parts of a
 * Feat": Prerequisite). `note` holds anything not machine-checkable.
 */
export interface FeatPrerequisite {
  /** Minimum character level (General = 4, Epic Boon = 19). */
  minLevel?: number;
  /** Minimum ability score(s), ALL of which must be met, e.g. { cha: 13 }. */
  abilityMin?: Partial<Record<Ability, number>>;
  /** "Strength or Dexterity 13+": at least ONE listed ability must reach `min`. */
  abilityAnyOf?: { abilities: Ability[]; min: number };
  /** Required armor training (class training or an earlier feat). */
  armorTraining?: FeatArmorTraining;
  /**
   * 'spellcasting-or-pact-magic' = "Spellcasting or Pact Magic Feature";
   * 'spellcasting' = "Spellcasting Feature" only (Boon of Spell Recall).
   */
  spellcasting?: 'spellcasting-or-pact-magic' | 'spellcasting';
  /** "Fighting Style Feature": a class feature that grants a Fighting Style feat. */
  fightingStyleFeature?: true;
  /** Free-text prerequisite that is not machine-checkable. */
  note?: string;
}

/**
 * How a feat raises ability scores, if at all.
 *
 *  - 'asi'        — the Ability Score Improvement feat (+2 one OR +1 two, max 20).
 *  - 'fixed'      — a named +1 to one ability (e.g. Actor +1 Cha), max 20.
 *  - 'choose-one' — +1 to ONE of the listed abilities, max 20.
 *  - 'epic-boon'  — Epic Boon +1 to ONE of the listed abilities, max 30.
 */
export type FeatAbilityIncrease =
  | { kind: 'asi' }
  | { kind: 'fixed'; ability: Ability; amount: 1; max: 20 }
  | { kind: 'choose-one'; abilities: Ability[]; amount: 1; max: 20 }
  | { kind: 'epic-boon'; abilities: Ability[]; amount: 1; max: 30 };

/** A player choice other than skill/tool counts (spell lists, damage types...). */
export interface FeatChoiceSpec {
  key: string;
  /** A number, or 'proficiency-bonus' (Ritual Caster). */
  count: number | 'proficiency-bonus';
  /** The allowed options, or a symbolic source tag (e.g. 'spell-list:cleric'). */
  from: string[] | string;
}

/** The structured, prose-free mechanics of a feat. */
export interface FeatMechanics {
  grants: {
    /** Free-choice skill proficiencies. */
    skills: number;
    /** Free-choice tool / instrument proficiencies. */
    tools: number;
    /** Picks that may each be a skill OR a tool (Skilled). */
    skillsOrTools: number;
    /** Expertise picks the feat itself grants. */
    expertise: number;
    /** Resilient: gain save proficiency in the chosen ability. */
    saveProficiencyChoice: boolean;
    /** Boon of Skill: proficiency in ALL skills. */
    allSkills: boolean;
  };
  /** Restriction on the free-choice tool picks, when any. */
  toolsFrom?: 'artisan-tools-fast-crafting' | 'musical-instruments';
  /**
   * Fixed, non-choice grants: 'armor-training:heavy', 'spell:misty-step',
   * 'sense:truesight-60', 'speed:+10', ... Only 'armor-training:*' is read by
   * the rules engine today (feat prerequisites); the rest are traceability tags.
   */
  fixed: string[];
  /** Other choices. Not collected by the UI today (see FeatAllocationDialog). */
  choices: FeatChoiceSpec[];
}

/** A single feat's mechanical profile. */
export interface FeatData {
  /** Catalog key, e.g. 'actor'. */
  id: string;
  /** Feat name as printed, e.g. 'Actor'. */
  name: string;
  category: FeatCategory;
  /** Prerequisite, or undefined when the feat has none (Origin feats). */
  prerequisite?: FeatPrerequisite;
  /** True for the '*' feats in the Feat List table (default once). */
  repeatable?: boolean;
  /** How this feat raises scores, if at all. */
  abilityIncrease?: FeatAbilityIncrease;
  /** Structured grants and choices (never undefined; zeros when none). */
  mechanics: FeatMechanics;
  /** Short PHB-cited paraphrase of the benefit (never verbatim). */
  effect: string;
  /**
   * Limited-use pool(s) this feat grants (D1 resource tracking). An array when the feat has more than one
   * independent pool (Boon of Recovery). Use `featOwnUses` to read it uniformly. `pool` is required here so a
   * tracker id is `feat:<featId>.<pool>`.
   */
  uses?: OwnUses | OwnUses[];
  /** Line-anchored PHB citation this entry is transcribed from. */
  source: string;
}

/** A feat's limited-use pools as a list (empty when the feat has none). */
export function featOwnUses(feat: FeatData): OwnUses[] {
  return feat.uses === undefined ? [] : Array.isArray(feat.uses) ? feat.uses : [feat.uses];
}

// ─── builders (keep the records below compact and uniform) ───────────────────

const STR_DEX: Ability[] = ['str', 'dex'];
const INT_WIS_CHA: Ability[] = ['int', 'wis', 'cha'];
const ALL_SIX: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** A FeatMechanics with every grant defaulted (zero / false). */
function mech(
  grants: Partial<FeatMechanics['grants']> = {},
  rest: Partial<Omit<FeatMechanics, 'grants'>> = {},
): FeatMechanics {
  return {
    grants: {
      skills: 0,
      tools: 0,
      skillsOrTools: 0,
      expertise: 0,
      saveProficiencyChoice: false,
      allSkills: false,
      ...grants,
    },
    ...(rest.toolsFrom ? { toolsFrom: rest.toolsFrom } : {}),
    fixed: rest.fixed ?? [],
    choices: rest.choices ?? [],
  };
}

const L4: FeatPrerequisite = { minLevel: 4 };
const L19: FeatPrerequisite = { minLevel: 19 };
const FIGHTING_STYLE: FeatPrerequisite = { fightingStyleFeature: true };
/** "A or B 13+" at level 4+. */
const anyOf = (abilities: Ability[], min = 13): FeatPrerequisite => ({
  minLevel: 4,
  abilityAnyOf: { abilities, min },
});
const choose = (abilities: Ability[]): FeatAbilityIncrease => ({
  kind: 'choose-one',
  abilities,
  amount: 1,
  max: 20,
});
const fixedInc = (ability: Ability): FeatAbilityIncrease => ({
  kind: 'fixed',
  ability,
  amount: 1,
  max: 20,
});
const boon = (abilities: Ability[] = ALL_SIX): FeatAbilityIncrease => ({
  kind: 'epic-boon',
  abilities,
  amount: 1,
  max: 30,
});

/** Magic Initiate spell-list variants (PHB "Magic Initiate", L8506). */
function magicInitiate(list: 'Cleric' | 'Druid' | 'Wizard'): FeatData {
  const tag = `spell-list:${list.toLowerCase()}`;
  return {
    id: `magic-initiate-${list.toLowerCase()}`,
    name: `Magic Initiate (${list})`,
    category: 'origin',
    // PHB 2024 L8506: two cantrips + one level 1 spell from the chosen list;
    // Int, Wis or Cha is the spellcasting ability (chosen when taken).
    mechanics: mech(
      {},
      {
        choices: [
          { key: 'cantrip', count: 2, from: tag },
          { key: 'level-1-spell', count: 1, from: tag },
          { key: 'spellcasting-ability', count: 1, from: ['int', 'wis', 'cha'] },
        ],
      },
    ),
    effect: `Learn two ${list} cantrips and one level 1 ${list} spell. The level 1 spell is always prepared and can be cast once per Long Rest without a slot (or with a slot). Choose Intelligence, Wisdom or Charisma as the spellcasting ability. You can swap one of the spells for another of the same level when you gain a level. Taking Magic Initiate again requires a different spell list.`,
    uses: { count: 1, recharge: 'long-rest', pool: 'free-cast' }, // PHB L8506-8512: the level 1 spell once per Long Rest without a slot
    source: 'PHB 2024 "Magic Initiate" (L8506)',
  };
}

/**
 * The feat catalog, keyed by id.
 *
 * Ability-increase caps: General/ASI = 20; Epic Boon = 30 (PHB 2024
 * "Ability Score Improvement" L8558; "Epic Boon Feats" L9124+).
 */
export const FEAT_CATALOG: Record<string, FeatData> = {
  // ══ Origin feats (no prerequisite, no ability increase — PHB L8454+) ══════
  alert: {
    id: 'alert',
    name: 'Alert',
    category: 'origin',
    mechanics: mech({}, { fixed: ['initiative:+proficiency-bonus'] }),
    effect:
      'Add your Proficiency Bonus to Initiative rolls. Right after rolling Initiative you can swap results with one willing ally in the same combat, unless either of you is Incapacitated.',
    source: 'PHB 2024 "Alert" (L8458)',
  },
  crafter: {
    id: 'crafter',
    name: 'Crafter',
    category: 'origin',
    // PHB L8468: three different Artisan's Tools from the Fast Crafting table.
    mechanics: mech({ tools: 3 }, { toolsFrom: 'artisan-tools-fast-crafting' }),
    effect:
      "Gain proficiency with three different Artisan's Tools from the Fast Crafting table (Carpenter's, Leatherworker's, Mason's, Potter's, Smith's, Tinker's, Weaver's, Woodcarver's). Nonmagical items cost you 20 percent less. After a Long Rest you can craft one piece of gear from the Fast Crafting table if you have the matching tools and proficiency; it falls apart after your next Long Rest.",
    source: 'PHB 2024 "Crafter" (L8468)',
  },
  healer: {
    id: 'healer',
    name: 'Healer',
    category: 'origin',
    mechanics: mech(),
    effect:
      "With a Healer's Kit you can spend one use as a Utilize action to tend a creature within 5 feet: it may spend a Hit Point Die, and it regains the roll plus your Proficiency Bonus. When you roll dice to restore Hit Points with a spell or this feat, you can reroll a 1 (use the new roll).",
    source: 'PHB 2024 "Healer" (L8488)',
  },
  lucky: {
    id: 'lucky',
    name: 'Lucky',
    category: 'origin',
    mechanics: mech(),
    effect:
      'You have Luck Points equal to your Proficiency Bonus, regained on a Long Rest. Spend 1 to gain Advantage on a d20 for a D20 Test, or to impose Disadvantage on a creature’s d20 attack roll against you.',
    uses: { count: { by: 'proficiency-bonus' }, recharge: 'long-rest', pool: 'luck-points', unit: ['Luck Point', 'Luck Points'] }, // PHB L8496-8500: Luck Points = Proficiency Bonus (total level)
    source: 'PHB 2024 "Lucky" (L8496)',
  },
  'magic-initiate-cleric': magicInitiate('Cleric'),
  'magic-initiate-druid': magicInitiate('Druid'),
  'magic-initiate-wizard': magicInitiate('Wizard'),
  musician: {
    id: 'musician',
    name: 'Musician',
    category: 'origin',
    mechanics: mech({ tools: 3 }, { toolsFrom: 'musical-instruments' }),
    effect:
      'Gain proficiency with three Musical Instruments of your choice. As you finish a Short or Long Rest you can play a song on an instrument you are proficient with, giving Heroic Inspiration to a number of allies who hear it equal to your Proficiency Bonus.',
    source: 'PHB 2024 "Musician" (L8520)',
  },
  'savage-attacker': {
    id: 'savage-attacker',
    name: 'Savage Attacker',
    category: 'origin',
    mechanics: mech(),
    effect:
      'Once per turn when you hit a target with a weapon, you can roll the weapon’s damage dice twice and use either roll.',
    source: 'PHB 2024 "Savage Attacker" (L8528)',
  },
  skilled: {
    id: 'skilled',
    name: 'Skilled',
    category: 'origin',
    repeatable: true, // PHB L8532: "Repeatable."
    // PHB L8532: proficiency in any combination of three skills or tools.
    mechanics: mech({ skillsOrTools: 3 }),
    effect: 'Gain proficiency in any combination of three skills or tools of your choice.',
    source: 'PHB 2024 "Skilled" (L8532)',
  },
  'tavern-brawler': {
    id: 'tavern-brawler',
    name: 'Tavern Brawler',
    category: 'origin',
    mechanics: mech({}, { fixed: ['weapon-proficiency:improvised'] }),
    effect:
      'Your Unarmed Strike can deal 1d4 + Strength modifier Bludgeoning damage, and you can reroll a 1 on its damage die. You are proficient with improvised weapons. Once per turn, when you hit with an Unarmed Strike as part of the Attack action, you can also push the target 5 feet away.',
    source: 'PHB 2024 "Tavern Brawler" (L8538)',
  },
  tough: {
    id: 'tough',
    name: 'Tough',
    category: 'origin',
    mechanics: mech({}, { fixed: ['hp-max:+2-per-level'] }),
    effect:
      'Your Hit Point maximum increases by twice your character level when you gain this feat, and by 2 more each time you gain a level afterward.',
    source: 'PHB 2024 "Tough" (L8550)',
  },

  // ══ General feats (Level 4+ — PHB L8554+) ═════════════════════════════════
  'ability-score-improvement': {
    id: 'ability-score-improvement',
    name: 'Ability Score Improvement',
    category: 'general',
    prerequisite: L4, // PHB L8558: General Feat (Prerequisite: Level 4+).
    repeatable: true, // PHB L8558: "Repeatable."
    abilityIncrease: { kind: 'asi' },
    mechanics: mech(),
    effect: 'Increase one ability score by 2, or two ability scores by 1 (maximum 20).',
    source: 'PHB 2024 "Ability Score Improvement" (L8558)',
  },
  actor: {
    id: 'actor',
    name: 'Actor',
    category: 'general',
    prerequisite: { minLevel: 4, abilityMin: { cha: 13 } },
    abilityIncrease: fixedInc('cha'),
    mechanics: mech(),
    effect:
      'Increase Charisma by 1 (maximum 20). While disguised as a real or fictional person you have Advantage on Charisma (Deception or Performance) checks to pass as them. You can mimic other creatures’ sounds and speech; a listener needs a successful Wisdom (Insight) check against DC 8 + your Charisma modifier + your Proficiency Bonus to spot the fake.',
    source: 'PHB 2024 "Actor" (L8564)',
  },
  athlete: {
    id: 'athlete',
    name: 'Athlete',
    category: 'general',
    prerequisite: anyOf(STR_DEX),
    abilityIncrease: choose(STR_DEX),
    mechanics: mech({}, { fixed: ['speed:climb-equals-speed'] }),
    effect:
      'Increase Strength or Dexterity by 1 (maximum 20). You gain a Climb Speed equal to your Speed. Standing up from Prone costs only 5 feet of movement. You can make a running Long or High Jump after moving only 5 feet.',
    source: 'PHB 2024 "Athlete" (L8576)',
  },
  charger: {
    id: 'charger',
    name: 'Charger',
    category: 'general',
    prerequisite: anyOf(STR_DEX),
    abilityIncrease: choose(STR_DEX),
    mechanics: mech(),
    effect:
      'Increase Strength or Dexterity by 1 (maximum 20). Your Speed gains +10 feet when you take the Dash action. Once per turn, if you move at least 10 feet straight toward a target and then hit it with a melee attack as part of the Attack action, you either add 1d8 damage or push the target up to 10 feet (if it is no more than one size larger than you).',
    source: 'PHB 2024 "Charger" (L8592)',
  },
  chef: {
    id: 'chef',
    name: 'Chef',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(['con', 'wis']),
    mechanics: mech({}, { fixed: ['tool-proficiency:cooks-utensils'] }),
    effect:
      "Increase Constitution or Wisdom by 1 (maximum 20). Gain proficiency with Cook's Utensils if you lack it. During a Short Rest you can cook a meal for 4 + your Proficiency Bonus creatures; those who eat it and spend Hit Dice regain an extra 1d8 Hit Points. With 1 hour of work or after a Long Rest you can make treats equal to your Proficiency Bonus, lasting 8 hours; eating one as a Bonus Action grants Temporary Hit Points equal to your Proficiency Bonus.",
    source: 'PHB 2024 "Chef" (L8604)',
  },
  'crossbow-expert': {
    id: 'crossbow-expert',
    name: 'Crossbow Expert',
    category: 'general',
    prerequisite: { minLevel: 4, abilityMin: { dex: 13 } },
    abilityIncrease: fixedInc('dex'),
    mechanics: mech(),
    effect:
      'Increase Dexterity by 1 (maximum 20). You ignore the Loading property of Hand, Heavy and Light Crossbows and can load one without a free hand. Being within 5 feet of an enemy does not impose Disadvantage on your crossbow attacks. On the Light-property extra attack with a Light crossbow, you can add your ability modifier to the damage if you are not already doing so.',
    source: 'PHB 2024 "Crossbow Expert" (L8618)',
  },
  crusher: {
    id: 'crusher',
    name: 'Crusher',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(['str', 'con']),
    mechanics: mech(),
    effect:
      'Increase Strength or Constitution by 1 (maximum 20). Once per turn, when you hit with an attack that deals Bludgeoning damage, you can move the target 5 feet to an unoccupied space if it is no more than one size larger than you. When you score a Critical Hit with Bludgeoning damage, attack rolls against that creature have Advantage until the start of your next turn.',
    source: 'PHB 2024 "Crusher" (L8632)',
  },
  'defensive-duelist': {
    id: 'defensive-duelist',
    name: 'Defensive Duelist',
    category: 'general',
    prerequisite: { minLevel: 4, abilityMin: { dex: 13 } },
    abilityIncrease: fixedInc('dex'),
    mechanics: mech(),
    effect:
      'Increase Dexterity by 1 (maximum 20). While holding a Finesse weapon, when a melee attack hits you, you can use your Reaction to add your Proficiency Bonus to your AC against melee attacks until the start of your next turn, possibly causing that attack to miss.',
    source: 'PHB 2024 "Defensive Duelist" (L8644)',
  },
  'dual-wielder': {
    id: 'dual-wielder',
    name: 'Dual Wielder',
    category: 'general',
    prerequisite: anyOf(STR_DEX),
    abilityIncrease: choose(STR_DEX),
    mechanics: mech(),
    effect:
      'Increase Strength or Dexterity by 1 (maximum 20). After the Attack action with a Light weapon, you can make one extra attack as a Bonus Action with a different Melee weapon that lacks the Two-Handed property; you add the ability modifier to its damage only if it is negative. You can draw or stow two weapons that lack the Two-Handed property at once.',
    source: 'PHB 2024 "Dual Wielder" (L8654)',
  },
  durable: {
    id: 'durable',
    name: 'Durable',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: fixedInc('con'),
    mechanics: mech(),
    effect:
      'Increase Constitution by 1 (maximum 20). You have Advantage on Death Saving Throws. As a Bonus Action you can spend one Hit Point Die, roll it, and regain Hit Points equal to the roll.',
    source: 'PHB 2024 "Durable" (L8666)',
  },
  'elemental-adept': {
    id: 'elemental-adept',
    name: 'Elemental Adept',
    category: 'general',
    prerequisite: { minLevel: 4, spellcasting: 'spellcasting-or-pact-magic' },
    // PHB L8688: repeatable, a different damage type each time. NOT ENFORCED: the
    // app does not record the damage type chosen, so a repeat is not checked.
    repeatable: true,
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech(
      {},
      {
        choices: [
          { key: 'damage-type', count: 1, from: ['acid', 'cold', 'fire', 'lightning', 'thunder'] },
        ],
      },
    ),
    effect:
      'Increase Intelligence, Wisdom or Charisma by 1 (maximum 20). Choose Acid, Cold, Fire, Lightning or Thunder: your spells ignore Resistance to that damage type, and you can treat a 1 on a damage die of such a spell as a 2. Repeat the feat with a different damage type each time.',
    source: 'PHB 2024 "Elemental Adept" (L8678)',
  },
  'fey-touched': {
    id: 'fey-touched',
    name: 'Fey-Touched',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech(
      {},
      {
        fixed: ['spell:misty-step'],
        choices: [{ key: 'level-1-spell', count: 1, from: ['divination', 'enchantment'] }],
      },
    ),
    effect:
      'Increase Intelligence, Wisdom or Charisma by 1 (maximum 20). Choose one level 1 Divination or Enchantment spell. That spell and Misty Step are always prepared, and each can be cast once per Long Rest without a slot (or with a slot). The increased ability is their spellcasting ability.',
    uses: { count: 1, recharge: 'long-rest', pool: 'free-cast', variants: ['Chosen spell', 'Misty Step'] }, // PHB L8690-8698: each spell once per Long Rest free
    source: 'PHB 2024 "Fey-Touched" (L8690)',
  },
  grappler: {
    id: 'grappler',
    name: 'Grappler',
    category: 'general',
    prerequisite: anyOf(STR_DEX),
    abilityIncrease: choose(STR_DEX),
    mechanics: mech(),
    effect:
      'Increase Strength or Dexterity by 1 (maximum 20). Once per turn, when you hit with an Unarmed Strike as part of the Attack action, you can both deal damage and Grapple. You have Advantage on attack rolls against a creature you are Grappling. Your Speed is not halved when you move a Grappled creature of your size or smaller.',
    source: 'PHB 2024 "Grappler" (L8700)',
  },
  'great-weapon-master': {
    id: 'great-weapon-master',
    name: 'Great Weapon Master',
    category: 'general',
    prerequisite: { minLevel: 4, abilityMin: { str: 13 } },
    abilityIncrease: fixedInc('str'),
    mechanics: mech(),
    effect:
      'Increase Strength by 1 (maximum 20). When you hit with a Heavy weapon as part of the Attack action, you deal extra damage equal to your Proficiency Bonus. Right after a Critical Hit or reducing a creature to 0 Hit Points with a Melee weapon, you can make one attack with the same weapon as a Bonus Action.',
    source: 'PHB 2024 "Great Weapon Master" (L8714)',
  },
  'heavily-armored': {
    id: 'heavily-armored',
    name: 'Heavily Armored',
    category: 'general',
    prerequisite: { minLevel: 4, armorTraining: 'medium' },
    abilityIncrease: choose(['con', 'str']),
    mechanics: mech({}, { fixed: ['armor-training:heavy'] }),
    effect: 'Increase Constitution or Strength by 1 (maximum 20). You gain training with Heavy armor.',
    source: 'PHB 2024 "Heavily Armored" (L8728)',
  },
  'heavy-armor-master': {
    id: 'heavy-armor-master',
    name: 'Heavy Armor Master',
    category: 'general',
    prerequisite: { minLevel: 4, armorTraining: 'heavy' },
    abilityIncrease: choose(['con', 'str']),
    mechanics: mech(),
    effect:
      'Increase Constitution or Strength by 1 (maximum 20). While you wear Heavy armor, Bludgeoning, Piercing and Slashing damage from attacks that hit you is reduced by your Proficiency Bonus.',
    source: 'PHB 2024 "Heavy Armor Master" (L8738)',
  },
  'inspiring-leader': {
    id: 'inspiring-leader',
    name: 'Inspiring Leader',
    category: 'general',
    prerequisite: anyOf(['wis', 'cha']),
    abilityIncrease: choose(['wis', 'cha']),
    mechanics: mech(),
    effect:
      'Increase Wisdom or Charisma by 1 (maximum 20). After a Short or Long Rest you can give an inspiring performance to up to six allies (yourself included) within 30 feet; each gains Temporary Hit Points equal to your character level plus the modifier of the ability you increased with this feat.',
    source: 'PHB 2024 "Inspiring Leader" (L8748)',
  },
  'keen-mind': {
    id: 'keen-mind',
    name: 'Keen Mind',
    category: 'general',
    prerequisite: { minLevel: 4, abilityMin: { int: 13 } },
    abilityIncrease: fixedInc('int'),
    mechanics: mech(
      {},
      {
        // Proficiency if lacking, else Expertise (not a free Expertise pick).
        choices: [
          {
            key: 'skill-proficiency-or-expertise',
            count: 1,
            from: ['arcana', 'history', 'investigation', 'nature', 'religion'],
          },
        ],
      },
    ),
    effect:
      'Increase Intelligence by 1 (maximum 20). Choose Arcana, History, Investigation, Nature or Religion: you gain proficiency in it, or Expertise if you are already proficient. You can take the Study action as a Bonus Action.',
    source: 'PHB 2024 "Keen Mind" (L8758)',
  },
  'lightly-armored': {
    id: 'lightly-armored',
    name: 'Lightly Armored',
    category: 'general',
    prerequisite: L4, // The PHB text prints only "Level 4+" here.
    abilityIncrease: choose(STR_DEX),
    mechanics: mech({}, { fixed: ['armor-training:light', 'armor-training:shield'] }),
    effect: 'Increase Strength or Dexterity by 1 (maximum 20). You gain training with Light armor and Shields.',
    source: 'PHB 2024 "Lightly Armored" (L8768)',
  },
  'mage-slayer': {
    id: 'mage-slayer',
    name: 'Mage Slayer',
    category: 'general',
    prerequisite: L4, // The PHB text in Docs/ prints only "Level 4+".
    abilityIncrease: choose(STR_DEX),
    mechanics: mech(),
    effect:
      'Increase Strength or Dexterity by 1 (maximum 20). A creature you damage while it is concentrating has Disadvantage on the save to keep Concentration. If you fail an Intelligence, Wisdom or Charisma saving throw, you can succeed instead; you regain this use after a Short or Long Rest.',
    uses: { count: 1, recharge: 'short-or-long-rest', pool: 'guarded-mind' }, // PHB L8776-8784
    source: 'PHB 2024 "Mage Slayer" (L8776)',
  },
  'martial-weapon-training': {
    id: 'martial-weapon-training',
    name: 'Martial Weapon Training',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(STR_DEX),
    mechanics: mech({}, { fixed: ['weapon-proficiency:martial'] }),
    effect: 'Increase Strength or Dexterity by 1 (maximum 20). You gain proficiency with Martial weapons.',
    source: 'PHB 2024 "Martial Weapon Training" (L8786)',
  },
  'medium-armor-master': {
    id: 'medium-armor-master',
    name: 'Medium Armor Master',
    category: 'general',
    prerequisite: { minLevel: 4, armorTraining: 'medium' },
    abilityIncrease: choose(STR_DEX),
    mechanics: mech({}, { fixed: ['ac:medium-armor-plus-3-if-dex-16-plus'] }),
    effect:
      'Increase Strength or Dexterity by 1 (maximum 20). While wearing Medium armor, you add 3 instead of 2 to your AC if your Dexterity score is 16 or higher.',
    source: 'PHB 2024 "Medium Armor Master" (L8796)',
  },
  'moderately-armored': {
    id: 'moderately-armored',
    name: 'Moderately Armored',
    category: 'general',
    prerequisite: { minLevel: 4, armorTraining: 'light' },
    abilityIncrease: choose(STR_DEX),
    mechanics: mech({}, { fixed: ['armor-training:medium'] }),
    effect: 'Increase Strength or Dexterity by 1 (maximum 20). You gain training with Medium armor.',
    source: 'PHB 2024 "Moderately Armored" (L8806)',
  },
  'mounted-combatant': {
    id: 'mounted-combatant',
    name: 'Mounted Combatant',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(['str', 'dex', 'wis']),
    mechanics: mech(),
    effect:
      'Increase Strength, Dexterity or Wisdom by 1 (maximum 20). While mounted you have Advantage on attacks against unmounted creatures within 5 feet of your mount that are at least one size smaller than it. Your mount takes no damage on a successful Dexterity save against half-damage effects, and half on a failure. You can redirect an attack that hits your mount to yourself if you are not Incapacitated.',
    source: 'PHB 2024 "Mounted Combatant" (L8816)',
  },
  observant: {
    id: 'observant',
    name: 'Observant',
    category: 'general',
    prerequisite: anyOf(['int', 'wis']),
    abilityIncrease: choose(['int', 'wis']),
    mechanics: mech(
      {},
      {
        choices: [
          {
            key: 'skill-proficiency-or-expertise',
            count: 1,
            from: ['insight', 'investigation', 'perception'],
          },
        ],
      },
    ),
    effect:
      'Increase Intelligence or Wisdom by 1 (maximum 20). Choose Insight, Investigation or Perception: you gain proficiency in it, or Expertise if you are already proficient. You can take the Search action as a Bonus Action.',
    source: 'PHB 2024 "Observant" (L8828)',
  },
  piercer: {
    id: 'piercer',
    name: 'Piercer',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(STR_DEX),
    mechanics: mech(),
    effect:
      'Increase Strength or Dexterity by 1 (maximum 20). Once per turn, when you hit with an attack that deals Piercing damage, you can reroll one of its damage dice and must use the new roll. On a Critical Hit with Piercing damage, roll one additional damage die.',
    source: 'PHB 2024 "Piercer" (L8840)',
  },
  poisoner: {
    id: 'poisoner',
    name: 'Poisoner',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(['dex', 'int']),
    mechanics: mech({}, { fixed: ['tool-proficiency:poisoners-kit'] }),
    effect:
      "Increase Dexterity or Intelligence by 1 (maximum 20). Your Poison damage ignores Resistance to Poison. You gain proficiency with the Poisoner's Kit; with 1 hour of work and 50 GP of materials you can make doses equal to your Proficiency Bonus. A dose applied (Bonus Action) to a weapon or ammunition lasts 1 minute or until it hits; the target must succeed on a Constitution save (DC 8 + the increased ability's modifier + your Proficiency Bonus) or take 2d8 Poison damage and be Poisoned until the end of your next turn.",
    source: 'PHB 2024 "Poisoner" (L8852)',
  },
  'polearm-master': {
    id: 'polearm-master',
    name: 'Polearm Master',
    category: 'general',
    prerequisite: anyOf(STR_DEX),
    abilityIncrease: choose(STR_DEX),
    mechanics: mech(),
    effect:
      'Increase Strength or Dexterity by 1 (maximum 20). After the Attack action with a Quarterstaff, Spear, or a Heavy and Reach weapon, you can use a Bonus Action for a melee attack with the weapon’s other end (Bludgeoning, d4 damage die). While holding such a weapon, you can use your Reaction to attack a creature that enters your reach.',
    source: 'PHB 2024 "Polearm Master" (L8862)',
  },
  resilient: {
    id: 'resilient',
    name: 'Resilient',
    category: 'general',
    prerequisite: L4,
    // Any ability in which you LACK save proficiency (all six are candidates;
    // the lack-of-proficiency filter is applied at selection time).
    abilityIncrease: choose(ALL_SIX),
    mechanics: mech({ saveProficiencyChoice: true }),
    effect:
      'Choose an ability in which you lack saving throw proficiency. Increase it by 1 (maximum 20) and gain saving throw proficiency with it.',
    source: 'PHB 2024 "Resilient" (L8874)',
  },
  'ritual-caster': {
    id: 'ritual-caster',
    name: 'Ritual Caster',
    category: 'general',
    prerequisite: anyOf(INT_WIS_CHA),
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech(
      {},
      {
        choices: [{ key: 'ritual-spell-level-1', count: 'proficiency-bonus', from: 'tag:ritual' }],
      },
    ),
    effect:
      'Increase Intelligence, Wisdom or Charisma by 1 (maximum 20). Choose a number of level 1 spells with the Ritual tag equal to your Proficiency Bonus; they are always prepared and the increased ability is their spellcasting ability. Add another whenever your Proficiency Bonus rises. Once per Long Rest you can cast a prepared Ritual spell at its normal casting time without a slot.',
    uses: { count: 1, recharge: 'long-rest', pool: 'quick-ritual' }, // PHB L8884-8900
    source: 'PHB 2024 "Ritual Caster" (L8884)',
  },
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    category: 'general',
    prerequisite: anyOf(STR_DEX),
    abilityIncrease: choose(STR_DEX),
    mechanics: mech(),
    effect:
      'Increase Strength or Dexterity by 1 (maximum 20). When a creature within 5 feet takes the Disengage action or hits someone other than you, you can make an Opportunity Attack against it. A creature you hit with an Opportunity Attack has its Speed become 0 for the rest of the turn.',
    source: 'PHB 2024 "Sentinel" (L8902)',
  },
  'shadow-touched': {
    id: 'shadow-touched',
    name: 'Shadow-Touched',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech(
      {},
      {
        fixed: ['spell:invisibility'],
        choices: [{ key: 'level-1-spell', count: 1, from: ['illusion', 'necromancy'] }],
      },
    ),
    effect:
      'Increase Intelligence, Wisdom or Charisma by 1 (maximum 20). Choose one level 1 Illusion or Necromancy spell. That spell and Invisibility are always prepared, and each can be cast once per Long Rest without a slot (or with a slot). The increased ability is their spellcasting ability.',
    uses: { count: 1, recharge: 'long-rest', pool: 'free-cast', variants: ['Chosen spell', 'Invisibility'] }, // PHB L8914-8922: each spell once per Long Rest free
    source: 'PHB 2024 "Shadow-Touched" (L8914)',
  },
  sharpshooter: {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    category: 'general',
    prerequisite: { minLevel: 4, abilityMin: { dex: 13 } },
    abilityIncrease: fixedInc('dex'),
    mechanics: mech(),
    effect:
      'Increase Dexterity by 1 (maximum 20). Your ranged weapon attacks ignore Half Cover and Three-Quarters Cover, and long range does not impose Disadvantage on your Ranged weapon attacks.',
    source: 'PHB 2024 "Sharpshooter" (L8924)',
  },
  'shield-master': {
    id: 'shield-master',
    name: 'Shield Master',
    category: 'general',
    prerequisite: { minLevel: 4, armorTraining: 'shield' },
    abilityIncrease: fixedInc('str'),
    mechanics: mech(),
    effect:
      'Increase Strength by 1 (maximum 20). Once per turn, after hitting with a Melee weapon as part of the Attack action, you can bash with your equipped Shield: the target makes a Strength save (DC 8 + Strength modifier + Proficiency Bonus) or is pushed 5 feet or knocked Prone (your choice). When a Dexterity save would halve damage, you can use your Reaction to take none on a success while holding a Shield.',
    source: 'PHB 2024 "Shield Master" (L8938)',
  },
  'skill-expert': {
    id: 'skill-expert',
    name: 'Skill Expert',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(ALL_SIX),
    // One new skill proficiency AND one Expertise (in a proficient skill lacking it).
    mechanics: mech({ skills: 1, expertise: 1 }),
    effect:
      'Increase one ability score of your choice by 1 (maximum 20). Gain proficiency in one skill of your choice, then choose one skill you are proficient in but lack Expertise in and gain Expertise in it.',
    source: 'PHB 2024 "Skill Expert" (L8950)',
  },
  skulker: {
    id: 'skulker',
    name: 'Skulker',
    category: 'general',
    prerequisite: { minLevel: 4, abilityMin: { dex: 13 } },
    abilityIncrease: fixedInc('dex'),
    mechanics: mech({}, { fixed: ['sense:blindsight-10'] }),
    effect:
      'Increase Dexterity by 1 (maximum 20). You have Blindsight with a range of 10 feet. You have Advantage on Dexterity (Stealth) checks made as part of the Hide action in combat. A missed attack roll made while hidden does not reveal your position.',
    source: 'PHB 2024 "Skulker" (L8962)',
  },
  slasher: {
    id: 'slasher',
    name: 'Slasher',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(STR_DEX),
    mechanics: mech(),
    effect:
      'Increase Strength or Dexterity by 1 (maximum 20). Once per turn, when you hit with an attack that deals Slashing damage, you can reduce the target’s Speed by 10 feet until the start of your next turn. On a Critical Hit with Slashing damage, the target has Disadvantage on attack rolls until the start of your next turn.',
    source: 'PHB 2024 "Slasher" (L8976)',
  },
  speedy: {
    id: 'speedy',
    name: 'Speedy',
    category: 'general',
    prerequisite: anyOf(['dex', 'con']),
    abilityIncrease: choose(['dex', 'con']),
    mechanics: mech({}, { fixed: ['speed:+10'] }),
    effect:
      'Increase Dexterity or Constitution by 1 (maximum 20). Your Speed increases by 10 feet. When you take the Dash action, Difficult Terrain costs you no extra movement for the rest of that turn. Opportunity Attacks against you have Disadvantage.',
    source: 'PHB 2024 "Speedy" (L8988)',
  },
  'spell-sniper': {
    id: 'spell-sniper',
    name: 'Spell Sniper',
    category: 'general',
    prerequisite: { minLevel: 4, spellcasting: 'spellcasting-or-pact-magic' },
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech(),
    effect:
      'Increase Intelligence, Wisdom or Charisma by 1 (maximum 20). Being within 5 feet of an enemy does not impose Disadvantage on your spell attack rolls, and your spell attacks ignore Half Cover and Three-Quarters Cover. A spell with a range of at least 10 feet that requires an attack roll has its range increased by 60 feet.',
    source: 'PHB 2024 "Spell Sniper" (L9002)',
  },
  telekinetic: {
    id: 'telekinetic',
    name: 'Telekinetic',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech({}, { fixed: ['spell:mage-hand'] }),
    effect:
      'Increase Intelligence, Wisdom or Charisma by 1 (maximum 20). You learn Mage Hand, castable without Verbal or Somatic components, with an Invisible hand and +30 feet range; the increased ability is its spellcasting ability. As a Bonus Action you can shove a creature you can see within 30 feet: it needs a Strength save (DC 8 + the increased ability modifier + Proficiency Bonus) or is moved 5 feet toward or away from you.',
    source: 'PHB 2024 "Telekinetic" (L9016)',
  },
  telepathic: {
    id: 'telepathic',
    name: 'Telepathic',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech({}, { fixed: ['spell:detect-thoughts'] }),
    effect:
      'Increase Intelligence, Wisdom or Charisma by 1 (maximum 20). You can speak telepathically to any creature you can see within 60 feet, in a language you know (it cannot reply telepathically). Detect Thoughts is always prepared; cast it once per Long Rest without a slot or components (or with a slot), using the increased ability.',
    uses: { count: 1, recharge: 'long-rest', pool: 'detect-thoughts' }, // PHB L9028-9040
    source: 'PHB 2024 "Telepathic" (L9028)',
  },
  'war-caster': {
    id: 'war-caster',
    name: 'War Caster',
    category: 'general',
    prerequisite: { minLevel: 4, spellcasting: 'spellcasting-or-pact-magic' },
    abilityIncrease: choose(INT_WIS_CHA),
    mechanics: mech(),
    effect:
      'Increase Intelligence, Wisdom or Charisma by 1 (maximum 20). You have Advantage on Constitution saves to maintain Concentration. When a creature provokes an Opportunity Attack by leaving your reach, you can use your Reaction to cast a one-action spell targeting only that creature instead. You can perform Somatic components with weapons or a Shield in hand.',
    source: 'PHB 2024 "War Caster" (L9042)',
  },
  'weapon-master': {
    id: 'weapon-master',
    name: 'Weapon Master',
    category: 'general',
    prerequisite: L4,
    abilityIncrease: choose(STR_DEX),
    mechanics: mech(
      {},
      {
        choices: [{ key: 'weapon-mastery-kind', count: 1, from: 'proficient-simple-or-martial' }],
      },
    ),
    effect:
      'Increase Strength or Dexterity by 1 (maximum 20). Choose one kind of Simple or Martial weapon you are proficient with and use its mastery property; you can change the chosen kind whenever you finish a Long Rest.',
    source: 'PHB 2024 "Weapon Master" (L9056)',
  },

  // ══ Fighting Style feats (Prerequisite: Fighting Style Feature — PHB L9064+) ══
  archery: {
    id: 'archery',
    name: 'Archery',
    category: 'fighting-style',
    prerequisite: FIGHTING_STYLE,
    mechanics: mech({}, { fixed: ['attack-bonus:+2-ranged'] }),
    effect: 'You gain a +2 bonus to attack rolls with Ranged weapons.',
    source: 'PHB 2024 "Archery" (L9068)',
  },
  'blind-fighting': {
    id: 'blind-fighting',
    name: 'Blind Fighting',
    category: 'fighting-style',
    prerequisite: FIGHTING_STYLE,
    mechanics: mech({}, { fixed: ['sense:blindsight-10'] }),
    effect: 'You have Blindsight with a range of 10 feet.',
    source: 'PHB 2024 "Blind Fighting" (L9072)',
  },
  defense: {
    id: 'defense',
    name: 'Defense',
    category: 'fighting-style',
    prerequisite: FIGHTING_STYLE,
    mechanics: mech({}, { fixed: ['ac:+1-while-wearing-light-medium-or-heavy-armor'] }),
    effect: 'While you wear Light, Medium or Heavy armor, you gain a +1 bonus to Armor Class.',
    source: 'PHB 2024 "Defense" (L9076)',
  },
  dueling: {
    id: 'dueling',
    name: 'Dueling',
    category: 'fighting-style',
    prerequisite: FIGHTING_STYLE,
    mechanics: mech({}, { fixed: ['damage:+2-one-handed-melee'] }),
    effect:
      'While holding a Melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.',
    source: 'PHB 2024 "Dueling" (L9082)',
  },
  'great-weapon-fighting': {
    id: 'great-weapon-fighting',
    name: 'Great Weapon Fighting',
    category: 'fighting-style',
    prerequisite: FIGHTING_STYLE,
    mechanics: mech(),
    effect:
      'When you roll damage for a Melee weapon attack with a weapon held in two hands, you can treat a 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property.',
    source: 'PHB 2024 "Great Weapon Fighting" (L9088)',
  },
  interception: {
    id: 'interception',
    name: 'Interception',
    category: 'fighting-style',
    prerequisite: FIGHTING_STYLE,
    mechanics: mech(),
    effect:
      'When a creature you can see hits another creature within 5 feet of you, you can use your Reaction to reduce the damage by 1d10 + your Proficiency Bonus. You must be holding a Shield or a Simple or Martial weapon.',
    source: 'PHB 2024 "Interception" (L9092)',
  },
  protection: {
    id: 'protection',
    name: 'Protection',
    category: 'fighting-style',
    prerequisite: FIGHTING_STYLE,
    mechanics: mech(),
    effect:
      'When a creature you can see attacks a target other than you within 5 feet of you, you can use your Reaction to interpose a Shield you hold. The triggering attack roll and all other attack rolls against that target have Disadvantage until the start of your next turn, as long as you stay within 5 feet of it.',
    source: 'PHB 2024 "Protection" (L9096)',
  },
  'thrown-weapon-fighting': {
    id: 'thrown-weapon-fighting',
    name: 'Thrown Weapon Fighting',
    category: 'fighting-style',
    prerequisite: FIGHTING_STYLE,
    mechanics: mech({}, { fixed: ['damage:+2-thrown-ranged'] }),
    effect:
      'When you hit with a ranged attack roll using a weapon with the Thrown property, you gain a +2 bonus to the damage roll.',
    source: 'PHB 2024 "Thrown Weapon Fighting" (L9104)',
  },
  'two-weapon-fighting': {
    id: 'two-weapon-fighting',
    name: 'Two-Weapon Fighting',
    category: 'fighting-style',
    prerequisite: FIGHTING_STYLE,
    mechanics: mech(),
    effect:
      'When you make the extra attack granted by a weapon with the Light property, you can add your ability modifier to that attack’s damage if you are not already adding it.',
    source: 'PHB 2024 "Two-Weapon Fighting" (L9110)',
  },
  'unarmed-fighting': {
    id: 'unarmed-fighting',
    name: 'Unarmed Fighting',
    category: 'fighting-style',
    prerequisite: FIGHTING_STYLE,
    mechanics: mech(),
    effect:
      'Your Unarmed Strike can deal 1d6 + Strength modifier Bludgeoning damage (1d8 if you hold no weapons or Shield when you make the attack roll). At the start of each of your turns, you can deal 1d4 Bludgeoning damage to one creature you are Grappling.',
    source: 'PHB 2024 "Unarmed Fighting" (L9116)',
  },

  // ══ Epic Boon feats (Level 19+; +1 to an ability, maximum 30 — PHB L9124+) ══
  'boon-of-combat-prowess': {
    id: 'boon-of-combat-prowess',
    name: 'Boon of Combat Prowess',
    category: 'epic-boon',
    prerequisite: L19,
    abilityIncrease: boon(),
    mechanics: mech(),
    effect:
      'Increase one ability score by 1 (maximum 30). When you miss with an attack roll you can hit instead; you cannot use this again until the start of your next turn.',
    source: 'PHB 2024 "Boon of Combat Prowess" (L9130)',
  },
  'boon-of-dimensional-travel': {
    id: 'boon-of-dimensional-travel',
    name: 'Boon of Dimensional Travel',
    category: 'epic-boon',
    prerequisite: L19,
    abilityIncrease: boon(),
    mechanics: mech(),
    effect:
      'Increase one ability score by 1 (maximum 30). Right after taking the Attack or Magic action, you can teleport up to 30 feet to an unoccupied space you can see.',
    source: 'PHB 2024 "Boon of Dimensional Travel" (L9142)',
  },
  'boon-of-energy-resistance': {
    id: 'boon-of-energy-resistance',
    name: 'Boon of Energy Resistance',
    category: 'epic-boon',
    prerequisite: L19,
    abilityIncrease: boon(),
    mechanics: mech(
      {},
      {
        choices: [
          {
            key: 'resistance-type',
            count: 2,
            from: [
              'acid',
              'cold',
              'fire',
              'lightning',
              'necrotic',
              'poison',
              'psychic',
              'radiant',
              'thunder',
            ],
          },
        ],
      },
    ),
    effect:
      'Increase one ability score by 1 (maximum 30). Choose two of Acid, Cold, Fire, Lightning, Necrotic, Poison, Psychic, Radiant or Thunder to resist; you can change them after each Long Rest. When you take damage of a chosen type, you can use your Reaction to send it at another creature you can see within 60 feet (not behind Total Cover): it makes a Dexterity save (DC 8 + Constitution modifier + Proficiency Bonus) or takes 2d12 + your Constitution modifier damage.',
    source: 'PHB 2024 "Boon of Energy Resistance" (L9152)',
  },
  'boon-of-fate': {
    id: 'boon-of-fate',
    name: 'Boon of Fate',
    category: 'epic-boon',
    prerequisite: L19,
    abilityIncrease: boon(),
    mechanics: mech(),
    effect:
      'Increase one ability score by 1 (maximum 30). When you or a creature within 60 feet succeeds or fails a D20 Test, you can roll 2d4 and apply it as a bonus or penalty to the d20. You regain this use when you roll Initiative or finish a Short or Long Rest.',
    uses: { count: 1, recharge: 'short-or-long-rest', pool: 'improve-fate', alsoRestoredBy: 'roll Initiative' }, // PHB L9164-9170: Initiative regain is manual
    source: 'PHB 2024 "Boon of Fate" (L9164)',
  },
  'boon-of-fortitude': {
    id: 'boon-of-fortitude',
    name: 'Boon of Fortitude',
    category: 'epic-boon',
    prerequisite: L19,
    abilityIncrease: boon(),
    mechanics: mech({}, { fixed: ['hp-max:+40'] }),
    effect:
      'Increase one ability score by 1 (maximum 30). Your Hit Point maximum increases by 40. Once per turn, when you regain Hit Points you can regain extra Hit Points equal to your Constitution modifier.',
    source: 'PHB 2024 "Boon of Fortitude" (L9172)',
  },
  'boon-of-irresistible-offense': {
    id: 'boon-of-irresistible-offense',
    name: 'Boon of Irresistible Offense',
    category: 'epic-boon',
    prerequisite: L19,
    abilityIncrease: boon(STR_DEX), // Strength or Dexterity only
    mechanics: mech(),
    effect:
      'Increase Strength or Dexterity by 1 (maximum 30). Your Bludgeoning, Piercing and Slashing damage always ignores Resistance. When you roll a 20 on an attack roll, you deal extra damage equal to the ability score you increased with this feat, of the attack’s damage type.',
    source: 'PHB 2024 "Boon of Irresistible Offense" (L9180)',
  },
  'boon-of-recovery': {
    id: 'boon-of-recovery',
    name: 'Boon of Recovery',
    category: 'epic-boon',
    prerequisite: L19,
    abilityIncrease: boon(),
    mechanics: mech(),
    effect:
      'Increase one ability score by 1 (maximum 30). Once per Long Rest, when you would drop to 0 Hit Points you can drop to 1 instead and regain Hit Points equal to half your Hit Point maximum. You also have a pool of ten d10s; as a Bonus Action spend dice, roll them and regain that many Hit Points. The pool refills on a Long Rest.',
    // PHB L9190-9198: Last Stand and Recover Vitality are two separate pools
    uses: [
      { count: 1, recharge: 'long-rest', pool: 'last-stand' }, // PHB L9196
      { count: 10, recharge: 'long-rest', pool: 'recover-vitality', unit: ['die', 'dice'], dieSize: 10 }, // PHB L9198: ten d10s
    ],
    source: 'PHB 2024 "Boon of Recovery" (L9190)',
  },
  'boon-of-skill': {
    id: 'boon-of-skill',
    name: 'Boon of Skill',
    category: 'epic-boon',
    prerequisite: L19,
    abilityIncrease: boon(),
    // Proficiency in ALL skills, plus one Expertise pick (a skill lacking Expertise).
    mechanics: mech({ allSkills: true, expertise: 1 }),
    effect:
      'Increase one ability score by 1 (maximum 30). You gain proficiency in all skills, and Expertise in one skill of your choice that lacks it.',
    source: 'PHB 2024 "Boon of Skill" (L9200)',
  },
  'boon-of-speed': {
    id: 'boon-of-speed',
    name: 'Boon of Speed',
    category: 'epic-boon',
    prerequisite: L19,
    abilityIncrease: boon(),
    mechanics: mech({}, { fixed: ['speed:+30'] }),
    effect:
      'Increase one ability score by 1 (maximum 30). Your Speed increases by 30 feet. As a Bonus Action you can take the Disengage action, which also ends the Grappled condition on you.',
    source: 'PHB 2024 "Boon of Speed" (L9212)',
  },
  'boon-of-spell-recall': {
    id: 'boon-of-spell-recall',
    name: 'Boon of Spell Recall',
    category: 'epic-boon',
    // "Spellcasting Feature" (NOT "or Pact Magic"): printed that way in the PHB.
    prerequisite: { minLevel: 19, spellcasting: 'spellcasting' },
    abilityIncrease: boon(INT_WIS_CHA),
    mechanics: mech(),
    effect:
      'Increase Intelligence, Wisdom or Charisma by 1 (maximum 30). When you cast a spell using a level 1 to 4 slot, roll 1d4; if the result equals the slot’s level, the slot is not expended.',
    source: 'PHB 2024 "Boon of Spell Recall" (L9226)',
  },
  'boon-of-the-night-spirit': {
    id: 'boon-of-the-night-spirit',
    name: 'Boon of the Night Spirit',
    category: 'epic-boon',
    prerequisite: L19,
    abilityIncrease: boon(),
    mechanics: mech(),
    effect:
      'Increase one ability score by 1 (maximum 30). In Dim Light or Darkness you can become Invisible as a Bonus Action (it ends right after you take an action, Bonus Action or Reaction), and you have Resistance to all damage except Psychic and Radiant.',
    source: 'PHB 2024 "Boon of the Night Spirit" (L9236)',
  },
  'boon-of-truesight': {
    id: 'boon-of-truesight',
    name: 'Boon of Truesight',
    category: 'epic-boon',
    prerequisite: L19,
    abilityIncrease: boon(),
    mechanics: mech({}, { fixed: ['sense:truesight-60'] }),
    effect: 'Increase one ability score by 1 (maximum 30). You have Truesight with a range of 60 feet.',
    source: 'PHB 2024 "Boon of Truesight" (L9246)',
  },
};

/** A catalog key. Derived from FEAT_CATALOG so the persisted shape cannot drift. */
export type FeatId = keyof typeof FEAT_CATALOG;

/** Look up a feat by id; undefined for an unknown id (never throws). */
export function getFeat(id: string): FeatData | undefined {
  return Object.hasOwn(FEAT_CATALOG, id) ? FEAT_CATALOG[id] : undefined;
}

/** All catalog feats as an array (insertion order). */
export function allFeats(): FeatData[] {
  return Object.values(FEAT_CATALOG);
}
