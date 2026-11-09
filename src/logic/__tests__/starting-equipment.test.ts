import { describe, it, expect } from 'vitest';
import { CLASS_LIST } from '../../data/classes';
import {
  autoEquipChoices,
  cartCopper,
  cartItems,
  classEquipmentOptions,
  copperToPurse,
  entryChoiceOptions,
  formatCopper,
  grantStartingEquipment,
  purchaseWarnings,
  resolveOptionItems,
  shopCatalog,
  startingBudgetCopper,
  trimCartToBudget,
} from '../starting-equipment';
import { createCharacter } from '../../storage/character-store';
import { WEAPON_LIST } from '../../data/weapons';
import { ARMOR_LIST } from '../../data/armor';

// PHB 2024 Core <Class> Traits "Starting Equipment": the gold that goes with each
// option, transcribed independently of the parser (A, B, C in printed order).
const GOLD: Record<string, number[]> = {
  barbarian: [15, 75],
  bard: [19, 90],
  cleric: [7, 110],
  druid: [9, 50],
  fighter: [4, 11, 155],
  monk: [11, 50],
  paladin: [9, 150],
  ranger: [7, 150],
  rogue: [8, 100],
  sorcerer: [28, 50],
  warlock: [15, 100],
  wizard: [5, 55],
};

function shopEntry(key: string) {
  const e = shopCatalog().find((s) => s.key === key);
  if (!e) throw new Error(`no shop entry ${key}`);
  return e;
}

describe('classEquipmentOptions', () => {
  it('parses every class with the printed gold for each option', () => {
    for (const cls of CLASS_LIST) {
      const options = classEquipmentOptions(cls.id);
      expect(options.map((o) => o.goldGp), cls.id).toEqual(GOLD[cls.id]);
      expect(options.map((o) => o.id)).toEqual(['A', 'B', 'C'].slice(0, GOLD[cls.id].length));
    }
  });

  it('the gold-only option has no items', () => {
    expect(classEquipmentOptions('fighter')[2]).toEqual({ id: 'C', entries: [], goldGp: 155 });
    expect(classEquipmentOptions('wizard')[1].entries).toEqual([]);
  });

  it('every item in every package resolves to a catalog entry (or is a player choice)', () => {
    for (const cls of CLASS_LIST) {
      for (const option of classEquipmentOptions(cls.id)) {
        const picks: Record<string, string> = {};
        for (const entry of option.entries) {
          const choices = entryChoiceOptions(entry);
          if (choices) picks[entry] = choices[0];
        }
        const { items, missing } = resolveOptionItems(option, picks);
        expect(missing, `${cls.id} ${option.id}`).toEqual([]);
        for (const item of items) {
          expect(item.catalogId, `${cls.id} ${option.id}: ${item.name}`).toBeDefined();
        }
      }
    }
  });

  it('reports the entries that still need a pick', () => {
    const monkA = classEquipmentOptions('monk')[0];
    const { missing } = resolveOptionItems(monkA, {});
    expect(missing).toEqual(["Artisan's Tools or Musical Instrument"]);
    const choices = entryChoiceOptions("Artisan's Tools or Musical Instrument");
    expect(choices).toContain('Lute');
    expect(choices?.some((c) => /Smith/.test(c))).toBe(true);
  });
});

describe('money', () => {
  it('converts copper to gold, silver, copper', () => {
    expect(copperToPurse(1234)).toMatchObject({ gp: 12, sp: 3, cp: 4 });
    expect(formatCopper(1234)).toBe('12 GP 3 SP 4 CP');
    expect(formatCopper(0)).toBe('0 GP');
  });

  it('prices a cart from book prices without float drift', () => {
    // Club 1 SP, Dagger 2 GP, Greatsword 50 GP (PHB 2024 Weapons table).
    const cart = { [shopEntry('weapon:club').key]: 3, [shopEntry('weapon:dagger').key]: 1 };
    expect(cartCopper(cart)).toBe(3 * 10 + 200);
  });

  it('adds ammunition in pieces, not bundles', () => {
    const arrows = shopCatalog().find((s) => s.catalogId === 'arrows')!;
    const items = cartItems({ [arrows.key]: 2 }, () => 'x');
    expect(items[0].quantity).toBe(2 * arrows.piecesPerUnit);
  });

  it('leaves out items the book prints without a price', () => {
    expect(shopCatalog().some((s) => s.catalogId === 'spellbook')).toBe(false);
  });
});

