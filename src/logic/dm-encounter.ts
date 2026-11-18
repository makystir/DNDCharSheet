/**
 * Pure logic for the Dungeon Master's encounter runner.
 *
 * Hit Points, damage, healing, Temporary Hit Points and Death Saving Throws
 * reuse the player sheet's rules (logic/hit-points-state.ts), so a monster and
 * a player character lose Hit Points the same way. Concentration DCs reuse
 * logic/concentration.ts. Nothing here rolls on its own: functions that need a
 * die take an RNG.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md):
 *  - Initiative (L870-878): everyone rolls a Dexterity check; surprised
 *    combatants have Disadvantage; the DM makes one roll for a group of
 *    identical creatures; highest goes first and the order stays the same each
 *    round. Ties: the DM decides among monsters, players among their
 *    characters, and the DM decides between a monster and a player character.
 *    This module keeps the order as a list the DM can reorder, so a tie is
 *    whatever order the list is in.
 *  - Monster Death (L1141): a monster dies the instant it drops to 0 Hit Points,
 *    though the DM can treat an individual monster like a character
 *    (`diesLikeCharacter`).
 *  - Concentration (L20767-20777): damage forces a Constitution save, and
 *    Concentration ends when the creature is Incapacitated or dies.
 *    Unconscious (at 0 HP) implies Incapacitated, so Concentration ends then too.
 *  - A round is about 6 seconds (L863). The PHB gives conditions no generic
 *    duration (L1210-1212), so the countdown here is bookkeeping: timed
 *    conditions lose one round when a new round begins and are removed at 0.
 */
import type {
  DmCampaign,
  DmCombatCondition,
  DmCombatant,
  DmCustomMonster,
  DmData,
  DmEncounter,
  DmPartyMember,
} from '../types/dm';
import type { Ability } from '../types/character';
import { DAMAGE_TYPES, type DamageType } from '../data/damage-types';
import { CREATURE_LIST, type CreatureStatBlock } from '../data/creatures';
import type { NpcTemplate } from '../data/npc-templates';
import type { MonsterManual2024Entry } from '../data/monster-manual-2024';
import type { ConditionId } from '../data/conditions';
import { getCondition } from '../data/conditions';
import { abilityModifier } from './abilities';
import { xpForCr } from './dm-balance';
import { concentrationCheck } from './concentration';
import { rollD20, type D20Mode } from './dice';
import {
  applyDamage,
  applyHealing,
  deathSaveAdvance,
  deathSaveOutcome,
  grantTempHp,
  hpStateOf,
  type DamageRequest,
  type DamageResult,
  type HpState,
  type TempHpChoice,
} from './hit-points-state';
import { characterInitiativeModifier } from './initiative-roll';
import { allSavingThrowBreakdowns } from './saving-throws';
import { memberStats } from './dm-campaign';
import type { RNG } from './random';
import type { Breakdown } from './breakdown';

export const MAX_LOG_LINES = 200;
export const MAX_COMBATANTS = 60;

const NO_SAVES = { successes: 0, failures: 0 };

// ------------------------------------------------------------- library keys

/** Stable library key for a Monster Manual 2024 creature (names are unique in monsters.json). */
export function monsterManualKey(name: string): string {
  return `monster-manual:${name}`;
}

export const CUSTOM_KEY_PREFIX = 'custom:';
/** Longest libraryKey kept by the sanitizer. */
export const LIBRARY_KEY_MAX = 120;

/** The custom monster id inside a custom:<id> library key, or undefined for any other key. */
export function customIdOfKey(key: string | undefined): string | undefined {
  return key !== undefined && key.startsWith(CUSTOM_KEY_PREFIX) && key.length > CUSTOM_KEY_PREFIX.length
    ? key.slice(CUSTOM_KEY_PREFIX.length)
    : undefined;
}

/**
 * The only way snapshots are read: own properties only, so ids such as constructor, 	oString or
 * __proto__ never return inherited values.
 */
export function ownSnapshot(
  snapshots: Record<string, DmCustomMonster> | undefined,
  id: string,
): DmCustomMonster | undefined {
  return snapshots !== undefined && Object.prototype.hasOwnProperty.call(snapshots, id) ? snapshots[id] : undefined;
}

