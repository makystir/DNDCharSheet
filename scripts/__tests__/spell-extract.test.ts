import { describe, it, expect } from 'vitest';
import { parseSpellBlocks, slugify } from '../spell-extract.ts';
import { applyOverride } from '../spell-overrides.ts';

/**
 * Unit tests for the pure extraction logic, each driven by a REAL snippet from
 * the PHB 2024 "Spell Descriptions" section (Docs/PlayersHandbook.md), covering
 * every formatting variant catalogued in the blueprint (Q1). Each snippet is
 * wrapped in the minimal "## SPELL DESCRIPTIONS ... ## THE MULTIVERSE" frame the
 * parser slices on.
 */
function parseSnippet(body: string) {
  const md = `## SPELL DESCRIPTIONS\n\nThe spells are presented in alphabetical order.\n\n${body}\n\n## THE MULTIVERSE\n`;
  return parseSpellBlocks(md).map(applyOverride);
}

function only(body: string) {
  const spells = parseSnippet(body);
  expect(spells.length).toBe(1);
  return spells[0];
}

describe('slugify (ID stability)', () => {
  it('reproduces the shipped irregular ids', () => {
    expect(slugify("Hunter's Mark")).toBe('hunter-s-mark');
    expect(slugify("Mordenkainen's Sword")).toBe('mordenkainen-s-sword');
    expect(slugify('Antipathy/Sympathy')).toBe('antipathy-sympathy');
    expect(slugify('Find the Path')).toBe('find-the-path');
    expect(slugify('Fireball')).toBe('fireball');
    expect(slugify('Mage Hand')).toBe('mage-hand');
  });
});

