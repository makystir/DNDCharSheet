import type { Ability, CustomStatBlock, NamedStatEntry } from '../types/character';

/**
 * Monster Manual 2024 humanoid NPC stat blocks offered as starting templates for
 * NPC party members.
 *
 * Scope (DMG 2024 L3557): an NPC party member uses a Monster Manual stat block
 * whose Challenge Rating is no higher than half the characters' level, so with a
 * level cap of 20 nothing above CR 10 is ever suitable. Left out for that reason:
 * Archmage and Questing Knight (CR 12), Bandit Crime Lord (CR 11, p.28), Pirate
 * Admiral (CR 12, p.242), Archpriest (CR 12, p.248). The four themed cultists on
 * p.86 are also left out.
 *
 * Every number was read from the printed page images of
 * Docs/DnD 5e 2024 Monster Manual Alternate Cover.pdf (the .md OCR is unreliable).
 * Numbers are exact; trait and action text is paraphrased. Printed values that
 * look inconsistent are kept as printed (e.g. Priest Radiant Flame +4, Warrior
 * Veteran Initiative +3). src/data/npc-templates.test.ts checks every block
 * against an independently built golden fixture and the 2024 arithmetic.
 */
export interface NpcTemplate {
  id: string;
  name: string;
  /** Printed Monster Manual 2024 page. */
  page: number;
  /** Printed Hit Point dice, e.g. "2d8 + 2" (the average is `stats.hpMax`). */
  hpDice: string;
  stats: CustomStatBlock;
}

type Scores = readonly [str: number, dex: number, con: number, int: number, wis: number, cha: number];

interface TemplateInput {
  id: string;
  name: string;
  page: number;
  type?: string;
  ac: number;
  init: number;
  hp: number;
  hpDice: string;
  speed?: string;
  scores: Scores;
  saves?: Ability[];
  pb: number;
  cr: string;
  xp: number;
  skills?: string;
  resistances?: string;
  immunities?: string;
  gear?: string;
  passive: number;
  languages: string;
  traits?: NamedStatEntry[];
  actions: NamedStatEntry[];
  bonusActions?: NamedStatEntry[];
  reactions?: NamedStatEntry[];
}

function e(name: string, description: string): NamedStatEntry {
  return { name, description };
}

function mk(t: TemplateInput): NpcTemplate {
  const [str, dex, con, int, wis, cha] = t.scores;
  const stats: CustomStatBlock = {
    creatureType: t.type ?? 'Humanoid',
    alignment: 'Neutral',
    ac: t.ac,
    initiativeMod: t.init,
    hpMax: t.hp,
    speed: t.speed ?? '30 ft.',
    abilities: { str, dex, con, int, wis, cha },
    proficiencyBonus: t.pb,
    senses: `Passive Perception ${t.passive}`,
    languages: t.languages,
    cr: t.cr,
    xp: t.xp,
    actions: t.actions,
  };
  if (t.saves && t.saves.length > 0) stats.saveProficiencies = t.saves;
  if (t.skills) stats.skills = t.skills;
  if (t.resistances) stats.resistances = t.resistances;
  if (t.immunities) stats.immunities = t.immunities;
  if (t.gear) stats.gear = t.gear;
  if (t.traits) stats.traits = t.traits;
  if (t.bonusActions) stats.bonusActions = t.bonusActions;
  if (t.reactions) stats.reactions = t.reactions;
  return { id: t.id, name: t.name, page: t.page, hpDice: t.hpDice, stats };
}

const CUNNING_ACTION = e('Cunning Action', 'Takes the Dash, Disengage, or Hide action.');
const PACK_TACTICS = e(
  'Pack Tactics',
  'Has Advantage on an attack roll against a creature if at least one of its allies is within 5 feet of that creature and the ally doesn\'t have the Incapacitated condition.',
);
const UNCANNY_DODGE = e('Uncanny Dodge', 'Trigger: It is hit by an attack roll. Response: It halves the attack\'s damage against it (round down).');
const parry = (ac: number) =>
  e('Parry', `Trigger: It is hit by a melee attack roll while holding a weapon. Response: It adds ${ac} to its AC against that attack, possibly causing it to miss.`);
const BLOODIED_FRENZY = e('Bloodied Frenzy', 'While Bloodied, it has Advantage on attack rolls and saving throws.');