/** Keep only the snapshots some combatant still references; undefined when none remain. */
function pruneSnapshots(
  snapshots: Record<string, DmCustomMonster> | undefined,
  combatants: readonly DmCombatant[],
): Record<string, DmCustomMonster> | undefined {
  if (snapshots === undefined) return undefined;
  const used = new Set<string>();
  for (const c of combatants) {
    const id = customIdOfKey(c.libraryKey);
    if (id !== undefined) used.add(id);
  }
  const kept: [string, DmCustomMonster][] = [];
  for (const id of used) {
    const s = ownSnapshot(snapshots, id);
    if (s) kept.push([id, s]);
  }
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

// ------------------------------------------------------------------ helpers

/** Damage types named in free text ("Fire; Poison", "Bludgeoning, Piercing, and Slashing"). */
export function parseDamageTypes(text: string): DamageType[] {
  const lower = text.toLowerCase();
  return DAMAGE_TYPES.filter((t) => lower.includes(t.toLowerCase()));
}

function monsterHp(max: number): HpState {
  const m = Math.max(1, Math.trunc(Number.isFinite(max) ? max : 1));
  return { max: m, hp: m, temp: 0, deathSaves: NO_SAVES, stable: false, dead: false };
}

function blank(
  id: string,
  name: string,
  kind: DmCombatant['kind'],
  sourceLabel: string,
  ac: number,
  hp: HpState,
  initiativeMod: number,
): DmCombatant {
  return {
    id,
    name,
    kind,
    sourceLabel,
    ac,
    hp,
    initiative: null,
    initiativeMod,
    surprised: false,
    resistances: '',
    vulnerabilities: '',
    immunities: '',
    conditions: [],
    concentration: { active: false, label: '' },
    concentrationDcs: [],
    diesLikeCharacter: false,
    notes: '',
  };
}

function withLog(enc: DmEncounter, ...lines: string[]): DmEncounter {
  if (lines.length === 0) return enc;
  return { ...enc, log: [...enc.log, ...lines].slice(-MAX_LOG_LINES) };
}

function mapCombatant(enc: DmEncounter, id: string, fn: (c: DmCombatant) => DmCombatant): DmEncounter {
  return { ...enc, combatants: enc.combatants.map((c) => (c.id === id ? fn(c) : c)) };
}

export function findCombatant(enc: DmEncounter, id: string): DmCombatant | undefined {
  return enc.combatants.find((c) => c.id === id);
}

/** Out of the fight: a dead combatant takes no turns. */
export function isOut(c: DmCombatant): boolean {
  return c.hp.dead;
}

/** At 0 Hit Points and not dead (a player character making Death Saving Throws, or Stable). */
export function isDown(c: DmCombatant): boolean {
  return !c.hp.dead && c.hp.hp <= 0;
}

// ------------------------------------------------------- building combatants

export function combatantFromMember(member: DmPartyMember, id: string): DmCombatant | undefined {
  const stats = memberStats(member);
  if (!stats) return undefined;
  const fromSheet = member.character ? hpStateOf(member.character) : undefined;
  const hp: HpState =
    fromSheet ??
    (stats.hp
      ? {
          max: Math.max(1, stats.hp.max.total),
          hp: Math.min(Math.max(0, stats.hp.current), Math.max(1, stats.hp.max.total)),
          temp: stats.hp.temp,
          deathSaves: NO_SAVES,
          stable: false,
          dead: false,
        }
      : monsterHp(1));
  const c = blank(
    id,
    member.name,
    'pc',
    'Party member',
    stats.ac.total,
    hp,
    member.character ? characterInitiativeModifier(member.character).total : 0,
  );
  c.memberId = member.id;
  if (member.character) c.conSaveMod = allSavingThrowBreakdowns(member.character).con.total;
  return c;
}

export function combatantFromTemplate(t: NpcTemplate, id: string, name?: string): DmCombatant {
  const s = t.stats;
  const c = blank(
    id,
    name ?? t.name,
    'monster',
    `${t.name} (Monster Manual 2024, p.${t.page})`,
    s.ac ?? 10,
    monsterHp(s.hpMax ?? 1),
    s.initiativeMod ?? 0,
  );
  c.resistances = s.resistances ?? '';
  c.vulnerabilities = s.vulnerabilities ?? '';
  c.libraryKey = `npc:${t.id}`;
  c.immunities = s.immunities ?? '';
  if (s.cr) c.cr = s.cr;
  const templateXp = s.xp ?? xpForCr(s.cr);
  if (templateXp !== null && templateXp !== undefined) c.xp = templateXp;
  const con = s.abilities?.con;
  if (con !== undefined) {
    const proficient = (s.saveProficiencies ?? []).includes('con' as Ability);
    c.conSaveMod = abilityModifier(con) + (proficient ? (s.proficiencyBonus ?? 0) : 0);
  }
  return c;
}

/**
 * A combatant from a `monsters.json` (Monster Manual 2024) creature. Numbers
 * are the printed ones; Legendary Action uses come from the stat block
 * ("Legendary Action Uses: 3 (4 in Lair)", Monster Manual 2024).
 */
export function combatantFromMonsterManual(e: MonsterManual2024Entry, id: string, name?: string): DmCombatant {
  const c = blank(
    id,
    name ?? e.name,
    'monster',
    `${e.name} (Monster Manual 2024, p.${e.page})`,
    e.ac,
    monsterHp(e.hp.avg),
    e.initiative.mod,
  );
  c.resistances = (e.resistances ?? []).join('; ');
  c.vulnerabilities = (e.vulnerabilities ?? []).join('; ');
  c.immunities = (e.damageImmunities ?? []).join('; ');
  c.libraryKey = monsterManualKey(e.name);
  c.cr = e.cr;
  c.xp = e.xp;
  c.conSaveMod = e.abilities.con.save;
  // MM 2024 p.9 "Legendary Actions" (How to Use a Monster): the number of uses "is specified in the
  // stat block". It is read from the stat block's `legendaryActionUses` (monsters.json) and never
  // assumed; a creature whose entry carries no count gets no legendary tracker. The in-lair count
  // ("Legendary Action Uses: 3 (4 in Lair)") is `legendaryActionUses.inLair`.
  const uses = e.legendaryActionUses;
  if (e.legendaryActions.length > 0 && uses) {
    c.legendary = { max: uses.normal, used: 0 };
    if (uses.inLair !== undefined && uses.inLair !== uses.normal) {
      c.legendaryLair = { normal: uses.normal, inLair: uses.inLair, active: false };
    }
  }
  return c;
}

/** Library creatures with a fixed Armor Class and printed average Hit Points. */
export function usableCreatures(): CreatureStatBlock[] {
  return CREATURE_LIST.filter(
    (c) => typeof c.ac === 'number' && 'average' in c.hp && typeof c.hp.average === 'number' && c.hp.average > 0,
  );
}

export function combatantFromCreature(cr: CreatureStatBlock, id: string, name?: string): DmCombatant | undefined {
  if (typeof cr.ac !== 'number' || !('average' in cr.hp) || typeof cr.hp.average !== 'number') return undefined;
  const c = blank(
    id,
    name ?? cr.name,
    'monster',
    cr.source.printedPage !== undefined
      ? `${cr.name} (${cr.source.book}, p.${cr.source.printedPage})`
      : `${cr.name} (${cr.source.book})`,
    cr.ac,
    monsterHp(cr.hp.average),
    cr.initiative?.modifier ?? cr.abilities.dex.mod ?? 0,
  );
  c.resistances = cr.damageResistances.join('; ');
  c.vulnerabilities = cr.damageVulnerabilities.join('; ');
  c.libraryKey = `creature:${cr.id}`;
  c.immunities = cr.damageImmunities.join('; ');
  if (cr.challenge.cr) c.cr = cr.challenge.cr;
  const creatureXp = cr.challenge.xp ?? xpForCr(cr.challenge.cr);
  if (creatureXp !== null) c.xp = creatureXp;
  if (cr.abilities.con.save !== null) c.conSaveMod = cr.abilities.con.save;
  return c;
}

export interface CustomCombatantInput {
  name: string;
  ac: number;
  hpMax: number;
  initiativeMod: number;
  resistances?: string;
  vulnerabilities?: string;
  immunities?: string;
  conSaveMod?: number;
  /** Challenge Rating and XP, when the DM knows them. */
  cr?: string;
  xp?: number;
}

export function customCombatant(id: string, input: CustomCombatantInput): DmCombatant {
  const int = (n: number, min: number, max: number) =>
    Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : min;
  const c = blank(
    id,
    input.name.trim().slice(0, 60) || 'Creature',
    'monster',
    'Custom',
    int(input.ac, 0, 40),
    monsterHp(int(input.hpMax, 1, 9999)),
    int(input.initiativeMod, -10, 30),
  );
  c.resistances = (input.resistances ?? '').slice(0, 200);
  c.vulnerabilities = (input.vulnerabilities ?? '').slice(0, 200);
  c.immunities = (input.immunities ?? '').slice(0, 200);
  if (input.conSaveMod !== undefined && Number.isFinite(input.conSaveMod)) c.conSaveMod = int(input.conSaveMod, -10, 30);
  if (input.cr && input.cr.trim()) c.cr = input.cr.trim().slice(0, 8);
  if (input.xp !== undefined && Number.isFinite(input.xp)) c.xp = int(input.xp, 0, 1000000);
  return c;
}

/** Turn the how-many box text into a copy count between 1 and the encounter cap. */
export function parseCopyCount(raw: string | number): number {
  return Math.min(MAX_COMBATANTS, Math.max(1, Math.trunc(Number(raw)) || 1));
}

/**
 * Make `count` copies of a combatant: numbered names ("Goblin 1", "Goblin 2")
 * and, for more than one, a shared group so they roll Initiative once (PHB
 * "Initiative", L870).
 */
export function makeCopies(
  base: DmCombatant,
  count: number,
  newId: () => string,
  groupInitiative: boolean,
): DmCombatant[] {
  const n = Math.min(MAX_COMBATANTS, Math.max(1, Math.trunc(count)));
  if (n === 1) return [{ ...base, id: newId() }];
  const groupId = groupInitiative ? newId() : undefined;
  return Array.from({ length: n }, (_, i) => ({
    ...base,
    id: newId(),
    name: `${base.name} ${i + 1}`,
    groupId,
    hp: { ...base.hp },
    conditions: [...base.conditions],
    concentration: { ...base.concentration },
    concentrationDcs: [...base.concentrationDcs],
    legendary: base.legendary ? { ...base.legendary } : undefined,
    legendaryLair: base.legendaryLair ? { ...base.legendaryLair } : undefined,
  }));
}

// ---------------------------------------------------------------- encounters

export function createEncounter(id: string, name: string, now: number): DmEncounter {
  return {
    id,
    name: name.trim().slice(0, 80) || 'New encounter',
    status: 'setup',
    round: 0,
    activeId: null,
    combatants: [],
    log: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Add combatants. For any that came from a custom monster, a copy of that monster in customMonsters is stored
 * on the encounter the first time it is used and never replaced (first add wins), so later edits or deletes
 * in the library do not change the stat block of a fight in progress.
 */
export function addCombatants(
  enc: DmEncounter,
  list: DmCombatant[],
  customMonsters: readonly DmCustomMonster[] = [],
): DmEncounter {
  if (enc.status === 'ended') return enc;
  const room = Math.max(0, MAX_COMBATANTS - enc.combatants.length);
  const incoming = list.slice(0, room);
  if (incoming.length === 0) return enc;
  let combatants = [...enc.combatants];
  for (const c of incoming) {
    if (enc.status === 'running' && c.initiative !== null) {
      // Insert before the first combatant that acts later (lower Initiative).
      const at = combatants.findIndex((o) => o.initiative !== null && o.initiative < (c.initiative as number));
      combatants.splice(at === -1 ? combatants.length : at, 0, c);
    } else {
      combatants.push(c);
    }
  }
  combatants = combatants.slice(0, MAX_COMBATANTS);
  let snapshots = enc.customMonsterSnapshots;
  for (const c of incoming) {
    const id = customIdOfKey(c.libraryKey);
    if (id === undefined || ownSnapshot(snapshots, id) !== undefined) continue;
    const live = customMonsters.find((m) => m.id === id);
    if (live) snapshots = { ...snapshots, [id]: structuredClone(live) };
  }
  return withLog(
    { ...enc, combatants, ...(snapshots !== undefined ? { customMonsterSnapshots: snapshots } : {}) },
    `${incoming.map((c) => c.name).join(', ')} joined the encounter.`);
}

export function removeCombatant(enc: DmEncounter, id: string): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c) return enc;
  let activeId = enc.activeId;
  if (activeId === id) {
    // Hand the turn to whoever came next.
    const idx = enc.combatants.findIndex((x) => x.id === id);
    const rest = enc.combatants.filter((x) => x.id !== id);
    activeId = rest.length === 0 ? null : rest[Math.min(idx, rest.length - 1)].id;
  }
  const combatants = enc.combatants.filter((x) => x.id !== id);
  const snapshots = pruneSnapshots(enc.customMonsterSnapshots, combatants);
  const { customMonsterSnapshots: _before, ...rest } = enc;
  void _before;
  return withLog(
    { ...rest, combatants, activeId, ...(snapshots !== undefined ? { customMonsterSnapshots: snapshots } : {}) },
    `${c.name} left the encounter.`,
  );
}

/**
 * Put a removed combatant back (undo for removeCombatant), at its old position or the end if the list
 * has shrunk. `before` is the encounter as it was when the combatant was removed: it supplies the turn
 * pointer and the custom-monster snapshot the removal pruned. Does nothing if the combatant is already
 * back, the fight has ended, or the encounter is full.
 */
export function restoreCombatant(enc: DmEncounter, removed: DmCombatant, index: number, before: DmEncounter): DmEncounter {
  if (enc.status === 'ended' || enc.combatants.some((c) => c.id === removed.id) || enc.combatants.length >= MAX_COMBATANTS) {
    return enc;
  }
  const combatants = [...enc.combatants];
  combatants.splice(Math.max(0, Math.min(index, combatants.length)), 0, removed);
  let snapshots = enc.customMonsterSnapshots;
  const customId = customIdOfKey(removed.libraryKey);
  const snap = customId !== undefined ? ownSnapshot(before.customMonsterSnapshots, customId) : undefined;
  if (customId !== undefined && snap !== undefined && ownSnapshot(snapshots, customId) === undefined) {
    snapshots = { ...snapshots, [customId]: snap };
  }
  const activeId = before.activeId === removed.id ? removed.id : enc.activeId;
  return withLog(
    { ...enc, combatants, activeId, ...(snapshots !== undefined ? { customMonsterSnapshots: snapshots } : {}) },
    `${removed.name} returned to the encounter.`,
  );
}

export function renameCombatant(enc: DmEncounter, id: string, name: string): DmEncounter {
  const clean = name.trim().slice(0, 60);
  return clean === '' ? enc : mapCombatant(enc, id, (c) => ({ ...c, name: clean }));
}

export function updateCombatant(enc: DmEncounter, id: string, patch: Partial<DmCombatant>): DmEncounter {
  return mapCombatant(enc, id, (c) => ({ ...c, ...patch, id: c.id }));
}

export function moveCombatant(enc: DmEncounter, id: string, dir: -1 | 1): DmEncounter {
  const i = enc.combatants.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= enc.combatants.length) return enc;
  const list = [...enc.combatants];
  [list[i], list[j]] = [list[j], list[i]];
  return { ...enc, combatants: list };
}

