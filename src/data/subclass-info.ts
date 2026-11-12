/**
 * One-line summaries of each subclass, so a player choosing one knows what it is
 * about before reading its features. Each is a short paraphrase (not verbatim)
 * of the subclass's introduction in the PHB 2024 (Docs/PlayersHandbook.md),
 * cited by line. Circle of the Land's introduction is unreadable in the scan
 * (merged into its spell tables), so its summary is drawn from its features.
 */
export interface SubclassInfo {
  summary: string;
  source: string;
}

export const SUBCLASS_INFO: Record<string, SubclassInfo> = {
  // Barbarian
  berserker: { summary: 'Turns Rage into pure, reckless violence and thrives in the chaos of battle.', source: 'PHB 2024 "Path of the Berserker" (L2559)' },
  wildHeart: { summary: 'Kin to animals: talks with beasts and draws animal might into Rage.', source: 'PHB 2024 "Path of the Wild Heart" (L2579)' },
  worldTree: { summary: 'Connects through Rage to the cosmic tree Yggdrasil, which links the planes, and draws on its power.', source: 'PHB 2024 "Path of the World Tree" (L2621)' },
  zealot: { summary: 'Receives boons from a god or pantheon, experiencing Rage as divine ecstasy.', source: 'PHB 2024 "Path of the Zealot" (L2641)' },
  // Bard
  dance: { summary: 'Expresses the magic of creation through movement and graceful, agile combat.', source: 'PHB 2024 "College of Dance" (L2985)' },
  glamour: { summary: 'Weaves the beguiling magic of the Feywild into performances of beauty and terror.', source: 'PHB 2024 "College of Glamour" (L3019)' },
  lore: { summary: 'Collects spells and secrets from every source, mastering knowledge and magical versatility.', source: 'PHB 2024 "College of Lore" (L3055)' },
  valor: { summary: 'A daring storyteller who keeps old heroes\' deeds alive and fights alongside new ones.', source: 'PHB 2024 "College of Valor" (L3079)' },
  // Cleric
  life: { summary: 'A master of healing, channelling the positive energy that sustains all life.', source: 'PHB 2024 "Life Domain" (L3411)' },
  light: { summary: 'Wields blazing divine fire and revelation to drive away lies and darkness.', source: 'PHB 2024 "Light Domain" (L3450)' },
  trickery: { summary: 'Uses deception, illusion and stealth to mock tyrants, free captives and puncture pride.', source: 'PHB 2024 "Trickery Domain" (L3491)' },
  war: { summary: 'Inspires valour and strikes hard, channelling the divine magic of battle.', source: 'PHB 2024 "War Domain" (L3536)' },
  // Druid
  land: { summary: 'Draws magic from a type of land (arid, polar, temperate or tropical) that sets extra prepared spells and recovers spell slots on a Short Rest.', source: 'PHB 2024 "Circle of the Land" features (L3860-3923)' },
  moon: { summary: 'Uses lunar magic to take on powerful animal forms and guard the wilds.', source: 'PHB 2024 "Circle of the Moon" (L3933)' },
  sea: { summary: 'Calls on the tempestuous power of oceans and storms.', source: 'PHB 2024 "Circle of the Sea" (L3986)' },
  stars: { summary: 'Reads secrets in the constellations and channels the power of the cosmos.', source: 'PHB 2024 "Circle of the Stars" (L4029)' },
  // Fighter
  battleMaster: { summary: 'A student of battle who uses special manoeuvres to control and outwit foes.', source: 'PHB 2024 "Battle Master" (L4227)' },
  champion: { summary: 'Pursues raw martial excellence: harder hits, more critical hits and great resilience.', source: 'PHB 2024 "Champion" (L4317)' },
  eldritchKnight: { summary: 'Combines martial mastery with wizard spells that protect and extend their fighting.', source: 'PHB 2024 "Eldritch Knight" (L4343)' },
  psiWarrior: { summary: 'Awakens psionic power to empower strikes, hurl telekinetic force and raise mental barriers.', source: 'PHB 2024 "Psi Warrior" (L4418)' },
  // Monk
  elements: { summary: 'Tames the energy of the Elemental Planes to empower strikes and movement.', source: 'PHB 2024 "Warrior of the Elements" (L4751)' },
  mercy: { summary: 'A wandering healer who manipulates life force to heal allies and swiftly end foes.', source: 'PHB 2024 "Warrior of Mercy" (L4679)' },
  openHand: { summary: 'The master of unarmed combat: pushes, trips and protects themself with focused energy.', source: 'PHB 2024 "Warrior of the Open Hand" (L4781)' },
  shadow: { summary: 'Draws on the Shadowfell for stealth, darkness and stepping from shadow to shadow.', source: 'PHB 2024 "Warrior of Shadow" (L4715)' },
  // Paladin
  devotion: { summary: 'The knight in shining armour, sworn to justice, order and the highest standards of conduct.', source: 'PHB 2024 "Oath of Devotion" (L5101)' },
  glory: { summary: 'Believes they and their companions are destined for glory through heroic deeds.', source: 'PHB 2024 "Oath of Glory" (L5157)' },
  ancients: { summary: 'An oath as old as the first elves, cherishing light, beauty and life over rigid rules.', source: 'PHB 2024 "Oath of the Ancients" (L5213)' },
  vengeance: { summary: 'A solemn vow to punish those who commit grievous evil, whatever it takes.', source: 'PHB 2024 "Oath of Vengeance" (L5265)' },
  // Ranger
  beastMaster: { summary: 'Bonds with a special animal companion that fights at their side.', source: 'PHB 2024 "Beast Master" (L5579)' },
  feyWanderer: { summary: 'Touched by fey magic: charming, beguiling and dangerous to foes.', source: 'PHB 2024 "Fey Wanderer" (L5708)' },
  gloomStalker: { summary: 'At home in the dark, using Shadowfell magic against foes that lurk there.', source: 'PHB 2024 "Gloom Stalker" (L5767)' },
  hunter: { summary: 'Stalks dangerous prey to protect nature and people from those who would destroy them.', source: 'PHB 2024 "Hunter" (L5821)' },
  // Rogue
  arcaneTrickster: { summary: 'Adds wizard spells and magical tricks to stealth and agility.', source: 'PHB 2024 "Arcane Trickster" (L6007)' },
  assassin: { summary: 'Trained in stealth, poison and disguise to take out foes with deadly efficiency.', source: 'PHB 2024 "Assassin" (L6078)' },
  soulknife: { summary: 'Strikes with the mind, forming blades of psionic energy.', source: 'PHB 2024 "Soulknife" (L6106)' },
  thief: { summary: 'The classic adventurer: burglar, treasure hunter and explorer who gets the most out of items.', source: 'PHB 2024 "Thief" (L6177)' },
  // Sorcerer
  aberrant: { summary: 'An alien influence gives them psionic power to touch other minds.', source: 'PHB 2024 "Aberrant Sorcery" (L6536)' },
  clockwork: { summary: 'Infused with the cosmic power of order from Mechanus, a plane of clockwork efficiency.', source: 'PHB 2024 "Clockwork Sorcery" (L6591)' },
  draconic: { summary: 'Their innate magic is the gift of a dragon, growing more draconic as they rise.', source: 'PHB 2024 "Draconic Sorcery" (L6656)' },
  wildMagic: { summary: 'Their magic springs from raw chaos, with unpredictable and surprising surges.', source: 'PHB 2024 "Wild Magic Sorcery" (L6697)' },
  // Warlock
  archfey: { summary: 'A pact with a lord or lady of the Feywild, granting fey trickery and teleportation.', source: 'PHB 2024 "Archfey Patron" (L7185)' },
  celestial: { summary: 'A pact with a being of the Upper Planes, granting healing and radiant light.', source: 'PHB 2024 "Celestial Patron" (L7236)' },
  fiend: { summary: 'A pact with a demon or devil of the Lower Planes, granting destructive fire and resilience.', source: 'PHB 2024 "Fiend Patron" (L7272)' },
  greatOldOne: { summary: 'Bound to an unknowable being from the Far Realm, granting telepathy and mind-bending powers.', source: 'PHB 2024 "Great Old One Patron" (L7313)' },
  // Wizard
  abjurer: { summary: 'Specialises in spells that block, banish and protect.', source: 'PHB 2024 "Abjurer" (L7656)' },
  diviner: { summary: 'Specialises in seeing past, present and future, even bending luck with portents.', source: 'PHB 2024 "Diviner" (L7690)' },
  evoker: { summary: 'Specialises in powerful elemental magic: cold, flame, thunder, lightning and acid.', source: 'PHB 2024 "Evoker" (L7730)' },
  illusionist: { summary: 'Specialises in illusions that dazzle the senses and make the impossible seem real.', source: 'PHB 2024 "Illusionist" (L7758)' },
};
