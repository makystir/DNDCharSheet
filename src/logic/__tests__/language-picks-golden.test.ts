/**
 * Harness for language-picks-golden.ts (rows authored from the PHB first; never
 * edited here). Wires each row to logic/language-picks.ts and the existing
 * validator.
 */
import { describe, it, expect } from 'vitest';
import type { Character } from '../../types/character';
import type { ClassId } from '../../data/classes';
import { createCharacter } from '../../storage/character-store';
import { languagePicksStatus, featureLanguageOptions } from '../language-picks';
import { isFeatureLanguageSelectionValid } from '../languages';
import { PICK_CASES, OPTION_CASES, type PickEntry } from './language-picks-golden';

function build(classes: PickEntry[], chosen: string[], granted: string[]): Character {
  return {
    ...createCharacter('Golden'),
    level: classes.reduce((n, c) => n + c.level, 0),
    classes: classes.map((c) => ({ id: c.classId as ClassId, level: c.level })),
    languages: { chosen, granted },
  };
}

describe('language-picks golden: languagePicksStatus', () => {
  it.each(PICK_CASES)('$name', (c) => {
    const s = languagePicksStatus(build(c.classes, [], c.granted));
    expect({ owed: s.owed, chosen: s.chosen, remaining: s.remaining, over: s.over }).toEqual(
      c.expect,
    );
    // Within the cap, the existing validator agrees the picks are acceptable.
    if (s.over === 0 && c.granted.every((g) => !['common', 'thieves-cant'].includes(g))) {
      const distinct = new Set(c.granted.map((g) => g.toLowerCase()));
      if (distinct.size === c.granted.length) {
        expect(isFeatureLanguageSelectionValid(build(c.classes, [], c.granted), c.granted)).toBe(
          true,
        );
      }
    }
    if (s.over > 0) {
      expect(isFeatureLanguageSelectionValid(build(c.classes, [], c.granted), c.granted)).toBe(
        false,
      );
    }
  });
});

describe('language-picks golden: featureLanguageOptions', () => {
  it.each(OPTION_CASES)('$name', (c) => {
    const options = featureLanguageOptions(build(c.classes, c.chosen, c.granted));
    for (const id of c.mustInclude) expect(options).toContain(id);
    for (const id of c.mustExclude) expect(options).not.toContain(id);
  });
});