// ---------------------------------------------------------------- initiative

export function setInitiative(enc: DmEncounter, id: string, value: number | null): DmEncounter {
  const v = value === null || !Number.isFinite(value) ? null : Math.max(-20, Math.min(60, Math.trunc(value)));
  return mapCombatant(enc, id, (c) => ({ ...c, initiative: v }));
}

export interface InitiativeRollOptions {
  /** Which combatants to roll for. Default: everyone without an Initiative. */
  ids?: string[];
  /** Roll even when an Initiative is already set. */
  reroll?: boolean;
  /** Roll only monsters (the DM rolls for monsters; players roll their own). */
  monstersOnly?: boolean;
}

/**
 * Roll Initiative: d20 + modifier, Disadvantage when surprised. A group rolls
 * once, using its first member's modifier and surprise (PHB L870).
 */
export function rollInitiatives(enc: DmEncounter, rng: RNG, options: InitiativeRollOptions = {}): DmEncounter {
  const wanted = new Set(options.ids ?? enc.combatants.map((c) => c.id));
  const targets = enc.combatants.filter(
    (c) =>
      wanted.has(c.id) &&
      (options.reroll === true || c.initiative === null) &&
      (options.monstersOnly !== true || c.kind === 'monster'),
  );
  const groupRolls = new Map<string, number>();
  const rolled = new Map<string, number>();
  const lines: string[] = [];
  for (const c of targets) {
    if (c.groupId && groupRolls.has(c.groupId)) {
      rolled.set(c.id, groupRolls.get(c.groupId) as number);
      continue;
    }
    const mode: D20Mode = c.surprised ? 'disadvantage' : 'normal';
    const total = rollD20(rng, mode).used + c.initiativeMod;
    rolled.set(c.id, total);
    if (c.groupId) groupRolls.set(c.groupId, total);
    lines.push(`${c.groupId ? `${c.name.replace(/ \d+$/, '')} (group)` : c.name} rolled Initiative ${total}.`);
  }
  if (rolled.size === 0) return enc;
  return withLog(
    { ...enc, combatants: enc.combatants.map((c) => (rolled.has(c.id) ? { ...c, initiative: rolled.get(c.id) as number } : c)) },
    ...lines,
  );
}

