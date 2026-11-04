import { describe, it, expect } from 'vitest';
import { REST_RULE_TOOLTIP_KEYS, resolveRestRuleTooltip } from '../tooltip-content';

describe('resolveRestRuleTooltip', () => {
  for (const key of REST_RULE_TOOLTIP_KEYS) {
    it(`${key} has a title, rule text and a PHB source`, () => {
      const tip = resolveRestRuleTooltip(key);
      expect(tip).not.toBeNull();
      expect(tip!.title.length).toBeGreaterThan(0);
      const source = tip!.sections.find((s) => s.label === 'Source');
      expect(source?.text).toMatch(/PHB 2024/);
      expect(tip!.sections.length).toBeGreaterThan(2);
    });
  }

  it('returns null for an unknown or inherited key', () => {
    expect(resolveRestRuleTooltip('nope')).toBeNull();
    expect(resolveRestRuleTooltip('toString')).toBeNull();
    expect(resolveRestRuleTooltip('')).toBeNull();
  });
});
