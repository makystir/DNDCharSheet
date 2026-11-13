import { describe, it, expect } from 'vitest';
import { NPC_TEMPLATE_LIST } from '../npc-templates';
import type { NpcTemplate } from '../npc-templates';
import { GOLDEN_NPCS, GOLDEN_NPC_COUNT } from './npc-templates-golden';
import { ABILITIES } from '../../types/character';
import type { Ability } from '../../types/character';
import { parseChallengeRating } from '../../logic/sidekick';

/**
 * Deterministic oracle for the Monster Manual 2024 NPC templates. Two kinds of
 * checks, both fail-closed:
 *  1. Every template equals the independently generated golden fixture
 *     (printed numbers read from the MM page images).
 *  2. Every number obeys the 2024 stat block arithmetic (MM 2024 "Reading a
 *     stat block"): mod = floor((score - 10) / 2); saves, skills and initiative
 *     add 0, PB or 2 x PB; attack bonus = PB + an ability mod; DC = 8 + PB + an
 *     ability mod; damage and Hit Point averages = floor(dice average) + bonus;
 *     PB by CR (0-4 +2, 5-8 +3, 9-12 +4); passive Perception = 10 + Perception.
 * Values the book prints that break rule 2 are allow-listed by id, never "fixed".
 */

/** Printed values that don't follow the arithmetic; kept as printed. */
const ALLOW = {
  /** Priest (p.248) Radiant Flame +4, though Wis +3 and PB +2 give +5. */
  attackBonus: new Set(['priest:Radiant Flame']),
  /** Performer Maestro (p.237) Initiative +8 and Legend +10 fit no Dex + 0/PB/2PB. */
  initiative: new Set(['performer-maestro', 'performer-legend']),
};

const SKILL_ABILITY: Record<string, Ability> = {
  Acrobatics: 'dex', Arcana: 'int', Athletics: 'str', Deception: 'cha', History: 'int', Insight: 'wis',
  Investigation: 'int', Medicine: 'wis', Nature: 'int', Perception: 'wis', Performance: 'cha',
  Persuasion: 'cha', Religion: 'int', 'Sleight of Hand': 'dex', Stealth: 'dex', Survival: 'wis',
};

const mod = (score: number) => Math.floor((score - 10) / 2);

function diceAverage(dice: string): number {
  const m = /^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/.exec(dice.trim());
  if (!m) throw new Error(`bad dice ${dice}`);
  const base = Math.floor((Number(m[1]) * (Number(m[2]) + 1)) / 2);
  const bonus = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
  return base + bonus;
}

function pbForCr(cr: number): number {
  if (cr <= 4) return 2;
  if (cr <= 8) return 3;
  return 4;
}

const allText = (t: NpcTemplate) =>
  [...(t.stats.traits ?? []), ...(t.stats.actions ?? []), ...(t.stats.bonusActions ?? []), ...(t.stats.reactions ?? [])]
    .map((x) => x.description)
    .join('\n');

