import { describe, it, expect } from 'vitest';
import {
  WEAPON_CATALOG,
  WEAPON_LIST,
  getWeapon,
  WEAPON_PROPERTY_TEXT,
  WEAPON_MASTERY_TEXT,
  type WeaponData,
  type WeaponProperty,
  type MasteryProperty,
} from '../weapons';
import { ARMOR_CATALOG, ARMOR_LIST, getArmor, type ArmorData } from '../armor';
import { EQUIPMENT_CATALOG, EQUIPMENT_LIST, getEquipment, effectiveStack } from '../equipment';

/**
 * Verification test for the hand-authored equipment catalogs (blueprint §2.2 /
 * §7.5): assert row counts, spot-check known values, and — for the rules-
 * critical weapon and armor tables — compare EVERY row against a committed
 * golden fixture transcribed from the PHB 2024 tables (Docs/PlayersHandbook.md:
 * Weapons L9388-9430, Armor L9589-9646). The golden fixtures mean a silent drift
 * in any numeric column fails the gate (review finding #9).
 */

// ─── Golden fixtures (PHB 2024 printed values) ──────────────────────────────
// Each tuple is the rules-critical columns for one row, transcribed from the
// printed PHB table (OCR glyphs corrected to the printed values).
// [id, category, range, damageDice, damageType, propsSorted, versatile|null,
//  normalRange|null, longRange|null, ammunitionType|null, mastery, weightLb, costGp]
// The range/ammunition columns were added (review finding #6) so a swapped
// Longbow range, wrong Sling ammunition, or incorrect Musket long range fails.
type WeaponGolden = [
  string,
  WeaponData['category'],
  WeaponData['range'],
  string,
  WeaponData['damageType'],
  WeaponProperty[],
  string | null,
  number | null,
  number | null,
  WeaponData['ammunitionType'] | null,
  MasteryProperty,
  number,
  number,
];

