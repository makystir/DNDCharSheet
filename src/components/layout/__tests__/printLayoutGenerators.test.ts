import { describe, it, expect } from 'vitest';
import type { Character } from '../../../types/character';
import { BLANK_CHARACTER, CURRENT_VERSION, ABILITIES, SKILLS } from '../../../types/character';
import {
  buildPrintSheetData,
  buildCoreStats,
  buildSpells,
  signed,
} from '../printLayoutGenerators';
import { proficiencyBonus, abilityModifier } from '../../../logic/abilities';
import { effectiveAbilityScores } from '../../../logic/feats';
import { armorClassBreakdown, unarmoredDefenseFor } from '../../../logic/armor-class';
import { characterHitPointMaxBreakdown } from '../../../logic/hit-points-state';
import { speedBreakdown } from '../../../logic/species';
import { initiativeBreakdown } from '../../../logic/initiative';
import { passivePerceptionBreakdown } from '../../../logic/passive-checks';
import { allSkillBreakdowns } from '../../../logic/skills';
import { allSavingThrowBreakdowns } from '../../../logic/saving-throws';
import { spellSaveDcBreakdown, spellAttackBreakdown, isSpellcaster } from '../../../logic/spellcasting';

/** A complete, non-caster character (Fighter) with equipment and skills. */
function makeFighter(overrides: Partial<Character> = {}): Character {
  return {
    ...structuredClone(BLANK_CHARACTER),
    _v: CURRENT_VERSION,
    id: 'fighter-1',
    name: 'Aric the Bold',
    level: 5,
    abilities: { str: 16, dex: 14, con: 15, int: 10, wis: 12, cha: 8 },
    classes: [{ id: 'fighter', level: 5 }],
    skills: {
      athletics: { proficient: true },
      perception: { proficient: true, expertise: true },
    },
    saveProficiencies: { str: true, con: true },
    alignment: 'Lawful Good',
    inventory: [
      { id: 'w1', kind: 'weapon', catalogId: 'longsword', quantity: 1 },
    ],
    equipped: { weaponItemIds: ['w1'] },
    coins: { pp: 1, gp: 25, ep: 0, sp: 4, cp: 9 },
    ...overrides,
  };
}

/** A complete spellcaster (Wizard — full caster, casts from level 1). */
function makeWizard(overrides: Partial<Character> = {}): Character {
  return {
    ...structuredClone(BLANK_CHARACTER),
    _v: CURRENT_VERSION,
    id: 'wizard-1',
    name: 'Mira the Wise',
    level: 5,
    abilities: { str: 8, dex: 14, con: 13, int: 17, wis: 12, cha: 10 },
    classes: [{ id: 'wizard', level: 5 }],
    ...overrides,
  };
}

describe('printLayoutGenerators — data completeness', () => {
  it('builds every top-level section for a complete character', () => {
    const data = buildPrintSheetData(makeFighter());

    // Identity fields are all present.
    expect(data.identity.name).toBe('Aric the Bold');
    expect(data.identity.species).toBeDefined();
    expect(data.identity.classAndLevel).toContain('Fighter');
    expect(data.identity.alignment).toBe('Lawful Good');
    expect(data.identity.languages.toLowerCase()).toContain('common');

    // One row per ability and per skill — nothing dropped.
    expect(data.abilities).toHaveLength(ABILITIES.length);
    expect(data.saves).toHaveLength(ABILITIES.length);
    expect(data.skills).toHaveLength(SKILLS.length);

    // Core stats name every expected total.
    const labels = data.coreStats.map((s) => s.label);
    expect(labels).toEqual([
      'Proficiency Bonus',
      'Armor Class',
      'Hit Points',
      'Speed',
      'Initiative',
      'Passive Perception',
    ]);

    // Attacks include the equipped weapon plus the always-available Unarmed Strike.
    const attackNames = data.attacks.map((a) => a.name);
    expect(attackNames).toContain('Longsword');
    expect(attackNames).toContain('Unarmed Strike');

    // Inventory + currency present.
    expect(data.inventory.items.map((i) => i.name)).toContain('Longsword');
    expect(data.inventory.currency.map((c) => c.label)).toEqual(['PP', 'GP', 'EP', 'SP', 'CP']);
  });

  it('surfaces base-class feature-granted languages (Rogue Thieves\u2019 Cant + choice)', () => {
    // Rogue L1 "Thieves' Cant" (PHB 2024): fixed Thieves' Cant + 1 chosen; here
    // the player chose Goblin and separately chose Elvish at creation.
    const rogue = makeFighter({
      id: 'rogue-1',
      classes: [{ id: 'rogue', level: 1 }],
      languages: { chosen: ['elvish'], granted: ['goblin'] },
    });
    const langs = buildPrintSheetData(rogue).identity.languages.toLowerCase();
    expect(langs).toContain('common');
    expect(langs).toContain('elvish');
    expect(langs).toContain('goblin');
    expect(langs).toContain('thieves');
  });
});

