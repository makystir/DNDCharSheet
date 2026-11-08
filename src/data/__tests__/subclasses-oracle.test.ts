/**
 * ORACLE test for the PHB 2024 subclass feature catalog (Stage 2 of the level-up
 * gap work).
 *
 * Compares EVERY subclass of EVERY class in the live catalog (CLASS_CATALOG in
 * src/data/classes.ts) against the independently authored golden fixture
 * (./subclasses-golden.ts). It FAILS CLOSED: every assertion carries a message
 * naming `<class>/<subclassId>/<feature>.<field>`, a subclass or feature
 * missing from the catalog (or an unexpected extra one) fails by name, and
 * structured mechanics (uses, dice, DC, granted spells, granted proficiencies,
 * choices, Fighting Style grants, subclass spellcasting) are compared against
 * the golden VALUES, never matched against the paraphrased prose.
 *
 * Also covers how subclass features flow into classFeaturesByLevel /
 * classFeaturesByLevelTagged once chosen, including on a multiclass secondary
 * class.
 * Source of truth: Docs/PlayersHandbook.md (the "<CLASS> SUBCLASSES" sections).
 */
import { describe, it, expect } from 'vitest';
import { CLASS_CATALOG, CLASS_LIST } from '../classes';
import type { ClassFeature, SubclassData } from '../classes';
import { classFeaturesByLevel, classFeaturesByLevelTagged } from '../../logic/classes';
import { BLANK_CHARACTER } from '../../types/character';
import type { Character, ClassEntry } from '../../types/character';
import {
  SUBCLASS_GOLDEN,
  type GoldenFeature,
  type GoldenSpellGrant,
  type GoldenSubclass,
  type GoldenSubclassClass,
} from './subclasses-golden';

// ─── helpers ─────────────────────────────────────────────────────────────────

const CLASS_IDS: GoldenSubclassClass[] = [
  'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
];

/** Exact PHB subclass names/ids per class (pinned independently of the golden file). */
const EXPECTED_SUBCLASSES: Record<GoldenSubclassClass, Array<[id: string, name: string]>> = {
  barbarian: [['berserker', 'Path of the Berserker'], ['wildHeart', 'Path of the Wild Heart'], ['worldTree', 'Path of the World Tree'], ['zealot', 'Path of the Zealot']],
  bard: [['dance', 'College of Dance'], ['glamour', 'College of Glamour'], ['lore', 'College of Lore'], ['valor', 'College of Valor']],
  cleric: [['life', 'Life Domain'], ['light', 'Light Domain'], ['trickery', 'Trickery Domain'], ['war', 'War Domain']],
  druid: [['land', 'Circle of the Land'], ['moon', 'Circle of the Moon'], ['sea', 'Circle of the Sea'], ['stars', 'Circle of the Stars']],
  fighter: [['battleMaster', 'Battle Master'], ['champion', 'Champion'], ['eldritchKnight', 'Eldritch Knight'], ['psiWarrior', 'Psi Warrior']],
  monk: [['mercy', 'Warrior of Mercy'], ['shadow', 'Warrior of Shadow'], ['elements', 'Warrior of the Elements'], ['openHand', 'Warrior of the Open Hand']],
  paladin: [['devotion', 'Oath of Devotion'], ['glory', 'Oath of Glory'], ['ancients', 'Oath of the Ancients'], ['vengeance', 'Oath of Vengeance']],
  ranger: [['beastMaster', 'Beast Master'], ['feyWanderer', 'Fey Wanderer'], ['gloomStalker', 'Gloom Stalker'], ['hunter', 'Hunter']],
  rogue: [['arcaneTrickster', 'Arcane Trickster'], ['assassin', 'Assassin'], ['soulknife', 'Soulknife'], ['thief', 'Thief']],
  sorcerer: [['aberrant', 'Aberrant Sorcery'], ['clockwork', 'Clockwork Sorcery'], ['draconic', 'Draconic Sorcery'], ['wildMagic', 'Wild Magic Sorcery']],
  warlock: [['archfey', 'Archfey Patron'], ['celestial', 'Celestial Patron'], ['fiend', 'Fiend Patron'], ['greatOldOne', 'Great Old One Patron']],
  wizard: [['abjurer', 'Abjurer'], ['diviner', 'Diviner'], ['evoker', 'Evoker'], ['illusionist', 'Illusionist']],
};

