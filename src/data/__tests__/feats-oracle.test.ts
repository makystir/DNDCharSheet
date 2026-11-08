/**
 * ORACLE test for the feat catalog (Stage 1 of the level-up gap work).
 *
 * Compares EVERY record in src/data/feats.ts against the independently authored
 * PHB 2024 golden fixture (./feats-golden.ts) and exercises canTakeFeat with
 * synthetic characters. It FAILS CLOSED: each assertion carries a message that
 * names the offending record id and field (`<id>.<field>`), and a record that is
 * missing from the catalog (or an unexpected extra record) fails by name.
 *
 * EXPECTED TO BE RED until the catalog is completed. The oracle is written
 * against the INTENDED record shape documented in feats-golden.ts:
 *  - prerequisite.abilityAnyOf / armorTraining / spellcasting / fightingStyleFeature
 *  - abilityIncrease.abilities on 'choose-one' / 'epic-boon'
 *  - FeatData.mechanics (grants / toolsFrom / fixed / choices)
 *  - FeatBlockReason additions: 'armor-training' | 'spellcasting' | 'fighting-style'
 *  - logic/feats.ts: hasFightingStyleFeature(character): boolean and
 *    fightingStyleOptions(character): FeatData[] (the class Fighting Style
 *    feature path: Fighter 1, Paladin 2, Ranger 2).
 * Source of truth: Docs/PlayersHandbook.md Chapter 5 (Feats).
 */
import { describe, it, expect } from 'vitest';
import { FEAT_CATALOG, allFeats, getFeat } from '../feats';
import * as featsLogic from '../../logic/feats';
import { canTakeFeat, effectiveAbilityScores } from '../../logic/feats';
import { resolveFeatTooltip } from '../../logic/tooltip-content';
import { createCharacter } from '../../storage/character-store';
import type { Ability, Character, ClassEntry } from '../../types/character';
import { ABILITIES } from '../../types/character';
import {
  GOLDEN_FIGHTING_STYLE_CLASS_LEVELS,
  GOLDEN_PHB_CATEGORY_COUNTS,
  GOLDEN_PHB_FEAT_COUNT,
  GOLDEN_RECORD_CATEGORY_COUNTS,
  GOLDEN_RECORD_COUNT,
  GOLDEN_REPEATABLE_PHB_NAMES,
  GOLDEN_VARIANT_MAP,
  expandGoldenRecords,
  goldenPhbNames,
  type GoldenCategory,
  type GoldenFeat,
  type GoldenPrereq,
} from './feats-golden';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** The catalog record viewed through the INTENDED (wider) shape. */
type RawRecord = Record<string, unknown> & {
  id: string;
  name: string;
  category: GoldenCategory;
};

const GOLDEN = expandGoldenRecords();
const CATEGORIES: GoldenCategory[] = ['origin', 'general', 'fighting-style', 'epic-boon'];

function raw(id: string): RawRecord | undefined {
  return getFeat(id) as unknown as RawRecord | undefined;
}

const sortedUnique = <T>(xs: readonly T[]): T[] => [...xs].sort();

/** Drop undefined keys, sort arrays: a canonical form for deep comparison. */
function canon(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canon);
    return items.every((x) => typeof x === 'string') ? [...items].sort() : items;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canon(v);
    }
    return out;
  }
  return value;
}

function normPrereq(p: unknown): unknown {
  if (!p || typeof p !== 'object') return {};
  const r = p as Record<string, unknown>;
  // `note` is free text, never compared.
  return canon({
    minLevel: r.minLevel,
    abilityMin: r.abilityMin,
    abilityAnyOf: r.abilityAnyOf,
    armorTraining: r.armorTraining,
    spellcasting: r.spellcasting,
    fightingStyleFeature: r.fightingStyleFeature,
  });
}

