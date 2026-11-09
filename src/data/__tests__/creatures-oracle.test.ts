/**
 * ORACLE test for the creature stat block catalog (src/data/creatures.ts) and
 * the Primal Companion / Otherworldly Steed resolvers (src/logic/primal-companion.ts).
 *
 * Compares EVERY catalog record to the independently authored golden fixture
 * (./creatures-golden.ts, read from the Monster Manual 2024 page images and the
 * PHB 2024) and cross-checks each record's internal consistency. It FAILS
 * CLOSED: every assertion message names the creature id and field
 * (`<id>.<field>`), and a missing or unexpected record fails by name.
 *
 * Saving throws are modelled explicitly: a save equals the ability modifier,
 * or the modifier plus the Proficiency Bonus when `saveProficient` is set.
 */
import { describe, it, expect } from 'vitest';
import { CREATURE_CATALOG, CREATURE_LIST, creaturesByKind } from '../creatures';
import type { CreatureFeature, CreatureKind, CreatureStatBlock } from '../creatures';
import { resolvePrimalCompanion, resolveOtherworldlySteed, PRIMAL_COMPANION_IDS } from '../../logic/primal-companion';
import type { PrimalCompanionId, OtherworldlySteedType } from '../../logic/primal-companion';
import { ABILITIES } from '../../types/character';
import {
  GOLDEN_CREATURES,
  GOLDEN_CREATURE_COUNT,
  GOLDEN_GROUP_COUNTS,
  GOLDEN_OTHERWORLDLY_STEED,
  GOLDEN_PRIMAL_COMPANIONS,
  GOLDEN_PRIMAL_EXAMPLES,
  GOLDEN_STEED_EXAMPLES,
} from './creatures-golden';
import type { GoldenCreature, GoldenPrimalCompanion } from './creatures-golden';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** PHB 2024 "Proficiency Bonus" table (Docs/PlayersHandbook.md L513-L521), CR column. */
function pbForCr(cr: string): number {
  const n = cr.includes('/') ? Number(cr.split('/')[0]) / Number(cr.split('/')[1]) : Number(cr);
  if (Number.isNaN(n)) throw new Error(`Unparseable CR ${cr}`);
  if (n <= 4) return 2;
  if (n <= 8) return 3;
  if (n <= 12) return 4;
  if (n <= 16) return 5;
  if (n <= 20) return 6;
  if (n <= 24) return 7;
  if (n <= 28) return 8;
  return 9;
}

const mod = (score: number): number => Math.floor((score - 10) / 2);

/** "3d8+6" / "1d4-1" / "2d10" -> { count, sides, bonus }. */
function parseDice(dice: string): { count: number; sides: number; bonus: number } {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(dice);
  if (!m) throw new Error(`Bad dice expression ${dice}`);
  return { count: Number(m[1]), sides: Number(m[2]), bonus: m[3] ? Number(m[3]) : 0 };
}

/** Range in feet of a sense ("Darkvision 90 ft.") from a golden senses string, or null when absent. */
function senseRange(senses: string | null, sense: 'Darkvision' | 'Blindsight'): number | null {
  const m = senses ? new RegExp(`${sense} (\\d+) ft`).exec(senses) : null;
  return m ? Number(m[1]) : null;
}

/** "Rock (Recharge 6)" / "Scare (1/Day)" -> "Rock" / "Scare". */
const stripUsage = (name: string): string => name.replace(/\s*\((Recharge[^)]*|\d+\/Day)\)$/, '');

const allFeatures = (c: CreatureStatBlock): CreatureFeature[] => [...c.traits, ...c.actions, ...c.bonusActions, ...c.reactions];

/** Primal Companion beasts and the Otherworldly Steed scale with their owner; their CR is "None". */
const isFormulaScaled = (c: CreatureStatBlock): boolean => c.challenge.cr === 'None';

const goldenById = new Map<string, GoldenCreature>(GOLDEN_CREATURES.map((g) => [g.id, g]));
const goldenPrimalById = new Map<string, GoldenPrimalCompanion>(GOLDEN_PRIMAL_COMPANIONS.map((g) => [g.id, g]));
const goldenIds = [
  ...GOLDEN_CREATURES.map((g) => g.id),
  ...GOLDEN_PRIMAL_COMPANIONS.map((g) => g.id),
  GOLDEN_OTHERWORLDLY_STEED.id,
];

// ─── Cardinality ─────────────────────────────────────────────────────────────