const WEAPON_GOLDEN: WeaponGolden[] = [
  // Simple Melee
  ['club', 'simple', 'melee', '1d4', 'bludgeoning', ['light'], null, null, null, null, 'slow', 2, 0.1],
  ['dagger', 'simple', 'melee', '1d4', 'piercing', ['finesse', 'light', 'thrown'], null, 20, 60, null, 'nick', 1, 2],
  ['greatclub', 'simple', 'melee', '1d8', 'bludgeoning', ['two-handed'], null, null, null, null, 'push', 10, 0.2],
  ['handaxe', 'simple', 'melee', '1d6', 'slashing', ['light', 'thrown'], null, 20, 60, null, 'vex', 2, 5],
  ['javelin', 'simple', 'melee', '1d6', 'piercing', ['thrown'], null, 30, 120, null, 'slow', 2, 0.5],
  ['light-hammer', 'simple', 'melee', '1d4', 'bludgeoning', ['light', 'thrown'], null, 20, 60, null, 'nick', 2, 2],
  ['mace', 'simple', 'melee', '1d6', 'bludgeoning', [], null, null, null, null, 'sap', 4, 5],
  ['quarterstaff', 'simple', 'melee', '1d6', 'bludgeoning', ['versatile'], '1d8', null, null, null, 'topple', 4, 0.2],
  ['sickle', 'simple', 'melee', '1d4', 'slashing', ['light'], null, null, null, null, 'nick', 2, 1],
  ['spear', 'simple', 'melee', '1d6', 'piercing', ['thrown', 'versatile'], '1d8', 20, 60, null, 'sap', 3, 1],
  // Simple Ranged
  ['dart', 'simple', 'ranged', '1d4', 'piercing', ['finesse', 'thrown'], null, 20, 60, null, 'vex', 0.25, 0.05],
  ['light-crossbow', 'simple', 'ranged', '1d8', 'piercing', ['ammunition', 'loading', 'two-handed'], null, 80, 320, 'Bolt', 'slow', 5, 25],
  ['shortbow', 'simple', 'ranged', '1d6', 'piercing', ['ammunition', 'two-handed'], null, 80, 320, 'Arrow', 'vex', 2, 25],
  ['sling', 'simple', 'ranged', '1d4', 'bludgeoning', ['ammunition'], null, 30, 120, 'Bullet', 'slow', 0, 0.1],
  // Martial Melee
  ['battleaxe', 'martial', 'melee', '1d8', 'slashing', ['versatile'], '1d10', null, null, null, 'topple', 4, 10],
  ['flail', 'martial', 'melee', '1d8', 'bludgeoning', [], null, null, null, null, 'sap', 2, 10],
  ['glaive', 'martial', 'melee', '1d10', 'slashing', ['heavy', 'reach', 'two-handed'], null, null, null, null, 'graze', 6, 20],
  ['greataxe', 'martial', 'melee', '1d12', 'slashing', ['heavy', 'two-handed'], null, null, null, null, 'cleave', 7, 30],
  ['greatsword', 'martial', 'melee', '2d6', 'slashing', ['heavy', 'two-handed'], null, null, null, null, 'graze', 6, 50],
  ['halberd', 'martial', 'melee', '1d10', 'slashing', ['heavy', 'reach', 'two-handed'], null, null, null, null, 'cleave', 6, 20],
  ['lance', 'martial', 'melee', '1d10', 'piercing', ['heavy', 'reach', 'two-handed'], null, null, null, null, 'topple', 6, 10],
  ['longsword', 'martial', 'melee', '1d8', 'slashing', ['versatile'], '1d10', null, null, null, 'sap', 3, 15],
  ['maul', 'martial', 'melee', '2d6', 'bludgeoning', ['heavy', 'two-handed'], null, null, null, null, 'topple', 10, 10],
  ['morningstar', 'martial', 'melee', '1d8', 'piercing', [], null, null, null, null, 'sap', 4, 15],
  ['pike', 'martial', 'melee', '1d10', 'piercing', ['heavy', 'reach', 'two-handed'], null, null, null, null, 'push', 18, 5],
  ['rapier', 'martial', 'melee', '1d8', 'piercing', ['finesse'], null, null, null, null, 'vex', 2, 25],
  ['scimitar', 'martial', 'melee', '1d6', 'slashing', ['finesse', 'light'], null, null, null, null, 'nick', 3, 25],
  ['shortsword', 'martial', 'melee', '1d6', 'piercing', ['finesse', 'light'], null, null, null, null, 'vex', 2, 10],
  ['trident', 'martial', 'melee', '1d8', 'piercing', ['thrown', 'versatile'], '1d10', 20, 60, null, 'topple', 4, 5],
  ['warhammer', 'martial', 'melee', '1d8', 'bludgeoning', ['versatile'], '1d10', null, null, null, 'push', 5, 15],
  ['war-pick', 'martial', 'melee', '1d8', 'piercing', ['versatile'], '1d10', null, null, null, 'sap', 2, 5],
  ['whip', 'martial', 'melee', '1d4', 'slashing', ['finesse', 'reach'], null, null, null, null, 'slow', 3, 2],
  // Martial Ranged
  ['blowgun', 'martial', 'ranged', '1', 'piercing', ['ammunition', 'loading'], null, 25, 100, 'Needle', 'vex', 1, 10],
  ['hand-crossbow', 'martial', 'ranged', '1d6', 'piercing', ['ammunition', 'light', 'loading'], null, 30, 120, 'Bolt', 'vex', 3, 75],
  ['heavy-crossbow', 'martial', 'ranged', '1d10', 'piercing', ['ammunition', 'heavy', 'loading', 'two-handed'], null, 100, 400, 'Bolt', 'push', 18, 50],
  ['longbow', 'martial', 'ranged', '1d8', 'piercing', ['ammunition', 'heavy', 'two-handed'], null, 150, 600, 'Arrow', 'slow', 2, 50],
  ['musket', 'martial', 'ranged', '1d12', 'piercing', ['ammunition', 'loading', 'two-handed'], null, 40, 120, 'Bullet', 'slow', 10, 500],
  ['pistol', 'martial', 'ranged', '1d10', 'piercing', ['ammunition', 'loading'], null, 30, 90, 'Bullet', 'vex', 3, 250],
];