/** Highest Initiative first. Ties and unrolled combatants keep their current order. */
export function sortByInitiative(enc: DmEncounter): DmEncounter {
  const indexed = enc.combatants.map((c, i) => ({ c, i }));
  indexed.sort((a, b) => {
    const ai = a.c.initiative ?? Number.NEGATIVE_INFINITY;
    const bi = b.c.initiative ?? Number.NEGATIVE_INFINITY;
    if (ai !== bi) return bi - ai;
    return a.i - b.i;
  });
  return { ...enc, combatants: indexed.map((x) => x.c) };
}

export function combatantsMissingInitiative(enc: DmEncounter): DmCombatant[] {
  return enc.combatants.filter((c) => c.initiative === null);
}

export type StartResult = { ok: true; encounter: DmEncounter } | { ok: false; error: string };

export function startEncounter(enc: DmEncounter): StartResult {
  if (enc.status !== 'setup') return { ok: false, error: 'This encounter has already started.' };
  if (enc.combatants.length === 0) return { ok: false, error: 'Add at least one combatant first.' };
  const missing = combatantsMissingInitiative(enc);
  if (missing.length > 0) {
    return { ok: false, error: `Set Initiative for: ${missing.map((c) => c.name).join(', ')}.` };
  }
  const sorted = sortByInitiative(enc);
  const first = sorted.combatants.find((c) => !isOut(c));
  return {
    ok: true,
    encounter: withLog(
      { ...sorted, status: 'running', round: 1, activeId: first?.id ?? null },
      'Combat begins. Round 1.',
      ...(first ? [`${first.name}'s turn.`] : []),
    ),
  };
}

