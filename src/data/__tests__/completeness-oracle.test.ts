import { describe, it, expect } from 'vitest';
import {
  WEAPON_LIST,
  WEAPON_PROPERTY_TEXT,
  WEAPON_MASTERY_TEXT,
  type MasteryProperty,
} from '../weapons';
import { ARMOR_LIST } from '../armor';
import { EQUIPMENT_LIST, getEquipment } from '../equipment';
import type { InventoryItem } from '../../types/character';
import {
  resolveWeaponTooltip,
  resolveArmorTooltip,
  resolveItemTooltip,
} from '../../logic/tooltip-content';

/**
 * DESCRIPTION-COMPLETENESS ORACLE (the permanent fix).
 * -----------------------------------------------------
 * "Complete" is defined MECHANICALLY here — as token/pattern assertions over
 * EVERY record in the catalogs — so completeness is a green/red gate rather than
 * a review opinion. This is the authoritative completeness gate from now on:
 * if a record is missing its required mechanical content, the matching
 * assertion fails and NAMES the offending record + missing field.
 *
 * Each required-field rule below is PHB-cited (Docs/PlayersHandbook.md). The
 * oracle iterates the WHOLE catalog (not a sample) for each rule.
 *
 * Rules (per the Stage A1 brief):
 *  - Weapon tooltip: must include the weapon's properties; if ranged/thrown,
 *    the ammunition type (if any) and the range; the mastery must be named.
 *  - Mastery descriptions: operative mechanic + the universal feature-unlock
 *    requirement; plus specific operative details for each mastery.
 *  - Armor/shield tooltips: the training restriction + stealth-disadvantage
 *    where applicable + medium/heavy Dex behaviour.
 *  - Light property: the extra-attack-uses-ability-modifier restriction.
 *  - Equipment items with an operative mechanic must include it (action /
 *    target-range / check-or-save + DC / effect / duration).
 */

/** Collect a human-readable "field: text" blob from a resolved tooltip. */
function tooltipText(sections: { label: string; text: string }[]): string {
  return sections.map((s) => `${s.label}: ${s.text}`).join(' | ');
}

/** Assert `pattern` appears in `haystack`, naming the record + field on failure. */
function expectIncludes(record: string, field: string, haystack: string, pattern: RegExp): void {
  expect(
    pattern.test(haystack),
    `completeness oracle: ${record} is missing required ${field} (expected to match ${pattern})`,
  ).toBe(true);
}

