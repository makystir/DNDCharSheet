/**
 * Available Reactions for the Overview Reactions card (D&D 5.5e / 2024).
 *
 * Pure derivation: lists the Reactions a character HAS ACCESS TO and whether
 * the Reaction is currently blocked. It does not evaluate triggers.
 *
 * SOURCING
 * - PHB 2024 "Reactions" (Docs/PlayersHandbook.md L620-623): a Reaction is an
 *   instant response to a trigger; only one can be taken before the start of
 *   your next turn.
 * - PHB 2024 "Opportunity Attacks" (L1020-1023): universal to every creature.
 * - Class features: only those tagged `mechanics.activation === 'reaction'` in
 *   src/data/classes.ts (Countercharm, Deflect Attacks, Slow Fall, Uncanny
 *   Dodge). Never derived from effect text. Each gates on THAT class's level
 *   (PHB 2024 "Multiclassing"), not total level.
 * - Spells: prepared (never spellbook-only) spells whose castingTime begins with
 *   "Reaction". Castable when an unexpended slot of the spell's level or higher
 *   exists in either pool (PHB 2024 "Multiclassing: Pact Magic", L2168).
 * - Incapacitated [Condition]: you can't take any action, Bonus Action, or
 *   Reaction. Paralyzed, Petrified, Stunned and Unconscious include it; 0 HP
 *   makes you Unconscious (handled by hasIncapacitated).
 *
 * APP PRESENTATION CHOICES (not RAW): entries are always listed and marked
 * unavailable with a reason; precedence is incapacitated > spent > no-slot.
 *
 * NOT MODELED: subclass, feat and species reactions, Absorb Elements (not in the
 * catalog), and the Ready action.
 */

import type { Character } from '../types/character';
import { getSpell } from '../data/spells';
import { allClasses, classFeaturesByLevelTagged } from './classes';
import { hasIncapacitated } from './initiative-roll';
import { canCastPreparedSpell, classAlwaysPreparedSpells, entryIsSpellcaster } from './spellcasting';

export type ReactionKind = 'universal' | 'class-feature' | 'spell';
export type ReactionUnavailable = 'incapacitated' | 'spent' | 'no-slot';

export interface ReactionEntry {
  kind: ReactionKind;
  name: string;
  /** One-line paraphrase (or the spell's trigger text). */
  summary: string;
  /** Citation or provenance of the entry. */
  source: string;
  /** Spell level, for spell entries. */
  spellLevel?: number;
  /** Absent = available now. */
  unavailable?: ReactionUnavailable;
}

/** Whether the Reaction is spent this round (combat.turn.reactionUsed). */
export function isReactionSpent(character: Character): boolean {
  return character.combat?.turn?.reactionUsed === true;
}

/** Whether the character can't take Reactions because Incapacitated. */
export function isReactionBlocked(character: Character): boolean {
  return hasIncapacitated(character);
}

const OPPORTUNITY_ATTACK: ReactionEntry = {
  kind: 'universal',
  name: 'Opportunity Attack',
  // PHB 2024 "Opportunity Attacks" (L1020-1023), paraphrased.
  summary:
    'When a creature you can see leaves your reach, use your Reaction to make one melee attack against it with a weapon or an Unarmed Strike, just before it leaves.',
  source: 'PHB 2024 "Opportunity Attacks" (L1020-1023)',
};

/** Every Reaction the character has access to, with availability flags. */
export function availableReactions(character: Character): ReactionEntry[] {
  const entries: ReactionEntry[] = [{ ...OPPORTUNITY_ATTACK }];

  // Class features tagged as Reactions, gated per class level.
  for (const group of classFeaturesByLevelTagged(character).values()) {
    for (const { feature, className } of group) {
      if (feature.mechanics?.activation !== 'reaction') continue;
      entries.push({
        kind: 'class-feature',
        name: feature.name,
        summary: feature.effect,
        source: `${className}: ${feature.source}`,
      });
    }
  }

  // Reaction-cast spells the character has prepared (Wizard spellbook-only
  // spells are not prepared, so they are not listed). Always-prepared feature
  // spells count as prepared (PHB 2024 per-class Spellcasting text).
  const seen = new Set<string>();
  for (const entry of allClasses(character)) {
    if (!entryIsSpellcaster(entry)) continue;
    const prepared = character.spellcasting?.byClass?.[entry.id]?.prepared ?? [];
    for (const id of [...prepared, ...classAlwaysPreparedSpells(entry)]) {
      if (seen.has(id)) continue;
      const spell = getSpell(id);
      if (!spell || spell.level < 1 || !spell.castingTime.startsWith('Reaction')) continue;
      seen.add(id);
      entries.push({
        kind: 'spell',
        name: spell.name,
        summary: spell.castingTime,
        source: `PHB 2024 spell: ${spell.name}`,
        spellLevel: spell.level,
        ...(canCastPreparedSpell(character, spell.level) ? {} : { unavailable: 'no-slot' as const }),
      });
    }
  }

  // Precedence: incapacitated > spent > no-slot.
  const blocked = isReactionBlocked(character);
  const spent = isReactionSpent(character);
  return entries.map((e) => {
    if (blocked) return { ...e, unavailable: 'incapacitated' as const };
    if (spent) return { ...e, unavailable: 'spent' as const };
    return e;
  });
}
