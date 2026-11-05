import type { Character } from '../../../types/character';
import { advisorSuggestions } from '../../advancement-advisor';
import type { Suggestion } from '../types';

/**
 * Advancement-readiness suggestion.
 *
 * REUSES the A6c advisor (`advisorSuggestions`, src/logic/advancement-advisor.ts)
 * — it does NOT recompute canLevelUp / feat slots / subclass choice. The advisor
 * already fires its deterministic suggestions for: an available level-up
 * (`can-level-up`), an open feat/ASI slot (`pending-feat-slot`), an unchosen
 * subclass at the subclass level (`choose-subclass`), an earned-but-unapplied
 * level (`level-earned-unapplied`), and a next-level Proficiency Bonus bump
 * (`pb-increases-next`).
 *
 * This module surfaces a single consolidated Assistant nudge whose action
 * NAVIGATES to the Advancement page (the existing, player-confirmed level-up
 * flow). Nothing mutates the character. Urgency is `recommended` when a level-up
 * or an open feat slot / unchosen subclass is pending (the player owes a
 * decision), otherwise `info` (a soft PB-bump heads-up).
 *
 * PHB 2024 "Character Advancement" (Docs/PlayersHandbook.md L1982-2003) +
 * "Gaining a Level" (L2011-2026) — all already verified by the A6c advisor.
 */
export function advancementSuggestions(character: Character): Suggestion[] {
  const advice = advisorSuggestions(character);
  if (advice.length === 0) return [];

  const ids = new Set(advice.map((a) => a.id));
  // A decision the player owes (apply a level / choose a feat / choose a
  // subclass / apply an earned level) is an opinionated nudge; a lone PB-bump
  // heads-up is informational.
  const actionable =
    ids.has('can-level-up') ||
    ids.has('pending-feat-slot') ||
    ids.has('choose-subclass') ||
    ids.has('level-earned-unapplied');

  // Prefer the most actionable advisor line's title; fall back to the first.
  const lead =
    advice.find((a) => a.id === 'can-level-up') ??
    advice.find((a) => a.id === 'choose-subclass') ??
    advice.find((a) => a.id === 'pending-feat-slot') ??
    advice.find((a) => a.id === 'level-earned-unapplied') ??
    advice[0];

  return [
    {
      id: 'advancement:ready',
      title: actionable ? lead.title : 'Advancement available',
      rationale:
        advice.length === 1
          ? lead.content.sections[0]?.text ?? 'Review your advancement options.'
          : `${advice.length} advancement items: ${advice.map((a) => a.title).join('; ')}.`,
      category: 'advancement',
      urgency: actionable ? 'recommended' : 'info',
      action: { kind: 'navigate', page: 'advancement' },
      citation: 'PHB 2024 "Character Advancement"',
    },
  ];
}
