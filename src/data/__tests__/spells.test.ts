import { describe, it, expect } from 'vitest';
import { SPELL_CATALOG, getSpell, spellsForClass } from '../spells';
import type { CatalogSpell, SpellSchool } from '../spells';

/**
 * The material component text for a spell, or undefined. SPELL_CATALOG is
 * `as const`, so each record's `components` is a narrowed literal and only some
 * members carry a `material` key; this reads it without widening the catalog.
 */
function materialOf(spell: CatalogSpell): string | undefined {
  const components = spell.components as { material?: string };
  return components.material;
}

const SCHOOLS: SpellSchool[] = [
  'abjuration', 'conjuration', 'divination', 'enchantment',
  'evocation', 'illusion', 'necromancy', 'transmutation',
];
const CLASS_IDS = new Set([
  'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard',
]);

// Exact per-level manifest of the full PHB 2024 catalog. Transcribed from the
// PHB 2024 "Spell Descriptions" section and reconciled against the per-class
// spell lists; an exact count (not a loose floor) so an accidental omission or
// duplication fails the test (review finding: loose '> 350' assertion).
const EXPECTED_BY_LEVEL: Record<number, number> = {
  0: 34, 1: 64, 2: 62, 3: 51, 4: 41, 5: 48, 6: 32, 7: 21, 8: 17, 9: 16,
};
const EXPECTED_TOTAL = Object.values(EXPECTED_BY_LEVEL).reduce((a, b) => a + b, 0);

