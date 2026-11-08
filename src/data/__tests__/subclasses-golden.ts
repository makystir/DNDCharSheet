/**
 * GOLDEN FIXTURE for the PHB 2024 subclass feature catalog (Stage 2 of the
 * level-up gap work).
 *
 * Authored ONLY from the PHB 2024 (Docs/PlayersHandbook.md, the "<CLASS>
 * SUBCLASSES" section at the end of each class chapter). It is independent of
 * src/data/classes.ts: only TYPES may be imported from the app (never values),
 * so a drift in the catalog fails the oracle instead of silently updating this
 * file.
 *
 * LINE NUMBERS are 1-based lines of the feature's `LEVEL n: NAME` heading (or
 * of the spell table for granted spell lists) as counted by PowerShell
 * `Get-Content` (the grep tool can differ by about 1 in places).
 *
 * CARDINALITY is pinned twice: `featureCount` per subclass, and the exact
 * (name, level) list in `features`. Granted spells, proficiencies, choices
 * and uses carry their own exact counts.
 *
 * STRUCTURE: one exported array per class group (BARBARIAN_BARD_CLERIC_DRUID_
 * GOLDEN here); later steps add further arrays (Fighter..Paladin, ...) and
 * extend the concatenation SUBCLASS_GOLDEN at the bottom of the file.
 *
 * FLAGS (PHB text unclear / OCR-damaged), each repeated at the data site:
 *  - Berserker Frenzy (L2561) and Circle of the Sea Wrath of the Sea (L3999):
 *    the OCR prints the die as "das" ("roll a number of d?s equal to ...").
 *    The die size is NOT recorded; only the count source is.
 *  - Circle of the Land "Arid Land" table (L3865) is OCR-scrambled
 *    ("3 Blur, 5 | Burning Hands, Fire Bolt Fireball | 7 Blight | 9 Wall of
 *    Stone"). Read as 3: Blur, Burning Hands, Fire Bolt; 5: Fireball;
 *    7: Blight; 9: Wall of Stone (the level-3 grouping is the only reading
 *    that is consistent with the other three land tables, which each list 3
 *    spells at level 3 and one each at 5, 7, 9).
 *  - Life Domain / Light Domain (L3436-L3442): the OCR interleaves the Light
 *    Domain heading into Life Domain's Blessed Healer text. Blessed Healer
 *    (L6) and Supreme Healing (L17) are attributed to Life Domain, as the
 *    prose ("healing spells you cast on others heal you as well") dictates.
 */
import type { Ability } from '../../types/character';

export type GoldenSubclassClass = 'barbarian' | 'bard' | 'cleric' | 'druid' | 'fighter' | 'monk' | 'paladin' | 'ranger' | 'rogue' | 'sorcerer' | 'warlock' | 'wizard';

export type GoldenRecharge =
  | 'short-rest'
  | 'long-rest'
  | 'short-or-long-rest'
  | 'per-rage'
  | 'other';

export interface GoldenUses {
  /** A fixed number, or the ability whose modifier gives the count (min 1). */
  count: number | { abilityMod: Ability; min: 1 } | 'wild-shape' | 'channel-divinity' | 'bardic-inspiration';
  /** Whether each use is a spent use of another resource ('wild-shape' etc.) rather than its own pool. */
  recharge: GoldenRecharge;
  /** Extra way to restore the use, if the PHB gives one. */
  alsoRestoredBy?: string;
}

export interface GoldenDice {
  /** Dice expression, with a symbolic term where the count scales ('RageDamage' etc.). */
  expr: string;
  /** What the roll is for. */
  label: string;
}

export interface GoldenSave {
  /** DC formula: 'spell-save-dc' or '8+Str+Prof' etc. */
  /** Fighter/Monk/Paladin/Ranger additions: '8+StrOrDex+Prof' (Battle Master, choice), '8+Int+Prof' (Psi Warrior), '8+Wis+Prof' (Monk Focus save DC, L4573). */
  /** Rogue additions: '8+Dex+Prof' (Assassin Death Strike L6104, Soulknife Rend Mind L6169). */
  dc: 'spell-save-dc' | '8+Str+Prof' | '8+StrOrDex+Prof' | '8+Int+Prof' | '8+Wis+Prof' | '8+Dex+Prof';
  save: Ability;
}

export type GoldenSpellMode =
  | 'always-prepared'
  | 'ritual-only'
  | 'chosen-always-prepared'
  | 'always-prepared-while-holding-item'
  /** A cantrip the subclass teaches (always known). */
  | 'known-cantrip'
  /** Castable by the subclass without expending a spell slot. */
  | 'cast-without-slot'
  /** Wizard-list spells the player chooses to prepare (Eldritch Knight). */
  | 'chosen-prepared';

export interface GoldenSpellGrant {
  /** Class level at which the spells are gained. */
  level: number;
  /** Exact PHB spell names. Empty when the player chooses (see `chosenCount`). */
  spells: string[];
  mode: GoldenSpellMode;
  /** For 'chosen-always-prepared': how many spells the player picks. */
  chosenCount?: number;
}

export interface GoldenProficiencies {
  skillChoices?: number;
  weapons?: string[];
  armor?: string[];
  /** Fixed skills granted. */
  skills?: string[];
  /** Fixed tools granted. */
  tools?: string[];
  /** Number of tool proficiencies of the player's choice (e.g. 1 Artisan's Tools). */
  toolChoices?: number;
  /** Saving throw proficiencies: fixed, or choice when the PHB lets the player pick among several. */
  savingThrows?: { fixed?: Ability[]; fallbackChoice?: Ability[] };
}

export interface GoldenChoice {
  key: string;
  count: number;
  options: string[];
  /** Total picks known by Fighter/Ranger level when the count grows (Battle Master maneuvers). */
  countByLevel?: Record<number, number>;
}

export interface GoldenFeature {
  name: string;
  level: number;
  /** PHB line of the heading / table. */
  line: number;
  uses?: GoldenUses;
  dice?: GoldenDice[];
  save?: GoldenSave;
  /** Spells granted by this feature, by class level. */
  grantedSpells?: GoldenSpellGrant[];
  proficiencies?: GoldenProficiencies;
  /** Sub-choices the player makes (Rage of the Wilds, constellations ...). */
  choices?: GoldenChoice[];
  /** True when the feature is used as a Reaction. */
  reaction?: true;
  /**
   * Structured mechanics facts the catalog must carry (each key is pinned to exactly this value;
   * the catalog may hold other keys). Used where the PHB states a rule no other golden field models.
   */
  mechanics?: Record<string, number | string>;
  /** Feature is spent via a Channel Divinity use. */
  channelDivinity?: true;
  /** Feat / Fighting Style grants. */
  featGrants?: { fightingStyleFeats: number };
  /** Subclass-given spellcasting (Eldritch Knight). */
  spellcasting?: GoldenSpellcasting;
}

export interface GoldenSpellcasting {
  ability: Ability;
  spellList: string;
  focus: string;
  /** Cantrips known: 2 at L3, +1 at L10 (3 total). */
  cantripsKnown: Record<number, number>;
  /** Prepared level 1+ spells by Fighter level. */
  preparedByLevel: Record<number, number>;
  /** Spell slots by class level: [L1, L2, L3, L4]. The L4 column (1 slot at L19-20) is from the printed table image supplied by the user; the OCR dropped it. */
  slotsByLevel: Record<number, [number, number, number, number]>;
}

export interface GoldenSubclass {
  /** Exact PHB name. */
  name: string;
  /** Catalog id (src/data/classes.ts). */
  id: string;
  class: GoldenSubclassClass;
  /** Exact number of features. */
  featureCount: number;
  features: GoldenFeature[];
  /** Circle of the Land only: the four land-type spell lists. */
  landSpells?: Record<'arid' | 'polar' | 'temperate' | 'tropical', GoldenSpellGrant[]> & { line: Record<string, number> };
}

const wisUses = (recharge: GoldenRecharge): GoldenUses => ({
  count: { abilityMod: 'wis', min: 1 },
  recharge,
});

// ═══════════════════════════ BARBARIAN (PHB L2551-2670) ═════════════════════
const BARBARIAN_GOLDEN: GoldenSubclass[] = [
  {
    name: 'Path of the Berserker',
    id: 'berserker',
    class: 'barbarian',
    featureCount: 4,
    features: [
      // FLAG: die size unreadable in OCR ("dás"); count = Rage Damage bonus.
      { name: 'Frenzy', level: 3, line: 2561 },
      { name: 'Mindless Rage', level: 6, line: 2565 },
      { name: 'Retaliation', level: 10, line: 2567, reaction: true },
      {
        name: 'Intimidating Presence',
        level: 14,
        line: 2571,
        save: { dc: '8+Str+Prof', save: 'wis' },
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend a use of Rage (no action)' },
      },
    ],
  },
  {
    name: 'Path of the Wild Heart',
    id: 'wildHeart',
    class: 'barbarian',
    featureCount: 5,
    features: [
      {
        name: 'Animal Speaker',
        level: 3,
        line: 2581,
        grantedSpells: [{ level: 3, spells: ['Beast Sense', 'Speak with Animals'], mode: 'ritual-only' }],
      },
      {
        name: 'Rage of the Wilds',
        level: 3,
        line: 2583,
        choices: [{ key: 'rage-of-the-wilds', count: 1, options: ['Bear', 'Eagle', 'Wolf'] }],
      },
      {
        name: 'Aspect of the Wilds',
        level: 6,
        line: 2593,
        choices: [{ key: 'aspect-of-the-wilds', count: 1, options: ['Owl', 'Panther', 'Salmon'] }],
      },
      {
        name: 'Nature Speaker',
        level: 10,
        line: 2601,
        grantedSpells: [{ level: 10, spells: ['Commune with Nature'], mode: 'ritual-only' }],
      },
      {
        name: 'Power of the Wilds',
        level: 14,
        line: 2605,
        choices: [{ key: 'power-of-the-wilds', count: 1, options: ['Falcon', 'Lion', 'Ram'] }],
      },
    ],
  },
  {
    name: 'Path of the World Tree',
    id: 'worldTree',
    class: 'barbarian',
    featureCount: 4,
    features: [
      {
        name: 'Vitality of the Tree',
        level: 3,
        line: 2623,
        dice: [{ expr: 'RageDamage d6', label: 'Life-Giving Force temporary hit points' }],
      },
      {
        name: 'Branches of the Tree',
        level: 6,
        line: 2629,
        reaction: true,
        save: { dc: '8+Str+Prof', save: 'str' },
      },
      { name: 'Battering Roots', level: 10, line: 2631 },
      { name: 'Travel Along the Tree', level: 14, line: 2635, uses: { count: 1, recharge: 'per-rage' } }, // 150 ft extended teleport (+6 creatures) once per Rage
    ],
  },
  {
    name: 'Path of the Zealot',
    id: 'zealot',
    class: 'barbarian',
    featureCount: 5,
    features: [
      {
        name: 'Divine Fury',
        level: 3,
        line: 2643,
        dice: [{ expr: '1d6 + floor(BarbarianLevel/2)', label: 'Necrotic or Radiant extra damage' }],
      },
      {
        name: 'Warrior of the Gods',
        level: 3,
        line: 2647,
        // Pool of d12s: 4 at level 3, 5 at 6, 6 at 12, 7 at 17.
        dice: [{ expr: '4d12 (5 at L6, 6 at L12, 7 at L17)', label: 'Bonus Action healing pool' }],
        uses: { count: 4, recharge: 'long-rest' },
      },
      { name: 'Fanatical Focus', level: 6, line: 2655, uses: { count: 1, recharge: 'per-rage' } },
      {
        name: 'Zealous Presence',
        level: 10,
        line: 2659,
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend a use of Rage (no action)' },
      },
      { name: 'Rage of the Gods', level: 14, line: 2665, uses: { count: 1, recharge: 'long-rest' } },
    ],
  },
];

