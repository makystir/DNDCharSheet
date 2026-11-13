import { describe, it, expect } from 'vitest';
import { CLASS_LIST } from '../../data/classes';
import { pendingChoices } from '../pending-choices';
import { generateRandomCharacter } from '../personal-details-generation';
import { createSeededRng } from '../random';
import { masteryChoices } from '../weapon-mastery';
import { characterFeats } from '../feats';
import {
  applyWizardFeatures,
  autoPickFeatures,
  creationFeatureNeeds,
  extractWizardFeatures,
  hasCreationFeatures,
} from '../creation-features';

/**
 * The creation wizard must leave a new character with nothing owed at level 1:
 * the Class Features step collects the level 1 feature picks the other steps
 * do not (PHB 2024 class feature tables).
 */
describe('level 1 class feature picks (Class Features step)', () => {
  it('knows which level 1 picks each class makes', () => {
    const table = Object.fromEntries(CLASS_LIST.map((c) => [c.id, creationFeatureNeeds(c.id)]));
    expect(table.fighter).toMatchObject({ fightingStyle: true, weaponMastery: 3 });
    expect(table.cleric.choiceKeys).toEqual(['cleric.divineOrder']);
    expect(table.druid.choiceKeys).toEqual(['druid.primalOrder']);
    expect(table.warlock.choiceKeys).toEqual(['warlock.invocations']);
    expect(table.rogue).toMatchObject({ expertise: 2, weaponMastery: 2 });
    for (const id of ['barbarian', 'paladin', 'ranger']) expect(table[id].weaponMastery, id).toBe(2);
    // Paladin and Ranger get Fighting Style at level 2, not 1.
    expect(table.paladin.fightingStyle).toBe(false);
    expect(table.ranger.fightingStyle).toBe(false);
    for (const id of ['bard', 'monk', 'sorcerer', 'wizard']) expect(hasCreationFeatures(id), id).toBe(false);
  });

  it('leaves every class with nothing owed once the picks are made', () => {
    for (const cls of CLASS_LIST) {
      for (let seed = 1; seed <= 5; seed++) {
        const c = generateRandomCharacter(createSeededRng(seed), { classId: cls.id as never });
        expect(pendingChoices(c).total, `${cls.id} seed ${seed}`).toBe(0);
        const m = masteryChoices(c);
        expect(m.chosen.length, `${cls.id} mastery`).toBe(m.cap);
      }
    }
  });

  it('round-trips the picks through a built character', () => {
    const base = generateRandomCharacter(createSeededRng(9), { classId: 'fighter' as never });
    // Strip the random picks, then apply a known set.
    const bare = { ...base, advancement: { ...base.advancement, feats: [] }, weaponMasteries: undefined };
    const picks = autoPickFeatures(bare, 'fighter', () => 0);
    const built = applyWizardFeatures(bare, 'fighter', picks, 1);
    expect(characterFeats(built).find((f) => f.grantedBy === 'fighter')?.featId).toBe(picks.fightingStyle);
    expect(extractWizardFeatures(built, 'fighter')).toEqual(picks);
  });
});