describe('parseSpellBlocks — formatting variants', () => {
  it('A: inline name + level/school line (Acid Splash)', () => {
    const s = only(
      [
        'ACID SPLASH Evocation Cantrip (Sorcerer, Wizard)',
        '',
        'Casting Time: Action',
        '',
        'Range: 60 feet',
        '',
        'Components: V, S',
        '',
        'Duration: Instantaneous',
        '',
        'You create an acidic bubble at a point within range, where it explodes in a 5-foot-radius Sphere. Each creature in that Sphere must succeed on a Dexterity saving throw or take 1d6 Acid damage.',
      ].join('\n'),
    );
    expect(slugify(s.name)).toBe('acid-splash');
    expect(s.level).toBe(0);
    expect(s.school).toBe('evocation');
    expect([...s.classes].sort()).toEqual(['sorcerer', 'wizard']);
    expect(s.castingTime).toBe('Action');
    expect(s.range).toBe('60 feet');
    expect(s.duration).toBe('Instantaneous');
    expect(s.components).toEqual({ verbal: true, somatic: true, material: undefined });
    expect(s.effect).toMatch(/acidic bubble/);
  });

  it('A: "## NAME" heading with level/school on the next line (Aid)', () => {
    const s = only(
      [
        '## AID',
        '',
        'Level 2 Abjuration (Bard, Cleric, Druid, Paladin, Ranger)',
        '',
        'Casting Time: Action',
        '',
        'Range: 30 feet',
        '',
        'Components: V, S, M (a strip of white cloth)',
        '',
        'Duration: 8 hours',
        '',
        "Choose up to three creatures within range. Each target's Hit Point maximum and current Hit Points increase by 5 for the duration.",
      ].join('\n'),
    );
    expect(slugify(s.name)).toBe('aid');
    expect(s.level).toBe(2);
    expect(s.components.material).toBe('a strip of white cloth');
    expect(s.effect).toMatch(/Hit Point maximum/);
  });

  it('A: "## NAME Level N School (...)" all on the heading line (Bless)', () => {
    const s = only(
      [
        '## BLESS Level 1 Enchantment (Cleric, Paladin)',
        '',
        'Casting Time: Action',
        '',
        'Range: 30 feet',
        '',
        'Components: V, S, M (a Holy Symbol)',
        '',
        'Duration: Concentration, up to 1 minute',
        '',
        'You bless up to three creatures within range.',
      ].join('\n'),
    );
    expect(slugify(s.name)).toBe('bless');
    expect(s.level).toBe(1);
    expect(s.school).toBe('enchantment');
    expect(s.concentration).toBe(true);
  });

  it('C + E: crammed one-line fields (Dispel Magic) and a no-heading boundary (Dissonant Whispers)', () => {
    const spells = parseSnippet(
      [
        '## DISPEL MAGIC',
        '',
        'Level 3 Abjuration (Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard)',
        '',
        'Casting Time: Action Range: 120 feet Components: V, S Duration: Instantaneous',
        '',
        'Choose one creature, object, or magical effect within range. Any ongoing spell of level 3 or lower on the target ends.',
        '',
        'DISSONANT WHISPERS Level 1 Enchantment (Bard)',
        '',
        'Casting Time: Action',
        '',
        'Range: 60 feet',
        '',
        'Components: V',
        '',
        'Duration: Instantaneous',
        '',
        'One creature of your choice that you can see within range hears a discordant melody in its mind. The target makes a Wisdom saving throw. On a failed save, it takes 3d6 Psychic damage.',
      ].join('\n'),
    );
    expect(spells.length).toBe(2);
    const [dispel, dissonant] = spells;
    expect(slugify(dispel.name)).toBe('dispel-magic');
    expect(dispel.castingTime).toBe('Action');
    expect(dispel.range).toBe('120 feet');
    expect(dispel.duration).toBe('Instantaneous');
    // The bleed guard: Dispel Magic must NOT contain Dissonant Whispers' text.
    expect(dispel.effect).not.toMatch(/discordant melody|3d6 Psychic/);
    expect(dispel.effect).toMatch(/ongoing spell of level 3 or lower/);
    expect(slugify(dissonant.name)).toBe('dissonant-whispers');
    expect(dissonant.effect).toMatch(/discordant melody/);
    expect(dissonant.range).toBe('60 feet');
  });

  it('D: table-wrapped cantrip with crammed field row (Ray of Frost)', () => {
    const s = only(
      [
        '| RAY OF FROST Evocation Cantrip (Sorcerer, Wizard)                            |',
        '|------------------------------------------------------------------------------|',
        '| Casting Time: Action Range: 60 feet Components: V, S Duration: Instantaneous |',
        '',
        'A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, it takes 1d8 Cold damage.',
      ].join('\n'),
    );
    expect(slugify(s.name)).toBe('ray-of-frost');
    expect(s.level).toBe(0);
    expect(s.castingTime).toBe('Action');
    expect(s.range).toBe('60 feet');
    expect(s.duration).toBe('Instantaneous');
  });

  it('D: table-wrapped per-row spell with Comp_onents OCR label (Telepathy)', () => {
    const s = only(
      [
        '| TELEPATHY                                            |',
        '|------------------------------------------------------|',
        '| Level 8 Divination (Wizard)                          |',
        '| Casting Time: Action                                 |',
        '| Range: Unlimited                                     |',
        '| Comp_onents: V, S, M (a pair of linked silver rings) |',
        '| Duration: 24 hours                                   |',
        '',
        'You create a telepathic link between yourself and a willing creature with which you are familiar.',
      ].join('\n'),
    );
    expect(slugify(s.name)).toBe('telepathy');
    expect(s.level).toBe(8);
    expect(s.school).toBe('divination');
    expect(s.range).toBe('Unlimited');
    expect(s.components.material).toBe('a pair of linked silver rings');
  });

  it('C: multiline material value joined to a balanced paren + CastingTime OCR repair (Revivify)', () => {
    const s = only(
      [
        '## REVIVIFY',
        '',
        'Level 3 Necromancy (Cleric, Druid, Paladin, Ranger)',
        '',
        'CastingTime: Action',
        '',
        'Range: Touch',
        '',
        'Components: V, S, M (a diamond worth 300+ GP,',
        '',
        'which the spell consumes)',
        '',
        'Duration: Instantaneous',
        '',
        'You touch a creature that has died within the last minute. That creature revives with 1 Hit Point.',
      ].join('\n'),
    );
    expect(slugify(s.name)).toBe('revivify');
    expect(s.castingTime).toBe('Action');
    expect(s.components.material).toBe('a diamond worth 300+ GP, which the spell consumes');
    // Single unbroken line — no newline, no truncation at "GP,".
    expect(s.components.material).not.toMatch(/\n/);
    expect(s.duration).toBe('Instantaneous');
  });

  it('C: "or Ritual" is stripped from Casting Time and sets the ritual flag (Alarm)', () => {
    const s = only(
      [
        '## ALARM',
        '',
        'Level 1 Abjuration (Ranger, Wizard)',
        '',
        'Casting Time: 1 minute or Ritual',
        '',
        'Range: 30 feet',
        '',
        'Components: V, S, M (a bell and silver wire)',
        '',
        'Duration: 8 hours',
        '',
        'You set an alarm against intrusion.',
      ].join('\n'),
    );
    expect(slugify(s.name)).toBe('alarm');
    expect(s.ritual).toBe(true);
    expect(s.castingTime).toBe('1 minute');
    expect(s.castingTime).not.toMatch(/Ritual/);
  });

  it('B: OCR-duplicated level/school (and name) line is collapsed (Banishment)', () => {
    const s = only(
      [
        '## BANISHMENT BANISHMENT',
        '',
        'Level 4 Abjuration (Cleric, Paladin, Sorcerer, Warlock, Wizard) Level 4 Abjuration (Cleric, Paladin, Sorcerer, Warlock, Wizard)',
        '',
        'Casting Time: Action',
        '',
        'Range: 30 feet',
        '',
        'Components: V, S, M (a pentacle)',
        '',
        'Duration: Concentration, up to 1 minute',
        '',
        'One creature that you can see within range must succeed on a Charisma saving throw or be transported to a harmless demiplane for the duration.',
      ].join('\n'),
    );
    expect(slugify(s.name)).toBe('banishment');
    expect(s.level).toBe(4);
    expect(s.school).toBe('abjuration');
    expect([...s.classes].sort()).toEqual([
      'cleric', 'paladin', 'sorcerer', 'warlock', 'wizard',
    ]);
    expect(s.concentration).toBe(true);
  });

  it('A: OCR-mangled name recovered via the cited override (FINd THe PATí -> Find the Path)', () => {
    const s = only(
      [
        '```',
        'FINd THe PATí Level 6 Divination (Bard, Cleric, Druid) Casting Time: 1 minute Range: Self Components: V, S, M (a set of divination tools—such as cards or runes—worth 100+ GP) Duration: Concentration, up to 1 day',
        '```',
        '',
        'You magically sense the most direct physical route to a location you name.',
      ].join('\n'),
    );
    expect(s.name).toBe('Find the Path');
    expect(slugify(s.name)).toBe('find-the-path');
    expect(s.level).toBe(6);
    expect(s.school).toBe('divination');
    expect(s.castingTime).toBe('1 minute');
    expect(s.range).toBe('Self');
    expect(s.components.material).toMatch(/worth 100\+ GP/);
    expect(s.ritual).toBe(false);
  });
});