// ─── Weapon tooltips (every weapon) ─────────────────────────────────────────
describe('completeness oracle — weapon tooltips', () => {
  it('every weapon tooltip names its properties, mastery, and (if ranged/thrown) ammunition + range', () => {
    for (const w of WEAPON_LIST) {
      const item: InventoryItem = { id: 't', kind: 'weapon', catalogId: w.id, quantity: 1 };
      const t = resolveWeaponTooltip(item);
      expect(t, `completeness oracle: weapon ${w.id} produced no tooltip`).toBeTruthy();
      if (!t) continue;
      const blob = tooltipText(t.sections);

      // Properties section is always present (lists properties, or "None").
      const propsSection = t.sections.find((s) => s.label === 'Properties');
      expect(propsSection, `completeness oracle: weapon ${w.id} tooltip has no Properties section`).toBeTruthy();
      // Each property the weapon has must be named in the Properties text.
      for (const p of w.properties) {
        const label = p.replace(/(^|-)([a-z])/g, (_m, sep, c) => sep + c.toUpperCase());
        expectIncludes(`weapon ${w.id}`, `property "${p}"`, propsSection!.text, new RegExp(label.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')));
      }

      // Mastery must be named.
      const masterySection = t.sections.find((s) => s.label === 'Mastery');
      expect(masterySection, `completeness oracle: weapon ${w.id} tooltip has no Mastery section`).toBeTruthy();
      const masteryLabel = w.mastery.charAt(0).toUpperCase() + w.mastery.slice(1);
      expectIncludes(`weapon ${w.id}`, 'mastery name', masterySection!.text, new RegExp(masteryLabel));

      // Ranged or thrown weapons: ammunition type (if any) + numeric range.
      const isRangedOrThrown = w.range === 'ranged' || w.properties.includes('thrown');
      if (isRangedOrThrown) {
        if (w.ammunitionType) {
          expectIncludes(`weapon ${w.id}`, 'ammunition type', blob, new RegExp(w.ammunitionType));
        }
        if (w.normalRange !== undefined && w.longRange !== undefined) {
          expectIncludes(`weapon ${w.id}`, 'range', blob, new RegExp(`${w.normalRange}/${w.longRange}`));
        }
      }
    }
  });

  it('Lance renders Two-Handed with its "unless mounted" exception (finding #4)', () => {
    const item: InventoryItem = { id: 't', kind: 'weapon', catalogId: 'lance', quantity: 1 };
    const t = resolveWeaponTooltip(item)!;
    const props = t.sections.find((s) => s.label === 'Properties')!.text;
    expectIncludes('weapon lance', 'conditional Two-Handed', props, /Two-Handed \(unless mounted\)/);
  });
});

// ─── Weapon property / mastery definitions (every one) ──────────────────────
describe('completeness oracle — weapon property + mastery definitions', () => {
  it('the Light property names the extra-attack ability-modifier restriction', () => {
    expectIncludes('property light', 'different Light weapon', WEAPON_PROPERTY_TEXT.light, /different Light/i);
    expectIncludes('property light', 'no ability modifier unless negative', WEAPON_PROPERTY_TEXT.light, /no ability modifier .*unless the modifier is negative/i);
  });

  it('every mastery states its operative mechanic AND the feature-unlock requirement', () => {
    const masteries: MasteryProperty[] = ['cleave', 'graze', 'nick', 'push', 'sap', 'slow', 'topple', 'vex'];
    for (const m of masteries) {
      const text = WEAPON_MASTERY_TEXT[m];
      expect(text, `completeness oracle: mastery ${m} has no text`).toBeTruthy();
      // Universal feature-unlock requirement (PHB L9292/L9352).
      expectIncludes(`mastery ${m}`, 'feature-unlock requirement', text, /feature .*unlocks it|unlocks it/i);
    }
    // Specific operative details.
    expectIncludes('mastery cleave', 'once-per-turn limit', WEAPON_MASTERY_TEXT.cleave, /once per turn/i);
    expectIncludes('mastery cleave', 'reach condition', WEAPON_MASTERY_TEXT.cleave, /within your reach/i);
    expectIncludes('mastery nick', 'once-per-turn limit', WEAPON_MASTERY_TEXT.nick, /once per turn/i);
    expectIncludes('mastery graze', 'damage type', WEAPON_MASTERY_TEXT.graze, /damage type/i);
    expectIncludes('mastery graze', 'no-other-increase restriction', WEAPON_MASTERY_TEXT.graze, /increased only by increasing that modifier/i);
    expectIncludes('mastery slow', 'stacking cap', WEAPON_MASTERY_TEXT.slow, /not? .*more than 10 feet|never reduce Speed by more than 10 feet/i);
    expectIncludes('mastery topple', 'save DC formula', WEAPON_MASTERY_TEXT.topple, /DC 8 \+ the ability modifier used for the attack \+ your Proficiency Bonus/i);
    expectIncludes('mastery vex', 'expiry', WEAPON_MASTERY_TEXT.vex, /before the end of your next turn/i);
    expectIncludes('mastery sap', 'effect', WEAPON_MASTERY_TEXT.sap, /Disadvantage on its next attack/i);
    expectIncludes('mastery push', 'effect', WEAPON_MASTERY_TEXT.push, /push the creature up to 10 feet/i);
    expectIncludes('mastery slow', 'effect', WEAPON_MASTERY_TEXT.slow, /reduce the target.*Speed by 10 feet/i);
  });
});

// ─── Armor / shield tooltips (every armor) ──────────────────────────────────
describe('completeness oracle — armor/shield tooltips', () => {
  it('every armor tooltip states the training restriction, Dex behaviour, and stealth', () => {
    for (const a of ARMOR_LIST) {
      const item: InventoryItem = { id: 't', kind: 'armor', catalogId: a.id, quantity: 1 };
      const t = resolveArmorTooltip(item);
      expect(t, `completeness oracle: armor ${a.id} produced no tooltip`).toBeTruthy();
      if (!t) continue;
      const blob = tooltipText(t.sections);

      // Training restriction (PHB "Armor Training", L9615-9623).
      if (a.category === 'shield') {
        expectIncludes(`armor ${a.id}`, 'shield training restriction', blob, /training with Shields/i);
      } else {
        expectIncludes(`armor ${a.id}`, 'armor training restriction', blob, /without training.*Disadvantage.*(Strength|Dexterity)/i);
        expectIncludes(`armor ${a.id}`, "can't cast spells restriction", blob, /can.?t cast spells/i);
      }

      // Dex behaviour per category.
      const dex = t.sections.find((s) => s.label === 'Dexterity');
      expect(dex, `completeness oracle: armor ${a.id} has no Dexterity section`).toBeTruthy();
      if (a.category === 'medium') {
        expectIncludes(`armor ${a.id}`, 'medium Dex cap', dex!.text, /maximum \+2/i);
      } else if (a.category === 'heavy') {
        expectIncludes(`armor ${a.id}`, 'heavy no-Dex rule', dex!.text, /No Dexterity/i);
      }

      // Stealth disadvantage where applicable.
      const stealth = t.sections.find((s) => s.label === 'Stealth');
      expect(stealth, `completeness oracle: armor ${a.id} has no Stealth section`).toBeTruthy();
      if (a.stealthDisadvantage) {
        expectIncludes(`armor ${a.id}`, 'stealth disadvantage', stealth!.text, /Disadvantage/i);
      }
    }
  });
});

// ─── Equipment items with an operative mechanic (named set) ─────────────────
describe('completeness oracle — equipment operative mechanics', () => {
  // Each entry: catalogId → the required patterns its description must match.
  // Only items whose PHB entry has an operative mechanic are required to carry
  // it; purely descriptive gear is not forced to invent one.
  const REQUIRED: Record<string, RegExp[]> = {
    'potion-of-healing': [/Bonus Action/i, /2d4 \+ 2 Hit Points/i, /within 5 feet/i],
    oil: [/DC 8 \+ Dex mod \+ PB/i, /5 Fire damage/i, /5-ft square/i, /6 hours/i],
    caltrops: [/DC 15/i, /5-ft square/i, /10 min(utes)? to recover/i],
    'ball-bearings': [/DC 10/i, /10-ft square/i, /10 min(utes)? to recover/i],
    'grappling-hook': [/DC 13/i, /50 ft/i],
    'alchemists-fire': [/within 20 ft/i, /DC 8 \+ Dex mod \+ PB/i, /1d4 Fire/i],
    acid: [/within 20 ft/i, /DC 8 \+ Dex mod \+ PB/i, /2d6 Acid/i],
    'holy-water': [/within 20 ft/i, /DC 8 \+ Dex mod \+ PB/i, /2d8 Radiant/i],
    tinderbox: [/Bonus Action/i],
    'hooded-lantern': [/Bonus Action/i],
    torch: [/Simple Melee weapon/i, /1 Fire damage/i],
    rope: [/DC 10/i, /DC 20/i],
    'thieves-tools': [/DC 15/i],
    'healers-kit': [/Utilize/i, /stabilize/i],
    antitoxin: [/Bonus Action/i, /Poisoned/i, /1 hour/i],
  };

  it('every operative-mechanic item carries its action / DC / effect / duration', () => {
    for (const [id, patterns] of Object.entries(REQUIRED)) {
      const e = getEquipment(id);
      expect(e, `completeness oracle: equipment ${id} not found`).toBeTruthy();
      if (!e) continue;
      const item: InventoryItem = { id: 't', kind: 'equipment', catalogId: id, quantity: 1 };
      const t = resolveItemTooltip(item);
      expect(t, `completeness oracle: equipment ${id} produced no tooltip`).toBeTruthy();
      const text = t ? t.sections.map((s) => s.text).join(' ') : '';
      for (const p of patterns) {
        expectIncludes(`equipment ${id}`, `mechanic ${p}`, text, p);
      }
    }
  });

  it('every catalog equipment entry has a non-empty description (full-catalog sweep)', () => {
    for (const e of EQUIPMENT_LIST) {
      expect(
        !!e.description && e.description.trim().length > 0,
        `completeness oracle: equipment ${e.id} has no description`,
      ).toBe(true);
    }
  });
});