// ═══════════════════════════ BARD (PHB L2977-3105) ══════════════════════════
const BARD_GOLDEN: GoldenSubclass[] = [
  {
    name: 'College of Dance',
    id: 'dance',
    class: 'bard',
    featureCount: 4,
    features: [
      { name: 'Dazzling Footwork', level: 3, line: 2987 },
      { name: 'Inspiring Movement', level: 6, line: 2999, reaction: true, uses: { count: 'bardic-inspiration', recharge: 'other' } },
      { name: 'Tandem Footwork', level: 6, line: 3005, uses: { count: 'bardic-inspiration', recharge: 'other' } },
      { name: 'Leading Evasion', level: 14, line: 3009 },
    ],
  },
  {
    name: 'College of Glamour',
    id: 'glamour',
    class: 'bard',
    featureCount: 4,
    features: [
      {
        name: 'Beguiling Magic',
        level: 3,
        line: 3021,
        grantedSpells: [{ level: 3, spells: ['Charm Person', 'Mirror Image'], mode: 'always-prepared' }],
        save: { dc: 'spell-save-dc', save: 'wis' },
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend one use of Bardic Inspiration (no action)' },
      },
      { name: 'Mantle of Inspiration', level: 3, line: 3029, uses: { count: 'bardic-inspiration', recharge: 'other' } },
      {
        name: 'Mantle of Majesty',
        level: 6,
        line: 3033,
        grantedSpells: [{ level: 6, spells: ['Command'], mode: 'always-prepared' }],
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend a level 3+ spell slot (no action)' },
      },
      {
        name: 'Unbreakable Majesty',
        level: 14,
        line: 3047,
        save: { dc: 'spell-save-dc', save: 'cha' },
        uses: { count: 1, recharge: 'short-or-long-rest' },
      },
    ],
  },
  {
    name: 'College of Lore',
    id: 'lore',
    class: 'bard',
    featureCount: 4,
    features: [
      { name: 'Bonus Proficiencies', level: 3, line: 3057, proficiencies: { skillChoices: 3 } },
      { name: 'Cutting Words', level: 3, line: 3061, reaction: true, uses: { count: 'bardic-inspiration', recharge: 'other' } },
      {
        name: 'Magical Discoveries',
        level: 6,
        line: 3065,
        // Two spells of the player's choice from the Cleric, Druid or Wizard lists.
        grantedSpells: [{ level: 6, spells: [], mode: 'chosen-always-prepared', chosenCount: 2 }],
      },
      { name: 'Peerless Skill', level: 14, line: 3071, uses: { count: 'bardic-inspiration', recharge: 'other' } },
    ],
  },
  {
    name: 'College of Valor',
    id: 'valor',
    class: 'bard',
    featureCount: 4,
    features: [
      { name: 'Combat Inspiration', level: 3, line: 3081 },
      {
        name: 'Martial Training',
        level: 3,
        line: 3089,
        proficiencies: { weapons: ['Martial weapons'], armor: ['Medium armor', 'Shields'] },
      },
      { name: 'Extra Attack', level: 6, line: 3095 },
      { name: 'Battle Magic', level: 14, line: 3101 },
    ],
  },
];

// ═══════════════════════════ CLERIC (PHB L3407-3570) ════════════════════════
// Domain spell tables: the same four levels (3, 5, 7, 9) for every domain.
const CLERIC_GOLDEN: GoldenSubclass[] = [
  {
    name: 'Life Domain',
    id: 'life',
    class: 'cleric',
    featureCount: 5,
    features: [
      { name: 'Disciple of Life', level: 3, line: 3415 },
      {
        name: 'Life Domain Spells',
        level: 3,
        line: 3419, // table at L3423
        grantedSpells: [
          { level: 3, spells: ['Aid', 'Bless', 'Cure Wounds', 'Lesser Restoration'], mode: 'always-prepared' },
          { level: 5, spells: ['Mass Healing Word', 'Revivify'], mode: 'always-prepared' },
          { level: 7, spells: ['Aura of Life', 'Death Ward'], mode: 'always-prepared' },
          { level: 9, spells: ['Greater Restoration', 'Mass Cure Wounds'], mode: 'always-prepared' },
        ],
      },
      {
        name: 'Preserve Life',
        level: 3,
        line: 3432,
        channelDivinity: true,
        uses: { count: 'channel-divinity', recharge: 'other' },
      },
      // FLAG: Light Domain heading is interleaved in the OCR here (see header).
      { name: 'Blessed Healer', level: 6, line: 3436 },
      { name: 'Supreme Healing', level: 17, line: 3442 },
    ],
  },
  {
    name: 'Light Domain',
    id: 'light',
    class: 'cleric',
    featureCount: 5,
    features: [
      {
        name: 'Light Domain Spells',
        level: 3,
        line: 3454, // table at L3458
        grantedSpells: [
          { level: 3, spells: ['Burning Hands', 'Faerie Fire', 'Scorching Ray', 'See Invisibility'], mode: 'always-prepared' },
          { level: 5, spells: ['Daylight', 'Fireball'], mode: 'always-prepared' },
          { level: 7, spells: ['Arcane Eye', 'Wall of Fire'], mode: 'always-prepared' },
          { level: 9, spells: ['Flame Strike', 'Scrying'], mode: 'always-prepared' },
        ],
      },
      {
        name: 'Radiance of the Dawn',
        level: 3,
        line: 3467,
        channelDivinity: true,
        uses: { count: 'channel-divinity', recharge: 'other' },
        dice: [{ expr: '2d10 + ClericLevel', label: 'Radiant damage (half on a successful save)' }],
        save: { dc: 'spell-save-dc', save: 'con' },
      },
      { name: 'Warding Flare', level: 3, line: 3471, reaction: true, uses: wisUses('long-rest') },
      {
        name: 'Improved Warding Flare',
        level: 6,
        line: 3477,
        // Warding Flare uses now return on a Short or Long Rest.
        uses: wisUses('short-or-long-rest'),
        dice: [{ expr: '2d6 + WisMod', label: 'Temporary Hit Points for the triggering attack target' }],
      },
      { name: 'Corona of Light', level: 17, line: 3481, uses: wisUses('long-rest') },
    ],
  },
  {
    name: 'Trickery Domain',
    id: 'trickery',
    class: 'cleric',
    featureCount: 5,
    features: [
      { name: 'Blessing of the Trickster', level: 3, line: 3495 },
      {
        name: 'Invoke Duplicity',
        level: 3,
        line: 3499,
        channelDivinity: true,
        uses: { count: 'channel-divinity', recharge: 'other' },
      },
      {
        name: 'Trickery Domain Spells',
        level: 3,
        line: 3513, // table at L3515
        grantedSpells: [
          { level: 3, spells: ['Charm Person', 'Disguise Self', 'Invisibility', 'Pass without Trace'], mode: 'always-prepared' },
          { level: 5, spells: ['Hypnotic Pattern', 'Nondetection'], mode: 'always-prepared' },
          { level: 7, spells: ['Confusion', 'Dimension Door'], mode: 'always-prepared' },
          { level: 9, spells: ['Dominate Person', 'Modify Memory'], mode: 'always-prepared' },
        ],
      },
      { name: "Trickster's Transposition", level: 6, line: 3524 },
      { name: 'Improved Duplicity', level: 17, line: 3526 },
    ],
  },
  {
    name: 'War Domain',
    id: 'war',
    class: 'cleric',
    featureCount: 5,
    features: [
      {
        name: 'Guided Strike',
        level: 3,
        line: 3540,
        channelDivinity: true,
        uses: { count: 'channel-divinity', recharge: 'other' },
      },
      {
        name: 'War Domain Spells',
        level: 3,
        line: 3544, // table at L3548
        grantedSpells: [
          { level: 3, spells: ['Guiding Bolt', 'Magic Weapon', 'Shield of Faith', 'Spiritual Weapon'], mode: 'always-prepared' },
          { level: 5, spells: ["Crusader's Mantle", 'Spirit Guardians'], mode: 'always-prepared' },
          { level: 7, spells: ['Fire Shield', 'Freedom of Movement'], mode: 'always-prepared' },
          { level: 9, spells: ['Hold Monster', 'Steel Wind Strike'], mode: 'always-prepared' },
        ],
      },
      { name: 'War Priest', level: 3, line: 3557, uses: wisUses('short-or-long-rest') },
      {
        name: "War God's Blessing",
        level: 6,
        line: 3561,
        channelDivinity: true,
        uses: { count: 'channel-divinity', recharge: 'other' },
      },
      { name: 'Avatar of Battle', level: 17, line: 3565 },
    ],
  },
];