function normMechanics(m: unknown): unknown {
  if (!m || typeof m !== 'object') return null;
  const r = m as Record<string, unknown>;
  const choices = Array.isArray(r.choices) ? [...(r.choices as Array<{ key: string }>)] : [];
  choices.sort((a, b) => a.key.localeCompare(b.key));
  return canon({
    grants: r.grants,
    toolsFrom: r.toolsFrom,
    fixed: r.fixed ?? [],
    choices,
  });
}

function goldenMechanics(g: GoldenFeat): unknown {
  return canon({
    grants: g.mechanics.grants,
    toolsFrom: g.mechanics.toolsFrom,
    fixed: g.mechanics.fixed,
    choices: g.mechanics.choices,
  });
}

const BASE_ABILITIES = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };

/** A synthetic character: one class at `level`, given abilities / feats. */
function make(
  classId: string,
  level: number,
  opts: {
    abilities?: Partial<Record<Ability, number>>;
    subclassId?: string;
    feats?: Array<{ featId: string; level: number }>;
    extraClasses?: Array<{ id: string; level: number }>;
  } = {},
): Character {
  const entries = [
    { id: classId, level, ...(opts.subclassId ? { subclassId: opts.subclassId } : {}) },
    ...(opts.extraClasses ?? []),
  ] as unknown as ClassEntry[];
  const total = entries.reduce((s, e) => s + e.level, 0);
  const c = createCharacter('Oracle');
  return {
    ...c,
    level: total,
    classes: entries,
    abilities: { ...BASE_ABILITIES, ...opts.abilities },
    advancement: opts.feats ? { feats: opts.feats } : undefined,
  } as Character;
}

/** A character that meets EVERY prerequisite of `g` (and no more than needed). */
function qualifiedFor(g: GoldenFeat): Character {
  const p: GoldenPrereq = g.prerequisite ?? {};
  const level = Math.max(p.minLevel ?? 1, 1);
  const abilities: Partial<Record<Ability, number>> = { ...p.abilityMin };
  if (p.abilityAnyOf) {
    const last = p.abilityAnyOf.abilities[p.abilityAnyOf.abilities.length - 1];
    abilities[last] = p.abilityAnyOf.min;
  }
  const classId = p.spellcasting ? 'wizard' : 'fighter';
  return make(classId, level, { abilities });
}

function reasonOf(character: Character, id: string): string | undefined {
  return canTakeFeat(character, id).reason;
}

// ─── 1. catalog census ───────────────────────────────────────────────────────

describe('feat catalog census (PHB 2024 Feat List)', () => {
  it('the golden fixture itself matches the PHB totals', () => {
    expect(GOLDEN_PHB_FEAT_COUNT).toBe(75);
    expect(Object.values(GOLDEN_PHB_CATEGORY_COUNTS).reduce((a, b) => a + b, 0)).toBe(75);
    expect(GOLDEN.length).toBe(GOLDEN_RECORD_COUNT);
    const names = goldenPhbNames();
    for (const c of CATEGORIES) {
      expect(names[c].length, `golden PHB ${c} count`).toBe(GOLDEN_PHB_CATEGORY_COUNTS[c]);
      expect(
        GOLDEN.filter((g) => g.category === c).length,
        `golden record ${c} count`,
      ).toBe(GOLDEN_RECORD_CATEGORY_COUNTS[c]);
    }
    expect(new Set(GOLDEN.map((g) => g.id)).size, 'golden ids unique').toBe(GOLDEN.length);
  });

  it('has exactly 77 catalog records (75 PHB feats, Magic Initiate as 3 variants)', () => {
    expect(Object.keys(FEAT_CATALOG).length).toBe(GOLDEN_RECORD_COUNT);
    expect(allFeats().length).toBe(GOLDEN_RECORD_COUNT);
  });

  it.each(CATEGORIES)('has exactly the expected ids and names in category %s', (category) => {
    const actual = allFeats().filter((f) => f.category === category);
    const expected = GOLDEN.filter((g) => g.category === category);
    expect(actual.length, `${category} record count`).toBe(GOLDEN_RECORD_CATEGORY_COUNTS[category]);
    expect(sortedUnique(actual.map((f) => f.id)), `${category} ids`).toEqual(
      sortedUnique(expected.map((g) => g.id)),
    );
    expect(sortedUnique(actual.map((f) => f.name)), `${category} names`).toEqual(
      sortedUnique(expected.map((g) => g.name)),
    );
  });

  it('every record key equals its id and every id is unique kebab-case', () => {
    const seen = new Set<string>();
    for (const [key, feat] of Object.entries(FEAT_CATALOG)) {
      expect(feat.id, `${key}.id must equal its catalog key`).toBe(key);
      expect(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(feat.id), `${feat.id}.id must be kebab-case`).toBe(true);
      expect(seen.has(feat.id), `${feat.id}.id must be unique`).toBe(false);
      seen.add(feat.id);
    }
  });

  it('maps the PHB repeatable feats consistently (variants stay non-repeatable)', () => {
    const repeatableNames = allFeats()
      .filter((f) => f.repeatable === true)
      .map((f) => f.name)
      .sort();
    // Magic Initiate is repeatable only by taking a DIFFERENT variant record.
    const expected = GOLDEN_REPEATABLE_PHB_NAMES.filter((n) => n !== 'Magic Initiate').sort();
    expect(repeatableNames, 'repeatable record names').toEqual(expected);
    for (const ids of Object.values(GOLDEN_VARIANT_MAP)) {
      for (const id of ids) {
        expect(getFeat(id)?.repeatable === true, `${id}.repeatable must be false`).toBe(false);
      }
    }
  });
});