// [id, category, baseAc, addsDex, dexCap|null, strReq|null, stealthDisadv, weightLb, costGp]
type ArmorGolden = [
  string,
  ArmorData['category'],
  number,
  boolean,
  number | null,
  number | null,
  boolean,
  number,
  number,
];

const ARMOR_GOLDEN: ArmorGolden[] = [
  ['padded-armor', 'light', 11, true, null, null, true, 8, 5],
  ['leather-armor', 'light', 11, true, null, null, false, 10, 10],
  ['studded-leather-armor', 'light', 12, true, null, null, false, 13, 45],
  ['hide-armor', 'medium', 12, true, 2, null, false, 12, 10],
  ['chain-shirt', 'medium', 13, true, 2, null, false, 20, 50],
  ['scale-mail', 'medium', 14, true, 2, null, true, 45, 50],
  ['breastplate', 'medium', 14, true, 2, null, false, 20, 400],
  ['half-plate-armor', 'medium', 15, true, 2, null, true, 40, 750],
  ['ring-mail', 'heavy', 14, false, null, null, true, 40, 30],
  ['chain-mail', 'heavy', 16, false, null, 13, true, 55, 75],
  ['splint-armor', 'heavy', 17, false, null, 15, true, 60, 200],
  ['plate-armor', 'heavy', 18, false, null, 15, true, 65, 1500],
  ['shield', 'shield', 2, false, null, null, false, 6, 10],
];

