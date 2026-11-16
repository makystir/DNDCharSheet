/**
 * Treasure tables from the Dungeon Master's Guide 2024, chapter 4 "Adventure
 * Rewards" and chapter 7 "Treasure" (Docs/DungeonMastersGuide.md).
 *
 * The Markdown copy is an OCR scan, and there is no DMG page image in Docs, so
 * every figure below was checked a second way:
 *  - Each Individual and Hoard row carries the average the book prints in
 *    parentheses. dm-treasure.test.ts checks that the dice really average to it.
 *  - Gem and art tables must hold exactly one entry per die face.
 *
 * READINGS TO CONFIRM against the printed book (the scan is unclear here):
 *  - Hoard CR 11-16 money: the scan prints "8d8 x 10,000 (36,000) GP", but 8d8
 *    averages 36, so 36,000 means x 1,000. The printed average is used.
 *  - Hoard CR 5-10 magic items: the scan prints "13". Read as "1d3", which sits
 *    between the rows either side (1d4-1 and 1d4).
 *  - Art object names had a few scan typos ("Slver evver", "jeweiry"), corrected
 *    to the obvious words.
 */

export interface DiceSpec {
  count: number;
  sides: number;
  /** Added to the dice total before multiplying. */
  plus: number;
  /** The dice total is multiplied by this. */
  times: number;
}

export type CoinKind = 'GP' | 'PP';

/** Platinum Piece = 10 GP (PHB 2024 "Coins", Docs/PlayersHandbook.md L9276). */
export const COIN_VALUE_GP: Record<CoinKind, number> = { GP: 1, PP: 10 };

export interface IndividualRow {
  /** Challenge Rating range this row covers (inclusive). */
  min: number;
  max: number;
  label: string;
  dice: DiceSpec;
  coin: CoinKind;
  /** The average the book prints in parentheses. */
  printedAverage: number;
}

/** "Random Individual Treasure" (DMG 2024 L4879-4889). */
export const INDIVIDUAL_TREASURE: readonly IndividualRow[] = [
  { min: 0, max: 4, label: 'CR 0-4', dice: { count: 3, sides: 6, plus: 0, times: 1 }, coin: 'GP', printedAverage: 10 },
  { min: 5, max: 10, label: 'CR 5-10', dice: { count: 2, sides: 8, plus: 0, times: 10 }, coin: 'GP', printedAverage: 90 },
  { min: 11, max: 16, label: 'CR 11-16', dice: { count: 2, sides: 10, plus: 0, times: 10 }, coin: 'PP', printedAverage: 110 },
  { min: 17, max: 30, label: 'CR 17+', dice: { count: 2, sides: 8, plus: 0, times: 100 }, coin: 'PP', printedAverage: 900 },
];

export interface HoardRow {
  min: number;
  max: number;
  label: string;
  /** Monetary treasure, in GP. */
  dice: DiceSpec;
  printedAverage: number;
  /** How many magic items the hoard holds. */
  magicItems: DiceSpec;
  /** The text as printed or read, for display. */
  magicItemsText: string;
}

/** "Random Treasure Hoard" (DMG 2024 L4899-4908). See the READINGS note above. */
export const HOARD_TREASURE: readonly HoardRow[] = [
  {
    min: 0,
    max: 4,
    label: 'CR 0-4',
    dice: { count: 2, sides: 4, plus: 0, times: 100 },
    printedAverage: 500,
    magicItems: { count: 1, sides: 4, plus: -1, times: 1 },
    magicItemsText: '1d4 - 1',
  },
  {
    min: 5,
    max: 10,
    label: 'CR 5-10',
    dice: { count: 8, sides: 10, plus: 0, times: 100 },
    printedAverage: 4400,
    magicItems: { count: 1, sides: 3, plus: 0, times: 1 },
    magicItemsText: '1d3',
  },
  {
    min: 11,
    max: 16,
    label: 'CR 11-16',
    dice: { count: 8, sides: 8, plus: 0, times: 1000 },
    printedAverage: 36000,
    magicItems: { count: 1, sides: 4, plus: 0, times: 1 },
    magicItemsText: '1d4',
  },
  {
    min: 17,
    max: 30,
    label: 'CR 17+',
    dice: { count: 6, sides: 10, plus: 0, times: 10000 },
    printedAverage: 330000,
    magicItems: { count: 1, sides: 6, plus: 0, times: 1 },
    magicItemsText: '1d6',
  },
];