const ABILITY_KEY = (s: string): string => s.toLowerCase();
const spellId = (n: string): string => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const uniqSorted = <T>(xs: readonly T[]): T[] => [...new Set(xs)].sort();
const key = (f: { name: string; level: number }): string => `${f.name}@L${f.level}`;

const GOLDEN_BY_CLASS = (cls: GoldenSubclassClass): GoldenSubclass[] =>
  SUBCLASS_GOLDEN.filter((g) => g.class === cls);

function catalogSubclasses(cls: GoldenSubclassClass): SubclassData[] {
  return (CLASS_CATALOG as unknown as Record<string, { subclasses: SubclassData[] }>)[cls].subclasses;
}

// ─── projections: golden and catalog reduced to the same comparable shape ───

/** Golden `uses.count` -> catalog `uses.count` spelling. */
function goldenUseCount(c: NonNullable<GoldenFeature['uses']>['count']): number | string {
  if (typeof c === 'number') return c;
  if (typeof c === 'string') {
    const m: Record<string, string> = {
      'wild-shape': 'Wild Shape use',
      'channel-divinity': 'Channel Divinity use',
      'bardic-inspiration': 'Bardic Inspiration use',
    };
    return m[c] ?? `UNMAPPED:${c}`;
  }
  const a = c.abilityMod;
  return `${a.charAt(0).toUpperCase()}${a.slice(1)} mod (min ${c.min})`;
}

/** Golden save DC formula -> catalog `saveDc.dcAbility`. */
function goldenDcAbility(dc: string): string {
  if (dc === 'spell-save-dc') return 'spellcasting';
  if (dc === '8+StrOrDex+Prof') return 'str'; // + mechanics.dcAbilityAlt 'dex'
  const m = /^8\+(\w+)\+Prof$/.exec(dc);
  return m ? ABILITY_KEY(m[1]) : `UNMAPPED:${dc}`;
}

type SpellRow = string; // `${level}|${spellId}|${prepared}`
function spellRows(level: number, spells: string[], prepared: boolean): SpellRow[] {
  return spells.map((s) => `${level}|${spellId(s)}|${prepared}`);
}
function goldenSpellRows(grants: GoldenSpellGrant[] | undefined): SpellRow[] {
  return uniqSorted((grants ?? []).flatMap((g) => spellRows(g.level, g.spells, g.mode === 'always-prepared' || g.mode === 'always-prepared-while-holding-item')));
}
/** Cardinality: how many spells are granted at each level (chosen-count grants included). */
function goldenSpellCounts(grants: GoldenSpellGrant[] | undefined): Record<number, number> {
  const out: Record<number, number> = {};
  for (const g of grants ?? []) out[g.level] = (out[g.level] ?? 0) + g.spells.length + (g.chosenCount ?? 0);
  return out;
}

function catalogSpellRows(f: ClassFeature): SpellRow[] {
  return uniqSorted((f.grantedSpells ?? []).flatMap((g) => spellRows(g.level, g.spells, g.alwaysPrepared)));
}
function catalogSpellCounts(f: ClassFeature): Record<number, number> {
  const out: Record<number, number> = {};
  for (const g of f.grantedSpells ?? []) out[g.level] = (out[g.level] ?? 0) + g.spells.length;
  return out;
}

const normExpr = (e: string): string => e.replace(/\s+/g, '').toLowerCase();

interface Cmp {
  uses: unknown;
  save: unknown;
  reaction: boolean;
  channelDivinity: boolean;
  fightingStyleGrants: number;
  diceExprs: string[];
  profs: unknown;
  choices: unknown;
}

