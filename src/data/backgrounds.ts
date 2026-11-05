/**
 * Background catalog (D&D 5.5e / 2024), Stage A7 PART 1.
 *
 * The sixteen 2024 PHB backgrounds, transcribed from Docs/PlayersHandbook.md
 * "PARTS OF A BACKGROUND" (L7806-7820) and "BACKGROUND DESCRIPTIONS" (L7842+).
 * A 2024 background contributes exactly: THREE ability scores (the player
 * increases one by 2 and another by 1, or all three by 1), ONE specified Origin
 * feat, proficiency in TWO skills, ONE tool proficiency (a specific tool or a
 * category choice), and an Equipment choice between a package and 50 GP.
 *
 * CONVENTIONS (match data/species.ts / data/feats.ts):
 *  - One keyed `as const satisfies Record<string, BackgroundData>` record; the
 *    BackgroundId union is DERIVED from it so the persisted shape cannot drift.
 *  - Skill ids are the catalog camelCase SkillId (src/types/character.ts).
 *  - originFeatId is a FeatId that resolves in FEAT_CATALOG (data/feats.ts).
 *  - Every entry carries a PHB `source` citation and a conservative `srd` flag.
 *  - `description` is a SHORT paraphrase, never verbatim PHB prose
 *    (rules-compliance rule 5).
 *
 * CONTENT LICENSING — FLAGGED FOR THE USER
 * ----------------------------------------
 * The SRD 5.2 document is not in the repo, so SRD membership cannot be
 * positively confirmed. Per rules-compliance rule 5 the conservative default is
 * `srd: 'uncertain'` on every entry (same posture as species.ts / feats.ts).
 *
 * EQUIPMENT PACKAGES: `packageItems` hold the option-A grant strings (minus the
 * trailing GP), phrased so src/logic/equipment-resolver.ts parses them
 * (quantities first, e.g. '2 Daggers'; category grants like "Gaming Set (any)"
 * fall through to a custom item). `packageGold` is the GP that accompanies the
 * package; option B is always a flat 50 GP (PHB 2024 "Parts of a Background").
 */

import type { Ability, SkillId } from '../types/character';
import type { FeatId } from './feats';

/** A background's tool proficiency: a specific tool id, or a category choice. */
export interface BackgroundTool {
  /** Specific tool id (equipment-catalog id), present when not a category choice. */
  id?: string;
  /** Category choice the player resolves to a specific tool, when applicable. */
  category?: 'gaming-set' | 'artisans-tools' | 'musical-instrument';
  /** Display label for the tool / category. */
  label: string;
}

/** A background's equipment option A (the package). Option B is always 50 GP. */
export interface BackgroundEquipment {
  /** Option-A item grant strings (resolver-parseable), excluding the trailing GP. */
  packageItems: string[];
  /** GP that accompanies option A. */
  packageGold: number;
}

/** One background's full mechanical profile (PHB 2024 "Parts of a Background"). */
export interface BackgroundData {
  /** Catalog key, e.g. 'acolyte'. */
  id: string;
  /** Background name as printed, e.g. 'Acolyte'. */
  name: string;
  /** The three ability scores the background lists, in PHB order. */
  abilities: [Ability, Ability, Ability];
  /** The Origin feat the background grants (resolves in FEAT_CATALOG). */
  originFeatId: FeatId;
  /** The two skill proficiencies the background grants. */
  skills: [SkillId, SkillId];
  /** The one tool proficiency (specific tool or a category choice). */
  tool: BackgroundTool;
  /** Option-A equipment package + GP; option B is a flat 50 GP. */
  equipment: BackgroundEquipment;
  /** Short paraphrase of the printed narrative (never verbatim). */
  description: string;
  /** SRD-safety classification for redistribution (see file header). */
  srd: 'non-srd' | 'uncertain';
  /** PHB citation this entry is transcribed from. */
  source: string;
}

/** Option B is always a flat 50 GP. PHB 2024 "Parts of a Background" (L7820). */
export const BACKGROUND_OPTION_B_GOLD = 50;

const GAMING_SET_TOOL: BackgroundTool = {
  category: 'gaming-set',
  label: 'Gaming Set (your choice)',
};
const ARTISANS_TOOLS_TOOL: BackgroundTool = {
  category: 'artisans-tools',
  label: "Artisan's Tools (your choice)",
};
const MUSICAL_INSTRUMENT_TOOL: BackgroundTool = {
  category: 'musical-instrument',
  label: 'Musical Instrument (your choice)',
};