// ─── 2. per-record comparison against the golden ─────────────────────────────

describe.each(GOLDEN.map((g) => [g.id, g] as const))('feat record %s', (id, g) => {
  it('exists with required fields', () => {
    const rec = raw(id);
    expect(rec, `${id}: missing from FEAT_CATALOG`).toBeDefined();
    if (!rec) return;
    expect(rec.id, `${id}.id`).toBe(id);
    expect(rec.name, `${id}.name`).toBe(g.name);
    expect(rec.category, `${id}.category`).toBe(g.category);
    expect(typeof rec.effect === 'string' && (rec.effect as string).trim().length > 0, `${id}.effect`).toBe(true);
    expect(typeof rec.source === 'string' && (rec.source as string).includes('PHB'), `${id}.source`).toBe(true);
    // The source cites the PHB heading line recorded in the golden (Magic Initiate variants share L8506).
    expect(rec.source as string, `${id}.source must cite L${g.line}`).toContain(`(L${g.line})`);
  });

  it('has the PHB prerequisite', () => {
    const rec = raw(id);
    expect(normPrereq(rec?.prerequisite), `${id}.prerequisite`).toEqual(normPrereq(g.prerequisite));
  });

  it('has the PHB repeatable flag', () => {
    expect(raw(id)?.repeatable === true, `${id}.repeatable`).toBe(g.repeatable);
  });

  it('has the PHB ability score increase (kind, abilities, amount, cap)', () => {
    const inc = raw(id)?.abilityIncrease;
    expect(canon(inc ?? null), `${id}.abilityIncrease`).toEqual(canon(g.abilityIncrease));
  });

  it('has the PHB structured mechanics (cardinality and choices)', () => {
    expect(normMechanics(raw(id)?.mechanics), `${id}.mechanics`).toEqual(goldenMechanics(g));
  });

  it('applies its ability-increase cap through effectiveAbilityScores', () => {
    const inc = g.abilityIncrease;
    if (!inc || inc.kind === 'asi') return;
    const cap = inc.max;
    const ability = inc.kind === 'fixed' ? inc.ability : inc.abilities[0];
    const sel = (before: number) => {
      const c = make('fighter', 20, { abilities: { [ability]: before } });
      return {
        ...c,
        advancement: { feats: [{ featId: id, level: 4, abilityIncreases: { [ability]: 1 } }] },
      } as Character;
    };
    // At the cap the +1 is lost; one below the cap it lands exactly on the cap.
    expect(effectiveAbilityScores(sel(cap))[ability], `${id}: +1 at ${cap}`).toBe(cap);
    expect(effectiveAbilityScores(sel(cap - 1))[ability], `${id}: +1 at ${cap - 1}`).toBe(cap);
    // Only an Epic Boon may carry a score past 20.
    expect(effectiveAbilityScores(sel(20))[ability], `${id}: +1 at 20`).toBe(cap === 30 ? 21 : 20);
  });

  it('resolves through resolveFeatTooltip', () => {
    const t = resolveFeatTooltip(id);
    expect(t, `${id}: resolveFeatTooltip returned null`).not.toBeNull();
    if (!t) return;
    expect(t.title, `${id}.tooltip.title`).toBe(g.name);
    const labels = t.sections.map((s) => s.label);
    expect(labels, `${id}.tooltip sections`).toContain('Category');
    expect(labels, `${id}.tooltip sections`).toContain('Benefit');
    expect(labels, `${id}.tooltip sections`).toContain('Source');
    const hasPrereq = Object.keys(normPrereq(g.prerequisite) as object).length > 0;
    expect(labels.includes('Prerequisite'), `${id}.tooltip Prerequisite section`).toBe(hasPrereq);
    expect(labels.includes('Repeatable'), `${id}.tooltip Repeatable section`).toBe(g.repeatable);
    for (const s of t.sections) {
      expect(s.text.trim().length > 0, `${id}.tooltip section ${s.label} is empty`).toBe(true);
    }
  });
});