describe('creature catalog: cardinality', () => {
  it('has exactly the golden number of creatures', () => {
    expect(GOLDEN_CREATURE_COUNT).toBe(55);
    expect(CREATURE_LIST.length, 'CREATURE_LIST.length').toBe(GOLDEN_CREATURE_COUNT);
    expect(Object.keys(CREATURE_CATALOG).length, 'CREATURE_CATALOG keys').toBe(GOLDEN_CREATURE_COUNT);
    expect(goldenIds.length, 'golden ids').toBe(GOLDEN_CREATURE_COUNT);
  });

  it('has no duplicate ids and CREATURE_CATALOG matches CREATURE_LIST', () => {
    const ids = CREATURE_LIST.map((c) => c.id);
    expect(new Set(ids).size, 'duplicate ids in CREATURE_LIST').toBe(ids.length);
    for (const c of CREATURE_LIST) expect(CREATURE_CATALOG[c.id], `${c.id} catalog entry`).toBe(c);
  });

  it('contains exactly the golden ids (names the missing / extra record)', () => {
    const catalogIds = new Set(CREATURE_LIST.map((c) => c.id));
    for (const id of goldenIds) expect(catalogIds.has(id), `${id}: missing from the catalog`).toBe(true);
    for (const id of catalogIds) expect(goldenIds.includes(id), `${id}: unexpected extra catalog record`).toBe(true);
  });

  it('has the exact creature count per group', () => {
    for (const kind of Object.keys(GOLDEN_GROUP_COUNTS) as CreatureKind[]) {
      expect(creaturesByKind(kind).length, `group ${kind} count`).toBe(GOLDEN_GROUP_COUNTS[kind]);
    }
    expect(Object.values(GOLDEN_GROUP_COUNTS).reduce((a, b) => a + b, 0)).toBe(GOLDEN_CREATURE_COUNT);
  });

  it('pins the exact ids of the small groups', () => {
    const ids = (k: CreatureKind) => creaturesByKind(k).map((c) => c.id).sort();
    expect(ids('primal-companion')).toEqual(['beast-of-the-land', 'beast-of-the-sea', 'beast-of-the-sky']);
    expect(ids('familiar')).toEqual(['imp', 'pseudodragon', 'quasit', 'slaad-tadpole', 'sphinx-of-wonder', 'sprite']);
    expect(ids('steed')).toEqual(['otherworldly-steed', 'riding-horse']);
    expect(ids('undead')).toEqual(['skeleton', 'zombie']);
  });

  it('pins the exact 42 animal ids', () => {
    const expected = [
      'ape', 'badger', 'bat', 'black-bear', 'boar', 'brown-bear', 'camel', 'cat', 'constrictor-snake', 'crab', 'crocodile', 'dire-wolf',
      'draft-horse', 'elephant', 'elk', 'frog', 'giant-badger', 'giant-crab', 'giant-goat', 'giant-seahorse', 'giant-spider', 'giant-weasel',
      'goat', 'hawk', 'lion', 'lizard', 'mastiff', 'mule', 'octopus', 'owl', 'panther', 'pony', 'rat', 'raven', 'reef-shark', 'scorpion',
      'spider', 'tiger', 'venomous-snake', 'warhorse', 'weasel', 'wolf',
    ].sort();
    expect(expected.length).toBe(42);
    expect(creaturesByKind('animal').map((c) => c.id).sort()).toEqual(expected);
  });

  it('excludes temporary summoned spirits', () => {
    for (const c of CREATURE_LIST) {
      expect(/spirit|animated object|giant insect/i.test(c.name), `${c.id}: summoned creature must not be catalogued`).toBe(false);
    }
  });
});

// ─── Golden comparison (non-formula creatures) ───────────────────────────────