// ═══════════════════════════ DRUID (PHB L3846-4080) ═════════════════════════
const DRUID_GOLDEN: GoldenSubclass[] = [
  {
    name: 'Circle of the Land',
    id: 'land',
    class: 'druid',
    featureCount: 5,
    features: [
      {
        // The prepared list depends on the land type chosen after each Long Rest
        // (see `landSpells`); the spells listed for the Druid level and lower are prepared.
        name: 'Circle of the Land Spells',
        level: 3,
        line: 3860,
        choices: [{ key: 'land-type', count: 1, options: ['Arid', 'Polar', 'Temperate', 'Tropical'] }],
      },
      {
        name: "Land's Aid",
        level: 3,
        line: 3896,
        uses: { count: 'wild-shape', recharge: 'other' },
        // 2d6 at L3, 3d6 at L10, 4d6 at L14; healing is 2d6 (the PHB scales damage and healing together).
        dice: [{ expr: '2d6 (3d6 at L10, 4d6 at L14)', label: 'Necrotic damage; one creature regains the same dice in HP' }],
        save: { dc: 'spell-save-dc', save: 'con' },
      },
      {
        name: 'Natural Recovery',
        level: 6,
        line: 3902,
        uses: { count: 1, recharge: 'long-rest' },
      },
      { name: "Nature's Ward", level: 10, line: 3908 },
      { name: "Nature's Sanctuary", level: 14, line: 3923, uses: { count: 'wild-shape', recharge: 'other' } },
    ],
    landSpells: {
      line: { arid: 3865, polar: 3871, temperate: 3878, tropical: 3887 },
      // FLAG: Arid table is OCR-scrambled; reading documented in the file header.
      arid: [
        { level: 3, spells: ['Blur', 'Burning Hands', 'Fire Bolt'], mode: 'always-prepared' },
        { level: 5, spells: ['Fireball'], mode: 'always-prepared' },
        { level: 7, spells: ['Blight'], mode: 'always-prepared' },
        { level: 9, spells: ['Wall of Stone'], mode: 'always-prepared' },
      ],
      polar: [
        { level: 3, spells: ['Fog Cloud', 'Hold Person', 'Ray of Frost'], mode: 'always-prepared' },
        { level: 5, spells: ['Sleet Storm'], mode: 'always-prepared' },
        { level: 7, spells: ['Ice Storm'], mode: 'always-prepared' },
        { level: 9, spells: ['Cone of Cold'], mode: 'always-prepared' },
      ],
      temperate: [
        { level: 3, spells: ['Misty Step', 'Shocking Grasp', 'Sleep'], mode: 'always-prepared' },
        { level: 5, spells: ['Lightning Bolt'], mode: 'always-prepared' },
        { level: 7, spells: ['Freedom of Movement'], mode: 'always-prepared' },
        { level: 9, spells: ['Tree Stride'], mode: 'always-prepared' },
      ],
      tropical: [
        { level: 3, spells: ['Acid Splash', 'Ray of Sickness', 'Web'], mode: 'always-prepared' },
        { level: 5, spells: ['Stinking Cloud'], mode: 'always-prepared' },
        { level: 7, spells: ['Polymorph'], mode: 'always-prepared' },
        { level: 9, spells: ['Insect Plague'], mode: 'always-prepared' },
      ],
    },
  },
  {
    name: 'Circle of the Moon',
    id: 'moon',
    class: 'druid',
    featureCount: 5,
    features: [
      { name: 'Circle Forms', level: 3, line: 3937 },
      {
        name: 'Circle of the Moon Spells',
        level: 3,
        line: 3947, // table at L3951
        grantedSpells: [
          { level: 3, spells: ['Cure Wounds', 'Moonbeam', 'Starry Wisp'], mode: 'always-prepared' },
          { level: 5, spells: ['Conjure Animals'], mode: 'always-prepared' },
          { level: 7, spells: ['Fount of Moonlight'], mode: 'always-prepared' },
          { level: 9, spells: ['Mass Cure Wounds'], mode: 'always-prepared' },
        ],
      },
      { name: 'Improved Circle Forms', level: 6, line: 3962 },
      {
        name: 'Moonlight Step',
        level: 10,
        line: 3968,
        uses: { count: { abilityMod: 'wis', min: 1 }, recharge: 'long-rest', alsoRestoredBy: 'expend a level 2+ spell slot per use (no action)' },
      },
      {
        name: 'Lunar Form',
        level: 14,
        line: 3974,
        dice: [{ expr: '2d10', label: 'Extra Radiant damage, once per turn, Wild Shape attack' }],
      },
    ],
  },
  {
    name: 'Circle of the Sea',
    id: 'sea',
    class: 'druid',
    featureCount: 5,
    features: [
      {
        name: 'Circle of the Sea Spells',
        level: 3,
        line: 3988, // table at L3990
        grantedSpells: [
          { level: 3, spells: ['Fog Cloud', 'Gust of Wind', 'Ray of Frost', 'Shatter', 'Thunderwave'], mode: 'always-prepared' },
          { level: 5, spells: ['Lightning Bolt', 'Water Breathing'], mode: 'always-prepared' },
          { level: 7, spells: ['Control Water', 'Ice Storm'], mode: 'always-prepared' },
          { level: 9, spells: ['Conjure Elemental', 'Hold Monster'], mode: 'always-prepared' },
        ],
      },
      {
        // FLAG: die size unreadable in OCR ("dás"); count = Wisdom modifier (min 1 die).
        name: 'Wrath of the Sea',
        level: 3,
        line: 3999,
        uses: { count: 'wild-shape', recharge: 'other' },
        save: { dc: 'spell-save-dc', save: 'con' },
      },
      { name: 'Aquatic Affinity', level: 6, line: 4005 },
      { name: 'Stormborn', level: 10, line: 4011 },
      { name: 'Oceanic Gift', level: 14, line: 4019 },
    ],
  },
  {
    name: 'Circle of the Stars',
    id: 'stars',
    class: 'druid',
    featureCount: 5,
    features: [
      {
        name: 'Star Map',
        level: 3,
        line: 4031,
        grantedSpells: [{ level: 3, spells: ['Guidance', 'Guiding Bolt'], mode: 'always-prepared-while-holding-item' }],
        // Free casts of Guiding Bolt.
        uses: wisUses('long-rest'),
      },
      {
        name: 'Starry Form',
        level: 3,
        line: 4050,
        uses: { count: 'wild-shape', recharge: 'other' },
        dice: [
          { expr: '1d8 + WisMod (2d8 at L10)', label: 'Archer: Radiant ranged spell attack damage' },
          { expr: '1d8 + WisMod (2d8 at L10)', label: 'Chalice: Hit Points regained' },
        ],
        choices: [{ key: 'constellation', count: 1, options: ['Archer', 'Chalice', 'Dragon'] }],
      },
      {
        name: 'Cosmic Omen',
        level: 6,
        line: 4064,
        reaction: true,
        uses: wisUses('long-rest'),
        dice: [{ expr: '1d6', label: 'Added to (Weal) or subtracted from (Woe) a D20 Test' }],
        choices: [{ key: 'omen', count: 1, options: ['Weal (Even)', 'Woe (Odd)'] }],
      },
      { name: 'Twinkling Constellations', level: 10, line: 4074 },
      { name: 'Full of Stars', level: 14, line: 4078 },
    ],
  },
];

// ═══════════════════════════ FIGHTER (PHB L4219-4470) ═══════════════════════
const MANEUVER_OPTIONS = [
  'Ambush', 'Bait and Switch', "Commander's Strike", 'Commanding Presence', 'Disarming Attack',
  'Distracting Strike', 'Evasive Footwork', 'Feinting Attack', 'Goading Attack', 'Lunging Attack',
  'Maneuvering Attack', 'Menacing Attack', 'Parry', 'Precision Attack', 'Pushing Attack', 'Rally',
  'Riposte', 'Sweeping Attack', 'Tactical Assessment', 'Trip Attack',
]; // L4269-4309: exactly 20 options

