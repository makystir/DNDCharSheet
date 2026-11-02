import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatBreakdown, formatEquation, formatSigned } from '../breakdown';
import type { Breakdown } from '../breakdown';

describe('formatSigned', () => {
  it('signs positive, negative, and zero values', () => {
    expect(formatSigned(3)).toBe('+3');
    expect(formatSigned(-1)).toBe('-1');
    expect(formatSigned(0)).toBe('+0');
  });
});

describe('formatEquation / formatBreakdown', () => {
  it('renders an additive equation whose addends sum to the total', () => {
    const bd: Breakdown = {
      total: 12,
      components: [
        { label: 'Base', value: 10 },
        { label: 'Dex mod', value: 2 },
      ],
    };
    expect(formatEquation(bd)).toBe('10 (Base) + 2 (Dex mod) = 12');
    // No note → formatBreakdown equals the equation.
    expect(formatBreakdown(bd)).toBe('10 (Base) + 2 (Dex mod) = 12');
  });

  it('normalises "+ -" to "- " for negative components', () => {
    const bd: Breakdown = {
      total: 1,
      components: [
        { label: 'Str mod', value: 3 },
        { label: 'Penalty', value: -2 },
      ],
    };
    expect(formatEquation(bd)).toBe('3 (Str mod) - 2 (Penalty) = 1');
  });

  it('appends the note after the equation (AC-override case is self-consistent)', () => {
    const bd: Breakdown = {
      total: 15,
      components: [{ label: 'Manual override', value: 15 }],
      note: 'Computed base 10 + Dex mod = 12 (superseded by manual override)',
    };
    // The equation never contradicts itself (never "15 + 12 = 15").
    expect(formatEquation(bd)).toBe('15 (Manual override) = 15');
    const full = formatBreakdown(bd);
    expect(full).toContain('15 (Manual override) = 15');
    expect(full).toContain('— Computed base 10 + Dex mod = 12');
  });

  it('property: the rendered equation total equals the sum of component values', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            label: fc.string(),
            value: fc.integer({ min: -50, max: 50 }),
          }),
          { minLength: 1, maxLength: 6 },
        ),
        (components) => {
          const total = components.reduce((s, c) => s + c.value, 0);
          const bd: Breakdown = { total, components };
          // The equation ends with "= <total>" and the total equals Σ values.
          expect(formatEquation(bd).endsWith(`= ${total}`)).toBe(true);
        },
      ),
    );
  });
});
