import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character } from '../../types/character';
import type { ClassId } from '../../data/classes';
import { pendingSetupChoices } from '../starting-choices';
import { pendingSpellPicks, spellPickLabel } from '../spell-picks-pending';

function caster(id: string, level: number, extra: Partial<Character> = {}): Character {
  return { ...createCharacter('Tester'), level, classes: [{ id: id as ClassId, level }], ...extra };
}

describe('pendingSpellPicks', () => {
  it('Wizard 2 with nothing chosen owes cantrips, spellbook and prepared spells', () => {
    const picks = pendingSpellPicks(caster('wizard', 2));
    expect(picks.map((p) => p.kind)).toEqual(['cantrips', 'spellbook', 'prepared']);
    // Counts are the Wizard table values: 3 cantrips, spellbook 6 + 2, 4 prepared at level 2.
    expect(picks.find((p) => p.kind === 'spellbook')).toMatchObject({ have: 0, need: 8 });
  });

  it('reuses pendingSetupChoices without recomputing: same counts, minus class skills', () => {
    const character = caster('wizard', 3);
    const fromSetup = pendingSetupChoices(character).filter((i) => i.kind !== 'class-skills');
    const picks = pendingSpellPicks(character);
    expect(picks.map((p) => [p.kind, p.have, p.need])).toEqual(fromSetup.map((i) => [i.kind, i.have, i.need]));
  });

  it('never includes class skills', () => {
    expect(pendingSpellPicks(caster('fighter', 5))).toEqual([]);
  });

  it('a non-caster owes nothing', () => {
    expect(pendingSpellPicks(caster('barbarian', 10))).toEqual([]);
  });

  it('completing the picks clears the items', () => {
    const wizard = caster('wizard', 1);
    const owed = pendingSpellPicks(wizard);
    expect(owed.length).toBeGreaterThan(0);
    // Fill a Cleric instead of hand-building a Wizard spellbook: level 1 Cleric owes cantrips + prepared.
    const done = pendingSpellPicks(
      caster('cleric', 1, {
        spellcasting: {
          byClass: {
            cleric: {
              cantrips: ['guidance', 'light', 'sacred-flame'],
              prepared: ['bless', 'cure-wounds', 'command', 'shield-of-faith'],
            },
          },
        },
      } as Partial<Character>),
    );
    expect(done.every((p) => p.kind !== 'cantrips')).toBe(true);
  });

  it('multiclass items name their class', () => {
    const character: Character = {
      ...createCharacter('Tester'),
      level: 4,
      classes: [
        { id: 'wizard' as ClassId, level: 2 },
        { id: 'cleric' as ClassId, level: 2 },
      ],
    };
    const labels = pendingSpellPicks(character).map(spellPickLabel);
    expect(labels).toContain('Wizard cantrips');
    expect(labels).toContain('Cleric cantrips');
  });

  it('Warlock 11 owes the level 6 Mystic Arcanum; choosing it clears the item', () => {
    const warlock = caster('warlock', 11);
    const arcanum = pendingSpellPicks(warlock).filter((p) => p.kind === 'mystic-arcanum');
    expect(arcanum).toEqual([expect.objectContaining({ spellLevel: 6, need: 1, have: 0 })]);
    expect(spellPickLabel(arcanum[0])).toBe('Level 6 Mystic Arcanum spell');
    const chosen = caster('warlock', 11, {
      spellcasting: { mysticArcana: { 6: 'disintegrate' } },
    } as Partial<Character>);
    expect(pendingSpellPicks(chosen).filter((p) => p.kind === 'mystic-arcanum')).toEqual([]);
  });

  it('Mystic Arcanum cardinality by Warlock level: 11/13/15/17 owe 1/2/3/4 spell levels', () => {
    const counts = [10, 11, 12, 13, 15, 16, 17, 20].map(
      (lvl) => pendingSpellPicks(caster('warlock', lvl)).filter((p) => p.kind === 'mystic-arcanum').length,
    );
    expect(counts).toEqual([0, 1, 1, 2, 3, 3, 4, 4]);
  });

  it('a Warlock taken as a second class uses its own Warlock level for the arcanum', () => {
    const character: Character = {
      ...createCharacter('Tester'),
      level: 12,
      classes: [
        { id: 'fighter' as ClassId, level: 5 },
        { id: 'warlock' as ClassId, level: 7 },
      ],
    };
    expect(pendingSpellPicks(character).filter((p) => p.kind === 'mystic-arcanum')).toEqual([]);
  });
});
