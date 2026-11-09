import { describe, it, expect } from 'vitest';
import { CREATURE_LIST } from '../../data/creatures';
import { SIDEKICK_CLASS_IDS, getSidekickClass } from '../../data/sidekicks';
import {
  COMPANION_HOUSE_RULE_KEYS,
  COMPANION_RULE_TOOLTIP_KEYS,
  resolveCompanionHouseRuleTooltip,
  resolveCompanionRuleTooltip,
  resolveCreatureFeatureTooltip,
  resolveCreatureTooltip,
  resolveSidekickFeatureTooltip,
  zeroHpRuleKeyForOrigin,
} from '../tooltip-content';

function sectionText(t: ReturnType<typeof resolveCreatureTooltip>, label: string): string | undefined {
  return t?.sections.find((s) => s.label === label)?.text;
}

describe('resolveCreatureTooltip', () => {
  it('resolves every catalog creature with a title and non-empty sections', () => {
    for (const c of CREATURE_LIST) {
      const t = resolveCreatureTooltip(c.id);
      expect(t, c.id).not.toBeNull();
      expect(t?.title).toBe(c.name);
      expect(t?.sections.length).toBeGreaterThanOrEqual(2);
      for (const s of t?.sections ?? []) {
        expect(s.label.length).toBeGreaterThan(0);
        expect(s.text.length).toBeGreaterThan(0);
      }
      expect(sectionText(t, 'Source')).toContain(c.source.book);
    }
  });

  it('shows the mount capacity for a Mounts and Other Animals table creature', () => {
    expect(sectionText(resolveCreatureTooltip('mule'), 'Mount')).toContain('420 lb');
    expect(sectionText(resolveCreatureTooltip('pony'), 'Mount')).toContain('225 lb');
    expect(sectionText(resolveCreatureTooltip('wolf'), 'Mount')).toBeUndefined();
  });

  it('describes how a Primal Companion and a steed are used', () => {
    expect(sectionText(resolveCreatureTooltip('beast-of-the-land'), 'Used as')).toMatch(/Primal Companion/);
    expect(sectionText(resolveCreatureTooltip('otherworldly-steed'), 'Used as')).toMatch(/spell slot/);
  });

  it('returns null for unknown or prototype ids', () => {
    expect(resolveCreatureTooltip('nope')).toBeNull();
    expect(resolveCreatureTooltip('__proto__')).toBeNull();
    expect(resolveCreatureTooltip('constructor')).toBeNull();
    expect(resolveCreatureTooltip('')).toBeNull();
  });
});

describe('resolveSidekickFeatureTooltip', () => {
  it('resolves every sidekick feature, marked with the 2014 edition and the Tasha line range', () => {
    for (const classId of SIDEKICK_CLASS_IDS) {
      for (const f of getSidekickClass(classId).features) {
        const t = resolveSidekickFeatureTooltip(classId, f.id);
        expect(t, f.id).not.toBeNull();
        expect(t?.title).toBe(f.name);
        expect(sectionText(t, 'Effect')).toBe(f.summary);
        const source = sectionText(t, 'Source') ?? '';
        expect(source).toContain("Tasha's 2020 (5e, 2014 rules)");
        expect(source).toContain(`L${f.source.lines[0]}-${f.source.lines[1]}`);
      }
    }
  });

  it('adds the uses and dice in force at the given level', () => {
    const warrior = getSidekickClass('warrior');
    const secondWind = warrior.features.find((f) => f.name === 'Second Wind')!;
    const t = resolveSidekickFeatureTooltip('warrior', secondWind.id, 20);
    expect(t?.sections.some((s) => s.label === 'Uses at level 20' || s.label === 'Dice at level 20')).toBe(true);
    const plain = resolveSidekickFeatureTooltip('warrior', secondWind.id);
    expect(plain?.sections.some((s) => s.label.startsWith('Uses at') || s.label.startsWith('Dice at'))).toBe(false);
  });

  it('ignores an out-of-range level', () => {
    const f = getSidekickClass('expert').features[0];
    const t = resolveSidekickFeatureTooltip('expert', f.id, 21);
    expect(t?.sections.some((s) => s.label.includes('level 21'))).toBe(false);
  });

  it('returns null for an unknown class or feature', () => {
    expect(resolveSidekickFeatureTooltip('fighter', 'warrior.second-wind')).toBeNull();
    expect(resolveSidekickFeatureTooltip('warrior', 'warrior.nope')).toBeNull();
    expect(resolveSidekickFeatureTooltip('__proto__', 'x')).toBeNull();
    // A feature id from another class is not found in this class.
    const expertFeature = getSidekickClass('expert').features[0];
    expect(resolveSidekickFeatureTooltip('warrior', expertFeature.id)).toBeNull();
  });
});