function goldenCmp(g: GoldenFeature): Cmp {
  const p = g.proficiencies;
  return {
    uses: g.uses ? { count: goldenUseCount(g.uses.count), recharge: g.uses.recharge === 'per-rage' ? 'other' : g.uses.recharge } : null,
    save: g.save ? { dc: goldenDcAbility(g.save.dc), save: g.save.save, alt: g.save.dc === '8+StrOrDex+Prof' ? 'dex' : null } : null,
    reaction: g.reaction === true,
    channelDivinity: g.channelDivinity === true,
    fightingStyleGrants: g.featGrants?.fightingStyleFeats ?? 0,
    diceExprs: (g.dice ?? []).map((d) => normExpr(d.expr)),
    profs: {
      skillChoices: p?.skillChoices ?? 0,
      toolChoices: p?.toolChoices ?? 0,
      skills: uniqSorted((p?.skills ?? []).map(norm)),
      tools: uniqSorted((p?.tools ?? []).map(norm)),
      weapons: uniqSorted((p?.weapons ?? []).map(norm)),
      armor: uniqSorted((p?.armor ?? []).map(norm)),
      languages: [] as string[],
      languageChoices: 0,
      saveFixed: p?.savingThrows?.fixed ? [...p.savingThrows.fixed] : [],
      saveFallback: p?.savingThrows?.fallbackChoice ? [...p.savingThrows.fallbackChoice].sort() : [],
    },
    choices: (g.choices ?? []).map((c) => ({
      key: c.key,
      count: c.count,
      options: uniqSorted(c.options),
      countByLevel: c.countByLevel ?? null,
    })),
  };
}

/** Catalog `maneuversL<n>` style mechanics -> a countByLevel record. */
function catalogCountByLevel(f: ClassFeature, prefix: string): Record<number, number> | null {
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(f.mechanics ?? {})) {
    const m = new RegExp(`^${prefix}L(\\d+)$`).exec(k);
    if (m && typeof v === 'number') out[Number(m[1])] = v;
  }
  return Object.keys(out).length ? out : null;
}

function catalogCmp(f: ClassFeature): Cmp {
  const p = f.grantedProficiencies;
  const mech = f.mechanics ?? {};
  const fallback = typeof mech.fallbackSaveChoice === 'string' ? mech.fallbackSaveChoice.split('|').sort() : [];
  return {
    uses: f.uses ? { count: f.uses.count, recharge: f.uses.recharge } : null,
    save: f.saveDc
      ? { dc: f.saveDc.dcAbility, save: f.saveDc.saveAbility, alt: typeof mech.dcAbilityAlt === 'string' ? mech.dcAbilityAlt : null }
      : null,
    reaction: mech.activation === 'reaction',
    channelDivinity: mech.channelDivinity === 1,
    fightingStyleGrants: f.grantsFightingStyle ? 1 : 0,
    diceExprs: (f.dice ?? []).map((d) => normExpr(d.expr)),
    profs: {
      skillChoices: p?.skillChoices ?? 0,
      toolChoices: p?.toolChoices ?? 0,
      skills: uniqSorted((p?.skills ?? []).map((s) => norm(String(s)))),
      tools: uniqSorted((p?.tools ?? []).map(norm)),
      weapons: uniqSorted((p?.weapons ?? []).map(norm)),
      armor: uniqSorted((p?.armor ?? []).map(norm)),
      languages: uniqSorted((p?.languages ?? []).map(norm)),
      languageChoices: p?.languageChoices ?? 0,
      saveFixed: typeof mech.saveProficiency === 'string' ? [mech.saveProficiency] : [],
      saveFallback: fallback,
    },
    choices: (f.choices ?? []).map((c) => ({
      key: c.key,
      count: c.count,
      options: uniqSorted(c.options),
      countByLevel: catalogCountByLevel(f, 'maneuvers'),
    })),
  };
}

