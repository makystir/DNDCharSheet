import { describe, it, expect } from 'vitest';
import { HP_RULE_TOOLTIP_KEYS, resolveHitPointRuleTooltip } from '../tooltip-content';

describe('Hit Point rule tooltips (completeness oracle)', () => {
  it('covers exactly Bloodied, Stable, Temporary Hit Points, Death Saving Throws, Massive Damage', () => {
    expect([...HP_RULE_TOOLTIP_KEYS]).toEqual(['bloodied', 'stable', 'temp-hp', 'death-saves', 'massive-damage']);
  });

  for (const key of HP_RULE_TOOLTIP_KEYS) {
    it(`${key} resolves with content and a PHB citation`, () => {
      const tip = resolveHitPointRuleTooltip(key);
      expect(tip).not.toBeNull();
      expect(tip!.title.length).toBeGreaterThan(0);
      expect(tip!.sections.length).toBeGreaterThan(0);
      for (const s of tip!.sections) {
        expect(s.label.length).toBeGreaterThan(0);
        expect(s.text.length).toBeGreaterThan(0);
      }
      const source = tip!.sections.find((s) => s.label === 'Source');
      expect(source?.text).toMatch(/PHB 2024/);
    });
  }

  it('returns null when the key is absent', () => {
    expect(resolveHitPointRuleTooltip('nope')).toBeNull();
    expect(resolveHitPointRuleTooltip('toString')).toBeNull();
    expect(resolveHitPointRuleTooltip('')).toBeNull();
  });

  it('flags the Death Saving Throw / Exhaustion and Massive Damage / Temp HP interpretations', () => {
    const death = resolveHitPointRuleTooltip('death-saves')!;
    expect(death.sections.some((s) => s.label === 'Exhaustion')).toBe(true);
    const massive = resolveHitPointRuleTooltip('massive-damage')!;
    expect(massive.sections.some((s) => s.label === 'Temporary Hit Points')).toBe(true);
  });
});
