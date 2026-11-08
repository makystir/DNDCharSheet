import { describe, it, expect } from 'vitest';
import { SPELL_CATALOG, getSpell, spellsForClass } from '../spells';
import type { CatalogSpell, SpellSchool } from '../spells';
import { SHIPPED_SPELL_IDS } from './shipped-spell-ids';

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

// The AUTHORITATIVE manifest, frozen to what the extraction tool verifiably
// finds in the PHB 2024 source (scripts/generate-spells.ts + its reconcile
// report, scripts/spell-report.json). The tool recovered 391 spells — three MORE
// than the previously-shipped 386, because the source carries Spell Description
// blocks for Magic Jar (L6 Necromancy), Telepathy (L8 Divination), and Find the
// Path (L6 Divination) that the old throwaway parser dropped. These counts are a
// by-construction oracle: any accidental omission, duplication, or class-list
// mis-parse fails the test.
const EXPECTED_BY_LEVEL: Record<number, number> = {
  0: 34, 1: 64, 2: 63, 3: 52, 4: 41, 5: 48, 6: 34, 7: 21, 8: 18, 9: 16,
};
const EXPECTED_TOTAL = Object.values(EXPECTED_BY_LEVEL).reduce((a, b) => a + b, 0); // 391
const EXPECTED_BY_CLASS: Record<string, number> = {
  bard: 140, cleric: 117, druid: 135, paladin: 51,
  ranger: 61, sorcerer: 150, warlock: 91, wizard: 242,
};