// ------------------------------------------------------------------ gems and art

export interface ValueTable {
  /** Value of each item, in GP. */
  value: number;
  /** One name per face of the die, in order. */
  items: readonly string[];
}

/** Gemstones by value (DMG 2024 L7954-8040). */
export const GEMSTONES: readonly ValueTable[] = [
  {
    value: 10,
    items: [
      'Azurite (mottled deep blue)',
      'Banded agate (striped brown, blue, white, or red)',
      'Blue quartz (pale blue)',
      'Eye agate (circles of gray, white, brown, blue, or green)',
      'Hematite (gray black)',
      'Lapis lazuli (light and dark blue with yellow flecks)',
      'Malachite (striated light and dark green)',
      'Moss agate (pink or yellow white with mossy gray or green markings)',
      'Obsidian (black)',
      'Rhodochrosite (light pink)',
      'Tiger eye (brown with golden center)',
      'Turquoise (light blue green)',
    ],
  },
  {
    value: 50,
    items: [
      'Bloodstone (dark gray with red flecks)',
      'Carnelian (orange to red brown)',
      'Chalcedony (white)',
      'Chrysoprase (green)',
      'Citrine (pale yellow brown)',
      'Jasper (blue, black, or brown)',
      'Moonstone (white with pale-blue glow)',
      'Onyx (bands of black and white, or pure black or white)',
      'Quartz (white, smoky gray, or yellow)',
      'Sardonyx (bands of red and white)',
      'Star rose quartz (rosy stone with white star-shaped center)',
      'Zircon (pale blue green)',
    ],
  },
  {
    value: 100,
    items: [
      'Amber (watery gold to rich gold)',
      'Amethyst (deep purple)',
      'Chrysoberyl (yellow green to pale green)',
      'Coral (crimson)',
      'Garnet (red, brown green, or violet)',
      'Jade (light green, deep green, or white)',
      'Jet (deep black)',
      'Pearl (lustrous white, yellow, or pink)',
      'Spinel (red, red brown, or deep green)',
      'Tourmaline (pale green, blue, brown, or red)',
    ],
  },
  {
    value: 500,
    items: [
      'Alexandrite (dark green)',
      'Aquamarine (pale blue green)',
      'Black pearl (pure black)',
      'Blue spinel (deep blue)',
      'Peridot (rich olive green)',
      'Topaz (golden yellow)',
    ],
  },
  {
    value: 1000,
    items: [
      'Black opal (dark green with black mottling and golden flecks)',
      'Blue sapphire (medium blue)',
      'Emerald (deep bright green)',
      'Fire opal (fiery red)',
      'Opal (pale blue with green and golden mottling)',
      'Star ruby (ruby with white star-shaped center)',
      'Star sapphire (blue sapphire with white star-shaped center)',
      'Yellow sapphire (fiery yellow or yellow green)',
    ],
  },
  {
    value: 5000,
    items: [
      'Black sapphire (lustrous black with glowing highlights)',
      'Diamond (blue white, canary, pink, brown, or blue)',
      'Jacinth (fiery orange)',
      'Ruby (clear red to deep crimson)',
    ],
  },
];

