/**
 * Tests for the pure sidekick rules (src/logic/sidekick.ts).
 * Tasha's 2020 (5e, 2014 rules): Docs/TashasCauldronOfEverything.md, "Sidekicks" (L6917-7275).
 * Worked examples use the 2024 creature catalog: Mastiff (CR 1/8), Cat (CR 0),
 * Sprite (CR 1/4) and Sphinx of Wonder (CR 1, ineligible).
 */
import { describe, it, expect } from 'vitest';
import { CREATURE_CATALOG } from '../../data/creatures';
import { SIDEKICK_CLASSES } from '../../data/sidekicks';
import {
  adjustStatBlockNumbers,
  creatureHitDie,
  hasSpokenLanguage,
  martialRoleAttackBonus,
  parseChallengeRating,
  partyAverageLevel,
  sidekickAbilityScoreImprovements,
  sidekickAttacksPerAttackAction,
  sidekickEligibility,
  sidekickFeatureDice,
  sidekickFeatureUses,
  sidekickFeaturesAtLevel,
  sidekickFeaturesGainedAt,
  sidekickHitPointsGained,
  sidekickLevelForParty,
  sidekickProficiencyBonus,
  sidekickSecondWindHealing,
  sidekickSpellAttackModifier,
  sidekickSpellSaveDc,
  sidekickSpellcastingAtLevel,
  sidekickStatAdjustment,
} from '../sidekick';

const mastiff = CREATURE_CATALOG['mastiff'];
const cat = CREATURE_CATALOG['cat'];
const sprite = CREATURE_CATALOG['sprite'];
const sphinx = CREATURE_CATALOG['sphinx-of-wonder'];

describe('challenge rating parsing and eligibility', () => {
  it('parses printed CRs', () => {
    expect(parseChallengeRating('0')).toBe(0);
    expect(parseChallengeRating('1/8')).toBe(0.125);
    expect(parseChallengeRating('1/2')).toBe(0.5);
    expect(parseChallengeRating('1')).toBe(1);
    expect(parseChallengeRating('None')).toBeNull();
    expect(parseChallengeRating(null)).toBeNull();
  });

  it('Mastiff (CR 1/8) is eligible as a Warrior', () => {
    expect(sidekickEligibility(mastiff, 'warrior')).toEqual({ eligible: true, reasons: [] });
  });

  it('Sphinx of Wonder (CR 1) is NOT eligible for any class', () => {
    for (const cls of ['expert', 'spellcaster', 'warrior'] as const) {
      const r = sidekickEligibility(sphinx, cls);
      expect(r.eligible, cls).toBe(false);
      expect(r.reasons.join(' ')).toContain('above 1/2');
    }
    expect(sidekickEligibility(sphinx).eligible).toBe(false);
  });

  it('a CR "None" creature (Primal Companion) is not eligible', () => {
    expect(sidekickEligibility({ challenge: { cr: 'None', xp: 0, proficiencyBonus: null, pbNote: '' }, languages: null }).eligible).toBe(false);
  });

  it('Cat (CR 0, no language): eligible as Warrior, but NOT as Expert or Spellcaster (spoken language required)', () => {
    expect(sidekickEligibility(cat).eligible).toBe(true);
    expect(sidekickEligibility(cat, 'warrior').eligible).toBe(true);
    for (const cls of ['expert', 'spellcaster'] as const) {
      const r = sidekickEligibility(cat, cls);
      expect(r.eligible, cls).toBe(false);
      expect(r.reasons.join(' ')).toContain('language');
    }
  });

  it('Sprite (CR 1/4, speaks Common, Elvish, Sylvan) is eligible as an Expert', () => {
    expect(sidekickEligibility(sprite, 'expert').eligible).toBe(true);
  });

  it('spoken-language reading of the stat block text', () => {
    expect(hasSpokenLanguage('None')).toBe(false);
    expect(hasSpokenLanguage(null)).toBe(false);
    expect(hasSpokenLanguage("Understands Common and Draconic but can't speak")).toBe(false);
    expect(hasSpokenLanguage('Common, Elvish, Sylvan')).toBe(true);
  });
});

