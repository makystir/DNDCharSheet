/**
 * One flat roster of everyone the Companions page tracks, for glance views (the
 * Companions page summary strip). Read-only: it builds names, live HP and
 * condition names from the records and the owner; it stores nothing and
 * applies no rule of its own (HP maxima come from buildCompanionModel, the
 * typed stat block, or sidekickMaxHp).
 */

import type { Character, TrackedCreature } from '../types/character';
import { CREATURE_CATALOG } from '../data/creatures';
import { getCondition } from '../data/conditions';
import { buildCompanionModel, companionDisplayName, HIRELING_KIND_LABELS, ORIGIN_LABELS } from './companion-model';
import { recordsOf, sidekicksEnabled, trackedHpOf } from './companions-actions';
import { sidekickMaxHp } from './companions';

export type RosterGroup = 'creature' | 'person';

export interface RosterEntry {
  id: string;
  group: RosterGroup;
  name: string;
  /** Kind label, e.g. "Primal Companion" or "Skilled hireling". */
  kind: string;
  /** Live HP against the maximum; null when the maximum is not known. */
  hp: { current: number; max: number } | null;
  /** Names of active conditions; Exhaustion shows its level. */
  conditions: string[];
  /** Kept on the sheet but not active (dismissed companion, dead sidekick). */
  inactive: boolean;
}

function conditionNames(rec: TrackedCreature): string[] {
  const names = (rec.conditions ?? []).map((c) => getCondition(c.id)?.name ?? c.id);
  if (rec.exhaustionLevel && rec.exhaustionLevel > 0) names.push(`Exhaustion ${rec.exhaustionLevel}`);
  return names;
}

function hpOf(rec: TrackedCreature, max: number | null): RosterEntry['hp'] {
  return max !== null && max > 0 ? { current: trackedHpOf(rec, max), max } : null;
}

/** Everyone tracked on the Companions page, creatures first. Sidekicks only while their house rule is on. */
export function partyRoster(character: Character): RosterEntry[] {
  const out: RosterEntry[] = [];
  for (const rec of recordsOf(character, 'companions')) {
    const model = buildCompanionModel(rec, character);
    if (!model) continue;
    out.push({
      id: rec.id,
      group: 'creature',
      name: companionDisplayName(rec),
      kind: ORIGIN_LABELS[rec.origin],
      hp: hpOf(rec, model.hpMax),
      conditions: conditionNames(rec),
      inactive: rec.dismissed === true,
    });
  }
  for (const rec of recordsOf(character, 'hirelings')) {
    out.push({
      id: rec.id,
      group: 'person',
      name: rec.name,
      kind: HIRELING_KIND_LABELS[rec.kind],
      hp: hpOf(rec, rec.stats?.hpMax ?? null),
      conditions: conditionNames(rec),
      inactive: false,
    });
  }
  for (const rec of recordsOf(character, 'npcPartyMembers')) {
    out.push({
      id: rec.id,
      group: 'person',
      name: rec.name,
      kind: 'NPC party member',
      hp: hpOf(rec, rec.stats?.hpMax ?? null),
      conditions: conditionNames(rec),
      inactive: false,
    });
  }
  if (sidekicksEnabled(character)) {
    for (const rec of recordsOf(character, 'sidekicks')) {
      const creature = CREATURE_CATALOG[rec.creatureId];
      if (!creature) continue;
      out.push({
        id: rec.id,
        group: 'person',
        name: rec.nickname?.trim() || creature.name,
        kind: 'Sidekick',
        hp: hpOf(rec, sidekickMaxHp(rec)),
        conditions: conditionNames(rec),
        inactive: rec.dead === true,
      });
    }
  }
  return out;
}
