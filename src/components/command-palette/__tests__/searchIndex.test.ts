import { describe, it, expect } from 'vitest';
import { buildSearchIndex, searchEntities } from '../searchIndex';
import { createCharacter } from '../../../storage/character-store';
import type { Character } from '../../../types/character';

/** A blank, class-less (non-caster) character. */
function nonCaster(): Character {
  return createCharacter();
}

/** A full-caster character (Wizard). */
function caster(): Character {
  return { ...createCharacter(), level: 3, classes: [{ id: 'wizard', level: 3 }] };
}

describe('buildSearchIndex — page entries', () => {
  it('includes a "Go to <page>" command for every unconditional page', () => {
    const index = buildSearchIndex(nonCaster());
    const pageNames = index
      .filter((e) => e.displayData.type === 'page')
      .map((e) => e.name);
    expect(pageNames).toEqual(
      expect.arrayContaining([
        'Go to Character',
        'Go to Combat',
        'Go to Inventory',
        'Go to Advancement',
        'Go to Settings',
      ]),
    );
  });

  it('gates the Spells page command on isSpellcaster (hidden for a non-caster)', () => {
    const index = buildSearchIndex(nonCaster());
    const hasSpells = index.some(
      (e) => e.displayData.type === 'page' && e.displayData.page === 'spells',
    );
    expect(hasSpells).toBe(false);
  });

  it('offers the Spells page command for a spellcaster', () => {
    const index = buildSearchIndex(caster());
    const spells = index.find(
      (e) => e.displayData.type === 'page' && e.displayData.page === 'spells',
    );
    expect(spells).toBeDefined();
    expect(spells!.name).toBe('Go to Spells');
  });

  it('with no character still offers the unconditional pages but not Spells', () => {
    const index = buildSearchIndex(undefined);
    const spells = index.some(
      (e) => e.displayData.type === 'page' && e.displayData.page === 'spells',
    );
    expect(spells).toBe(false);
    expect(index.some((e) => e.id === 'page-character')).toBe(true);
  });
});

describe('buildSearchIndex — actions and conditions', () => {
  it('includes app actions', () => {
    const index = buildSearchIndex(nonCaster());
    const actions = index.filter((e) => e.displayData.type === 'action').map((e) => e.id);
    expect(actions).toEqual(
      expect.arrayContaining([
        'action-toggle-theme',
        'action-manage-characters',
        'action-open-settings',
      ]),
    );
  });

  it('includes condition reference entries', () => {
    const index = buildSearchIndex(nonCaster());
    const conditions = index.filter((e) => e.displayData.type === 'condition');
    expect(conditions.length).toBeGreaterThan(0);
    expect(conditions.some((e) => e.id === 'condition-prone')).toBe(true);
  });
});

describe('searchEntities', () => {
  it('returns no groups for an empty query', () => {
    const index = buildSearchIndex(caster());
    const result = searchEntities(index, '   ');
    expect(result.totalCount).toBe(0);
    expect(result.groups).toEqual([]);
  });

  it('finds a page command by fuzzy query and groups it under Pages', () => {
    const index = buildSearchIndex(caster());
    const result = searchEntities(index, 'spells');
    const pageGroup = result.groups.find((g) => g.type === 'page');
    expect(pageGroup).toBeDefined();
    expect(pageGroup!.entries.some((e) => e.entity.displayData.type === 'page')).toBe(true);
  });

  it('does not surface a Spells page result for a non-caster', () => {
    const index = buildSearchIndex(nonCaster());
    const result = searchEntities(index, 'spells');
    const found = result.groups
      .flatMap((g) => g.entries)
      .some(
        (e) => e.entity.displayData.type === 'page' && e.entity.displayData.page === 'spells',
      );
    expect(found).toBe(false);
  });
});
