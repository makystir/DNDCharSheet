/**
 * Species rules (D&D 5.5e / 2024).
 *
 * Pure resolvers over a character's species selection and the data catalog
 * (src/data/species.ts), following the initiative.ts / saving-throws.ts
 * pattern: each function tolerates an unset or unknown `species` and returns a
 * sensible default, and each derived total is a Breakdown whose components sum
 * to its total (calculated-totals steering; breakdown.ts invariant).
 *
 * NO ABILITY SCORE INCREASES. In 2024 a species grants Creature Type, Size,
 * Speed, and Special Traits only — ability increases come from the Background
 * (PHB 2024 "Parts of a Species"; older-books rule: ignore species ASIs). This
 * module never reads or writes `character.abilities` and exposes no
 * ability-score function. (FR-9; locked in by species.test.ts.)
 */

import type { Character } from '../types/character';
import type { Breakdown } from './breakdown';
import type { CreatureSize, SpeciesData, SpeciesTrait } from '../data/species';
import { getSpecies } from '../data/species';

/** The default walking speed shown when no species is selected, in feet. */
const DEFAULT_SPEED_FT = 30;

/** Resolves the selected species data, or undefined when unset/unknown. */
export function resolveSpecies(character: Character): SpeciesData | undefined {
  return getSpecies(character.species?.id);
}

/**
 * Finds the Wood Elf speed override (35 ft) when the Elf's chosen lineage is
 * Wood Elf, else undefined. PHB 2024 "Elven Lineages": Wood Elf "Speed
 * increases to 35 feet" — modelled as an additive contributor in speedBreakdown
 * so the components still sum to the total.
 */
function woodElfSpeedOverride(character: Character): number | undefined {
  const species = resolveSpecies(character);
  if (species?.id !== 'elf') return undefined;
  if (character.species?.elvenLineage !== 'woodElf') return undefined;
  // The override value lives on the Elf's Darkvision/lineage data via the
  // option note; the numeric value (35) is the single mechanical fact used.
  return 35;
}

/**
 * Walking Speed with a breakdown (PHB 2024 "Parts of a Species": species sets
 * Speed; "Elven Lineages": Wood Elf 35).
 *
 * - No species → 30 ft labelled "Base speed" (the human-scale default the sheet
 *   shows before a species is chosen; a non-species display default, not a
 *   species-granted value).
 * - A species with base speed S and no override → one "Base species speed"
 *   component of S (e.g. Goliath 35).
 * - Wood Elf → base 30 + a "Wood Elf lineage" +5 component, summing to 35, with
 *   a note recording the RAW wording.
 */
export function speedBreakdown(character: Character): Breakdown {
  const species = resolveSpecies(character);
  if (!species) {
    return {
      total: DEFAULT_SPEED_FT,
      components: [{ label: 'Base speed', value: DEFAULT_SPEED_FT }],
    };
  }

  const base = species.baseSpeedFt;
  const override = woodElfSpeedOverride(character);
  if (override === undefined) {
    return {
      total: base,
      components: [{ label: 'Base species speed', value: base }],
    };
  }

  const bonus = override - base;
  return {
    total: override,
    components: [
      { label: 'Base species speed', value: base },
      { label: 'Wood Elf lineage', value: bonus },
    ],
    note: `Wood Elf lineage sets Speed to ${override} ft (PHB 2024 "Elven Lineages").`,
  };
}

/**
 * Resolves the effective darkvision range in feet, applying the Drow lineage
 * override (120 ft) when the Elf's chosen lineage is Drow. PHB 2024 species
 * "Darkvision" traits; "Elven Lineages" (Drow 120).
 */
function resolveDarkvisionFt(character: Character): number {
  const species = resolveSpecies(character);
  if (!species) return 0;
  if (species.id === 'elf' && character.species?.elvenLineage === 'drow') {
    return 120;
  }
  return species.darkvisionFt;
}

/**
 * Darkvision range with a breakdown (PHB 2024 species "Darkvision"; "Elven
 * Lineages" Drow 120). Darkvision is a range that is set, not summed, so the
 * normal case is a single component; the Drow lineage shows base 60 + a +60
 * override component (summing to 120) with a superseded note. No darkvision →
 * total 0 (the UI renders "none").
 */
export function darkvisionBreakdown(character: Character): Breakdown {
  const species = resolveSpecies(character);
  const effective = resolveDarkvisionFt(character);

  if (
    species?.id === 'elf' &&
    character.species?.elvenLineage === 'drow' &&
    species.darkvisionFt !== effective
  ) {
    const base = species.darkvisionFt;
    return {
      total: effective,
      components: [
        { label: 'Species darkvision (Elf)', value: base },
        { label: 'Drow lineage override', value: effective - base },
      ],
      note: `Drow lineage sets Darkvision range to ${effective} ft (supersedes base ${base}).`,
    };
  }

  return {
    total: effective,
    components: [{ label: 'Species darkvision', value: effective }],
  };
}

/**
 * The effective size: a fixed species' size, the stored chosen size for a
 * Small/Medium species, or undefined when unset or no species (PHB 2024 species
 * "Size"). Categorical, so this is a plain resolver, not a Breakdown.
 */
export function resolveSize(character: Character): CreatureSize | undefined {
  const species = resolveSpecies(character);
  if (!species) return undefined;
  if (species.size === 'choice') return character.species?.size;
  return species.size;
}

/**
 * The selected species' traits, with sub-choice-dependent text resolved where a
 * numeric/mechanical value depends on the choice (e.g. Dragonborn Damage
 * Resistance and Tiefling Fiendish Legacy name the chosen damage type). Pure
 * descriptive strings — not a computed total, so no Breakdown (FR-8).
 */
export function speciesTraits(character: Character): SpeciesTrait[] {
  const species = resolveSpecies(character);
  if (!species) return [];
  return species.traits.map((trait) => resolveTraitText(species, character, trait));
}

/** Resolves a chosen option's label/note from a species' choice spec. */
function resolveChoiceOption(
  species: SpeciesData,
  kind: string,
  chosenId: string | undefined,
): { label: string; note?: string } | undefined {
  if (chosenId === undefined) return undefined;
  const spec = species.choices?.find((c) => c.kind === kind);
  return spec?.options.find((o) => o.id === chosenId);
}

/**
 * Appends the chosen sub-choice's damage type to the traits whose mechanical
 * value depends on it, so the surfaced trait text reflects the player's choice.
 * The damage type comes from the option `note` (transcribed from the PHB
 * ancestry/legacy tables), never invented.
 */
function resolveTraitText(
  species: SpeciesData,
  character: Character,
  trait: SpeciesTrait,
): SpeciesTrait {
  // Dragonborn Damage Resistance / Breath Weapon name the ancestry damage type.
  if (species.id === 'dragonborn' && trait.name === 'Damage Resistance') {
    const chosen = resolveChoiceOption(
      species,
      'draconicAncestry',
      character.species?.draconicAncestry,
    );
    if (chosen?.note) {
      return { ...trait, effect: `Resistance to ${chosen.note} damage (${chosen.label} ancestry).` };
    }
  }
  // Tiefling Fiendish Legacy names the legacy's resistance + cantrip.
  if (species.id === 'tiefling' && trait.name === 'Fiendish Legacy') {
    const chosen = resolveChoiceOption(
      species,
      'fiendishLegacy',
      character.species?.fiendishLegacy,
    );
    if (chosen?.note) {
      return { ...trait, effect: `${chosen.label} legacy: ${chosen.note}. Plus spells at levels 3 and 5.` };
    }
  }
  return trait;
}