const FIGHTER_GOLDEN: GoldenSubclass[] = [
  {
    name: 'Battle Master',
    id: 'battleMaster',
    class: 'fighter',
    featureCount: 6,
    features: [
      {
        name: 'Combat Superiority',
        level: 3,
        line: 4229,
        // 3 maneuvers at L3, +2 at Fighter levels 7, 10, 15 (L4235-4237) => 3/5/7/9.
        choices: [{ key: 'maneuvers', count: 3, options: MANEUVER_OPTIONS, countByLevel: { 3: 3, 7: 5, 10: 7, 15: 9 } }],
        // 4 Superiority Dice (d8), 5 at L7, 6 at L15 (L4239-4241); die grows via L10 / L18 features.
        dice: [{ expr: '4d8 Superiority Dice (5 at L7, 6 at L15)', label: 'Superiority Dice pool' }],
        uses: { count: 4, recharge: 'short-or-long-rest' },
        save: { dc: '8+StrOrDex+Prof', save: 'str' }, // L4243; save type depends on the maneuver (Str, Wis)
      },
      {
        name: 'Student of War',
        level: 3,
        line: 4247,
        // One Artisan's Tools of choice + one skill from the Fighter's level-1 skill list.
        proficiencies: { skillChoices: 1, toolChoices: 1 },
      },
      {
        name: 'Know Your Enemy',
        level: 7,
        line: 4251,
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend one Superiority Die (no action)' },
      },
      { name: 'Improved Combat Superiority', level: 10, line: 4257, dice: [{ expr: 'd10', label: 'Superiority Die size' }] },
      { name: 'Relentless', level: 15, line: 4259, dice: [{ expr: '1d8', label: 'Free maneuver die, once per turn' }] },
      { name: 'Ultimate Combat Superiority', level: 18, line: 4263, dice: [{ expr: 'd12', label: 'Superiority Die size' }] },
    ],
  },
  {
    name: 'Champion',
    id: 'champion',
    class: 'fighter',
    featureCount: 6,
    features: [
      { name: 'Improved Critical', level: 3, line: 4319 }, // crit on 19-20
      { name: 'Remarkable Athlete', level: 3, line: 4321 },
      // L4325: "You gain another Fighting Style feat of your choice."
      { name: 'Additional Fighting Style', level: 7, line: 4325, featGrants: { fightingStyleFeats: 1 } },
      { name: 'Heroic Warrior', level: 10, line: 4327 },
      { name: 'Superior Critical', level: 15, line: 4329 }, // crit on 18-20
      {
        name: 'Survivor',
        level: 18,
        line: 4331,
        dice: [{ expr: '5 + ConMod', label: 'Heroic Rally: HP regained at the start of each turn while Bloodied with at least 1 HP' }],
      },
    ],
  },
  {
    name: 'Eldritch Knight',
    id: 'eldritchKnight',
    class: 'fighter',
    featureCount: 6,
    features: [
      // FLAG: the PHB prints no "LEVEL 3: SPELLCASTING" heading for this feature; the spellcasting
      // text (L4345) and the "ELDRITCH KNIGHT SPELLCASTING" table (L4353) are unlabelled, so the
      // feature name "Spellcasting" and level 3 (the first table row) are inferred.
      // Level-3 slots read as 2 at L13, 3 at L16; the level-4 column (1 slot at L19-20) is missing
      // from the OCR and comes from the printed table image supplied by the user.
      {
        name: 'Spellcasting',
        level: 3,
        line: 4345,
        spellcasting: {
          ability: 'int',
          spellList: 'Wizard',
          focus: 'Arcane Focus',
          cantripsKnown: { 3: 2, 10: 3 },
          preparedByLevel: {
            3: 3, 4: 4, 5: 4, 6: 4, 7: 5, 8: 6, 9: 6, 10: 7, 11: 8, 12: 8, 13: 9, 14: 10, 15: 10,
            16: 11, 17: 11, 18: 11, 19: 12, 20: 13,
          },
          slotsByLevel: {
            3: [2, 0, 0, 0], 4: [3, 0, 0, 0], 5: [3, 0, 0, 0], 6: [3, 0, 0, 0],
            7: [4, 2, 0, 0], 8: [4, 2, 0, 0], 9: [4, 2, 0, 0],
            10: [4, 3, 0, 0], 11: [4, 3, 0, 0], 12: [4, 3, 0, 0],
            13: [4, 3, 2, 0], 14: [4, 3, 2, 0], 15: [4, 3, 2, 0],
            16: [4, 3, 3, 0], 17: [4, 3, 3, 0], 18: [4, 3, 3, 0], 19: [4, 3, 3, 1], 20: [4, 3, 3, 1],
          },
        },
      },
      { name: 'War Bond', level: 3, line: 4390 }, // up to two bonded weapons
      { name: 'War Magic', level: 7, line: 4398 },
      { name: 'Eldritch Strike', level: 10, line: 4402 },
      { name: 'Arcane Charge', level: 15, line: 4406 }, // 30 ft teleport with Action Surge
      { name: 'Improved War Magic', level: 18, line: 4410 },
    ],
  },
  {
    name: 'Psi Warrior',
    id: 'psiWarrior',
    class: 'fighter',
    featureCount: 5,
    features: [
      {
        name: 'Psionic Power',
        level: 3,
        line: 4420,
        // Energy Dice table L4426-4433: L3 4xD6, L5 6xD8, L9 8xD8, L11 8xD10, L13 10xD10, L17 12xD12.
        // Regain one die on a Short Rest, all on a Long Rest (L4437).
        uses: { count: 4, recharge: 'other' },
        dice: [
          { expr: 'Psionic Energy Dice: 4d6 (L3), 6d8 (L5), 8d8 (L9), 8d10 (L11), 10d10 (L13), 12d12 (L17)', label: 'Psionic Energy Dice pool' },
          { expr: '1 Psionic Die + IntMod (min 1)', label: 'Protective Field damage reduction (Reaction, 30 ft)' },
          { expr: '1 Psionic Die + IntMod', label: 'Psionic Strike Force damage (once per turn, 30 ft)' },
        ],
        reaction: true,
      },
      {
        name: 'Telekinetic Adept',
        level: 7,
        line: 4447,
        uses: { count: 1, recharge: 'short-or-long-rest', alsoRestoredBy: 'expend a Psionic Energy Die (no action)' },
        save: { dc: '8+Int+Prof', save: 'str' }, // Telekinetic Thrust
      },
      { name: 'Guarded Mind', level: 10, line: 4455 },
      {
        name: 'Bulwark of Force',
        level: 15,
        line: 4459,
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend a Psionic Energy Die (no action)' },
      },
      {
        name: 'Telekinetic Master',
        level: 18,
        line: 4465,
        grantedSpells: [{ level: 18, spells: ['Telekinesis'], mode: 'always-prepared' }],
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend a Psionic Energy Die (no action)' },
      },
    ],
  },
];

// ═══════════════════════════ MONK (PHB L4671-4811) ══════════════════════════
// FLAG: Monk subclass saves (Elemental Burst, Elemental Strikes, Open Hand Technique, Quivering Palm)
// state no DC; the Monk chapter (L4573) says Focus-Point saves are 8 + Wis mod + Proficiency Bonus.
const MONK_GOLDEN: GoldenSubclass[] = [
  {
    name: 'Warrior of Mercy',
    id: 'mercy',
    class: 'monk',
    featureCount: 6,
    features: [
      { name: 'Hand of Harm', level: 3, line: 4681, dice: [{ expr: '1 Martial Arts die + WisMod', label: 'Extra Necrotic damage (1 Focus Point, once per turn)' }] },
      { name: 'Hand of Healing', level: 3, line: 4685, dice: [{ expr: '1 Martial Arts die + WisMod', label: 'Hit Points restored (Magic action, 1 Focus Point)' }] },
      { name: 'Implements of Mercy', level: 3, line: 4691, proficiencies: { skills: ['Insight', 'Medicine'], tools: ['Herbalism Kit'] } },
      { name: "Physician's Touch", level: 6, line: 4693 },
      {
        name: 'Flurry of Healing and Harm',
        level: 11,
        line: 4701,
        uses: wisUses('long-rest'),
      },
      {
        name: 'Hand of Ultimate Mercy',
        level: 17,
        line: 4707,
        uses: { count: 1, recharge: 'long-rest' },
        dice: [{ expr: '4d10 + WisMod', label: 'Hit Points of the revived creature (costs 5 Focus Points)' }],
      },
    ],
  },
  {
    name: 'Warrior of Shadow',
    id: 'shadow',
    class: 'monk',
    featureCount: 4,
    features: [
      {
        name: 'Shadow Arts',
        level: 3,
        line: 4717,
        // Darkness for 1 Focus Point (no components); Darkvision 60 ft (+60 if already had); Minor Illusion (Wis).
        grantedSpells: [
          { level: 3, spells: ['Darkness'], mode: 'cast-without-slot' },
          { level: 3, spells: ['Minor Illusion'], mode: 'known-cantrip' },
        ],
      },
      { name: 'Shadow Step', level: 6, line: 4727 }, // teleport 60 ft
      { name: 'Improved Shadow Step', level: 11, line: 4731 },
      { name: 'Cloak of Shadows', level: 17, line: 4735 }, // 3 Focus Points, 1 minute
    ],
  },
  {
    name: 'Warrior of the Elements',
    id: 'elements',
    class: 'monk',
    featureCount: 5,
    features: [
      { name: 'Elemental Attunement', level: 3, line: 4753, save: { dc: '8+Wis+Prof', save: 'str' } },
      {
        name: 'Manipulate Elements',
        level: 3,
        line: 4759,
        grantedSpells: [{ level: 3, spells: ['Elementalism'], mode: 'known-cantrip' }],
      },
      {
        name: 'Elemental Burst',
        level: 6,
        line: 4761,
        dice: [{ expr: '3 Martial Arts dice', label: 'Elemental damage in a 20-ft-radius Sphere (2 Focus Points; half on success)' }],
        save: { dc: '8+Wis+Prof', save: 'dex' },
      },
      { name: 'Stride of the Elements', level: 11, line: 4767 },
      {
        name: 'Elemental Epitome',
        level: 17,
        line: 4769,
        dice: [{ expr: '1 Martial Arts die', label: 'Destructive Stride damage / Empowered Strikes extra damage' }],
      },
    ],
  },
  {
    name: 'Warrior of the Open Hand',
    id: 'openHand',
    class: 'monk',
    featureCount: 4,
    features: [
      { name: 'Open Hand Technique', level: 3, line: 4783, save: { dc: '8+Wis+Prof', save: 'str' } }, // Push: Str; Topple: Dex
      {
        name: 'Wholeness of Body',
        level: 6,
        line: 4793,
        uses: wisUses('long-rest'),
        dice: [{ expr: '1 Martial Arts die + WisMod (min 1)', label: 'Hit Points regained (Bonus Action)' }],
      },
      { name: 'Fleet Step', level: 11, line: 4799 },
      {
        name: 'Quivering Palm',
        level: 17,
        line: 4803,
        dice: [{ expr: '10d12', label: 'Force damage (half on success); costs 4 Focus Points' }],
        save: { dc: '8+Wis+Prof', save: 'con' },
      },
    ],
  },
];

