/**
 * Magic items printed in the Dungeon Master's Guide 2024 "Magic Items A-Z"
 * (chapter 7) that are NOT in the SRD 5.2.1 catalog (data/magic-items.ts), kept
 * apart so the SRD-derived catalog stays untouched.
 *
 * Each entry exists because a DMG 2024 Random Magic Items table (pp.326-331)
 * names the item and the SRD has no entry for it. Category, rarity and
 * attunement are read from the printed heading line. `description` is a SHORT
 * PARAPHRASE of the printed rules text (never verbatim DMG prose; rules-compliance
 * rule 5), written from Docs/DungeonMastersGuide.md and checked against the page
 * text of Docs/Dungeon Masters Guide.pdf where the OCR was damaged. Long tables
 * (Deck of Many Things, Moonblade properties, Alchemy Jug quantities, Cube of
 * Summoning spells) are not reproduced: read them in the book at the printed page.
 * `page` is the printed DMG 2024 page of the entry (the book's own index).
 */
import type { MagicItemCategory } from './magic-items';

export interface DmgMagicItem {
  readonly id: string;
  /** Name as printed in the DMG A-Z. */
  readonly name: string;
  readonly category: MagicItemCategory;
  /** The parenthetical after the category, e.g. "Any Light, Medium, or Heavy"; null when none. */
  readonly typeDetail: string | null;
  /** Rarity as printed, e.g. "Common", "Uncommon (+1), Rare (+2), or Very Rare (+3)", "Rarity Varies". */
  readonly rarity: string;
  readonly requiresAttunement: boolean;
  /** Text after "Requires Attunement by", e.g. "a Wizard"; null when there is none. */
  readonly attunementCondition: string | null;
  /** Short paraphrase of the printed rules text. */
  readonly description: string;
  /** Printed DMG 2024 page. */
  readonly page: number;
}

