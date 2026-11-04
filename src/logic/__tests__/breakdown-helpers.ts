import type { Breakdown } from '../breakdown';

/** Sum of a breakdown's component values (the calculated-totals invariant). */
export function sumComponents(breakdown: Breakdown): number {
  return breakdown.components.reduce((sum, c) => sum + c.value, 0);
}
