import { Users } from 'lucide-react';
import type { Character } from '../../../types/character';
import { resolveSize, resolveSpecies, speciesTraits } from '../../../logic/species';
import { knownLanguages } from '../../../logic/languages';
import { SPECIES_LIST } from '../../../data/species';
import type { SpeciesChoiceSpec } from '../../../data/species';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { SIZE_LABELS, choiceOptions, formatLanguage } from '../sheet-helpers';
import styles from './SpeciesSection.module.css';

export interface SpeciesSectionProps {
  character: Character;
  /** Select a species (empty string clears it); owned by the page. */
  onSpeciesChange: (raw: string) => void;
  /** Write one species sub-choice field (empty string unsets it); owned by the page. */
  onSpeciesChoiceChange: (field: SpeciesChoiceSpec['field'], raw: string) => void;
}

/**
 * Species selector + sub-choices, Size, Languages and the species trait list.
 * This is the ONLY species editor on the sheet; it sits at the top of the
 * Overview with Personal Details so it reads as part of who the character is.
 * Speed and Darkvision are derived from the species but are shown in the
 * Overview vitals strip, not here.
 */
export function SpeciesSection({
  character,
  onSpeciesChange,
  onSpeciesChoiceChange,
}: SpeciesSectionProps) {
  const selectedSpecies = resolveSpecies(character);
  // Languages: Common is always known plus chosen and class-granted languages
  // (PHB 2024 "Choose Languages"). Stored ids are lowercase; formatLanguage
  // title-cases them for display.
  const knownLangs = knownLanguages(character);
  const size = resolveSize(character);
  const traits = speciesTraits(character);

  return (
    <Card>
      <SectionHeader icon={Users} title="Species" />
      <div className={styles.speciesGrid}>
        <div className={styles.speciesField}>
          <label className={styles.fieldLabel} htmlFor="species-select">
            Species
          </label>
          <select
            id="species-select"
            className={styles.speciesSelect}
            value={character.species?.id ?? ''}
            aria-label="Species"
            onChange={(e) => onSpeciesChange(e.target.value)}
          >
            <option value="">— None —</option>
            {SPECIES_LIST.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {selectedSpecies?.choices?.map((spec) => {
          const value = (character.species?.[spec.field] as string | undefined) ?? '';
          const options = choiceOptions(spec);
          const selectId = `species-choice-${spec.field}`;
          return (
            <div key={spec.field} className={styles.speciesField}>
              <label className={styles.fieldLabel} htmlFor={selectId}>
                {spec.label}
              </label>
              <select
                id={selectId}
                className={styles.speciesSelect}
                value={value}
                aria-label={spec.label}
                onChange={(e) => onSpeciesChoiceChange(spec.field, e.target.value)}
              >
                <option value="">choose…</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                    {o.note ? ` (${o.note})` : ''}
                  </option>
                ))}
              </select>
            </div>
          );
        })}

        <div className={styles.speciesField}>
          <span className={styles.fieldLabel}>Size</span>
          <span className={styles.speciesText}>{size ? SIZE_LABELS[size] : '—'}</span>
        </div>

        <div className={styles.speciesField}>
          <span className={styles.fieldLabel}>Languages</span>
          <span className={styles.speciesText}>
            <span>
              {knownLangs.map(formatLanguage).join(', ')}
              {knownLangs.length === 1 && (
                <span className={styles.speciesNote}> (choose more in character creation)</span>
              )}
            </span>
          </span>
        </div>
      </div>

      {traits.length > 0 && (
        <ul className={styles.traitList} aria-label="Species Traits">
          {traits.map((trait) => (
            <li key={trait.name} className={styles.traitRow}>
              <span className={styles.traitName}>{trait.name}</span>
              <span className={styles.traitEffect}>{trait.effect}</span>
              <span className={styles.traitSource}>source: {trait.source}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
