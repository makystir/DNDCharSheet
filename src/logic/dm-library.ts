/**
 * The Dungeon Master's creature library: one read-only view model over the
 * three places a stat block can come from (the Monster Manual 2024 NPC blocks,
 * the Player's Handbook / Monster Manual creatures the app already carries, and
 * the DM's own custom monsters), plus search, filters and the conversions that
 * put a creature into an encounter.
 *
 * Numbers are copied as printed. Only two figures are derived, both from the
 * printed ability scores (PHB 2024 "Ability Scores and Modifiers"): the
 * ability modifier, and a saving throw bonus (modifier plus Proficiency Bonus
 * when the creature is proficient).
 */
import type { Ability } from '../types/character';
import type { DmCombatant, DmCustomMonster, DmData, DmMonsterEntry } from '../types/dm';
import { CREATURE_LIST, type CreatureStatBlock } from '../data/creatures';
import { NPC_TEMPLATE_LIST, type NpcTemplate } from '../data/npc-templates';
import { abilityModifier } from './abilities';
import { xpForCr } from './dm-balance';
import { combatantFromCreature, combatantFromTemplate, customCombatant } from './dm-encounter';

export const ABILITY_KEYS: readonly Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABILITY_LABELS: Record<Ability, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

export type LibraryOrigin = 'npc' | 'creature' | 'custom';

export interface LibraryMonster {
  /** Stable key: `npc:<id>`, `creature:<id>` or `custom:<id>`. */
  key: string;
  origin: LibraryOrigin;
  name: string;
  /** Where it is printed, e.g. "Monster Manual 2024, p.27". */
  source: string;
  size: string;
  creatureType: string;
  alignment: string;
  cr: string | null;
  crValue: number | null;
  xp: number | null;
  ac: number | null;
  acNote: string;
  hpAverage: number | null;
  hpDice: string;
  speed: string;
  abilities: Partial<Record<Ability, number>>;
  /** Saving throw bonuses for proficient abilities only. */
  saves: Partial<Record<Ability, number>>;
  proficiencyBonus: number | null;
  initiativeMod: number | null;
  conSaveMod: number | null;
  skills: string;
  senses: string;
  languages: string;
  resistances: string;
  vulnerabilities: string;
  immunities: string;
  conditionImmunities: string;
  gear: string;
  traits: DmMonsterEntry[];
  actions: DmMonsterEntry[];
  bonusActions: DmMonsterEntry[];
  reactions: DmMonsterEntry[];
  legendaryActions: DmMonsterEntry[];
  legendaryUses: number;
  /** Can go straight into an encounter (has a fixed Armor Class and Hit Points). */
  addable: boolean;
  /** Set for custom monsters. */
  customId?: string;
  basedOn?: string;
}

/** "1/8" -> 0.125, "5" -> 5, anything else -> null. */
export function crToNumber(cr: string | null | undefined): number | null {
  if (cr === null || cr === undefined) return null;
  const text = cr.trim();
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  return /^\d+$/.test(text) ? Number(text) : null;
}

function saveBonuses(
  scores: Partial<Record<Ability, number>>,
  proficient: readonly Ability[],
  pb: number | null,
): Partial<Record<Ability, number>> {
  const out: Partial<Record<Ability, number>> = {};
  if (pb === null) return out;
  for (const a of proficient) {
    const score = scores[a];
    if (score !== undefined) out[a] = abilityModifier(score) + pb;
  }
  return out;
}

function conSave(scores: Partial<Record<Ability, number>>, proficient: readonly Ability[], pb: number | null): number | null {
  const con = scores.con;
  if (con === undefined) return null;
  return abilityModifier(con) + (proficient.includes('con') && pb !== null ? pb : 0);
}

