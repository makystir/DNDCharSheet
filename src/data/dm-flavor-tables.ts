/**
 * Word lists for the Dungeon Master's tavern and shop name generators.
 *
 * These are flavor written for this app. They are not from any rulebook and
 * carry no rules: a name is only a name. The books list no tavern or shop name
 * tables, so there is nothing here to check against them.
 */

export const TAVERN_ADJECTIVES: readonly string[] = [
  'Gilded', 'Rusty', 'Drowsy', 'Laughing', 'Crooked', 'Silver', 'Broken', 'Merry', 'Wandering', 'Sleeping',
  'Golden', 'Weary', 'Hollow', 'Thirsty', 'Bright', 'Dusty', 'Smiling', 'Grim', 'Hidden', 'Roaring',
  'Lucky', 'Old', 'Last', 'Hungry', 'Mossy', 'Copper', 'Singing', 'Fallen', 'Tipsy', 'Scarlet',
];

export const TAVERN_NOUNS: readonly string[] = [
  'Lantern', 'Anchor', 'Stag', 'Flagon', 'Wheel', 'Crown', 'Boar', 'Barrel', 'Raven', 'Kettle',
  'Hearth', 'Compass', 'Dragon', 'Fox', 'Goblet', 'Bridge', 'Oak', 'Pony', 'Candle', 'Plough',
  'Lamb', 'Harp', 'Keg', 'Horn', 'Swan', 'Mill', 'Cask', 'Key', 'Bell', 'Owl',
];

/** Second nouns for "The Stag and Lantern" style names. */
export const TAVERN_PAIRS: readonly string[] = [
  'Stag and Lantern', 'Hammer and Tongs', 'Fox and Hound', 'Crown and Anchor', 'Cup and Candle',
  'Plough and Star', 'Raven and Rose', 'Bell and Barrel', 'Oak and Ivy', 'Key and Kettle',
];

export interface ShopType {
  id: string;
  label: string;
  /** Things the shop is called: "the Smithy". */
  nouns: readonly string[];
  /** Words that fit this kind of trade in "The Adjective Noun" names. */
  words: readonly string[];
}

export const SHOP_TYPES: readonly ShopType[] = [
  { id: 'general', label: 'General store', nouns: ['General Store', 'Trading Post', 'Supply'], words: ['Goods', 'Wares', 'Provisions', 'Bundle', 'Pack'] },
  { id: 'smith', label: 'Blacksmith', nouns: ['Smithy', 'Forge', 'Ironworks'], words: ['Anvil', 'Hammer', 'Bellows', 'Ember', 'Iron'] },
  { id: 'apothecary', label: 'Apothecary', nouns: ['Apothecary', 'Remedies', 'Herbalist'], words: ['Mortar', 'Pestle', 'Thistle', 'Vial', 'Root'] },
  { id: 'armorer', label: 'Armorer', nouns: ['Armory', 'Armorer', 'Plate and Mail'], words: ['Shield', 'Helm', 'Gauntlet', 'Buckle', 'Plate'] },
  { id: 'weapons', label: 'Weaponsmith', nouns: ['Arms', 'Blades', 'Armament'], words: ['Edge', 'Whetstone', 'Pommel', 'Quiver', 'Sabre'] },
  { id: 'tailor', label: 'Tailor', nouns: ['Tailor', 'Haberdashery', 'Dyeworks'], words: ['Thimble', 'Needle', 'Spindle', 'Bolt', 'Thread'] },
  { id: 'books', label: 'Bookseller', nouns: ['Books', 'Scriptorium', 'Bindery'], words: ['Quill', 'Folio', 'Page', 'Inkwell', 'Scroll'] },
  { id: 'baker', label: 'Baker', nouns: ['Bakery', 'Oven', 'Pie House'], words: ['Crust', 'Loaf', 'Sheaf', 'Rolling Pin', 'Wheat'] },
  { id: 'stable', label: 'Stable', nouns: ['Stables', 'Livery', 'Paddock'], words: ['Saddle', 'Bridle', 'Hoof', 'Horseshoe', 'Mane'] },
  { id: 'curios', label: 'Curios and oddities', nouns: ['Curios', 'Oddments', 'Emporium'], words: ['Trinket', 'Relic', 'Whatnot', 'Marvel', 'Keepsake'] },
  { id: 'jeweler', label: 'Jeweler', nouns: ['Jewelers', 'Gemcutter', 'Settings'], words: ['Gem', 'Facet', 'Signet', 'Pendant', 'Opal'] },
  { id: 'fletcher', label: 'Fletcher and bowyer', nouns: ['Fletcher', 'Bowyer', 'Archery'], words: ['Arrow', 'Fletching', 'Bowstring', 'Nock', 'Yew'] },
];

export const SHOP_ADJECTIVES: readonly string[] = [
  'Honest', 'Fine', 'Humble', 'Dependable', 'Prosperous', 'Quick', 'Careful', 'Famous', 'Cheerful', 'Reliable',
  'Steady', 'Clever', 'Fair', 'Tidy', 'Skilled',
];