describe('creature catalog: every record matches the golden fixture', () => {
  for (const g of GOLDEN_CREATURES) {
    it(g.id, () => {
      const c = CREATURE_CATALOG[g.id];
      expect(c, `${g.id}: record missing`).toBeDefined();
      const tag = (f: string) => `${g.id}.${f}`;

      expect(c.name, tag('name')).toBe(g.name);
      expect(c.kind, tag('kind')).toBe(g.group);
      expect(c.size, tag('size')).toBe(g.size);
      expect(c.creatureType, tag('type')).toBe(g.type);
      expect(c.subtype, tag('subtype')).toBe(g.subtype);
      expect(c.alignment, tag('alignment')).toBe(g.alignment);
      expect(c.ac, tag('ac')).toBe(g.ac);

      // Source: Monster Manual page (printed = PDF - 3) or PHB line (+ optional MM cross-check page)
      if (g.source.book === 'MM') {
        expect(c.source.book, tag('source.book')).toBe('Monster Manual 2024');
        expect(c.source.section, tag('source.section')).toBe('Appendix A: Animals');
        expect(c.source.pdfPage, tag('source.pdfPage')).toBe(g.source.pdfPage);
        expect(c.source.printedPage, tag('source.printedPage')).toBe(g.source.printedPage);
        expect((c.source.pdfPage ?? 0) - (c.source.printedPage ?? 0), tag('source printed = pdf - 3')).toBe(3);
      } else {
        expect(c.source.book, tag('source.book')).toBe('PHB 2024');
        expect(c.source.line, tag('source.line')).toBe(g.source.line);
        expect(c.source.mmCrossCheck, tag('source.mmCrossCheck')).toEqual(g.source.mmCrossCheck);
      }

      // Hit points
      expect('formula' in c.hp, tag('hp.formula')).toBe(false);
      if (!('formula' in c.hp)) {
        expect(c.hp.average, tag('hp.average')).toBe(g.hp.avg);
        expect(c.hp.dice, tag('hp.dice')).toBe(g.hp.dice);
      }
      expect(c.initiative?.modifier ?? null, tag('initiative')).toBe(g.initiative);
      expect(c.speeds, tag('speeds')).toEqual(g.speeds);

      // Six ability scores, modifiers and saves (explicit proficiency)
      for (const a of ABILITIES) {
        const ab = c.abilities[a];
        expect(ab.score, tag(`abilities.${a}.score`)).toBe(g.abilities[a]);
        expect(ab.mod, tag(`abilities.${a}.mod`)).toBe(mod(g.abilities[a]));
        const printed = g.printedSaves?.[a];
        expect(ab.saveProficient, tag(`abilities.${a}.saveProficient`)).toBe(printed !== undefined);
        expect(ab.save, tag(`abilities.${a}.save`)).toBe(printed ?? mod(g.abilities[a]));
      }

      // Challenge
      expect(c.challenge.cr, tag('cr')).toBe(g.cr);
      expect(c.challenge.xp, tag('xp')).toBe(g.xp);
      expect(c.senses?.passivePerception ?? null, tag('passivePerception')).toBe(g.passivePerception);

      // Skills, defenses, senses ranges, languages
      expect(Object.entries(c.skills).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).sort(), tag('skills')).toEqual([...g.skills].sort());
      expect([...c.damageResistances].sort(), tag('resistances')).toEqual([...(g.resistances ?? [])].sort());
      expect([...c.damageVulnerabilities].sort(), tag('vulnerabilities')).toEqual([...(g.vulnerabilities ?? [])].sort());
      // The golden lists damage and condition immunities together.
      expect([...c.damageImmunities, ...c.conditionImmunities].sort(), tag('immunities')).toEqual([...(g.immunities ?? [])].sort());
      expect(c.languages, tag('languages')).toBe(g.languages);
      expect(c.senses?.darkvisionFt ?? null, tag('senses.darkvision')).toBe(senseRange(g.senses, 'Darkvision'));
      expect(c.senses?.blindsightFt ?? null, tag('senses.blindsight')).toBe(senseRange(g.senses, 'Blindsight'));

      // Traits, actions, bonus actions and reactions by name (usage suffixes stripped for actions)
      expect(c.traits.map((t) => t.name), tag('traits.names')).toEqual(g.traitNames);
      expect(c.actions.map((a) => stripUsage(a.name)), tag('actionNames')).toEqual(g.actionNames.map(stripUsage));
      expect(c.bonusActions.map((a) => a.name), tag('bonusActions')).toEqual(g.bonusActionNames ?? []);
      expect(c.reactions.map((a) => stripUsage(a.name)), tag('reactions')).toEqual((g.reactionNames ?? []).map(stripUsage));

      // Mounts table
      expect(c.mountTable, tag('mountTable')).toEqual(g.mountTable);

      // Attacks: bonus, kind, reach/range, damage dice and extra damage
      for (const atk of g.attacks) {
        // Golden names may carry a printed suffix, e.g. "Scare (1/Day)".
        const baseName = atk.name.replace(/\s*\(.*\)$/, '');
        const f = allFeatures(c).find((x) => x.name === baseName);
        expect(f, tag(`attack ${atk.name}: missing`)).toBeDefined();
        if (!f) continue;
        const at = (field: string) => tag(`${atk.name}.${field}`);
        if (atk.kind === 'save') {
          expect(f.save, at('save')).toBeDefined();
          expect(f.save?.dc, at('save.dc')).toBe(atk.saveDc);
          expect(f.save?.ability, at('save.ability')).toBe(atk.saveAbility);
          expect(f.attack, at('attack (save action has no attack roll)')).toBeUndefined();
        } else {
          expect(f.attack?.kind, at('kind')).toBe(atk.kind);
          expect(f.attack?.bonus, at('bonus')).toBe(atk.bonus);
          if (atk.reach !== undefined) expect(f.attack?.reachFt, at('reach')).toBe(atk.reach);
          if (atk.range !== undefined) {
            const [n, l] = atk.range.replace(/[^\d/]/g, '').split('/').map(Number);
            expect(f.attack?.rangeFt, at('range')).toEqual([n, l]);
          }
        }
        // Damage: golden "0" means no damage is dealt by the action.
        const expectedDamage = [
          ...(atk.damage === '0' ? [] : [{ dice: atk.damage, type: atk.damageType }]),
          ...(atk.extraDamage ?? []),
        ];
        const actual = (f.damage ?? []).map((d) => ({ dice: d.dice, type: d.type }));
        // The catalog may list conditional riders (charge / pounce / Prone bonus damage) after the
        // golden's normal + same-hit extra damage; the golden keeps those in `note`.
        expect(actual.length, at('damage.length')).toBeGreaterThanOrEqual(expectedDamage.length);
        const head = actual.slice(0, expectedDamage.length);
        expect(head.map((d) => d.dice), at('damage.dice')).toEqual(expectedDamage.map((d) => d.dice));
        expect(head.map((d) => d.type.toLowerCase()), at('damage.type')).toEqual(expectedDamage.map((d) => d.type.toLowerCase()));
        if (actual.length > expectedDamage.length) {
          expect(atk.note ?? '', at('damage rider must be described in the golden note')).not.toBe('');
        }
      }
    });
  }
});

