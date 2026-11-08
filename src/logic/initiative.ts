/**
 * Initiative rules (D&D 5.5e / 2024).
 *
 * PHB 2024 "Initiative": Initiative is a Dexterity check, so the modifier is
 * the Dexterity modifier plus any bonuses from features (a single generic
 * manual bonus for now; feature sources arrive in a later stage).
 *
 * Pure function returning a Breakdown (calculated-totals steering).
 */

import type { AbilityScores } from '../types/character';
import { abilityModifier } from './abilities';
import type { Breakdown } from './breakdown';
import { withExhaustion } from './conditions';

/** The Initiative modifier with a breakdown: Dex mod + bonus (default 0). */
export function initiativeBreakdown(
  scores: AbilityScores,
  initiativeBonus?: number,
  exhaustionLevel?: number,
): Breakdown {
  const dexMod = abilityModifier(scores.dex);
  const bonus =
    initiativeBonus !== undefined && Number.isFinite(initiativeBonus)
      ? initiativeBonus
      : 0;
  const base: Breakdown = {
    total: dexMod + bonus,
    components: [
      { label: 'Dex mod', value: dexMod },
      { label: 'Bonus', value: bonus },
    ],
  };
  // Exhaustion (PHB 2024 L21024) is added ONLY for the static display total
  // (pass the level). The roll path omits it and adds the penalty itself.
  return exhaustionLevel === undefined ? base : withExhaustion(base, exhaustionLevel);
}