/** Eldritch Knight / Arcane Trickster: golden spellcasting vs catalog mechanics arrays (index = level - 1). */
function checkSpellcasting(where: string, g: GoldenFeature, f: ClassFeature): void {
  const sc = g.spellcasting;
  const mech = (f.mechanics ?? {}) as Record<string, unknown>;
  if (!sc) {
    expect(mech.spellAbility, `${where}.spellcasting: catalog has spellcasting the golden lacks`).toBeUndefined();
    return;
  }
  expect(mech.spellAbility, `${where}.spellcasting.ability`).toBe(sc.ability);
  expect(mech.spellList, `${where}.spellcasting.spellList`).toBe(sc.spellList);
  const arr = (k: string): number[] => (Array.isArray(mech[k]) ? (mech[k] as number[]) : []);
  const at = (k: string, lvl: number): number => arr(k)[lvl - 1] ?? 0;
  const cantrip = (lvl: number): number =>
    Object.entries(sc.cantripsKnown).filter(([l]) => Number(l) <= lvl).map(([, n]) => n).pop() ?? 0;
  for (let lvl = 1; lvl <= 20; lvl++) {
    expect(at('cantripsKnownByLevel', lvl), `${where}.spellcasting.cantripsKnown at Lv${lvl}`).toBe(cantrip(lvl));
    expect(at('preparedByLevel', lvl), `${where}.spellcasting.prepared at Lv${lvl}`).toBe(sc.preparedByLevel[lvl] ?? 0);
    const slots = sc.slotsByLevel[lvl] ?? [0, 0, 0, 0];
    expect(at('slotsL1ByLevel', lvl), `${where}.spellcasting.slotsL1 at Lv${lvl}`).toBe(slots[0]);
    expect(at('slotsL2ByLevel', lvl), `${where}.spellcasting.slotsL2 at Lv${lvl}`).toBe(slots[1]);
    expect(at('slotsL3ByLevel', lvl), `${where}.spellcasting.slotsL3 at Lv${lvl}`).toBe(slots[2]);
    expect(at('slotsL4ByLevel', lvl), `${where}.spellcasting.slotsL4 at Lv${lvl}`).toBe(slots[3]);
  }
}

// ─── roster ──────────────────────────────────────────────────────────────────

describe('subclass oracle: roster', () => {
  it('the catalog has all 12 classes, each with exactly 4 subclasses, 48 in total', () => {
    expect(uniqSorted(CLASS_LIST.map((c) => c.id)), 'class ids').toEqual([...CLASS_IDS].sort());
    let total = 0;
    for (const cls of CLASS_IDS) {
      const subs = catalogSubclasses(cls);
      expect(subs.length, `${cls}: subclass count`).toBe(4);
      total += subs.length;
    }
    expect(total, 'total catalog subclasses').toBe(48);
  });

  it('the golden fixture has exactly 48 subclasses, 4 per class', () => {
    expect(SUBCLASS_GOLDEN.length, 'golden subclass count').toBe(48);
    for (const cls of CLASS_IDS) expect(GOLDEN_BY_CLASS(cls).length, `golden ${cls}: subclass count`).toBe(4);
  });

  for (const cls of CLASS_IDS) {
    it(`${cls}: catalog subclass ids and names match the PHB exactly (and the golden)`, () => {
      const expected = EXPECTED_SUBCLASSES[cls];
      const subs = catalogSubclasses(cls);
      expect(uniqSorted(subs.map((s) => s.id)), `${cls}: catalog subclass ids`).toEqual(uniqSorted(expected.map(([id]) => id)));
      for (const [id, name] of expected) {
        const sub = subs.find((s) => s.id === id);
        expect(sub, `${cls}/${id}: subclass missing from catalog`).toBeDefined();
        expect(sub?.name, `${cls}/${id}: name`).toBe(name);
        const gold = GOLDEN_BY_CLASS(cls).find((g) => g.id === id);
        expect(gold, `${cls}/${id}: subclass missing from golden`).toBeDefined();
        expect(gold?.name, `${cls}/${id}: golden name`).toBe(name);
      }
      expect(uniqSorted(GOLDEN_BY_CLASS(cls).map((g) => g.id)), `${cls}: golden ids vs catalog ids`).toEqual(
        uniqSorted(subs.map((s) => s.id)),
      );
    });
  }

  it('subclass ids are unique within a class and names are unique across the catalog', () => {
    const names = new Set<string>();
    for (const cls of CLASS_IDS) {
      const ids = new Set<string>();
      for (const s of catalogSubclasses(cls)) {
        expect(ids.has(s.id), `${cls}/${s.id}: duplicate subclass id`).toBe(false);
        ids.add(s.id);
        expect(names.has(s.name), `${cls}/${s.id}: duplicate subclass name "${s.name}"`).toBe(false);
        names.add(s.name);
      }
    }
  });

  it('golden contains no duplicate subclass id per class', () => {
    const seen = new Set<string>();
    for (const g of SUBCLASS_GOLDEN) {
      const k = `${g.class}/${g.id}`;
      expect(seen.has(k), `golden ${k}: duplicate`).toBe(false);
      seen.add(k);
    }
  });
});