describe('printLayoutGenerators — numbers match the derived totals', () => {
  const character = makeFighter();

  it('core stats equal the derived function totals (recomputes nothing)', () => {
    const stats = buildCoreStats(character);
    const byLabel = Object.fromEntries(stats.map((s) => [s.label, s.value]));
    const eff = effectiveAbilityScores(character);

    expect(byLabel['Proficiency Bonus']).toBe(signed(proficiencyBonus(character.level)));
    const ac = armorClassBreakdown(eff, character.acOverride, {
      unarmoredDefense: unarmoredDefenseFor(character),
    });
    expect(byLabel['Armor Class']).toBe(`${ac.total}`);
    expect(byLabel['Hit Points']).toContain(`${characterHitPointMaxBreakdown(character).total}`);
    expect(byLabel['Speed']).toBe(`${speedBreakdown(character).total} ft`);
    expect(byLabel['Initiative']).toBe(
      signed(initiativeBreakdown(eff, character.initiativeBonus).total),
    );
    expect(byLabel['Passive Perception']).toBe(`${passivePerceptionBreakdown(character).total}`);
  });

  it('ability modifiers and saves match the derived totals', () => {
    const data = buildPrintSheetData(character);
    const eff = effectiveAbilityScores(character);
    const saves = allSavingThrowBreakdowns(character);
    for (const row of data.abilities) {
      expect(row.modifier).toBe(abilityModifier(eff[row.ability]));
      expect(row.saveModifier).toBe(saves[row.ability].total);
    }
  });

  it('skill modifiers match the derived totals and carry the training markers', () => {
    const data = buildPrintSheetData(character);
    const breakdowns = allSkillBreakdowns(character);
    for (const row of data.skills) {
      expect(row.modifier).toBe(breakdowns[row.id].total);
    }
    const perception = data.skills.find((s) => s.id === 'perception');
    expect(perception?.proficient).toBe(true);
    expect(perception?.expertise).toBe(true);
    const athletics = data.skills.find((s) => s.id === 'athletics');
    expect(athletics?.proficient).toBe(true);
    expect(athletics?.expertise).toBe(false);
  });
});

describe('printLayoutGenerators — conditional Spells visibility', () => {
  it('omits the Spells section for a non-caster', () => {
    const fighter = makeFighter();
    expect(isSpellcaster(fighter)).toBe(false);
    expect(buildSpells(fighter)).toBeUndefined();
    expect(buildPrintSheetData(fighter).spells).toBeUndefined();
  });

  it('includes the Spells section for a caster, with the derived DC and attack', () => {
    const wizard = makeWizard();
    expect(isSpellcaster(wizard)).toBe(true);
    const spells = buildSpells(wizard);
    expect(spells).toBeDefined();
    expect(spells?.saveDc).toBe(spellSaveDcBreakdown(wizard)?.total);
    expect(spells?.attackBonus).toBe(spellAttackBreakdown(wizard)?.total);
    // A full caster at level 5 has leveled slots.
    expect(spells?.slots.length).toBeGreaterThan(0);
    expect(buildPrintSheetData(wizard).spells).toBeDefined();
  });
});

describe('printLayoutGenerators — blank character never throws', () => {
  it('builds a complete data shape for the blank character', () => {
    const data = buildPrintSheetData(structuredClone(BLANK_CHARACTER));
    expect(data.abilities).toHaveLength(ABILITIES.length);
    expect(data.skills).toHaveLength(SKILLS.length);
    expect(data.spells).toBeUndefined();
    // Unarmed Strike is always present even with no weapons.
    expect(data.attacks.map((a) => a.name)).toContain('Unarmed Strike');
  });
});
