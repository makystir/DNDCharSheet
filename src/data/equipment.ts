/**
 * D&D 5.5e (2024) equipment catalog — adventuring gear, tools, ammunition, and
 * equipment packs from PHB 2024 Chapter 6 "Equipment".
 *
 * A flat, typed data module mirroring src/data/weapons.ts / armor.ts: one
 * exported record keyed by item id, plus the id/enum unions derived from the
 * data so a persisted InventoryItem.catalogId and the catalog cannot drift.
 *
 * SOURCING / RULES COMPLIANCE
 * ---------------------------
 * Every weight/cost is transcribed from the PHB 2024 equipment tables, and each
 * entry carries a PER-ENTRY `source` citation naming the exact table/section +
 * markdown line it came from (rules-compliance rule 7 / blueprint §2.2, §7.5),
 * because equipment is drawn from MANY individual tables rather than one.
 * NO item is invented (rules-compliance rule 1). Each entry also carries a
 * conservative `srd` flag. The optional `description` is a SHORT paraphrase for
 * the content-tooltip resolver surfaced in a later stage, with the operative
 * action/range/DC/duration retained but no long verbatim PHB prose (rule 5).
 *
 * SCOPE — REPRESENTATIVE SET (flagged for extension)
 * --------------------------------------------------
 * The full PHB gear/tools tables are large. This catalog covers (a) EVERY item
 * referenced by the current class starting-equipment strings in
 * src/data/classes.ts (verified by a coverage test), (b) all ammunition types,
 * (c) all five standard equipment packs plus the Priest's and Scholar's packs
 * the classes grant, and (d) the Spellcasting-Focus and Musical-Instrument
 * variants the classes grant. The remaining long tail (every artisan's tool,
 * every gaming set, every one-off gear item) can be appended later without any
 * structural change. See the implementer summary for the included/omitted list.
 *
 * COST NORMALISATION: all costs are stored in GP (costGp) for later
 * weight/encumbrance math. PHB 2024 "Coins" (L9247-9272): 1 GP = 10 SP =
 * 100 CP, so 1 SP = 0.1 GP, 5 SP = 0.5 GP, 1 CP = 0.01 GP, 5 CP = 0.05 GP,
 * 4 CP = 0.04 GP, 2 CP = 0.02 GP. The conversion is noted inline where applied.
 *
 * WEIGHT NORMALISATION: PHB 'Varies' / '—' (no listed weight) → 0 with a
 * comment, per the blueprint. OCR weight glyphs ('216.' → 2 lb, '416.' → 4 lb,
 * '716.' → 7 lb, '616.' → 6 lb, '1/2 lb' → 0.5 lb, 'l lb.' → 1 lb,
 * 'l½ lb' → 1.5 lb, '58½ lb.' → 58.5 lb) were corrected against the printed
 * tables. OCR cost glyph 'S0GP'/'SOGP' → 50 GP.
 *
 * AMMUNITION PACKAGING: the PHB "Ammunition" table (L9958-9964) lists weight
 * AND cost PER BUNDLE (the Amount you buy: Arrows 20, Bolts 20, Firearm Bullets
 * 10, Sling Bullets 20, Needles 50), not per piece. So weightLb/costGp on an
 * ammunition entry are the BUNDLE values and `packageSize` records how many
 * pieces that bundle contains. A2's weight/value math must divide by
 * packageSize (or treat a quantity of N pieces as ceil(N / packageSize)
 * bundles) rather than multiplying the bundle weight by the piece count — see
 * the ammunition unit regression test.
 */

/** What kind of equipment an entry is (drives resolver routing + UI grouping). */
export type EquipmentKind = 'gear' | 'tool' | 'ammunition' | 'pack' | 'consumable';

/** A single equipment entry transcribed from the PHB 2024 equipment tables. */
export interface EquipmentData {
  /** Kebab-case catalog id, e.g. 'healers-kit'. */
  id: string;
  /** Name as printed in the PHB. */
  name: string;
  /** Category for routing/grouping. */
  kind: EquipmentKind;
  /** Weight in pounds; 0 where the PHB lists 'Varies'/'—' (see header). For
   *  ammunition this is the weight of ONE BUNDLE of `packageSize` pieces. */
  weightLb: number;
  /**
   * Cost normalised to gold pieces. For ammunition this is the BUNDLE price.
   *
   * OPTIONAL by design (rules-compliance rule 1, review finding #3): the PHB
   * lists some items with a weight but NO purchase price (the Wizard's
   * Spellbook is the current example). For those entries `costGp` is OMITTED
   * and `unpriced: true` is set, so downstream value/purchase logic can tell
   * "costs 0 GP" apart from "the PHB states no price" rather than treating an
   * invented `costGp: 0` as free. Every PRICED entry carries a numeric costGp.
   */
  costGp?: number;
  /**
   * True only for entries the PHB lists WITHOUT a purchase price (see `costGp`).
   * When true, `costGp` is absent and MUST NOT be substituted with 0. Absent
   * (falsy) on every priced entry.
   */
  unpriced?: boolean;
  /**
   * For ammunition only: how many individual pieces one purchased bundle holds
   * (PHB 2024 "Ammunition" table, L9958-9964). `weightLb`/`costGp` describe one
   * bundle of this many pieces, so per-piece weight = weightLb / packageSize.
   * Absent on all non-ammunition entries.
   */
  packageSize?: number;
  /** Short paraphrase for the content tooltip (never verbatim PHB prose). */
  description?: string;
  /** Conservative SRD flag — false (flagged) until the user confirms (rule 5). */
  srd: boolean;
  /**
   * Per-entry PHB 2024 citation: the exact table/section + markdown line the row
   * was transcribed from (rules-compliance rule 7 / blueprint §2.2, §7.5).
   */
  source: string;
}