describe('WEAPON_CATALOG', () => {
  it('has all 38 PHB 2024 weapons', () => {
    // 10 Simple Melee + 4 Simple Ranged + 18 Martial Melee + 6 Martial Ranged = 38.
    expect(WEAPON_LIST.length).toBe(38);
    expect(WEAPON_GOLDEN.length).toBe(38);
  });

  it('keys each weapon under its own id and carries a per-entry PHB source', () => {
    for (const w of WEAPON_LIST) {
      expect(WEAPON_CATALOG[w.id].id).toBe(w.id);
      expect(w.srd).toBe(false); // conservative flag per rules-compliance rule 5
      expect(w.source).toMatch(/PHB 2024/); // per-entry citation (finding #8)
    }
  });

  it('every row matches the committed PHB golden fixture (finding #9)', () => {
    for (const [id, category, range, dice, type, props, versatile, normalRange, longRange, ammo, mastery, weight, cost] of WEAPON_GOLDEN) {
      const w = getWeapon(id);
      expect(w, `missing weapon ${id}`).toBeTruthy();
      if (!w) continue;
      expect(w.category, `${id}.category`).toBe(category);
      expect(w.range, `${id}.range`).toBe(range);
      expect(w.damageDice, `${id}.damageDice`).toBe(dice);
      expect(w.damageType, `${id}.damageType`).toBe(type);
      expect([...w.properties].sort(), `${id}.properties`).toEqual([...props].sort());
      expect(w.versatileDice ?? null, `${id}.versatileDice`).toBe(versatile);
      expect(w.normalRange ?? null, `${id}.normalRange`).toBe(normalRange);
      expect(w.longRange ?? null, `${id}.longRange`).toBe(longRange);
      expect(w.ammunitionType ?? null, `${id}.ammunitionType`).toBe(ammo);
      expect(w.mastery, `${id}.mastery`).toBe(mastery);
      expect(w.weightLb, `${id}.weightLb`).toBe(weight);
      expect(w.costGp, `${id}.costGp`).toBeCloseTo(cost);
    }
  });

  it('every weapon has exactly one valid mastery and valid enums', () => {
    const masteries: MasteryProperty[] = ['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex'];
    for (const w of WEAPON_LIST) {
      expect(masteries).toContain(w.mastery);
      expect(['simple', 'martial']).toContain(w.category);
      expect(['melee', 'ranged']).toContain(w.range);
      expect(['bludgeoning', 'piercing', 'slashing']).toContain(w.damageType);
    }
  });

  it('versatile weapons carry versatileDice; non-versatile do not', () => {
    for (const w of WEAPON_LIST) {
      if (w.properties.includes('versatile')) {
        expect(w.versatileDice).toBeTruthy();
      } else {
        expect(w.versatileDice).toBeUndefined();
      }
    }
  });

  it('ammunition weapons carry an ammunitionType and a range', () => {
    for (const w of WEAPON_LIST) {
      if (w.properties.includes('ammunition')) {
        expect(w.ammunitionType).toBeTruthy();
        expect(w.normalRange).toBeGreaterThan(0);
        expect(w.longRange).toBeGreaterThan(0);
      }
    }
  });

  it('only the Lance carries the machine-readable "unless mounted" exception (finding #4)', () => {
    for (const w of WEAPON_LIST) {
      if (w.id === 'lance') {
        expect(w.conditionalProperties).toEqual([
          { property: 'two-handed', unlessCondition: 'mounted' },
        ]);
      } else {
        expect(w.conditionalProperties).toBeUndefined();
      }
    }
  });

  it('Shortbow range 80/320, Arrow ammunition (spot check)', () => {
    const w = getWeapon('shortbow')!;
    expect(w.ammunitionType).toBe('Arrow');
    expect(w.normalRange).toBe(80);
    expect(w.longRange).toBe(320);
  });

  it('property and mastery definition text includes operative restrictions (finding #6)', () => {
    const props: WeaponProperty[] = ['ammunition', 'finesse', 'heavy', 'light', 'loading', 'range', 'reach', 'thrown', 'two-handed', 'versatile'];
    const masteries: MasteryProperty[] = ['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex'];
    for (const p of props) expect(WEAPON_PROPERTY_TEXT[p].length).toBeGreaterThan(0);
    for (const m of masteries) expect(WEAPON_MASTERY_TEXT[m].length).toBeGreaterThan(0);
    // Operative details that were previously missing must now be present.
    expect(WEAPON_PROPERTY_TEXT.light).toMatch(/different Light/i);
    expect(WEAPON_PROPERTY_TEXT.light).toMatch(/unless the modifier is negative/i);
    expect(WEAPON_MASTERY_TEXT.cleave).toMatch(/once per turn/i);
    expect(WEAPON_MASTERY_TEXT.cleave).toMatch(/within your reach/i);
    expect(WEAPON_MASTERY_TEXT.nick).toMatch(/once per turn/i);
    expect(WEAPON_MASTERY_TEXT.graze).toMatch(/damage type/i);
    expect(WEAPON_MASTERY_TEXT.slow).toMatch(/more than 10 feet/i);
    expect(WEAPON_MASTERY_TEXT.topple).toMatch(/8 \+ the ability modifier/i);
    expect(WEAPON_MASTERY_TEXT.topple).toMatch(/Proficiency Bonus/i);
    expect(WEAPON_MASTERY_TEXT.vex).toMatch(/before the end of your next turn/i);
  });
});