/** Every rule violation and golden mismatch, as readable strings (empty = all good). */
export function npcTemplateProblems(list: readonly NpcTemplate[]): string[] {
  const problems: string[] = [];
  const add = (id: string, msg: string) => problems.push(`${id}: ${msg}`);

  if (list.length !== GOLDEN_NPC_COUNT) problems.push(`count ${list.length} != golden ${GOLDEN_NPC_COUNT}`);
  const ids = list.map((t) => t.id);
  if (new Set(ids).size !== ids.length) problems.push('duplicate ids');
  const goldenIds = new Set(GOLDEN_NPCS.map((g) => g.id));
  for (const id of ids) if (!goldenIds.has(id)) problems.push(`${id}: not in golden`);
  for (const id of goldenIds) if (!ids.includes(id)) problems.push(`${id}: missing from templates`);

  for (const t of list) {
    const s = t.stats;
    const g = GOLDEN_NPCS.find((x) => x.id === t.id);
    const pb = s.proficiencyBonus ?? NaN;
    const scores = ABILITIES.map((a) => s.abilities?.[a] ?? NaN);
    const mods = scores.map(mod);
    const derivedSaves = ABILITIES.map((a, i) => mods[i] + (s.saveProficiencies?.includes(a) ? pb : 0));
    const text = allText(t);

    // 1. Golden fixture
    if (g) {
      const eq = (field: string, actual: unknown, expected: unknown) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) add(t.id, `${field} ${JSON.stringify(actual)} != golden ${JSON.stringify(expected)}`);
      };
      eq('name', t.name, g.name);
      eq('page', t.page, g.page);
      eq('ac', s.ac, g.ac);
      eq('init', s.initiativeMod, g.init);
      eq('hp', s.hpMax, g.hp);
      eq('hpDice', t.hpDice, g.hpDice);
      eq('speed', s.speed, g.speed);
      eq('scores', scores, g.scores);
      eq('mods', mods, g.mods);
      eq('saves', derivedSaves, g.saves);
      eq('cr', s.cr, g.cr);
      eq('xp', s.xp, g.xp);
      eq('pb', pb, g.pb);
      eq('passive', s.senses, `Passive Perception ${g.passive}`);
      eq('skills', s.skills ?? null, g.skills);
      const damage = [...text.matchAll(/(\d+) \((\d+d\d+(?: [+-] \d+)?)\)/g)].map((m) => [Number(m[1]), m[2].replace(/ /g, '')]);
      eq('damage', damage, g.damage);
      eq('dcs', [...text.matchAll(/DC (\d+)/g)].map((m) => Number(m[1])), g.dcs);
      for (const a of g.attacks) {
        const entry = s.actions?.find((x) => x.name === a.name);
        if (!entry) add(t.id, `attack ${a.name} missing`);
        else if (!new RegExp(`Attack Roll: \\+${a.bonus}\\b`).test(entry.description)) add(t.id, `attack ${a.name} bonus != +${a.bonus}`);
      }
      const attackEntries = (s.actions ?? []).filter((x) => /Attack Roll: \+/.test(x.description)).map((x) => x.name);
      eq('attack names', attackEntries, g.attacks.map((a) => a.name));
    }

    // 2. Stat block arithmetic
    const crNum = parseChallengeRating(s.cr);
    if (crNum === null || crNum > 10) add(t.id, `CR ${s.cr} not a number <= 10 (DMG L3557 cap)`);
    else if (pb !== pbForCr(crNum)) add(t.id, `PB +${pb} does not match CR ${s.cr}`);
    if (s.hpMax !== diceAverage(t.hpDice)) add(t.id, `HP ${s.hpMax} != average of ${t.hpDice}`);
    const dexMod = mods[1];
    if (![dexMod, dexMod + pb, dexMod + 2 * pb].includes(s.initiativeMod ?? NaN) && !ALLOW.initiative.has(t.id)) {
      add(t.id, `initiative ${s.initiativeMod} is not Dex mod + 0/PB/2PB`);
    }
    for (const m of text.matchAll(/(\d+) \((\d+d\d+(?: [+-] \d+)?)\)/g)) {
      if (Number(m[1]) !== diceAverage(m[2])) add(t.id, `damage ${m[1]} != average of ${m[2]}`);
    }
    const anyMod = (n: number) => mods.some((md) => md + pb === n);
    for (const entry of s.actions ?? []) {
      const m = /Attack Roll: \+(\d+)/.exec(entry.description);
      if (m && !anyMod(Number(m[1])) && !ALLOW.attackBonus.has(`${t.id}:${entry.name}`)) add(t.id, `${entry.name} +${m[1]} is not PB + an ability mod`);
      const hit = /\+(\d+) to hit with spell attacks/.exec(entry.description);
      if (hit && !anyMod(Number(hit[1]))) add(t.id, `spell attack +${hit[1]} is not PB + an ability mod`);
    }
    for (const m of text.matchAll(/DC (\d+)/g)) {
      if (!anyMod(Number(m[1]) - 8)) add(t.id, `DC ${m[1]} is not 8 + PB + an ability mod`);
    }
    const skillMap = new Map<string, number>();
    for (const part of (s.skills ?? '').split(',').map((x) => x.trim()).filter(Boolean)) {
      const m = /^(.+) ([+-]\d+)$/.exec(part);
      if (!m || !(m[1] in SKILL_ABILITY)) {
        add(t.id, `unreadable skill "${part}"`);
        continue;
      }
      const base = mods[ABILITIES.indexOf(SKILL_ABILITY[m[1]])];
      const value = Number(m[2]);
      if (![base, base + pb, base + 2 * pb].includes(value)) add(t.id, `${m[1]} ${m[2]} is not mod + 0/PB/2PB`);
      skillMap.set(m[1], value);
    }
    const passive = 10 + (skillMap.get('Perception') ?? mods[4]);
    if (s.senses !== `Passive Perception ${passive}`) add(t.id, `senses "${s.senses}" != Passive Perception ${passive}`);
    if ((s.saveProficiencies ?? []).length === 0 && derivedSaves.some((v, i) => v !== mods[i])) add(t.id, 'saves differ from mods without proficiency');
    if (!/^\d+d\d+( [+-] \d+)?$/.test(t.hpDice)) add(t.id, `hpDice "${t.hpDice}" format`);
  }
  return problems;
}