// PHB 2024 Chapter 6 "Equipment". Declaration order groups by kind for
// readability: ammunition, then packs, then consumables, then common gear,
// focuses, then common tools.
export const EQUIPMENT_CATALOG: Record<string, EquipmentData> = {
  // ── Ammunition (PHB 2024 "Ammunition" table, L9958-9964) ──────────────────
  // weightLb/costGp are PER BUNDLE; packageSize is the Amount you buy.
  arrows: {
    id: 'arrows',
    name: 'Arrows',
    kind: 'ammunition',
    weightLb: 1, // per bundle of 20
    costGp: 1,
    packageSize: 20,
    description: 'A bundle of 20 arrows for a bow; typically stored in a Quiver (bought separately).',
    srd: false,
    source: 'PHB 2024 "Ammunition" table (L9962: Arrows, 20, 1 lb., 1 GP)',
  },
  bolts: {
    id: 'bolts',
    name: 'Bolts',
    kind: 'ammunition',
    weightLb: 1.5, // OCR 'l½ lb.' → 1.5 lb, per bundle of 20
    costGp: 1,
    packageSize: 20,
    description: 'A bundle of 20 crossbow bolts; typically stored in a Case (bought separately).',
    srd: false,
    source: 'PHB 2024 "Ammunition" table (L9963: Bolts, 20, 1½ lb., 1 GP)',
  },
  'bullets-firearm': {
    id: 'bullets-firearm',
    name: 'Bullets, Firearm',
    kind: 'ammunition',
    weightLb: 2, // per bundle of 10
    costGp: 3,
    packageSize: 10,
    description: 'A bundle of 10 firearm bullets; typically stored in a Pouch (bought separately).',
    srd: false,
    source: 'PHB 2024 "Ammunition" table (L9964: Bullets, Firearm, 10, 2 lb., 3 GP)',
  },
  'bullets-sling': {
    id: 'bullets-sling',
    name: 'Bullets, Sling',
    kind: 'ammunition',
    weightLb: 1.5, // OCR 'l½ lb.' → 1.5 lb, per bundle of 20
    costGp: 0.04, // 4 CP (per bundle of 20)
    packageSize: 20,
    description: 'A bundle of 20 sling bullets; typically stored in a Pouch (bought separately).',
    srd: false,
    source: 'PHB 2024 "Ammunition" table (L9965: Bullets, Sling, 20, 1½ lb., 4 CP)',
  },
  needles: {
    id: 'needles',
    name: 'Needles',
    kind: 'ammunition',
    weightLb: 1, // per bundle of 50
    costGp: 1,
    packageSize: 50,
    description: 'A bundle of 50 blowgun needles; typically stored in a Pouch (bought separately).',
    srd: false,
    source: 'PHB 2024 "Ammunition" table (L9966: Needles, 50, 1 lb., 1 GP)',
  },
  // ── Equipment Packs (PHB 2024 "Adventuring Gear" table + pack descriptions) ─
  'burglars-pack': {
    id: 'burglars-pack',
    name: "Burglar's Pack",
    kind: 'pack',
    weightLb: 42,
    costGp: 16,
    description: 'Backpack, Ball Bearings, Bell, 10 Candles, Crowbar, Hooded Lantern, 7 Oil, 5 Rations, Rope, Tinderbox, Waterskin.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9976) + "Burglar\'s Pack" (L10056)',
  },
  'diplomats-pack': {
    id: 'diplomats-pack',
    name: "Diplomat's Pack",
    kind: 'pack',
    weightLb: 39,
    costGp: 39,
    description: 'Chest, Fine Clothes, Ink, 5 Ink Pens, Lamp, 2 Map/Scroll Cases, 4 Oil, 5 Paper, 5 Parchment, Perfume, Tinderbox.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9989) + "Diplomat\'s Pack"',
  },
  'dungeoneers-pack': {
    id: 'dungeoneers-pack',
    name: "Dungeoneer's Pack",
    kind: 'pack',
    weightLb: 55,
    costGp: 12,
    description: 'Backpack, Caltrops, Crowbar, 2 Oil, 10 Rations, Rope, Tinderbox, 10 Torches, Waterskin.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9991) + "Dungeoneer\'s Pack" (L10138)',
  },
  'entertainers-pack': {
    id: 'entertainers-pack',
    name: "Entertainer's Pack",
    kind: 'pack',
    weightLb: 58.5, // OCR '58½ lb.' → 58.5 lb
    costGp: 40,
    description: 'Backpack, Bedroll, Bell, Bullseye Lantern, 3 Costumes, Mirror, 8 Oil, 9 Rations, Tinderbox, Waterskin.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9992) + "Entertainer\'s Pack" (L10140)',
  },
  'explorers-pack': {
    id: 'explorers-pack',
    name: "Explorer's Pack",
    kind: 'pack',
    weightLb: 55,
    costGp: 10,
    description: 'Backpack, Bedroll, 2 Oil, 10 Rations, Rope, Tinderbox, 10 Torches, Waterskin.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9993) + "Explorer\'s Pack"',
  },
  'priests-pack': {
    id: 'priests-pack',
    name: "Priest's Pack",
    kind: 'pack',
    weightLb: 29,
    costGp: 33,
    description: 'Backpack, Blanket, Holy Water, Lamp, 7 Rations, Robe, Tinderbox.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9981) + "Priest\'s Pack" (L10296)',
  },
  'scholars-pack': {
    id: 'scholars-pack',
    name: "Scholar's Pack",
    kind: 'pack',
    weightLb: 22,
    costGp: 40,
    description: 'Backpack, Book, Ink, Ink Pen, Lamp, 10 Oil, 10 Parchment, Tinderbox.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9988) + "Scholar\'s Pack" (L10324)',
  },
  // ── Throwable / drinkable consumables (PHB 2024 gear descriptions) ─────────
  acid: {
    id: 'acid',
    name: 'Acid',
    kind: 'consumable',
    weightLb: 1,
    costGp: 25,
    description: 'Replace one attack to throw it at a target within 20 ft; Dex save (DC 8 + Dex mod + PB) or 2d6 Acid damage.',
    srd: false,
    source: 'PHB 2024 "Acid" (L9930); weight/cost L9959',
  },
  'alchemists-fire': {
    id: 'alchemists-fire',
    name: "Alchemist's Fire",
    kind: 'consumable',
    weightLb: 1,
    costGp: 50,
    description: 'Replace one attack to throw it at a target within 20 ft; Dex save (DC 8 + Dex mod + PB) or 1d4 Fire damage and start burning.',
    srd: false,
    source: 'PHB 2024 "Alchemist\'s Fire" (L9936); weight/cost L9960',
  },
  antitoxin: {
    id: 'antitoxin',
    name: 'Antitoxin',
    kind: 'consumable',
    weightLb: 0, // PHB lists no weight for Antitoxin → 0
    costGp: 50,
    description: 'Drink as a Bonus Action to gain Advantage on saves to avoid or end the Poisoned condition for 1 hour.',
    srd: false,
    source: 'PHB 2024 "Antitoxin" (L9954); cost L9961',
  },
  'holy-water': {
    id: 'holy-water',
    name: 'Holy Water',
    kind: 'consumable',
    weightLb: 1,
    costGp: 25,
    description: 'Replace one attack to throw it at a target within 20 ft; if a Fiend or Undead, Dex save (DC 8 + Dex mod + PB) or 2d8 Radiant damage.',
    srd: false,
    source: 'PHB 2024 "Holy Water" (L10176); weight/cost L9998',
  },
  'potion-of-healing': {
    id: 'potion-of-healing',
    name: 'Potion of Healing',
    kind: 'consumable',
    weightLb: 0.5, // PHB '1/2 lb.'
    costGp: 50, // OCR 'S0GP' → 50 GP
    description: 'Bonus Action to drink it, or administer it to a creature within 5 feet; the drinker regains 2d4 + 2 Hit Points.',
    srd: false,
    source: 'PHB 2024 "Potion of Healing" (L10286); weight/cost L9979',
  },
  // ── Common Adventuring Gear (PHB 2024 "Adventuring Gear" table, L9958+) ────
  backpack: {
    id: 'backpack',
    name: 'Backpack',
    kind: 'gear',
    weightLb: 5,
    costGp: 2,
    description: 'Holds up to 30 pounds within 1 cubic foot; can serve as a saddlebag.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9965) + "Backpack" (L10022)',
  },
  bedroll: {
    id: 'bedroll',
    name: 'Bedroll',
    kind: 'gear',
    weightLb: 7, // OCR '716.' → 7 lb
    costGp: 1,
    description: 'Sleeps one Small/Medium creature; auto-succeed on saves vs extreme cold.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9968) + "Bedroll"',
  },
  blanket: {
    id: 'blanket',
    name: 'Blanket',
    kind: 'gear',
    weightLb: 3,
    costGp: 0.5, // 5 SP
    description: 'While wrapped in it, you have Advantage on saves vs extreme cold.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9971: Blanket, 3 lb., 5 SP)',
  },
  'ball-bearings': {
    id: 'ball-bearings',
    name: 'Ball Bearings',
    kind: 'gear',
    weightLb: 2, // OCR '216.' → 2 lb
    costGp: 1,
    description: 'Utilize action to spill over a 10-ft square within 10 ft; a creature entering it makes a DC 10 Dex save or falls Prone (10 min to recover).',
    srd: false,
    source: 'PHB 2024 "Ball Bearings" (L10026); weight/cost L9966',
  },
  caltrops: {
    id: 'caltrops',
    name: 'Caltrops',
    kind: 'gear',
    weightLb: 2, // OCR '216.' → 2 lb
    costGp: 1,
    description: 'Utilize action to spread over a 5-ft square within 5 ft; a creature entering it makes a DC 15 Dex save or takes 1 Piercing and has Speed 0 until its next turn (10 min to recover).',
    srd: false,
    source: 'PHB 2024 "Caltrops" (L10058); weight/cost L9977',
  },
  candle: {
    id: 'candle',
    name: 'Candle',
    kind: 'gear',
    weightLb: 0, // PHB lists no weight → 0
    costGp: 0.01, // 1 CP
    description: 'Sheds Bright Light in a 5-foot radius (and Dim Light 5 more) for 1 hour.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9978) + "Candle"',
  },
  crowbar: {
    id: 'crowbar',
    name: 'Crowbar',
    kind: 'gear',
    weightLb: 5,
    costGp: 2,
    description: 'Grants Advantage on Strength checks where its leverage applies.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9988: Crowbar, 5 lb., 2 GP)',
  },
  'grappling-hook': {
    id: 'grappling-hook',
    name: 'Grappling Hook',
    kind: 'gear',
    weightLb: 4,
    costGp: 2,
    description: 'Utilize action to throw it at a catch within 50 ft; it holds on a successful DC 13 Dex (Acrobatics) check, then you can climb a tied Rope.',
    srd: false,
    source: 'PHB 2024 "Grappling Hook" (L10154); weight/cost L9996',
  },
  'healers-kit': {
    id: 'healers-kit',
    name: "Healer's Kit",
    kind: 'gear',
    weightLb: 3,
    costGp: 5,
    description: 'Ten uses; expend one as a Utilize action to stabilize a creature at 0 HP without a Wisdom (Medicine) check.',
    srd: false,
    source: 'PHB 2024 "Healer\'s Kit" (L10159); weight/cost L9997',
  },
  'hooded-lantern': {
    id: 'hooded-lantern',
    name: 'Lantern, Hooded',
    kind: 'gear',
    weightLb: 2, // OCR '216.' → 2 lb
    costGp: 5,
    description: 'Burns Oil for Bright Light 30 ft (Dim 30 more); as a Bonus Action you can lower the hood to Dim Light 5 ft, or raise it again.',
    srd: false,
    source: 'PHB 2024 "Lantern, Hooded" (L10218); weight/cost L9965',
  },
  'bullseye-lantern': {
    id: 'bullseye-lantern',
    name: 'Lantern, Bullseye',
    kind: 'gear',
    weightLb: 2, // OCR '216.' → 2 lb
    costGp: 10,
    description: 'Burns Oil for Bright Light in a 60-foot Cone (Dim 60 more).',
    srd: false,
    source: 'PHB 2024 "Lantern, Bullseye" (L10214); weight/cost L9964',
  },
  oil: {
    id: 'oil',
    name: 'Oil',
    kind: 'gear',
    weightLb: 1,
    costGp: 0.1, // 1 SP
    description: 'Attack action: replace one attack to throw a flask at a target within 20 ft; Dex save (DC 8 + Dex mod + PB) or covered in oil (takes +5 Fire damage if it takes Fire damage before the oil dries after 1 min). Utilize action: pour on level ground over a 5-ft square within 5 ft; if lit, deals 5 Fire damage (once per turn) to a creature entering or ending there. As fuel, a flask burns 6 hours in a Lamp or Lantern.',
    srd: false,
    source: 'PHB 2024 "Oil" (L10251); weight/cost L9970',
  },
  rations: {
    id: 'rations',
    name: 'Rations',
    kind: 'gear',
    weightLb: 2,
    costGp: 0.5, // 5 SP
    description: 'A day of dry travel food (jerky, dried fruit, hardtack, nuts).',
    srd: false,
    source: 'PHB 2024 "Rations" (L10301); weight/cost L9984',
  },
  rope: {
    id: 'rope',
    name: 'Rope',
    kind: 'gear',
    weightLb: 5,
    costGp: 1,
    description: '50 feet of rope; tie a knot on a DC 10 Dex (Sleight of Hand) check, burst it on a DC 20 Str (Athletics) check.',
    srd: false,
    source: 'PHB 2024 "Rope" (L10313); weight/cost L9985',
  },
  tinderbox: {
    id: 'tinderbox',
    name: 'Tinderbox',
    kind: 'gear',
    weightLb: 1,
    costGp: 0.5, // 5 SP
    description: 'Flint, steel, and tinder. Lighting a Candle, Lamp, Lantern, or Torch takes a Bonus Action; lighting any other fire takes 1 minute.',
    srd: false,
    source: 'PHB 2024 "Tinderbox" (L10358); weight/cost L9997',
  },
  torch: {
    id: 'torch',
    name: 'Torch',
    kind: 'gear',
    weightLb: 1,
    costGp: 0.01, // 1 CP
    description: 'Burns for 1 hour, shedding Bright Light in a 20-foot radius (Dim 20 more). With the Attack action you can strike with it as a Simple Melee weapon, dealing 1 Fire damage on a hit.',
    srd: false,
    source: 'PHB 2024 "Torch" (L10362); weight/cost L9998',
  },
  waterskin: {
    id: 'waterskin',
    name: 'Waterskin',
    kind: 'gear',
    weightLb: 5, // PHB '5 lb. (full)'
    costGp: 0.2, // 2 SP
    description: 'Holds 4 pints of liquid; weight is for a full skin.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9999: Waterskin, 5 lb. (full), 2 SP)',
  },
  quiver: {
    id: 'quiver',
    name: 'Quiver',
    kind: 'gear',
    weightLb: 1,
    costGp: 1,
    description: 'Holds up to 20 arrows.',
    srd: false,
    source: 'PHB 2024 "Quiver" (L10300); weight/cost L9982',
  },
  pouch: {
    id: 'pouch',
    name: 'Pouch',
    kind: 'gear',
    weightLb: 1,
    costGp: 0.5, // 5 SP
    description: 'Holds up to 6 pounds within one-fifth of a cubic foot; used for bullets, needles, or small items.',
    srd: false,
    source: 'PHB 2024 "Pouch" (L9962); weight/cost L9980',
  },
  'case-crossbow-bolt': {
    id: 'case-crossbow-bolt',
    name: 'Case, Crossbow Bolt',
    kind: 'gear',
    weightLb: 1,
    costGp: 1,
    description: 'Holds up to 20 crossbow bolts.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9979: Case, Crossbow Bolt, 1 lb., 1 GP)',
  },
  robe: {
    id: 'robe',
    name: 'Robe',
    kind: 'gear',
    weightLb: 4, // OCR '416.' → 4 lb
    costGp: 1,
    description: 'A garment of vocational or ceremonial significance; some places admit only people wearing a Robe of certain colors or symbols.',
    srd: false,
    source: 'PHB 2024 "Robe" (L10310); weight/cost L9985',
  },
  book: {
    id: 'book',
    name: 'Book',
    kind: 'gear',
    weightLb: 5,
    costGp: 25,
    description: 'Fiction or nonfiction; consulting an accurate nonfiction Book on its topic gives a +5 bonus to Intelligence (Arcana, History, Nature, or Religion) checks about that topic.',
    srd: false,
    source: 'PHB 2024 "Book" (L10044); weight/cost L9973',
  },
  // ── Spellcasting Foci (PHB 2024 focus tables; granted by caster classes) ──
  'component-pouch': {
    id: 'component-pouch',
    name: 'Component Pouch',
    kind: 'gear',
    weightLb: 2, // OCR '216.' → 2 lb
    costGp: 25,
    description: 'A watertight pouch holding the free Material components of your spells.',
    srd: false,
    source: 'PHB 2024 "Adventuring Gear" table (L9987: Component Pouch, 2 lb., 25 GP)',
  },
  spellbook: {
    id: 'spellbook',
    name: 'Spellbook',
    kind: 'gear',
    weightLb: 3, // PHB 2024 "Wizard: Spellbook": a Tiny object weighing 3 lb.
    // The PHB gives the Spellbook a 3 lb. weight but NO purchase price (it is
    // granted to Wizards), so `costGp` is OMITTED and `unpriced` is set rather
    // than inventing `costGp: 0`, which would wrongly mean "free" (finding #3 /
    // rules-compliance rule 1).
    unpriced: true,
    description: 'A Wizard\u2019s unique 100-page book of scribed spells; usable as a Spellcasting Focus and readable only by you (or via Identify).',
    srd: false,
    source: 'PHB 2024 "Wizard: Spellbook" (L7404): Tiny object, weighs 3 lb.',
  },
  // Arcane Focus variants (PHB 2024 "Arcane Focuses" table, L10012-L10016).
  'arcane-focus-crystal': {
    id: 'arcane-focus-crystal',
    name: 'Arcane Focus (Crystal)',
    kind: 'gear',
    weightLb: 1,
    costGp: 10,
    description: 'A crystal carved to channel arcane magic; a Spellcasting Focus for Sorcerers, Warlocks, and Wizards.',
    srd: false,
    source: 'PHB 2024 "Arcane Focuses" table (L10012: Crystal, 1 lb., 10 GP)',
  },
  'arcane-focus-orb': {
    id: 'arcane-focus-orb',
    name: 'Arcane Focus (Orb)',
    kind: 'gear',
    weightLb: 3,
    costGp: 20,
    description: 'An orb carved to channel arcane magic; a Spellcasting Focus for Sorcerers, Warlocks, and Wizards.',
    srd: false,
    source: 'PHB 2024 "Arcane Focuses" table (L10013: Orb, 3 lb., 20 GP)',
  },
  'arcane-focus-rod': {
    id: 'arcane-focus-rod',
    name: 'Arcane Focus (Rod)',
    kind: 'gear',
    weightLb: 2,
    costGp: 10,
    description: 'A rod carved to channel arcane magic; a Spellcasting Focus for Sorcerers, Warlocks, and Wizards.',
    srd: false,
    source: 'PHB 2024 "Arcane Focuses" table (L10014: Rod, 2 lb., 10 GP)',
  },
  'arcane-focus-staff': {
    id: 'arcane-focus-staff',
    name: 'Arcane Focus (Staff)',
    kind: 'gear',
    weightLb: 4,
    costGp: 5,
    description: 'A staff (also a Quarterstaff) carved to channel arcane magic; a Spellcasting Focus for Sorcerers, Warlocks, and Wizards.',
    srd: false,
    source: 'PHB 2024 "Arcane Focuses" table (L10015: Staff, 4 lb., 5 GP)',
  },
  'arcane-focus-wand': {
    id: 'arcane-focus-wand',
    name: 'Arcane Focus (Wand)',
    kind: 'gear',
    weightLb: 1,
    costGp: 10,
    description: 'A wand carved to channel arcane magic; a Spellcasting Focus for Sorcerers, Warlocks, and Wizards.',
    srd: false,
    source: 'PHB 2024 "Arcane Focuses" table (L10016: Wand, 1 lb., 10 GP)',
  },
  // Druidic Focus variants (PHB 2024 "Druidic Focuses" table, L10130-L10133).
  'druidic-focus-sprig': {
    id: 'druidic-focus-sprig',
    name: 'Druidic Focus (Sprig of Mistletoe)',
    kind: 'gear',
    weightLb: 0, // PHB lists no weight → 0
    costGp: 1,
    description: 'A sprig of mistletoe to channel primal magic; a Spellcasting Focus for Druids and Rangers.',
    srd: false,
    source: 'PHB 2024 "Druidic Focuses" table (L10131: Sprig of mistletoe, —, 1 GP)',
  },
  'druidic-focus-staff': {
    id: 'druidic-focus-staff',
    name: 'Druidic Focus (Wooden Staff)',
    kind: 'gear',
    weightLb: 4,
    costGp: 5,
    description: 'A wooden staff (also a Quarterstaff) to channel primal magic; a Spellcasting Focus for Druids and Rangers.',
    srd: false,
    source: 'PHB 2024 "Druidic Focuses" table (L10132: Wooden staff, 4 lb., 5 GP)',
  },
  'druidic-focus-yew-wand': {
    id: 'druidic-focus-yew-wand',
    name: 'Druidic Focus (Yew Wand)',
    kind: 'gear',
    weightLb: 1,
    costGp: 10,
    description: 'A yew wand to channel primal magic; a Spellcasting Focus for Druids and Rangers.',
    srd: false,
    source: 'PHB 2024 "Druidic Focuses" table (L10133: Yew wand, 1 lb., 10 GP)',
  },
  // Holy Symbol variants (PHB 2024 "Holy Symbols" table, L10170-L10172).
  'holy-symbol-amulet': {
    id: 'holy-symbol-amulet',
    name: 'Holy Symbol (Amulet)',
    kind: 'gear',
    weightLb: 1,
    costGp: 5,
    description: 'A bejeweled or painted amulet (worn or held) to channel divine magic; a Spellcasting Focus for Clerics and Paladins.',
    srd: false,
    source: 'PHB 2024 "Holy Symbols" table (L10170: Amulet, 1 lb., 5 GP)',
  },
  'holy-symbol-emblem': {
    id: 'holy-symbol-emblem',
    name: 'Holy Symbol (Emblem)',
    kind: 'gear',
    weightLb: 0, // PHB lists no weight (borne on fabric or a Shield) → 0
    costGp: 5,
    description: 'An emblem borne on fabric or a Shield to channel divine magic; a Spellcasting Focus for Clerics and Paladins.',
    srd: false,
    source: 'PHB 2024 "Holy Symbols" table (L10171: Emblem, —, 5 GP)',
  },
  'holy-symbol-reliquary': {
    id: 'holy-symbol-reliquary',
    name: 'Holy Symbol (Reliquary)',
    kind: 'gear',
    weightLb: 2,
    costGp: 5,
    description: 'A held reliquary to channel divine magic; a Spellcasting Focus for Clerics and Paladins.',
    srd: false,
    source: 'PHB 2024 "Holy Symbols" table (L10172: Reliquary, 2 lb., 5 GP)',
  },
  // ── Common Tools (PHB 2024 "Tools" entries, L9662-L9918) ──────────────────
  'thieves-tools': {
    id: 'thieves-tools',
    name: "Thieves' Tools",
    kind: 'tool',
    weightLb: 1,
    costGp: 25,
    description: 'A Dexterity tool used to pick a lock (DC 15) or disarm a trap (DC 15).',
    srd: false,
    source: 'PHB 2024 "Thieves\' Tools" (L9916): 25 GP, Weight 1 lb.',
  },
  'herbalism-kit': {
    id: 'herbalism-kit',
    name: 'Herbalism Kit',
    kind: 'tool',
    weightLb: 3,
    costGp: 5,
    description: 'An Intelligence tool to identify plants and craft Antitoxin, Healer\u2019s Kits, and Potions of Healing.',
    srd: false,
    source: 'PHB 2024 "Herbalism Kit" (L9880): 5 GP, Weight 3 lb.',
  },
  'smiths-tools': {
    id: 'smiths-tools',
    name: "Smith's Tools",
    kind: 'tool',
    weightLb: 8,
    costGp: 20,
    description: "Artisan's Tools (Strength); Utilize: pry open a door or container (DC 20). Forges metal weapons and armor.",
    srd: false,
    source: 'PHB 2024 "Smith\'s Tools" (L9800): 20 GP, Weight 8 lb.',
  },
  'carpenters-tools': {
    id: 'carpenters-tools',
    name: "Carpenter's Tools",
    kind: 'tool',
    weightLb: 6,
    costGp: 8,
    description: "Artisan's Tools (Strength); Utilize: seal or pry open a door or container (DC 20).",
    srd: false,
    source: 'PHB 2024 "Carpenter\'s Tools" (L9704): 8 GP, Weight 6 lb.',
  },
  'navigators-tools': {
    id: 'navigators-tools',
    name: "Navigator's Tools",
    kind: 'tool',
    weightLb: 2,
    costGp: 25,
    description: 'A Wisdom tool to plot a course or determine position by stargazing.',
    srd: false,
    source: 'PHB 2024 "Navigator\'s Tools" (L9900): 25 GP, Weight 2 lb.',
  },
  // ── Artisan's Tools variants (PHB 2024 "Artisan's Tools", L9662-L9862) ─────
  // The full legal Artisan's Tools category, so a class/background grant of
  // "Artisan's Tools" resolves every option to a real catalog entry (finding
  // #3). Carpenter's/Smith's are declared above with the common tools; the rest
  // follow here. Each requires a separate proficiency (PHB L9664).
  'alchemists-supplies': {
    id: 'alchemists-supplies',
    name: "Alchemist's Supplies",
    kind: 'tool',
    weightLb: 8,
    costGp: 50,
    description: "Artisan's Tools (Intelligence); Utilize: identify a substance (DC 15) or start a fire (DC 15).",
    srd: false,
    source: 'PHB 2024 "Alchemist\'s Supplies" (L9667): 50 GP, Weight 8 lb.',
  },
  'brewers-supplies': {
    id: 'brewers-supplies',
    name: "Brewer's Supplies",
    kind: 'tool',
    weightLb: 9,
    costGp: 20,
    description: "Artisan's Tools (Intelligence); Utilize: detect poisoned drink (DC 15) or identify alcohol (DC 10).",
    srd: false,
    source: 'PHB 2024 "Brewer\'s Supplies" (L9683): 20 GP, Weight 9 lb.',
  },
  'calligraphers-supplies': {
    id: 'calligraphers-supplies',
    name: "Calligrapher's Supplies",
    kind: 'tool',
    weightLb: 5,
    costGp: 10,
    description: "Artisan's Tools (Dexterity); Utilize: write flourished text that guards against forgery (DC 15).",
    srd: false,
    source: 'PHB 2024 "Calligrapher\'s Supplies" (L9693): 10 GP, Weight 5 lb.',
  },
  'cartographers-tools': {
    id: 'cartographers-tools',
    name: "Cartographer's Tools",
    kind: 'tool',
    weightLb: 6,
    costGp: 15,
    description: "Artisan's Tools (Wisdom); Utilize: draft a map of a small area (DC 15).",
    srd: false,
    source: 'PHB 2024 "Cartographer\'s Tools" (L9711): 15 GP, Weight 6 lb.',
  },
  'cobblers-tools': {
    id: 'cobblers-tools',
    name: "Cobbler's Tools",
    kind: 'tool',
    weightLb: 5,
    costGp: 5,
    description: "Artisan's Tools (Dexterity); Utilize: modify footwear to give Advantage on the wearer's next Dexterity (Acrobatics) check (DC 10).",
    srd: false,
    source: 'PHB 2024 "Cobbler\'s Tools" (L9719): 5 GP, Weight 5 lb.',
  },
  'cooks-utensils': {
    id: 'cooks-utensils',
    name: "Cook's Utensils",
    kind: 'tool',
    weightLb: 8,
    costGp: 1,
    description: "Artisan's Tools (Wisdom); Utilize: improve food's flavor (DC 10) or detect spoiled or poisoned food (DC 15).",
    srd: false,
    source: 'PHB 2024 "Cook\'s Utensils" (L9727): 1 GP, Weight 8 lb.',
  },
  'glassblowers-tools': {
    id: 'glassblowers-tools',
    name: "Glassblower's Tools",
    kind: 'tool',
    weightLb: 5,
    costGp: 30,
    description: "Artisan's Tools (Intelligence); Utilize: discern what a glass object held in the past 24 hours (DC 15).",
    srd: false,
    source: 'PHB 2024 "Glassblower\'s Tools" (L9739): 30 GP, Weight 5 lb.',
  },
  'jewelers-tools': {
    id: 'jewelers-tools',
    name: "Jeweler's Tools",
    kind: 'tool',
    weightLb: 2,
    costGp: 25,
    description: "Artisan's Tools (Intelligence); Utilize: discern a gem's value (DC 15).",
    srd: false,
    source: 'PHB 2024 "Jeweler\'s Tools" (L9747): 25 GP, Weight 2 lb.',
  },
  'leatherworkers-tools': {
    id: 'leatherworkers-tools',
    name: "Leatherworker's Tools",
    kind: 'tool',
    weightLb: 5,
    costGp: 5,
    description: "Artisan's Tools (Dexterity); Utilize: add a design to a leather item (DC 10).",
    srd: false,
    source: 'PHB 2024 "Leatherworker\'s Tools" (L9757): 5 GP, Weight 5 lb.',
  },
  'masons-tools': {
    id: 'masons-tools',
    name: "Mason's Tools",
    kind: 'tool',
    weightLb: 8,
    costGp: 10,
    description: "Artisan's Tools (Strength); Utilize: chisel a symbol or hole in stone (DC 10).",
    srd: false,
    source: 'PHB 2024 "Mason\'s Tools" (L9773): 10 GP, Weight 8 lb.',
  },
  'painters-supplies': {
    id: 'painters-supplies',
    name: "Painter's Supplies",
    kind: 'tool',
    weightLb: 5,
    costGp: 10,
    description: "Artisan's Tools (Wisdom); Utilize: paint a recognizable image of something you've seen (DC 10).",
    srd: false,
    source: 'PHB 2024 "Painter\'s Supplies" (L9781): 10 GP, Weight 5 lb.',
  },
  'potters-tools': {
    id: 'potters-tools',
    name: "Potter's Tools",
    kind: 'tool',
    weightLb: 3,
    costGp: 10,
    description: "Artisan's Tools (Intelligence); Utilize: discern what a ceramic object held in the past 24 hours (DC 15).",
    srd: false,
    source: 'PHB 2024 "Potter\'s Tools" (L9789): 10 GP, Weight 3 lb.',
  },
  'tinkers-tools': {
    id: 'tinkers-tools',
    name: "Tinker's Tools",
    kind: 'tool',
    weightLb: 10,
    costGp: 50,
    description: "Artisan's Tools (Dexterity); Utilize: assemble a Tiny item of scrap that falls apart in 1 minute (DC 20).",
    srd: false,
    source: 'PHB 2024 "Tinker\'s Tools" (L9820): 50 GP, Weight 10 lb.',
  },
  'weavers-tools': {
    id: 'weavers-tools',
    name: "Weaver's Tools",
    kind: 'tool',
    weightLb: 5,
    costGp: 1,
    description: "Artisan's Tools (Dexterity); Utilize: mend a tear in clothing (DC 10) or sew a Tiny design (DC 10).",
    srd: false,
    source: 'PHB 2024 "Weaver\'s Tools" (L9828): 1 GP, Weight 5 lb.',
  },
  'woodcarvers-tools': {
    id: 'woodcarvers-tools',
    name: "Woodcarver's Tools",
    kind: 'tool',
    weightLb: 5,
    costGp: 1,
    description: "Artisan's Tools (Dexterity); Utilize: carve a pattern in wood (DC 10).",
    srd: false,
    source: 'PHB 2024 "Woodcarver\'s Tools" (L9836): 1 GP, Weight 5 lb.',
  },
  'disguise-kit': {
    id: 'disguise-kit',
    name: 'Disguise Kit',
    kind: 'tool',
    // 3 lb: the OCR interleaves "Weight: 3 lb." (Disguise) and "Weight: 5 lb."
    // (Forgery Kit) between the two entries. Verified against the official 2024
    // listing (D&D Beyond / SRD dd2024.fr ≈ 1.5 kg): Disguise Kit = 3 lb,
    // Forgery Kit = 5 lb.
    weightLb: 3,
    costGp: 25,
    description: 'A Charisma tool used to apply makeup (DC 10) and craft costumes.',
    srd: false,
    source: 'PHB 2024 "Disguise Kit" (L9852): 25 GP, Weight 3 lb. (verified; see comment)',
  },
  // Musical Instrument variants (PHB 2024 "Musical Instrument" (L9890-L9896)).
  // A Bard can use any of these as a Spellcasting Focus.
  'instrument-bagpipes': {
    id: 'instrument-bagpipes',
    name: 'Bagpipes',
    kind: 'tool',
    weightLb: 6,
    costGp: 30,
    description: 'A musical instrument; a Bard can use it as a Spellcasting Focus.',
    srd: false,
    source: 'PHB 2024 "Musical Instrument" variants (L9896: Bagpipes, 30 GP, 6 lb.)',
  },
  'instrument-drum': {
    id: 'instrument-drum',
    name: 'Drum',
    kind: 'tool',
    weightLb: 3,
    costGp: 6,
    description: 'A musical instrument; a Bard can use it as a Spellcasting Focus.',
    srd: false,
    source: 'PHB 2024 "Musical Instrument" variants (L9896: drum, 6 GP, 3 lb.)',
  },
  'instrument-dulcimer': {
    id: 'instrument-dulcimer',
    name: 'Dulcimer',
    kind: 'tool',
    weightLb: 10,
    costGp: 25,
    description: 'A musical instrument; a Bard can use it as a Spellcasting Focus.',
    srd: false,
    source: 'PHB 2024 "Musical Instrument" variants (L9896: dulcimer, 25 GP, 10 lb.)',
  },
  'instrument-flute': {
    id: 'instrument-flute',
    name: 'Flute',
    kind: 'tool',
    weightLb: 1,
    costGp: 2,
    description: 'A musical instrument; a Bard can use it as a Spellcasting Focus.',
    srd: false,
    source: 'PHB 2024 "Musical Instrument" variants (L9896: flute, 2 GP, 1 lb.)',
  },
  'instrument-horn': {
    id: 'instrument-horn',
    name: 'Horn',
    kind: 'tool',
    weightLb: 2,
    costGp: 3,
    description: 'A musical instrument; a Bard can use it as a Spellcasting Focus.',
    srd: false,
    source: 'PHB 2024 "Musical Instrument" variants (L9896: horn, 3 GP, 2 lb.)',
  },
  'instrument-lute': {
    id: 'instrument-lute',
    name: 'Lute',
    kind: 'tool',
    weightLb: 2,
    costGp: 35,
    description: 'A musical instrument; a Bard can use it as a Spellcasting Focus.',
    srd: false,
    source: 'PHB 2024 "Musical Instrument" variants (L9896: lute, 35 GP, 2 lb.)',
  },
  'instrument-lyre': {
    id: 'instrument-lyre',
    name: 'Lyre',
    kind: 'tool',
    weightLb: 2,
    costGp: 30,
    description: 'A musical instrument; a Bard can use it as a Spellcasting Focus.',
    srd: false,
    source: 'PHB 2024 "Musical Instrument" variants (L9896: lyre, 30 GP, 2 lb.)',
  },
  'instrument-pan-flute': {
    id: 'instrument-pan-flute',
    name: 'Pan Flute',
    kind: 'tool',
    weightLb: 2,
    costGp: 12,
    description: 'A musical instrument; a Bard can use it as a Spellcasting Focus.',
    srd: false,
    source: 'PHB 2024 "Musical Instrument" variants (L9896: pan flute, 12 GP, 2 lb.)',
  },
  'instrument-shawm': {
    id: 'instrument-shawm',
    name: 'Shawm',
    kind: 'tool',
    weightLb: 1,
    costGp: 2,
    description: 'A musical instrument; a Bard can use it as a Spellcasting Focus.',
    srd: false,
    source: 'PHB 2024 "Musical Instrument" variants (L9896: shawm, 2 GP, 1 lb.)',
  },
  'instrument-viol': {
    id: 'instrument-viol',
    name: 'Viol',
    kind: 'tool',
    weightLb: 1,
    costGp: 30,
    description: 'A musical instrument; a Bard can use it as a Spellcasting Focus.',
    srd: false,
    source: 'PHB 2024 "Musical Instrument" variants (L9896: viol, 30 GP, 1 lb.)',
  },
};