// ─── 3. canTakeFeat prerequisite handling ────────────────────────────────────

describe.each(GOLDEN.map((g) => [g.id, g] as const))('canTakeFeat prerequisites: %s', (id, g) => {
  const p: GoldenPrereq = g.prerequisite ?? {};

  it('accepts a character who meets every prerequisite', () => {
    expect(canTakeFeat(qualifiedFor(g), id), `${id}: qualified character`).toEqual({ ok: true });
  });

  it('blocks below the minimum level with reason "level"', () => {
    if (p.minLevel === undefined) return;
    const c = make(p.spellcasting ? 'wizard' : 'fighter', p.minLevel - 1, {
      abilities: { ...p.abilityMin, ...(p.abilityAnyOf ? { [p.abilityAnyOf.abilities[0]]: p.abilityAnyOf.min } : {}) },
    });
    expect(canTakeFeat(c, id), `${id}: level ${p.minLevel - 1}`).toEqual({ ok: false, reason: 'level' });
  });

  it('enforces ability minimums with reason "ability"', () => {
    if (!p.abilityMin && !p.abilityAnyOf) return;
    const q = qualifiedFor(g);
    // Everything 12: one point short of any 13 minimum.
    const short = { ...q, abilities: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 } };
    expect(canTakeFeat(short, id), `${id}: abilities all 12`).toEqual({ ok: false, reason: 'ability' });
    if (p.abilityAnyOf) {
      // ANY one listed ability at the minimum suffices ("Strength or Dexterity 13+").
      for (const a of p.abilityAnyOf.abilities) {
        const one = { ...q, abilities: { ...short.abilities, [a]: p.abilityAnyOf.min } };
        expect(canTakeFeat(one, id).ok, `${id}: only ${a} ${p.abilityAnyOf.min}`).toBe(true);
      }
    }
  });

  it('enforces armor training with reason "armor-training"', () => {
    if (!p.armorTraining) return;
    const wizard = make('wizard', p.minLevel ?? 4, { abilities: p.abilityMin });
    expect(canTakeFeat(wizard, id), `${id}: untrained wizard`).toEqual({
      ok: false,
      reason: 'armor-training',
    });
  });

  it('enforces Spellcasting / Pact Magic with reason "spellcasting"', () => {
    if (!p.spellcasting) return;
    const fighter = make('fighter', p.minLevel ?? 4);
    expect(canTakeFeat(fighter, id), `${id}: non-caster fighter`).toEqual({
      ok: false,
      reason: 'spellcasting',
    });
  });

  it('enforces the Fighting Style feature with reason "fighting-style"', () => {
    if (!p.fightingStyleFeature) return;
    const wizard = make('wizard', 20);
    expect(canTakeFeat(wizard, id), `${id}: wizard has no Fighting Style feature`).toEqual({
      ok: false,
      reason: 'fighting-style',
    });
  });

  it('honours the repeatable rule with reason "already-taken"', () => {
    const q = qualifiedFor(g);
    const taken = { ...q, advancement: { feats: [{ featId: id, level: Math.max(p.minLevel ?? 1, 1) }] } } as Character;
    if (g.repeatable) {
      expect(canTakeFeat(taken, id).ok, `${id}: repeatable, second take`).toBe(true);
    } else {
      expect(canTakeFeat(taken, id), `${id}: non-repeatable, second take`).toEqual({
        ok: false,
        reason: 'already-taken',
      });
    }
  });
});