export const NPC_TEMPLATE_LIST: readonly NpcTemplate[] = [
  // MM 2024 p.22
  mk({
    id: 'assassin', name: 'Assassin', page: 22, ac: 16, init: 10, hp: 97, hpDice: '15d8 + 30',
    scores: [11, 18, 14, 16, 11, 10], saves: ['dex', 'int'], pb: 3, cr: '8', xp: 3900,
    skills: 'Acrobatics +7, Perception +6, Stealth +10', resistances: 'Poison',
    gear: 'Light Crossbow, Shortsword, Studded Leather Armor', passive: 16, languages: "Common, Thieves' Cant",
    traits: [e('Evasion', 'When an effect lets it make a Dexterity saving throw to take only half damage, it instead takes no damage on a success and half damage on a failure. It can\'t use this trait while Incapacitated.')],
    actions: [
      e('Multiattack', 'Makes three attacks, using Shortsword or Light Crossbow in any combination.'),
      e('Shortsword', "Melee Attack Roll: +7, reach 5 ft. Hit: 7 (1d6 + 4) Piercing damage plus 17 (5d6) Poison damage, and the target has the Poisoned condition until the start of the assassin's next turn."),
      e('Light Crossbow', 'Ranged Attack Roll: +7, range 80/320 ft. Hit: 8 (1d8 + 4) Piercing damage plus 21 (6d6) Poison damage.'),
    ],
    bonusActions: [CUNNING_ACTION],
  }),
  // MM 2024 p.27
  mk({
    id: 'bandit', name: 'Bandit', page: 27, ac: 12, init: 1, hp: 11, hpDice: '2d8 + 2',
    scores: [11, 12, 12, 10, 10, 10], pb: 2, cr: '1/8', xp: 25,
    gear: 'Leather Armor, Light Crossbow, Scimitar', passive: 10, languages: "Common, Thieves' Cant",
    actions: [
      e('Scimitar', 'Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Slashing damage.'),
      e('Light Crossbow', 'Ranged Attack Roll: +3, range 80/320 ft. Hit: 5 (1d8 + 1) Piercing damage.'),
    ],
  }),
  // MM 2024 p.27
  mk({
    id: 'bandit-captain', name: 'Bandit Captain', page: 27, ac: 15, init: 3, hp: 52, hpDice: '8d8 + 16',
    scores: [15, 16, 14, 14, 11, 14], saves: ['str', 'dex', 'wis'], pb: 2, cr: '2', xp: 450,
    skills: 'Athletics +4, Deception +4', gear: 'Pistol, Scimitar, Studded Leather Armor', passive: 10, languages: "Common, Thieves' Cant",
    actions: [
      e('Multiattack', 'Makes two attacks, using Scimitar and Pistol in any combination.'),
      e('Scimitar', 'Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Slashing damage.'),
      e('Pistol', 'Ranged Attack Roll: +5, range 30/90 ft. Hit: 8 (1d10 + 3) Piercing damage.'),
    ],
    reactions: [parry(2)],
  }),
  // MM 2024 p.28
  mk({
    id: 'bandit-deceiver', name: 'Bandit Deceiver', page: 28, ac: 16, init: 6, hp: 130, hpDice: '20d8 + 40',
    scores: [8, 16, 14, 17, 12, 16], saves: ['dex', 'int'], pb: 3, cr: '7', xp: 2900,
    skills: 'Acrobatics +6, Perception +4, Stealth +9', gear: 'Daggers (6), Wand', passive: 14, languages: "Common, Thieves' Cant",
    actions: [
      e('Multiattack', 'Makes three Dagger attacks.'),
      e('Dagger', 'Melee or Ranged Attack Roll: +6, reach 5 ft. or range 20/60 ft. Hit: 8 (2d4 + 3) Piercing damage plus 10 (3d6) Poison damage.'),
      e('Blinding Flash (Recharge 4-6)', "Constitution Saving Throw: DC 14, each creature in a 10-foot-radius Sphere centered on a point it can see within 120 feet. Failure: 13 (3d6 + 3) Radiant damage, and the target has the Blinded condition until the start of the bandit's next turn. Success: Half damage only."),
      e('Spellcasting', 'Casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 14). At will: Disguise Self, Mage Hand, Minor Illusion. 1/Day each: Hold Person (level 4 version), Mage Armor (included in AC), Major Image.'),
    ],
  }),
  // MM 2024 p.37
  mk({
    id: 'berserker', name: 'Berserker', page: 37, ac: 13, init: 1, hp: 67, hpDice: '9d8 + 27',
    scores: [16, 12, 17, 9, 11, 9], pb: 2, cr: '2', xp: 450,
    gear: 'Greataxe, Hide Armor', passive: 10, languages: 'Common',
    traits: [BLOODIED_FRENZY],
    actions: [e('Greataxe', 'Melee Attack Roll: +5, reach 5 ft. Hit: 9 (1d12 + 3) Slashing damage.')],
  }),
  // MM 2024 p.37
  mk({
    id: 'berserker-commander', name: 'Berserker Commander', page: 37, ac: 16, init: 5, hp: 136, hpDice: '16d8 + 64', speed: '40 ft.',
    scores: [19, 14, 19, 10, 14, 9], saves: ['str', 'con'], pb: 3, cr: '8', xp: 3900,
    skills: 'Athletics +7, Perception +5', immunities: 'Charmed, Frightened', gear: 'Greataxe, Javelins (6)', passive: 15, languages: 'Common',
    traits: [BLOODIED_FRENZY],
    actions: [
      e('Multiattack', 'Makes three attacks, using Greataxe or Javelin in any combination.'),
      e('Greataxe', 'Melee Attack Roll: +7, reach 5 ft. Hit: 10 (1d12 + 4) Slashing damage plus 10 (3d6) Thunder damage, dealt to the target or to another creature within 5 feet of the target.'),
      e('Javelin', "Melee or Ranged Attack Roll: +7, reach 5 ft. or range 30/120 ft. Hit: 18 (4d6 + 4) Piercing damage, and the target's Speed decreases by 5 feet until the start of the berserker's next turn."),
    ],
    bonusActions: [
      e('Frenzied Rush', 'Each ally within 30 feet of it can take a Reaction to move up to half its Speed without provoking Opportunity Attacks. The berserker can also move up to half its Speed without provoking Opportunity Attacks.'),
    ],
  }),
  // MM 2024 p.77
  mk({
    id: 'commoner', name: 'Commoner', page: 77, ac: 10, init: 0, hp: 4, hpDice: '1d8',
    scores: [10, 10, 10, 10, 10, 10], pb: 2, cr: '0', xp: 10,
    gear: 'Club', passive: 10, languages: 'Common',
    traits: [e('Training', "Has proficiency in one skill of the DM's choice and has Advantage whenever it makes an ability check using that skill.")],
    actions: [e('Club', 'Melee Attack Roll: +2, reach 5 ft. Hit: 2 (1d4) Bludgeoning damage.')],
  }),
  // MM 2024 p.84
  mk({
    id: 'cultist', name: 'Cultist', page: 84, ac: 12, init: 1, hp: 9, hpDice: '2d8',
    scores: [11, 12, 10, 10, 11, 10], saves: ['wis'], pb: 2, cr: '1/8', xp: 25,
    skills: 'Deception +2, Religion +2', gear: 'Leather Armor, Sickle', passive: 10, languages: 'Common',
    actions: [e('Ritual Sickle', 'Melee Attack Roll: +3, reach 5 ft. Hit: 3 (1d4 + 1) Slashing damage plus 1 Necrotic damage.')],
  }),
  // MM 2024 p.85
  mk({
    id: 'cultist-fanatic', name: 'Cultist Fanatic', page: 85, ac: 13, init: 2, hp: 44, hpDice: '8d8 + 8',
    scores: [11, 14, 12, 10, 14, 13], saves: ['wis'], pb: 2, cr: '2', xp: 450,
    skills: 'Deception +3, Persuasion +3, Religion +2', gear: 'Holy Symbol, Leather Armor', passive: 12, languages: 'Common',
    actions: [
      e('Pact Blade', 'Melee Attack Roll: +4, reach 5 ft. Hit: 6 (1d8 + 2) Slashing damage plus 7 (2d6) Necrotic damage.'),
      e('Spellcasting', 'Casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 12, +4 to hit with spell attacks). At will: Light, Thaumaturgy. 2/Day: Command. 1/Day: Hold Person.'),
    ],
    bonusActions: [e('Spiritual Weapon (2/Day)', 'Casts Spiritual Weapon, using the same spellcasting ability as Spellcasting.')],
  }),
  // MM 2024 p.85
  mk({
    id: 'cultist-hierophant', name: 'Cultist Hierophant', page: 85, ac: 16, init: 8, hp: 144, hpDice: '17d8 + 68',
    scores: [14, 18, 18, 13, 16, 20], saves: ['wis', 'cha'], pb: 4, cr: '10', xp: 5900,
    skills: 'Perception +7, Persuasion +9, Religion +5', gear: 'Breastplate, Holy Symbol', passive: 17, languages: 'Celestial, Common',
    actions: [
      e('Multiattack', 'Makes three attacks, using Pact Blade or Radiant Ray in any combination.'),
      e('Pact Blade', 'Melee Attack Roll: +9, reach 5 ft. Hit: 12 (2d6 + 5) Slashing damage plus 18 (4d8) Radiant damage.'),
      e('Radiant Ray', 'Ranged Attack Roll: +9, range 120 ft. Hit: 31 (4d12 + 5) Radiant damage.'),
      e('Spellcasting', "Casts one of the following spells, using Charisma as the spellcasting ability (spell save DC 17). At will: Mage Armor (included in AC), Thaumaturgy. 1/Day each: Jallarzi's Storm of Radiance (level 7 version), Mass Suggestion."),
    ],
  }),
  // MM 2024 p.106
  mk({
    id: 'druid', name: 'Druid', page: 106, type: 'Humanoid (Druid)', ac: 13, init: 1, hp: 44, hpDice: '8d8 + 8',
    scores: [10, 12, 13, 12, 16, 11], pb: 2, cr: '2', xp: 450,
    skills: 'Medicine +5, Nature +3, Perception +5', gear: 'Studded Leather Armor', passive: 15, languages: 'Common, Druidic, Sylvan',
    actions: [
      e('Multiattack', 'Makes two attacks, using Vine Staff or Verdant Wisp in any combination.'),
      e('Vine Staff', 'Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Bludgeoning damage plus 2 (1d4) Poison damage.'),
      e('Verdant Wisp', 'Ranged Attack Roll: +5, range 90 ft. Hit: 10 (3d6) Radiant damage.'),
      e('Spellcasting', 'Casts one of the following spells, using Wisdom as the spellcasting ability (spell save DC 13). At will: Druidcraft, Speak with Animals. 2/Day each: Entangle, Thunderwave. 1/Day each: Animal Messenger, Longstrider, Moonbeam.'),
    ],
  }),
  // MM 2024 p.139
  mk({
    id: 'gladiator', name: 'Gladiator', page: 139, ac: 16, init: 5, hp: 112, hpDice: '15d8 + 45',
    scores: [18, 15, 16, 10, 12, 15], saves: ['str', 'dex', 'con', 'wis'], pb: 3, cr: '5', xp: 1800,
    skills: 'Athletics +10, Performance +5', gear: 'Shield, Spears (3), Studded Leather Armor', passive: 11, languages: 'Common',
    actions: [
      e('Multiattack', 'Makes three Spear attacks. It can replace one attack with a use of Shield Bash.'),
      e('Spear', 'Melee or Ranged Attack Roll: +7, reach 5 ft. or range 20/60 ft. Hit: 11 (2d6 + 4) Piercing damage.'),
      e('Shield Bash', 'Strength Saving Throw: DC 15, one creature it can see within 5 feet. Failure: 9 (2d4 + 4) Bludgeoning damage, and a Medium or smaller target has the Prone condition.'),
    ],
    reactions: [parry(3)],
  }),
  // MM 2024 p.162
  mk({
    id: 'guard', name: 'Guard', page: 162, ac: 16, init: 1, hp: 11, hpDice: '2d8 + 2',
    scores: [13, 12, 12, 10, 11, 10], pb: 2, cr: '1/8', xp: 25,
    skills: 'Perception +2', gear: 'Chain Shirt, Shield, Spear', passive: 12, languages: 'Common',
    actions: [e('Spear', 'Melee or Ranged Attack Roll: +3, reach 5 ft. or range 20/60 ft. Hit: 4 (1d6 + 1) Piercing damage.')],
  }),
  // MM 2024 p.162
  mk({
    id: 'guard-captain', name: 'Guard Captain', page: 162, ac: 18, init: 4, hp: 75, hpDice: '10d8 + 30',
    scores: [18, 14, 16, 12, 14, 13], pb: 2, cr: '4', xp: 1100,
    skills: 'Athletics +6, Perception +4', gear: 'Breastplate, Javelins (6), Longsword, Shield', passive: 14, languages: 'Common',
    actions: [
      e('Multiattack', 'Makes two attacks, using Javelin or Longsword in any combination.'),
      e('Javelin', 'Melee or Ranged Attack Roll: +6, reach 5 ft. or range 30/120 ft. Hit: 14 (3d6 + 4) Piercing damage.'),
      e('Longsword', 'Melee Attack Roll: +6, reach 5 ft. Hit: 15 (2d10 + 4) Slashing damage.'),
    ],
  }),
  // MM 2024 p.184
  mk({
    id: 'knight', name: 'Knight', page: 184, ac: 18, init: 0, hp: 52, hpDice: '8d8 + 16',
    scores: [16, 11, 14, 11, 11, 15], saves: ['con', 'wis'], pb: 2, cr: '3', xp: 700,
    immunities: 'Frightened', gear: 'Greatsword, Heavy Crossbow, Plate Armor', passive: 10, languages: 'Common plus one other language',
    actions: [
      e('Multiattack', 'Makes two attacks, using Greatsword or Heavy Crossbow in any combination.'),
      e('Greatsword', 'Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage plus 4 (1d8) Radiant damage.'),
      e('Heavy Crossbow', 'Ranged Attack Roll: +2, range 100/400 ft. Hit: 11 (2d10) Piercing damage plus 4 (1d8) Radiant damage.'),
    ],
    reactions: [parry(2)],
  }),
  // MM 2024 p.199
  mk({
    id: 'mage', name: 'Mage', page: 199, type: 'Humanoid (Wizard)', ac: 15, init: 2, hp: 81, hpDice: '18d8',
    scores: [9, 14, 11, 17, 12, 11], saves: ['int', 'wis'], pb: 3, cr: '6', xp: 2300,
    skills: 'Arcana +6, History +6, Perception +4', gear: 'Wand', passive: 14, languages: 'Common plus three other languages',
    actions: [
      e('Multiattack', 'Makes three Arcane Burst attacks.'),
      e('Arcane Burst', 'Melee or Ranged Attack Roll: +6, reach 5 ft. or range 120 ft. Hit: 16 (3d8 + 3) Force damage.'),
      e('Spellcasting', 'Casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 14). At will: Detect Magic, Light, Mage Armor (included in AC), Mage Hand, Prestidigitation. 2/Day each: Fireball (level 4 version), Invisibility. 1/Day each: Cone of Cold, Fly.'),
    ],
    bonusActions: [e('Misty Step (3/Day)', 'Casts Misty Step, using the same spellcasting ability as Spellcasting.')],
    reactions: [e('Protective Magic (3/Day)', "Casts Counterspell or Shield in response to that spell's trigger, using the same spellcasting ability as Spellcasting.")],
  }),
  // MM 2024 p.198
  mk({
    id: 'mage-apprentice', name: 'Mage Apprentice', page: 198, type: 'Humanoid (Wizard)', ac: 15, init: 2, hp: 49, hpDice: '9d8 + 9',
    scores: [8, 14, 12, 16, 13, 10], saves: ['int', 'wis'], pb: 2, cr: '2', xp: 450,
    skills: 'Arcana +5, Perception +3', gear: 'Component Pouch', passive: 13, languages: 'Common plus one other language',
    actions: [
      e('Arcane Burst', 'Melee or Ranged Attack Roll: +5, reach 5 ft. or range 120 ft. Hit: 14 (2d10 + 3) Force damage.'),
      e('Spellcasting', 'Casts one of the following spells, using Intelligence as the spellcasting ability (spell save DC 13, +5 to hit with spell attacks). At will: Mage Hand, Prestidigitation. 1/Day each: Disguise Self, Ice Knife, Mage Armor (included in AC), Thunderwave.'),
    ],
  }),
  // MM 2024 p.227
  mk({
    id: 'noble', name: 'Noble', page: 227, ac: 15, init: 1, hp: 9, hpDice: '2d8',
    scores: [11, 12, 11, 12, 14, 16], pb: 2, cr: '1/8', xp: 25,
    skills: 'Deception +5, Insight +4, Persuasion +5', gear: 'Breastplate, Rapier', passive: 12, languages: 'Common plus two other languages',
    actions: [e('Rapier', 'Melee Attack Roll: +3, reach 5 ft. Hit: 5 (1d8 + 1) Piercing damage.')],
    reactions: [parry(2)],
  }),
  // MM 2024 p.227
  mk({
    id: 'noble-prodigy', name: 'Noble Prodigy', page: 227, ac: 16, init: 7, hp: 148, hpDice: '27d8 + 27',
    scores: [8, 16, 12, 15, 14, 19], saves: ['dex', 'con', 'wis', 'cha'], pb: 4, cr: '10', xp: 5900,
    skills: 'Perception +6, Persuasion +8', passive: 16, languages: 'Common plus two other languages',
    actions: [
      e('Multiattack', 'Makes three Beguiling Strike attacks.'),
      e('Beguiling Strike', "Melee or Ranged Attack Roll: +8, reach 5 ft. or range 60 ft. Hit: 18 (4d6 + 4) Psychic damage, and the target has the Charmed condition until the start of the noble's next turn."),
      e('Spellcasting', 'Casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 16). At will: Mage Armor (included in AC), Mage Hand, Minor Illusion. 1/Day each: Befuddlement, Detect Thoughts, Fly, Scrying, Shatter (level 7 version).'),
    ],
    reactions: [e('Shield (2/Day)', "Casts Shield in response to that spell's trigger, using the same spellcasting ability as Spellcasting.")],
  }),
  // MM 2024 p.236
  mk({
    id: 'performer', name: 'Performer', page: 236, ac: 13, init: 3, hp: 27, hpDice: '5d8 + 5',
    scores: [12, 16, 12, 13, 14, 16], saves: ['dex', 'cha'], pb: 2, cr: '1/2', xp: 100,
    skills: 'Acrobatics +5, Athletics +3, Performance +7', gear: 'Shortsword', passive: 12, languages: 'Common plus one other language',
    actions: [e('Shortsword', 'Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Piercing damage.')],
    reactions: [UNCANNY_DODGE],
  }),
  // MM 2024 p.237
  mk({
    id: 'performer-maestro', name: 'Performer Maestro', page: 237, ac: 18, init: 8, hp: 110, hpDice: '17d8 + 34',
    scores: [12, 18, 14, 13, 14, 19], saves: ['dex', 'cha'], pb: 3, cr: '6', xp: 2300,
    skills: 'Acrobatics +10, Athletics +4, Perception +5, Performance +10, Stealth +7', gear: 'Rapier', passive: 15, languages: 'Common plus one other language',
    actions: [
      e('Multiattack', 'Makes three Rapier attacks.'),
      e('Rapier', 'Melee Attack Roll: +7, reach 5 ft. Hit: 8 (1d8 + 4) Piercing damage plus 7 (2d6) Psychic damage.'),
      e('Beguiling Song', "Wisdom Saving Throw: DC 15, each creature in a 20-foot-radius Sphere centered on a point it can see within 120 feet. Failure: 20 (3d10 + 4) Psychic damage, and the target has the Charmed condition until the end of the performer's next turn. Success: Half damage only."),
      e('Spellcasting', "Casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 15). At will: Minor Illusion, Prestidigitation. 1/Day: Tasha's Hideous Laughter (level 3 version)."),
    ],
  }),
  // MM 2024 p.237
  mk({
    id: 'performer-legend', name: 'Performer Legend', page: 237, ac: 20, init: 10, hp: 162, hpDice: '25d8 + 50',
    scores: [12, 20, 14, 15, 16, 20], saves: ['dex', 'int', 'wis', 'cha'], pb: 4, cr: '10', xp: 5900,
    skills: 'Acrobatics +13, Athletics +5, Perception +7, Performance +13, Stealth +9', passive: 17, languages: 'Common plus two other languages',
    actions: [
      e('Multiattack', 'Makes three Bejeweled Baton attacks.'),
      e('Bejeweled Baton', 'Melee Attack Roll: +9, reach 5 ft. Hit: 10 (2d4 + 5) Bludgeoning damage plus 10 (3d6) Psychic damage.'),
      e('Majestic Song', "Wisdom Saving Throw: DC 17, each creature in a 20-foot-radius Sphere centered on a point it can see within 120 feet. Failure: 22 (4d8 + 4) Psychic damage, and the target has the Charmed or Frightened condition (performer's choice) until the end of the performer's next turn. Success: Half damage only."),
      e('Spellcasting', 'Casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 17). At will: Mage Hand, Minor Illusion, Prestidigitation. 1/Day each: Major Image, Project Image.'),
    ],
    reactions: [
      e('Warding Charm', "Trigger: A creature hits it with an attack roll. Response: Wisdom Saving Throw: DC 17, the triggering creature. Failure: The attack misses, and the creature has the Charmed condition until the end of the performer's next turn."),
    ],
  }),
  // MM 2024 p.241
  mk({
    id: 'pirate', name: 'Pirate', page: 241, ac: 14, init: 5, hp: 33, hpDice: '6d8 + 6',
    scores: [10, 16, 12, 8, 12, 14], saves: ['dex', 'cha'], pb: 2, cr: '1', xp: 200,
    gear: 'Daggers (6), Leather Armor', passive: 11, languages: 'Common plus one other language',
    actions: [
      e('Multiattack', 'Makes two Dagger attacks. It can replace one attack with a use of Enthralling Panache.'),
      e('Dagger', 'Melee or Ranged Attack Roll: +5, reach 5 ft. or range 20/60 ft. Hit: 5 (1d4 + 3) Piercing damage.'),
      e('Enthralling Panache', "Wisdom Saving Throw: DC 12, one creature it can see within 30 feet. Failure: The target has the Charmed condition until the start of the pirate's next turn."),
    ],
  }),
  // MM 2024 p.242
  mk({
    id: 'pirate-captain', name: 'Pirate Captain', page: 242, ac: 17, init: 7, hp: 84, hpDice: '13d8 + 26',
    scores: [10, 18, 14, 10, 14, 17], saves: ['str', 'dex', 'wis', 'cha'], pb: 3, cr: '6', xp: 2300,
    skills: 'Acrobatics +7, Perception +5', gear: 'Pistol, Rapier', passive: 15, languages: 'Common plus one other language',
    actions: [
      e('Multiattack', 'Makes three attacks, using Rapier or Pistol in any combination.'),
      e('Rapier', 'Melee Attack Roll: +7, reach 5 ft. Hit: 13 (2d8 + 4) Piercing damage, and it has Advantage on the next attack roll it makes before the end of this turn.'),
      e('Pistol', 'Ranged Attack Roll: +7, range 30/90 ft. Hit: 15 (2d10 + 4) Piercing damage.'),
    ],
    bonusActions: [
      e("Captain's Charm", "Wisdom Saving Throw: DC 14, one creature it can see within 30 feet. Failure: The target has the Charmed condition until the start of the pirate's next turn."),
    ],
    reactions: [
      e('Riposte', 'Trigger: It is hit by a melee attack roll while holding a weapon. Response: It adds 3 to its AC against that attack, possibly causing it to miss. On a miss, it makes one Rapier attack against the triggering creature if that creature is within range.'),
    ],
  }),
  // MM 2024 p.248
  mk({
    id: 'priest', name: 'Priest', page: 248, type: 'Humanoid (Cleric)', ac: 13, init: 0, hp: 38, hpDice: '7d8 + 7',
    scores: [16, 10, 12, 13, 16, 13], pb: 2, cr: '2', xp: 450,
    skills: 'Medicine +7, Perception +5, Religion +5', gear: 'Chain Shirt, Holy Symbol, Mace', passive: 15, languages: 'Common plus one other language',
    actions: [
      e('Multiattack', 'Makes two attacks, using Mace or Radiant Flame in any combination.'),
      e('Mace', 'Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Bludgeoning damage plus 5 (2d4) Radiant damage.'),
      // Printed +4 (Wisdom +3 and PB +2 would give +5); kept as printed.
      e('Radiant Flame', 'Ranged Attack Roll: +4, range 60 ft. Hit: 11 (2d10) Radiant damage.'),
      e('Spellcasting', 'Casts one of the following spells, using Wisdom as the spellcasting ability. At will: Light, Thaumaturgy. 1/Day: Spirit Guardians.'),
    ],
    bonusActions: [e('Divine Aid (3/Day)', 'Casts Bless, Dispel Magic, Healing Word, or Lesser Restoration, using the same spellcasting ability as Spellcasting.')],
  }),
  // MM 2024 p.247
  mk({
    id: 'priest-acolyte', name: 'Priest Acolyte', page: 247, type: 'Humanoid (Cleric)', ac: 13, init: 0, hp: 11, hpDice: '2d8 + 2',
    scores: [14, 10, 12, 10, 14, 11], pb: 2, cr: '1/4', xp: 50,
    skills: 'Medicine +4, Religion +2', gear: 'Chain Shirt, Holy Symbol, Mace', passive: 12, languages: 'Common',
    actions: [
      e('Mace', 'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Bludgeoning damage plus 2 (1d4) Radiant damage.'),
      e('Radiant Flame', 'Ranged Attack Roll: +4, range 60 ft. Hit: 7 (2d6) Radiant damage.'),
      e('Spellcasting', 'Casts one of the following spells, using Wisdom as the spellcasting ability. At will: Light, Thaumaturgy.'),
    ],
    bonusActions: [e('Divine Aid (1/Day)', 'Casts Bless, Healing Word, or Sanctuary, using the same spellcasting ability as Spellcasting.')],
  }),
  // MM 2024 p.270
  mk({
    id: 'scout', name: 'Scout', page: 270, ac: 13, init: 2, hp: 16, hpDice: '3d8 + 3',
    scores: [11, 14, 12, 11, 13, 11], pb: 2, cr: '1/2', xp: 100,
    skills: 'Nature +4, Perception +5, Stealth +6, Survival +5', gear: 'Leather Armor, Longbow, Shortsword', passive: 15, languages: 'Common plus one other language',
    actions: [
      e('Multiattack', 'Makes two attacks, using Shortsword and Longbow in any combination.'),
      e('Shortsword', 'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage.'),
      e('Longbow', 'Ranged Attack Roll: +4, range 150/600 ft. Hit: 6 (1d8 + 2) Piercing damage.'),
    ],
  }),
  // MM 2024 p.270
  mk({
    id: 'scout-captain', name: 'Scout Captain', page: 270, ac: 15, init: 5, hp: 66, hpDice: '12d8 + 12', speed: '30 ft., Climb 30 ft.',
    scores: [11, 16, 12, 14, 15, 11], saves: ['dex', 'int'], pb: 2, cr: '3', xp: 700,
    skills: 'Perception +6, Stealth +7, Survival +6', gear: 'Longbow, Shortsword, Studded Leather Armor', passive: 16, languages: 'Common plus one other language',
    actions: [
      e('Multiattack', 'Makes two attacks, using Shortsword or Longbow in any combination.'),
      e('Shortsword', 'Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Piercing damage, plus 10 (3d6) Piercing damage if the attack roll had Advantage.'),
      e('Longbow', 'Ranged Attack Roll: +5, range 150/600 ft. Hit: 7 (1d8 + 3) Piercing damage, plus 10 (3d6) Piercing damage if the attack roll had Advantage.'),
    ],
    bonusActions: [e('Aim', 'Has Advantage on the next attack roll it makes during the current turn.')],
    reactions: [UNCANNY_DODGE],
  }),
  // MM 2024 p.295
  mk({
    id: 'spy', name: 'Spy', page: 295, ac: 12, init: 4, hp: 27, hpDice: '6d8', speed: '30 ft., Climb 30 ft.',
    scores: [10, 15, 10, 12, 14, 16], pb: 2, cr: '1', xp: 200,
    skills: 'Deception +5, Insight +4, Investigation +5, Perception +6, Sleight of Hand +4, Stealth +6',
    gear: "Hand Crossbow, Shortsword, Thieves' Tools", passive: 16, languages: 'Common plus one other language',
    actions: [
      e('Shortsword', 'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage plus 7 (2d6) Poison damage.'),
      e('Hand Crossbow', 'Ranged Attack Roll: +4, range 30/120 ft. Hit: 5 (1d6 + 2) Piercing damage plus 7 (2d6) Poison damage.'),
    ],
    bonusActions: [CUNNING_ACTION],
  }),
  // MM 2024 p.295
  mk({
    id: 'spy-master', name: 'Spy Master', page: 295, ac: 19, init: 9, hp: 137, hpDice: '25d8 + 25', speed: '30 ft., Climb 30 ft.',
    scores: [10, 20, 12, 18, 16, 16], saves: ['dex', 'con', 'int', 'wis'], pb: 4, cr: '10', xp: 5900,
    skills: 'Deception +7, Insight +7, Investigation +8, Perception +11, Sleight of Hand +9, Stealth +13',
    gear: "Hand Crossbow, Rapier, Thieves' Tools", passive: 21, languages: 'Common plus two other languages',
    actions: [
      e('Multiattack', 'Makes three attacks, using Rapier or Hand Crossbow in any combination.'),
      e('Rapier', 'Melee Attack Roll: +9, reach 5 ft. Hit: 14 (2d8 + 5) Piercing damage plus 7 (2d6) Poison damage.'),
      e('Hand Crossbow', 'Ranged Attack Roll: +9, range 30/120 ft. Hit: 12 (2d6 + 5) Piercing damage plus 9 (2d8) Poison damage.'),
      e('Smoke Bomb (1/Day)', "Throws a bomb to a point it can see within 30 feet. Constitution Saving Throw: DC 16, each creature in a 20-foot-radius Sphere centered on that point. Failure: 28 (8d6) Poison damage, and the target has the Blinded condition until the end of the spy's next turn. Success: Half damage only."),
    ],
    bonusActions: [CUNNING_ACTION],
  }),
  // MM 2024 p.307
  mk({
    id: 'tough', name: 'Tough', page: 307, ac: 12, init: 1, hp: 32, hpDice: '5d8 + 10',
    scores: [15, 12, 14, 10, 10, 11], pb: 2, cr: '1/2', xp: 100,
    gear: 'Heavy Crossbow, Leather Armor, Mace', passive: 10, languages: 'Common',
    traits: [PACK_TACTICS],
    actions: [
      e('Mace', 'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Bludgeoning damage.'),
      e('Heavy Crossbow', 'Ranged Attack Roll: +3, range 100/400 ft. Hit: 6 (1d10 + 1) Piercing damage.'),
    ],
  }),
  // MM 2024 p.307
  mk({
    id: 'tough-boss', name: 'Tough Boss', page: 307, ac: 16, init: 2, hp: 82, hpDice: '11d8 + 33',
    scores: [17, 14, 16, 11, 10, 11], saves: ['str', 'con', 'cha'], pb: 2, cr: '4', xp: 1100,
    gear: 'Chain Mail, Heavy Crossbow, Warhammer', passive: 10, languages: 'Common plus one other language',
    traits: [PACK_TACTICS],
    actions: [
      e('Multiattack', 'Makes two attacks, using Warhammer or Heavy Crossbow in any combination.'),
      e('Warhammer', 'Melee Attack Roll: +5, reach 5 ft. Hit: 12 (2d8 + 3) Bludgeoning damage. A Large or smaller target is pushed up to 10 feet straight away from the tough.'),
      e('Heavy Crossbow', 'Ranged Attack Roll: +4, range 100/400 ft. Hit: 13 (2d10 + 2) Piercing damage.'),
    ],
  }),
  // MM 2024 p.320
  mk({
    id: 'warrior-infantry', name: 'Warrior Infantry', page: 320, ac: 13, init: 0, hp: 9, hpDice: '2d8',
    scores: [13, 11, 11, 8, 11, 8], pb: 2, cr: '1/8', xp: 25,
    gear: 'Chain Shirt, Spear', passive: 10, languages: 'Common',
    traits: [PACK_TACTICS],
    actions: [e('Spear', 'Melee or Ranged Attack Roll: +3, reach 5 ft. or range 20/60 ft. Hit: 4 (1d6 + 1) Piercing damage.')],
  }),
  // MM 2024 p.320 (Initiative +3 printed although Dex mod is +1; kept as printed)
  mk({
    id: 'warrior-veteran', name: 'Warrior Veteran', page: 320, ac: 17, init: 3, hp: 65, hpDice: '10d8 + 20',
    scores: [16, 13, 14, 10, 11, 10], pb: 2, cr: '3', xp: 700,
    skills: 'Athletics +5, Perception +2', gear: 'Greatsword, Heavy Crossbow, Splint Armor', passive: 12, languages: 'Common plus one other language',
    actions: [
      e('Multiattack', 'Makes two Greatsword or Heavy Crossbow attacks.'),
      e('Greatsword', 'Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Slashing damage.'),
      e('Heavy Crossbow', 'Ranged Attack Roll: +3, range 100/400 ft. Hit: 12 (2d10 + 1) Piercing damage.'),
    ],
    reactions: [parry(2)],
  }),
  // MM 2024 p.321
  mk({
    id: 'warrior-commander', name: 'Warrior Commander', page: 321, ac: 18, init: 9, hp: 161, hpDice: '19d8 + 76',
    scores: [21, 20, 18, 14, 16, 14], saves: ['str', 'dex', 'con', 'wis'], pb: 4, cr: '10', xp: 5900,
    skills: 'Athletics +9, Insight +7, Perception +7', gear: 'Greatsword, Longbow, Plate Armor', passive: 17, languages: 'Common plus one other language',
    actions: [
      e('Multiattack', 'Makes three attacks, using Greatsword or Longbow in any combination.'),
      e('Greatsword', "Melee Attack Roll: +9, reach 5 ft. Hit: 19 (4d6 + 5) Slashing damage. It also creates one of these effects. Sap: The target has Disadvantage on its next attack roll before the start of the warrior's next turn. Maneuver: One ally who can see or hear the warrior can take a Reaction to move up to half its Speed without provoking Opportunity Attacks."),
      e('Longbow', "Ranged Attack Roll: +9, range 150/600 ft. Hit: 18 (3d8 + 5) Piercing damage, and the target's Speed decreases by 10 feet until the end of the target's next turn."),
    ],
    bonusActions: [e('Tactical Charge', 'Moves up to half its Speed straight toward an enemy it can see without provoking Opportunity Attacks.')],
    reactions: [
      e('Counterattack', 'Trigger: It is hit by an attack roll. Response: It adds 4 to its AC against that attack, possibly causing it to miss. On a miss, it can make one Greatsword or Longbow attack against the attacker.'),
    ],
  }),
];