describe('ARMOR_CATALOG', () => {
  it('has all 12 PHB 2024 armors + the Shield (13 entries)', () => {
    expect(ARMOR_LIST.length).toBe(13);
    expect(ARMOR_GOLDEN.length).toBe(13);
  });

  it('keys each armor under its own id and carries a per-entry PHB source', () => {
    for (const a of ARMOR_LIST) {
      expect(ARMOR_CATALOG[a.id].id).toBe(a.id);
      expect(a.srd).toBe(false);
      expect(a.source).toMatch(/PHB 2024/);
    }
  });

  it('every row matches the committed PHB golden fixture (finding #9)', () => {
    for (const [id, category, baseAc, addsDex, dexCap, strReq, stealth, weight, cost] of ARMOR_GOLDEN) {
      const a = getArmor(id);
      expect(a, `missing armor ${id}`).toBeTruthy();
      if (!a) continue;
      expect(a.category, `${id}.category`).toBe(category);
      expect(a.baseAc, `${id}.baseAc`).toBe(baseAc);
      expect(a.addsDex, `${id}.addsDex`).toBe(addsDex);
      expect(a.dexCap ?? null, `${id}.dexCap`).toBe(dexCap);
      expect(a.strengthRequirement ?? null, `${id}.strengthRequirement`).toBe(strReq);
      expect(a.stealthDisadvantage, `${id}.stealth`).toBe(stealth);
      expect(a.weightLb, `${id}.weightLb`).toBe(weight);
      expect(a.costGp, `${id}.costGp`).toBe(cost);
    }
  });

  it('Dex model per category: light=uncapped, medium=cap 2, heavy/shield=no Dex', () => {
    for (const a of ARMOR_LIST) {
      if (a.category === 'light') {
        expect(a.addsDex).toBe(true);
        expect(a.dexCap).toBeUndefined();
      } else if (a.category === 'medium') {
        expect(a.addsDex).toBe(true);
        expect(a.dexCap).toBe(2);
      } else {
        expect(a.addsDex).toBe(false); // heavy & shield
      }
    }
  });

  it('Shield: +2 bonus stored as baseAc 2, category shield, no Dex', () => {
    const a = getArmor('shield')!;
    expect(a.category).toBe('shield');
    expect(a.baseAc).toBe(2);
    expect(a.addsDex).toBe(false);
  });
});

