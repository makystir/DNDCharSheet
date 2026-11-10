/**
 * Deity reference: the major gods of the pantheons most used in 5th edition,
 * from the user-supplied "D&D Deities Reference" (Nov 2026). It covers the
 * Forgotten Realms (greater and lesser gods plus the elemental lords),
 * Greyhawk, the racial and dragon gods, and Dragonlance.
 *
 * Edition note: titles, alignments, symbols and cleric domains follow the 2014
 * Player's Handbook appendix and DMG. The 2024 rules let any cleric choose any
 * domain, so `domains` is flavor only and nothing here changes a game rule. The
 * 2024 DMG's own Greyhawk table lives in `deities.ts` and wins for the names,
 * epithets, home planes, worshipers and symbols of the gods it lists; this file
 * adds alignment, domains and description for them (matched by `loreId`).
 *
 * Alignment codes: L/N/C = lawful/neutral/chaotic, G/E = good/evil, and `N`
 * alone is true neutral.
 */

export type DeityPantheon = 'forgotten-realms' | 'greyhawk' | 'racial' | 'dragonlance';

export const PANTHEON_LABELS: Record<DeityPantheon, string> = {
  'forgotten-realms': 'Forgotten Realms',
  greyhawk: 'Greyhawk',
  racial: 'Racial and dragon gods',
  dragonlance: 'Dragonlance',
};

export type DeityAlignmentCode = 'LG' | 'NG' | 'CG' | 'LN' | 'N' | 'CN' | 'LE' | 'NE' | 'CE';

export const ALIGNMENT_CODE_LABEL: Record<DeityAlignmentCode, string> = {
  LG: 'Lawful Good',
  NG: 'Neutral Good',
  CG: 'Chaotic Good',
  LN: 'Lawful Neutral',
  N: 'True Neutral',
  CN: 'Chaotic Neutral',
  LE: 'Lawful Evil',
  NE: 'Neutral Evil',
  CE: 'Chaotic Evil',
};

export type DeityDomain =
  | 'Death'
  | 'Knowledge'
  | 'Life'
  | 'Light'
  | 'Nature'
  | 'Tempest'
  | 'Trickery'
  | 'War';

export interface DeityReference {
  /** Lowercase slug of the name, e.g. 'st-cuthbert'. */
  id: string;
  name: string;
  pantheon: DeityPantheon;
  /** Title and portfolio (Dragonlance lists a portfolio only). */
  title: string;
  alignment: DeityAlignmentCode;
  symbol: string;
  /** Suggested cleric domains (2014); empty for gods that grant none. */
  domains: DeityDomain[];
  /** The "Worshipped mainly by" column. */
  worshippers: string;
  description: string;
}

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function d(
  pantheon: DeityPantheon,
  name: string,
  title: string,
  alignment: DeityAlignmentCode,
  symbol: string,
  domains: DeityDomain[],
  worshippers: string,
  description: string,
): DeityReference {
  return { id: slug(name), name, pantheon, title, alignment, symbol, domains, worshippers, description };
}

const FR = 'forgotten-realms' as const;
const GH = 'greyhawk' as const;
const RC = 'racial' as const;
const DL = 'dragonlance' as const;