describe('levels and proficiency bonus', () => {
  it('starting level is the party average, rounded down (book "Round Down" rule), clamped 1-20', () => {
    expect(partyAverageLevel([1, 1, 1, 1])).toBe(1);
    expect(sidekickLevelForParty([1, 1, 1, 1])).toBe(1);
    expect(sidekickLevelForParty([10, 10, 10])).toBe(10);
    expect(partyAverageLevel([4, 5])).toBe(4.5);
    expect(sidekickLevelForParty([4, 5])).toBe(4);
    expect(sidekickLevelForParty([5, 5, 5, 6])).toBe(5);
    expect(sidekickLevelForParty([20, 20])).toBe(20);
    expect(() => sidekickLevelForParty([])).toThrow(RangeError);
  });

  it('proficiency bonus by sidekick level (class table)', () => {
    const expected = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];
    for (const cls of ['expert', 'spellcaster', 'warrior'] as const) {
      expected.forEach((pb, i) => expect(sidekickProficiencyBonus(cls, i + 1), `${cls}/L${i + 1}`).toBe(pb));
    }
    expect(() => sidekickProficiencyBonus('warrior', 0)).toThrow(RangeError);
    expect(() => sidekickProficiencyBonus('warrior', 21)).toThrow(RangeError);
  });
});

describe('hit points', () => {
  it('reads the Hit Die from the stat block dice', () => {
    expect(creatureHitDie(mastiff)).toBe(8); // 1d8+1
    expect(creatureHitDie(cat)).toBe(4); // 1d4
    expect(creatureHitDie(CREATURE_CATALOG['wolf'])).toBeGreaterThan(0);
    expect(creatureHitDie(CREATURE_CATALOG['primal-beast-of-the-land'] ?? { hp: { formula: { base: 5, perLevel: 5, hitDie: 8, levelSource: 'ranger-level' } } })).toBeNull();
  });

  it('level-up HP is the die roll plus Con modifier, minimum 1', () => {
    expect(sidekickHitPointsGained(5, 1, 8)).toBe(6);
    expect(sidekickHitPointsGained(1, -2, 8)).toBe(1);
    expect(sidekickHitPointsGained(3, 0)).toBe(3);
    expect(() => sidekickHitPointsGained(9, 0, 8)).toThrow(RangeError);
    expect(() => sidekickHitPointsGained(0, 0, 8)).toThrow(RangeError);
  });
});

describe('Mastiff as a level 5 Warrior (worked example)', () => {
  const level = 5;
  it('PB goes +2 -> +3, so attacks and DCs get +1 versus the printed 2024 block', () => {
    const adj = sidekickStatAdjustment(mastiff, 'warrior', level)!;
    expect(adj).toEqual({ basePb: 2, sidekickPb: 3, delta: 1 });
    const entries = adjustStatBlockNumbers(mastiff, adj.delta);
    expect(entries).toEqual([{ name: 'Bite', kind: 'attack', printed: 3, adjusted: 4 }]);
  });

  it('gets Martial Role, Second Wind (1 use) and Improved Critical by level 5; no Extra Attack yet', () => {
    const names = sidekickFeaturesAtLevel('warrior', level).map((f) => f.name);
    expect(names).toEqual(['Bonus Proficiencies', 'Martial Role', 'Second Wind', 'Improved Critical', 'Ability Score Improvement']);
    expect(sidekickAbilityScoreImprovements('warrior', level)).toBe(1);
    expect(sidekickAttacksPerAttackAction(level)).toBe(1);
    expect(sidekickFeatureUses(SIDEKICK_CLASSES.warrior.features.find((f) => f.id === 'warrior.second-wind')!, level)).toBe(1);
    expect(sidekickSecondWindHealing(level)).toEqual({ dice: '1d10', flat: 5 });
    expect(martialRoleAttackBonus('Attacker')).toBe(2);
    expect(martialRoleAttackBonus('Defender')).toBe(0);
  });

  it('HP gained at a level-up uses the stat block d8', () => {
    expect(sidekickHitPointsGained(4, 1, creatureHitDie(mastiff)!)).toBe(5);
  });

  it('level 1 needs no adjustment (printed PB +2 equals the table)', () => {
    expect(sidekickStatAdjustment(mastiff, 'warrior', 1)!.delta).toBe(0);
  });
});