type Row = [
  name: string,
  category: MagicItemCategory,
  typeDetail: string | null,
  rarity: string,
  attunement: false | true | string,
  page: number,
  description: string,
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const ROWS: readonly Row[] = [
  ['Adamantine Weapon', 'Weapon', 'Any Ammunition or Melee Weapon', 'Uncommon', false, 227, 'Made of adamantine. Whenever it hits an object, the hit is a Critical Hit.'],
  ['Alchemy Jug', 'Wondrous Item', null, 'Uncommon', false, 227, 'A jug that looks like it holds a gallon and weighs 12 pounds, full or empty. As a Magic action, name a liquid from the Alchemy Jug Liquids table (for example beer, honey, oil, vinegar, wine, fresh or salt water, or basic poison) and the jug produces it; uncork it as a Utilize action and pour up to 2 gallons per minute. The most it can produce depends on the liquid (see the table on p.227).'],
  ['Apparatus of Kwalish', 'Wondrous Item', null, 'Legendary', false, 229, 'A sealed 500-pound iron barrel with a hidden hatch (DC 20 Intelligence (Investigation) to find) that fits two Medium or smaller creatures. Ten levers inside transform it into a Large lobster-like vehicle (AC 20, HP 200, Speed 30 ft. and Swim 30 ft., immune to Poison and Psychic) that needs one pilot and has an airtight, watertight compartment. The lever functions are listed on p.229.'],
  ['Armor of Gleaming', 'Armor', 'Any Light, Medium, or Heavy', 'Common', false, 230, 'The armor never gets dirty.'],
  ["Baba Yaga's Dancing Broom", 'Wondrous Item', null, 'Uncommon', true, 232, 'As a Magic action, transform the broom into an Animated Broom under your control. It acts right after you in the initiative order, stays animate until you use a Bonus Action and a command word, and shatters at 0 Hit Points (it regains all Hit Points if it reverts first). You command it mentally within 30 feet (no action) or give it a general order.'],
  ['Bead of Refreshment', 'Wondrous Item', null, 'Common', false, 235, 'Dissolves in liquid, turning up to a pint of it into fresh, cold drinking water. No effect on magical liquids or harmful substances such as poison.'],
  ['Boots of False Tracks', 'Wondrous Item', null, 'Common', true, 239, 'While worn, the boots can leave tracks like those of any kind of Humanoid of your size.'],
  ['Candle of the Deep', 'Wondrous Item', null, 'Common', false, 242, 'The flame is not extinguished by immersion in water. It gives light and heat like a normal candle.'],
  ['Cap of Water Breathing', 'Wondrous Item', null, 'Uncommon', false, 242, 'While worn underwater, you can take a Magic action to create a bubble of air around your head so you can breathe. It lasts until the cap is removed or you are no longer underwater.'],
  ['Cast-Off Armor', 'Armor', 'Any Light, Medium, or Heavy', 'Common', false, 243, 'You can doff this armor as a Magic action.'],
  ['Cauldron of Rebirth', 'Wondrous Item', null, 'Very Rare', 'a Druid or Warlock', 243, 'A Tiny cast-iron pot. It works as a Spellcasting Focus and as a component for Scrying. After a Long Rest you can brew a Potion of Healing (greater) in it in 1 minute (lasts 24 hours). As a Magic action it grows large enough for a Medium creature. A Humanoid corpse covered with 200 pounds of salt (10 GP) for 8 hours returns to life as if by Raise Dead at the next dawn; usable once per 7 days.'],
  ["Charlatan's Die", 'Wondrous Item', null, 'Common', true, 243, 'A six-sided die. Whenever you roll it, you can control which number it shows.'],
  ['Cloak of Billowing', 'Wondrous Item', null, 'Common', false, 244, 'While worn, you can take a Bonus Action to make the cloak billow dramatically for 1 minute.'],
  ['Cloak of Many Fashions', 'Wondrous Item', null, 'Common', false, 245, 'As a Bonus Action while wearing it, change the cloak\'s style, color and apparent quality. Weight stays the same, it can only look like a cloak, and it copies no magical properties of other cloaks.'],
  ['Clockwork Amulet', 'Wondrous Item', null, 'Common', false, 245, 'When you make an attack roll while wearing it, you can forgo rolling the d20 and treat the die as a 10. Once used, it can\'t be used again until the next dawn.'],
  ['Clothes of Mending', 'Wondrous Item', null, 'Common', false, 245, 'The outfit mends itself against daily wear and tear. Destroyed pieces are not repaired.'],
  ['Cube of Summoning', 'Wondrous Item', null, 'Rare', false, 247, 'A Tiny jack-in-the-box cube. Winding it as a Magic action makes a creature appear in the nearest unoccupied space. It works once, then not again until the next dawn. Roll on the Cube of Summoning table (p.247) for the spell it casts to summon the creature, at level 5 (save DC 17, +9 attack bonus), with no Concentration needed.'],
  ['Dark Shard Amulet', 'Wondrous Item', null, 'Common', 'a Warlock', 248, 'A Spellcasting Focus for your Warlock spells. As a Magic action you can try to cast a Warlock-list cantrip you don\'t know (casting time of an action) with a DC 10 Intelligence (Arcana) check. On a success you cast it; on a failure the action is wasted. Either way, you can\'t do this again until a Long Rest.'],
  ['Deck of Many Things', 'Wondrous Item', null, 'Legendary', false, 250, 'A deck of 13 cards (75 percent of decks) or 22. Declare how many cards you will draw, then draw them at random, each within 1 hour of the last; each card takes effect at once. Drawn cards vanish, but return to the deck unless they are the Fool or Jester. The effects are listed in the Deck of Many Things table (p.250).'],
  ['Dread Helm', 'Wondrous Item', null, 'Common', false, 254, 'While worn, your eyes glow red and the rest of your face is hidden in shadow.'],
  ['Driftglobe', 'Wondrous Item', null, 'Uncommon', false, 254, 'A 1-pound glass sphere. Within 60 feet you can command it to shed light like the Light or Daylight spell (Daylight once per dawn). As a Magic action you can make it float up to 5 feet off the ground, where it hovers until grasped; if you move more than 60 feet away it stops following.'],
  ['Ear Horn of Hearing', 'Wondrous Item', null, 'Common', false, 256, 'Held up to your ear, it suppresses the Deafened condition on you.'],
  ['Efreeti Chain', 'Armor', 'Chain Mail or Chain Shirt', 'Legendary', true, 257, 'While worn you gain a +3 bonus to Armor Class, Immunity to Fire damage, and knowledge of Primordial, and you can stand on and move across molten rock as if solid.'],
  ['Enduring Spellbook', 'Wondrous Item', null, 'Common', false, 257, 'The spellbook and its pages cannot be damaged by fire or water and do not deteriorate with age.'],
  ['Enspelled Armor', 'Armor', 'Any Light, Medium, or Heavy', 'Rarity Varies', true, 258, 'Holds a bound spell of level 8 or lower from the Abjuration or Illusion school, set when the armor is made. 6 charges, regaining 1d6 daily at dawn; while worn, expend 1 charge to cast the spell. The spell\'s level sets the save DC, attack bonus and rarity (Uncommon for a cantrip or level 1, Rare for levels 2-3, Very Rare for levels 4-5, Legendary for levels 6-8; table on p.258).'],
  ['Enspelled Staff', 'Staff', null, 'Rarity Varies', 'a Spellcaster', 258, 'Holds a bound spell of level 8 or lower from any school. 6 charges, regaining 1d6 daily at dawn; while holding it, expend 1 charge to cast the spell. When the last charge is spent, roll a d20: on a 1 the staff becomes a nonmagical Quarterstaff. The spell\'s level sets the save DC, attack bonus and rarity (Uncommon for a cantrip or level 1, Rare for levels 2-3, Very Rare for levels 4-5, Legendary for levels 6-8; table on p.258).'],
  ['Enspelled Weapon', 'Weapon', 'Any Simple or Martial', 'Rarity Varies', true, 258, 'Holds a bound spell of level 8 or lower from the Conjuration, Divination, Evocation, Necromancy or Transmutation school. 6 charges, regaining 1d6 daily at dawn; while holding it, expend 1 charge to cast the spell. The spell\'s level sets the save DC, attack bonus and rarity (Uncommon for a cantrip or level 1, Rare for levels 2-3, Very Rare for levels 4-5, Legendary for levels 6-8; table on p.258).'],
  ['Ersatz Eye', 'Wondrous Item', null, 'Common', false, 259, 'Replaces a lost or removed eye; you see through it like a natural eye. You insert or remove it as a Magic action, and it cannot be removed against your will while you live.'],
  ["Executioner's Axe", 'Weapon', 'Battleaxe, Greataxe, Halberd, or Handaxe', 'Very Rare', false, 259, '+1 bonus to attack and damage rolls. A Humanoid you hit takes an extra 2d6 Slashing damage, and you gain Temporary Hit Points equal to that extra damage.'],
  ['Hag Eye', 'Wondrous Item', null, 'Uncommon', false, 265, '3 charges, all regained daily at dawn. While worn or held, expend 1 charge to cast Darkvision (self only) or See Invisibility. A hag of the coven that made it can, as a Magic action, see through it while on the same plane (Concentration). Only a hag coven can craft one, and a coven can have only one.'],
  ['Hat of Vermin', 'Wondrous Item', null, 'Common', false, 267, '3 charges, all regained daily at dawn. While holding it, expend 1 charge as a Magic action to summon a Bat, Frog or Rat in the hat. The creature is Indifferent, not under your control, behaves like an ordinary animal and vanishes after 1 hour or at 0 Hit Points.'],
  ['Hat of Wizardry', 'Wondrous Item', null, 'Common', 'a Wizard', 267, 'A Spellcasting Focus for your Wizard spells. As a Magic action you can try to cast a Wizard-list cantrip you don\'t know (casting time of an action) with a DC 10 Intelligence (Arcana) check. On a success you cast it; on a failure the action is wasted. Either way, you can\'t do this again until a Long Rest.'],
  ["Heward's Handy Spice Pouch", 'Wondrous Item', null, 'Common', false, 269, 'A belt pouch with 10 charges that looks empty. While holding it, expend 1 charge as a Magic action and name a nonmagical seasoning to pull a pinch (enough for one meal) from it. Regains 1d6 + 4 charges daily at dawn.'],
  ['Horn of Silent Alarm', 'Wondrous Item', null, 'Common', false, 270, '4 charges, regaining 1d4 daily at dawn. As a Magic action, blow it and expend 1 charge: one creature of your choice within 600 feet hears the blare and no one else does.'],
  ['Instrument of Illusions', 'Wondrous Item', null, 'Common', false, 271, 'While playing it, take a Magic action to create harmless, obviously illusory visual effects (notes, a dancer, butterflies, falling snow) in a 5-foot Emanation from the instrument (15 feet if you are a Bard). They end when you stop playing.'],
  ['Instrument of Scribing', 'Wondrous Item', null, 'Common', false, 271, '3 charges, all regained daily at dawn. While playing it, expend 1 charge as a Magic action to write a message of up to six words on a nonmagical object or surface you can see within 30 feet. A Bard can write seven more words and make it glow faintly. Dispel Magic erases it; otherwise it fades after 24 hours.'],
  ['Instrument of the Bards', 'Wondrous Item', null, 'Rarity Varies', 'a Bard', 272, 'Seven instruments, each named after a bard college, with a rarity that depends on the instrument. All can cast Fly, Invisibility, Levitate and Protection from Evil and Good, plus spells specific to the instrument (Anstruth harp, Canaith mandolin, Cli lyre, Doss lute, Fochlucan bandore, Mac-Fuirmidh cittern, Ollamh harp; table on p.272). Each spell can be cast once per dawn using your spellcasting ability and spell save DC. A creature that plays it without being attuned must succeed on a DC 15 Wisdom save or take 2d4 Psychic damage.'],
  ["Keoghtom's Ointment", 'Wondrous Item', null, 'Uncommon', false, 275, 'A jar holding 1d4 + 1 doses. As a Utilize action, swallow a dose or apply it to a creature within 5 feet: that creature regains 2d8 + 2 Hit Points and ends the Poisoned condition.'],
  ['Lock of Trickery', 'Wondrous Item', null, 'Common', false, 275, 'Looks like an ordinary Lock and comes with one key. Its tumblers adjust to thwart burglars: Dexterity checks to pick it have Disadvantage.'],
  ['Lute of Thunderous Thumping', 'Weapon', 'Club', 'Very Rare', false, 275, 'A reinforced lute wielded as a magic Club that deals an extra 2d8 Thunder damage on a hit. A Bard who sings or hums while attacking can use Charisma instead of Strength for the melee attack roll.'],
  ["Mariner's Armor", 'Armor', 'Any Light, Medium, or Heavy', 'Uncommon', false, 278, 'While worn you have a Swim Speed equal to your Speed. If you start your turn underwater with 0 Hit Points, you regain 1d4 Hit Points (once per dawn).'],
  ['Moonblade', 'Weapon', 'Greatsword, Longsword, Rapier, Scimitar, or Shortsword', 'Legendary', 'a Creature of the Weapon\'s Choice', 279, 'A sentient elven blade that chooses its bearer. A rejected creature is cursed (Disadvantage on D20 Tests for 24 hours or until Remove Curse). It gains one rune per bearer it has willingly served (typically 1d6 + 1): the first gives +1 to attack and damage rolls and each further rune adds a property, rolled on the Moonblade Properties table. It also has a minor property, Intelligence 12, Wisdom 10, Charisma 12, hearing and Darkvision 120 feet, and communicates by emotion, visions and dreams. For anyone but its chosen bearer it works like a nonmagical weapon.'],
  ['Moon-Touched Sword', 'Weapon', 'Glaive, Greatsword, Longsword, Rapier, Scimitar, or Shortsword', 'Common', false, 280, 'In Darkness the unsheathed blade sheds moonlight: Bright Light in a 15-foot radius and Dim Light for 15 feet more.'],
  ['Mystery Key', 'Wondrous Item', null, 'Common', false, 280, 'A key with a question mark on its head. It has a 5 percent chance of unlocking any lock it is inserted into; once it unlocks something, it disappears.'],
  ["Nature's Mantle", 'Wondrous Item', null, 'Uncommon', 'a Druid or Ranger', 280, 'A cloak that blends with the surrounding terrain. It works as a Spellcasting Focus for your Druid and Ranger spells, and in a Lightly Obscured area you can Hide as a Bonus Action even while directly observed.'],
  ['Orb of Direction', 'Wondrous Item', null, 'Common', false, 283, 'Usable as an Arcane Focus. While holding it, take a Magic action to learn which way is magnetic north (nothing happens where there is none).'],
  ['Orb of Time', 'Wondrous Item', null, 'Common', false, 284, 'Usable as an Arcane Focus. While holding it, take a Magic action to learn whether it is morning, afternoon, evening or night. Works only on the Material Plane.'],
  ['Perfume of Bewitching', 'Wondrous Item', null, 'Common', false, 284, 'One use. As a Magic action, apply it to yourself for 1 hour: Advantage on Charisma (Deception and Persuasion) checks to influence a creature within 5 feet.'],
  ['Pipe of Smoke Monsters', 'Wondrous Item', null, 'Common', false, 285, 'While smoking it, take a Magic action to exhale a puff of smoke shaped like a creature (a dragon, a flumph, a slaad). The shape fits in a 1-foot cube and loses form after a few seconds.'],
  ['Pole of Angling', 'Wondrous Item', null, 'Common', false, 286, 'Works as a Pole. While holding it, take a Magic action to turn it into a fishing pole with hook, line and reel, or back.'],
  ['Pole of Collapsing', 'Wondrous Item', null, 'Common', false, 286, 'Works as a Pole. While holding it, take a Magic action to collapse it into a 1-foot rod (weight unchanged) or extend it again as far as the space allows.'],
  ['Pot of Awakening', 'Wondrous Item', null, 'Common', false, 289, 'Plant an ordinary shrub in this 10-pound clay pot; after 30 days it becomes an Awakened Shrub and breaks the pot. The shrub is Friendly, obeys your commands and otherwise does nothing.'],
  ['Potion of Comprehension', 'Potion', null, 'Common', false, 287, 'Drinking it grants the effect of Comprehend Languages for 1 hour.'],
  ['Potion of Fire Breath', 'Potion', null, 'Uncommon', false, 287, 'After drinking, take a Bonus Action to exhale fire at a target within 30 feet: DC 13 Dexterity save, 4d6 Fire damage on a failure or half on a success. Ends after three uses or 1 hour.'],
  ['Potion of Greater Invisibility', 'Potion', null, 'Very Rare', false, 288, 'Drinking it gives you the Invisible condition for 1 hour.'],
  ['Potion of Pugilism', 'Potion', null, 'Uncommon', false, 289, 'For 10 minutes after drinking, each Unarmed Strike you make deals an extra 1d6 Force damage on a hit.'],
  ['Potion of Vitality', 'Potion', null, 'Very Rare', false, 289, 'Removes all Exhaustion levels and ends the Poisoned condition. For 24 hours, any Hit Point Die you spend restores its maximum.'],
  ['Prosthetic Limb', 'Wondrous Item', null, 'Common', false, 290, 'Replaces a lost hand, arm, foot, leg or similar part and works identically to it. You can detach or reattach it as a Magic action, and it cannot be removed against your will while you live.'],
  ['Quiver of Ehlonna', 'Wondrous Item', null, 'Uncommon', false, 291, 'Three compartments open onto extradimensional space and the quiver never weighs more than 2 pounds: the short one holds up to 60 Arrows, Bolts or similar objects, the midsize one up to 18 Javelins or similar objects, and the long one up to 6 long objects such as bows, Quarterstaffs or Spears. You draw items as from a normal quiver or scabbard.'],
  ['Rival Coin', 'Wondrous Item', null, 'Common', false, 296, 'A gold coin showing two famous rivals. It has 1 charge, regained daily at dawn. As a Magic action, toss it and roll any die. Even (heads): one creature you can see within 60 feet makes a DC 13 Wisdom save, taking 2d4 Psychic damage and having Disadvantage on its next attack roll before the end of its next turn on a failure, or half damage only on a success. Odd (tails): you take 1d4 Psychic damage.'],
  ['Rod of the Pact Keeper', 'Rod', null, 'Uncommon (+1), Rare (+2), or Very Rare (+3)', 'a Warlock', 301, 'While holding it, you gain a bonus (set by rarity) to spell attack rolls and to the save DCs of your Warlock spells. You can also regain one spell slot as a Magic action; once used, not again until a Long Rest.'],
  ['Rope of Mending', 'Wondrous Item', null, 'Common', false, 302, 'A 50-foot rope that can repair itself when cut. As a Magic action, all touching pieces not in use knit back together. It is permanently shorter if a section is lost or destroyed.'],
  ['Ruby of the War Mage', 'Wondrous Item', null, 'Common', 'a Spellcaster', 302, 'A 1-inch ruby that lets a Simple or Martial weapon serve as your Spellcasting Focus. Attach it by pressing it to the weapon for at least 10 minutes. It then stays until you detach it as a Magic action, the weapon is destroyed, or your attunement ends.'],
  ['Saddle of the Cavalier', 'Wondrous Item', null, 'Uncommon', false, 302, 'While you sit in it astride a mount: attack rolls against the mount have Disadvantage, and you can\'t be dismounted against your will (suppressed while you are Incapacitated).'],
  ['Scroll of Protection', 'Scroll', null, 'Rare', false, 302, 'Works against one creature type, chosen by the DM or rolled on a table. Reading it as a Magic action creates a 5-foot Emanation for 5 minutes into which creatures of that type can\'t enter or affect anything in the area (the effect ends if you move so that one would be inside). A creature within 5 feet can try to overcome it as a Magic action with a DC 15 Charisma save.'],
  ['Scroll of Titan Summoning', 'Scroll', null, 'Legendary', false, 303, 'Reading it as a Magic action summons a titan named on the scroll (DM picks or rolls) in an unoccupied space on the ground or in water you can see within 1 mile. It is Hostile to all other creatures and vanishes at 0 Hit Points. If the space is too small the summoning fails and the scroll is wasted.'],
  ['Shield of Expression', 'Armor', 'Shield', 'Common', false, 303, 'The front is shaped like a face. While bearing the Shield, take a Bonus Action to change its expression.'],
  ['Silvered Weapon', 'Weapon', 'Any Simple or Martial', 'Common', false, 304, 'Silver is alchemically bonded to this magic weapon. A Critical Hit with it against a shape-shifted creature deals one additional die of damage.'],
  ['Smoldering Armor', 'Armor', 'Any Heavy, Medium, or Light', 'Common', false, 305, 'Wisps of harmless, odorless smoke rise from the armor while it is worn.'],
  ['Spirit Board', 'Wondrous Item', null, 'Very Rare', false, 306, '3 charges, regaining 1 daily at dawn. While touching the planchette, spend 1 minute to cast Augury (1 charge) or Commune (3 charges), the spirits guiding the planchette to answer. The planchette must rest on the lettered side of the board.'],
  ['Staff of Adornment', 'Staff', null, 'Common', false, 306, 'Up to three Tiny objects of 1 pound or less float an inch above the tip while you hold it, until removed or no longer in your possession. You can slowly spin or turn them.'],
  ['Staff of Birdcalls', 'Staff', null, 'Common', false, 307, '10 charges. While holding it, expend 1 charge as a Magic action to make a bird sound (finch, raven, duck, chicken, goose, loon, turkey, seagull, owl or eagle) audible to 120 feet. Regains 1d6 + 4 charges daily at dawn; after spending the last, roll a d20: on a 1 it explodes in a harmless cloud of feathers and is lost.'],
  ['Staff of Flowers', 'Staff', null, 'Common', false, 308, '10 charges. While holding it, expend 1 charge as a Magic action to sprout a flower from soil within 5 feet or from the staff (a daisy unless you choose a kind). The flower is harmless and nonmagical. Regains 1d6 + 4 charges daily at dawn; after spending the last, roll a d20: on a 1 it turns to petals and is lost.'],
  ['Staff of the Adder', 'Staff', null, 'Uncommon', true, 309, 'As a Bonus Action, turn the head into a venomous snake for 1 minute or revert it. When you take the Attack action, one attack can use the snake head (reach 5 feet, your Proficiency Bonus and Wisdom modifier): 1d6 Piercing plus 3d6 Poison damage on a hit. The head has AC 15, HP 20, and Immunity to Poison and Psychic; if it drops to 0 Hit Points the staff is destroyed, and it regains all Hit Points when it reverts.'],
  ['Sword of Answering', 'Weapon', 'Longsword', 'Legendary', true, 313, '+3 bonus to attack and damage rolls. While you hold it, as a Reaction make one melee attack against any creature in reach that damages you, with Advantage; its damage ignores Immunity and Resistance.'],
  ['Sword of Vengeance', 'Weapon', 'Glaive, Greatsword, Longsword, Rapier, Scimitar, or Shortsword', 'Uncommon', true, 314, '+1 bonus to attack and damage rolls. Cursed: attuning extends the curse to you. You won\'t part with it, have Disadvantage on attack rolls with other weapons, and when another creature damages you in combat you must pass a DC 15 Wisdom save or attack that creature until you or it drops to 0 Hit Points or you can\'t reach it. Banishment cast on the weapon ends it, leaving a +1 Weapon.'],
  ['Sylvan Talon', 'Weapon', 'Dagger, Rapier, Scimitar, Shortsword, Sickle, or Spear', 'Common', true, 314, 'While on your person, you understand the nonwritten communication of all Fey and they understand yours. As a Magic action you can cast Message from it, once per dawn.'],
  ['Talking Doll', 'Wondrous Item', null, 'Common', true, 315, 'Within 5 feet of the doll, spend a Short Rest teaching it up to six phrases of six words or fewer, each with a trigger condition that must occur within 5 feet of it. You can replace phrases. They are lost when your attunement ends.'],
  ['Tankard of Sobriety', 'Wondrous Item', null, 'Common', false, 315, 'You can drink nonmagical alcohol poured into it without becoming inebriated. No effect on magical liquids or harmful substances such as poison.'],
  ['Tentacle Rod', 'Rod', null, 'Rare', true, 316, 'As a Magic action, three tentacles each attack a creature you can see within 15 feet (+9 to hit, 1d6 Psychic damage). If all three hit the same target, it makes a DC 15 Dexterity save or is Restrained and takes 3d6 Psychic damage at the start of each of its turns; it repeats the save at the end of each turn. The Restrained effect ends if you are Incapacitated, release it as a Bonus Action, or it moves more than 15 feet away.'],
  ['Tome of the Stilled Tongue', 'Wondrous Item', null, 'Legendary', 'a Wizard', 317, 'One of five tomes tied to Vecna, with a desiccated tongue pinned to the cover and blank pages. While attuned you can use it as a Spellbook and an Arcane Focus, and as a Bonus Action cast a spell written in it without a spell slot or Verbal or Somatic components; once used, not again until the next dawn. The remaining properties are on p.317.'],
  ["Veteran's Cane", 'Wondrous Item', null, 'Common', false, 318, 'While holding it, take a Bonus Action to turn the walking cane into an ordinary Longsword or back.'],
  ['Walloping Ammunition', 'Weapon', 'Any Ammunition', 'Common', false, 318, 'A creature hit by it must succeed on a DC 10 Strength save or have the Prone condition.'],
  ['Wand of Conducting', 'Wand', null, 'Common', false, 319, '3 charges, all regained daily at dawn. While holding it, expend 1 charge as a Magic action to create orchestral music audible to 120 feet that lasts while you wave the wand. After the last charge, roll a d20: on a 1 it crumbles to dust with a sad tuba sound.'],
  ['Wand of Pyrotechnics', 'Wand', null, 'Common', false, 321, '7 charges. While holding it, expend 1 charge as a Magic action to make a harmless burst of multicolored light, as bright as a torch flame for one second, at a point you can see within 120 feet, with a crackle audible to 300 feet. Regains 1d6 + 1 charges daily at dawn; after the last, roll a d20: on a 1 it is destroyed in a harmless display.'],
  ['Wraps of Unarmed Power', 'Wondrous Item', null, 'Uncommon (+1), Rare (+2), or Very Rare (+3)', false, 325, 'While worn, you gain a bonus (set by rarity) to attack and damage rolls with your Unarmed Strikes, and those strikes deal your choice of Force damage or their normal damage type.'],
];

export const DMG_MAGIC_ITEMS: readonly DmgMagicItem[] = ROWS.map(
  ([name, category, typeDetail, rarity, attunement, page, description]) => ({
    id: slug(name),
    name,
    category,
    typeDetail,
    rarity,
    requiresAttunement: attunement !== false,
    attunementCondition: typeof attunement === 'string' ? attunement : null,
    description,
    page,
  }),
);
