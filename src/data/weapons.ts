/**
 * D&D 5.5e (2024) weapon catalog — the PHB 2024 "Weapons" table.
 *
 * A flat, typed data module mirroring src/data/classes.ts / species.ts: one
 * exported record keyed by weapon id, plus the id/enum unions derived from the
 * data so a persisted InventoryItem.catalogId and the catalog cannot drift.
 *
 * SOURCING / RULES COMPLIANCE
 * ---------------------------
 * Every mechanical value (category, melee/ranged, damage dice + type,
 * properties, versatile dice, ranges, ammunition type, mastery, weight, cost)
 * is transcribed from the PHB 2024 "Weapons" table (Docs/PlayersHandbook.md
 * L9388-9430), with property/mastery definitions from L9300-9386. NO weapon is
 * invented and no value is guessed (rules-compliance rule 1). Each entry carries
 * the `// PHB 2024 …` citation below.
 *
 * OCR CORRECTIONS (verified against the PHB 2024 Weapons table, L9388-9430).
 * The source markdown is OCR-noisy; the following were corrected to the printed
 * values (the glyphs below are OCR artefacts, not real values):
 *   - damage dice: 'ld4'/'l d4' → '1d4', 'ld6'/'l d6' → '1d6', 'ld8'/'1 d8' →
 *     '1d8', 'ldlO'/'ldl0'/'1 dl 0'/'1d10' → '1d10', 'ldl2' → '1d12'.
 *   - weights: '316.' → 3 lb (Scimitar), '216.' → 2 lb (Longbow),
 *     '1/4 lb.' → 0.25 lb (Dart), Sling has NO listed weight → 0 (see note).
 *   - costs: 'l SP' → 1 SP (Club), 'SOGP' → 50 GP (Greatsword),
 *     '50GP' → 50 GP (Heavy Crossbow, Longbow), '500GP' → 500 GP (Musket).
 * Costs are normalised to GP (costGp) for later weight/encumbrance math:
 * 1 GP = 10 SP = 100 CP (PHB 2024 "Coins", L9247-9272). So 1 SP = 0.1 GP,
 * 2 SP = 0.2 GP, 5 SP = 0.5 GP, 5 CP = 0.05 GP.
 */

/** A weapon's proficiency category. PHB 2024 "Weapons": Simple or Martial. */
export type WeaponCategory = 'simple' | 'martial';

/** Melee or Ranged classification. PHB 2024 "Weapons": "Melee or Ranged". */
export type WeaponRange = 'melee' | 'ranged';

/** The three physical damage types a PHB weapon deals. */
export type DamageType = 'bludgeoning' | 'piercing' | 'slashing';

/**
 * Weapon properties. PHB 2024 "Properties" (L9300-9346). Each is a short,
 * paraphrased definition supplied for the content-tooltip resolver (surfaced in
 * a later stage); no long verbatim PHB prose is reproduced (rules-compliance
 * rule 5).
 */
export type WeaponProperty =
  | 'ammunition'
  | 'finesse'
  | 'heavy'
  | 'light'
  | 'loading'
  | 'range'
  | 'reach'
  | 'thrown'
  | 'two-handed'
  | 'versatile';

/**
 * Weapon mastery properties. PHB 2024 "Mastery Properties" (L9348-9386). Each
 * 2024 weapon has EXACTLY ONE mastery property, usable only by a character with
 * a feature (e.g. Weapon Mastery) that unlocks it.
 */
export type MasteryProperty =
  | 'cleave'
  | 'graze'
  | 'nick'
  | 'push'
  | 'sap'
  | 'slow'
  | 'topple'
  | 'vex';