// --------------------------------------------------------------------- turns

function tickConditions(enc: DmEncounter): DmEncounter {
  const lines: string[] = [];
  const combatants = enc.combatants.map((c) => {
    if (c.conditions.every((x) => x.rounds === undefined)) return c;
    const next: DmCombatCondition[] = [];
    for (const cond of c.conditions) {
      if (cond.rounds === undefined) {
        next.push(cond);
      } else if (cond.rounds - 1 >= 1) {
        next.push({ ...cond, rounds: cond.rounds - 1 });
      } else {
        lines.push(`${c.name} is no longer ${getCondition(cond.id)?.name ?? cond.id}.`);
      }
    }
    return { ...c, conditions: next };
  });
  return withLog({ ...enc, combatants }, ...lines);
}

/** A legendary-action user regains every expended use at the start of its own turn (MM 2024 "Legendary Actions", L566). */
function refillLegendary(enc: DmEncounter, id: string): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c?.legendary || c.legendary.used === 0) return enc;
  return mapCombatant(enc, id, (x) => ({ ...x, legendary: x.legendary ? { ...x.legendary, used: 0 } : undefined }));
}

/** Pass the turn to the next combatant who is not dead. A new round starts after the last one. */
export function nextTurn(enc: DmEncounter): DmEncounter {
  if (enc.status !== 'running') return enc;
  const n = enc.combatants.length;
  const start = enc.combatants.findIndex((c) => c.id === enc.activeId);
  for (let step = 1; step <= n; step++) {
    const idx = (start + step + n) % n;
    const c = enc.combatants[idx];
    if (isOut(c)) continue;
    const wrapped = start >= 0 && start + step >= n;
    let next: DmEncounter = { ...enc, activeId: c.id };
    if (wrapped) {
      next = withLog(tickConditions({ ...next, round: enc.round + 1 }), `Round ${enc.round + 1}.`);
    }
    return withLog(refillLegendary(next, c.id), `${c.name}'s turn.`);
  }
  return enc;
}

/** Step back one turn (a mis-click). Conditions that already ticked are not restored. */
export function previousTurn(enc: DmEncounter): DmEncounter {
  if (enc.status !== 'running') return enc;
  const n = enc.combatants.length;
  const start = enc.combatants.findIndex((c) => c.id === enc.activeId);
  if (start < 0) return enc;
  for (let step = 1; step <= n; step++) {
    const idx = (start - step + n * 2) % n;
    const c = enc.combatants[idx];
    if (isOut(c)) continue;
    const wrapped = start - step < 0;
    if (wrapped && enc.round <= 1) return enc;
    return withLog({ ...enc, activeId: c.id, round: wrapped ? enc.round - 1 : enc.round }, `Back to ${c.name}'s turn.`);
  }
  return enc;
}

/**
 * A plain-text account of a fight for the session note: a heading, who was left
 * standing and who was down, then the combat log in order. The log keeps at most
 * `MAX_LOG_LINES` lines, so a long fight's earliest lines may already be gone.
 */
export function combatSummaryText(enc: DmEncounter): string {
  const rounds = Math.max(1, enc.round);
  const standing = enc.combatants.filter((c) => !isOut(c)).map((c) => c.name);
  const down = enc.combatants.filter((c) => isOut(c)).map((c) => c.name);
  const lines = [
    `Combat: ${enc.name} (${rounds} ${rounds === 1 ? 'round' : 'rounds'}).`,
    `Still standing: ${standing.length === 0 ? 'nobody' : standing.join(', ')}.`,
  ];
  if (down.length > 0) lines.push(`Down for good: ${down.join(', ')}.`);
  if (enc.log.length > 0) lines.push('', 'Combat log:', ...enc.log.map((l) => `- ${l}`));
  return lines.join('\n');
}