// ═══════════════════════════ PALADIN (PHB L5091-5309) ═══════════════════════
// Oath spell tables are Paladin levels 3, 5, 9, 13, 17.
// FLAG: Oath of Vengeance table (L5283) is OCR-damaged ("6 Haste, Protection from Energy");
// read as level 9, matching the Devotion/Glory/Ancients tables, and the 3/5/9/13/17 pattern.
const PALADIN_GOLDEN: GoldenSubclass[] = [
  {
    name: 'Oath of Devotion',
    id: 'devotion',
    class: 'paladin',
    featureCount: 5,
    features: [
      {
        name: 'Oath of Devotion Spells',
        level: 3,
        line: 5111, // table L5113-5121
        grantedSpells: [
          { level: 3, spells: ['Protection from Evil and Good', 'Shield of Faith'], mode: 'always-prepared' },
          { level: 5, spells: ['Aid', 'Zone of Truth'], mode: 'always-prepared' },
          { level: 9, spells: ['Beacon of Hope', 'Dispel Magic'], mode: 'always-prepared' },
          { level: 13, spells: ['Freedom of Movement', 'Guardian of Faith'], mode: 'always-prepared' },
          { level: 17, spells: ['Commune', 'Flame Strike'], mode: 'always-prepared' },
        ],
      },
      {
        name: 'Sacred Weapon',
        level: 3,
        line: 5123,
        channelDivinity: true,
        uses: { count: 'channel-divinity', recharge: 'other' },
        dice: [{ expr: 'ChaMod (min +1)', label: 'Attack roll bonus with the imbued weapon' }],
      },
      { name: 'Aura of Devotion', level: 7, line: 5135 },
      { name: 'Smite of Protection', level: 15, line: 5139 },
      {
        name: 'Holy Nimbus',
        level: 20,
        line: 5143,
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend a level 5 spell slot (no action)' },
        dice: [{ expr: 'ChaMod + Prof', label: 'Radiant damage to enemies starting their turn in the aura' }],
      },
    ],
  },
  {
    name: 'Oath of Glory',
    id: 'glory',
    class: 'paladin',
    featureCount: 6,
    features: [
      {
        name: 'Inspiring Smite',
        level: 3,
        line: 5165,
        channelDivinity: true,
        uses: { count: 'channel-divinity', recharge: 'other' },
        dice: [{ expr: '2d8 + PaladinLevel', label: 'Temporary Hit Points divided among creatures within 30 ft' }],
      },
      {
        name: 'Oath of Glory Spells',
        level: 3,
        line: 5169, // table L5173-5181
        grantedSpells: [
          { level: 3, spells: ['Guiding Bolt', 'Heroism'], mode: 'always-prepared' },
          { level: 5, spells: ['Enhance Ability', 'Magic Weapon'], mode: 'always-prepared' },
          { level: 9, spells: ['Haste', 'Protection from Energy'], mode: 'always-prepared' },
          { level: 13, spells: ['Compulsion', 'Freedom of Movement'], mode: 'always-prepared' },
          { level: 17, spells: ['Legend Lore', "Yolande's Regal Presence"], mode: 'always-prepared' },
        ],
      },
      {
        name: 'Peerless Athlete',
        level: 3,
        line: 5183,
        channelDivinity: true,
        uses: { count: 'channel-divinity', recharge: 'other' },
      },
      { name: 'Aura of Alacrity', level: 7, line: 5187 },
      {
        name: 'Glorious Defense',
        level: 15,
        line: 5193,
        reaction: true,
        uses: { count: { abilityMod: 'cha', min: 1 }, recharge: 'long-rest' },
      },
      {
        name: 'Living Legend',
        level: 20,
        line: 5199,
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend a level 5 spell slot (no action)' },
      },
    ],
  },
  {
    name: 'Oath of the Ancients',
    id: 'ancients',
    class: 'paladin',
    featureCount: 5,
    features: [
      {
        name: "Nature's Wrath",
        level: 3,
        line: 5221,
        channelDivinity: true,
        uses: { count: 'channel-divinity', recharge: 'other' },
        save: { dc: 'spell-save-dc', save: 'str' }, // FLAG: the DC is not stated in the feature; spell save DC assumed from Paladin class text
      },
      {
        name: 'Oath of the Ancients Spells',
        level: 3,
        line: 5225, // table L5229-5237
        grantedSpells: [
          { level: 3, spells: ['Ensnaring Strike', 'Speak with Animals'], mode: 'always-prepared' },
          { level: 5, spells: ['Misty Step', 'Moonbeam'], mode: 'always-prepared' },
          { level: 9, spells: ['Plant Growth', 'Protection from Energy'], mode: 'always-prepared' },
          { level: 13, spells: ['Ice Storm', 'Stoneskin'], mode: 'always-prepared' },
          { level: 17, spells: ['Commune with Nature', 'Tree Stride'], mode: 'always-prepared' },
        ],
      },
      { name: 'Aura of Warding', level: 7, line: 5241 },
      {
        name: 'Undying Sentinel',
        level: 15,
        line: 5245,
        uses: { count: 1, recharge: 'long-rest' },
        dice: [{ expr: '3 x PaladinLevel', label: 'Hit Points regained when dropping to 1 HP instead of 0' }],
      },
      {
        name: 'Elder Champion',
        level: 20,
        line: 5251,
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend a level 5 spell slot (no action)' },
        dice: [{ expr: '10', label: 'Hit Points regained at the start of each of your turns' }],
      },
    ],
  },
  {
    name: 'Oath of Vengeance',
    id: 'vengeance',
    class: 'paladin',
    featureCount: 5,
    features: [
      {
        name: 'Oath of Vengeance Spells',
        level: 3,
        line: 5273, // table L5277-5285
        grantedSpells: [
          { level: 3, spells: ['Bane', "Hunter's Mark"], mode: 'always-prepared' },
          { level: 5, spells: ['Hold Person', 'Misty Step'], mode: 'always-prepared' },
          { level: 9, spells: ['Haste', 'Protection from Energy'], mode: 'always-prepared' }, // FLAG: OCR prints level 6
          { level: 13, spells: ['Banishment', 'Dimension Door'], mode: 'always-prepared' },
          { level: 17, spells: ['Hold Monster', 'Scrying'], mode: 'always-prepared' },
        ],
      },
      {
        name: 'Vow of Enmity',
        level: 3,
        line: 5287,
        channelDivinity: true,
        uses: { count: 'channel-divinity', recharge: 'other' },
      },
      { name: 'Relentless Avenger', level: 7, line: 5293 },
      { name: 'Soul of Vengeance', level: 15, line: 5297, reaction: true },
      {
        name: 'Avenging Angel',
        level: 20,
        line: 5301,
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend a level 5 spell slot (no action)' },
        save: { dc: 'spell-save-dc', save: 'wis' }, // FLAG: Frightful Aura DC not stated in the feature
      },
    ],
  },
];

// ═══════════════════════════ RANGER (PHB L5571-5841) ════════════════════════
const RANGER_GOLDEN: GoldenSubclass[] = [
  {
    name: 'Beast Master',
    id: 'beastMaster',
    class: 'ranger',
    featureCount: 4,
    features: [
      {
        name: 'Primal Companion',
        level: 3,
        line: 5581,
        // Stat block choice: Beast of the Land / Sea / Sky (L5611, L5638, L5662).
        choices: [{ key: 'beast', count: 1, options: ['Beast of the Land', 'Beast of the Sea', 'Beast of the Sky'] }],
      },
      { name: 'Exceptional Training', level: 7, line: 5593 },
      { name: 'Bestial Fury', level: 11, line: 5601 },
      { name: 'Share Spells', level: 15, line: 5607 },
    ],
  },
  {
    name: 'Fey Wanderer',
    id: 'feyWanderer',
    class: 'ranger',
    featureCount: 6,
    features: [
      {
        name: 'Dreadful Strikes',
        level: 3,
        line: 5710,
        dice: [{ expr: '1d4 (1d6 at L11)', label: 'Extra Psychic damage, once per turn' }],
      },
      {
        name: 'Fey Wanderer Spells',
        level: 3,
        line: 5714, // table L5718-5726; also a Feywild Gifts flavour table (d6, L5730)
        grantedSpells: [
          { level: 3, spells: ['Charm Person'], mode: 'always-prepared' },
          { level: 5, spells: ['Misty Step'], mode: 'always-prepared' },
          { level: 9, spells: ['Summon Fey'], mode: 'always-prepared' },
          { level: 13, spells: ['Dimension Door'], mode: 'always-prepared' },
          { level: 17, spells: ['Mislead'], mode: 'always-prepared' },
        ],
      },
      {
        name: 'Otherworldly Glamour',
        level: 3,
        line: 5741,
        // One skill of choice among exactly these three.
        proficiencies: { skillChoices: 1 },
        choices: [{ key: 'glamour-skill', count: 1, options: ['Deception', 'Performance', 'Persuasion'] }],
      },
      { name: 'Beguiling Twist', level: 7, line: 5747, reaction: true, save: { dc: 'spell-save-dc', save: 'wis' } },
      {
        name: 'Fey Reinforcements',
        level: 11,
        line: 5753,
        grantedSpells: [{ level: 11, spells: ['Summon Fey'], mode: 'cast-without-slot' }],
        uses: { count: 1, recharge: 'long-rest' },
      },
      {
        name: 'Misty Wanderer',
        level: 15,
        line: 5757,
        grantedSpells: [{ level: 15, spells: ['Misty Step'], mode: 'cast-without-slot' }],
        uses: wisUses('long-rest'),
      },
    ],
  },
  {
    name: 'Gloom Stalker',
    id: 'gloomStalker',
    class: 'ranger',
    featureCount: 6,
    features: [
      {
        name: 'Dread Ambusher',
        level: 3,
        line: 5769,
        uses: wisUses('long-rest'), // Dreadful Strike uses
        dice: [{ expr: '2d6 (2d8 at L11)', label: 'Dreadful Strike extra Psychic damage, once per turn' }],
      },
      {
        name: 'Gloom Stalker Spells',
        level: 3,
        line: 5781, // table L5785-5793
        grantedSpells: [
          { level: 3, spells: ['Disguise Self'], mode: 'always-prepared' },
          { level: 5, spells: ['Rope Trick'], mode: 'always-prepared' },
          { level: 9, spells: ['Fear'], mode: 'always-prepared' },
          { level: 13, spells: ['Greater Invisibility'], mode: 'always-prepared' },
          { level: 17, spells: ['Seeming'], mode: 'always-prepared' },
        ],
      },
      { name: 'Umbral Sight', level: 3, line: 5795 },
      {
        name: 'Iron Mind',
        level: 7,
        line: 5801,
        // Wisdom saves; if already proficient, Intelligence or Charisma instead.
        proficiencies: { savingThrows: { fixed: ['wis'], fallbackChoice: ['int', 'cha'] } },
      },
      {
        name: "Stalker's Flurry",
        level: 11,
        line: 5805,
        save: { dc: 'spell-save-dc', save: 'wis' }, // Mass Fear
      },
      { name: 'Shadowy Dodge', level: 15, line: 5813, reaction: true },
    ],
  },
  {
    name: 'Hunter',
    id: 'hunter',
    class: 'ranger',
    featureCount: 5,
    features: [
      { name: "Hunter's Lore", level: 3, line: 5823 },
      {
        name: "Hunter's Prey",
        level: 3,
        line: 5825,
        choices: [{ key: 'hunters-prey', count: 1, options: ['Colossus Slayer', 'Horde Breaker'] }],
        dice: [{ expr: '1d8', label: 'Colossus Slayer extra damage, once per turn' }],
      },
      {
        name: 'Defensive Tactics',
        level: 7,
        line: 5831,
        choices: [{ key: 'defensive-tactics', count: 1, options: ['Escape the Horde', 'Multiattack Defense'] }],
      },
      { name: "Superior Hunter's Prey", level: 11, line: 5839 },
      { name: "Superior Hunter's Defense", level: 15, line: 5841, reaction: true },
    ],
  },
];