/** A single weapon entry transcribed from the PHB 2024 Weapons table. */
export interface WeaponData {
  /** Kebab-case catalog id, e.g. 'longsword'. */
  id: string;
  /** Name as printed in the PHB. */
  name: string;
  /** Simple or Martial. */
  category: WeaponCategory;
  /** Melee or Ranged. */
  range: WeaponRange;
  /** Damage dice, e.g. '1d8', '2d6', or '1' (Blowgun). */
  damageDice: string;
  /** Damage type. */
  damageType: DamageType;
  /** Properties this weapon has unconditionally (may be empty). */
  properties: WeaponProperty[];
  /**
   * Properties that apply only under a stated condition, so downstream logic
   * (A3 tooltips, A5 combat) can apply the PHB rule rather than reading a prose
   * comment. The only 2024 case is the Lance's Two-Handed "unless mounted"
   * exception (PHB 2024 Weapons table, L9412): when `mounted` is true the
   * weapon does NOT require two hands. `property` is still listed in
   * `properties` (it is the default state); `unlessCondition` names when it is
   * suspended. Absent on every other weapon.
   */
  conditionalProperties?: Array<{
    property: WeaponProperty;
    /** The condition that SUSPENDS the property (e.g. 'mounted' suspends two-handed). */
    unlessCondition: 'mounted';
  }>;
  /** Two-handed damage dice when `properties` includes 'versatile'. */
  versatileDice?: string;
  /** Normal range in feet (present for Thrown / Ammunition weapons). */
  normalRange?: number;
  /** Long range in feet (present for Thrown / Ammunition weapons). */
  longRange?: number;
  /** Ammunition type for the Ammunition property, e.g. 'Arrow' | 'Bolt'. */
  ammunitionType?: 'Arrow' | 'Bolt' | 'Bullet' | 'Needle';
  /** The single mastery property (one per 2024 weapon). */
  mastery: MasteryProperty;
  /** Weight in pounds; 0 where the PHB lists no weight (Sling). */
  weightLb: number;
  /** Cost normalised to gold pieces. */
  costGp: number;
  /**
   * Per-entry PHB 2024 citation (rules-compliance rule 7 / blueprint §2.2, §7.5):
   * the exact table + markdown line the row was transcribed from, so each
   * hand-authored value is individually traceable to its source.
   */
  source: string;
}

/** The PHB 2024 Weapons table citation shared by every weapon row (L9388-9430). */
const WEAPONS_TABLE_SOURCE = 'PHB 2024 "Weapons" table (Docs/PlayersHandbook.md L9388-9430)';

/**
 * Short, paraphrased definitions of each weapon property for the content
 * tooltip. PHB 2024 "Properties" (L9300-9346). Paraphrased, not verbatim.
 */
export const WEAPON_PROPERTY_TEXT: Record<WeaponProperty, string> = {
  // PHB 2024 "Ammunition" (L9304): needs ammunition of the listed type; each
  // attack expends one piece; drawing it is part of the attack; after a fight
  // you can spend 1 minute to recover half (round down) the ammunition fired.
  ammunition:
    'You can make a ranged attack only if you have ammunition of the listed type; each attack expends one piece (drawing it is part of the attack). After a fight, 1 minute recovers half the ammunition fired (round down).',
  // PHB 2024 "Finesse" (L9312): choose Str or Dex, and use the SAME modifier
  // for both the attack and damage rolls.
  finesse:
    'Use your choice of your Strength or Dexterity modifier for both the attack and damage rolls (you must use the same modifier for both).',
  // PHB 2024 "Heavy" (L9316): Disadvantage if melee Str < 13, or ranged Dex < 13.
  heavy:
    'You have Disadvantage on attack rolls with it if it is Melee and your Strength is under 13, or Ranged and your Dexterity is under 13.',
  // PHB 2024 "Light" (L9320): the Bonus-Action extra attack must use a DIFFERENT
  // Light weapon and adds no ability modifier to its damage unless negative.
  light:
    'On your Attack action, you may make one extra attack as a Bonus Action with a different Light weapon; you add no ability modifier to that extra attack\u2019s damage unless the modifier is negative.',
  // PHB 2024 "Loading" (L9328): one piece per action/Bonus Action/Reaction,
  // regardless of how many attacks you could otherwise make.
  loading:
    'You can fire only one piece of ammunition when you use an action, Bonus Action, or Reaction to fire it, no matter how many attacks you can normally make.',
  // PHB 2024 "Range" (L9332): normal/long range; past normal = Disadvantage;
  // past long = cannot attack.
  range:
    'Lists a normal and a long range in feet; attacking beyond normal range is at Disadvantage, and you cannot attack beyond the long range.',
  // PHB 2024 "Reach" (L9336): +5 ft reach for attacks and Opportunity Attacks.
  reach: 'Adds 5 feet to your reach when you attack with it and when determining your reach for Opportunity Attacks with it.',
  // PHB 2024 "Thrown" (L9340): throw to make a ranged attack, drawing it as part
  // of the attack; a Melee weapon uses its melee ability modifier when thrown.
  thrown:
    'You can throw it to make a ranged attack, drawing it as part of the attack; a Melee weapon uses the same ability modifier you would use for a melee attack with it.',
  // PHB 2024 "Two-Handed" (L9344): requires two hands to attack with it.
  'two-handed': 'Requires two hands when you attack with it.',
  // PHB 2024 "Versatile" (L9346-9348): one or two hands; the parenthesised dice
  // are the two-handed melee damage.
  versatile: 'Can be used with one or two hands; the damage in parentheses applies when you use two hands to make a melee attack.',
};

