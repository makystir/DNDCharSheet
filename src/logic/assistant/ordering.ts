import type { Suggestion, SuggestionCategory, SuggestionContext, SuggestionUrgency } from './types';

/**
 * Deterministic ordering & grouping (ported from PWACharSheet's
 * src/logic/assistant/ordering.ts; the category lists are swapped to D&D
 * topics).
 *
 * - In combat: combat-first (0-HP death saves / broken Concentration matter
 *   most), `health` (low HP / rest) next, then encumbrance, then progression
 *   and reliability nudges last.
 * - Out of combat: progression-first (advancement), then health/encumbrance
 *   review items, then combat and the reliability nudge.
 *
 * Both arrays list ALL categories so none is unranked (the `groupRank`
 * fallback is a safety net, not the placement). Within a group, sort by urgency
 * (critical < recommended < info) then by `id` lexically. Because the sort key
 * is total and the inputs are plain data, identical `(raw, context)` always
 * yield the same ordered list.
 */
const IN_COMBAT_GROUP_ORDER: SuggestionCategory[] = [
  'combat',
  'health',
  'encumbrance',
  'advancement',
  'resource',
];

const OUT_OF_COMBAT_GROUP_ORDER: SuggestionCategory[] = [
  'advancement',
  'health',
  'encumbrance',
  'combat',
  'resource',
];

const URGENCY_RANK: Record<SuggestionUrgency, number> = {
  critical: 0,
  recommended: 1,
  info: 2,
};

export function orderSuggestions(raw: Suggestion[], context: SuggestionContext): Suggestion[] {
  const groupOrder = context.inCombat ? IN_COMBAT_GROUP_ORDER : OUT_OF_COMBAT_GROUP_ORDER;
  const groupRank = (category: SuggestionCategory): number => {
    const idx = groupOrder.indexOf(category);
    // Unknown categories sort after all known groups, still deterministically.
    return idx === -1 ? groupOrder.length : idx;
  };

  return [...raw].sort((a, b) => {
    const groupDelta = groupRank(a.category) - groupRank(b.category);
    if (groupDelta !== 0) return groupDelta;
    const urgencyDelta = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (urgencyDelta !== 0) return urgencyDelta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