/** Art objects by value (DMG 2024 L8259-8370). Each table is a d10. */
export const ART_OBJECTS: readonly ValueTable[] = [
  {
    value: 25,
    items: [
      'Silver ewer',
      'Carved bone statuette',
      'Gold bracelet',
      'Cloth-of-gold vestments',
      'Black velvet mask stitched with silver thread',
      'Copper chalice with silver filigree',
      'Pair of engraved bone dice',
      'Handheld mirror set in a painted wooden frame',
      'Embroidered silk handkerchief',
      'Gold locket with a painted portrait inside',
    ],
  },
  {
    value: 250,
    items: [
      'Gold ring set with bloodstones',
      'Carved ivory statuette',
      'Bejeweled gold bracelet',
      'Silver necklace with a gemstone pendant',
      'Bronze crown',
      'Silk vestments with gold embroidery',
      'Well-made tapestry that is 10 feet by 10 feet',
      'Brass mug with jade inlay',
      'Box of turquoise animal figurines',
      'Gold birdcage with electrum filigree',
    ],
  },
  {
    value: 750,
    items: [
      'Silver chalice set with moonstones',
      'Bundle of sheet music representing the lost dirges of a famous composer',
      'Carved wooden harp with ivory inlay and zircon gems',
      'Gold idol',
      'Gold comb shaped like a dragon with red garnets as eyes',
      'Bottle stopper cork embossed with gold leaf and set with amethysts',
      'Detailed, life-sized dragonborn skull cast in electrum',
      'Silver and gold brooch',
      'Obsidian statuette with gold fittings and inlay',
      'Painted gold war mask',
    ],
  },
  {
    value: 2500,
    items: [
      'Fine gold chain set with a fire opal',
      'Old masterpiece painting',
      'Embroidered silk and velvet mantle set with numerous moonstones',
      'Platinum bracelet set with an emerald',
      'Embroidered glove set with jewel chips',
      'Jeweled anklet',
      'Gold music box',
      'Gold circlet set with four aquamarines',
      'Eye patch decorated with tiny blue sapphires and moonstones',
      'A necklace string of small pink pearls',
    ],
  },
  {
    value: 7500,
    items: [
      'Jeweled gold crown',
      'Jeweled platinum ring',
      'Gold statuette set with rubies',
      'Gold cup set with emeralds',
      'Gold jewelry box with platinum filigree',
      'Set of gold nesting dolls',
      'Jade game board with gold playing pieces',
      'Bejeweled ivory drinking horn with gold filigree',
      'Gilded royal coach or funeral barge',
      'Ceremonial gold armor with black pearls',
    ],
  },
];

// ------------------------------------------------------------------ reference

/** "Trade Bars" (DMG 2024 L7921-7927). Dimensions are not repeated here. */
export const TRADE_BARS: readonly { name: string; valueGp: number }[] = [
  { name: '2-pound silver bar', valueGp: 10 },
  { name: '5-pound silver bar', valueGp: 25 },
  { name: '5-pound gold bar', valueGp: 250 },
];

/** "Trade Goods" (DMG 2024 L7933-7952). Cost in copper pieces for ordering. */
export const TRADE_GOODS: readonly { cost: string; goods: string }[] = [
  { cost: '1 CP', goods: '1 lb. of wheat' },
  { cost: '2 CP', goods: '2 lb. of flour or one chicken' },
  { cost: '5 CP', goods: '1 lb. of salt' },
  { cost: '1 SP', goods: '1 lb. of iron or 1 sq. yd. of canvas' },
  { cost: '5 SP', goods: '1 lb. of copper or 1 sq. yd. of cotton cloth' },
  { cost: '1 GP', goods: '1 lb. of ginger or one goat' },
  { cost: '2 GP', goods: '1 lb. of cinnamon or pepper, or one sheep' },
  { cost: '3 GP', goods: '1 lb. of cloves or one pig' },
  { cost: '5 GP', goods: '1 lb. of silver or 1 sq. yd. of linen' },
  { cost: '10 GP', goods: '1 lb. of silk or one cow' },
  { cost: '15 GP', goods: '1 lb. of saffron or one ox' },
  { cost: '50 GP', goods: '1 lb. of gold' },
  { cost: '500 GP', goods: '1 lb. of platinum' },
];

export type TreasureTheme = 'arcana' | 'armaments' | 'implements' | 'relics';

/** "Treasure Themes" (DMG 2024 L7902-7911). */
export const TREASURE_THEMES: readonly { id: TreasureTheme; name: string; treasure: string }[] = [
  { id: 'arcana', name: 'Arcana', treasure: 'Gemstones plus magic items of an eldritch or esoteric nature' },
  { id: 'armaments', name: 'Armaments', treasure: 'Coins or trade bars plus magic items that are useful in battle' },
  { id: 'implements', name: 'Implements', treasure: 'Coins, trade bars, or trade goods plus magic items that focus on utility' },
  { id: 'relics', name: 'Relics', treasure: 'Art objects plus magic items that have religious origins or purposes' },
];
