/**
 * Short rules text for content tooltips on skills, abilities, saving throws and
 * languages (D&D 5.5e / 2024). Paraphrased from the PHB 2024 tables, never long
 * verbatim prose (rules-compliance rule 5); the mechanical meaning of each entry
 * (which ability governs a skill, which save resists what) is exact.
 *
 * Sources (Docs/PlayersHandbook.md):
 *  - Ability Descriptions table (L309-316)
 *  - Saving Throw Examples table (L412-419)
 *  - Skills table (L535-554) and "Skills With Different Abilities" (L568)
 *  - Standard Languages (L1631-1649) and Rare Languages (L1639-1660) tables
 */

import type { Ability, SkillId } from '../types/character';

/** What each ability's score measures and what its saving throw resists. */
export const ABILITY_INFO: Record<Ability, { measures: string; saveTo: string; source: string }> = {
  str: { measures: 'Physical might', saveTo: 'Physically resist direct force', source: 'PHB 2024 Ability Descriptions (L309); Saving Throw Examples (L414)' },
  dex: { measures: 'Agility, reflexes and balance', saveTo: "Dodge out of harm's way", source: 'PHB 2024 Ability Descriptions (L310); Saving Throw Examples (L415)' },
  con: { measures: 'Health and stamina', saveTo: 'Endure a toxic hazard', source: 'PHB 2024 Ability Descriptions (L311); Saving Throw Examples (L416)' },
  int: { measures: 'Reasoning and memory', saveTo: 'Recognize an illusion as fake', source: 'PHB 2024 Ability Descriptions (L312); Saving Throw Examples (L417)' },
  wis: { measures: 'Perceptiveness and mental fortitude', saveTo: 'Resist a mental assault', source: 'PHB 2024 Ability Descriptions (L313); Saving Throw Examples (L418)' },
  cha: { measures: 'Confidence, poise and charm', saveTo: 'Assert your identity', source: 'PHB 2024 Ability Descriptions (L314); Saving Throw Examples (L419)' },
};

/** Example uses for each skill (PHB 2024 Skills table). */
export const SKILL_INFO: Record<SkillId, { uses: string }> = {
  acrobatics: { uses: 'Stay on your feet in a tricky situation, or perform an acrobatic stunt.' },
  animalHandling: { uses: 'Calm or train an animal, or get an animal to behave a certain way.' },
  arcana: { uses: 'Recall lore about spells, magic items and the planes of existence.' },
  athletics: { uses: 'Jump farther than normal, stay afloat in rough water, or break something.' },
  deception: { uses: 'Tell a convincing lie, or wear a disguise convincingly.' },
  history: { uses: 'Recall lore about historical events, people, nations and cultures.' },
  insight: { uses: "Discern a person's mood and intentions." },
  intimidation: { uses: 'Awe or threaten someone into doing what you want.' },
  investigation: { uses: 'Find obscure information in books, or deduce how something works.' },
  medicine: { uses: 'Diagnose an illness, or determine what killed the recently slain.' },
  nature: { uses: 'Recall lore about terrain, plants, animals and weather.' },
  perception: { uses: 'Using a combination of senses, notice something that is easy to miss.' },
  performance: { uses: 'Act, tell a story, perform music or dance.' },
  persuasion: { uses: 'Honestly and graciously convince someone of something.' },
  religion: { uses: 'Recall lore about gods, religious rituals and holy symbols.' },
  sleightOfHand: { uses: 'Pick a pocket, conceal a handheld object, or perform legerdemain.' },
  stealth: { uses: 'Escape notice by moving quietly and hiding behind things.' },
  survival: { uses: 'Follow tracks, forage, find a trail, or avoid natural hazards.' },
};

/** Where a language comes from. Stored ids are lowercase and hyphenated. */
export const LANGUAGE_INFO: Record<string, { name: string; origin: string; kind: 'standard' | 'rare' }> = {
  common: { name: 'Common', origin: 'Sigil', kind: 'standard' },
  'common-sign-language': { name: 'Common Sign Language', origin: 'Sigil', kind: 'standard' },
  draconic: { name: 'Draconic', origin: 'Dragons', kind: 'standard' },
  dwarvish: { name: 'Dwarvish', origin: 'Dwarves', kind: 'standard' },
  elvish: { name: 'Elvish', origin: 'Elves', kind: 'standard' },
  giant: { name: 'Giant', origin: 'Giants', kind: 'standard' },
  gnomish: { name: 'Gnomish', origin: 'Gnomes', kind: 'standard' },
  goblin: { name: 'Goblin', origin: 'Goblinoids', kind: 'standard' },
  halfling: { name: 'Halfling', origin: 'Halflings', kind: 'standard' },
  orc: { name: 'Orc', origin: 'Orcs', kind: 'standard' },
  abyssal: { name: 'Abyssal', origin: 'Demons of the Abyss', kind: 'rare' },
  celestial: { name: 'Celestial', origin: 'Celestials', kind: 'rare' },
  'deep-speech': { name: 'Deep Speech', origin: 'Aberrations', kind: 'rare' },
  druidic: { name: 'Druidic', origin: 'Druidic circles', kind: 'rare' },
  infernal: { name: 'Infernal', origin: 'Devils of the Nine Hells', kind: 'rare' },
  primordial: { name: 'Primordial', origin: 'Elementals', kind: 'rare' },
  sylvan: { name: 'Sylvan', origin: 'The Feywild', kind: 'rare' },
  'thieves-cant': { name: "Thieves' Cant", origin: 'Various criminal guilds', kind: 'rare' },
};

/**
 * One-line meanings of the Overview vitals (PHB 2024 rules glossary entries:
 * Armor Class L20645, Initiative L21210, Passive Perception L21358 and L1916,
 * Darkvision L20921, Hit Point Dice L21146, Temporary Hit Points L21659).
 */
export type VitalId = 'armorClass' | 'initiative' | 'passivePerception' | 'darkvision' | 'hitDice' | 'tempHp';
export const VITAL_INFO: Record<VitalId, { title: string; text: string; formula?: string; source: string }> = {
  armorClass: {
    title: 'Armor Class',
    text: 'The target number for an attack roll against you; it shows how hard you are to hit.',
    source: 'PHB 2024 Armor Class (L20645)',
  },
  initiative: {
    title: 'Initiative',
    text: 'Determines the order of turns in combat.',
    source: 'PHB 2024 Initiative (L21210)',
  },
  passivePerception: {
    title: 'Passive Perception',
    text: 'Your general awareness. The DM uses it to decide whether you notice something without rolling a Wisdom (Perception) check.',
    formula: '10 + your Wisdom (Perception) check modifier, including every modifier that applies to those checks.',
    source: 'PHB 2024 Passive Perception (L21358, L1916)',
  },
  darkvision: {
    title: 'Darkvision',
    text: 'Within its range you see Dim Light as if it were Bright Light, and Darkness as if it were Dim Light. In that Darkness you see only shades of gray.',
    source: 'PHB 2024 Darkvision (L20921)',
  },
  hitDice: {
    title: 'Hit Dice',
    text: 'You spend Hit Dice during a Short Rest to regain Hit Points. You have as many as your character level.',
    source: 'PHB 2024 Hit Point Dice (L21146)',
  },
  tempHp: {
    title: 'Temporary Hit Points',
    text: 'A buffer granted by certain effects that absorbs damage before your real Hit Points are reduced.',
    source: 'PHB 2024 Temporary Hit Points (L21659)',
  },
};