describe('canTakeFeat: targeted prerequisite scenarios', () => {
  // LIMITATION: Cleric Divine Order: Protector (Heavy armor, PHB L3232) and Druid
  // Primal Order: Warden (Medium armor, L3668) are level-1 choices the app does not
  // record, so their armor training cannot be derived and is deliberately NOT pinned.
  it('Barbarian has Medium armor training, not Heavy', () => {
    const c = make('barbarian', 4);
    expect(canTakeFeat(c, 'heavily-armored').ok).toBe(true);
    expect(canTakeFeat(c, 'medium-armor-master').ok).toBe(true);
    expect(canTakeFeat(c, 'shield-master').ok).toBe(true);
    expect(reasonOf(c, 'heavy-armor-master')).toBe('armor-training');
  });

  it('Bard: College of Valor gains Medium armor and Shields at level 3 (PHB L3091)', () => {
    // Heavily Armored needs character level 4+, so pad with a Wizard level (no armor training).
    const bard = (level: number, subclassId: string) =>
      make('wizard', 4 - level, {
        extraClasses: [{ id: 'bard', level, subclassId } as unknown as { id: string; level: number }],
      });
    expect(reasonOf(bard(3, 'lore'), 'heavily-armored')).toBe('armor-training');
    expect(reasonOf(bard(2, 'valor'), 'heavily-armored')).toBe('armor-training');
    const valor3 = bard(3, 'valor');
    expect(canTakeFeat(valor3, 'heavily-armored').ok).toBe(true);
    expect(canTakeFeat(valor3, 'shield-master').ok).toBe(true);
  });

  it('Fighter and Paladin (Heavy) can take Heavy Armor Master', () => {
    expect(canTakeFeat(make('fighter', 4), 'heavy-armor-master').ok).toBe(true);
    expect(canTakeFeat(make('paladin', 4), 'heavy-armor-master').ok).toBe(true);
  });

  it('an untrained Wizard is blocked from every armor-gated feat', () => {
    const w = make('wizard', 8);
    for (const id of ['moderately-armored', 'heavily-armored', 'heavy-armor-master', 'medium-armor-master', 'shield-master']) {
      expect(reasonOf(w, id), `wizard ${id}`).toBe('armor-training');
    }
  });

  it('armor training granted by earlier FEATS satisfies later prerequisites', () => {
    const light = make('wizard', 8, { feats: [{ featId: 'lightly-armored', level: 4 }] });
    expect(canTakeFeat(light, 'moderately-armored').ok, 'Lightly Armored -> Moderately Armored').toBe(true);
    expect(canTakeFeat(light, 'shield-master').ok, 'Lightly Armored grants Shields').toBe(true);
    const medium = make('wizard', 12, {
      feats: [
        { featId: 'lightly-armored', level: 4 },
        { featId: 'moderately-armored', level: 8 },
      ],
    });
    expect(canTakeFeat(medium, 'heavily-armored').ok, 'Moderately Armored -> Heavily Armored').toBe(true);
    expect(reasonOf(medium, 'heavy-armor-master'), 'no Heavy training yet').toBe('armor-training');
    const heavy = make('wizard', 16, {
      feats: [
        { featId: 'lightly-armored', level: 4 },
        { featId: 'moderately-armored', level: 8 },
        { featId: 'heavily-armored', level: 12 },
      ],
    });
    expect(canTakeFeat(heavy, 'heavy-armor-master').ok, 'Heavily Armored -> Heavy Armor Master').toBe(true);
  });

  it('multiclass: a non-initial Fighter level gives Medium armor and Shields, not Heavy', () => {
    const c = make('wizard', 3, { extraClasses: [{ id: 'fighter', level: 1 }] });
    expect(canTakeFeat(c, 'heavily-armored').ok, 'multiclass Fighter Medium').toBe(true);
    expect(reasonOf(c, 'heavy-armor-master')).toBe('armor-training');
  });

  it('Spellcasting or Pact Magic: Wizard, Warlock and Eldritch Knight qualify; Fighter/Barbarian do not', () => {
    for (const id of ['war-caster', 'spell-sniper', 'elemental-adept']) {
      expect(canTakeFeat(make('wizard', 4), id).ok, `wizard ${id}`).toBe(true);
      expect(canTakeFeat(make('warlock', 4), id).ok, `warlock (Pact Magic) ${id}`).toBe(true);
      expect(canTakeFeat(make('fighter', 4, { subclassId: 'eldritchKnight' }), id).ok, `EK ${id}`).toBe(true);
      expect(reasonOf(make('fighter', 4), id), `fighter ${id}`).toBe('spellcasting');
      expect(reasonOf(make('barbarian', 4), id), `barbarian ${id}`).toBe('spellcasting');
    }
  });

  it('Boon of Spell Recall needs the Spellcasting feature (printed without "or Pact Magic")', () => {
    // PHB L9228 prints "Spellcasting Feature" only; a Warlock has Pact Magic.
    expect(canTakeFeat(make('wizard', 19), 'boon-of-spell-recall').ok).toBe(true);
    expect(reasonOf(make('warlock', 19), 'boon-of-spell-recall')).toBe('spellcasting');
    expect(reasonOf(make('fighter', 19), 'boon-of-spell-recall')).toBe('spellcasting');
  });

  it('Epic Boons need level 19+', () => {
    expect(reasonOf(make('fighter', 18), 'boon-of-fate')).toBe('level');
    expect(canTakeFeat(make('fighter', 19), 'boon-of-fate').ok).toBe(true);
  });

  it('Magic Initiate: a different list may be taken, the same list may not', () => {
    const c = make('fighter', 1, { feats: [{ featId: 'magic-initiate-cleric', level: 1 }] });
    expect(reasonOf(c, 'magic-initiate-cleric')).toBe('already-taken');
    expect(canTakeFeat(c, 'magic-initiate-druid').ok).toBe(true);
    expect(canTakeFeat(c, 'magic-initiate-wizard').ok).toBe(true);
  });
});