describe('resolveCreatureFeatureTooltip', () => {
  it('returns the catalog description of a trait, action, bonus action or reaction', () => {
    const tip = resolveCreatureFeatureTooltip('cat', 'traits', 'Jumper');
    expect(tip?.title).toBe('Jumper');
    expect(tip?.sections[0].text).toMatch(/jump distance/);
    expect(resolveCreatureFeatureTooltip('cat', 'actions', 'Scratch')?.sections[0].label).toBe('Action');
  });

  it('returns null for an unknown creature, section entry or empty section', () => {
    expect(resolveCreatureFeatureTooltip('nope', 'traits', 'Jumper')).toBeNull();
    expect(resolveCreatureFeatureTooltip('cat', 'traits', 'Nope')).toBeNull();
    expect(resolveCreatureFeatureTooltip('cat', 'reactions', 'Jumper')).toBeNull();
  });
});

describe('resolveCompanionRuleTooltip', () => {
  it('resolves every key with non-empty sections and a source line', () => {
    for (const key of COMPANION_RULE_TOOLTIP_KEYS) {
      const tip = resolveCompanionRuleTooltip(key);
      expect(tip).not.toBeNull();
      for (const s of tip!.sections) {
        expect(s.label.length).toBeGreaterThan(0);
        expect(s.text.length).toBeGreaterThan(0);
      }
      expect(tip!.sections.some((s) => s.label === 'Source')).toBe(true);
    }
  });

  it('returns null for an unknown key', () => {
    expect(resolveCompanionRuleTooltip('nope')).toBeNull();
    expect(resolveCompanionRuleTooltip('constructor')).toBeNull();
  });

  it('maps each companion origin to its 0 HP note', () => {
    expect(zeroHpRuleKeyForOrigin('find-familiar')).toBe('familiar-zero-hp');
    expect(zeroHpRuleKeyForOrigin('pact-of-the-chain')).toBe('familiar-zero-hp');
    expect(zeroHpRuleKeyForOrigin('wild-companion')).toBe('wild-companion');
    expect(zeroHpRuleKeyForOrigin('primal-companion')).toBe('primal-revival');
    expect(zeroHpRuleKeyForOrigin('find-steed')).toBe('steed-zero-hp');
    expect(zeroHpRuleKeyForOrigin('pet')).toBe('monster-death');
    expect(zeroHpRuleKeyForOrigin('animate-dead')).toBe('monster-death');
  });
});

describe('resolveCompanionHouseRuleTooltip', () => {
  it('cites the book, marks the opt-in default off, and the sidekick one carries the edition', () => {
    for (const key of COMPANION_HOUSE_RULE_KEYS) {
      const t = resolveCompanionHouseRuleTooltip(key);
      expect(t, key).not.toBeNull();
      expect(sectionText(t, 'Source')).toMatch(/Docs\//);
      expect(sectionText(t, 'Edition')).toMatch(/off by default/);
    }
    expect(sectionText(resolveCompanionHouseRuleTooltip('sidekicks'), 'Edition')).toContain("Tasha's 2020 (5e, 2014 rules)");
    expect(sectionText(resolveCompanionHouseRuleTooltip('loyalty'), 'Source')).toContain('DungeonMastersGuide.md L3572');
  });

  it('returns null for an unknown key', () => {
    expect(resolveCompanionHouseRuleTooltip('rolledHp')).toBeNull();
    expect(resolveCompanionHouseRuleTooltip('__proto__')).toBeNull();
  });
});
