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
 * - Class AND subclass features: only those tagged `mechanics.activation ===
 *   'reaction'` in src/data/classes.ts (never derived from effect text). Each
 *   gates on THAT class's level (PHB 2024 "Multiclassing") and, for a subclass
 *   feature, on the subclass chosen on that class entry.
 * - Feats (including Origin, Fighting Style and Epic Boon feats the character
 *   has taken), Goliath Giant Ancestry options and Eldritch Invocations: only
 *   those carrying an explicit `reactions` / `reaction` tag in the data.
 * - Class choices: Battle Master maneuvers whose `trigger` is 'reaction'
 *   (Parry, Riposte) that the character has learned, and Eldritch Invocations
 *   tagged as Reactions that the Warlock level allows.
 * - Spells: prepared (never spellbook-only) spells whose castingTime begins with
 *   "Reaction". Castable when an unexpended slot of the spell's level or higher
 *   exists in either pool (PHB 2024 "Multiclassing: Pact Magic", L2168).
 * - Incapacitated [Condition]: you can't take any action, Bonus Action, or
 *   Reaction. Paralyzed, Petrified, Stunned and Unconscious include it; 0 HP
 *   makes you Unconscious (handled by hasIncapacitated).
 *
 * LIMITED-USE REACTIONS (Stage D1 trackers, src/logic/resources.ts, read only):
 * a Reaction whose use expends a tracked pool is 'no-uses' when that pool has no
 * uses left. The pool is the feature's own `uses`, its `{ spends }` link, or the
 * explicit `mechanics.reactionPool` (`'none'` = the feature's own pool only
 * ACTIVATES a form, e.g. Living Legend L5199, Rage of the Gods L2665, so the
 * Reaction inside it is not greyed by it). Battle Master maneuvers expend a
 * Superiority Die, except that from Relentless (Fighter 15, L4259) a maneuver
 * can use a free 1d8 instead, so they are never greyed by an empty pool then.
 *
 * APP PRESENTATION CHOICES (not RAW): entries are always listed and marked
 * unavailable with a reason; precedence is incapacitated > spent (the Reaction
 * itself is used) > no-uses (the feature's pool is empty) > no-slot.
 *
 * NOT MODELED: Absorb Elements (not in the catalog), the Ready action, whether an
 * activated form (Rage, Rage of the Gods, Living Legend) is currently active,
 * species uses (Giant Ancestry has no tracker), and Reaction riders on spells
 * that are not cast with a Reaction (e.g. Fount of Moonlight, L13423).
 */

import type { Character } from '../types/character';
import { getSpell } from '../data/spells';
import { getFeat } from '../data/feats';
import { getInvocation } from '../data/invocations';
import { getManeuver } from '../data/maneuvers';
import { allClasses, classFeaturesByLevelTagged, entrySubclass, resolveClasses } from './classes';
import { parseInvocationEntry } from './class-choices';
import { characterFeats } from './feats';
import { hasIncapacitated } from './initiative-roll';
import { characterResources } from './resources';
import type { ResourceState } from './resources';
import { resolveSpecies } from './species';
import { canCastPreparedSpell, classAlwaysPreparedSpells, entryIsSpellcaster } from './spellcasting';
import type { ClassFeature } from '../data/classes';

export type ReactionKind =
  | 'universal'
  | 'class-feature'
  | 'subclass-feature'
  | 'feat'
  | 'fighting-style'
  | 'species'
  | 'class-choice'
  | 'spell';
/** 'spent' = the Reaction is used this round; 'no-uses' = the feature's own limited-use pool is empty. */
export type ReactionUnavailable = 'incapacitated' | 'spent' | 'no-uses' | 'no-slot';

export interface ReactionEntry {
  kind: ReactionKind;
  name: string;
  /** One-line paraphrase (or the spell's trigger text). */
  summary: string;
  /** Citation or provenance of the entry. */
  source: string;
  /** Where it comes from for display: class (subclass), feat, species, "Battle Master", ... */
  origin?: string;
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

/** Battle Master is the only subclass with maneuvers (PHB L4229-4237). */
const BATTLE_MASTER_ID = 'battleMaster';
const SUPERIORITY_DICE = 'fighter.superiority-dice';

/** Trackers whose id is `base` or one of its `#n` variants. */
function statesFor(states: ResourceState[], base: string): ResourceState[] {
  return states.filter((s) => s.id === base || s.id.startsWith(`${base}#`));
}

/** True only when there is a tracker and every matching one has no uses left. */
function allEmpty(matches: ResourceState[]): boolean {
  return matches.length > 0 && matches.every((s) => s.remaining === 0);
}

/**
 * The tracker states a tagged class/subclass feature's Reaction expends (see the
 * module header). Empty = the Reaction costs no tracked use.
 */
function reactionPoolStates(states: ResourceState[], classId: string, feature: ClassFeature): ResourceState[] {
  const declared = feature.mechanics?.reactionPool;
  if (declared === 'none') return [];
  if (typeof declared === 'string') return statesFor(states, `${classId}.${declared}`);
  const uses = feature.uses;
  if (!uses) return [];
  if ('spends' in uses) return statesFor(states, `${classId}.${uses.spends}`);
  // Own pool: the tracker of this class that lists the feature by name.
  return states.filter((s) => s.ownerKey === classId && s.featureNames.includes(feature.name));
}

/** Every Reaction the character has access to, with availability flags. */
export function availableReactions(character: Character): ReactionEntry[] {
  const entries: ReactionEntry[] = [{ ...OPPORTUNITY_ATTACK }];
  const states = characterResources(character);

  // Class and subclass features tagged as Reactions, gated per class level.
  for (const group of classFeaturesByLevelTagged(character).values()) {
    for (const { feature, className, classId, subclassName } of group) {
      if (feature.mechanics?.activation !== 'reaction') continue;
      const reactionName = feature.mechanics.reactionName;
      entries.push({
        kind: subclassName ? 'subclass-feature' : 'class-feature',
        name: typeof reactionName === 'string' ? reactionName : feature.name,
        summary: feature.effect,
        source: subclassName ? `${className} (${subclassName}): ${feature.source}` : `${className}: ${feature.source}`,
        origin: subclassName ? `${className}: ${subclassName}` : className,
        ...(allEmpty(reactionPoolStates(states, classId, feature)) ? { unavailable: 'no-uses' as const } : {}),
      });
    }
  }

  // Feats the character has taken (Origin, General, Fighting Style, Epic Boon); one entry per feat id.
  const seenFeats = new Set<string>();
  for (const selection of characterFeats(character)) {
    if (seenFeats.has(selection.featId)) continue;
    seenFeats.add(selection.featId);
    const feat = getFeat(selection.featId);
    for (const reaction of feat?.reactions ?? []) {
      entries.push({
        kind: feat?.category === 'fighting-style' ? 'fighting-style' : 'feat',
        name: reaction.name,
        summary: reaction.summary,
        source: reaction.source,
        origin: feat?.name,
      });
    }
  }

  // Species options tagged with a Reaction (Goliath Giant Ancestry: Stone / Storm).
  const species = resolveSpecies(character);
  for (const spec of species?.choices ?? []) {
    const chosen = (character.species as unknown as Record<string, unknown> | undefined)?.[spec.field];
    const option = spec.options.find((o) => o.id === chosen);
    if (!option?.reaction) continue;
    entries.push({
      kind: 'species',
      name: option.reaction.name,
      summary: option.reaction.summary,
      source: option.reaction.source,
      origin: species?.name,
    });
  }

  // Class choices: Battle Master reaction maneuvers and tagged Eldritch Invocations.
  for (const { entry, data } of resolveClasses(character)) {
    if (data.id === 'fighter' && entrySubclass(entry)?.id === BATTLE_MASTER_ID) {
      // Relentless (Fighter 15, PHB L4259): a free 1d8 can replace the Superiority Die.
      const relentless = (entrySubclass(entry)?.features ?? []).some((f) => f.name === 'Relentless' && f.level <= entry.level);
      const dice = statesFor(states, SUPERIORITY_DICE);
      const seen = new Set<string>();
      for (const id of character.classChoices?.['fighter.maneuvers'] ?? []) {
        const maneuver = getManeuver(id);
        if (!maneuver || maneuver.trigger !== 'reaction' || seen.has(id)) continue;
        seen.add(id);
        entries.push({
          kind: 'class-choice',
          name: `Maneuver: ${maneuver.name}`,
          summary: maneuver.summary,
          source: maneuver.source,
          origin: 'Battle Master',
          ...(!relentless && allEmpty(dice) ? { unavailable: 'no-uses' as const } : {}),
        });
      }
    }
    if (data.id === 'warlock') {
      const picked = new Set<string>();
      const ids = (character.classChoices?.['warlock.invocations'] ?? []).map((raw) => parseInvocationEntry(raw).id);
      for (const id of ids) {
        if (picked.has(id)) continue;
        picked.add(id);
        const invocation = getInvocation(id);
        if (!invocation?.reaction || entry.level < invocation.minLevel) continue;
        if (invocation.requiresInvocation && !ids.includes(invocation.requiresInvocation)) continue;
        entries.push({
          kind: 'class-choice',
          name: invocation.reaction.name,
          summary: invocation.reaction.summary,
          source: invocation.reaction.source,
          origin: 'Eldritch Invocation',
        });
      }
    }
  }

  // Reaction-cast spells the character has prepared (Wizard spellbook-only
  // spells are not prepared, so they are not listed). Always-prepared feature
  // spells count as prepared (PHB 2024 per-class Spellcasting text).
  const seen = new Set<string>();
  for (const entry of allClasses(character)) {
    if (!entryIsSpellcaster(entry)) continue;
    const prepared = character.spellcasting?.byClass?.[entry.id]?.prepared ?? [];
    for (const id of [...prepared, ...classAlwaysPreparedSpells(entry, character)]) {
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

  // Precedence: incapacitated > spent > no-uses > no-slot (the last two are set above).
  const blocked = isReactionBlocked(character);
  const spent = isReactionSpent(character);
  return entries.map((e) => {
    if (blocked) return { ...e, unavailable: 'incapacitated' as const };
    if (spent) return { ...e, unavailable: 'spent' as const };
    return e;
  });
}
