import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ABILITIES } from '../../types/character';
import type { Character, SpeciesSelection } from '../../types/character';
import { createCharacter } from '../../storage/character-store';
import { allAbilityModifiers } from '../abilities';
import {
  darkvisionBreakdown,
  resolveSize,
  resolveSpecies,
  speciesTraits,
  speedBreakdown,
} from '../species';
import * as speciesModule from '../species';
import { SPECIES_LIST } from '../../data/species';

function withSpecies(selection?: SpeciesSelection): Character {
  const c = createCharacter('T');
  if (selection) c.species = selection;
  return c;
}

/** Every species + the exhaustive sub-choice combinations for property tests. */
function allSelections(): SpeciesSelection[] {
  const selections: SpeciesSelection[] = [];
  for (const species of SPECIES_LIST) {
    if (!species.choices || species.choices.length === 0) {
      selections.push({ id: species.id });
      continue;
    }
    // One base selection plus one per option of each choice (enough to cover
    // every lineage/ancestry/legacy/size path without a full cartesian blowup).
    selections.push({ id: species.id });
    for (const choice of species.choices) {
      for (const option of choice.options.length ? choice.options : [{ id: 'athletics' }]) {
        selections.push({
          id: species.id,
          [choice.field]: option.id,
        } as SpeciesSelection);
      }
    }
  }
  return selections;
}

describe('speedBreakdown', () => {
  // Test 7.
  it('no species → base 30 ft', () => {
    const bd = speedBreakdown(withSpecies());
    expect(bd.total).toBe(30);
    expect(bd.components).toEqual([{ label: 'Base speed', value: 30 }]);
  });

  it('Goliath → 35 ft as a single base component', () => {
    const bd = speedBreakdown(withSpecies({ id: 'goliath' }));
    expect(bd.total).toBe(35);
    expect(bd.components).toEqual([{ label: 'Base species speed', value: 35 }]);
  });

  it('Wood Elf → 35 ft, components sum to 35 (base 30 + 5) with a note', () => {
    const bd = speedBreakdown(withSpecies({ id: 'elf', elvenLineage: 'woodElf' }));
    expect(bd.total).toBe(35);
    expect(bd.components).toEqual([
      { label: 'Base species speed', value: 30 },
      { label: 'Wood Elf lineage', value: 5 },
    ]);
    expect(bd.note).toMatch(/35/);
  });

  it('Elf with a non-Wood lineage keeps base 30', () => {
    const bd = speedBreakdown(withSpecies({ id: 'elf', elvenLineage: 'drow' }));
    expect(bd.total).toBe(30);
  });

  it('property: speed components always sum to total for every selection', () => {
    for (const selection of allSelections()) {
      const bd = speedBreakdown(withSpecies(selection));
      expect(bd.components.reduce((s, c) => s + c.value, 0)).toBe(bd.total);
    }
  });
});

describe('darkvisionBreakdown', () => {
  // Test 8.
  it('Elf → 60 ft single component', () => {
    const bd = darkvisionBreakdown(withSpecies({ id: 'elf' }));
    expect(bd.total).toBe(60);
    expect(bd.components).toEqual([{ label: 'Species darkvision', value: 60 }]);
  });

  it('Drow → 120 ft, components sum to 120 with a superseded note', () => {
    const bd = darkvisionBreakdown(withSpecies({ id: 'elf', elvenLineage: 'drow' }));
    expect(bd.total).toBe(120);
    expect(bd.components).toEqual([
      { label: 'Species darkvision (Elf)', value: 60 },
      { label: 'Drow lineage override', value: 60 },
    ]);
    expect(bd.note).toMatch(/120/);
  });

  it('Dwarf/Orc → 120 ft; Halfling/Human/Goliath/none → 0', () => {
    expect(darkvisionBreakdown(withSpecies({ id: 'dwarf' })).total).toBe(120);
    expect(darkvisionBreakdown(withSpecies({ id: 'orc' })).total).toBe(120);
    expect(darkvisionBreakdown(withSpecies({ id: 'halfling' })).total).toBe(0);
    expect(darkvisionBreakdown(withSpecies({ id: 'human' })).total).toBe(0);
    expect(darkvisionBreakdown(withSpecies({ id: 'goliath' })).total).toBe(0);
    expect(darkvisionBreakdown(withSpecies()).total).toBe(0);
  });

  it('property: darkvision components always sum to total for every selection', () => {
    for (const selection of allSelections()) {
      const bd = darkvisionBreakdown(withSpecies(selection));
      expect(bd.components.reduce((s, c) => s + c.value, 0)).toBe(bd.total);
    }
  });
});