// ─── per-subclass structural checks (iterate the LIVE catalog) ───────────────

describe('subclass oracle: every catalog subclass is structurally valid', () => {
  for (const cls of CLASS_IDS) {
    const subclassLevel = (CLASS_CATALOG as unknown as Record<string, { subclassLevel: number }>)[cls].subclassLevel;
    for (const sub of catalogSubclasses(cls)) {
      it(`${cls}/${sub.id} features are well-formed`, () => {
        const w = `${cls}/${sub.id}`;
        expect(sub.features.length, `${w}: has features`).toBeGreaterThan(0);
        expect(typeof sub.source === 'string' && /\d/.test(sub.source), `${w}: subclass source needs a PHB line number`).toBe(true);
        const seen = new Set<string>();
        for (const f of sub.features) {
          const fw = `${w}/${f.name || '<unnamed>'}`;
          expect(typeof f.name === 'string' && f.name.trim().length > 0, `${w}: feature with empty name at L${f.level}`).toBe(true);
          expect(Number.isInteger(f.level), `${fw}.level must be an integer`).toBe(true);
          expect(f.level, `${fw}.level must be >= ${cls} subclassLevel ${subclassLevel}`).toBeGreaterThanOrEqual(subclassLevel);
          expect(f.level, `${fw}.level must be <= 20`).toBeLessThanOrEqual(20);
          expect(typeof f.effect === 'string' && f.effect.trim().length > 0, `${fw}.effect must be non-empty`).toBe(true);
          expect(typeof f.source === 'string' && /PHB/.test(f.source), `${fw}.source must cite the PHB`).toBe(true);
          expect(/\(line\s+~?\d+\)/.test(f.source), `${fw}.source must carry a PHB line number (got "${f.source}")`).toBe(true);
          expect(seen.has(key(f)), `${fw}: duplicate (name, level) ${key(f)}`).toBe(false);
          seen.add(key(f));
        }
      });
    }
  }

  it('feature-record sources do not repeat across different features of the whole catalog', () => {
    const owner = new Map<string, string>();
    for (const cls of CLASS_IDS) {
      for (const sub of catalogSubclasses(cls)) {
        for (const f of sub.features) {
          const prev = owner.get(f.source);
          expect(prev, `${cls}/${sub.id}/${f.name}: source "${f.source}" is shared with ${prev}`).toBeUndefined();
          owner.set(f.source, `${cls}/${sub.id}/${f.name}`);
        }
      }
    }
  });
});

// ─── golden vs catalog, subclass by subclass ─────────────────────────────────

describe('subclass oracle: golden fixture integrity', () => {
  for (const g of SUBCLASS_GOLDEN) {
    it(`golden ${g.class}/${g.id} is internally consistent`, () => {
      const w = `golden ${g.class}/${g.id}`;
      expect(g.features.length, `${w}: featureCount ${g.featureCount} vs listed features`).toBe(g.featureCount);
      const seen = new Set<string>();
      for (const f of g.features) {
        expect(seen.has(key(f)), `${w}/${f.name}: duplicate (name, level)`).toBe(false);
        seen.add(key(f));
        expect(f.line, `${w}/${f.name}: golden needs a PHB line`).toBeGreaterThan(0);
      }
    });
  }
});