/** Fighter, Monk, Paladin, Ranger (16 subclasses). */
export const FIGHTER_MONK_PALADIN_RANGER_GOLDEN: GoldenSubclass[] = [
  ...FIGHTER_GOLDEN,
  ...MONK_GOLDEN,
  ...PALADIN_GOLDEN,
  ...RANGER_GOLDEN,
];

/** Barbarian, Bard, Cleric, Druid (16 subclasses). */
export const BARBARIAN_BARD_CLERIC_DRUID_GOLDEN: GoldenSubclass[] = [
  ...BARBARIAN_GOLDEN,
  ...BARD_GOLDEN,
  ...CLERIC_GOLDEN,
  ...DRUID_GOLDEN,
];

// ═══════════════════════════ ROGUE (PHB L5999-6211) ═══════════════════════════
// NOTE: Soulknife "Soul Blades" (L9, L6153): the OCR (L6157) shows the Homing Strikes power
// only as an image; its text is taken from the printed PHB (supplied by the user).
// FLAG: Assassin "Infiltration Expertise" (L9) is named "Expertise" but grants no skill
// Expertise (Masterful Mimicry + Roving Aim only), so no expertise grant is recorded.
// FLAG: Arcane Trickster Spellcasting table (L6027) is OCR-damaged ("ll" = 11, merged slot
// column headers); values were cross-checked with the prose (L6023 "level 7 Rogue ... five
// spells of level 1 or 2") and match the Eldritch Knight progression.
const ROGUE_GOLDEN: GoldenSubclass[] = [
  {
    name: 'Arcane Trickster',
    id: 'arcaneTrickster',
    class: 'rogue',
    featureCount: 5,
    features: [
      {
        name: 'Spellcasting',
        level: 3,
        line: 6009,
        // L6011: Mage Hand + two Wizard cantrips = 3 cantrips; L6019: +1 Wizard cantrip at Rogue level 10 => 4.
        // L6021: three level-1 Wizard spells prepared at L3; table L6027-6046.
        grantedSpells: [{ level: 3, spells: ['Mage Hand'], mode: 'known-cantrip' }],
        spellcasting: {
          ability: 'int',
          spellList: 'Wizard',
          focus: 'Arcane Focus', // L6068
          cantripsKnown: { 3: 3, 10: 4 },
          preparedByLevel: {
            3: 3, 4: 4, 5: 4, 6: 4, 7: 5, 8: 6, 9: 6, 10: 7, 11: 8, 12: 8, 13: 9, 14: 10, 15: 10,
            16: 11, 17: 11, 18: 11, 19: 12, 20: 13,
          },
          slotsByLevel: {
            3: [2, 0, 0, 0], 4: [3, 0, 0, 0], 5: [3, 0, 0, 0], 6: [3, 0, 0, 0],
            7: [4, 2, 0, 0], 8: [4, 2, 0, 0], 9: [4, 2, 0, 0],
            10: [4, 3, 0, 0], 11: [4, 3, 0, 0], 12: [4, 3, 0, 0],
            13: [4, 3, 2, 0], 14: [4, 3, 2, 0], 15: [4, 3, 2, 0],
            16: [4, 3, 3, 0], 17: [4, 3, 3, 0], 18: [4, 3, 3, 0], 19: [4, 3, 3, 1], 20: [4, 3, 3, 1],
          },
        },
      },
      { name: 'Mage Hand Legerdemain', level: 3, line: 6052 },
      { name: 'Magical Ambush', level: 9, line: 6054 },
      { name: 'Versatile Trickster', level: 13, line: 6056 },
      {
        name: 'Spell Thief',
        level: 17,
        line: 6058,
        reaction: true,
        uses: { count: 1, recharge: 'long-rest' },
        save: { dc: 'spell-save-dc', save: 'int' },
      },
    ],
  },
  {
    name: 'Assassin',
    id: 'assassin',
    class: 'rogue',
    featureCount: 5,
    features: [
      {
        name: 'Assassinate',
        level: 3,
        line: 6080,
        dice: [{ expr: 'RogueLevel', label: 'Surprising Strikes extra damage on a Sneak Attack hit in the first round' }],
      },
      {
        name: "Assassin's Tools",
        level: 3,
        line: 6086,
        proficiencies: { tools: ['Disguise Kit', "Poisoner's Kit"] }, // L6086: gains both kits and proficiency with them
      },
      { name: 'Infiltration Expertise', level: 9, line: 6090 },
      {
        name: 'Envenom Weapons',
        level: 13,
        line: 6098,
        dice: [{ expr: '2d6', label: 'Poison damage added to the Poison Cunning Strike on a failed save' }],
      },
      {
        name: 'Death Strike',
        level: 17,
        line: 6102,
        save: { dc: '8+Dex+Prof', save: 'con' },
      },
    ],
  },
  {
    name: 'Soulknife',
    id: 'soulknife',
    class: 'rogue',
    featureCount: 5,
    features: [
      {
        name: 'Psionic Power',
        level: 3,
        line: 6110,
        // Energy Dice table L6114-6123: L3 4xD6, L5 6xD8, L9 8xD8, L11 8xD10, L13 10xD10, L17 12xD12.
        // Regain one die on a Short Rest, all on a Long Rest (L6127).
        uses: { count: 4, recharge: 'other' },
        dice: [
          { expr: 'Psionic Energy Dice: 4d6 (L3), 6d8 (L5), 8d8 (L9), 8d10 (L11), 10d10 (L13), 12d12 (L17)', label: 'Psionic Energy Dice pool' },
          { expr: '1 Psionic Die', label: 'Psi-Bolstered Knack bonus to a failed proficient check (expended only on success)' },
          { expr: '1 Psionic Die = hours', label: 'Psychic Whispers duration (targets up to Proficiency Bonus creatures)' },
        ],
      },
      {
        name: 'Psychic Blades',
        level: 3,
        line: 6139,
        dice: [
          { expr: '1d6', label: 'Psychic Blade damage (plus attack ability modifier)' },
          { expr: '1d4', label: 'Bonus Action second Psychic Blade damage' },
        ],
      },
      {
        name: 'Soul Blades',
        level: 9,
        line: 6153,
        // Printed PHB (Homing Strikes): on a missed Psychic Blade attack roll, roll one Psionic Energy Die and
        // add it to the attack roll; the die is expended only if that makes the attack hit.
        // L6159 (Psychic Teleportation): Bonus Action, expend and roll one die, 10 x roll feet.
        dice: [
          { expr: '1 Psionic Die', label: 'Homing Strikes bonus to a missed Psychic Blade attack roll (expended only if it hits)' },
          { expr: '10 x 1 Psionic Die ft', label: 'Psychic Teleportation distance (Bonus Action)' },
        ],
        mechanics: { homingStrikesDice: 1, homingStrikesExpended: 'only-if-hit', teleportActivation: 'bonus-action' },
      },
      {
        name: 'Psychic Veil',
        level: 13,
        line: 6161,
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend a Psionic Energy Die (no action)' },
      },
      {
        name: 'Rend Mind',
        level: 17,
        line: 6167,
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend three Psionic Energy Dice (no action)' },
        save: { dc: '8+Dex+Prof', save: 'wis' },
      },
    ],
  },
  {
    name: 'Thief',
    id: 'thief',
    class: 'rogue',
    featureCount: 5,
    features: [
      { name: 'Fast Hands', level: 3, line: 6179 },
      { name: 'Second-Story Work', level: 3, line: 6185 },
      { name: 'Supreme Sneak', level: 9, line: 6193, dice: [{ expr: '1d6', label: 'Stealth Attack Cunning Strike cost' }] },
      {
        name: 'Use Magic Device',
        level: 13,
        line: 6199,
        dice: [
          { expr: '1d6 (6 = no charge spent)', label: 'Charges: free use of a charged item property' },
          { expr: '10 + SpellLevel', label: 'Scrolls: Arcana (Int) check DC for scroll spells above level 1' },
        ],
      },
      { name: "Thief's Reflexes", level: 17, line: 6209 },
    ],
  },
];

