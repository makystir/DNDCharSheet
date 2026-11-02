/**
 * Shared types for calculated-total breakdowns.
 *
 * The calculated-totals steering rule requires every derived number shown in
 * the UI to carry a tooltip explaining how it was produced. These types are
 * the common currency for that: a rules function returns both the total and an
 * ordered list of labelled components, and the UI renders the breakdown in a
 * Tooltip.
 */

/** A single labelled contribution to a calculated total. */
export interface BreakdownComponent {
  /** Meaningful source label, e.g. "Base", "Dex mod", "Proficiency". */
  label: string;
  /** The numeric contribution (may be 0 or negative). */
  value: number;
}

/** A calculated total together with the components that produced it. */
export interface Breakdown {
  /** The final computed value. */
  total: number;
  /**
   * Ordered components; include zero values so every factor is visible.
   * Invariant: components always sum to `total`. Anything that is not an
   * addend (a superseded alternative value, a "set at a later stage" note)
   * goes in `note`, never in `components`.
   */
  components: BreakdownComponent[];
  /**
   * Optional explanatory text that is NOT part of the additive sum — e.g. a
   * superseded alternative value. Rendered outside the "A + B = total" line.
   */
  note?: string;
}

/**
 * Formats a signed number for display, e.g. 3 -> "+3", -1 -> "-1", 0 -> "+0".
 * Ability modifiers and similar bonuses are conventionally shown signed.
 */
export function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/**
 * Renders just the additive equation of a breakdown, e.g.
 * "10 (Base) + 2 (Dex mod) = 12". Components always sum to the total, so this
 * line is never self-contradictory. The optional `note` is NOT included here.
 */
export function formatEquation(breakdown: Breakdown): string {
  const parts = breakdown.components
    .map((c) => `${c.value} (${c.label})`)
    .join(' + ')
    // Normalise "+ -1" to "- 1" for readability.
    .replace(/\+ -/g, '- ');
  return `${parts} = ${breakdown.total}`;
}

/**
 * Renders a breakdown as a compact additive string, appending the optional
 * explanatory `note` after the equation, e.g.
 * "15 (Manual override) = 15 — Computed base 10 + Dex mod = 12 (superseded…)".
 * Used for the CalculatedValue aria-label so the screen-reader text carries
 * the same information as the visible tooltip.
 */
export function formatBreakdown(breakdown: Breakdown): string {
  const equation = formatEquation(breakdown);
  return breakdown.note ? `${equation} — ${breakdown.note}` : equation;
}