describe('subclass oracle: catalog matches the golden', () => {
  for (const g of SUBCLASS_GOLDEN) {
    it(`${g.class}/${g.id} (${g.name})`, () => {
      const w = `${g.class}/${g.id}`;
      const sub = catalogSubclasses(g.class).find((s) => s.id === g.id);
      expect(sub, `${w}: subclass missing from catalog`).toBeDefined();
      if (!sub) return;

      // Exact (name, level) set + cardinality.
      const have = sub.features.map(key);
      const want = g.features.map(key);
      for (const k of want) expect(have, `${w}: missing feature ${k}`).toContain(k);
      for (const k of have) expect(want, `${w}: unexpected extra feature ${k}`).toContain(k);
      expect([...have].sort(), `${w}: (name, level) set`).toEqual([...want].sort());
      expect(sub.features.length, `${w}: feature count`).toBe(g.featureCount);

      for (const gf of g.features) {
        const f = sub.features.find((x) => x.name === gf.name && x.level === gf.level);
        if (!f) continue; // already reported above
        const fw = `${w}/${gf.name}`;
        const a = catalogCmp(f);
        const e = goldenCmp(gf);
        expect(a.uses, `${fw}.uses`).toEqual(e.uses);
        expect(a.save, `${fw}.saveDc`).toEqual(e.save);
        expect(a.reaction, `${fw}.reaction`).toBe(e.reaction);
        expect(a.channelDivinity, `${fw}.channelDivinity`).toBe(e.channelDivinity);
        expect(a.fightingStyleGrants, `${fw}.grantsFightingStyle`).toBe(e.fightingStyleGrants);
        expect(a.diceExprs, `${fw}.dice`).toEqual(e.diceExprs);
        expect(a.profs, `${fw}.grantedProficiencies`).toEqual(e.profs);
        expect(a.choices, `${fw}.choices`).toEqual(e.choices);
        // Granted spells: exact (level, spell, always-prepared) rows plus per-level counts.
        expect(catalogSpellRows(f), `${fw}.grantedSpells`).toEqual(goldenSpellRows(gf.grantedSpells));
        const wantCounts = goldenSpellCounts(gf.grantedSpells);
        const gotCounts = catalogSpellCounts(f);
        for (const lvl of uniqSorted([...Object.keys(wantCounts), ...Object.keys(gotCounts)])) {
          expect(gotCounts[Number(lvl)] ?? 0, `${fw}.grantedSpells count at class level ${lvl}`).toBe(
            // chosen-always-prepared grants carry no names in the catalog
            (wantCounts[Number(lvl)] ?? 0) - (gf.grantedSpells ?? []).filter((x) => x.level === Number(lvl)).reduce((n, x) => n + (x.chosenCount ?? 0), 0),
          );
        }
        for (const [mk, mv] of Object.entries(gf.mechanics ?? {})) {
          expect((f.mechanics ?? {})[mk], `${fw}.mechanics.${mk}`).toBe(mv);
        }
        checkSpellcasting(fw, gf, f);
        if (!g.landSpells || gf.name !== `${g.name} Spells`) {
          expect(f.choiceSpells, `${fw}.choiceSpells (only Circle of the Land Spells has them)`).toBeUndefined();
        }
      }

      // Circle of the Land: the four land-type tables.
      if (g.landSpells) {
        const feat = sub.features.find((x) => x.choiceSpells);
        expect(feat, `${w}: land-type spell tables (choiceSpells) missing`).toBeDefined();
        const table = feat?.choiceSpells ?? {};
        expect(Object.keys(table).map((k) => k.toLowerCase()).sort(), `${w}: land types`).toEqual(['arid', 'polar', 'temperate', 'tropical']);
        for (const land of ['arid', 'polar', 'temperate', 'tropical'] as const) {
          const cap = land.charAt(0).toUpperCase() + land.slice(1);
          const got = uniqSorted((table[cap] ?? []).flatMap((r) => r.spells.map((s) => `${r.level}|${s}`)));
          const exp = uniqSorted(g.landSpells[land].flatMap((r) => r.spells.map((s) => `${r.level}|${spellId(s)}`)));
          expect(got, `${w}: land ${land} spells`).toEqual(exp);
          expect(
            (table[cap] ?? []).map((r) => `${r.level}:${r.spells.length}`),
            `${w}: land ${land} spells per level`,
          ).toEqual(g.landSpells[land].map((r) => `${r.level}:${r.spells.length}`));
        }
      }
    });
  }
});

// ─── subclass features flow into the class feature views ─────────────────────

function mkCharacter(classes: ClassEntry[]): Character {
  return { ...BLANK_CHARACTER, level: classes.reduce((n, c) => n + c.level, 0), classes };
}