// ─── Internal consistency (every creature) ───────────────────────────────────

describe('creature catalog: internal consistency', () => {
  it('every record has a name, a source with page or line, and a known kind', () => {
    for (const c of CREATURE_LIST) {
      expect(c.name.length, `${c.id}.name`).toBeGreaterThan(0);
      if (c.source.book === 'Monster Manual 2024') {
        expect(c.source.pdfPage, `${c.id}.source.pdfPage`).toBeGreaterThan(0);
        expect(c.source.printedPage, `${c.id}.source.printedPage`).toBe((c.source.pdfPage ?? 0) - 3);
      } else {
        expect(c.source.line, `${c.id}.source.line`).toBeGreaterThan(0);
      }
      expect(['primal-companion', 'familiar', 'steed', 'animal', 'undead'], `${c.id}.kind`).toContain(c.kind);
    }
  });

  it('has no unreadable (null) numbers any more', () => {
    for (const c of CREATURE_LIST) {
      expect(c.ac, `${c.id}.ac`).not.toBeNull();
      expect(c.speeds, `${c.id}.speeds`).not.toBeNull();
      expect(c.challenge.cr, `${c.id}.cr`).not.toBeNull();
      expect(c.senses?.passivePerception, `${c.id}.passivePerception`).not.toBeNull();
      for (const a of ABILITIES) {
        expect(c.abilities[a].score, `${c.id}.abilities.${a}.score`).not.toBeNull();
        expect(c.abilities[a].mod, `${c.id}.abilities.${a}.mod`).not.toBeNull();
      }
      if (!('formula' in c.hp)) {
        expect(c.hp.average, `${c.id}.hp.average`).not.toBeNull();
        expect(c.hp.dice, `${c.id}.hp.dice`).not.toBeNull();
      }
    }
  });

  it('ability modifiers equal floor((score - 10) / 2)', () => {
    for (const c of CREATURE_LIST) {
      for (const a of ABILITIES) {
        const ab = c.abilities[a];
        if (ab.score !== null) expect(ab.mod, `${c.id}.abilities.${a}.mod`).toBe(mod(ab.score));
      }
    }
  });

  it('a save is the modifier, or the modifier plus PB when proficient (explicit model)', () => {
    let proficientCount = 0;
    for (const c of CREATURE_LIST) {
      // Primal Companions and the Otherworldly Steed use their owner's PB (Primal Bond / spell); saves equal the modifier.
      const pb = isFormulaScaled(c) ? 0 : pbForCr(c.challenge.cr as string);
      for (const a of ABILITIES) {
        const ab = c.abilities[a];
        const expected = (ab.mod as number) + (ab.saveProficient ? pb : 0);
        expect(ab.save, `${c.id}.abilities.${a}.save`).toBe(expected);
        if (ab.saveProficient) {
          proficientCount += 1;
          expect(isFormulaScaled(c), `${c.id}.abilities.${a}: formula-scaled creatures have no save proficiency`).toBe(false);
        }
      }
    }
    // 14 creatures x their proficient saves (Camel, Cat, Crocodile, Giant Goat, Goat, Mastiff, Mule, Pony, Warhorse, Zombie = 10)
    expect(proficientCount, 'number of proficient saves in the catalog').toBe(10);
  });

  it('initiative modifier equals the Dexterity modifier', () => {
    for (const c of CREATURE_LIST) {
      if (!c.initiative) continue;
      expect(c.initiative.modifier, `${c.id}.initiative`).toBe(c.abilities.dex.mod);
      expect(c.initiative.score, `${c.id}.initiative.score`).toBe(10 + c.initiative.modifier);
    }
  });

  it('HP average equals dice average plus Constitution modifier x dice count', () => {
    for (const c of CREATURE_LIST) {
      if ('formula' in c.hp || c.hp.dice === null || c.hp.average === null) continue;
      const { count, sides, bonus } = parseDice(c.hp.dice);
      const con = c.abilities.con.mod;
      expect(con, `${c.id}.abilities.con.mod`).not.toBeNull();
      expect(bonus, `${c.id}.hp.dice bonus`).toBe((con ?? 0) * count);
      expect(c.hp.average, `${c.id}.hp.average`).toBe(Math.floor((count * (sides + 1)) / 2 + bonus));
    }
  });

  it('proficiency bonus matches the PHB CR table', () => {
    for (const c of CREATURE_LIST) {
      if (isFormulaScaled(c)) {
        expect(['primal-companion', 'steed'], `${c.id}.kind`).toContain(c.kind);
        expect(c.challenge.proficiencyBonus, `${c.id}.pb`).toBeNull();
        continue;
      }
      expect(c.challenge.proficiencyBonus, `${c.id}.proficiencyBonus`).toBe(pbForCr(c.challenge.cr as string));
    }
  });

  it('attack bonuses equal ability modifier + PB for the creature', () => {
    for (const c of CREATURE_LIST) {
      if (isFormulaScaled(c)) continue;
      const pb = pbForCr(c.challenge.cr as string);
      for (const f of allFeatures(c)) {
        if (!f.attack || f.attack.bonus === null) continue;
        const candidates = ABILITIES.map((a) => c.abilities[a].mod).filter((m): m is number => m !== null).map((m) => m + pb);
        expect(candidates, `${c.id}.${f.name}.bonus ${f.attack.bonus} not explained by any ability modifier + PB ${pb}`).toContain(f.attack.bonus);
      }
    }
  });

  it('passive Perception equals 10 + the Perception bonus (or Wisdom modifier)', () => {
    for (const c of CREATURE_LIST) {
      const wis = c.abilities.wis.mod;
      const per = c.skills.Perception ?? wis;
      if (per === null || per === undefined) continue;
      expect(c.senses?.passivePerception, `${c.id}.passivePerception`).toBe(10 + per);
    }
  });

  it('save-action DCs are 8 + PB + the relevant ability modifier of the creature', () => {
    for (const c of CREATURE_LIST) {
      if (isFormulaScaled(c)) continue;
      const pb = pbForCr(c.challenge.cr as string);
      for (const f of allFeatures(c)) {
        if (!f.save || f.save.dc === null) continue;
        const candidates = ABILITIES.map((a) => c.abilities[a].mod).filter((m): m is number => m !== null).map((m) => 8 + pb + m);
        expect(candidates, `${c.id}.${f.name}.save.dc ${f.save.dc} not explained by 8 + PB + a modifier`).toContain(f.save.dc);
      }
    }
  });

  it('mounts table rows are present for the PHB mount creatures', () => {
    const mounts = CREATURE_LIST.filter((c) => c.forms.mount).map((c) => c.id).sort();
    expect(mounts).toEqual(['camel', 'draft-horse', 'elephant', 'mastiff', 'mule', 'pony', 'riding-horse', 'warhorse']);
    for (const c of CREATURE_LIST.filter((x) => x.mountTable)) {
      expect(c.forms.mount, `${c.id}.forms.mount`).toBe(true);
    }
    expect(CREATURE_CATALOG['mastiff'].mountTable).toEqual({ carryingCapacityLb: 195, costGp: 25 });
    expect(CREATURE_CATALOG['mule'].mountTable).toEqual({ carryingCapacityLb: 420, costGp: 8 });
    expect(CREATURE_CATALOG['riding-horse'].mountTable).toEqual({ carryingCapacityLb: 480, costGp: 75 });
  });
});

