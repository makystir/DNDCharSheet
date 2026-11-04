import { describe, it, expect } from 'vitest';
import {
  ATTACK_RULE_TOOLTIP_KEYS,
  resolveAttackRuleTooltip,
  resolveMasteryLockedTooltip,
} from '../tooltip-content';

describe('attack rule tooltips (A5d)', () => {
  it('has content for every key, with a PHB-cited Source section', () => {
    for (const key of ATTACK_RULE_TOOLTIP_KEYS) {
      const tip = resolveAttackRuleTooltip(key);
      expect(tip, key).not.toBeNull();
      expect(tip?.title.length).toBeGreaterThan(0);
      const source = tip?.sections.find((s) => s.label === 'Source');
      expect(source?.text, key).toMatch(/PHB 2024/);
      expect(source?.text, key).toMatch(/L\d+/);
    }
  });

  it('returns null for unknown or inherited keys', () => {
    expect(resolveAttackRuleTooltip('nope')).toBeNull();
    expect(resolveAttackRuleTooltip('toString')).toBeNull();
    expect(resolveAttackRuleTooltip('')).toBeNull();
  });

  it('states the rules the golden table relies on', () => {
    const text = (key: string) => JSON.stringify(resolveAttackRuleTooltip(key));
    expect(text('attack-roll')).toMatch(/equals or exceeds/);
    expect(text('attack-roll')).toMatch(/natural 20 always hits/i);
    expect(text('critical-hit')).toMatch(/twice/);
    expect(text('critical-hit')).toMatch(/not doubled/);
    expect(text('cover')).toMatch(/\+2/);
    expect(text('cover')).toMatch(/\+5/);
    expect(text('cover')).toMatch(/most protective/);
  });
});

describe('weapon mastery locked tooltip (A5d, D8)', () => {
  it('gives a reason for every lock reason', () => {
    for (const reason of ['no-class', 'no-feature', 'not-chosen', 'not-eligible', 'over-cap']) {
      const tip = resolveMasteryLockedTooltip(reason);
      expect(tip, reason).not.toBeNull();
      expect(tip?.title).toBe('Weapon Mastery locked');
      expect(tip?.sections.find((s) => s.label === 'Why')?.text.length).toBeGreaterThan(20);
      expect(tip?.sections.find((s) => s.label === 'Source')?.text).toMatch(/PHB 2024/);
    }
  });

  it('differs per reason and returns null for unknown reasons', () => {
    const a = JSON.stringify(resolveMasteryLockedTooltip('no-feature'));
    const b = JSON.stringify(resolveMasteryLockedTooltip('not-chosen'));
    expect(a).not.toBe(b);
    expect(resolveMasteryLockedTooltip('whatever')).toBeNull();
    expect(resolveMasteryLockedTooltip('toString')).toBeNull();
  });
});