describe('subclass oracle: classFeaturesByLevel / classFeaturesByLevelTagged', () => {
  const subclassFeatureNames = (cls: GoldenSubclassClass, id: string): string[] =>
    (catalogSubclasses(cls).find((s) => s.id === id)?.features ?? []).map(key);

  for (const g of SUBCLASS_GOLDEN) {
    const sub = catalogSubclasses(g.class).find((s) => s.id === g.id);
    if (!sub) continue;

    it(`${g.class}/${g.id}: single class, features appear once chosen (and not before)`, () => {
      const w = `${g.class}/${g.id}`;
      const chosen = mkCharacter([{ id: g.class, level: 20, subclassId: g.id }]);
      const none = mkCharacter([{ id: g.class, level: 20 }]);
      const byLevel = classFeaturesByLevel(chosen);
      const noneByLevel = classFeaturesByLevel(none);
      const tagged = classFeaturesByLevelTagged(chosen);
      const taggedNone = classFeaturesByLevelTagged(none);
      for (const f of sub.features) {
        expect((byLevel.get(f.level) ?? []).includes(f), `${w}/${f.name}: missing from classFeaturesByLevel at L${f.level}`).toBe(true);
        expect((noneByLevel.get(f.level) ?? []).includes(f), `${w}/${f.name}: present in classFeaturesByLevel with no subclass chosen`).toBe(false);
        const t = (tagged.get(f.level) ?? []).find((x) => x.feature === f);
        expect(t, `${w}/${f.name}: missing from classFeaturesByLevelTagged at L${f.level}`).toBeDefined();
        expect(t?.subclassName, `${w}/${f.name}: tagged subclassName`).toBe(sub.name);
        expect(t?.classId, `${w}/${f.name}: tagged classId`).toBe(g.class);
        expect((taggedNone.get(f.level) ?? []).some((x) => x.feature === f), `${w}/${f.name}: tagged with no subclass chosen`).toBe(false);
      }
    });

    it(`${g.class}/${g.id}: tagged view gates features by the class's own level`, () => {
      const w = `${g.class}/${g.id}`;
      const lowest = Math.min(...sub.features.map((f) => f.level));
      const highest = Math.max(...sub.features.map((f) => f.level));
      const early = classFeaturesByLevelTagged(mkCharacter([{ id: g.class, level: lowest - 1, subclassId: g.id }]));
      for (const f of sub.features) {
        expect((early.get(f.level) ?? []).some((x) => x.feature === f), `${w}/${f.name}: shown at class level ${lowest - 1} (before L${f.level})`).toBe(false);
      }
      const atMax = classFeaturesByLevelTagged(mkCharacter([{ id: g.class, level: highest, subclassId: g.id }]));
      for (const f of sub.features) {
        expect((atMax.get(f.level) ?? []).some((x) => x.feature === f), `${w}/${f.name}: missing at class level ${highest}`).toBe(true);
      }
    });

    it(`${g.class}/${g.id}: multiclass SECONDARY class shows its subclass features`, () => {
      const w = `${g.class}/${g.id}`;
      const primary = g.class === 'fighter' ? 'wizard' : 'fighter';
      const c = mkCharacter([{ id: primary, level: 3 }, { id: g.class, level: 20, subclassId: g.id }]);
      const byLevel = classFeaturesByLevel(c);
      const tagged = classFeaturesByLevelTagged(c);
      for (const f of sub.features) {
        expect((byLevel.get(f.level) ?? []).includes(f), `${w}/${f.name}: missing from classFeaturesByLevel on a secondary class`).toBe(true);
        const t = (tagged.get(f.level) ?? []).find((x) => x.feature === f);
        expect(t, `${w}/${f.name}: missing from classFeaturesByLevelTagged on a secondary class`).toBeDefined();
        expect(t?.classId, `${w}/${f.name}: tagged classId on a secondary class`).toBe(g.class);
        expect(t?.subclassName, `${w}/${f.name}: tagged subclassName on a secondary class`).toBe(sub.name);
      }
      // The secondary entry's level gates the tagged view (not the total character level).
      const shallow = classFeaturesByLevelTagged(
        mkCharacter([{ id: primary, level: 15 }, { id: g.class, level: sub.features[0].level - 1, subclassId: g.id }]),
      );
      for (const f of sub.features) {
        expect((shallow.get(f.level) ?? []).some((x) => x.feature === f), `${w}/${f.name}: shown on a secondary class below L${f.level}`).toBe(false);
      }
    });
  }

  it('sanity: helper lists real keys', () => {
    expect(subclassFeatureNames('barbarian', 'berserker').length).toBeGreaterThan(0);
  });
});