export function endEncounter(enc: DmEncounter, now: number): DmEncounter {
  if (enc.status === 'ended') return enc;
  return withLog({ ...enc, status: 'ended', activeId: null, updatedAt: now }, `Combat ends after round ${Math.max(1, enc.round)}.`);
}

// ------------------------------------------------------------ hit points

export interface DamageOutcome {
  encounter: DmEncounter;
  result: DamageResult;
  /** Set when a concentrating combatant must save. */
  concentrationDc: number | null;
  concentrationBreakdown: Breakdown | null;
}

function describeDamage(name: string, result: DamageResult, died: boolean): string {
  if (result.damageDealt === 0) return `${name} takes no damage.`;
  const parts = [`${name} takes ${result.damageDealt} damage`];
  if (result.tempAbsorbed > 0) parts.push(`(${result.tempAbsorbed} absorbed by Temp HP)`);
  const tail = died ? ' and dies.' : result.next.hp === 0 ? ' and drops to 0 HP.' : `. ${result.next.hp}/${result.next.max} HP.`;
  return `${parts.join(' ')}${tail}`;
}

/** Apply one instance of damage. A monster dies at 0 HP unless the DM treats it like a character. */
export function dealDamage(enc: DmEncounter, id: string, request: DamageRequest): DamageOutcome | undefined {
  const c = findCombatant(enc, id);
  if (!c || c.hp.dead) return undefined;
  const result = applyDamage(c.hp, request);
  let hp = result.next;
  const monsterDies = c.kind === 'monster' && !c.diesLikeCharacter && hp.hp === 0 && !hp.dead;
  if (monsterDies) hp = { ...hp, dead: true };
  const lostActionable = hp.dead || hp.hp === 0; // at 0 HP a creature is Unconscious, hence Incapacitated

  let concentration = c.concentration;
  let dcs = c.concentrationDcs;
  let check: ReturnType<typeof concentrationCheck> | null = null;
  const lines: string[] = [describeDamage(c.name, result, hp.dead)];
  if (c.concentration.active) {
    if (lostActionable) {
      concentration = { active: false, label: '' };
      dcs = [];
      lines.push(`${c.name} loses Concentration${c.concentration.label ? ` on ${c.concentration.label}` : ''}.`);
    } else if (result.tookDamage) {
      check = concentrationCheck(result.damageDealt);
      if (check.required && check.dc !== undefined) {
        dcs = [...dcs, check.dc];
        lines.push(`${c.name} must make a Constitution save to keep Concentration (DC ${check.dc}).`);
      }
    }
  }
  const encounter = withLog(
    mapCombatant(enc, id, (x) => ({ ...x, hp, concentration, concentrationDcs: dcs })),
    ...lines,
  );
  return {
    encounter,
    result,
    concentrationDc: check?.required ? (check.dc ?? null) : null,
    concentrationBreakdown: check?.breakdown ?? null,
  };
}

export function healCombatant(enc: DmEncounter, id: string, amount: number): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c) return enc;
  const { next, regained } = applyHealing(c.hp, amount);
  if (regained === 0) return enc;
  return withLog(mapCombatant(enc, id, (x) => ({ ...x, hp: next })), `${c.name} regains ${regained} HP (${next.hp}/${next.max}).`);
}

export function giveTempHp(enc: DmEncounter, id: string, amount: number, choice?: TempHpChoice): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c || c.hp.dead) return enc;
  const temp = grantTempHp(c.hp.temp, amount, choice);
  if (temp === c.hp.temp) return enc;
  return withLog(mapCombatant(enc, id, (x) => ({ ...x, hp: { ...x.hp, temp } })), `${c.name} has ${temp} Temp HP.`);
}

/** Record a Death Saving Throw from a raw d20 (1..20). Only for a combatant at 0 HP who is not Stable or dead. */
export function recordDeathSave(enc: DmEncounter, id: string, d20: number): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c || !isDown(c) || c.hp.stable) return enc;
  if (!Number.isInteger(d20) || d20 < 1 || d20 > 20) return enc;
  const roll = deathSaveOutcome(d20, 0);
  const adv = deathSaveAdvance(c.hp.deathSaves, roll.outcome);
  const hp: HpState = { ...c.hp, deathSaves: adv.saves, stable: adv.stable, dead: adv.dead, hp: adv.hp };
  const text = adv.dead
    ? `${c.name} fails a third Death Saving Throw and dies.`
    : adv.hp > 0
      ? `${c.name} rolls a natural 20 and regains 1 HP.`
      : adv.stable
        ? `${c.name} is Stable.`
        : `${c.name} ${roll.failuresAdded > 0 ? 'fails' : 'succeeds on'} a Death Saving Throw (${adv.saves.successes} successes, ${adv.saves.failures} failures).`;
  return withLog(mapCombatant(enc, id, (x) => ({ ...x, hp })), text);
}

export function stabilizeCombatant(enc: DmEncounter, id: string): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c || !isDown(c) || c.hp.stable) return enc;
  return withLog(
    mapCombatant(enc, id, (x) => ({ ...x, hp: { ...x.hp, stable: true, deathSaves: NO_SAVES } })),
    `${c.name} is Stable.`,
  );
}