// ─── Primal Companion records ────────────────────────────────────────────────

describe('creature catalog: Primal Companion records match the golden', () => {
  for (const g of GOLDEN_PRIMAL_COMPANIONS) {
    it(g.id, () => {
      const c = CREATURE_CATALOG[g.id];
      expect(c, `${g.id}: record missing`).toBeDefined();
      const tag = (f: string) => `${g.id}.${f}`;
      expect(c.name, tag('name')).toBe(g.name);
      expect(c.kind, tag('kind')).toBe('primal-companion');
      expect(c.size, tag('size')).toBe(g.size);
      expect(c.creatureType, tag('type')).toBe(g.type);
      expect(c.alignment, tag('alignment')).toBe(g.alignment);
      expect(c.ac, tag('ac')).toEqual({ base: g.acBase, plusAbility: 'wis' });
      expect(c.hp, tag('hp')).toEqual({ formula: { base: g.hpBase, perLevel: g.hpPerLevel, hitDie: g.hitDie, levelSource: 'ranger-level' } });
      expect(c.speeds, tag('speeds')).toEqual(g.speeds);
      for (const a of ABILITIES) expect(c.abilities[a].score, tag(`abilities.${a}`)).toBe(g.abilities[a]);
      expect(c.senses?.passivePerception, tag('passivePerception')).toBe(g.passivePerception);
      expect(c.source.line, tag('source.line')).toBe(g.line);
      expect(c.source.book, tag('source.book')).toBe('PHB 2024');
      expect(c.senses?.darkvisionFt ?? null, tag('senses.darkvision')).toBe(senseRange(g.senses, 'Darkvision'));
      expect(c.senses?.blindsightFt ?? null, tag('senses.blindsight')).toBe(senseRange(g.senses, 'Blindsight'));
      expect(c.languages, tag('languages')).toBe(g.languages);
      expect(c.bonusActions.length, tag('bonusActions.length')).toBe(0);
      expect(c.reactions.length, tag('reactions.length')).toBe(0);
      expect(c.traits.map((t) => t.name), tag('traits')).toEqual(g.traitNames);
      expect(c.actions.map((a) => a.name), tag('actions')).toEqual(g.actionNames);
      const strike = c.actions[0];
      expect(strike.attack?.kind, tag('strike.kind')).toBe('melee');
      expect(strike.attack?.bonus, tag('strike.bonus (formula)')).toBeNull();
      expect(strike.attack?.bonusFormula, tag('strike.bonusFormula')).toBe('spell-attack-modifier');
      expect(strike.attack?.reachFt, tag('strike.reach')).toBe(5);
      expect(strike.damage?.[0].dice, tag('strike.dice')).toBe(`${g.strike.dice}+${g.strike.flatBonus}`);
      expect(strike.damage?.[0].plusAbilityOfOwner, tag('strike.plusAbilityOfOwner')).toBe('wis');
      expect(strike.damage?.[0].typeChoice ?? [strike.damage?.[0].type], tag('strike.types')).toEqual(g.strike.damageTypes);
    });
  }

  it('golden ids are exactly the three Beast Master beasts', () => {
    expect([...goldenPrimalById.keys()].sort()).toEqual([...PRIMAL_COMPANION_IDS].sort());
    expect(goldenById.size).toBe(GOLDEN_CREATURES.length);
  });
});