describe('SPELL_CATALOG shape & integrity', () => {
  it('matches the exact PHB 2024 catalog manifest (count by level)', () => {
    expect(SPELL_CATALOG.length).toBe(EXPECTED_TOTAL);
    const byLevel = SPELL_CATALOG.reduce<Record<number, number>>((acc, s) => {
      acc[s.level] = (acc[s.level] ?? 0) + 1;
      return acc;
    }, {});
    expect(byLevel).toEqual(EXPECTED_BY_LEVEL);
  });

  it('includes PHB 2024 spells previously missing from the catalog', () => {
    // Regression guard for the review finding (omitted legal choices).
    for (const id of [
      'mending', 'ray-of-frost', 'sorcerous-burst', 'banishment', 'blight',
      'hypnotic-pattern', 'prismatic-spray', 'mirage-arcane',
    ]) {
      expect(getSpell(id), `expected '${id}' in catalog`).toBeDefined();
    }
  });

  it('has unique ids and non-empty names', () => {
    const ids = SPELL_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SPELL_CATALOG) {
      expect(s.name.trim().length).toBeGreaterThan(0);
      expect(s.id.trim().length).toBeGreaterThan(0);
    }
  });

  it('every spell has a valid level, school, and at least one class', () => {
    for (const s of SPELL_CATALOG) {
      expect(s.level).toBeGreaterThanOrEqual(0);
      expect(s.level).toBeLessThanOrEqual(9);
      expect(SCHOOLS).toContain(s.school);
      expect(s.classes.length).toBeGreaterThan(0);
      for (const c of s.classes) expect(CLASS_IDS.has(c)).toBe(true);
    }
  });

  it('every spell has casting time, range, duration and a components object', () => {
    for (const s of SPELL_CATALOG) {
      expect(s.castingTime.trim().length).toBeGreaterThan(0);
      expect(s.range.trim().length).toBeGreaterThan(0);
      expect(s.duration.trim().length).toBeGreaterThan(0);
      expect(typeof s.components.verbal).toBe('boolean');
      expect(typeof s.components.somatic).toBe('boolean');
    }
  });

  it('concentration flag matches the duration text', () => {
    for (const s of SPELL_CATALOG) {
      if (/^Concentration/i.test(s.duration)) {
        expect(s.concentration).toBe(true);
      }
    }
  });

  it('every spell has a present, bounded, paraphrase-safe description', () => {
    for (const s of SPELL_CATALOG) {
      // Present and non-trivial.
      expect(s.description.trim().length).toBeGreaterThan(5);
      // Bounded — a short summary, never a long verbatim passage
      // (rules-compliance rule 5). Our generated summaries stay well under this.
      expect(s.description.length).toBeLessThanOrEqual(160);
      // Leads with the school/level profile so it is always meaningful.
      expect(s.description).toMatch(/(cantrip|Level [1-9])/i);
    }
  });

  it('every description carries an effect paraphrase, not just a profile', () => {
    // Regression for the review findings (reviewer A/B, confirmed blocking):
    // many records previously carried only a profile ("Level N School
    // (Concentration).") plus at most a bare area/save/condition tag with no
    // effect text. The earlier regex (/^Level [1-9] [A-Za-z]+\.$/) only caught
    // a bare profile and was dodged by a parenthesized tag suffix and by bare
    // area/save tags. This strips the profile, any parenthesized tag group, and
    // leading bare profile-only tags (area shapes, saves, spell attack,
    // conditions), then requires remaining effect prose.
    const bareTagRe =
      /^(\d+-ft [A-Za-z]+|[A-Za-z]+ save|spell attack|[A-Za-z]+ condition)(,\s*|\.?\s*$)/i;
    for (const s of SPELL_CATALOG) {
      let rest = s.description.trim();
      // Strip the leading "<School> cantrip" / "Level N <School>" profile.
      rest = rest.replace(/^(Level [1-9] [A-Za-z]+|[A-Za-z]+ cantrip)/i, '');
      // Strip a single parenthesized tag group, e.g. " (Concentration, Ritual)".
      rest = rest.replace(/^\s*\([^)]*\)/, '');
      // Strip the separator dash.
      rest = rest.replace(/^\s*[—\u2013-]\s*/, '');
      // Strip any run of bare profile-only tags (area/save/attack/condition).
      let changed = true;
      while (changed) {
        const before = rest;
        rest = rest.replace(bareTagRe, '');
        changed = rest !== before;
      }
      rest = rest.replace(/[.\s]+$/, '').trim();
      expect(
        rest.length,
        `'${s.id}' has a profile/tag-only description with no effect paraphrase: "${s.description}"`,
      ).toBeGreaterThan(0);
    }
  });

  it('high-level spells that lacked an effect summary now describe their effect', () => {
    // Direct regression guards for the specific records reviewers enumerated as
    // profile-only (confirmed blocking). Assert a meaningful effect keyword.
    const cases: Array<[string, RegExp]> = [
      ['conjure-celestial', /heal|Radiant/i],
      ['forcecage', /cage|prison|force/i],
      ['mordenkainen-s-sword', /4d12 Force/i],
      ['project-image', /illusory|copy/i],
      ['control-weather', /weather|precipitation|wind/i],
      ['earthquake', /tremor|Prone|fissure/i],
      ['maze', /demiplane|escape|Investigation/i],
      ['tsunami', /6d10 Bludgeoning|wall of water/i],
      ['gate', /portal|plane/i],
      ['shapechange', /shape-shift|CR up to/i],
      ['storm-of-vengeance', /storm|Lightning|Thunder/i],
      ['true-polymorph', /transform|object/i],
      ['counterspell', /Constitution save|spell fails/i],
      ['conjure-minor-elementals', /2d8|Emanation/i],
    ];
    for (const [id, re] of cases) {
      const spell = getSpell(id)!;
      expect(spell, `'${id}' should exist`).toBeDefined();
      expect(
        re.test(spell.description),
        `'${id}' description should describe its effect: "${spell.description}"`,
      ).toBe(true);
    }
  });

  it('corrected high-level damage/healing summaries are PHB-accurate (no inventions)', () => {
    // Regression for reviewer B's confirmed blocking finding on wrong/incomplete
    // summaries, with values independently sourced from PHB 2024:
    //  - Holy Aura (PHB 2024 p.287): deals NO damage; grants save Advantage,
    //    imposes attack Disadvantage, Blinds a Fiend/Undead attacker on a save.
    //  - Meteor Swarm (PHB 2024 p.296): 20d6 Fire AND 20d6 Bludgeoning.
    //  - Mass Cure Wounds (PHB 2024 p.283): 5d8 + spellcasting ability modifier.
    const holyAura = getSpell('holy-aura')!;
    expect(holyAura.description).not.toMatch(/\d+d\d+/); // deals no damage
    expect(holyAura.description).toMatch(/Advantage/);
    expect(holyAura.description).toMatch(/Disadvantage/);
    expect(holyAura.description).toMatch(/Blinded/i);

    const meteorSwarm = getSpell('meteor-swarm')!;
    expect(meteorSwarm.description).toMatch(/20d6 Fire/i);
    expect(meteorSwarm.description).toMatch(/20d6 Bludgeoning/i);

    const massCure = getSpell('mass-cure-wounds')!;
    expect(massCure.description).toMatch(/5d8/);
    expect(massCure.description).toMatch(/spellcasting ability modifier/i);
  });

  it('Revivify carries its PHB 2024 material component (consumed diamond)', () => {
    // Source-backed component assertion for the review finding: PHB 2024 p.313
    // Revivify requires V, S, M (a diamond worth 300+ GP, consumed).
    const revivify = getSpell('revivify')!;
    expect(revivify.components.verbal).toBe(true);
    expect(revivify.components.somatic).toBe(true);
    const material = materialOf(revivify);
    expect(material).toBeDefined();
    expect(material).toMatch(/diamond/i);
    expect(material).toMatch(/300\+ GP/);
    expect(material).toMatch(/consumes/i);
  });

  it('material component text has no OCR glue or multiline artifacts', () => {
    // Audit for parser-generated multiline / glued material strings (review
    // finding): a material string must be a single clean line.
    const letterGluedToNumber = /[a-z]\d/i;
    for (const s of SPELL_CATALOG) {
      const mat = materialOf(s);
      if (mat === undefined) continue;
      expect(mat.includes('\n'), `'${s.id}' material has a newline`).toBe(false);
      expect(mat.trim().length, `'${s.id}' material is blank`).toBeGreaterThan(0);
      expect(
        letterGluedToNumber.test(mat),
        `'${s.id}' material has letter/number OCR glue: ${mat}`,
      ).toBe(false);
    }
  });

  it('Healing Word states its healing dice (not a bare restore)', () => {
    // Review finding: Healing Word omitted its dice where Cure Wounds included
    // them. PHB 2024: Healing Word restores 2d4 + spellcasting ability modifier.
    const hw = getSpell('healing-word')!;
    expect(hw.description).toMatch(/2d4/);
    expect(hw.description).toMatch(/spellcasting ability modifier/i);
  });

  it('range/duration strings are normalized (no OCR spacing artifacts)', () => {
    // Guards the review findings about OCR glue. Two distinct artifacts:
    //  (a) a number glued to a trailing unit: '1round', '100feet'.
    //  (b) a word glued to a following number: 'up to1 minute', 'to1'.
    // The earlier oracle only caught (a); a digit after 'to' (before a space +
    // unit) slipped through — so we also reject a letter immediately followed
    // by a digit (re-review finding: 'up to1 minute' in Resistance/Shining
    // Smite). Valid strings never glue a letter directly to a digit.
    const numberGluedToUnit = /\d(feet|foot|round|rounds|hour|hours|minute|minutes|day|days)\b/i;
    const letterGluedToNumber = /[a-z]\d/i;
    for (const s of SPELL_CATALOG) {
      for (const [field, value] of [
        ['range', s.range],
        ['duration', s.duration],
      ] as const) {
        expect(
          numberGluedToUnit.test(value),
          `${field} number/unit OCR glue in ${s.id}: ${value}`,
        ).toBe(false);
        expect(
          letterGluedToNumber.test(value),
          `${field} letter/number OCR glue in ${s.id}: ${value}`,
        ).toBe(false);
      }
      expect(s.duration).not.toMatch(/^Concentration up to\d/i);
      expect(s.duration).not.toMatch(/^Concentration up to$/i);
    }
  });

  it('corrected spell summaries state the right mechanic (no inversions)', () => {
    // Regression for the re-review finding: Chill Touch inverted healing and
    // Cure Wounds omitted the spellcasting modifier.
    const chill = getSpell('chill-touch')!;
    expect(chill.description).toMatch(/can.t regain Hit Points/i);
    expect(chill.description).not.toMatch(/restores Hit Points/i);
    const cure = getSpell('cure-wounds')!;
    expect(cure.description).toMatch(/spellcasting ability modifier/i);
  });

  it('SpellId is a finite literal union derived from the catalog', () => {
    // If the catalog loses `as const`, SpellId widens to string and the
    // __SpellIdLiteralGuard type alias in spells.ts fails to compile (so this
    // is really enforced at typecheck). Here we assert the known-id round-trip.
    const ids = SPELL_CATALOG.map((s) => s.id);
    expect(ids).toContain('fireball');
    expect(ids).toContain('mage-hand');
  });

  it('carries NO srd/licensing flag (user manages spell licensing)', () => {
    for (const s of SPELL_CATALOG) {
      expect('srd' in s).toBe(false);
    }
  });

  it('spot-checks known PHB 2024 spells', () => {
    const fireball = getSpell('fireball')!;
    expect(fireball).toBeDefined();
    expect(fireball.level).toBe(3);
    expect(fireball.school).toBe('evocation');
    expect([...fireball.classes].sort()).toEqual(['sorcerer', 'wizard']);

    const mageHand = getSpell('mage-hand')!;
    expect(mageHand.level).toBe(0);
    expect(mageHand.school).toBe('conjuration');

    const cureWounds = getSpell('cure-wounds')!;
    expect(cureWounds.school).toBe('abjuration'); // 2024 reclassified to Abjuration.

    const alarm = getSpell('alarm')!;
    expect(alarm.ritual).toBe(true);
  });
});

describe('getSpell / spellsForClass', () => {
  it('getSpell tolerates unknown/undefined ids', () => {
    expect(getSpell(undefined)).toBeUndefined();
    expect(getSpell('not-a-spell')).toBeUndefined();
    expect(getSpell('fireball')?.name).toBe('Fireball');
  });

  it('spellsForClass returns only that class\'s spells', () => {
    const wiz = spellsForClass('wizard');
    expect(wiz.length).toBeGreaterThan(0);
    for (const s of wiz) expect(s.classes).toContain('wizard');
    // Wizard has the largest list in the PHB.
    expect(wiz.length).toBeGreaterThan(spellsForClass('paladin').length);
  });
});
