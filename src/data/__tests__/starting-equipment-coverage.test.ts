import { describe, it, expect } from 'vitest';
import { CLASS_LIST } from '../classes';
import { resolveEquipment, type ResolvedItem } from '../../logic/equipment-resolver';

/**
 * Starting-equipment coverage (review findings #3 + #6), DERIVED FROM REAL DATA.
 * -----------------------------------------------------------------------------
 * Instead of a hand-maintained REQUIRED_CONCRETE_ITEMS list, this test PARSES
 * every class's actual `ClassData.startingEquipment` string into its individual
 * grant tokens and runs each token through `resolveEquipment`. That means a
 * future class edit (a new item, a renamed focus) is auto-checked, and any real
 * resolver gap fails here.
 *
 * Requirement, per token:
 *   - A CONCRETE token (not a player choice) must resolve WITHOUT leaving any
 *     unresolved `choice`, AND without falling back to a stat-less custom item
 *     (i.e. every resolved item carries a `catalogId`).
 *   - A CHOICE token (a generic category, a focus/instrument/tools family, or a
 *     " or " grant) must resolve to a non-empty `choice` option set.
 *   - Pure money ("15 GP", "75 GP") is ignored.
 */

/**
 * Parse one class startingEquipment string into individual grant tokens.
 * The strings use the shape "(A) item, item, N GP; or (B) N GP" (sometimes
 * "(C)"). We split into option packages, then into comma-separated tokens,
 * strip the "(A)/(B)/(C)" and "or" prefixes and money, and return the
 * resolvable item/choice tokens.
 */
function parseGrantTokens(startingEquipment: string): string[] {
  const tokens: string[] = [];
  // Split the whole string into option packages on ";" and standalone " or ".
  const packages = startingEquipment.split(/;\s*/);
  for (const pkg of packages) {
    // Strip a leading "or" and the "(A)/(B)/(C)" option marker.
    const cleaned = pkg
      .replace(/^\s*or\s+/i, '')
      .replace(/\(([A-C])\)\s*/g, '')
      .trim();
    if (!cleaned) continue;
    for (const raw of cleaned.split(',')) {
      const token = raw.trim();
      if (!token) continue;
      // Skip pure money tokens ("15 GP", "75 GP", "150 GP").
      if (/^\d+\s*GP$/i.test(token)) continue;
      // Skip the Monk's trailing qualifier clause "chosen for the tool
      // proficiency above" (describes the preceding choice, not a new item).
      if (/^chosen for the tool proficiency above$/i.test(token)) continue;
      tokens.push(token);
    }
  }
  return tokens;
}

/** True if a grant token is a player CHOICE (generic family / category / " or "). */
function isChoiceToken(token: string): boolean {
  if (/ or /i.test(token)) return true;
  const CHOICE_WORDS = [
    'Holy Symbol',
    'Druidic Focus',
    'Arcane Focus',
    'Musical Instrument',
    "Artisan's Tools",
    'Simple Weapon',
    'Martial Weapon',
  ];
  // A concrete parenthesised variant ("Arcane Focus (crystal)") is NOT a choice;
  // only the bare generic word is. So require an exact match to the generic word.
  return CHOICE_WORDS.includes(token);
}

describe('class starting-equipment coverage (derived from real data)', () => {
  it('every concrete grant token resolves to catalog entries with no gaps', () => {
    const failures: string[] = [];
    for (const c of CLASS_LIST) {
      for (const token of parseGrantTokens(c.startingEquipment)) {
        if (isChoiceToken(token)) continue; // choice tokens handled below
        const resolved: ResolvedItem[] = resolveEquipment(token);
        // A concrete token must not surface an unresolved choice...
        const leftoverChoice = resolved.find((r) => r.kind === 'choice');
        if (leftoverChoice) {
          failures.push(`${c.id}: concrete token "${token}" left an unresolved choice`);
          continue;
        }
        // ...and every resolved item must reference a real catalog entry
        // (a fall-back custom item has no catalogId).
        for (const r of resolved) {
          if (r.kind !== 'choice' && !r.item.catalogId) {
            failures.push(`${c.id}: token "${token}" fell back to a stat-less custom item (${r.item.name ?? '?'})`);
          }
        }
      }
    }
    expect(failures, `starting-equipment coverage gaps:\n${failures.join('\n')}`).toEqual([]);
  });

  it('every choice grant token resolves to a non-empty option set', () => {
    const failures: string[] = [];
    for (const c of CLASS_LIST) {
      for (const token of parseGrantTokens(c.startingEquipment)) {
        if (!isChoiceToken(token)) continue;
        const resolved = resolveEquipment(token);
        const choice = resolved.find((r) => r.kind === 'choice');
        if (!choice || choice.kind !== 'choice') {
          failures.push(`${c.id}: choice token "${token}" did not resolve to a choice`);
        } else if (choice.options.length === 0) {
          failures.push(`${c.id}: choice token "${token}" produced an empty option set`);
        }
      }
    }
    expect(failures, `choice-token coverage gaps:\n${failures.join('\n')}`).toEqual([]);
  });

  it('every option offered by a generic family choice is itself a real catalog entry', () => {
    // The player must land on a real catalog entry whichever option they pick.
    const families = ['Holy Symbol', 'Druidic Focus', 'Arcane Focus', 'Musical Instrument', "Artisan's Tools"];
    const failures: string[] = [];
    for (const family of families) {
      const resolved = resolveEquipment(family);
      const choice = resolved.find((r) => r.kind === 'choice');
      expect(choice, `family "${family}" did not resolve to a choice`).toBeTruthy();
      if (!choice || choice.kind !== 'choice') continue;
      expect(choice.options.length, `family "${family}" has no options`).toBeGreaterThan(0);
      for (const opt of choice.options) {
        const optResolved = resolveEquipment(opt);
        const concrete = optResolved.every((r) => r.kind !== 'choice' && !!r.item.catalogId);
        if (!concrete) failures.push(`${family} → option "${opt}" is not a concrete catalog entry`);
      }
    }
    expect(failures, `generic-family option gaps:\n${failures.join('\n')}`).toEqual([]);
  });

  it('sanity: every class actually has a non-empty startingEquipment string', () => {
    for (const c of CLASS_LIST) {
      expect(typeof c.startingEquipment).toBe('string');
      expect(c.startingEquipment.length).toBeGreaterThan(0);
    }
  });
});