// ─── 4. Fighting Style feats via the class Fighting Style feature ────────────

const FS_IDS = GOLDEN.filter((g) => g.category === 'fighting-style').map((g) => g.id).sort();

type FsApi = {
  hasFightingStyleFeature?: (c: Character) => boolean;
  fightingStyleOptions?: (c: Character) => Array<{ id: string }>;
};
const fsApi = featsLogic as unknown as FsApi;

describe('Fighting Style feats via the class Fighting Style feature', () => {
  it('logic/feats exposes hasFightingStyleFeature and fightingStyleOptions', () => {
    expect(typeof fsApi.hasFightingStyleFeature, 'hasFightingStyleFeature export').toBe('function');
    expect(typeof fsApi.fightingStyleOptions, 'fightingStyleOptions export').toBe('function');
  });

  it.each(GOLDEN_FIGHTING_STYLE_CLASS_LEVELS.map((x) => [x.classId, x.level] as const))(
    '%s gains the Fighting Style feature at class level %i, and not before',
    (classId, level) => {
      const before = make(classId, level - 1 || 1);
      const at = make(classId, level);
      if (level > 1) {
        expect(fsApi.hasFightingStyleFeature?.(before), `${classId} ${level - 1}: feature`).toBe(false);
        expect(fsApi.fightingStyleOptions?.(before), `${classId} ${level - 1}: options`).toEqual([]);
        expect(reasonOf(before, 'archery'), `${classId} ${level - 1}: archery`).toBe('fighting-style');
      }
      expect(fsApi.hasFightingStyleFeature?.(at), `${classId} ${level}: feature`).toBe(true);
      expect(
        (fsApi.fightingStyleOptions?.(at) ?? []).map((f) => f.id).sort(),
        `${classId} ${level}: offered Fighting Style feats`,
      ).toEqual(FS_IDS);
      for (const id of FS_IDS) {
        expect(canTakeFeat(at, id).ok, `${classId} ${level}: canTakeFeat(${id})`).toBe(true);
      }
    },
  );

  it('Fighter level 1, Paladin level 2 and Ranger level 2 are the entry points', () => {
    expect(GOLDEN_FIGHTING_STYLE_CLASS_LEVELS).toEqual([
      { classId: 'fighter', level: 1 },
      { classId: 'paladin', level: 2 },
      { classId: 'ranger', level: 2 },
    ]);
  });

  it('classes without a Fighting Style feature are offered none, at any level', () => {
    for (const cls of ['barbarian', 'bard', 'cleric', 'druid', 'monk', 'rogue', 'sorcerer', 'warlock', 'wizard']) {
      const c = make(cls, 20);
      expect(fsApi.hasFightingStyleFeature?.(c), `${cls}: feature`).toBe(false);
      expect(fsApi.fightingStyleOptions?.(c), `${cls}: options`).toEqual([]);
      for (const id of FS_IDS) {
        expect(reasonOf(c, id), `${cls}: ${id} must not be taken in an ASI slot`).toBe('fighting-style');
      }
    }
  });

  it('a multiclass level in a Fighting Style class counts (Wizard 3 / Fighter 1)', () => {
    const c = make('wizard', 3, { extraClasses: [{ id: 'fighter', level: 1 }] });
    expect(fsApi.hasFightingStyleFeature?.(c)).toBe(true);
  });

  it('a Fighting Style feat already taken is not offered again', () => {
    const c = make('fighter', 4, { feats: [{ featId: 'archery', level: 1 }] });
    expect(reasonOf(c, 'archery')).toBe('already-taken');
    expect(fsApi.fightingStyleOptions?.(c).map((f) => f.id)).not.toContain('archery');
  });

  /**
   * PHB AMBIGUITY (flagged): Fighting Style feats carry the prerequisite
   * "Fighting Style Feature" (L9068+) and an ASI slot offers "another feat for
   * which you qualify" (L8340). RAW therefore does NOT forbid a Fighter (who has
   * the feature) from spending an ASI slot on a second Fighting Style feat, but a
   * character without the feature (e.g. a Wizard) never qualifies. This oracle
   * pins exactly that: the prerequisite gates, nothing more.
   */
  it('an ASI slot offers Fighting Style feats only to characters that have the feature', () => {
    expect(canTakeFeat(make('fighter', 4), 'dueling').ok, 'fighter qualifies').toBe(true);
    expect(reasonOf(make('wizard', 4), 'dueling'), 'wizard does not').toBe('fighting-style');
  });
});

