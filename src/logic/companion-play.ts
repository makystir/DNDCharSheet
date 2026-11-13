/**
 * Companions at the table: the Combat page's Allies glance, the Long Rest for
 * companions, the Primal Companion's revive and swap, and suggestions for the
 * companions a character's class or spells give it.
 *
 * Rules (PHB 2024, Docs/PlayersHandbook.md):
 *  - Long Rest (L21240-21254): any creature can take one; it needs at least 1
 *    Hit Point to start (L21246); finishing it restores all lost Hit Points
 *    (L21248) and lowers Exhaustion by 1 (L21252). Temporary Hit Points last
 *    until a Long Rest (L1187).
 *  - Beast Master "Primal Companion" (L5581-5591): the Ranger chooses the stat
 *    block; a beast that died within the last hour returns to life with all its
 *    Hit Points after the Ranger expends a spell slot (L5589); after a Long Rest
 *    the Ranger can summon a different beast, and the old one vanishes (L5591).
 *  - Pact of the Chain (L7040), Find Familiar (L13127), Find Steed (L13147),
 *    Paladin Faithful Steed (always prepared at level 5).
 *
 * Pure: every function returns a new character (or data) and never mutates.
 * The player decides; nothing here is applied without a button press.
 */

import type { Character, CompanionOrigin, CompanionRecord, TrackedCreature } from '../types/character';
import { CREATURE_CATALOG } from '../data/creatures';
import { buildCompanionModel, companionDisplayName, ORIGIN_LABELS } from './companion-model';
import { primalCompanionOwner } from './companion-view';
import { recordsOf, sidekicksEnabled, trackedHpOf } from './companions-actions';
import { sidekickMaxHp } from './companions';
import { exhaustionAfterLongRest } from './conditions';
import { knownSpellsByClass } from './known-spells';
import { parseInvocationEntry } from './class-choices';
import { PRIMAL_COMPANION_IDS } from './primal-companion';
import { pactSlots, setPactExpended, setSlotsExpended, slotLevels } from './spell-slot-spend';
import { partyRoster } from './party-roster';
import type { RosterEntry } from './party-roster';
import type { StatValue } from './stat-block-model';
import type { SpellId } from '../data/spells';

// ─── Allies (Combat page glance) ─────────────────────────────────────────────

export interface AllyEntry extends RosterEntry {
  /** Armor Class as the stat block shows it (with its breakdown when derived). */
  ac: StatValue | null;
  /** The first attack in the stat block, e.g. { name: "Beast's Strike", bonus: "+5" }. */
  attack: { name: string; bonus: StatValue } | null;
  /** Which Companions sub-tab holds the record. */
  tab: 'creatures' | 'people';
}

/** Active allies only (not dismissed, not dead), in roster order. */
export function combatAllies(character: Character): AllyEntry[] {
  const companions = new Map(recordsOf(character, 'companions').map((r) => [r.id, r]));
  const hirelings = new Map(recordsOf(character, 'hirelings').map((r) => [r.id, r]));
  const npcs = new Map(recordsOf(character, 'npcPartyMembers').map((r) => [r.id, r]));
  return partyRoster(character)
    .filter((e) => !e.inactive)
    .map((e): AllyEntry => {
      const companion = companions.get(e.id);
      if (companion) {
        const built = buildCompanionModel(companion, character);
        const first = built?.model.actions.find((a) => a.derived.some((d) => d.label === 'Attack bonus'));
        const bonus = first?.derived.find((d) => d.label === 'Attack bonus')?.value;
        return { ...e, tab: 'creatures', ac: built?.model.ac ?? null, attack: first && bonus ? { name: first.name, bonus } : null };
      }
      const typed = hirelings.get(e.id)?.stats ?? npcs.get(e.id)?.stats;
      const ac = typed?.ac !== undefined ? { text: String(typed.ac) } : null;
      return { ...e, tab: 'people', ac, attack: null };
    });
}

// ─── Long Rest for companions ────────────────────────────────────────────────

export interface CompanionRestPlan {
  /** Names of the records that will rest. */
  resting: string[];
  /** Names left out because they are at 0 Hit Points (a Long Rest needs 1). */
  atZero: string[];
}

interface Restable {
  id: string;
  name: string;
  record: TrackedCreature;
  max: number | null;
}