// ─── Otherworldly Steed record ───────────────────────────────────────────────

describe('creature catalog: Otherworldly Steed record matches the golden', () => {
  const g = GOLDEN_OTHERWORLDLY_STEED;
  const c = CREATURE_CATALOG[g.id];
  const tag = (f: string) => `${g.id}.${f}`;

  it('static fields', () => {
    expect(c, `${g.id}: record missing`).toBeDefined();
    expect(c.name, tag('name')).toBe(g.name);
    expect(c.kind, tag('kind')).toBe('steed');
    expect(c.size, tag('size')).toBe(g.size);
    expect(c.alignment, tag('alignment')).toBe(g.alignment);
    expect(c.creatureType, tag('type')).toContain('Celestial, Fey, or Fiend');
    expect(c.ac, tag('ac')).toEqual({ base: g.acBase, perSpellLevel: g.acPerSpellLevel });
    expect(c.hp, tag('hp')).toEqual({ formula: { base: g.hpBase, perLevel: g.hpPerSpellLevel, hitDie: g.hitDie, levelSource: 'spell-level' } });
    expect(c.speeds, tag('speeds')).toEqual(g.speeds);
    for (const a of ABILITIES) {
      expect(c.abilities[a].score, tag(`abilities.${a}.score`)).toBe(g.abilities[a]);
      expect(c.abilities[a].save, tag(`abilities.${a}.save`)).toBe(mod(g.abilities[a]));
      expect(c.abilities[a].saveProficient, tag(`abilities.${a}.saveProficient`)).toBe(false);
    }
    expect(c.senses?.passivePerception, tag('passivePerception')).toBe(g.passivePerception);
    expect(c.languages, tag('languages')).toBe(g.languages);
    expect(c.challenge.cr, tag('cr')).toBe('None');
    expect(c.traits.map((t) => t.name), tag('traits')).toEqual(g.traitNames);
    expect(c.actions.map((a) => a.name), tag('actions')).toEqual(g.actionNames);
    expect(c.bonusActions.map((a) => a.name), tag('bonusActions')).toEqual(g.bonusActionNames);
    expect(c.source.book, tag('source.book')).toBe('PHB 2024');
    expect(c.source.line, tag('source.line')).toBe(g.line);
    expect(c.forms.steed, tag('forms.steed')).toBe(true);
  });

  it('Otherworldly Slam, Fell Glare and Healing Touch use the spell formulas', () => {
    const slam = c.actions[0];
    expect(slam.attack?.bonus, tag('slam.bonus')).toBeNull();
    expect(slam.attack?.bonusFormula, tag('slam.bonusFormula')).toBe('spell-attack-modifier');
    expect(slam.attack?.reachFt, tag('slam.reach')).toBe(g.slam.reach);
    expect(slam.damage?.[0].dice, tag('slam.dice')).toBe(g.slam.dice);
    expect(slam.damage?.[0].plusSpellLevel, tag('slam.plusSpellLevel')).toBe(true);
    expect(slam.damage?.[0].typeChoice, tag('slam.types')).toEqual(Object.values(g.slam.typeByCreatureType));
    const glare = c.bonusActions.find((a) => a.name === 'Fell Glare');
    expect(glare?.save?.ability, tag('glare.ability')).toBe('wis');
    expect(glare?.save?.dc, tag('glare.dc')).toBeNull();
    expect(glare?.save?.dcFormula, tag('glare.dcFormula')).toBe('spell-save-dc');
    const heal = c.bonusActions.find((a) => a.name === 'Healing Touch');
    expect(heal?.healing, tag('heal')).toEqual(g.healingTouch);
  });
});