/**
 * The sixteen PHB (2024) backgrounds, keyed alphabetically. Every value is
 * transcribed from Docs/PlayersHandbook.md "BACKGROUND DESCRIPTIONS" (L7842+).
 */
export const BACKGROUND_CATALOG = {
  // PHB 2024 "Acolyte" (Docs/PlayersHandbook.md L~7848).
  acolyte: {
    id: 'acolyte',
    name: 'Acolyte',
    abilities: ['int', 'wis', 'cha'],
    originFeatId: 'magic-initiate-cleric',
    skills: ['insight', 'religion'],
    tool: { id: 'calligraphers-supplies', label: "Calligrapher's Supplies" },
    equipment: {
      packageItems: [
        "Calligrapher's Supplies",
        'Book (prayers)',
        'Holy Symbol',
        'Parchment (10 sheets)',
        'Robe',
      ],
      packageGold: 8,
    },
    description:
      'Served in a temple under a priest, performing rites and studying religion, and learned to channel a modicum of divine power.',
    srd: 'uncertain',
    source: 'PHB 2024 "Acolyte" background',
  },

  // PHB 2024 "Artisan".
  artisan: {
    id: 'artisan',
    name: 'Artisan',
    abilities: ['str', 'dex', 'int'],
    originFeatId: 'crafter',
    skills: ['investigation', 'persuasion'],
    tool: ARTISANS_TOOLS_TOOL,
    equipment: {
      packageItems: ["Artisan's Tools", '2 Pouches', "Traveler's Clothes"],
      packageGold: 32,
    },
    description:
      "Apprenticed in an artisan's workshop, learning a craft, a persuasive tongue, and a keen eye for detail.",
    srd: 'uncertain',
    source: 'PHB 2024 "Artisan" background',
  },

  // PHB 2024 "Charlatan".
  charlatan: {
    id: 'charlatan',
    name: 'Charlatan',
    abilities: ['dex', 'con', 'cha'],
    originFeatId: 'skilled',
    skills: ['deception', 'sleightOfHand'],
    tool: { id: 'forgery-kit', label: 'Forgery Kit' },
    equipment: {
      packageItems: ['Forgery Kit', 'Costume', 'Fine Clothes'],
      packageGold: 15,
    },
    description:
      'Worked the taverns preying on the gullible with comforting lies, sham potions, and forged records.',
    srd: 'uncertain',
    source: 'PHB 2024 "Charlatan" background',
  },

  // PHB 2024 "Criminal" (Docs/PlayersHandbook.md L~7886).
  criminal: {
    id: 'criminal',
    name: 'Criminal',
    abilities: ['dex', 'con', 'int'],
    originFeatId: 'alert',
    skills: ['sleightOfHand', 'stealth'],
    tool: { id: 'thieves-tools', label: "Thieves' Tools" },
    equipment: {
      packageItems: ['2 Daggers', "Thieves' Tools", 'Crowbar', '2 Pouches', "Traveler's Clothes"],
      packageGold: 16,
    },
    description:
      'Scraped a living in dark alleyways cutting purses and burgling shops, alone or in a small gang.',
    srd: 'uncertain',
    source: 'PHB 2024 "Criminal" background',
  },

  // PHB 2024 "Entertainer".
  entertainer: {
    id: 'entertainer',
    name: 'Entertainer',
    abilities: ['str', 'dex', 'cha'],
    originFeatId: 'musician',
    skills: ['acrobatics', 'performance'],
    tool: MUSICAL_INSTRUMENT_TOOL,
    equipment: {
      packageItems: ['Musical Instrument', '2 Costumes', 'Mirror', 'Perfume', "Traveler's Clothes"],
      packageGold: 11,
    },
    description:
      'Followed roving fairs and carnivals, learning to play, perform, and thrive on applause.',
    srd: 'uncertain',
    source: 'PHB 2024 "Entertainer" background',
  },

  // PHB 2024 "Farmer".
  farmer: {
    id: 'farmer',
    name: 'Farmer',
    abilities: ['str', 'con', 'wis'],
    originFeatId: 'tough',
    skills: ['animalHandling', 'nature'],
    tool: { id: 'carpenters-tools', label: "Carpenter's Tools" },
    equipment: {
      packageItems: [
        'Sickle',
        "Carpenter's Tools",
        "Healer's Kit",
        'Iron Pot',
        'Shovel',
        "Traveler's Clothes",
      ],
      packageGold: 30,
    },
    description:
      'Grew up close to the land, tending animals and crops, rewarded with patience and good health.',
    srd: 'uncertain',
    source: 'PHB 2024 "Farmer" background',
  },

  // PHB 2024 "Guard".
  guard: {
    id: 'guard',
    name: 'Guard',
    abilities: ['str', 'int', 'wis'],
    originFeatId: 'alert',
    skills: ['athletics', 'perception'],
    tool: GAMING_SET_TOOL,
    equipment: {
      packageItems: [
        'Spear',
        'Light Crossbow',
        '20 Bolts',
        'Gaming Set',
        'Hooded Lantern',
        'Manacles',
        'Quiver',
        "Traveler's Clothes",
      ],
      packageGold: 12,
    },
    description:
      'Stood watch on a tower wall, trained to eye both the wilderness without and the troublemakers within.',
    srd: 'uncertain',
    source: 'PHB 2024 "Guard" background',
  },

  // PHB 2024 "Guide".
  guide: {
    id: 'guide',
    name: 'Guide',
    abilities: ['dex', 'con', 'wis'],
    originFeatId: 'magic-initiate-druid',
    skills: ['stealth', 'survival'],
    tool: { id: 'cartographers-tools', label: "Cartographer's Tools" },
    equipment: {
      packageItems: [
        'Shortbow',
        '20 Arrows',
        "Cartographer's Tools",
        'Bedroll',
        'Quiver',
        'Tent',
        "Traveler's Clothes",
      ],
      packageGold: 3,
    },
    description:
      'Came of age in the wild, learning to fend for yourself and to channel a little of nature’s magic.',
    srd: 'uncertain',
    source: 'PHB 2024 "Guide" background',
  },

  // PHB 2024 "Hermit".
  hermit: {
    id: 'hermit',
    name: 'Hermit',
    abilities: ['con', 'wis', 'cha'],
    originFeatId: 'healer',
    skills: ['medicine', 'religion'],
    tool: { id: 'herbalism-kit', label: 'Herbalism Kit' },
    equipment: {
      packageItems: [
        'Quarterstaff',
        'Herbalism Kit',
        'Bedroll',
        'Book (philosophy)',
        'Lamp',
        'Oil (3 flasks)',
        "Traveler's Clothes",
      ],
      packageGold: 16,
    },
    description:
      'Lived in seclusion beyond the nearest settlement, pondering the mysteries of creation.',
    srd: 'uncertain',
    source: 'PHB 2024 "Hermit" background',
  },

  // PHB 2024 "Merchant".
  merchant: {
    id: 'merchant',
    name: 'Merchant',
    abilities: ['con', 'int', 'cha'],
    originFeatId: 'lucky',
    skills: ['animalHandling', 'persuasion'],
    tool: { id: 'navigators-tools', label: "Navigator's Tools" },
    equipment: {
      packageItems: ["Navigator's Tools", '2 Pouches', "Traveler's Clothes"],
      packageGold: 22,
    },
    description:
      'Apprenticed to a trader or caravan master, traveling broadly and dealing in raw materials and crafted goods.',
    srd: 'uncertain',
    source: 'PHB 2024 "Merchant" background',
  },

  // PHB 2024 "Noble".
  noble: {
    id: 'noble',
    name: 'Noble',
    abilities: ['str', 'int', 'cha'],
    originFeatId: 'skilled',
    skills: ['history', 'persuasion'],
    tool: GAMING_SET_TOOL,
    equipment: {
      packageItems: ['Gaming Set', 'Fine Clothes', 'Perfume'],
      packageGold: 29,
    },
    description:
      'Raised in a castle amid wealth and privilege, given a first-class education and a close view of courtly leadership.',
    srd: 'uncertain',
    source: 'PHB 2024 "Noble" background',
  },

  // PHB 2024 "Sage".
  sage: {
    id: 'sage',
    name: 'Sage',
    abilities: ['con', 'int', 'wis'],
    originFeatId: 'magic-initiate-wizard',
    skills: ['arcana', 'history'],
    tool: { id: 'calligraphers-supplies', label: "Calligrapher's Supplies" },
    equipment: {
      packageItems: [
        'Quarterstaff',
        "Calligrapher's Supplies",
        'Book (history)',
        'Parchment (8 sheets)',
        'Robe',
      ],
      packageGold: 8,
    },
    description:
      'Traveled between manors and monasteries trading work for library access, studying lore and the rudiments of magic.',
    srd: 'uncertain',
    source: 'PHB 2024 "Sage" background',
  },

  // PHB 2024 "Sailor".
  sailor: {
    id: 'sailor',
    name: 'Sailor',
    abilities: ['str', 'dex', 'wis'],
    originFeatId: 'tavern-brawler',
    skills: ['acrobatics', 'perception'],
    tool: { id: 'navigators-tools', label: "Navigator's Tools" },
    equipment: {
      packageItems: ['Dagger', "Navigator's Tools", 'Rope', "Traveler's Clothes"],
      packageGold: 20,
    },
    description:
      'Lived as a seafarer through mighty storms and countless ports of call, trading stories with folk beneath the waves.',
    srd: 'uncertain',
    source: 'PHB 2024 "Sailor" background',
  },

  // PHB 2024 "Scribe".
  scribe: {
    id: 'scribe',
    name: 'Scribe',
    abilities: ['dex', 'int', 'wis'],
    originFeatId: 'skilled',
    skills: ['investigation', 'perception'],
    tool: { id: 'calligraphers-supplies', label: "Calligrapher's Supplies" },
    equipment: {
      packageItems: [
        "Calligrapher's Supplies",
        'Fine Clothes',
        'Lamp',
        'Oil (3 flasks)',
        'Parchment (12 sheets)',
      ],
      packageGold: 23,
    },
    description:
      'Spent formative years in a scriptorium learning a clear hand and a careful eye for detail copying texts.',
    srd: 'uncertain',
    source: 'PHB 2024 "Scribe" background',
  },

  // PHB 2024 "Soldier" (Docs/PlayersHandbook.md L~7978).
  soldier: {
    id: 'soldier',
    name: 'Soldier',
    abilities: ['str', 'dex', 'con'],
    originFeatId: 'savage-attacker',
    skills: ['athletics', 'intimidation'],
    tool: GAMING_SET_TOOL,
    equipment: {
      packageItems: [
        'Spear',
        'Shortbow',
        '20 Arrows',
        'Gaming Set',
        "Healer's Kit",
        'Quiver',
        "Traveler's Clothes",
      ],
      packageGold: 14,
    },
    description:
      'Trained for war from adulthood; battle is in your blood, and you waged it to protect the realm.',
    srd: 'uncertain',
    source: 'PHB 2024 "Soldier" background',
  },

  // PHB 2024 "Wayfarer".
  wayfarer: {
    id: 'wayfarer',
    name: 'Wayfarer',
    abilities: ['dex', 'wis', 'cha'],
    originFeatId: 'lucky',
    skills: ['insight', 'stealth'],
    tool: { id: 'thieves-tools', label: "Thieves' Tools" },
    equipment: {
      packageItems: [
        '2 Daggers',
        "Thieves' Tools",
        'Gaming Set (any)',
        'Bedroll',
        '2 Pouches',
        "Traveler's Clothes",
      ],
      packageGold: 16,
    },
    description:
      'Grew up on the streets among castoffs, sleeping where you could and never losing your pride or your hope.',
    srd: 'uncertain',
    source: 'PHB 2024 "Wayfarer" background',
  },
} as const satisfies Record<string, BackgroundData>;

/** A valid background catalog key, e.g. 'acolyte'. Derived so the shape can't drift. */
export type BackgroundId = keyof typeof BACKGROUND_CATALOG;

/** A background entry whose `id` is narrowed to the literal BackgroundId union. */
export type BackgroundEntry = BackgroundData & { id: BackgroundId };

/** The catalog as an array, in alphabetical (declaration) order. */
export const BACKGROUND_LIST: readonly BackgroundEntry[] = Object.values(
  BACKGROUND_CATALOG,
) as readonly BackgroundEntry[];

/** Looks up a background by id, tolerating an unknown/absent id (returns undefined). */
export function getBackground(id: string | undefined): BackgroundData | undefined {
  if (id === undefined) return undefined;
  return (BACKGROUND_CATALOG as Record<string, BackgroundData>)[id];
}
