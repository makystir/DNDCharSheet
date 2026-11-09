/**
 * Trinkets table (PHB 2024 "Trinkets", Docs/PlayersHandbook.md L2171+). When you
 * make your character you can roll once on this table to gain a Tiny trinket,
 * "a simple item lightly touched by mystery".
 *
 * The markdown copy of the table is scrambled (rows 53-00 are interleaved and
 * several numbers are misread), so rows 53-00 were transcribed from the printed
 * page image and rows 01-52 from the text, then checked as a set: exactly 100
 * entries, one per d100 result. Index 0 is roll 1; the last entry is roll "00"
 * (100).
 */
export const TRINKETS: readonly string[] = [
  // 01-10
  'A mummified goblin hand',
  'A crystal that faintly glows in moonlight',
  'A gold coin minted in an unknown land',
  "A diary written in a language you don't know",
  'A brass ring that never tarnishes',
  'An old chess piece made from glass',
  'A pair of knucklebone dice, each with a skull symbol on the side that would normally show six pips',
  'A small idol depicting a nightmarish creature that gives you unsettling dreams when you sleep near it',
  "A lock of someone's hair",
  'The deed for a parcel of land in a realm unknown to you',
  // 11-20
  'A 1-ounce block made from an unknown material',
  'A small cloth doll skewered with needles',
  'A tooth from an unknown beast',
  'An enormous scale, perhaps from a dragon',
  'A bright-green feather',
  'An old divination card bearing your likeness',
  'A glass orb filled with moving smoke',
  'A 1-pound egg with a bright-red shell',
  'A pipe that blows bubbles',
  'A glass jar containing a bit of flesh floating in pickling fluid',
  // 21-30
  'A gnome-crafted music box that plays a song you dimly remember from your childhood',
  'A wooden statuette of a smug halfling',
  'A brass orb etched with strange runes',
  'A multicolored stone disk',
  'A silver icon of a raven',
  'A bag containing forty-seven teeth, one of which is rotten',
  'A shard of obsidian that always feels warm to the touch',
  "A dragon's talon strung on a leather necklace",
  'A pair of old socks',
  'A blank book whose pages refuse to hold ink, chalk, graphite, or any other marking',
  // 31-40
  'A silver badge that is a five-pointed star',
  'A knife that belonged to a relative',
  'A glass vial filled with nail clippings',
  'A rectangular metal device with two tiny metal cups on one end that throws sparks when wet',
  'A white, sequined glove sized for a human',
  'A vest with one hundred tiny pockets',
  'A weightless stone',
  'A sketch of a goblin',
  'An empty glass vial that smells of perfume',
  'A gemstone that looks like a lump of coal when examined by anyone but you',
  // 41-50
  'A scrap of cloth from an old banner',
  'A rank insignia from a lost legionnaire',
  'A silver bell without a clapper',
  'A mechanical canary inside a lamp',
  'A miniature chest carved to look like it has numerous feet on the bottom',
  'A dead sprite inside a clear glass bottle',
  'A metal can that has no opening but sounds as if it is filled with liquid, sand, spiders, or broken glass (your choice)',
  'A glass orb filled with water, in which swims a clockwork goldfish',
  'A silver spoon with an M engraved on the handle',
  'A whistle made from gold-colored wood',
  // 51-60
  'A dead scarab beetle the size of your hand',
  'Two toy soldiers, one missing a head',
  'A small box filled with different-sized buttons',
  "A candle that can't be lit",
  'A miniature cage with no door',
  'An old key',
  'An indecipherable treasure map',
  'A hilt from a broken sword',
  "A rabbit's foot",
  'A glass eye',
  // 61-70
  'A cameo of a hideous person',
  'A silver skull the size of a coin',
  'An alabaster mask',
  'A cone of sticky black incense that stinks',
  'A nightcap that gives you pleasant dreams when you wear it',
  'A single caltrop made from bone',
  'A gold monocle frame without the lens',
  'A 1-inch cube, each side a different color',
  'A crystal doorknob',
  'A packet filled with pink dust',
  // 71-80
  'A fragment of a beautiful song, written as musical notes on two pieces of parchment',
  'A silver teardrop earring containing a real teardrop',
  'An eggshell painted with scenes of misery in disturbing detail',
  'A fan that, when unfolded, shows a sleepy cat',
  'A set of bone pipes',
  'A four-leaf clover pressed inside a book discussing manners and etiquette',
  'A sheet of parchment upon which is drawn a mechanical contraption',
  'An ornate scabbard that fits no blade you have found',
  'An invitation to a party where a murder happened',
  "A bronze pentacle with an etching of a rat's head in its center",
  // 81-90
  'A purple handkerchief embroidered with the name of an archmage',
  'Half a floor plan for a temple, a castle, or another structure',
  'A bit of folded cloth that, when unfolded, turns into a stylish cap',
  'A receipt of deposit at a bank in a far-off city',
  'A diary with seven missing pages',
  'An empty silver snuffbox bearing the inscription "dreams" on its lid',
  'An iron holy symbol devoted to an unknown god',
  "A book about a legendary hero's rise and fall, with the last chapter missing",
  'A vial of dragon blood',
  'An ancient arrow of elven design',
  // 91-00
  'A needle that never bends',
  'An ornate brooch of dwarven design',
  'An empty wine bottle bearing a pretty label that says, "The Wizard of Wines Winery, Red Dragon Crush, 331422-W"',
  'A mosaic tile with a multicolored, glazed surface',
  'A petrified mouse',
  "A black pirate flag adorned with a dragon's skull and crossbones",
  "A tiny mechanical crab or spider that moves about when it's not being observed",
  'A glass jar containing lard with a label that reads, "Griffon Grease"',
  'A wooden box with a ceramic bottom that holds a living worm with a head on each end of its body',
  'A metal urn containing the ashes of a hero',
];

/** The trinket for a d100 result (1-100; 100 is the printed "00"). */
export function trinketForRoll(roll: number): string | undefined {
  return Number.isInteger(roll) ? TRINKETS[roll - 1] : undefined;
}

/** Rolls a d100 with the injected RNG and returns the result (1-100) and its trinket. */
export function rollTrinket(rng: () => number): { roll: number; text: string } {
  const roll = Math.min(100, Math.floor(rng() * 100) + 1);
  return { roll, text: TRINKETS[roll - 1] };
}