/** All equipment as a flat array, in declaration order. */
export const EQUIPMENT_LIST: EquipmentData[] = Object.values(EQUIPMENT_CATALOG);

/** A catalog key for a known equipment item. */
export type EquipmentId = keyof typeof EQUIPMENT_CATALOG;

/** Look up an equipment item by id (undefined if unknown). */
export function getEquipment(id: string): EquipmentData | undefined {
  return Object.prototype.hasOwnProperty.call(EQUIPMENT_CATALOG, id)
    ? EQUIPMENT_CATALOG[id]
    : undefined;
}

/**
 * AMMUNITION UNIT CONTRACT (review finding #1 — pinned ONCE here for A2).
 * -----------------------------------------------------------------------
 * The persisted unit model is: `InventoryItem.quantity` on an ammunition stack
 * counts INDIVIDUAL PIECES (e.g. 20 Arrows → quantity 20), NOT bundles. The
 * catalog stores `weightLb` and `costGp` PER BUNDLE of `packageSize` pieces
 * (PHB 2024 "Ammunition" table, L9962-9966: Arrows 20 @ 1 lb / 1 GP, etc.).
 *
 * This single helper is the ONE sanctioned way to turn a piece count into the
 * effective weight and value of the stack, so A2's encumbrance/currency math
 * never multiplies a bundle weight by the piece count. The model is
 * PROPORTIONAL (per-piece = bundle ÷ packageSize), so a 20-arrow grant weighs
 * exactly 1 lb and is worth exactly 1 GP (not 20×). For a non-ammunition item
 * (no `packageSize`), weight/value are simply the per-item value × quantity,
 * and an `unpriced` item contributes 0 value (its price is unknown, not free —
 * callers that need to distinguish can read `data.unpriced`).
 */
export interface EffectiveStack {
  /** Total weight in pounds for the given piece count. */
  weightLb: number;
  /** Total value in gold pieces; 0 for an unpriced item (price unknown). */
  valueGp: number;
}

export function effectiveStack(data: EquipmentData, quantity: number): EffectiveStack {
  const qty = quantity > 0 ? quantity : 0;
  if (data.packageSize && data.packageSize > 0) {
    // Ammunition: proportional per-piece weight/value = bundle ÷ packageSize.
    const perPieceWeight = data.weightLb / data.packageSize;
    const perPieceValue = (data.costGp ?? 0) / data.packageSize;
    return {
      weightLb: perPieceWeight * qty,
      valueGp: perPieceValue * qty,
    };
  }
  // Non-ammunition: per-item weight/value × quantity (unpriced → 0 value).
  return {
    weightLb: data.weightLb * qty,
    valueGp: (data.costGp ?? 0) * qty,
  };
}