/**
 * Short, paraphrased definitions of each mastery property for the content
 * tooltip. PHB 2024 "Mastery Properties" (L9348-9386). Paraphrased, not
 * verbatim. A mastery is usable only via a feature that unlocks it.
 */
export const WEAPON_MASTERY_TEXT: Record<MasteryProperty, string> = {
  // PHB 2024 "Cleave" (L9360): second target must be within 5 ft of the first
  // AND within your reach; no ability modifier to that damage unless negative;
  // once per turn.
  cleave:
    'On a hit with a melee attack, make one melee attack against a second creature within 5 feet of the first and within your reach; add no ability modifier to that damage unless it is negative. Once per turn. Usable only if a feature (such as Weapon Mastery) unlocks it.',
  // PHB 2024 "Graze" (L9364): same damage type as the weapon, increasable only
  // by raising the ability modifier.
  graze:
    'On a miss, deal damage equal to the ability modifier used for the attack; it is the weapon\u2019s damage type and can be increased only by increasing that modifier. Usable only if a feature (such as Weapon Mastery) unlocks it.',
  // PHB 2024 "Nick" (L9368): make the Light extra attack as part of the Attack
  // action instead of a Bonus Action; once per turn.
  nick: 'You can make the Light property\u2019s extra attack as part of the Attack action instead of as a Bonus Action. Once per turn. Usable only if a feature (such as Weapon Mastery) unlocks it.',
  // PHB 2024 "Push" (L9372): Large or smaller, up to 10 ft straight away.
  push: 'On a hit, you can push the creature up to 10 feet straight away from you if it is Large or smaller. Usable only if a feature (such as Weapon Mastery) unlocks it.',
  // PHB 2024 "Sap" (L9376): Disadvantage on its next attack roll before your
  // next turn.
  sap: 'On a hit, the target has Disadvantage on its next attack roll before the start of your next turn. Usable only if a feature (such as Weapon Mastery) unlocks it.',
  // PHB 2024 "Slow" (L9380): -10 ft Speed until your next turn; the reduction
  // from multiple Slow hits does not exceed 10 ft.
  slow: 'On a hit that deals damage, reduce the target\u2019s Speed by 10 feet until the start of your next turn; stacking Slow hits never reduce Speed by more than 10 feet. Usable only if a feature (such as Weapon Mastery) unlocks it.',
  // PHB 2024 "Topple" (L9384): Constitution save, DC 8 + the attack ability
  // modifier + your Proficiency Bonus; on a fail the target is Prone.
  topple:
    'On a hit, force a Constitution saving throw (DC 8 + the ability modifier used for the attack + your Proficiency Bonus); on a failure the target has the Prone condition. Usable only if a feature (such as Weapon Mastery) unlocks it.',
  // PHB 2024 "Vex" (L9382-9385): Advantage on your next attack roll against that
  // creature before the end of your next turn.
  vex: 'On a hit that deals damage, you have Advantage on your next attack roll against that creature before the end of your next turn. Usable only if a feature (such as Weapon Mastery) unlocks it.',
};

