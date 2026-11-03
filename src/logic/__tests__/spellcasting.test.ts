import { describe, it, expect } from 'vitest';
import type { AbilityScores, Character } from '../../types/character';
import { CURRENT_VERSION } from '../../types/character';
import { abilityModifier, proficiencyBonus } from '../abilities';
import {
  alwaysPreparedSpells,
  cantripListClassIds,
  cantripsKnown,
  cantripsKnownBreakdown,
  casterKind,
  isSpellcaster,
  maxSpellLevel,
  mysticArcanumLevels,
  pactMagicSlots,
  preparedCount,
  reconcileSpellcastingForLevel,
  requiredCantrips,
  spellAttackBreakdown,
  spellcastingAbility,
  spellcastingFocus,
  spellcastingFocusOptions,
  spellListClassId,
  spellListClassIds,
  spellSaveDcBreakdown,
  spellSlotMaxBreakdown,
  spellSlots,
} from '../spellcasting';
import { getSpell } from '../../data/spells';

const SCORES: AbilityScores = { str: 10, dex: 14, con: 12, int: 16, wis: 13, cha: 18 };

function char(partial: Partial<Character>): Character {
  return {
    _v: CURRENT_VERSION,
    id: 'test',
    name: 'Test',
    level: 1,
    abilities: { ...SCORES },
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

describe('isSpellcaster (level-aware)', () => {
  it('is false with no class', () => {
    expect(isSpellcaster(char({}))).toBe(false);
  });

  it('is false for a non-caster class (Barbarian, Monk)', () => {
    expect(isSpellcaster(char({ class: { id: 'barbarian', level: 1 } }))).toBe(false);
    expect(isSpellcaster(char({ class: { id: 'monk', level: 20 } }))).toBe(false);
  });

  it('is true from level 1 for full and half casters', () => {
    for (const id of ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard'] as const) {
      expect(isSpellcaster(char({ level: 1, class: { id, level: 1 } }))).toBe(true);
    }
    expect(isSpellcaster(char({ level: 1, class: { id: 'paladin', level: 1 } }))).toBe(true);
    expect(isSpellcaster(char({ level: 1, class: { id: 'ranger', level: 1 } }))).toBe(true);
  });

  it('Fighter casts ONLY as Eldritch Knight at level 3+ (level-gated)', () => {
    // No subclass → not a caster at any level.
    expect(isSpellcaster(char({ level: 20, class: { id: 'fighter', level: 20 } }))).toBe(false);
    // Champion subclass → not a caster.
    expect(
      isSpellcaster(char({ level: 10, class: { id: 'fighter', level: 10, subclassId: 'champion' } })),
    ).toBe(false);
    // Eldritch Knight below level 3 → not yet a caster.
    expect(
      isSpellcaster(
        char({ level: 2, class: { id: 'fighter', level: 2, subclassId: 'eldritchKnight' } }),
      ),
    ).toBe(false);
    // Eldritch Knight at level 3 → caster.
    expect(
      isSpellcaster(
        char({ level: 3, class: { id: 'fighter', level: 3, subclassId: 'eldritchKnight' } }),
      ),
    ).toBe(true);
  });

  it('Rogue casts ONLY as Arcane Trickster at level 3+ (level-gated)', () => {
    expect(
      isSpellcaster(char({ level: 2, class: { id: 'rogue', level: 2, subclassId: 'arcaneTrickster' } })),
    ).toBe(false);
    expect(
      isSpellcaster(char({ level: 3, class: { id: 'rogue', level: 3, subclassId: 'arcaneTrickster' } })),
    ).toBe(true);
    expect(
      isSpellcaster(char({ level: 5, class: { id: 'rogue', level: 5, subclassId: 'assassin' } })),
    ).toBe(false);
  });
});

describe('spellcastingAbility', () => {
  it('returns the class ability for casters and undefined otherwise', () => {
    expect(spellcastingAbility(char({ class: { id: 'wizard', level: 1 } }))).toBe('int');
    expect(spellcastingAbility(char({ class: { id: 'cleric', level: 1 } }))).toBe('wis');
    expect(spellcastingAbility(char({ class: { id: 'bard', level: 1 } }))).toBe('cha');
    expect(spellcastingAbility(char({ class: { id: 'barbarian', level: 1 } }))).toBeUndefined();
    expect(
      spellcastingAbility(char({ level: 3, class: { id: 'fighter', level: 3, subclassId: 'eldritchKnight' } })),
    ).toBe('int');
  });
});

describe('spellSaveDcBreakdown', () => {
  it('is 8 + PB + ability mod and the components sum to the total', () => {
    // Wizard, level 5 (PB +3), Int 16 (+3) → 8 + 3 + 3 = 14.
    const c = char({ level: 5, class: { id: 'wizard', level: 5 } });
    const bd = spellSaveDcBreakdown(c)!;
    expect(bd.total).toBe(8 + proficiencyBonus(5) + abilityModifier(16));
    expect(bd.total).toBe(14);
    expect(bd.components.reduce((s, x) => s + x.value, 0)).toBe(bd.total);
    expect(bd.components[0]).toEqual({ label: 'Base', value: 8 });
  });

  it('is undefined for a non-caster', () => {
    expect(spellSaveDcBreakdown(char({ class: { id: 'barbarian', level: 1 } }))).toBeUndefined();
  });
});

describe('spellAttackBreakdown', () => {
  it('is PB + ability mod and the components sum to the total', () => {
    // Bard, level 9 (PB +4), Cha 18 (+4) → 8.
    const c = char({ level: 9, class: { id: 'bard', level: 9 } });
    const bd = spellAttackBreakdown(c)!;
    expect(bd.total).toBe(proficiencyBonus(9) + abilityModifier(18));
    expect(bd.total).toBe(8);
    expect(bd.components.reduce((s, x) => s + x.value, 0)).toBe(bd.total);
  });
});

describe('spell slots (table lookups, not formulas)', () => {
  it('full caster level 1 has two level-1 slots', () => {
    const slots = spellSlots(char({ level: 1, class: { id: 'wizard', level: 1 } }))!;
    expect(slots[1]).toBe(2);
    expect(slots[2]).toBe(0);
  });

  it('full caster level 20 matches the printed top row', () => {
    const slots = spellSlots(char({ level: 20, class: { id: 'cleric', level: 20 } }))!;
    expect(slots.slice(1)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
  });

  it('half caster (Paladin) level 5 has 4x L1 and 2x L2 only', () => {
    const slots = spellSlots(char({ level: 5, class: { id: 'paladin', level: 5 } }))!;
    expect(slots.slice(1)).toEqual([4, 2, 0, 0, 0]);
  });

  it('third caster (Eldritch Knight) has no slots below level 3', () => {
    const c = char({ level: 2, class: { id: 'fighter', level: 2, subclassId: 'eldritchKnight' } });
    expect(spellSlots(c)).toBeUndefined(); // not a caster yet
    const c3 = char({ level: 3, class: { id: 'fighter', level: 3, subclassId: 'eldritchKnight' } });
    // Third-caster grid is 1-indexed over spell levels 1-4 (PHB 2024 Eldritch
    // Knight table tops out at a level-4 slot at character levels 19-20), so the
    // level-3 row is two level-1 slots and zeros for levels 2-4.
    expect(spellSlots(c3)!.slice(1)).toEqual([2, 0, 0, 0]);
  });

  it('Warlock uses Pact Magic (not the standard grid)', () => {
    const c = char({ level: 5, class: { id: 'warlock', level: 5 } });
    expect(spellSlots(c)).toBeUndefined();
    const pact = pactMagicSlots(c)!;
    expect(pact).toEqual({ slots: 2, slotLevel: 3 });
  });
});

describe('spellSlotMaxBreakdown', () => {
  it('sums to the slot count for a populated level', () => {
    const c = char({ level: 5, class: { id: 'wizard', level: 5 } });
    const bd = spellSlotMaxBreakdown(c, 1)!;
    expect(bd.total).toBe(4);
    expect(bd.components.reduce((s, x) => s + x.value, 0)).toBe(4);
  });

  it('is undefined for a level with no slots', () => {
    const c = char({ level: 1, class: { id: 'wizard', level: 1 } });
    expect(spellSlotMaxBreakdown(c, 5)).toBeUndefined();
  });
});

describe('cantripsKnown / preparedCount', () => {
  it('reads the printed Cantrips column', () => {
    expect(cantripsKnown(char({ level: 1, class: { id: 'wizard', level: 1 } }))).toBe(3);
    expect(cantripsKnown(char({ level: 10, class: { id: 'wizard', level: 10 } }))).toBe(5);
    // Paladin/Ranger have NO cantrips.
    expect(cantripsKnown(char({ level: 5, class: { id: 'paladin', level: 5 } }))).toBe(0);
    expect(cantripsKnown(char({ level: 5, class: { id: 'ranger', level: 5 } }))).toBe(0);
  });

  it('reads the printed Prepared Spells column', () => {
    expect(preparedCount(char({ level: 1, class: { id: 'wizard', level: 1 } }))).toBe(4);
    expect(preparedCount(char({ level: 1, class: { id: 'sorcerer', level: 1 } }))).toBe(2);
    expect(preparedCount(char({ level: 20, class: { id: 'wizard', level: 20 } }))).toBe(25);
  });

  it('is 0 for a non-caster', () => {
    expect(cantripsKnown(char({ class: { id: 'barbarian', level: 1 } }))).toBe(0);
    expect(preparedCount(char({ class: { id: 'barbarian', level: 1 } }))).toBe(0);
  });
});

describe('casterKind / maxSpellLevel', () => {
  it('reports the kind', () => {
    expect(casterKind(char({ class: { id: 'wizard', level: 1 } }))).toBe('full');
    expect(casterKind(char({ class: { id: 'paladin', level: 1 } }))).toBe('half');
    expect(casterKind(char({ class: { id: 'warlock', level: 1 } }))).toBe('pact');
    expect(
      casterKind(char({ level: 3, class: { id: 'rogue', level: 3, subclassId: 'arcaneTrickster' } })),
    ).toBe('third');
  });

  it('reports the highest castable spell level', () => {
    expect(maxSpellLevel(char({ level: 1, class: { id: 'wizard', level: 1 } }))).toBe(1);
    expect(maxSpellLevel(char({ level: 20, class: { id: 'wizard', level: 20 } }))).toBe(9);
    // Warlock Pact Magic slot level.
    expect(maxSpellLevel(char({ level: 5, class: { id: 'warlock', level: 5 } }))).toBe(3);
  });
});

describe('spellListClassId / focus', () => {
  it('Eldritch Knight & Arcane Trickster draw from the Wizard list (2024 RAW)', () => {
    expect(
      spellListClassId(char({ level: 3, class: { id: 'fighter', level: 3, subclassId: 'eldritchKnight' } })),
    ).toBe('wizard');
    expect(
      spellListClassId(char({ level: 3, class: { id: 'rogue', level: 3, subclassId: 'arcaneTrickster' } })),
    ).toBe('wizard');
  });

  it('a base caster draws from its own list', () => {
    expect(spellListClassId(char({ class: { id: 'druid', level: 1 } }))).toBe('druid');
  });

  it('surfaces the read-only focus', () => {
    expect(spellcastingFocus(char({ class: { id: 'cleric', level: 1 } }))).toBe('Holy Symbol');
    expect(spellcastingFocus(char({ class: { id: 'druid', level: 1 } }))).toBe('Druidic Focus');
    expect(spellcastingFocus(char({ class: { id: 'barbarian', level: 1 } }))).toBeUndefined();
  });

  it('a Wizard may use an Arcane Focus OR the spellbook (PHB 2024)', () => {
    // Re-review finding: Wizard focus text must include the spellbook option.
    const wiz = char({ class: { id: 'wizard', level: 1 } });
    expect(spellcastingFocusOptions(wiz)).toEqual(['Arcane Focus', 'Spellbook']);
    expect(spellcastingFocus(wiz)).toBe('Arcane Focus or Spellbook');
    // A non-Wizard caster keeps a single focus.
    expect(spellcastingFocusOptions(char({ class: { id: 'cleric', level: 1 } }))).toEqual([
      'Holy Symbol',
    ]);
    expect(spellcastingFocusOptions(char({ class: { id: 'barbarian', level: 1 } }))).toEqual([]);
  });
});

describe('spellListClassIds (Bard Magical Secrets union)', () => {
  it('a sub-level-10 Bard draws from only the Bard list', () => {
    expect(spellListClassIds(char({ level: 9, class: { id: 'bard', level: 9 } }))).toEqual(['bard']);
  });

  it('a level-10+ Bard draws from Bard/Cleric/Druid/Wizard (Magical Secrets)', () => {
    // PHB 2024 "Bard: Magical Secrets" — new/replacement prepared spells may be
    // chosen from the Bard, Cleric, Druid, and Wizard lists (re-review finding).
    const union = spellListClassIds(char({ level: 10, class: { id: 'bard', level: 10 } }));
    expect(union).toEqual(['bard', 'cleric', 'druid', 'wizard']);
    // A Wizard-only spell (Fireball) is now reachable for a level-10 Bard.
    const fireball = getSpell('fireball')!;
    expect(fireball.classes).toContain('wizard');
    expect(fireball.classes).not.toContain('bard');
    expect(union).toContain('wizard');
  });

  it('a non-Bard caster is unaffected', () => {
    expect(spellListClassIds(char({ level: 20, class: { id: 'cleric', level: 20 } }))).toEqual([
      'cleric',
    ]);
    expect(spellListClassIds(char({ class: { id: 'barbarian', level: 1 } }))).toEqual([]);
  });
});

describe('requiredCantrips (Arcane Trickster Mage Hand)', () => {
  it('requires Mage Hand for an Arcane Trickster and nothing for others', () => {
    // PHB 2024 "Arcane Trickster: Spellcasting" — Mage Hand is known and cannot
    // be replaced (re-review finding: picker must lock it in).
    expect(
      requiredCantrips(char({ level: 3, class: { id: 'rogue', level: 3, subclassId: 'arcaneTrickster' } })),
    ).toEqual(['mage-hand']);
    // Not a caster yet → no requirement.
    expect(
      requiredCantrips(char({ level: 2, class: { id: 'rogue', level: 2, subclassId: 'arcaneTrickster' } })),
    ).toEqual([]);
    expect(requiredCantrips(char({ level: 5, class: { id: 'wizard', level: 5 } }))).toEqual([]);
  });
});

describe('alwaysPreparedSpells (feature-granted, outside the cap)', () => {
  it('Ranger always has Hunter\'s Mark prepared from level 1', () => {
    // PHB 2024 "Ranger: Favored Enemy" — Hunter's Mark is always prepared and
    // does not count against the Prepared Spells column (reviewer finding).
    expect(
      alwaysPreparedSpells(char({ level: 1, class: { id: 'ranger', level: 1 } })),
    ).toEqual(['hunter-s-mark']);
  });

  it('Paladin gains Divine Smite at 2 and Find Steed at 5', () => {
    // PHB 2024 "Paladin's Smite" (L2) and "Faithful Steed" (L5).
    expect(
      alwaysPreparedSpells(char({ level: 1, class: { id: 'paladin', level: 1 } })),
    ).toEqual([]);
    expect(
      alwaysPreparedSpells(char({ level: 2, class: { id: 'paladin', level: 2 } })),
    ).toEqual(['divine-smite']);
    expect(
      alwaysPreparedSpells(char({ level: 5, class: { id: 'paladin', level: 5 } })).sort(),
    ).toEqual(['divine-smite', 'find-steed']);
  });

  it('Druid always has Speak with Animals; Warlock gains Contact Other Plane at 9', () => {
    // PHB 2024 "Druid: Druidic" (L1) and "Warlock: Contact Patron" (L9).
    expect(
      alwaysPreparedSpells(char({ level: 1, class: { id: 'druid', level: 1 } })),
    ).toEqual(['speak-with-animals']);
    expect(
      alwaysPreparedSpells(char({ level: 8, class: { id: 'warlock', level: 8 } })),
    ).toEqual([]);
    expect(
      alwaysPreparedSpells(char({ level: 9, class: { id: 'warlock', level: 9 } })),
    ).toEqual(['contact-other-plane']);
  });

  it('Bard gains Power Word Heal and Power Word Kill at level 20 (subclass-table-style grant)', () => {
    // PHB 2024 "Bard: Words of Creation" (L20). Models the feature spell-table
    // grant case the reviewer asked to cover.
    expect(
      alwaysPreparedSpells(char({ level: 19, class: { id: 'bard', level: 19 } })),
    ).toEqual([]);
    expect(
      alwaysPreparedSpells(char({ level: 20, class: { id: 'bard', level: 20 } })).sort(),
    ).toEqual(['power-word-heal', 'power-word-kill']);
  });

  it('is empty for non-casters and classes without feature grants', () => {
    expect(alwaysPreparedSpells(char({ class: { id: 'barbarian', level: 1 } }))).toEqual([]);
    expect(alwaysPreparedSpells(char({ level: 5, class: { id: 'wizard', level: 5 } }))).toEqual([]);
    expect(alwaysPreparedSpells(char({}))).toEqual([]);
  });

  it('every granted id exists in the catalog', () => {
    for (const cfg of [
      { level: 20, class: { id: 'bard' as const, level: 20 } },
      { level: 5, class: { id: 'paladin' as const, level: 5 } },
      { level: 1, class: { id: 'ranger' as const, level: 1 } },
      { level: 1, class: { id: 'druid' as const, level: 1 } },
      { level: 9, class: { id: 'warlock' as const, level: 9 } },
    ]) {
      for (const id of alwaysPreparedSpells(char(cfg))) {
        expect(getSpell(id), `always-prepared '${id}' must exist`).toBeDefined();
      }
    }
  });
});

describe('cantripsKnownBreakdown (zero-valued caps get a tooltip)', () => {
  it('returns a zero breakdown for Paladin/Ranger (no cantrips)', () => {
    // Calculated-totals steering: show components even when 0.
    const bd = cantripsKnownBreakdown(char({ level: 5, class: { id: 'paladin', level: 5 } }))!;
    expect(bd.total).toBe(0);
    expect(bd.components.reduce((s, x) => s + x.value, 0)).toBe(0);
    expect(cantripsKnownBreakdown(char({ class: { id: 'barbarian', level: 1 } }))).toBeUndefined();
  });
});

describe('reconcileSpellcastingForLevel (level-down pruning)', () => {
  it('drops prepared spells above the new max spell level', () => {
    // A level-5 Wizard with Fireball (L3) prepared, dropped to level 1 (max L1).
    const lowered = char({
      level: 1,
      class: { id: 'wizard', level: 1 },
      spellcasting: { cantrips: ['fire-bolt'], prepared: ['fireball', 'magic-missile'] },
    });
    const reconciled = reconcileSpellcastingForLevel(lowered)!;
    expect(reconciled.prepared).toEqual(['magic-missile']); // Fireball (L3) pruned.
    expect(reconciled.cantrips).toEqual(['fire-bolt']);
  });

  it('trims cantrips over the new cap but keeps required cantrips', () => {
    // Arcane Trickster level 10 (cap 4) dropped to level 3 (cap 3) with 4 chosen.
    const lowered = char({
      level: 3,
      class: { id: 'rogue', level: 3, subclassId: 'arcaneTrickster' },
      spellcasting: {
        cantrips: ['mage-hand', 'mending', 'light', 'message'],
      },
    });
    const reconciled = reconcileSpellcastingForLevel(lowered)!;
    expect(reconciled.cantrips!.length).toBe(3);
    expect(reconciled.cantrips).toContain('mage-hand'); // required, kept.
  });

  it('clamps expended slots to the new maxima', () => {
    const lowered = char({
      level: 1,
      class: { id: 'wizard', level: 1 },
      spellcasting: { slotsExpended: { 1: 2, 3: 1 } },
    });
    const reconciled = reconcileSpellcastingForLevel(lowered)!;
    expect(reconciled.slotsExpended).toEqual({ 1: 2 }); // L3 slot removed (none at L1).
  });

  it('returns undefined when nothing valid remains', () => {
    const lowered = char({
      level: 1,
      class: { id: 'wizard', level: 1 },
      spellcasting: { prepared: ['fireball'] }, // L3 only, invalid at L1.
    });
    expect(reconcileSpellcastingForLevel(lowered)).toBeUndefined();
  });

  it('clamps prepared spells to the current Prepared Spells cap', () => {
    // Review finding: a cap decrease must drop excess prepared spells. A level-1
    // Wizard prepares 4; with 5 legal level-1 spells stored, one is trimmed.
    const c = char({
      level: 1,
      class: { id: 'wizard', level: 1 },
      spellcasting: {
        prepared: ['magic-missile', 'shield', 'mage-armor', 'grease', 'burning-hands'],
      },
    });
    const reconciled = reconcileSpellcastingForLevel(c)!;
    expect(reconciled.prepared!.length).toBe(preparedCount(c));
    expect(reconciled.prepared!.length).toBe(4);
    // The kept entries are the first four (stable order).
    expect(reconciled.prepared).toEqual(['magic-missile', 'shield', 'mage-armor', 'grease']);
  });

  it('drops prepared spells no longer on a legal source list (Bard 10 -> 9)', () => {
    // Review finding: Bard 10->9 loses Magical Secrets, so a retained Wizard-only
    // spell (Fireball) must be pruned rather than stay hidden yet counting.
    const demoted = char({
      level: 9,
      class: { id: 'bard', level: 9 },
      spellcasting: { prepared: ['fireball', 'charm-person'] },
    });
    const reconciled = reconcileSpellcastingForLevel(demoted)!;
    expect(reconciled.prepared).not.toContain('fireball'); // off the Bard list now.
    expect(reconciled.prepared).toContain('charm-person'); // still a Bard spell.
  });

  it('drops cantrips no longer on the class list after a class change', () => {
    // A Cleric with a non-Cleric cantrip stored (e.g. after a class change) must
    // shed it, since cantrips are drawn from the current class list only.
    const c = char({
      level: 1,
      class: { id: 'cleric', level: 1 },
      // 'fire-bolt' is a Wizard/Sorcerer cantrip, not a Cleric one.
      spellcasting: { cantrips: ['sacred-flame', 'fire-bolt'] },
    });
    const reconciled = reconcileSpellcastingForLevel(c)!;
    expect(reconciled.cantrips).toContain('sacred-flame');
    expect(reconciled.cantrips).not.toContain('fire-bolt');
  });

  it('prunes Mystic Arcanum choices no longer available at the level', () => {
    // A Warlock 17 with all four arcana, dropped to 11 (only a level-6 arcanum),
    // keeps the level-6 choice and sheds the 7/8/9 choices and their expended flags.
    const lowered = char({
      level: 11,
      class: { id: 'warlock', level: 11 },
      spellcasting: {
        mysticArcana: { 6: 'eyebite', 7: 'forcecage', 9: 'power-word-kill' },
        mysticArcanaExpended: { 6: true, 9: true },
      },
    });
    const reconciled = reconcileSpellcastingForLevel(lowered)!;
    expect(reconciled.mysticArcana).toEqual({ 6: 'eyebite' });
    expect(reconciled.mysticArcanaExpended).toEqual({ 6: true });
  });
});

describe('cantripListClassIds (Magical Secrets does NOT widen cantrips)', () => {
  it('a level-10+ Bard still draws cantrips from the Bard list only', () => {
    // Review finding: Magical Secrets widened prepared spells, not cantrips. A
    // level-10 Bard's cantrip pool stays the Bard list, even though its prepared
    // pool is the Bard/Cleric/Druid/Wizard union.
    const bard10 = char({ level: 10, class: { id: 'bard', level: 10 } });
    expect(cantripListClassIds(bard10)).toEqual(['bard']);
    expect(spellListClassIds(bard10)).toEqual(['bard', 'cleric', 'druid', 'wizard']);
  });

  it('matches the primary list for other casters and is empty for non-casters', () => {
    expect(cantripListClassIds(char({ class: { id: 'wizard', level: 1 } }))).toEqual(['wizard']);
    expect(
      cantripListClassIds(
        char({ level: 3, class: { id: 'fighter', level: 3, subclassId: 'eldritchKnight' } }),
      ),
    ).toEqual(['wizard']);
    expect(cantripListClassIds(char({ class: { id: 'barbarian', level: 1 } }))).toEqual([]);
  });
});

describe('mysticArcanumLevels (Warlock)', () => {
  it('is empty before Warlock level 11 and for non-Warlocks', () => {
    expect(mysticArcanumLevels(char({ level: 10, class: { id: 'warlock', level: 10 } }))).toEqual([]);
    expect(mysticArcanumLevels(char({ level: 20, class: { id: 'wizard', level: 20 } }))).toEqual([]);
  });

  it('adds a level 6/7/8/9 arcanum at Warlock 11/13/15/17', () => {
    // PHB 2024 "Warlock: Mystic Arcanum".
    expect(mysticArcanumLevels(char({ level: 11, class: { id: 'warlock', level: 11 } }))).toEqual([6]);
    expect(mysticArcanumLevels(char({ level: 13, class: { id: 'warlock', level: 13 } }))).toEqual([
      6, 7,
    ]);
    expect(mysticArcanumLevels(char({ level: 15, class: { id: 'warlock', level: 15 } }))).toEqual([
      6, 7, 8,
    ]);
    expect(mysticArcanumLevels(char({ level: 17, class: { id: 'warlock', level: 17 } }))).toEqual([
      6, 7, 8, 9,
    ]);
    expect(mysticArcanumLevels(char({ level: 20, class: { id: 'warlock', level: 20 } }))).toEqual([
      6, 7, 8, 9,
    ]);
  });
});