describe('resolveOtherworldlySteed: formulas as a pure function of spell level, spell attack modifier and spell save DC', () => {
  for (const ex of GOLDEN_STEED_EXAMPLES) {
    it(`spell level ${ex.spellLevel}`, () => {
      const r = resolveOtherworldlySteed({ spellLevel: ex.spellLevel, spellAttackModifier: 7, spellSaveDc: 15, creatureType: 'Celestial' });
      expect(r.armorClass, 'armorClass').toBe(ex.ac);
      expect(r.hitPoints, 'hitPoints').toBe(ex.hp);
      expect(`${r.hitDice.count}d${r.hitDice.die}`, 'hitDice').toBe(ex.hitDice);
      expect(`${r.slam.dice}+${r.slam.flat}`, 'slam').toBe(ex.slamDamage);
      expect(r.slam.damageType).toBe('Radiant');
      expect(`${r.healingTouch?.dice}+${r.healingTouch?.flat}`, 'healing').toBe(ex.healing);
      expect(r.speeds.fly !== undefined, 'fly requires a level 4+ spell').toBe(ex.hasFly);
      expect(r.speeds.walk).toBe(60);
      expect(r.attackBonus, 'attackBonus = your spell attack modifier').toBe(7);
    });
  }

  it('the creature type picks the damage type and the type-only bonus action', () => {
    const base = { spellLevel: 5, spellAttackModifier: 9, spellSaveDc: 17 } as const;
    const types: OtherworldlySteedType[] = ['Celestial', 'Fey', 'Fiend'];
    const [cel, fey, fiend] = types.map((creatureType) => resolveOtherworldlySteed({ ...base, creatureType }));
    expect([cel.slam.damageType, fey.slam.damageType, fiend.slam.damageType]).toEqual(['Radiant', 'Psychic', 'Necrotic']);
    expect(fiend.fellGlare).toEqual({ saveAbility: 'wis', dc: 17, rangeFt: 60 });
    expect(cel.fellGlare).toBeUndefined();
    expect(fey.feyStepFt).toBe(60);
    expect(fiend.feyStepFt).toBeUndefined();
    expect(cel.healingTouch).toEqual({ dice: '2d8', flat: 5 });
    expect(fey.healingTouch).toBeUndefined();
    expect(fiend.attackBonus).toBe(9);
  });

  it('rejects a spell level outside 2-9', () => {
    for (const spellLevel of [1, 10, 0, 2.5]) {
      expect(() => resolveOtherworldlySteed({ spellLevel, spellAttackModifier: 5, spellSaveDc: 13, creatureType: 'Fey' }), `level ${spellLevel}`).toThrow(RangeError);
    }
  });
});

// ─── Primal Companion formula function ───────────────────────────────────────