// ─── 4b. validateFeatIncrease: allowed abilities and amounts ────────────────

describe('validateFeatIncrease (allowed abilities, amounts, Resilient)', () => {
  const v = featsLogic.validateFeatIncrease;

  it('accepts a legal increase for every golden feat that has one', () => {
    for (const g of GOLDEN) {
      const inc = g.abilityIncrease;
      if (!inc) {
        expect(v(g.id, undefined), `${g.id}: none`).toEqual({ valid: true });
      } else if (inc.kind === 'fixed') {
        expect(v(g.id, { [inc.ability]: 1 }), `${g.id}`).toEqual({ valid: true });
      } else if (inc.kind !== 'asi') {
        for (const a of inc.abilities) expect(v(g.id, { [a]: 1 }).valid, `${g.id} +1 ${a}`).toBe(true);
      }
    }
  });

  it('rejects a wrong ability (Athlete +1 Con, Boon of Irresistible Offense +1 Wis)', () => {
    expect(v('athlete', { con: 1 })).toEqual({ valid: false, reason: 'wrong-ability' });
    expect(v('boon-of-irresistible-offense', { wis: 1 })).toEqual({ valid: false, reason: 'wrong-ability' });
    expect(v('actor', { str: 1 })).toEqual({ valid: false, reason: 'wrong-ability' });
  });

  it('rejects a wrong amount (Durable +3, +2, two abilities, or nothing)', () => {
    expect(v('durable', { con: 3 })).toEqual({ valid: false, reason: 'wrong-amount' });
    expect(v('durable', { con: 2 })).toEqual({ valid: false, reason: 'wrong-amount' });
    expect(v('athlete', { str: 1, dex: 1 })).toEqual({ valid: false, reason: 'wrong-amount' });
    expect(v('athlete', undefined)).toEqual({ valid: false, reason: 'wrong-amount' });
  });

  it('rejects an increase on a feat that grants none, and an unknown feat', () => {
    expect(v('alert', { str: 1 })).toEqual({ valid: false, reason: 'no-increase' });
    expect(v('no-such-feat', {})).toEqual({ valid: false, reason: 'unknown-feat' });
  });

  it('Ability Score Improvement allows +2 or +1/+1 only', () => {
    expect(v('ability-score-improvement', { str: 2 }).valid).toBe(true);
    expect(v('ability-score-improvement', { str: 1, dex: 1 }).valid).toBe(true);
    expect(v('ability-score-improvement', { str: 3 }).valid).toBe(false);
  });

  it('Resilient (PHB L8880) cannot raise a save the character is already proficient in', () => {
    const proficient = (a: Ability) => a === 'con';
    expect(v('resilient', { con: 1 }, proficient)).toEqual({ valid: false, reason: 'save-proficient' });
    expect(v('resilient', { wis: 1 }, proficient)).toEqual({ valid: true });
  });
});