/** Bring a dead or downed combatant back with the given Hit Points. */
export function reviveCombatant(enc: DmEncounter, id: string, hpValue: number): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c) return enc;
  const hp = Math.min(c.hp.max, Math.max(1, Math.trunc(Number.isFinite(hpValue) ? hpValue : 1)));
  return withLog(
    mapCombatant(enc, id, (x) => ({ ...x, hp: { ...x.hp, hp, dead: false, stable: false, deathSaves: NO_SAVES } })),
    `${c.name} is back on ${hp} HP.`,
  );
}

// -------------------------------------------------------------- conditions

export function addCondition(
  enc: DmEncounter,
  id: string,
  condition: Exclude<ConditionId, 'exhaustion'>,
  rounds?: number,
): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c) return enc;
  const r = rounds !== undefined && Number.isInteger(rounds) && rounds >= 1 ? Math.min(rounds, 99999) : undefined;
  const entry: DmCombatCondition = r === undefined ? { id: condition } : { id: condition, rounds: r };
  const others = c.conditions.filter((x) => x.id !== condition);
  const name = getCondition(condition)?.name ?? condition;
  return withLog(
    mapCombatant(enc, id, (x) => ({ ...x, conditions: [...others, entry] })),
    `${c.name} is ${name}${r ? ` for ${r} ${r === 1 ? 'round' : 'rounds'}` : ''}.`,
  );
}

export function removeCondition(enc: DmEncounter, id: string, condition: DmCombatCondition['id']): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c || !c.conditions.some((x) => x.id === condition)) return enc;
  return withLog(
    mapCombatant(enc, id, (x) => ({ ...x, conditions: x.conditions.filter((y) => y.id !== condition) })),
    `${c.name} is no longer ${getCondition(condition)?.name ?? condition}.`,
  );
}

// ------------------------------------------------------- legendary actions

function isIncapacitated(c: DmCombatant): boolean {
  return c.conditions.some(
    (x) => x.id === 'incapacitated' || (getCondition(x.id)?.implies ?? []).includes('incapacitated'),
  );
}

/**
 * Whether a legendary action can be taken now. MM 2024 "Legendary Actions"
 * (Docs L564-566): one at a time, only after another creature's turn, none
 * while Incapacitated; each use is expended and all come back at the start of
 * the monster's own turn. At 0 Hit Points a creature is Unconscious, hence
 * Incapacitated.
 */
export function canTakeLegendary(c: DmCombatant): boolean {
  return c.legendary !== undefined && c.legendary.used < c.legendary.max && !isOut(c) && !isDown(c) && !isIncapacitated(c);
}

export function spendLegendaryAction(enc: DmEncounter, id: string): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c?.legendary || !canTakeLegendary(c)) return enc;
  const used = c.legendary.used + 1;
  const max = c.legendary.max;
  return withLog(
    mapCombatant(enc, id, (x) => ({ ...x, legendary: { max, used } })),
    `${c.name} uses a legendary action (${used}/${max}).`,
  );
}

export function resetLegendary(enc: DmEncounter, id: string): DmEncounter {
  return refillLegendary(enc, id);
}

/**
 * Switch a creature between its normal and in-lair Legendary Action uses. Both
 * numbers are the ones printed in the stat block ("3 (4 in Lair)", MM 2024
 * `legendaryActionUses`). Does nothing for a creature that prints no in-lair count.
 */
export function setLegendaryInLair(enc: DmEncounter, id: string, active: boolean): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c?.legendary || !c.legendaryLair || c.legendaryLair.active === active) return enc;
  const lair = c.legendaryLair;
  const max = active ? lair.inLair : lair.normal;
  return withLog(
    mapCombatant(enc, id, (x) => ({
      ...x,
      legendary: { max, used: Math.min(c.legendary?.used ?? 0, max) },
      legendaryLair: { ...lair, active },
    })),
    `${c.name} ${active ? 'is now in its lair' : 'is no longer in its lair'} (${max} legendary action uses).`,
  );
}

// ------------------------------------------------------------- duplication

/** A combatant as it starts a fresh fight: full Hit Points, no conditions, nothing spent. */
function freshCombatant(c: DmCombatant): DmCombatant {
  return {
    ...c,
    hp: monsterHp(c.hp.max),
    surprised: false,
    conditions: [],
    concentration: { active: false, label: '' },
    concentrationDcs: [],
    legendary: c.legendary
      ? { max: c.legendaryLair ? c.legendaryLair.normal : c.legendary.max, used: 0 }
      : undefined,
    legendaryLair: c.legendaryLair ? { ...c.legendaryLair, active: false } : undefined,
  };
}

/** Add one more fresh copy of a monster to the encounter ("Goblin 2" after "Goblin 1"). */
export function duplicateCombatant(enc: DmEncounter, id: string, newId: () => string): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c || c.kind !== 'monster') return enc;
  const stem = c.name.replace(/ \d+$/, '');
  let highest = 0;
  for (const o of enc.combatants) {
    if (o.name === stem) highest = Math.max(highest, 1);
    else if (o.name.startsWith(`${stem} `) && /^\d+$/.test(o.name.slice(stem.length + 1))) {
      highest = Math.max(highest, Number(o.name.slice(stem.length + 1)));
    }
  }
  const [copy] = makeCopies(freshCombatant(c), 1, newId, false);
  return addCombatants(enc, [{ ...copy, name: `${stem} ${highest + 1}`.slice(0, 60) }]);
}