function fromTemplate(t: NpcTemplate): LibraryMonster {
  const s = t.stats;
  const abilities = s.abilities ?? {};
  const proficient = s.saveProficiencies ?? [];
  const pb = s.proficiencyBonus ?? null;
  return {
    key: `npc:${t.id}`,
    origin: 'npc',
    name: t.name,
    source: `Monster Manual 2024, p.${t.page}`,
    size: s.size ?? 'Medium',
    creatureType: s.creatureType ?? 'Humanoid',
    alignment: s.alignment ?? '',
    cr: s.cr ?? null,
    crValue: crToNumber(s.cr),
    xp: s.xp ?? null,
    ac: s.ac ?? null,
    acNote: '',
    hpAverage: s.hpMax ?? null,
    hpDice: t.hpDice,
    speed: s.speed ?? '',
    abilities,
    saves: saveBonuses(abilities, proficient, pb),
    proficiencyBonus: pb,
    initiativeMod: s.initiativeMod ?? null,
    conSaveMod: conSave(abilities, proficient, pb),
    skills: s.skills ?? '',
    senses: s.senses ?? '',
    languages: s.languages ?? '',
    resistances: s.resistances ?? '',
    vulnerabilities: s.vulnerabilities ?? '',
    immunities: s.immunities ?? '',
    conditionImmunities: '',
    gear: s.gear ?? '',
    traits: s.traits ?? [],
    actions: s.actions ?? [],
    bonusActions: s.bonusActions ?? [],
    reactions: s.reactions ?? [],
    legendaryActions: [],
    legendaryUses: 0,
    addable: typeof s.ac === 'number' && typeof s.hpMax === 'number',
  };
}

function creatureSpeed(c: CreatureStatBlock): string {
  const sp = c.speeds;
  if (!sp) return '';
  const parts: string[] = [];
  if (sp.walk !== undefined) parts.push(`${sp.walk} ft.`);
  for (const k of ['burrow', 'climb', 'fly', 'swim'] as const) {
    if (sp[k] !== undefined) parts.push(`${k} ${sp[k]} ft.`);
  }
  return parts.join(', ');
}

function creatureAc(c: CreatureStatBlock): { ac: number | null; note: string } {
  if (typeof c.ac === 'number') return { ac: c.ac, note: '' };
  if (c.ac && typeof c.ac === 'object') {
    if ('plusAbility' in c.ac) return { ac: null, note: `${c.ac.base} + the owner's ${c.ac.plusAbility.toUpperCase()} modifier` };
    return { ac: null, note: `${c.ac.base} + ${c.ac.perSpellLevel} per spell level` };
  }
  return { ac: null, note: 'Not printed' };
}