// ─── 5. cross-record consistency ─────────────────────────────────────────────

describe('catalog-wide invariants', () => {
  it('every ability-increasing feat names allowed abilities from the six abilities', () => {
    for (const f of allFeats()) {
      const inc = raw(f.id)?.abilityIncrease as { kind: string; abilities?: Ability[]; ability?: Ability } | undefined;
      if (!inc || inc.kind === 'asi') continue;
      const list = inc.kind === 'fixed' ? [inc.ability] : inc.abilities;
      expect(Array.isArray(list) && list.length > 0, `${f.id}.abilityIncrease.abilities`).toBe(true);
      for (const a of list ?? []) {
        expect(ABILITIES.includes(a as Ability), `${f.id}.abilityIncrease ability ${String(a)}`).toBe(true);
      }
    }
  });

  it('only Epic Boons cap at 30, and every Epic Boon grants +1 (max 30)', () => {
    for (const f of allFeats()) {
      const inc = raw(f.id)?.abilityIncrease as { max?: number; kind: string } | undefined;
      if (f.category === 'epic-boon') {
        expect(inc?.kind, `${f.id}.abilityIncrease.kind`).toBe('epic-boon');
        expect(inc?.max, `${f.id}.abilityIncrease.max`).toBe(30);
      } else if (inc && inc.kind !== 'asi') {
        expect(inc.max, `${f.id}.abilityIncrease.max`).toBe(20);
      }
    }
  });

  it('Origin and Fighting Style feats grant no ability score increase', () => {
    for (const f of allFeats()) {
      if (f.category === 'origin' || f.category === 'fighting-style') {
        expect(raw(f.id)?.abilityIncrease, `${f.id}.abilityIncrease`).toBeUndefined();
      }
    }
  });
});