describe('Monster Manual 2024 NPC templates', () => {
  it('match the golden fixture and the 2024 stat block arithmetic', () => {
    expect(npcTemplateProblems(NPC_TEMPLATE_LIST)).toEqual([]);
  });

  it('pins the catalogue size and ids', () => {
    expect(NPC_TEMPLATE_LIST).toHaveLength(35);
    expect(GOLDEN_NPC_COUNT).toBe(35);
    expect(new Set(NPC_TEMPLATE_LIST.map((t) => t.id)).size).toBe(35);
  });

  it('fails closed on each kind of mutation', () => {
    const clone = () => JSON.parse(JSON.stringify(NPC_TEMPLATE_LIST)) as NpcTemplate[];
    const mutations: [string, (l: NpcTemplate[]) => void][] = [
      ['drop one', (l) => l.pop()],
      ['duplicate id', (l) => (l[1].id = l[0].id)],
      ['ac', (l) => (l[0].stats.ac = (l[0].stats.ac ?? 0) + 1)],
      ['score', (l) => (l[0].stats.abilities = { ...l[0].stats.abilities, str: 30 })],
      ['save proficiency', (l) => (l[0].stats.saveProficiencies = ['str'])],
      ['hp', (l) => (l[0].stats.hpMax = (l[0].stats.hpMax ?? 0) + 1)],
      ['damage average', (l) => (l[0].stats.actions![1].description = l[0].stats.actions![1].description.replace('7 (1d6 + 4)', '8 (1d6 + 4)'))],
      ['attack bonus', (l) => (l[0].stats.actions![1].description = l[0].stats.actions![1].description.replace('+7', '+6'))],
      ['dc', (l) => {
        const t = l.find((x) => x.id === 'gladiator')!;
        t.stats.actions![2].description = t.stats.actions![2].description.replace('DC 15', 'DC 14');
      }],
      ['cr above cap', (l) => (l[0].stats.cr = '12')],
      ['skill', (l) => (l[0].stats.skills = 'Acrobatics +9, Perception +6, Stealth +10')],
      ['passive', (l) => (l[0].stats.senses = 'Passive Perception 15')],
      ['allow-list does not leak', (l) => {
        const t = l.find((x) => x.id === 'priest')!;
        t.stats.actions![1].description = t.stats.actions![1].description.replace('+5', '+4');
      }],
    ];
    for (const [label, mutate] of mutations) {
      const l = clone();
      mutate(l);
      expect(npcTemplateProblems(l).length, label).toBeGreaterThan(0);
    }
  });
});