describe('Expert sidekick', () => {
  it('Sprite as a level 11 Expert: PB +4 gives +2 to attacks and DCs; Inspiring Help is 1d6', () => {
    const adj = sidekickStatAdjustment(sprite, 'expert', 11)!;
    expect(adj.delta).toBe(2);
    const byName = Object.fromEntries(adjustStatBlockNumbers(sprite, adj.delta).map((e) => [e.name, e]));
    expect(byName['Needle Sword']).toMatchObject({ printed: 6, adjusted: 8 });
    expect(byName['Heart Sight']).toMatchObject({ kind: 'save', printed: 10, adjusted: 12 });
    const ih = SIDEKICK_CLASSES.expert.features.find((f) => f.id === 'expert.inspiring-help')!;
    expect(sidekickFeatureDice(ih, 10)).toBeNull();
    expect(sidekickFeatureDice(ih, 11)).toBe('1d6');
    expect(sidekickFeatureDice(ih, 19)).toBe('1d6');
    expect(sidekickFeatureDice(ih, 20)).toBe('2d6');
  });

  it('features gained at specific levels', () => {
    expect(sidekickFeaturesGainedAt('expert', 1).map((f) => f.name)).toEqual(['Bonus Proficiencies', 'Helpful']);
    expect(sidekickFeaturesGainedAt('expert', 5)).toEqual([]);
    expect(sidekickFeaturesGainedAt('expert', 15).map((f) => f.name)).toEqual(['Expertise']);
    expect(sidekickAbilityScoreImprovements('expert', 20)).toBe(6);
  });
});

describe('Warrior features at higher levels', () => {
  it('Extra Attack: 2 attacks from 6, 3 from 15; Second Wind and Indomitable uses', () => {
    expect(sidekickAttacksPerAttackAction(5)).toBe(1);
    expect(sidekickAttacksPerAttackAction(6)).toBe(2);
    expect(sidekickAttacksPerAttackAction(14)).toBe(2);
    expect(sidekickAttacksPerAttackAction(15)).toBe(3);
    const f = (id: string) => SIDEKICK_CLASSES.warrior.features.find((x) => x.id === id)!;
    expect(sidekickFeatureUses(f('warrior.second-wind'), 19)).toBe(1);
    expect(sidekickFeatureUses(f('warrior.second-wind'), 20)).toBe(2);
    expect(sidekickFeatureUses(f('warrior.indomitable'), 10)).toBeNull();
    expect(sidekickFeatureUses(f('warrior.indomitable'), 17)).toBe(1);
    expect(sidekickFeatureUses(f('warrior.indomitable'), 18)).toBe(2);
  });
});

describe('Spellcaster', () => {
  it('slots, cantrips and spells known by level', () => {
    expect(sidekickSpellcastingAtLevel(1)).toMatchObject({ cantripsKnown: 2, spellsKnown: 1, spellsKnownInferred: true, slots: [2, 0, 0, 0, 0], highestSpellLevel: 1 });
    expect(sidekickSpellcastingAtLevel(5)).toMatchObject({ cantripsKnown: 3, spellsKnown: 4, slots: [4, 2, 0, 0, 0], highestSpellLevel: 2 });
    expect(sidekickSpellcastingAtLevel(20)).toMatchObject({ cantripsKnown: 4, spellsKnown: 11, slots: [4, 3, 3, 3, 2], highestSpellLevel: 5 });
  });

  it('spell save DC and attack modifier use the sidekick proficiency bonus', () => {
    expect(sidekickSpellSaveDc(1, 3)).toBe(13); // 8 + 2 + 3
    expect(sidekickSpellAttackModifier(9, 4)).toBe(8); // 4 + 4
    expect(sidekickSpellSaveDc(17, 5)).toBe(19); // 8 + 6 + 5
  });

  it('Sphinx of Wonder cannot become a Spellcaster (CR 1)', () => {
    const r = sidekickEligibility(sphinx, 'spellcaster');
    expect(r.eligible).toBe(false);
    expect(r.reasons.length).toBe(1);
  });
});
