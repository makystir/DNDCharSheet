/**
 * Golden-table harness for the FEATURE-GRANTED LANGUAGES fix: base-class
 * features that grant languages (Rogue L1 "Thieves' Cant", Ranger L2 "Deft
 * Explorer" — PHB 2024) and how they compose into a character's known languages.
 *
 * Maps EVERY row of the three golden groups (feature-languages-golden.ts —
 * authored by the orchestrator from the PHB 2024 text + the shipped
 * src/data/classes.ts feature rows, NEVER edited here) onto the real logic and
 * asserts each row. The golden is pure data with no imports; this harness is the
 * only place those rows are wired to code.
 */
import { describe, it, expect } from 'vitest';
import type { Character } from '../../types/character';
import type { ClassId as CatalogClassId } from '../../data/classes';
import {
  featureLanguageGrants,
  knownLanguages,
  isFeatureLanguageSelectionValid,
} from '../languages';
import { createCharacter } from '../../storage/character-store';
import {
  GRANT_CASES,
  KNOWN_CASES,
  GRANT_VALIDITY_CASES,
  type ClassId,
} from './feature-languages-golden';

/**
 * Build a real single-class character at the given class/level with optional
 * creation `chosen` and feature `granted` language picks. The golden's ClassId
 * union is exactly the catalog's 12 base classes, so the cast is safe.
 */
function buildCharacter(
  classId: ClassId,
  level: number,
  chosen?: string[],
  granted?: string[],
): Character {
  const character = createCharacter('Golden');
  return {
    ...character,
    level,
    classes: [{ id: classId as CatalogClassId, level }],
    ...(chosen || granted
      ? {
          languages: {
            chosen: chosen ?? [],
            ...(granted ? { granted } : {}),
          },
        }
      : {}),
  };
}

describe('feature-languages golden: featureLanguageGrants (GRANT_CASES)', () => {
  it.each(GRANT_CASES)('$name', (c) => {
    const grant = featureLanguageGrants(buildCharacter(c.classId, c.level));
    expect(grant.fixed).toEqual(c.expect.fixed);
    expect(grant.chooseCount).toBe(c.expect.chooseCount);
  });
});

describe('feature-languages golden: knownLanguages (KNOWN_CASES)', () => {
  it.each(KNOWN_CASES)('$name', (c) => {
    const known = knownLanguages(buildCharacter(c.classId, c.level, c.chosen, c.granted));
    // Compared as a SET (order not significant beyond Common being present).
    expect(new Set(known)).toEqual(new Set(c.expectedSet));
    expect(known).toContain('common');
  });
});

describe('feature-languages golden: isFeatureLanguageSelectionValid (GRANT_VALIDITY_CASES)', () => {
  it.each(GRANT_VALIDITY_CASES)('$name', (c) => {
    const valid = isFeatureLanguageSelectionValid(
      buildCharacter(c.classId, c.level),
      c.granted,
    );
    expect(valid).toBe(c.valid);
  });
});