function restables(character: Character): Restable[] {
  const out: Restable[] = [];
  for (const rec of recordsOf(character, 'companions')) {
    if (rec.dismissed) continue;
    out.push({ id: rec.id, name: companionDisplayName(rec), record: rec, max: buildCompanionModel(rec, character)?.hpMax ?? null });
  }
  for (const rec of recordsOf(character, 'hirelings')) out.push({ id: rec.id, name: rec.name, record: rec, max: rec.stats?.hpMax ?? null });
  for (const rec of recordsOf(character, 'npcPartyMembers')) out.push({ id: rec.id, name: rec.name, record: rec, max: rec.stats?.hpMax ?? null });
  if (sidekicksEnabled(character)) {
    for (const rec of recordsOf(character, 'sidekicks')) {
      if (rec.dead) continue;
      out.push({ id: rec.id, name: rec.nickname?.trim() || CREATURE_CATALOG[rec.creatureId]?.name || 'Sidekick', record: rec, max: sidekickMaxHp(rec) });
    }
  }
  return out;
}

function atZeroHp(r: Restable): boolean {
  return r.max !== null && r.max > 0 && trackedHpOf(r.record, r.max) === 0;
}

/** Who would rest with the character, and who cannot (0 HP). */
export function companionRestPlan(character: Character): CompanionRestPlan {
  const all = restables(character);
  return { resting: all.filter((r) => !atZeroHp(r)).map((r) => r.name), atZero: all.filter(atZeroHp).map((r) => r.name) };
}

/** The Long Rest benefits on one tracked record: full HP, no Temporary HP, Exhaustion down 1, death saves cleared. */
function restedFields<T extends TrackedCreature>(rec: T): T {
  const next: T & { deathSaves?: unknown; stable?: unknown } = { ...rec };
  delete next.hp;
  delete next.tempHp;
  const exhaustion = exhaustionAfterLongRest(rec.exhaustionLevel ?? 0);
  if (exhaustion > 0) next.exhaustionLevel = exhaustion;
  else delete next.exhaustionLevel;
  delete next.deathSaves;
  delete next.stable;
  return next;
}

/** Apply a Long Rest to every active companion and person that has at least 1 Hit Point. */
export function companionsLongRest(character: Character): Character {
  const ids = new Set(restables(character).filter((r) => !atZeroHp(r)).map((r) => r.id));
  if (ids.size === 0) return character;
  const next: Character = { ...character };
  const apply = <T extends TrackedCreature & { id: string }>(list: T[] | undefined): T[] | undefined =>
    list?.map((r) => (ids.has(r.id) ? restedFields(r) : r));
  if (next.companions) next.companions = apply(next.companions);
  if (next.hirelings) next.hirelings = apply(next.hirelings);
  if (next.npcPartyMembers) next.npcPartyMembers = apply(next.npcPartyMembers);
  if (next.sidekicks) next.sidekicks = apply(next.sidekicks);
  return next;
}

// ─── Primal Companion: revive and swap ───────────────────────────────────────

/** A spell slot the character can expend: a standard slot level, or a Pact Magic slot. */
export type SlotChoice = { kind: 'standard'; level: number } | { kind: 'pact'; level: number };

/** Every slot with at least one use left, lowest first. */
export function availableSlots(character: Character): SlotChoice[] {
  const out: SlotChoice[] = slotLevels(character)
    .filter((s) => s.expended < s.max)
    .map((s) => ({ kind: 'standard' as const, level: s.level }));
  const pact = pactSlots(character);
  if (pact && pact.expended < pact.max) out.push({ kind: 'pact', level: pact.slotLevel });
  return out;
}

function updateCompanion(character: Character, id: string, change: (rec: CompanionRecord) => CompanionRecord): Character {
  return { ...character, companions: (character.companions ?? []).map((r) => (r.id === id ? change(r) : r)) };
}

/**
 * Revive a Primal Companion at 0 Hit Points (PHB L5589): expend the chosen spell
 * slot and restore all its Hit Points. Null when the record is not a Primal
 * Companion at 0 HP or the slot is not available. The "within the last hour"
 * timing is the player's to judge.
 */