// ═══════════════════════════ SORCERER (PHB L6528-6727) ═══════════════════════════
// FLAG: Aberrant Sorcery Psionic Spells table (L6546-6551) is OCR-damaged: the last row prints
// "6" for the Sorcerer level of Rary's Telepathic Bond / Telekinesis. Read as level 9, the only
// reading consistent with the other three subclasses (3/5/7/9 rows) and the 2024 rules.
// FLAG: Draconic "Dragon Companion" heading is inline (L6689) rather than a "## LEVEL" heading.
const SORCERER_GOLDEN: GoldenSubclass[] = [
  {
    name: 'Aberrant Sorcery',
    id: 'aberrant',
    class: 'sorcerer',
    featureCount: 6,
    features: [
      {
        name: 'Psionic Spells',
        level: 3,
        line: 6540,
        grantedSpells: [
          { level: 3, spells: ['Arms of Hadar', 'Calm Emotions', 'Detect Thoughts', 'Dissonant Whispers', 'Mind Sliver'], mode: 'always-prepared' },
          { level: 5, spells: ['Hunger of Hadar', 'Sending'], mode: 'always-prepared' },
          { level: 7, spells: ["Evard's Black Tentacles", 'Summon Aberration'], mode: 'always-prepared' },
          { level: 9, spells: ["Rary's Telepathic Bond", 'Telekinesis'], mode: 'always-prepared' }, // FLAG: OCR prints level "6"
        ],
      },
      { name: 'Telepathic Speech', level: 3, line: 6553 },
      { name: 'Psionic Sorcery', level: 6, line: 6561 },
      { name: 'Psychic Defenses', level: 6, line: 6565 },
      {
        name: 'Revelation in Flesh',
        level: 14,
        line: 6569,
        choices: [
          {
            key: 'revelation-in-flesh',
            count: 1,
            options: ['Aquatic Adaptation', 'Glistening Flight', 'See the Invisible', 'Wormlike Movement'], // one benefit per Sorcery Point spent (L6571)
          },
        ],
      },
      {
        name: 'Warping Implosion',
        level: 18,
        line: 6581,
        dice: [{ expr: '3d10', label: 'Force damage (half on a successful save)' }],
        save: { dc: 'spell-save-dc', save: 'str' },
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'spend 5 Sorcery Points (no action)' },
      },
    ],
  },
  {
    name: 'Clockwork Sorcery',
    id: 'clockwork',
    class: 'sorcerer',
    featureCount: 5,
    features: [
      {
        name: 'Clockwork Spells',
        level: 3,
        line: 6593,
        grantedSpells: [
          { level: 3, spells: ['Aid', 'Alarm', 'Lesser Restoration', 'Protection from Evil and Good'], mode: 'always-prepared' },
          { level: 5, spells: ['Dispel Magic', 'Protection from Energy'], mode: 'always-prepared' },
          { level: 7, spells: ['Freedom of Movement', 'Summon Construct'], mode: 'always-prepared' },
          { level: 9, spells: ['Greater Restoration', 'Wall of Force'], mode: 'always-prepared' },
        ],
      },
      {
        name: 'Restore Balance',
        level: 3,
        line: 6620,
        reaction: true,
        uses: { count: { abilityMod: 'cha', min: 1 }, recharge: 'long-rest' },
      },
      {
        name: 'Bastion of Law',
        level: 6,
        line: 6626,
        dice: [{ expr: '1d8 to 5d8 (1 die per Sorcery Point spent, 1-5)', label: 'Ward dice that reduce damage' }],
      },
      {
        name: 'Trance of Order',
        level: 14,
        line: 6632,
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'spend 5 Sorcery Points (no action)' },
      },
      {
        name: 'Clockwork Cavalcade',
        level: 18,
        line: 6638,
        dice: [{ expr: '100', label: 'Hit Points restored, divided among creatures in the 30-foot Cube' }],
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'spend 7 Sorcery Points (no action)' },
      },
    ],
  },
  {
    name: 'Draconic Sorcery',
    id: 'draconic',
    class: 'sorcerer',
    featureCount: 5,
    features: [
      {
        name: 'Draconic Resilience',
        level: 3,
        line: 6658,
        dice: [
          { expr: '3 + (SorcererLevel - 3)', label: 'Hit Point maximum increase (+3, +1 per Sorcerer level gained)' },
          { expr: '10 + DexMod + ChaMod', label: 'Base AC while not wearing armor' },
        ],
      },
      {
        name: 'Draconic Spells',
        level: 3,
        line: 6664,
        grantedSpells: [
          { level: 3, spells: ['Alter Self', 'Chromatic Orb', 'Command', "Dragon's Breath"], mode: 'always-prepared' },
          { level: 5, spells: ['Fear', 'Fly'], mode: 'always-prepared' },
          { level: 7, spells: ['Arcane Eye', 'Charm Monster'], mode: 'always-prepared' },
          { level: 9, spells: ['Legend Lore', 'Summon Dragon'], mode: 'always-prepared' },
        ],
      },
      {
        name: 'Elemental Affinity',
        level: 6,
        line: 6677,
        choices: [{ key: 'elemental-affinity', count: 1, options: ['Acid', 'Cold', 'Fire', 'Lightning', 'Poison'] }],
      },
      {
        name: 'Dragon Wings',
        level: 14,
        line: 6683,
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'spend 3 Sorcery Points (no action)' },
      },
      {
        name: 'Dragon Companion',
        level: 18,
        line: 6689,
        grantedSpells: [{ level: 18, spells: ['Summon Dragon'], mode: 'cast-without-slot' }],
        uses: { count: 1, recharge: 'long-rest' },
      },
    ],
  },
  {
    name: 'Wild Magic Sorcery',
    id: 'wildMagic',
    class: 'sorcerer',
    featureCount: 5,
    features: [
      { name: 'Wild Magic Surge', level: 3, line: 6699, dice: [{ expr: '1d20 (20 = surge)', label: 'Surge trigger, once per turn' }] },
      { name: 'Tides of Chaos', level: 3, line: 6705, uses: { count: 1, recharge: 'other' } }, // regained by casting a Sorcerer spell with a slot or a Long Rest
      {
        name: 'Bend Luck',
        level: 6,
        line: 6711,
        reaction: true,
        dice: [{ expr: '1d4', label: 'Bonus or penalty to another creature\'s d20 (costs 1 Sorcery Point)' }],
      },
      { name: 'Controlled Chaos', level: 14, line: 6715 },
      { name: 'Tamed Surge', level: 18, line: 6721, uses: { count: 1, recharge: 'long-rest' } },
    ],
  },
];