describe('EQUIPMENT_CATALOG', () => {
  it('keys each item under its own id, flags srd false, carries a per-entry source', () => {
    for (const e of EQUIPMENT_LIST) {
      expect(EQUIPMENT_CATALOG[e.id].id).toBe(e.id);
      expect(e.srd).toBe(false);
      expect(e.source).toMatch(/PHB 2024/); // per-entry citation (finding #8)
      expect(['gear', 'tool', 'ammunition', 'pack', 'consumable']).toContain(e.kind);
    }
  });

  it('includes all five standard equipment packs + Priest\'s and Scholar\'s packs', () => {
    const packs = EQUIPMENT_LIST.filter((e) => e.kind === 'pack').map((e) => e.name).sort();
    expect(packs).toEqual([
      "Burglar's Pack",
      "Diplomat's Pack",
      "Dungeoneer's Pack",
      "Entertainer's Pack",
      "Explorer's Pack",
      "Priest's Pack",
      "Scholar's Pack",
    ]);
  });

  it('includes all five ammunition types', () => {
    const ammo = EQUIPMENT_LIST.filter((e) => e.kind === 'ammunition').map((e) => e.name).sort();
    expect(ammo).toEqual(['Arrows', 'Bolts', 'Bullets, Firearm', 'Bullets, Sling', 'Needles']);
  });

  it('ammunition weight/cost are PER BUNDLE with a packageSize (finding #1)', () => {
    // PHB "Ammunition" table: Arrows 20 @ 1 lb / 1 GP, Bolts 20 @ 1.5 lb,
    // Firearm Bullets 10 @ 2 lb, Needles 50 @ 1 lb.
    const arrows = getEquipment('arrows')!;
    expect(arrows.packageSize).toBe(20);
    expect(arrows.weightLb).toBe(1);
    expect(arrows.costGp).toBe(1);
    // Per-piece weight the A2 math must use (1 lb / 20 = 0.05 lb per arrow),
    // so a stack of 20 pieces weighs 1 lb, not 20 lb.
    expect(arrows.weightLb / arrows.packageSize!).toBeCloseTo(0.05);
    expect(getEquipment('bolts')!.packageSize).toBe(20);
    expect(getEquipment('bullets-firearm')!.packageSize).toBe(10);
    expect(getEquipment('needles')!.packageSize).toBe(50);
    // Non-ammunition items have no packageSize.
    for (const e of EQUIPMENT_LIST.filter((x) => x.kind !== 'ammunition')) {
      expect(e.packageSize, `${e.id} should not have packageSize`).toBeUndefined();
    }
  });

  it('effectiveStack: a 20-Arrow stack weighs 1 lb and is worth 1 GP, not 20x (finding #1)', () => {
    // The pinned ammunition unit contract: quantity counts PIECES; bundle
    // weight/cost are divided by packageSize. 20 pieces → exactly 1 bundle.
    const arrows = getEquipment('arrows')!;
    const stack = effectiveStack(arrows, 20);
    expect(stack.weightLb).toBeCloseTo(1);
    expect(stack.valueGp).toBeCloseTo(1);
    // Half a bundle is proportional, not rounded up.
    expect(effectiveStack(arrows, 10).weightLb).toBeCloseTo(0.5);
    expect(effectiveStack(arrows, 10).valueGp).toBeCloseTo(0.5);
    // A non-ammunition item uses per-item weight × quantity.
    const rope = getEquipment('rope')!;
    expect(effectiveStack(rope, 2).weightLb).toBeCloseTo(10);
    expect(effectiveStack(rope, 2).valueGp).toBeCloseTo(2);
    // An unpriced item contributes 0 value (price unknown, not "free").
    const spellbook = getEquipment('spellbook')!;
    expect(effectiveStack(spellbook, 1).valueGp).toBe(0);
    expect(effectiveStack(spellbook, 1).weightLb).toBeCloseTo(3);
  });

  it('normalises cp/sp costs to GP (Rations 5 SP = 0.5, Candle 1 CP = 0.01, Sling bullets 4 CP = 0.04)', () => {
    expect(getEquipment('rations')!.costGp).toBeCloseTo(0.5);
    expect(getEquipment('candle')!.costGp).toBeCloseTo(0.01);
    expect(getEquipment('bullets-sling')!.costGp).toBeCloseTo(0.04);
  });

  it("Healer's Kit: gear, 3 lb, 5 GP", () => {
    const e = getEquipment('healers-kit')!;
    expect(e.kind).toBe('gear');
    expect(e.weightLb).toBe(3);
    expect(e.costGp).toBe(5);
  });

  it('consumable/gear descriptions retain the operative DC / damage / duration (finding #6)', () => {
    expect(getEquipment('acid')!.description).toMatch(/2d6 Acid/);
    expect(getEquipment('acid')!.description).toMatch(/20 ft/);
    expect(getEquipment('alchemists-fire')!.description).toMatch(/1d4 Fire/);
    expect(getEquipment('holy-water')!.description).toMatch(/2d8 Radiant/);
    expect(getEquipment('ball-bearings')!.description).toMatch(/DC 10/);
    expect(getEquipment('caltrops')!.description).toMatch(/DC 15/);
    expect(getEquipment('grappling-hook')!.description).toMatch(/DC 13/);
    expect(getEquipment('antitoxin')!.description).toMatch(/1 hour/);
  });

  it('holy-symbol / focus variants exist with distinct PHB weights (finding #3)', () => {
    // Emblem is weightless; Amulet 1 lb; Reliquary 2 lb (no silent 1 lb default).
    expect(getEquipment('holy-symbol-emblem')!.weightLb).toBe(0);
    expect(getEquipment('holy-symbol-amulet')!.weightLb).toBe(1);
    expect(getEquipment('holy-symbol-reliquary')!.weightLb).toBe(2);
    // Arcane focus variants carry their own PHB weights.
    expect(getEquipment('arcane-focus-orb')!.weightLb).toBe(3);
    expect(getEquipment('arcane-focus-crystal')!.weightLb).toBe(1);
    // Spellbook: Tiny object, 3 lb (PHB Wizard: Spellbook); NO invented price —
    // represented as unpriced, with costGp omitted (finding #3).
    expect(getEquipment('spellbook')!.weightLb).toBe(3);
    expect(getEquipment('spellbook')!.costGp).toBeUndefined();
    expect(getEquipment('spellbook')!.unpriced).toBe(true);
    // Robe and Book carry their printed values.
    expect(getEquipment('robe')!.weightLb).toBe(4);
    expect(getEquipment('book')!.weightLb).toBe(5);
    expect(getEquipment('book')!.costGp).toBe(25);
  });
});