// PHB 2024 "Weapons" table (L9388-9430); properties/mastery from L9300-9386.
// Declaration order mirrors the printed table: Simple Melee, Simple Ranged,
// Martial Melee, Martial Ranged.
export const WEAPON_CATALOG: Record<string, WeaponData> = {
  // ── Simple Melee Weapons ──────────────────────────────────────────────────
  club: {
    id: 'club',
    name: 'Club',
    category: 'simple',
    range: 'melee',
    damageDice: '1d4',
    damageType: 'bludgeoning',
    properties: ['light'],
    mastery: 'slow',
    weightLb: 2,
    costGp: 0.1, // 1 SP
    source: WEAPONS_TABLE_SOURCE,
  },
  dagger: {
    id: 'dagger',
    name: 'Dagger',
    category: 'simple',
    range: 'melee',
    damageDice: '1d4',
    damageType: 'piercing',
    properties: ['finesse', 'light', 'thrown'],
    normalRange: 20,
    longRange: 60,
    mastery: 'nick',
    weightLb: 1,
    costGp: 2,
    source: WEAPONS_TABLE_SOURCE,
  },
  greatclub: {
    id: 'greatclub',
    name: 'Greatclub',
    category: 'simple',
    range: 'melee',
    damageDice: '1d8',
    damageType: 'bludgeoning',
    properties: ['two-handed'],
    mastery: 'push',
    weightLb: 10,
    costGp: 0.2, // 2 SP
    source: WEAPONS_TABLE_SOURCE,
  },
  handaxe: {
    id: 'handaxe',
    name: 'Handaxe',
    category: 'simple',
    range: 'melee',
    damageDice: '1d6',
    damageType: 'slashing',
    properties: ['light', 'thrown'],
    normalRange: 20,
    longRange: 60,
    mastery: 'vex',
    weightLb: 2,
    costGp: 5,
    source: WEAPONS_TABLE_SOURCE,
  },
  javelin: {
    id: 'javelin',
    name: 'Javelin',
    category: 'simple',
    range: 'melee',
    damageDice: '1d6',
    damageType: 'piercing',
    properties: ['thrown'],
    normalRange: 30,
    longRange: 120,
    mastery: 'slow',
    weightLb: 2,
    costGp: 0.5, // 5 SP
    source: WEAPONS_TABLE_SOURCE,
  },
  'light-hammer': {
    id: 'light-hammer',
    name: 'Light Hammer',
    category: 'simple',
    range: 'melee',
    damageDice: '1d4',
    damageType: 'bludgeoning',
    properties: ['light', 'thrown'],
    normalRange: 20,
    longRange: 60,
    mastery: 'nick',
    weightLb: 2,
    costGp: 2,
    source: WEAPONS_TABLE_SOURCE,
  },
  mace: {
    id: 'mace',
    name: 'Mace',
    category: 'simple',
    range: 'melee',
    damageDice: '1d6',
    damageType: 'bludgeoning',
    properties: [],
    mastery: 'sap',
    weightLb: 4,
    costGp: 5,
    source: WEAPONS_TABLE_SOURCE,
  },
  quarterstaff: {
    id: 'quarterstaff',
    name: 'Quarterstaff',
    category: 'simple',
    range: 'melee',
    damageDice: '1d6',
    damageType: 'bludgeoning',
    properties: ['versatile'],
    versatileDice: '1d8',
    mastery: 'topple',
    weightLb: 4,
    costGp: 0.2, // 2 SP
    source: WEAPONS_TABLE_SOURCE,
  },
  sickle: {
    id: 'sickle',
    name: 'Sickle',
    category: 'simple',
    range: 'melee',
    damageDice: '1d4',
    damageType: 'slashing',
    properties: ['light'],
    mastery: 'nick',
    weightLb: 2,
    costGp: 1,
    source: WEAPONS_TABLE_SOURCE,
  },
  spear: {
    id: 'spear',
    name: 'Spear',
    category: 'simple',
    range: 'melee',
    damageDice: '1d6',
    damageType: 'piercing',
    properties: ['thrown', 'versatile'],
    versatileDice: '1d8',
    normalRange: 20,
    longRange: 60,
    mastery: 'sap',
    weightLb: 3,
    costGp: 1,
    source: WEAPONS_TABLE_SOURCE,
  },
  // ── Simple Ranged Weapons ─────────────────────────────────────────────────
  dart: {
    id: 'dart',
    name: 'Dart',
    category: 'simple',
    range: 'ranged',
    damageDice: '1d4',
    damageType: 'piercing',
    properties: ['finesse', 'thrown'],
    normalRange: 20,
    longRange: 60,
    mastery: 'vex',
    weightLb: 0.25, // PHB: 1/4 lb.
    costGp: 0.05, // 5 CP
    source: WEAPONS_TABLE_SOURCE,
  },
  'light-crossbow': {
    id: 'light-crossbow',
    name: 'Light Crossbow',
    category: 'simple',
    range: 'ranged',
    damageDice: '1d8',
    damageType: 'piercing',
    properties: ['ammunition', 'loading', 'two-handed'],
    normalRange: 80,
    longRange: 320,
    ammunitionType: 'Bolt',
    mastery: 'slow',
    weightLb: 5,
    costGp: 25,
    source: WEAPONS_TABLE_SOURCE,
  },
  shortbow: {
    id: 'shortbow',
    name: 'Shortbow',
    category: 'simple',
    range: 'ranged',
    damageDice: '1d6',
    damageType: 'piercing',
    properties: ['ammunition', 'two-handed'],
    normalRange: 80,
    longRange: 320,
    ammunitionType: 'Arrow',
    mastery: 'vex',
    weightLb: 2,
    costGp: 25,
    source: WEAPONS_TABLE_SOURCE,
  },
  sling: {
    id: 'sling',
    name: 'Sling',
    category: 'simple',
    range: 'ranged',
    damageDice: '1d4',
    damageType: 'bludgeoning',
    properties: ['ammunition'],
    normalRange: 30,
    longRange: 120,
    ammunitionType: 'Bullet',
    mastery: 'slow',
    weightLb: 0, // PHB lists no weight for the Sling.
    costGp: 0.1, // 1 SP
    source: WEAPONS_TABLE_SOURCE,
  },
  // ── Martial Melee Weapons ─────────────────────────────────────────────────
  battleaxe: {
    id: 'battleaxe',
    name: 'Battleaxe',
    category: 'martial',
    range: 'melee',
    damageDice: '1d8',
    damageType: 'slashing',
    properties: ['versatile'],
    versatileDice: '1d10',
    mastery: 'topple',
    weightLb: 4,
    costGp: 10,
    source: WEAPONS_TABLE_SOURCE,
  },
  flail: {
    id: 'flail',
    name: 'Flail',
    category: 'martial',
    range: 'melee',
    damageDice: '1d8',
    damageType: 'bludgeoning',
    properties: [],
    mastery: 'sap',
    weightLb: 2,
    costGp: 10,
    source: WEAPONS_TABLE_SOURCE,
  },
  glaive: {
    id: 'glaive',
    name: 'Glaive',
    category: 'martial',
    range: 'melee',
    damageDice: '1d10',
    damageType: 'slashing',
    properties: ['heavy', 'reach', 'two-handed'],
    mastery: 'graze',
    weightLb: 6,
    costGp: 20,
    source: WEAPONS_TABLE_SOURCE,
  },
  greataxe: {
    id: 'greataxe',
    name: 'Greataxe',
    category: 'martial',
    range: 'melee',
    damageDice: '1d12',
    damageType: 'slashing',
    properties: ['heavy', 'two-handed'],
    mastery: 'cleave',
    weightLb: 7,
    costGp: 30,
    source: WEAPONS_TABLE_SOURCE,
  },
  greatsword: {
    id: 'greatsword',
    name: 'Greatsword',
    category: 'martial',
    range: 'melee',
    damageDice: '2d6',
    damageType: 'slashing',
    properties: ['heavy', 'two-handed'],
    mastery: 'graze',
    weightLb: 6,
    costGp: 50, // OCR 'SOGP' → 50 GP
    source: WEAPONS_TABLE_SOURCE,
  },
  halberd: {
    id: 'halberd',
    name: 'Halberd',
    category: 'martial',
    range: 'melee',
    damageDice: '1d10',
    damageType: 'slashing',
    properties: ['heavy', 'reach', 'two-handed'],
    mastery: 'cleave',
    weightLb: 6,
    costGp: 20,
    source: WEAPONS_TABLE_SOURCE,
  },
  lance: {
    id: 'lance',
    name: 'Lance',
    category: 'martial',
    range: 'melee',
    damageDice: '1d10',
    damageType: 'piercing',
    // PHB 2024 Weapons table (L9412): "Heavy, Reach, Two-Handed (unless
    // mounted)". Two-Handed is the default state (so it is listed in
    // `properties`); the mounted exception is encoded machine-readably in
    // `conditionalProperties` so A3 tooltips and A5 combat suspend Two-Handed
    // while mounted rather than relying on a prose comment.
    properties: ['heavy', 'reach', 'two-handed'],
    conditionalProperties: [{ property: 'two-handed', unlessCondition: 'mounted' }],
    mastery: 'topple',
    weightLb: 6,
    costGp: 10,
    source: WEAPONS_TABLE_SOURCE,
  },
  longsword: {
    id: 'longsword',
    name: 'Longsword',
    category: 'martial',
    range: 'melee',
    damageDice: '1d8',
    damageType: 'slashing',
    properties: ['versatile'],
    versatileDice: '1d10',
    mastery: 'sap',
    weightLb: 3,
    costGp: 15,
    source: WEAPONS_TABLE_SOURCE,
  },
  maul: {
    id: 'maul',
    name: 'Maul',
    category: 'martial',
    range: 'melee',
    damageDice: '2d6',
    damageType: 'bludgeoning',
    properties: ['heavy', 'two-handed'],
    mastery: 'topple',
    weightLb: 10,
    costGp: 10,
    source: WEAPONS_TABLE_SOURCE,
  },
  morningstar: {
    id: 'morningstar',
    name: 'Morningstar',
    category: 'martial',
    range: 'melee',
    damageDice: '1d8',
    damageType: 'piercing',
    properties: [],
    mastery: 'sap',
    weightLb: 4,
    costGp: 15,
    source: WEAPONS_TABLE_SOURCE,
  },
  pike: {
    id: 'pike',
    name: 'Pike',
    category: 'martial',
    range: 'melee',
    damageDice: '1d10',
    damageType: 'piercing',
    properties: ['heavy', 'reach', 'two-handed'],
    mastery: 'push',
    weightLb: 18,
    costGp: 5,
    source: WEAPONS_TABLE_SOURCE,
  },
  rapier: {
    id: 'rapier',
    name: 'Rapier',
    category: 'martial',
    range: 'melee',
    damageDice: '1d8',
    damageType: 'piercing',
    properties: ['finesse'],
    mastery: 'vex',
    weightLb: 2,
    costGp: 25,
    source: WEAPONS_TABLE_SOURCE,
  },
  scimitar: {
    id: 'scimitar',
    name: 'Scimitar',
    category: 'martial',
    range: 'melee',
    damageDice: '1d6',
    damageType: 'slashing',
    properties: ['finesse', 'light'],
    mastery: 'nick',
    weightLb: 3, // OCR '316.' → 3 lb.
    costGp: 25,
    source: WEAPONS_TABLE_SOURCE,
  },
  shortsword: {
    id: 'shortsword',
    name: 'Shortsword',
    category: 'martial',
    range: 'melee',
    damageDice: '1d6',
    damageType: 'piercing',
    properties: ['finesse', 'light'],
    mastery: 'vex',
    weightLb: 2,
    costGp: 10,
    source: WEAPONS_TABLE_SOURCE,
  },
  trident: {
    id: 'trident',
    name: 'Trident',
    category: 'martial',
    range: 'melee',
    damageDice: '1d8',
    damageType: 'piercing',
    properties: ['thrown', 'versatile'],
    versatileDice: '1d10',
    normalRange: 20,
    longRange: 60,
    mastery: 'topple',
    weightLb: 4,
    costGp: 5,
    source: WEAPONS_TABLE_SOURCE,
  },
  warhammer: {
    id: 'warhammer',
    name: 'Warhammer',
    category: 'martial',
    range: 'melee',
    damageDice: '1d8',
    damageType: 'bludgeoning',
    properties: ['versatile'],
    versatileDice: '1d10',
    mastery: 'push',
    weightLb: 5,
    costGp: 15,
    source: WEAPONS_TABLE_SOURCE,
  },
  'war-pick': {
    id: 'war-pick',
    name: 'War Pick',
    category: 'martial',
    range: 'melee',
    damageDice: '1d8',
    damageType: 'piercing',
    properties: ['versatile'],
    versatileDice: '1d10',
    mastery: 'sap',
    weightLb: 2,
    costGp: 5,
    source: WEAPONS_TABLE_SOURCE,
  },
  whip: {
    id: 'whip',
    name: 'Whip',
    category: 'martial',
    range: 'melee',
    damageDice: '1d4',
    damageType: 'slashing',
    properties: ['finesse', 'reach'],
    mastery: 'slow',
    weightLb: 3,
    costGp: 2,
    source: WEAPONS_TABLE_SOURCE,
  },
  // ── Martial Ranged Weapons ────────────────────────────────────────────────
  blowgun: {
    id: 'blowgun',
    name: 'Blowgun',
    category: 'martial',
    range: 'ranged',
    damageDice: '1', // PHB: flat 1 Piercing (no dice).
    damageType: 'piercing',
    properties: ['ammunition', 'loading'],
    normalRange: 25,
    longRange: 100,
    ammunitionType: 'Needle',
    mastery: 'vex',
    weightLb: 1,
    costGp: 10,
    source: WEAPONS_TABLE_SOURCE,
  },
  'hand-crossbow': {
    id: 'hand-crossbow',
    name: 'Hand Crossbow',
    category: 'martial',
    range: 'ranged',
    damageDice: '1d6',
    damageType: 'piercing',
    properties: ['ammunition', 'light', 'loading'],
    normalRange: 30,
    longRange: 120,
    ammunitionType: 'Bolt',
    mastery: 'vex',
    weightLb: 3,
    costGp: 75,
    source: WEAPONS_TABLE_SOURCE,
  },
  'heavy-crossbow': {
    id: 'heavy-crossbow',
    name: 'Heavy Crossbow',
    category: 'martial',
    range: 'ranged',
    damageDice: '1d10',
    damageType: 'piercing',
    properties: ['ammunition', 'heavy', 'loading', 'two-handed'],
    normalRange: 100,
    longRange: 400,
    ammunitionType: 'Bolt',
    mastery: 'push',
    weightLb: 18,
    costGp: 50, // OCR '50GP' → 50 GP
    source: WEAPONS_TABLE_SOURCE,
  },
  longbow: {
    id: 'longbow',
    name: 'Longbow',
    category: 'martial',
    range: 'ranged',
    damageDice: '1d8',
    damageType: 'piercing',
    properties: ['ammunition', 'heavy', 'two-handed'],
    normalRange: 150,
    longRange: 600,
    ammunitionType: 'Arrow',
    mastery: 'slow',
    weightLb: 2, // OCR '216.' → 2 lb.
    costGp: 50, // OCR '50GP' → 50 GP
    source: WEAPONS_TABLE_SOURCE,
  },
  musket: {
    id: 'musket',
    name: 'Musket',
    category: 'martial',
    range: 'ranged',
    damageDice: '1d12',
    damageType: 'piercing',
    properties: ['ammunition', 'loading', 'two-handed'],
    normalRange: 40,
    longRange: 120,
    ammunitionType: 'Bullet',
    mastery: 'slow',
    weightLb: 10,
    costGp: 500, // OCR '500GP' → 500 GP
    source: WEAPONS_TABLE_SOURCE,
  },
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    category: 'martial',
    range: 'ranged',
    damageDice: '1d10',
    damageType: 'piercing',
    properties: ['ammunition', 'loading'],
    normalRange: 30,
    longRange: 90,
    ammunitionType: 'Bullet',
    mastery: 'vex',
    weightLb: 3,
    costGp: 250,
    source: WEAPONS_TABLE_SOURCE,
  },
};

/** All weapons as a flat array, in declaration (table) order. */
export const WEAPON_LIST: WeaponData[] = Object.values(WEAPON_CATALOG);

/** A catalog key for a known weapon. */
export type WeaponId = keyof typeof WEAPON_CATALOG;

/** Look up a weapon by id (undefined if unknown). */
export function getWeapon(id: string): WeaponData | undefined {
  return Object.prototype.hasOwnProperty.call(WEAPON_CATALOG, id)
    ? WEAPON_CATALOG[id]
    : undefined;
}