describe('resolveSize', () => {
  // Test 9.
  it('fixed-size species resolve to their size', () => {
    expect(resolveSize(withSpecies({ id: 'dwarf' }))).toBe('medium');
    expect(resolveSize(withSpecies({ id: 'gnome' }))).toBe('small');
    expect(resolveSize(withSpecies({ id: 'goliath' }))).toBe('medium');
  });

  it('choice species reflect the stored size, or undefined when unset', () => {
    expect(resolveSize(withSpecies({ id: 'human', size: 'small' }))).toBe('small');
    expect(resolveSize(withSpecies({ id: 'human', size: 'medium' }))).toBe('medium');
    expect(resolveSize(withSpecies({ id: 'human' }))).toBeUndefined();
    expect(resolveSize(withSpecies({ id: 'tiefling' }))).toBeUndefined();
  });

  it('no species → undefined', () => {
    expect(resolveSize(withSpecies())).toBeUndefined();
  });
});

describe('resolveSpecies / speciesTraits', () => {
  it('tolerates an unknown/absent species id', () => {
    expect(resolveSpecies(withSpecies())).toBeUndefined();
    expect(
      resolveSpecies(withSpecies({ id: 'bogus' as SpeciesSelection['id'] })),
    ).toBeUndefined();
    expect(speciesTraits(withSpecies())).toEqual([]);
  });

  it('returns the selected species traits', () => {
    const traits = speciesTraits(withSpecies({ id: 'dwarf' }));
    expect(traits.map((t) => t.name)).toContain('Dwarven Toughness');
  });

  it('resolves Dragonborn Damage Resistance text from the chosen ancestry', () => {
    const traits = speciesTraits(
      withSpecies({ id: 'dragonborn', draconicAncestry: 'red' }),
    );
    const resist = traits.find((t) => t.name === 'Damage Resistance');
    expect(resist?.effect).toMatch(/Fire/);
  });

  it('resolves Tiefling Fiendish Legacy text from the chosen legacy', () => {
    const traits = speciesTraits(
      withSpecies({ id: 'tiefling', fiendishLegacy: 'infernal' }),
    );
    const legacy = traits.find((t) => t.name === 'Fiendish Legacy');
    expect(legacy?.effect).toMatch(/Infernal/);
  });
});

describe('languages (2024: species grant none)', () => {
  // Test 10.
  it('grantedLanguages is empty for every species', () => {
    for (const s of SPECIES_LIST) {
      expect(s.grantedLanguages).toEqual([]);
    }
  });
});

describe('FR-9: no species applies an ability score increase', () => {
  // Test 11 — the required 2024-rule guard.
  const baseline = allAbilityModifiers(createCharacter('T').abilities);

  it('selecting any species / sub-choice leaves all six ability modifiers unchanged', () => {
    for (const selection of allSelections()) {
      const c = withSpecies(selection);
      const mods = allAbilityModifiers(c.abilities);
      for (const ability of ABILITIES) {
        expect(mods[ability]).toBe(baseline[ability]);
      }
    }
  });

  it('property: no selection perturbs the ability scores vs. the same no-species character', () => {
    fc.assert(
      fc.property(
        fc.record({
          str: fc.integer({ min: 1, max: 30 }),
          dex: fc.integer({ min: 1, max: 30 }),
          con: fc.integer({ min: 1, max: 30 }),
          int: fc.integer({ min: 1, max: 30 }),
          wis: fc.integer({ min: 1, max: 30 }),
          cha: fc.integer({ min: 1, max: 30 }),
        }),
        fc.constantFrom(...SPECIES_LIST.map((s) => s.id)),
        (scores, speciesId) => {
          const noSpecies = { ...createCharacter('T'), abilities: scores };
          const withSp: Character = { ...noSpecies, species: { id: speciesId } };
          // resolveSpecies/traits never read abilities; prove abilities are
          // untouched by resolving everything the species logic exposes.
          resolveSpecies(withSp);
          speciesTraits(withSp);
          speedBreakdown(withSp);
          darkvisionBreakdown(withSp);
          resolveSize(withSp);
          expect(withSp.abilities).toEqual(noSpecies.abilities);
          expect(allAbilityModifiers(withSp.abilities)).toEqual(
            allAbilityModifiers(noSpecies.abilities),
          );
        },
      ),
    );
  });

  it('the species logic module exposes no ability-score / ASI function', () => {
    const exported = Object.keys(speciesModule);
    for (const name of exported) {
      expect(name).not.toMatch(/abilit|asi|score/i);
    }
  });
});