// ═══════════════════════════ WARLOCK (PHB L7177-7358) ═══════════════════════════
// FLAG: Celestial Spells (L7246-7250) list Light and Sacred Flame, which are cantrips; they are
// recorded as always-prepared like the rest of the table row.
// FLAG: Great Old One "Create Thrall" (L7354): the opening paragraph is missing from the OCR
// (only the Hex rider and the no-Concentration/Temporary HP riders remain, L7356-7358), so the
// effect of the lost paragraph (what the feature grants) is not recorded.
const WARLOCK_GOLDEN: GoldenSubclass[] = [
  {
    name: 'Archfey Patron',
    id: 'archfey',
    class: 'warlock',
    featureCount: 5,
    features: [
      {
        name: 'Archfey Spells',
        level: 3,
        line: 7187,
        grantedSpells: [
          { level: 3, spells: ['Calm Emotions', 'Faerie Fire', 'Misty Step', 'Phantasmal Force', 'Sleep'], mode: 'always-prepared' },
          { level: 5, spells: ['Blink', 'Plant Growth'], mode: 'always-prepared' },
          { level: 7, spells: ['Dominate Beast', 'Greater Invisibility'], mode: 'always-prepared' },
          { level: 9, spells: ['Dominate Person', 'Seeming'], mode: 'always-prepared' },
        ],
      },
      {
        name: 'Steps of the Fey',
        level: 3,
        line: 7200,
        grantedSpells: [{ level: 3, spells: ['Misty Step'], mode: 'cast-without-slot' }],
        uses: { count: { abilityMod: 'cha', min: 1 }, recharge: 'long-rest' },
        dice: [{ expr: '1d10', label: 'Refreshing Step Temporary Hit Points' }],
        save: { dc: 'spell-save-dc', save: 'wis' }, // Taunting Step
      },
      {
        name: 'Misty Escape',
        level: 6,
        line: 7210,
        reaction: true,
        dice: [{ expr: '2d10', label: 'Dreadful Step Psychic damage' }],
        save: { dc: 'spell-save-dc', save: 'wis' },
      },
      {
        name: 'Beguiling Defenses',
        level: 10,
        line: 7220,
        reaction: true,
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend a Pact Magic spell slot (no action)' },
        save: { dc: 'spell-save-dc', save: 'wis' },
      },
      { name: 'Bewitching Magic', level: 14, line: 7228, grantedSpells: [{ level: 14, spells: ['Misty Step'], mode: 'cast-without-slot' }] },
    ],
  },
  {
    name: 'Celestial Patron',
    id: 'celestial',
    class: 'warlock',
    featureCount: 5,
    features: [
      {
        name: 'Celestial Spells',
        level: 3,
        line: 7238,
        grantedSpells: [
          { level: 3, spells: ['Aid', 'Cure Wounds', 'Guiding Bolt', 'Lesser Restoration', 'Light', 'Sacred Flame'], mode: 'always-prepared' },
          { level: 5, spells: ['Daylight', 'Revivify'], mode: 'always-prepared' },
          { level: 7, spells: ['Guardian of Faith', 'Wall of Fire'], mode: 'always-prepared' },
          { level: 9, spells: ['Greater Restoration', 'Summon Celestial'], mode: 'always-prepared' },
        ],
      },
      {
        name: 'Healing Light',
        level: 3,
        line: 7252,
        dice: [{ expr: '(1 + WarlockLevel)d6', label: 'Healing dice pool (spend up to ChaMod, min 1, at once)' }],
        uses: { count: 1, recharge: 'long-rest' }, // pool regains all dice on a Long Rest
      },
      { name: 'Radiant Soul', level: 6, line: 7258 },
      {
        name: 'Celestial Resilience',
        level: 10,
        line: 7262,
        dice: [
          { expr: 'WarlockLevel + ChaMod', label: 'Temporary Hit Points for you' },
          { expr: 'floor(WarlockLevel/2) + ChaMod', label: 'Temporary Hit Points for up to five chosen creatures' },
        ],
      },
      {
        name: 'Searing Vengeance',
        level: 14,
        line: 7264,
        dice: [{ expr: '2d8 + ChaMod', label: 'Radiant damage to creatures within 30 feet' }],
        uses: { count: 1, recharge: 'long-rest' },
      },
    ],
  },
  {
    name: 'Fiend Patron',
    id: 'fiend',
    class: 'warlock',
    featureCount: 5,
    features: [
      {
        name: "Dark One's Blessing",
        level: 3,
        line: 7274,
        dice: [{ expr: 'ChaMod + WarlockLevel (min 1)', label: 'Temporary Hit Points' }],
      },
      {
        name: 'Fiend Spells',
        level: 3,
        line: 7276,
        grantedSpells: [
          { level: 3, spells: ['Burning Hands', 'Command', 'Scorching Ray', 'Suggestion'], mode: 'always-prepared' },
          { level: 5, spells: ['Fireball', 'Stinking Cloud'], mode: 'always-prepared' },
          { level: 7, spells: ['Fire Shield', 'Wall of Fire'], mode: 'always-prepared' },
          { level: 9, spells: ['Geas', 'Insect Plague'], mode: 'always-prepared' },
        ],
      },
      {
        name: "Dark One's Own Luck",
        level: 6,
        line: 7293,
        dice: [{ expr: '1d10', label: 'Bonus to an ability check or saving throw' }],
        uses: { count: { abilityMod: 'cha', min: 1 }, recharge: 'long-rest' },
      },
      { name: 'Fiendish Resilience', level: 10, line: 7299 },
      {
        name: 'Hurl Through Hell',
        level: 14,
        line: 7303,
        dice: [{ expr: '8d10', label: 'Psychic damage (not to Fiends)' }],
        save: { dc: 'spell-save-dc', save: 'cha' },
        uses: { count: 1, recharge: 'long-rest', alsoRestoredBy: 'expend a Pact Magic spell slot (no action)' },
      },
    ],
  },
  {
    name: 'Great Old One Patron',
    id: 'greatOldOne',
    class: 'warlock',
    featureCount: 7,
    features: [
      { name: 'Awakened Mind', level: 3, line: 7315 },
      {
        name: 'Great Old One Spells',
        level: 3,
        line: 7323,
        grantedSpells: [
          { level: 3, spells: ['Detect Thoughts', 'Dissonant Whispers', 'Phantasmal Force', "Tasha's Hideous Laughter"], mode: 'always-prepared' },
          { level: 5, spells: ['Clairvoyance', 'Hunger of Hadar'], mode: 'always-prepared' },
          { level: 7, spells: ['Confusion', 'Summon Aberration'], mode: 'always-prepared' },
          { level: 9, spells: ['Modify Memory', 'Telekinesis'], mode: 'always-prepared' },
        ],
      },
      { name: 'Psychic Spells', level: 3, line: 7336 },
      {
        name: 'Clairvoyant Combatant',
        level: 6,
        line: 7340,
        save: { dc: 'spell-save-dc', save: 'wis' },
        uses: { count: 1, recharge: 'short-or-long-rest', alsoRestoredBy: 'expend a Pact Magic spell slot (no action)' },
      },
      { name: 'Eldritch Hex', level: 10, line: 7346, grantedSpells: [{ level: 10, spells: ['Hex'], mode: 'always-prepared' }] },
      { name: 'Thought Shield', level: 10, line: 7350 },
      { name: 'Create Thrall', level: 14, line: 7354 },
    ],
  },
];

// ═══════════════════════════ WIZARD (PHB L7648-7784) ═══════════════════════════
// FLAG: the "Illusionist" subclass heading is missing from the OCR (L7756 shows only the
// tagline "Weave Subtle Spells of Deception"); the name comes from the intro (L7650) and the
// Wizard summary (L2376 region).
// NOTE: Abjurer "Spell Breaker" (L7676) second paragraph is OCR-garbled (L7680); its text is
// taken from the printed PHB (supplied by the user): a slot cast of Counterspell or Dispel Magic
// is not expended if the spell fails to stop a spell.
// FLAG: Abjurer "Projected Ward" (L7672) and Diviner "Greater Portent" (L7718) have images
// after them (L7722-7724); the spoken text is complete enough for names/levels.
const WIZARD_GOLDEN: GoldenSubclass[] = [
  {
    name: 'Abjurer',
    id: 'abjurer',
    class: 'wizard',
    featureCount: 5,
    features: [
      {
        name: 'Abjuration Savant',
        level: 3,
        line: 7658,
        choices: [{ key: 'abjuration-savant-spells', count: 2, options: ['Abjuration school Wizard spells of level 2 or lower'] }],
      },
      {
        name: 'Arcane Ward',
        level: 3,
        line: 7664,
        dice: [{ expr: '2 x WizardLevel + IntMod', label: 'Ward Hit Point maximum' }],
        uses: { count: 1, recharge: 'long-rest' },
      },
      { name: 'Projected Ward', level: 6, line: 7672, reaction: true },
      {
        name: 'Spell Breaker',
        level: 10,
        line: 7676,
        grantedSpells: [{ level: 10, spells: ['Counterspell', 'Dispel Magic'], mode: 'always-prepared' }],
        // L7678: Dispel Magic as a Bonus Action; add Proficiency Bonus to its ability check.
        // Printed PHB: slot not expended when either spell fails to stop a spell.
        mechanics: {
          dispelMagicActivation: 'bonus-action',
          dispelMagicCheckBonus: 'proficiency-bonus',
          slotNotExpendedOnFailure: 'counterspell|dispel-magic',
        },
      },
      { name: 'Spell Resistance', level: 14, line: 7682 },
    ],
  },
  {
    name: 'Diviner',
    id: 'diviner',
    class: 'wizard',
    featureCount: 5,
    features: [
      {
        name: 'Divination Savant',
        level: 3,
        line: 7692,
        choices: [{ key: 'divination-savant-spells', count: 2, options: ['Divination school Wizard spells of level 2 or lower'] }],
      },
      {
        name: 'Portent',
        level: 3,
        line: 7698,
        dice: [{ expr: '2d20 (3d20 at L14 via Greater Portent)', label: 'Foretelling rolls after a Long Rest' }],
      },
      { name: 'Expert Divination', level: 6, line: 7704 },
      {
        name: 'The Third Eye',
        level: 10,
        line: 7708,
        grantedSpells: [{ level: 10, spells: ['See Invisibility'], mode: 'cast-without-slot' }],
        uses: { count: 1, recharge: 'short-or-long-rest' },
        choices: [{ key: 'third-eye', count: 1, options: ['Greater Comprehension', 'See Invisibility'] }], // Darkvision 120 ft is always granted (L7710)
      },
      { name: 'Greater Portent', level: 14, line: 7718 },
    ],
  },
  {
    name: 'Evoker',
    id: 'evoker',
    class: 'wizard',
    featureCount: 5,
    features: [
      {
        name: 'Evocation Savant',
        level: 3,
        line: 7732,
        choices: [{ key: 'evocation-savant-spells', count: 2, options: ['Evocation school Wizard spells of level 2 or lower'] }],
      },
      { name: 'Potent Cantrip', level: 3, line: 7738 },
      { name: 'Sculpt Spells', level: 6, line: 7742 },
      { name: 'Empowered Evocation', level: 10, line: 7746 },
      {
        name: 'Overchannel',
        level: 14,
        line: 7748,
        dice: [{ expr: '2d12 per spell level, +1d12 per further use before a Long Rest', label: 'Necrotic damage from repeated use' }],
      },
    ],
  },
  {
    name: 'Illusionist',
    id: 'illusionist',
    class: 'wizard',
    featureCount: 5,
    features: [
      {
        name: 'Illusion Savant',
        level: 3,
        line: 7760,
        choices: [{ key: 'illusion-savant-spells', count: 2, options: ['Illusion school Wizard spells of level 2 or lower'] }],
      },
      {
        name: 'Improved Illusions',
        level: 3,
        line: 7766,
        grantedSpells: [{ level: 3, spells: ['Minor Illusion'], mode: 'known-cantrip' }],
      },
      {
        name: 'Phantasmal Creatures',
        level: 6,
        line: 7772,
        grantedSpells: [
          { level: 6, spells: ['Summon Beast', 'Summon Fey'], mode: 'always-prepared' },
        ],
        uses: { count: 1, recharge: 'long-rest' }, // per spell cast without a slot
      },
      {
        name: 'Illusory Self',
        level: 10,
        line: 7776,
        reaction: true,
        uses: { count: 1, recharge: 'short-or-long-rest', alsoRestoredBy: 'expend a level 2+ spell slot (no action)' },
      },
      { name: 'Illusory Reality', level: 14, line: 7782 },
    ],
  },
];

/** Rogue, Sorcerer, Warlock, Wizard (16 subclasses). */
export const ROGUE_SORCERER_WARLOCK_WIZARD_GOLDEN: GoldenSubclass[] = [
  ...ROGUE_GOLDEN,
  ...SORCERER_GOLDEN,
  ...WARLOCK_GOLDEN,
  ...WIZARD_GOLDEN,
];

/** All 48 pinned subclasses (12 classes x 4). */
export const SUBCLASS_GOLDEN: GoldenSubclass[] = [
  ...BARBARIAN_BARD_CLERIC_DRUID_GOLDEN,
  ...FIGHTER_MONK_PALADIN_RANGER_GOLDEN,
  ...ROGUE_SORCERER_WARLOCK_WIZARD_GOLDEN,
];