/**
 * A new encounter in setup built from an existing one, for reuse as a template:
 * the same combatants at full Hit Points, Initiative cleared (to be rolled
 * again), no round, no active turn and an empty log.
 */
export function duplicateEncounter(src: DmEncounter, newId: () => string, now: number): DmEncounter {
  const groups = new Map<string, string>();
  const combatants = src.combatants.map((c) => {
    let groupId = c.groupId;
    if (groupId !== undefined) {
      if (!groups.has(groupId)) groups.set(groupId, newId());
      groupId = groups.get(groupId);
    }
    return { ...freshCombatant(c), id: newId(), groupId, initiative: null };
  });
  const snapshots = pruneSnapshots(src.customMonsterSnapshots, combatants);
  return {
    ...createEncounter(newId(), `${src.name} (copy)`.slice(0, 80), now),
    combatants,
    ...(snapshots !== undefined ? { customMonsterSnapshots: snapshots } : {}),
  };
}

// ------------------------------------------------------------ concentration

export function setConcentration(enc: DmEncounter, id: string, active: boolean, label = ''): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c) return enc;
  return mapCombatant(enc, id, (x) => ({
    ...x,
    concentration: active ? { active: true, label: label.trim().slice(0, 60) } : { active: false, label: '' },
    concentrationDcs: active ? x.concentrationDcs : [],
  }));
}

/** Settle the oldest waiting Concentration save. */
export function resolveConcentration(enc: DmEncounter, id: string, kept: boolean): DmEncounter {
  const c = findCombatant(enc, id);
  if (!c || c.concentrationDcs.length === 0) return enc;
  const rest = c.concentrationDcs.slice(1);
  if (kept) {
    return mapCombatant(enc, id, (x) => ({ ...x, concentrationDcs: rest }));
  }
  return withLog(
    mapCombatant(enc, id, (x) => ({ ...x, concentration: { active: false, label: '' }, concentrationDcs: [] })),
    `${c.name} loses Concentration${c.concentration.label ? ` on ${c.concentration.label}` : ''}.`,
  );
}

export interface ConcentrationRoll {
  d20: number;
  total: number;
  success: boolean;
}

/**
 * Roll the Constitution save for the oldest waiting Concentration check. A save
 * succeeds when the total equals or exceeds the DC (PHB "D20 Tests"); a natural
 * 1 or 20 has no special effect on a save. Needs a known Constitution save modifier.
 */
export function rollConcentrationSave(c: DmCombatant, rng: RNG, mode: D20Mode = 'normal'): ConcentrationRoll | undefined {
  const dc = c.concentrationDcs[0];
  if (dc === undefined || c.conSaveMod === undefined) return undefined;
  const d20 = rollD20(rng, mode).used;
  const total = d20 + c.conSaveMod;
  return { d20, total, success: total >= dc };
}

// ---------------------------------------------------------- campaign wiring

export function activeEncounter(campaign: DmCampaign): DmEncounter | undefined {
  return campaign.encounters.find((e) => e.id === campaign.activeEncounterId);
}

function mapEncounters(data: DmData, campaignId: string, fn: (c: DmCampaign) => DmCampaign): DmData {
  return { ...data, campaigns: data.campaigns.map((c) => (c.id === campaignId ? fn(c) : c)) };
}

export function saveEncounter(data: DmData, campaignId: string, enc: DmEncounter, now: number): DmData {
  return mapEncounters(data, campaignId, (c) => {
    const next = { ...enc, updatedAt: now };
    const exists = c.encounters.some((e) => e.id === enc.id);
    return {
      ...c,
      updatedAt: now,
      encounters: exists ? c.encounters.map((e) => (e.id === enc.id ? next : e)) : [...c.encounters, next],
    };
  });
}

export function openEncounter(data: DmData, campaignId: string, encounterId: string | null): DmData {
  return mapEncounters(data, campaignId, (c) => ({
    ...c,
    activeEncounterId: encounterId !== null && c.encounters.some((e) => e.id === encounterId) ? encounterId : null,
  }));
}

export function deleteEncounter(data: DmData, campaignId: string, encounterId: string, now: number): DmData {
  return mapEncounters(data, campaignId, (c) => ({
    ...c,
    updatedAt: now,
    encounters: c.encounters.filter((e) => e.id !== encounterId),
    activeEncounterId: c.activeEncounterId === encounterId ? null : c.activeEncounterId,
  }));
}

/**
 * Copy each player character's end-of-fight Hit Points and Temp HP back onto
 * its party card, so the party tracker is not left showing the pre-fight
 * numbers. Imported cards are snapshots of the player's sheet, so the player's
 * own sheet is unaffected and the next share link replaces these numbers.
 */
export function applyEncounterHpToParty(data: DmData, campaignId: string, enc: DmEncounter, now: number): DmData {
  const byMember = new Map(enc.combatants.filter((c) => c.kind === 'pc' && c.memberId).map((c) => [c.memberId as string, c]));
  return mapEncounters(data, campaignId, (campaign) => ({
    ...campaign,
    updatedAt: now,
    party: campaign.party.map((m) => {
      const c = byMember.get(m.id);
      if (!c) return m;
      if (m.source === 'imported' && m.character) {
        return { ...m, updatedAt: now, character: { ...m.character, currentHp: c.hp.hp, tempHp: c.hp.temp } };
      }
      if (m.source === 'manual' && m.manual) {
        return { ...m, updatedAt: now, manual: { ...m.manual, hpCurrent: Math.min(m.manual.hpMax, c.hp.hp) } };
      }
      return m;
    }),
  }));
}