describe('SPELL_CATALOG shape & integrity', () => {
  it('matches the exact PHB 2024 catalog manifest (count by level)', () => {
    expect(SPELL_CATALOG.length).toBe(EXPECTED_TOTAL);
    const byLevel = SPELL_CATALOG.reduce<Record<number, number>>((acc, s) => {
      acc[s.level] = (acc[s.level] ?? 0) + 1;
      return acc;
    }, {});
    expect(byLevel).toEqual(EXPECTED_BY_LEVEL);
  });

  it('matches the exact per-class spell counts (class-list mis-parse guard)', () => {
    const byClass: Record<string, number> = {};
    for (const s of SPELL_CATALOG) {
      for (const c of s.classes) byClass[c] = (byClass[c] ?? 0) + 1;
    }
    expect(byClass).toEqual(EXPECTED_BY_CLASS);
  });

  it('includes the three spells the old parser dropped (Magic Jar, Telepathy, Find the Path)', () => {
    expect(getSpell('magic-jar'), "expected 'magic-jar'").toBeDefined();
    expect(getSpell('telepathy'), "expected 'telepathy'").toBeDefined();
    expect(getSpell('find-the-path'), "expected 'find-the-path'").toBeDefined();
    expect(getSpell('magic-jar')!.level).toBe(6);
    expect(getSpell('telepathy')!.level).toBe(8);
    expect(getSpell('find-the-path')!.level).toBe(6);
  });

  it('includes PHB 2024 spells previously missing from the catalog', () => {
    for (const id of [
      'mending', 'ray-of-frost', 'sorcerous-burst', 'banishment', 'blight',
      'hypnotic-pattern', 'prismatic-spray', 'mirage-arcane',
    ]) {
      expect(getSpell(id), `expected '${id}' in catalog`).toBeDefined();
    }
  });

  it('ID STABILITY: the id set is a SUPERSET of the previously-shipped ids', () => {
    // Spell ids are persisted in Character.spellcasting and hard-coded in
    // src/logic/spellcasting.ts; a regenerated id that dropped a shipped id
    // would dangle persisted character data. Every shipped id must still exist.
    const ids = new Set<string>(SPELL_CATALOG.map((s) => s.id));
    const missing = SHIPPED_SPELL_IDS.filter((id) => !ids.has(id));
    expect(missing, `shipped ids missing from the regenerated catalog: ${missing.join(', ')}`)
      .toEqual([]);
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

  it('every spell has every field present & non-empty (incl. effect)', () => {
    for (const s of SPELL_CATALOG) {
      expect(s.castingTime.trim().length, `${s.id} castingTime`).toBeGreaterThan(0);
      expect(s.range.trim().length, `${s.id} range`).toBeGreaterThan(0);
      expect(s.duration.trim().length, `${s.id} duration`).toBeGreaterThan(0);
      expect(typeof s.components.verbal).toBe('boolean');
      expect(typeof s.components.somatic).toBe('boolean');
      expect(s.description.trim().length, `${s.id} description`).toBeGreaterThan(5);
      expect(s.effect.trim().length, `${s.id} effect`).toBeGreaterThan(10);
    }
  });

  it('no two DISTINCT spells share an identical effect (text-bleed regression guard)', () => {
    // Direct, GLOBAL regression for the Dispel Magic <- Dissonant Whispers bleed:
    // a parser mis-split copies one spell's prose onto another, so no two records
    // may carry identical effect text (generalised beyond adjacent to global).
    const seen = new Map<string, string>();
    for (const s of SPELL_CATALOG) {
      const key = s.effect.trim();
      const prior = seen.get(key);
      expect(prior, `'${s.id}' shares an identical effect with '${prior}'`).toBeUndefined();
      seen.set(key, s.id);
    }
  });

  it('no two DISTINCT spells share an identical description', () => {
    const seen = new Map<string, string>();
    for (const s of SPELL_CATALOG) {
      const key = s.description.trim();
      const prior = seen.get(key);
      expect(prior, `'${s.id}' shares an identical description with '${prior}'`).toBeUndefined();
      seen.set(key, s.id);
    }
  });

  it('description is a bounded (<=160-char) slice of REAL effect prose', () => {
    for (const s of SPELL_CATALOG) {
      // Bounded.
      expect(s.description.length, `${s.id} description length`).toBeLessThanOrEqual(161);
      // It is a prefix of the whitespace-flattened effect (a truncation of the
      // real prose), so it can NEVER be a field-assembled "Level N School."
      // profile or a bare tag masquerading as a description.
      const flatEffect = s.effect.replace(/\s+/g, ' ').trim();
      const desc = s.description.replace(/\u2026$/, ''); // drop trailing ellipsis
      expect(
        flatEffect.startsWith(desc),
        `'${s.id}' description is not a prefix of its effect`,
      ).toBe(true);
    }
  });

  it('description is never a bare profile or a parenthesized/area/save tag', () => {
    // Hardened oracle: a profile ("Level N School."), a parenthesized tag group
    // ("(Concentration)"/"(Ritual)"), or a bare area/save/attack/condition tag
    // must NOT be the whole description. Because descriptions are now real prose,
    // this is trivially satisfied, but the guard stops any regression.
    const bareTagRe =
      /^(\d+-ft [A-Za-z]+|[A-Za-z]+ save|spell attack|[A-Za-z]+ condition)(,\s*|\.?\s*$)/i;
    for (const s of SPELL_CATALOG) {
      let rest = s.description.trim();
      rest = rest.replace(/^(Level [1-9] [A-Za-z]+|[A-Za-z]+ cantrip)/i, '');
      rest = rest.replace(/^\s*\([^)]*\)/, '');
      rest = rest.replace(/^\s*[—\u2013-]\s*/, '');
      let changed = true;
      while (changed) {
        const before = rest;
        rest = rest.replace(bareTagRe, '');
        changed = rest !== before;
      }
      rest = rest.replace(/[.\s\u2026]+$/, '').trim();
      expect(
        rest.length,
        `'${s.id}' has a profile/tag-only description: "${s.description}"`,
      ).toBeGreaterThan(0);
    }
  });

  it('concentration flag matches the duration text (both directions)', () => {
    for (const s of SPELL_CATALOG) {
      expect(
        s.concentration,
        `${s.id} concentration vs duration "${s.duration}"`,
      ).toBe(/^Concentration/i.test(s.duration));
    }
  });

  it('ritual flag never leaves "Ritual" text in the casting time', () => {
    // Ritual is derived from "... or Ritual" in the source Casting Time and the
    // suffix is stripped from the stored castingTime (cross-check).
    for (const s of SPELL_CATALOG) {
      expect(s.castingTime, `${s.id} castingTime still carries Ritual`).not.toMatch(/Ritual/i);
    }
  });

  it('range strings match the known PHB range grammar', () => {
    const rangeRe =
      /^(Self|Touch|Sight|Unlimited|Special|\d[\d,]* (feet|foot|mile|miles))(\s*\(.*\))?$/i;
    for (const s of SPELL_CATALOG) {
      expect(rangeRe.test(s.range), `${s.id} range "${s.range}"`).toBe(true);
    }
  });

  it('duration strings match the known PHB duration grammar', () => {
    const durationRe =
      /^(Instantaneous|Until dispelled|Until dispelled or triggered|Special|Concentration,? up to .+|Up to .+|\d[\d,]* (round|rounds|minute|minutes|hour|hours|day|days)|Until .+|Permanent.*)$/i;
    for (const s of SPELL_CATALOG) {
      expect(durationRe.test(s.duration), `${s.id} duration "${s.duration}"`).toBe(true);
    }
  });

  it('components letters are a subset of {V, S, M}', () => {
    for (const s of SPELL_CATALOG) {
      // Encoded as booleans + optional material; nothing else is representable.
      expect(typeof s.components.verbal).toBe('boolean');
      expect(typeof s.components.somatic).toBe('boolean');
      const mat = materialOf(s);
      if (mat !== undefined) expect(mat.trim().length).toBeGreaterThan(0);
    }
  });

  it('costed-material spells carry cost + consume text on a single unbroken line', () => {
    // Mechanically load-bearing materials must not be truncated at "GP," or
    // wrapped across lines (the Revivify-missing-diamond bug). Table of known
    // costed spells with their PHB 2024 cost and whether it is consumed.
    const cases: Array<[string, RegExp, boolean]> = [
      ['revivify', /300\+ GP/, true],
      ['resurrection', /1,000\+ GP/, true],
      ['true-resurrection', /25,000\+ GP/, true],
      ['divination', /25\+ GP/, true],
      ['continual-flame', /50\+ GP/, true],
      ['symbol', /1,000\+ GP/, true],
      ['magic-jar', /500\+ GP/, false],
    ];
    for (const [id, costRe, consumed] of cases) {
      const s = getSpell(id)!;
      expect(s, `'${id}' should exist`).toBeDefined();
      const mat = materialOf(s);
      expect(mat, `'${id}' should carry a material`).toBeDefined();
      expect(mat).not.toMatch(/\n/);
      expect(mat, `'${id}' cost text`).toMatch(costRe);
      if (consumed) expect(mat, `'${id}' consume text`).toMatch(/consumes/i);
    }
  });

  it('material component text has no OCR glue or multiline artifacts', () => {
    const letterGluedToNumber = /[a-z]\d/i;
    for (const s of SPELL_CATALOG) {
      const mat = materialOf(s);
      if (mat === undefined) continue;
      expect(mat.includes('\n'), `'${s.id}' material has a newline`).toBe(false);
      expect(mat.trim().length, `'${s.id}' material is blank`).toBeGreaterThan(0);
    }
    // Spot-check a representative material has no letter/number glue.
    expect(letterGluedToNumber.test(materialOf(getSpell('aid')!) ?? '')).toBe(false);
  });

  it('range/duration strings are normalized (no OCR spacing artifacts)', () => {
    const numberGluedToUnit = /\d(feet|foot|round|rounds|hour|hours|minute|minutes|day|days)\b/i;
    for (const s of SPELL_CATALOG) {
      for (const [field, value] of [
        ['range', s.range],
        ['duration', s.duration],
      ] as const) {
        expect(
          numberGluedToUnit.test(value),
          `${field} number/unit OCR glue in ${s.id}: ${value}`,
        ).toBe(false);
      }
      expect(s.duration).not.toMatch(/^Concentration up to\d/i);
    }
  });

  it('the recovered scrambled spells carry their correct fields & effect', () => {
    // The two-column OCR scramble (Insect Plague/Invisibility, Sacred Flame/
    // Scorching Ray) is fixed by cited overrides — assert each lands correctly.
    const insectPlague = getSpell('insect-plague')!;
    expect(insectPlague.range).toBe('300 feet');
    expect(insectPlague.effect).toMatch(/Swarming locusts/);
    expect(insectPlague.effect).toMatch(/4d10 Piercing/);

    const invisibility = getSpell('invisibility')!;
    expect(invisibility.range).toBe('Touch');
    expect(invisibility.effect).toMatch(/Invisible condition/);
    expect(materialOf(invisibility)).toMatch(/eyelash/);

    const sacredFlame = getSpell('sacred-flame')!;
    expect(sacredFlame.range).toBe('60 feet');
    expect(sacredFlame.effect).toMatch(/Radiant damage/);

    const scorchingRay = getSpell('scorching-ray')!;
    expect(scorchingRay.range).toBe('120 feet');
    expect(scorchingRay.effect).toMatch(/three fiery rays/);
    expect(scorchingRay.effect).toMatch(/2d6 Fire/);
  });

  it('no effect/description begins with a stray component-letter or field-label fragment', () => {
    // GENERAL spliced/garbage-prose oracle (not keyed to any spell name). A
    // Components echo ("V, S, M (...)"), a field label ("Components"), or an
    // OCR remnant of one ("ponerter ...") must never leak into the start of the
    // user-facing prose. This FAILS the pre-fix Mending record, whose effect and
    // description began with "ponerter V. S M (tve lodesteres)". Real spell prose
    // opens with a word/sentence, never a bare component run or a field label.
    const strayPrefixRe =
      /^\s*(?:ponerter\b|components\b|[VSM](?:[.,]\s*[VSM]\b|\s+[VSM]\b))/i;
    for (const s of SPELL_CATALOG) {
      const flatEffect = s.effect.replace(/\s+/g, ' ').trim();
      expect(
        strayPrefixRe.test(flatEffect),
        `'${s.id}' effect opens with a component/field-label fragment: "${flatEffect.slice(0, 48)}"`,
      ).toBe(false);
      expect(
        strayPrefixRe.test(s.description.trim()),
        `'${s.id}' description opens with a component/field-label fragment: "${s.description.slice(0, 48)}"`,
      ).toBe(false);
    }
  });

  // Structural markers for an EMBEDDED creature stat block or a rolled table
  // rendered inline in an effect (e.g. Summon/Conjure spells carry a stat block;
  // Reincarnate carries a d10 species table). These regions are NON-PROSE and,
  // per the blueprint, still carry deferred verbatim OCR-glyph noise ("MOD SAVE
  // MOD SAVE", "Wts 10", "ldlO Species", etc.) that is a tracked follow-up — NOT
  // force-normalized here. The splice/orphan PROSE oracle below excludes these
  // regions so it stays a true regression guard for spliced PROSE without
  // false-positiving on the deferred stat-block/table noise. This is a GENERAL
  // structural rule (markers, not spell names): any future spell with an
  // embedded stat block/table is handled the same way, while a future spell with
  // spliced PROSE (no such markers) is still fully checked.
  // Markers chosen to be UNAMBIGUOUS stat-block/table structural lines that do
  // not occur as ordinary prose sentences, so the exclusion never hides a real
  // prose splice. A wall/object spell that mentions "AC 12 and 30 Hit Points" in
  // a SENTENCE is not excluded (that carries AC xor HP in prose); only the
  // stat-block defense LINE carrying BOTH an "AC <n>" and an "HP <n>" grid field
  // is. The size/type/alignment header line, the "MOD SAVE" ability-grid header,
  // "CR None", and the OCR-garbled rolled-table header ("ldlO Species") are the
  // other structural starts.
  const STAT_BLOCK_MARKERS: RegExp[] = [
    // Size/type/alignment header, e.g. "Medium Undead, Neutral" / "Large Beast,
    // Unaligned" (optionally "Humanoid or Beast").
    /^(?:Tiny|Small|Medium|Large|Huge|Gargantuan)\s+[A-Z][a-z]+(?:\s+or\s+[A-Z][a-z]+)?,\s+(?:Unaligned|Lawful|Neutral|Chaotic)/m,
    // Stat-block defense line carrying BOTH an AC and an HP grid field.
    /(?=.*\bAC\s+\d)(?=.*\bHP\s+\d)/i,
    /\bMOD\s+SAVE\b/i, // ability-score grid header
    /\bCR\s+None\b/i, // challenge-rating line of a conjured creature
    /\bld[l1O0]O\s+Species\b/i, // OCR "ldlO Species" rolled-table header (Reincarnate)
  ];
  const isStatBlockRegion = (para: string): boolean =>
    STAT_BLOCK_MARKERS.some((re) => re.test(para));
  /**
   * The player-facing PROSE paragraphs of an effect: everything up to the first
   * embedded stat-block/table marker. If an effect has no such marker, every
   * paragraph is prose. Structural, not name-based.
   */
  const prosePart = (effect: string): string[] => {
    const paras = effect.split('\n\n');
    const firstBlock = paras.findIndex(isStatBlockRegion);
    return firstBlock === -1 ? paras : paras.slice(0, firstBlock);
  };

  it('no effect contains a fused-sentence splice or a leading-lowercase orphan fragment', () => {
    // GENERAL two-column-scramble oracle (not keyed to any spell name). The
    // Magic Jar OCR fused "...On a successful save, the When the spell ends..."
    // — a sentence-ending punctuation (or capitalized word) butted directly
    // against a new capitalized clause — and stranded a "target resists..."
    // fragment as a paragraph that begins mid-sentence with a lowercase word.
    // Both are reconstruction failures; guard against either reappearing.
    //
    // Fused splice: a word immediately followed by a space then a capitalized
    // word that itself leads into a clause with no sentence-ending punctuation
    // between them — e.g. "the When the spell ends". We detect the specific
    // splice signature: a lowercase word, a space, then "the"/"a"/"an" style
    // determiner or pronoun run followed immediately by an unpunctuated capital
    // starting a known clause opener ("When"/"On"/"If"/"The"). To stay general
    // yet precise we flag any ", the When"/", the If"/", the On" style fusion
    // where a determiner is glued to a capitalized sentence opener.
    const fusedSpliceRe = /\b(?:the|a|an)\s+(?:When|On|If|While|Once|Meanwhile|Using)\b/;
    // NOTE on carried-verbatim OCR noise (blueprint follow-up, do NOT fix here):
    // some upcast prose carries verbatim digit glyphs ("ld10", "3o", "O Hit
    // Points", "spel! save DC"). These are tracked separately; this oracle must
    // not force-normalize them, so it targets only splice/orphan structure.
    for (const s of SPELL_CATALOG) {
      // Only the player-facing PROSE part is checked; embedded stat-block/table
      // regions (deferred OCR follow-up) are excluded structurally (see above).
      const paragraphs = prosePart(s.effect);
      for (const para of paragraphs) {
        const flat = para.replace(/\s+/g, ' ').trim();
        if (flat.length === 0) continue;
        // Fused-sentence splice: determiner glued to a capitalized clause opener
        // within a sentence (the "the When" signature).
        expect(
          fusedSpliceRe.test(flat),
          `'${s.id}' effect has a fused-sentence splice: "${flat}"`,
        ).toBe(false);
        // Leading-lowercase orphan fragment: a paragraph that starts mid-sentence
        // with a lowercase letter is a stranded fragment, not real prose. Upcast
        // and cantrip-upgrade addenda legitimately start capitalized, so a
        // lowercase paragraph start is always an artifact.
        expect(
          /^[a-z]/.test(flat),
          `'${s.id}' effect has a leading-lowercase orphan fragment: "${flat.slice(0, 48)}"`,
        ).toBe(false);
      }
    }
  });

  it('SpellId is a finite literal union derived from the catalog', () => {
    const ids = SPELL_CATALOG.map((s) => s.id);
    expect(ids).toContain('fireball');
    expect(ids).toContain('mage-hand');
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
    expect(wiz.length).toBeGreaterThan(spellsForClass('paladin').length);
  });
});