describe('resolvePrimalCompanion: hand-worked PHB values', () => {
  // PHB L5612-L5690. AC = 13 + Wis; HP Land/Sea = 5 + 5 x level (d8s), Sky = 4 + 4 x level (d6s);
  // attack bonus = spell attack modifier = Wis mod + PB; damage = die + flat + Wis mod;
  // Sea grapple escape DC = spell save DC = 8 + Wis mod + PB. PB table: PHB L513-L521.
  const cases = [
    { level: 3, wis: 3, pb: 2, ac: 16, land: 20, sky: 16, atk: 5, dc: 13 },
    { level: 5, wis: 4, pb: 3, ac: 17, land: 30, sky: 24, atk: 7, dc: 15 },
    { level: 9, wis: 3, pb: 4, ac: 16, land: 50, sky: 40, atk: 7, dc: 15 },
    { level: 11, wis: 4, pb: 4, ac: 17, land: 60, sky: 48, atk: 8, dc: 16 },
    { level: 17, wis: 5, pb: 6, ac: 18, land: 90, sky: 72, atk: 11, dc: 19 },
    { level: 20, wis: 5, pb: 6, ac: 18, land: 105, sky: 84, atk: 11, dc: 19 },
    { level: 3, wis: -1, pb: 2, ac: 12, land: 20, sky: 16, atk: 1, dc: 9 },
    { level: 3, wis: 0, pb: 2, ac: 13, land: 20, sky: 16, atk: 2, dc: 10 },
  ];

  for (const k of cases) {
    it(`Ranger ${k.level}, Wis ${k.wis >= 0 ? '+' : ''}${k.wis}, PB +${k.pb}`, () => {
      const input = { rangerLevel: k.level, wisdomModifier: k.wis, proficiencyBonus: k.pb };
      const land = resolvePrimalCompanion({ beastId: 'beast-of-the-land', ...input });
      const sky = resolvePrimalCompanion({ beastId: 'beast-of-the-sky', ...input });
      const sea = resolvePrimalCompanion({ beastId: 'beast-of-the-sea', ...input });

      for (const [name, r] of [['land', land], ['sky', sky], ['sea', sea]] as const) {
        expect(r.armorClass, `${name}.armorClass`).toBe(k.ac);
        expect(r.attackBonus, `${name}.attackBonus`).toBe(k.atk);
        expect(r.spellSaveDc, `${name}.spellSaveDc`).toBe(k.dc);
        expect(r.primalBondBonus, `${name}.primalBondBonus`).toBe(k.pb);
        expect(r.hitDice.count, `${name}.hitDice.count`).toBe(k.level);
      }
      expect(land.hitPoints, 'land.hitPoints').toBe(k.land);
      expect(sea.hitPoints, 'sea.hitPoints').toBe(k.land);
      expect(sky.hitPoints, 'sky.hitPoints').toBe(k.sky);
      expect([land.hitDice.die, sea.hitDice.die, sky.hitDice.die]).toEqual([8, 8, 6]);

      expect(land.strike.dice).toBe('1d8');
      expect(land.strike.totalFlat, 'land.strike.totalFlat').toBe(2 + k.wis);
      expect(sea.strike.dice).toBe('1d6');
      expect(sea.strike.totalFlat, 'sea.strike.totalFlat').toBe(2 + k.wis);
      expect(sky.strike.dice).toBe('1d4');
      expect(sky.strike.totalFlat, 'sky.strike.totalFlat').toBe(3 + k.wis);

      expect(sea.strike.grapples).toBe(true);
      expect(sea.strike.grappleEscapeDc, 'sea.grappleEscapeDc').toBe(k.dc);
      expect(land.strike.grapples).toBeUndefined();
      expect(land.strike.chargeExtraDice).toBe('1d6');
      expect(land.strike.chargeProne).toBe(true);
      expect(sky.strike.chargeExtraDice).toBeUndefined();
    });
  }

  it('matches every golden hand-worked example', () => {
    for (const ex of GOLDEN_PRIMAL_EXAMPLES) {
      const input = { rangerLevel: ex.rangerLevel, wisdomModifier: ex.wisMod, proficiencyBonus: ex.pb };
      const key = `L${ex.rangerLevel}/Wis${ex.wisMod}/PB${ex.pb}`;
      for (const [id, k] of [['beast-of-the-land', 'land'], ['beast-of-the-sky', 'sky'], ['beast-of-the-sea', 'sea']] as const) {
        const r = resolvePrimalCompanion({ beastId: id as PrimalCompanionId, ...input });
        expect(r.armorClass, `${key} ${id}.ac`).toBe(ex.ac);
        expect(r.hitPoints, `${key} ${id}.hp`).toBe(ex.hp[k]);
        expect(`${r.hitDice.count}d${r.hitDice.die}`, `${key} ${id}.hitDice`).toBe(ex.hitDice[k]);
        expect(r.attackBonus, `${key} ${id}.attackBonus`).toBe(ex.attackBonus);
        const flat = r.strike.totalFlat;
        expect(`${r.strike.dice}${flat >= 0 ? '+' : ''}${flat}`, `${key} ${id}.strike`).toBe(ex.strike[k]);
      }
    }
  });

  it('applies the level 7 / 11 / 15 upgrades at the right Ranger levels (PHB L5593-L5610)', () => {
    const at = (level: number) => resolvePrimalCompanion({ beastId: 'beast-of-the-land', rangerLevel: level, wisdomModifier: 3, proficiencyBonus: 4 });
    expect(at(6)).toMatchObject({ exceptionalTraining: false, bestialFury: false, shareSpells: false, strikesPerCommand: 1 });
    expect(at(7)).toMatchObject({ exceptionalTraining: true, bestialFury: false, shareSpells: false, strikesPerCommand: 1 });
    expect(at(11)).toMatchObject({ exceptionalTraining: true, bestialFury: true, shareSpells: false, strikesPerCommand: 2 });
    expect(at(15)).toMatchObject({ exceptionalTraining: true, bestialFury: true, shareSpells: true, strikesPerCommand: 2 });
    expect(at(15).activeUpgrades.map((u) => u.level)).toEqual([7, 11, 15]);
  });

  it('rejects a Ranger level outside 3-20', () => {
    for (const rangerLevel of [2, 21, 0, 3.5]) {
      expect(() => resolvePrimalCompanion({ beastId: 'beast-of-the-land', rangerLevel, wisdomModifier: 2, proficiencyBonus: 2 }), `level ${rangerLevel}`).toThrow(RangeError);
    }
  });
});