function fromCreature(c: CreatureStatBlock): LibraryMonster {
  const abilities: Partial<Record<Ability, number>> = {};
  const saves: Partial<Record<Ability, number>> = {};
  for (const a of ABILITY_KEYS) {
    const entry = c.abilities[a];
    if (entry.score !== null) abilities[a] = entry.score;
    if (entry.saveProficient && entry.save !== null) saves[a] = entry.save;
  }
  const { ac, note } = creatureAc(c);
  const hp = c.hp;
  const hpAverage = 'average' in hp && typeof hp.average === 'number' ? hp.average : null;
  const hpDice = 'dice' in hp && hp.dice ? hp.dice : '';
  const book = c.source.book;
  const page = c.source.printedPage;
  const senses = c.senses
    ? [
        c.senses.blindsightFt ? `Blindsight ${c.senses.blindsightFt} ft.` : '',
        c.senses.darkvisionFt ? `Darkvision ${c.senses.darkvisionFt} ft.` : '',
        c.senses.passivePerception !== null ? `Passive Perception ${c.senses.passivePerception}` : '',
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const skills = Object.entries(c.skills)
    .map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`)
    .join(', ');
  const pb = c.challenge.proficiencyBonus;
  return {
    key: `creature:${c.id}`,
    origin: 'creature',
    name: c.name,
    source: page !== undefined ? `${book}, p.${page}` : book,
    size: c.size ?? '',
    creatureType: c.subtype ? `${c.creatureType ?? ''} (${c.subtype})`.trim() : (c.creatureType ?? ''),
    alignment: c.alignment ?? '',
    cr: c.challenge.cr,
    crValue: crToNumber(c.challenge.cr),
    xp: c.challenge.xp,
    ac,
    acNote: note,
    hpAverage,
    hpDice,
    speed: creatureSpeed(c),
    abilities,
    saves,
    proficiencyBonus: pb,
    initiativeMod: c.initiative?.modifier ?? c.abilities.dex.mod ?? null,
    conSaveMod: c.abilities.con.save,
    skills,
    senses,
    languages: c.languages ?? '',
    resistances: c.damageResistances.join('; '),
    vulnerabilities: c.damageVulnerabilities.join('; '),
    immunities: c.damageImmunities.join('; '),
    conditionImmunities: c.conditionImmunities.join('; '),
    gear: c.gear.join('; '),
    traits: c.traits.map((f) => ({ name: f.usage ? `${f.name} (${f.usage})` : f.name, description: f.description })),
    actions: c.actions.map((f) => ({ name: f.usage ? `${f.name} (${f.usage})` : f.name, description: f.description })),
    bonusActions: c.bonusActions.map((f) => ({ name: f.name, description: f.description })),
    reactions: c.reactions.map((f) => ({ name: f.name, description: f.description })),
    legendaryActions: [],
    legendaryUses: 0,
    addable: ac !== null && hpAverage !== null && hpAverage > 0,
  };
}

function fromCustom(m: DmCustomMonster): LibraryMonster {
  const abilities = m.abilities;
  return {
    key: `custom:${m.id}`,
    origin: 'custom',
    name: m.name,
    source: 'Custom monster',
    size: m.size,
    creatureType: m.creatureType,
    alignment: m.alignment,
    cr: m.cr.trim() === '' ? null : m.cr,
    crValue: crToNumber(m.cr),
    xp: null,
    ac: m.ac,
    acNote: '',
    hpAverage: m.hpMax,
    hpDice: m.hpDice,
    speed: m.speed,
    abilities,
    saves: saveBonuses(abilities, m.saveProficiencies, m.proficiencyBonus),
    proficiencyBonus: m.proficiencyBonus,
    initiativeMod: m.initiativeMod,
    conSaveMod: conSave(abilities, m.saveProficiencies, m.proficiencyBonus),
    skills: m.skills,
    senses: m.senses,
    languages: m.languages,
    resistances: m.resistances,
    vulnerabilities: m.vulnerabilities,
    immunities: m.immunities,
    conditionImmunities: m.conditionImmunities,
    gear: '',
    traits: m.traits,
    actions: m.actions,
    bonusActions: m.bonusActions,
    reactions: m.reactions,
    legendaryActions: m.legendaryActions,
    legendaryUses: m.legendaryUses,
    addable: true,
    customId: m.id,
    basedOn: m.basedOn,
  };
}

let builtIns: LibraryMonster[] | undefined;

/** The Monster Manual NPC blocks and the app's creatures (Primal Companions are player features, so they are left out). */
export function builtInMonsters(): LibraryMonster[] {
  builtIns ??= [
    ...NPC_TEMPLATE_LIST.map(fromTemplate),
    ...CREATURE_LIST.filter((c) => c.kind !== 'primal-companion').map(fromCreature),
  ];
  return builtIns;
}

/** Built-in creatures plus the DM's custom monsters, sorted by name. */
export function libraryMonsters(data: Pick<DmData, 'customMonsters'>): LibraryMonster[] {
  return [...builtInMonsters(), ...data.customMonsters.map(fromCustom)].sort((a, b) => a.name.localeCompare(b.name));
}

export interface LibraryFilter {
  query?: string;
  /** Exact CR text, e.g. "1/4". */
  cr?: string;
  /** Creature type, matched ignoring case and any subtype. */
  type?: string;
  origin?: LibraryOrigin;
}

export function typeOf(m: LibraryMonster): string {
  return m.creatureType.replace(/\s*\(.*\)\s*$/, '').trim();
}

export function filterMonsters(list: LibraryMonster[], f: LibraryFilter): LibraryMonster[] {
  const q = (f.query ?? '').trim().toLowerCase();
  return list.filter(
    (m) =>
      (q === '' || m.name.toLowerCase().includes(q)) &&
      (!f.cr || m.cr === f.cr) &&
      (!f.type || typeOf(m).toLowerCase() === f.type.toLowerCase()) &&
      (!f.origin || m.origin === f.origin),
  );
}

/** Distinct Challenge Ratings in the list, lowest first. */
export function crOptions(list: LibraryMonster[]): string[] {
  const seen = new Map<string, number>();
  for (const m of list) if (m.cr !== null && !seen.has(m.cr)) seen.set(m.cr, m.crValue ?? Number.POSITIVE_INFINITY);
  return [...seen.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([cr]) => cr);
}

export function typeOptions(list: LibraryMonster[]): string[] {
  return [...new Set(list.map(typeOf).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

// ------------------------------------------------------------ custom monsters

export function blankCustomMonster(id: string, now: number): DmCustomMonster {
  return {
    id,
    name: 'New monster',
    size: 'Medium',
    creatureType: 'Humanoid',
    alignment: 'Unaligned',
    cr: '1',
    ac: 12,
    hpMax: 20,
    hpDice: '',
    speed: '30 ft.',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saveProficiencies: [],
    proficiencyBonus: 2,
    initiativeMod: 0,
    skills: '',
    senses: '',
    languages: '',
    resistances: '',
    vulnerabilities: '',
    immunities: '',
    conditionImmunities: '',
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryActions: [],
    legendaryUses: 0,
    basedOn: '',
    createdAt: now,
    updatedAt: now,
  };
}

/** An editable copy of any library monster. Numbers the source does not print are left at defaults. */
export function customFromLibrary(m: LibraryMonster, id: string, now: number): DmCustomMonster {
  const base = blankCustomMonster(id, now);
  const scores = { ...base.abilities, ...m.abilities };
  const dexMod = abilityModifier(scores.dex);
  return {
    ...base,
    name: m.origin === 'custom' ? `${m.name} (copy)` : m.name,
    size: m.size || base.size,
    creatureType: typeOf(m) || base.creatureType,
    alignment: m.alignment || base.alignment,
    cr: m.cr ?? base.cr,
    ac: m.ac ?? base.ac,
    hpMax: m.hpAverage ?? base.hpMax,
    hpDice: m.hpDice,
    speed: m.speed,
    abilities: scores,
    saveProficiencies: ABILITY_KEYS.filter((a) => m.saves[a] !== undefined),
    proficiencyBonus: m.proficiencyBonus ?? base.proficiencyBonus,
    initiativeMod: m.initiativeMod ?? dexMod,
    skills: m.skills,
    senses: m.senses,
    languages: m.languages,
    resistances: m.resistances,
    vulnerabilities: m.vulnerabilities,
    immunities: m.immunities,
    conditionImmunities: m.conditionImmunities,
    traits: m.traits.map((e) => ({ ...e })),
    actions: m.actions.map((e) => ({ ...e })),
    bonusActions: m.bonusActions.map((e) => ({ ...e })),
    reactions: m.reactions.map((e) => ({ ...e })),
    legendaryActions: m.legendaryActions.map((e) => ({ ...e })),
    legendaryUses: m.legendaryUses,
    basedOn: m.origin === 'custom' ? (m.basedOn ?? '') : `Copy of ${m.name} (${m.source})`,
  };
}

export function saveCustomMonster(data: DmData, monster: DmCustomMonster, now: number): DmData {
  const next = { ...monster, updatedAt: now };
  const exists = data.customMonsters.some((m) => m.id === monster.id);
  return {
    ...data,
    customMonsters: exists
      ? data.customMonsters.map((m) => (m.id === monster.id ? next : m))
      : [...data.customMonsters, next],
  };
}

export function deleteCustomMonster(data: DmData, id: string): DmData {
  return { ...data, customMonsters: data.customMonsters.filter((m) => m.id !== id) };
}

// ------------------------------------------------------- into an encounter

/** A fresh combatant for a library monster, or undefined when it has no fixed Armor Class or Hit Points. */
export function combatantFromLibrary(m: LibraryMonster, id: string): DmCombatant | undefined {
  if (m.origin === 'npc') {
    const t = NPC_TEMPLATE_LIST.find((x) => `npc:${x.id}` === m.key);
    return t ? combatantFromTemplate(t, id) : undefined;
  }
  if (m.origin === 'creature') {
    const c = CREATURE_LIST.find((x) => `creature:${x.id}` === m.key);
    return c ? combatantFromCreature(c, id) : undefined;
  }
  if (m.ac === null || m.hpAverage === null) return undefined;
  const base = customCombatant(id, {
    name: m.name,
    ac: m.ac,
    hpMax: m.hpAverage,
    initiativeMod: m.initiativeMod ?? 0,
    resistances: m.resistances,
    vulnerabilities: m.vulnerabilities,
    immunities: m.immunities,
    conSaveMod: m.conSaveMod ?? undefined,
    cr: m.cr ?? undefined,
    xp: m.xp ?? xpForCr(m.cr) ?? undefined,
  });
  base.sourceLabel = `${m.name} (custom)`;
  if (m.legendaryUses > 0) base.legendary = { max: m.legendaryUses, used: 0 };
  return base;
}