export function revivePrimalCompanion(character: Character, recordId: string, slot: SlotChoice): Character | null {
  const rec = recordsOf(character, 'companions').find((r) => r.id === recordId);
  if (!rec || rec.origin !== 'primal-companion') return null;
  const max = buildCompanionModel(rec, character)?.hpMax ?? null;
  if (max === null || trackedHpOf(rec, max) !== 0) return null;
  const free = availableSlots(character).some((s) => s.kind === slot.kind && s.level === slot.level);
  if (!free) return null;
  let next = character;
  if (slot.kind === 'pact') next = setPactExpended(next, (pactSlots(next)?.expended ?? 0) + 1);
  else next = setSlotsExpended(next, slot.level, (slotLevels(next).find((s) => s.level === slot.level)?.expended ?? 0) + 1);
  return updateCompanion(next, recordId, (r) => {
    const out = { ...r };
    delete out.hp;
    return out;
  });
}

/**
 * Summon a different primal beast after a Long Rest (PHB L5591): the record
 * takes the new stat block and starts fresh (full HP, no Temporary HP,
 * conditions or Exhaustion). Its nickname, appearance and notes stay, since
 * the player can keep the same animal's look. Null for anything else.
 */
export function swapPrimalBeast(character: Character, recordId: string, creatureId: string): Character | null {
  const rec = recordsOf(character, 'companions').find((r) => r.id === recordId);
  if (!rec || rec.origin !== 'primal-companion') return null;
  if (!(PRIMAL_COMPANION_IDS as readonly string[]).includes(creatureId) || creatureId === rec.creatureId) return null;
  return updateCompanion(character, recordId, (r) => {
    const out: CompanionRecord = { ...r, creatureId };
    delete out.hp;
    delete out.tempHp;
    delete out.conditions;
    delete out.exhaustionLevel;
    return out;
  });
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

export interface CompanionSuggestion {
  origin: CompanionOrigin;
  /** e.g. "Primal Companion". */
  label: string;
  /** Why it is suggested, with its source. */
  reason: string;
}

function hasOrigin(character: Character, origin: CompanionOrigin): boolean {
  return recordsOf(character, 'companions').some((r) => r.origin === origin);
}

function knowsSpell(character: Character, spellId: SpellId): boolean {
  if (knownSpellsByClass(character).some((c) => c.prepared.includes(spellId))) return true;
  // A Wizard can cast Find Familiar as a Ritual from the spellbook without preparing it.
  return (character.spellcasting?.byClass?.wizard?.spellbook ?? []).includes(spellId);
}

/**
 * Companions the character's class features or spells give it that are not on
 * the sheet yet. Suggestions only; adding is the player's choice.
 */
export function companionSuggestions(character: Character): CompanionSuggestion[] {
  const out: CompanionSuggestion[] = [];
  const owner = primalCompanionOwner(character);
  if (owner.ok && owner.isBeastMaster && !hasOrigin(character, 'primal-companion')) {
    out.push({ origin: 'primal-companion', label: ORIGIN_LABELS['primal-companion'], reason: 'Your Beast Master Ranger has a Primal Companion (PHB, Beast Master level 3).' });
  }
  const invocations = (character.classChoices?.['warlock.invocations'] ?? []).map((e) => parseInvocationEntry(e).id);
  if (invocations.includes('pact-of-the-chain') && !hasOrigin(character, 'pact-of-the-chain')) {
    out.push({ origin: 'pact-of-the-chain', label: ORIGIN_LABELS['pact-of-the-chain'], reason: 'Pact of the Chain lets you summon a familiar with special forms (PHB, Eldritch Invocations).' });
  } else if (knowsSpell(character, 'find-familiar') && !hasOrigin(character, 'find-familiar') && !hasOrigin(character, 'pact-of-the-chain')) {
    out.push({ origin: 'find-familiar', label: ORIGIN_LABELS['find-familiar'], reason: 'You can cast Find Familiar (PHB, Spells).' });
  }
  if (knowsSpell(character, 'find-steed') && !hasOrigin(character, 'find-steed')) {
    out.push({ origin: 'find-steed', label: ORIGIN_LABELS['find-steed'], reason: 'You can cast Find Steed (PHB, Spells; Paladins always have it prepared from level 5).' });
  }
  return out;
}

/** True when the character is owed a Primal Companion that is not on the sheet (Finish setting up). */
export function primalCompanionMissing(character: Character): boolean {
  return companionSuggestions(character).some((s) => s.origin === 'primal-companion');
}