export const DEITY_REFERENCE: readonly DeityReference[] = [
  // ─── Forgotten Realms ─────────────────────────────────────────────────────
  d(FR, 'Mystra', 'The Lady of Mysteries; magic', 'NG', 'Circle of seven stars', ['Knowledge'], 'Spellcasters of every race', 'Keeper of the Weave, the fabric all spellcasting draws on. When she has died, magic has gone wild across the world. Wizards and sorcerers honor her.'),
  d(FR, 'Lathander', 'The Morninglord; dawn, renewal, birth', 'NG', 'Road leading into a sunrise', ['Life', 'Light'], 'Humans', 'An optimistic god of new beginnings and second chances. Popular with farmers, merchants and anyone starting over.'),
  d(FR, 'Selûne', 'Our Lady of Silver; the moon, stars, navigation', 'CG', 'Pair of eyes ringed by seven stars', ['Knowledge', 'Life'], 'Humans, half-elves, good lycanthropes', "Kindly guardian of travelers, sailors and lycanthropes who resist their curse. Shar's twin and eternal enemy."),
  d(FR, 'Shar', 'Mistress of the Night; darkness, loss, secrets', 'NE', 'Black disk with a deep purple border', ['Death', 'Trickery'], 'Humans', 'Goddess of forgetting and nihilism who offers relief from grief by erasing it. Her church works through secret cells.'),
  d(FR, 'Tyr', 'The Maimed God; justice', 'LG', 'Scales resting on a warhammer', ['War'], 'Humans', 'Blind and one-handed, he stands for fair law. Leads the Triad with Torm and Ilmater; beloved of paladins and judges.'),
  d(FR, 'Torm', 'The Loyal Fury; duty, loyalty, obedience', 'LG', 'White right gauntlet', ['War'], 'Humans', "Tyr's champion, honored by those who keep their oaths at any cost."),
  d(FR, 'Ilmater', 'The Crying God; endurance, suffering, martyrdom', 'LG', 'Hands bound at the wrist with red cord', ['Life'], 'Humans', 'Takes on the pain of others. His faithful run hospitals and help the poor and oppressed.'),
  d(FR, 'Helm', 'The Vigilant One; guardians, protection', 'LN', 'Staring eye on an upright gauntlet', ['Life', 'Light'], 'Humans', 'The never-sleeping watchman, patron of guards and bodyguards. Duty first, even when it is unpleasant.'),
  d(FR, 'Tymora', 'Lady Luck; good fortune', 'CG', 'Face-up coin', ['Trickery'], 'Humans; adventurers of every race', "Smiles on the bold, so she is the adventurer's goddess. Beshaba's twin sister."),
  d(FR, 'Beshaba', 'The Maid of Misfortune; bad luck, accidents', 'CE', 'Black antlers', ['Trickery'], 'Humans', 'People pray to her mainly to be left alone.'),
  d(FR, 'Tempus', 'The Foehammer; war', 'N', 'Upright flaming sword', ['War'], 'Humans, half-orcs; soldiers of every race', 'Lord of battle itself, not either side. Values courage and fair fighting; soldiers of every army honor him.'),
  d(FR, 'Chauntea', 'The Great Mother; agriculture', 'NG', 'Sheaf of grain or a rose over grain', ['Life'], 'Humans, halflings', 'Earth mother of farmers and gardeners; the growing year turns on her favor.'),
  d(FR, 'Silvanus', 'Oak Father; wild nature', 'N', 'Oak leaf', ['Nature'], 'Humans, half-elves; druids of every race', 'Keeps the balance of the wilds. Druids and rangers revere him.'),
  d(FR, 'Sune', 'Firehair; love, beauty', 'CG', 'Face of a red-haired woman', ['Life', 'Light'], 'Humans', 'Goddess of romance, art and passion. Her faithful seek and create beauty.'),
  d(FR, 'Oghma', 'The Binder; knowledge, invention', 'N', 'Blank scroll', ['Knowledge'], 'Humans', 'God of ideas, bards and scholars; holds that knowledge should be shared.'),
  d(FR, 'Gond', 'Wonderbringer; craft, invention', 'N', 'Toothed cog with four spokes', ['Knowledge'], 'Humans, gnomes', 'Patron of smiths, inventors and artificers. Loves new machines, including dangerous ones. The gnomes of Lantan are his most devoted followers.'),
  d(FR, 'Waukeen', "Merchant's Friend; trade, wealth", 'N', 'Coin with her profile', ['Knowledge', 'Trickery'], 'Humans', 'Goddess of commerce and fair dealing, popular in big trading cities.'),
  d(FR, 'Kelemvor', 'Lord of the Dead; death, judgment', 'LN', 'Skeletal arm holding balanced scales', ['Death'], 'Humans', 'Judges each soul fairly in the afterlife. Opposes undead and teaches that death is natural, not to be feared.'),
  d(FR, 'Bane', 'The Black Hand; tyranny, fear, hatred', 'LE', 'Upright black right hand', ['War'], 'Humans, hobgoblins', 'God of domination and order through fear. Schemes to rule Faerûn and has died and returned more than once.'),
  d(FR, 'Bhaal', 'Lord of Murder; violence, murder', 'NE', 'Skull ringed by drops of blood', ['Death'], 'Humans', "The killer god, central to the Baldur's Gate stories through his mortal children, the Bhaalspawn."),
  d(FR, 'Myrkul', 'Lord of Bones; death, decay, old age', 'NE', 'White human skull', ['Death'], 'Humans', 'The cold, grasping death god. Lost his role to Kelemvor but endures in the shadows.'),
  d(FR, 'Cyric', 'Prince of Lies; lies, strife, murder', 'CE', 'White jawless skull on a purple sunburst', ['Trickery'], 'Humans', 'A mortal who became a god. Mad, jealous and deceitful; hated by most other gods.'),
  d(FR, 'Mask', 'Master of All Thieves; thieves, shadows', 'CN', 'Black mask', ['Trickery'], 'Humans; thieves of every race', 'God of rogues, spies and stealth; values cleverness over violence.'),
  d(FR, 'Talos', 'The Storm Lord; storms, destruction', 'CE', 'Three lightning bolts from a central point', ['Tempest'], 'Humans', 'Destructive force of nature. Sailors and farmers make offerings to keep him away.'),
  d(FR, 'Umberlee', 'The Bitch Queen; the sea', 'CE', 'Wave curling left and right', ['Tempest'], 'Humans', 'Cruel goddess of the ocean. Sailors throw gifts overboard to buy safe passage.'),
  d(FR, 'Auril', 'The Frostmaiden; winter, cold', 'NE', 'Six-pointed snowflake', ['Nature', 'Tempest'], 'Humans of the far North', 'Vain, cruel goddess of winter. Central to the adventure Icewind Dale: Rime of the Frostmaiden.'),

  // ─── Forgotten Realms lesser gods ─────────────────────────────────────────
  d(FR, 'Amaunator', 'The Keeper of the Eternal Sun; sun, law, time', 'LN', 'Golden sun', ['Life', 'Light'], 'Humans', "Stern sun god of order and contracts. His faith merges and separates with Lathander's over the Realms' history."),
  d(FR, 'Azuth', 'The High One; wizards', 'LN', 'Left hand pointing up, outlined in fire', ['Knowledge'], 'Human wizards', "Mystra's chief servant and patron of wizards who study magic as a discipline."),
  d(FR, 'Deneir', 'Lord of All Glyphs and Images; writing, literature', 'NG', 'Lit candle above an open eye', ['Knowledge'], 'Humans', 'Patron of scribes and librarians, who works with Oghma to preserve knowledge.'),
  d(FR, 'Eilistraee', 'The Dark Maiden; song, dance, the moon, freedom', 'CG', 'Moonlit sword with silver filaments', ['Life', 'Light'], 'Drow', 'Good drow goddess who calls her people to leave Lolth and live on the surface.'),
  d(FR, 'Eldath', 'The Quiet One; peace, still waters', 'NG', 'Waterfall plunging into a still pool', ['Life', 'Nature'], 'Humans, half-elves', "Gentle goddess of pacifists and quiet groves. Silvanus's ally."),
  d(FR, 'Gwaeron Windstrom', 'Master of Tracking; tracking, rangers of the North', 'NG', 'Paw print with a five-pointed star', ['Knowledge', 'Nature'], 'Humans', "Mielikki's servant who guides rangers and trackers."),
  d(FR, 'Hoar', 'The Doombringer; revenge, retribution', 'LN', 'Coin with a two-faced head', ['War'], 'Humans', 'God of poetic justice who sees that wrongs are paid back.'),
  d(FR, 'Jergal', 'Scribe of the Dead; fate, death, the dead', 'LN', 'Skull biting a scroll', ['Knowledge', 'Death'], 'Humans', "The original lord of death, who gave up his throne and now records every soul's end. Appears in Baldur's Gate 3."),
  d(FR, 'Leira', 'The Lady of the Mists; illusion, deception', 'CN', 'Downward triangle holding a swirl of mist', ['Trickery'], 'Humans', 'Goddess of illusionists and liars; often said to be dead.'),
  d(FR, 'Lliira', 'Our Lady of Joy; joy, dance, festivals, freedom', 'CG', 'Triangle of three six-pointed stars', ['Life'], 'Humans', 'Cheerful goddess who hates violence. Patron of dancers and celebrations.'),
  d(FR, 'Loviatar', 'The Maiden of Pain; pain, torture, hurt', 'LE', 'Nine-tailed barbed scourge', ['Death'], 'Humans', 'Cruel goddess who teaches that suffering is strength. Serves Bane.'),
  d(FR, 'Malar', 'The Beastlord; the hunt, savagery, bloodlust', 'CE', 'Clawed paw', ['Nature'], 'Humans, evil lycanthropes', 'God of predators, evil lycanthropes and hunters who kill for sport.'),
  d(FR, 'Mielikki', 'Our Lady of the Forest; forests, rangers, dryads', 'NG', "Unicorn's head", ['Nature'], 'Humans, half-elves, wood elves', "Goddess of forests and those who protect them. Drizzt Do'Urden's patron."),
  d(FR, 'Red Knight', 'The Lady of Strategy; strategy, planning, tactics', 'LN', 'Red knight chess piece with star eyes', ['War'], 'Humans', "Tempus's servant, honored by generals and game players."),
  d(FR, 'Savras', 'The All-Seeing; divination, fate', 'LN', 'Crystal ball holding many kinds of eyes', ['Knowledge'], 'Humans', 'Patron of seers and diviners; serves Azuth.'),
  d(FR, 'Shaundakul', 'Rider of the Winds; travel, exploration, caravans', 'CN', 'Hand with fingers pointed up in a curve', ['Trickery', 'Nature'], 'Humans', 'God of explorers, caravans and portals.'),
  d(FR, 'Siamorphe', 'The Divine Right; nobility, rightful rule', 'LN', 'Silver chalice with a golden sun', ['Knowledge'], 'Human nobles', 'Goddess of nobles who rule responsibly. Her divinity passes from one noble mortal to the next.'),
  d(FR, 'Talona', 'Lady of Poison; disease, poison', 'CE', 'Three teardrops on a triangle', ['Death'], 'Humans', "Feared goddess of plague and poison; Talos's ally."),
  d(FR, 'Ubtao', 'The Creator of Chult; creation, jungles, dinosaurs', 'N', 'Maze', ['Knowledge', 'Life', 'Nature'], 'Chultan humans', 'Distant creator god of the jungle land of Chult. Central to Tomb of Annihilation.'),
  d(FR, 'Uthgar', 'The Battle Father; the Uthgardt barbarians', 'CN', "Varies by tribe (each tribe's beast totem)", ['Nature', 'Tempest'], 'Uthgardt humans', 'A mortal hero who became god of the Uthgardt tribes of the North.'),
  d(FR, 'Valkur', 'The Mighty; sailors, ships, favorable winds', 'CG', 'Cloud with three lightning bolts', ['Tempest', 'War'], 'Humans', 'Brave patron of sailors who defies Umberlee and Talos.'),

  // ─── Forgotten Realms elemental lords ─────────────────────────────────────
  d(FR, 'Akadi', 'Elemental lord of air', 'N', '', ['Tempest'], 'Genasi and elemental cults', 'A distant elemental power worshipped mainly by genasi and elemental cults.'),
  d(FR, 'Grumbar', 'Elemental lord of earth', 'N', '', ['Knowledge'], 'Genasi and elemental cults', 'A distant elemental power worshipped mainly by genasi and elemental cults.'),
  d(FR, 'Istishia', 'Elemental lord of water', 'N', '', ['Tempest'], 'Genasi and elemental cults', 'A distant elemental power worshipped mainly by genasi and elemental cults.'),
  d(FR, 'Kossuth', 'Elemental lord of fire', 'N', '', ['Light'], 'Genasi and elemental cults', 'A distant elemental power worshipped mainly by genasi and elemental cults.'),

  // ─── Greyhawk ─────────────────────────────────────────────────────────────
  d(GH, 'Pelor', 'The Shining One; sun, light, healing', 'NG', 'Sun', ['Life', 'Light'], 'Humans', 'Gentle god of the sun and healing, and one of the most widely worshipped. Fierce against undead and evil.'),
  d(GH, 'Heironeous', 'The Invincible; valor, chivalry, justice', 'LG', 'Lightning bolt', ['War'], 'Humans', 'Knightly god of honorable combat, beloved of paladins. Locked in an endless war with his brother Hextor.'),
  d(GH, 'Hextor', 'Scourge of Battle; tyranny, war, discord', 'LE', 'Six arrows fanned downward', ['War'], 'Humans', "Six-armed god of conquest and ruthless order. Heironeous's half-brother and nemesis."),
  d(GH, 'St. Cuthbert', 'Of the Cudgel; common sense, zeal, retribution', 'LN', 'Starburst of lines around a circle', ['Knowledge'], 'Humans', 'A blunt, practical god who punishes wrongdoers and converts the unbelieving. Distrusts fancy talk.'),
  d(GH, 'Kord', 'The Brawler; strength, athletics, storms', 'CG', 'Spears and maces radiating from a point', ['Tempest', 'War'], 'Humans', 'Loves contests, feasts and brawls; patron of fighters and athletes.'),
  d(GH, 'Boccob', 'The Uncaring; magic, knowledge, foresight', 'N', 'Eye within a pentagram', ['Knowledge'], 'Humans; wizards of every race', 'Archmage of the gods. Cares about magic and balance, not about mortals.'),
  d(GH, 'Wee Jas', 'The Witch Goddess; magic, death, vanity', 'LN', 'Red skull before a fireball', ['Death', 'Knowledge'], 'Humans (especially the Suel people)', 'Proud goddess of both death magic and the proper rites of the dead. Opposes undead created without permission.'),
  d(GH, 'Obad-Hai', 'The Shalm; nature, wilderness', 'N', 'Oak leaf and acorn', ['Nature'], 'Humans (especially the Flan people); druids', 'God of untamed nature and its balance; patron of druids.'),
  d(GH, 'Ehlonna', 'Ehlonna of the Forests; woodlands', 'NG', 'Unicorn horn', ['Life', 'Nature'], 'Humans, elves, half-elves, gnomes, halflings', 'Protector of forests, rangers and woodland creatures.'),
  d(GH, 'Fharlanghn', 'Dweller on the Horizon; roads, travel', 'NG', 'Circle crossed by a curved horizon line', ['Knowledge', 'Trickery'], 'Humans', 'God of wanderers and pilgrims; urges people to see the world.'),
  d(GH, 'Olidammara', 'The Laughing Rogue; music, revelry, wine, rogues', 'CN', 'Laughing mask', ['Trickery'], 'Humans; bards and rogues of every race', 'Prankster god of bards, thieves and party-goers.'),
  d(GH, 'Nerull', 'The Reaper; death, darkness, the underworld', 'NE', 'Skull with a sickle', ['Death'], 'Humans', 'Hates all life and seeks to end it. Worshipped by necromancers and murderers.'),
  d(GH, 'Vecna', 'The Whispered One; evil secrets', 'NE', 'Hand with an eye in the palm', ['Knowledge'], 'Humans; secret cults', 'A lich who ascended to godhood. Source of the infamous Hand and Eye of Vecna artifacts.'),
  d(GH, 'Erythnul', 'The Many; slaughter, panic, hate', 'CE', 'Drop of blood', ['War'], 'Gnolls, orcs, ogres, bugbears, evil humans', 'God of mindless carnage, favored by berserkers and raiders.'),
  d(GH, 'Incabulos', 'The Black Rider; plague, famine, nightmares', 'NE', 'Reptilian eye with a horizontal diamond', ['Death'], 'Humans', 'Spreads disease and misery. His worship is outlawed nearly everywhere.'),
  d(GH, 'Tharizdun', 'The Chained God; entropy, eternal darkness', 'CE', 'Dark spiral or inverted ziggurat', ['Trickery'], 'Secret cults of any race', 'So dangerous the other gods imprisoned him. His cults try to free him and end the world.'),

  // ─── Racial and dragon gods ───────────────────────────────────────────────
  d(RC, 'Moradin', 'The Soul Forger; dwarves, creation, smithing', 'LG', 'Hammer and anvil', ['Knowledge'], 'Dwarves', 'Forged the first dwarves from metal and gems. Stern, fair father of the dwarven gods.'),
  d(RC, 'Corellon Larethian', 'Creator of the Elves; elves, magic, art', 'CG', 'Quarter moon or starburst', ['Light'], 'Elves, half-elves', 'Changeable, graceful leader of the elven gods. Cast out Lolth after her betrayal.'),
  d(RC, 'Sehanine Moonbow', 'Daughter of the Night Skies; elves, the moon, dreams', 'CG', 'Crescent moon', ['Knowledge'], 'Elves, half-elves', 'Guides elven souls after death and watches over dreams and mysteries.'),
  d(RC, 'Garl Glittergold', 'The Joker; gnomes, humor, gems', 'LG', 'Gold nugget', ['Trickery'], 'Gnomes', 'Prankster protector of gnomes, famous for tricks that teach a lesson.'),
  d(RC, 'Yondalla', 'The Blessed One; halflings, home, fertility', 'LG', 'Shield', ['Life'], 'Halflings', 'Motherly protector of halfling families and communities.'),
  d(RC, 'Gruumsh', 'One-Eye; orcs, conquest, strength', 'CE', 'Unblinking eye', ['Tempest', 'War'], 'Orcs, some half-orcs', 'Lost an eye to Corellon. Drives orcs to raid and conquer, nursing an endless grudge against elves.'),
  d(RC, 'Maglubiyet', 'The Mighty One; goblinoids, war', 'LE', 'Bloody axe', ['War'], 'Goblins, hobgoblins, bugbears', 'Brutal ruler of goblinoids. Rules their afterlife as an eternal army.'),
  d(RC, 'Kurtulmak', 'Lord of All Kobolds; kobolds, traps, mining', 'LE', 'Gnome skull', ['War'], 'Kobolds', 'Schemer god of kobolds, who passes on his hatred of gnomes.'),
  d(RC, 'Lolth', 'Queen of Spiders; drow, spiders, deceit', 'CE', 'Spider', ['Trickery'], 'Drow, driders', 'Once an elven goddess, cast out for treachery. Rules drow society through her priestesses and constant intrigue.'),
  d(RC, 'Bahamut', 'The Platinum Dragon; good dragons, justice, protection', 'LG', "Dragon's head in profile", ['Life', 'War'], 'Metallic dragons, dragonborn', 'Noble king of metallic dragons. Often walks the world disguised as an old man with seven canaries (really gold dragons).'),
  d(RC, 'Tiamat', 'Dragon Queen; evil dragons, greed, conquest', 'LE', 'Dragon head with five claw marks', ['Trickery'], 'Chromatic dragons, kobolds, some dragonborn', 'Five-headed queen of chromatic dragons, imprisoned in the Nine Hells. Her cult tries to free her in Tyranny of Dragons.'),

  // ─── Dragonlance: good ────────────────────────────────────────────────────
  d(DL, 'Paladine', 'Rulership, guardianship', 'LG', 'Silver triangle', ['War'], 'Humans, elves, good dragons', 'Leader of the good gods, the Platinum Dragon. Often appears as the bumbling wizard Fizban.'),
  d(DL, 'Mishakal', 'Healing', 'LG', 'Blue infinity sign', ['Knowledge', 'Life'], 'Humans, especially the Plains tribes', "Paladine's consort; her return to Krynn restored true healing magic."),
  d(DL, 'Kiri-Jolith', 'Honor, war', 'LG', "Bison's horns", ['War'], 'Humans (Solamnic Knights)', 'God of just warfare; patron of the Knights of the Sword.'),
  d(DL, 'Majere', 'Meditation, order', 'LG', 'Copper spider', ['Knowledge'], 'Humans', 'Discipline and faith; monks follow him.'),
  d(DL, 'Branchala', 'Music', 'NG', "Bard's harp", ['Light'], 'Elves, kender', 'God of song and joy; patron of bards.'),
  d(DL, 'Habbakuk', 'Animal life, the sea', 'NG', 'Blue bird', ['Nature', 'Tempest'], 'Humans, Kagonesti (wild) elves', 'Guardian of creatures and the cycle of life.'),
  d(DL, 'Solinari', 'Good magic', 'LG', 'White circle or sphere', [], 'White Robe wizards', 'God of the white moon.'),
  // ─── Dragonlance: neutral ─────────────────────────────────────────────────
  d(DL, 'Gilean', 'Knowledge', 'N', 'Open book', ['Knowledge'], 'Humans; scholars', 'Keeper of the Tobril, a book of all knowledge, and leader of the neutral gods.'),
  d(DL, 'Reorx', 'Craft', 'N', 'Forging hammer', ['Knowledge'], 'Dwarves, gnomes', 'Smith who forged the world.'),
  d(DL, 'Chislev', 'Nature', 'N', 'Feather', ['Nature'], 'Humans, Kagonesti elves', 'The living world itself; druids honor her.'),
  d(DL, 'Shinare', 'Wealth, trade', 'N', "Griffon's wing", ['Knowledge', 'Trickery'], 'Humans', 'Goddess of commerce and fair agreements.'),
  d(DL, 'Sirrion', 'Fire, change', 'N', 'Multicolored fire', ['Nature'], 'Humans', 'Creative and destructive flame; artists and alchemists revere him.'),
  d(DL, 'Zivilyn', 'Wisdom', 'N', 'Great green or gold tree', ['Knowledge'], 'Humans', "Sees all times at once; Gilean's companion."),
  d(DL, 'Lunitari', 'Neutral magic', 'N', 'Red circle or sphere', [], 'Red Robe wizards', 'Goddess of the red moon.'),
  // ─── Dragonlance: evil ────────────────────────────────────────────────────
  d(DL, 'Takhisis', 'Night, hatred', 'LE', 'Black crescent', ['Death'], 'Humans, evil dragons, draconians', 'Queen of Darkness, the five-headed dragon. Her attempts to conquer Krynn drive the main saga.'),
  d(DL, 'Sargonnas', 'Vengeance, fire', 'LE', 'Stylized red condor', ['War'], 'Minotaurs', "Takhisis's consort and the minotaurs' chief god."),
  d(DL, 'Chemosh', 'Death, undeath', 'LE', 'Yellow skull', ['Death'], 'Humans', 'Lord of Bones, who tempts mortals with false promises of eternal life.'),
  d(DL, 'Morgion', 'Disease, secrecy', 'NE', 'Hood with two red eyes', ['Death'], 'Humans', 'Spreads plague from his bronze tower.'),
  d(DL, 'Hiddukel', 'Lies, ill-gotten wealth', 'CE', "Broken merchant's scales", ['Trickery'], 'Humans', 'God of cheats and corrupt bargains.'),
  d(DL, 'Zeboim', 'Sea, storms', 'CE', 'Turtle shell', ['Tempest'], 'Humans (sailors)', "Takhisis's moody daughter, quick to wreck ships."),
  d(DL, 'Nuitari', 'Evil magic', 'LE', 'Black circle or sphere', [], 'Black Robe wizards', 'God of the black moon.'),
];

/** Looks up a reference entry by exact name (case-insensitive) or id. */
export function getDeityReference(nameOrId: string | undefined): DeityReference | undefined {
  const key = (nameOrId ?? '').trim().toLowerCase();
  if (!key) return undefined;
  return DEITY_REFERENCE.find((r) => r.name.toLowerCase() === key || r.id === key);
}
