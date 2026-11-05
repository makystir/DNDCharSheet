import type { Character } from '../../../types/character';
import { effectiveAbilityScores } from '../../feats';
import {
  carriedWeightBreakdown,
  carryingCapacityBreakdown,
  formatEncumbrance,
  getEncumbranceLevel,
} from '../../encumbrance';
import type { Suggestion } from '../types';

/**
 * Over-capacity / encumbered suggestion.
 *
 * REUSES the A2 encumbrance logic — `carriedWeightBreakdown` (current),
 * `carryingCapacityBreakdown` (capacity) and `getEncumbranceLevel` (severity) —
 * so it never recomputes the mechanic a second way. The carried-weight Breakdown
 * is passed straight through as a SuggestionTotal (components sum to the total;
 * rendered by CalculatedValue), never recomputed in the UI (calculated-totals).
 *
 * Default (RAW 2024): binary — over carrying capacity or not. PHB 2024 "Carrying
 * Capacity" (Docs/PlayersHandbook.md L20753-20800): capacity = Strength × 15 for
 * a Small/Medium creature; exceeding it is an over-capacity condition. The
 * graduated Encumbered / Heavily Encumbered bands are the opt-in variant house
 * rule only (character.houseRules.variantEncumbrance), gated exactly as the A2
 * logic gates them — this module does not introduce any new threshold.
 *
 * The action NAVIGATES to the Inventory page (the existing gear surface). It
 * never mutates the character.
 */
export function encumbranceSuggestions(character: Character): Suggestion[] {
  const current = carriedWeightBreakdown(character);
  const capacity = carryingCapacityBreakdown(character);

  const variantEnabled = character.houseRules?.variantEncumbrance === true;
  const strengthScore = effectiveAbilityScores(character).str;
  const level = getEncumbranceLevel(current.total, capacity.total, strengthScore, variantEnabled);

  if (level === 'neutral') return []; // within capacity ⇒ silent

  // Over plain capacity is critical (you cannot carry it); the opt-in variant
  // bands are informational speed-penalty nudges.
  const urgency = level === 'over' ? 'critical' : 'info';
  const title =
    level === 'over'
      ? 'You are over your carrying capacity'
      : level === 'heavilyEncumbered'
        ? 'You are Heavily Encumbered'
        : 'You are Encumbered';

  return [
    {
      id: `encumbrance:${level}`,
      title,
      rationale:
        level === 'over'
          ? 'Your carried weight exceeds your carrying capacity (Strength × 15).'
          : 'Variant Encumbrance (house rule): your carried weight crosses a speed-penalty threshold.',
      category: 'encumbrance',
      urgency,
      action: { kind: 'navigate', page: 'inventory' },
      citation: 'PHB 2024 "Carrying Capacity"',
      totals: [
        {
          label: 'Carried weight',
          display: formatEncumbrance(current.total, capacity.total),
          breakdown: current,
        },
      ],
    },
  ];
}