describe('purchaseWarnings', () => {
  it('warns a Wizard about Plate armor (no armor training)', () => {
    const w = purchaseWarnings('wizard', shopEntry('armor:plate-armor'), { str: 8 });
    expect(w.join(' ')).toMatch(/isn't trained with heavy armor/);
    expect(w.join(' ')).toMatch(/can.t cast spells/);
    expect(w.join(' ')).toMatch(/Strength 15/);
  });

  it('warns a Rogue about a Greatsword but not a Rapier', () => {
    expect(purchaseWarnings('rogue', shopEntry('weapon:greatsword')).join(' ')).toMatch(
      /Proficiency Bonus/,
    );
    expect(purchaseWarnings('rogue', shopEntry('weapon:rapier'))).toEqual([]);
  });

  it('warns a Cleric about a martial weapon but not Scale Mail', () => {
    expect(purchaseWarnings('cleric', shopEntry('weapon:longsword')).length).toBe(1);
    expect(purchaseWarnings('cleric', shopEntry('armor:scale-mail'), { str: 13 })).toEqual([]);
  });

  it('warns about a Shield for a class without Shield training', () => {
    expect(purchaseWarnings('wizard', shopEntry('armor:shield')).join(' ')).toMatch(/Shields/);
    expect(purchaseWarnings('fighter', shopEntry('armor:shield'))).toEqual([]);
  });

  it('flags a Heavy weapon when Strength is under 13', () => {
    const w = purchaseWarnings('fighter', shopEntry('weapon:greatsword'), { str: 12 });
    expect(w.join(' ')).toMatch(/Heavy/);
    expect(purchaseWarnings('fighter', shopEntry('weapon:greatsword'), { str: 15 })).toEqual([]);
  });

  it('flags nothing for gear', () => {
    expect(purchaseWarnings('wizard', shopEntry('equipment:rope'))).toEqual([]);
  });

  it('every weapon and armor entry gets a warning list without throwing', () => {
    for (const cls of CLASS_LIST) {
      for (const e of shopCatalog().filter((s) => s.kind !== 'equipment')) {
        expect(Array.isArray(purchaseWarnings(cls.id, e, { str: 10, dex: 10 }))).toBe(true);
      }
    }
    expect(WEAPON_LIST.length).toBeGreaterThan(0);
    expect(ARMOR_LIST.length).toBeGreaterThan(0);
  });
});

describe('grantStartingEquipment', () => {
  it('adds items and gold, subtracts spending, and equips trained armor', () => {
    const base = {
      ...createCharacter('Test'),
      classes: [{ id: 'fighter' as const, level: 1 }],
    };
    const option = classEquipmentOptions('fighter')[0];
    const { items } = resolveOptionItems(option, {});
    const granted = grantStartingEquipment(base, { items, goldGp: option.goldGp, spentCopper: 150 });
    expect(granted.inventory?.length).toBe(items.length);
    // 4 GP from the option minus 1 GP 5 SP spent.
    expect(granted.coins).toMatchObject({ gp: 2, sp: 5, cp: 0 });
    const armor = granted.inventory?.find((i) => i.catalogId === 'chain-mail');
    expect(granted.equipped?.armorItemId).toBe(armor?.id);
  });

  it('does not equip armor the class is not trained for', () => {
    const items = cartItems({ [shopEntry('armor:plate-armor').key]: 1 }, () => 'p1');
    expect(autoEquipChoices('wizard', items)).toEqual({ armorItemId: undefined, shieldItemId: undefined });
  });
});

describe('budget', () => {
  it('adds class and background gold', () => {
    expect(startingBudgetCopper(155, 50)).toBe(20500);
  });

  it('trims the latest purchases when the budget shrinks', () => {
    const cart = { 'weapon:dagger': 1, 'weapon:club': 2 }; // 2 GP + 2 SP = 220 cp
    expect(trimCartToBudget(cart, 1000)).toEqual(cart);
    const trimmed = trimCartToBudget(cart, 205);
    expect(cartCopper(trimmed)).toBeLessThanOrEqual(205);
    expect(trimmed['weapon:dagger']).toBe(1);
  });
});