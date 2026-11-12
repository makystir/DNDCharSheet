import { SPECIES_LIST } from '../../data/species';
import type { SpeciesData, SpeciesId } from '../../data/species';
import { SPECIES_INFO } from '../../logic/creation-guidance';
import { resolveSpeciesTraitTooltip } from '../../logic/tooltip-content';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import styles from './CreationWizard.module.css';

const sizeText = (size: SpeciesData['size']): string =>
  size === 'choice' ? 'Small or Medium (your choice)' : size.charAt(0).toUpperCase() + size.slice(1);

function SpeciesFacts({ species }: { species: SpeciesData }) {
  return (
    <dl className={styles.bgFacts}>
      <dt>Size</dt>
      <dd>{sizeText(species.size)}</dd>
      <dt>Speed</dt>
      <dd>{species.baseSpeedFt} ft</dd>
      <dt>Darkvision</dt>
      <dd>{species.darkvisionFt > 0 ? `${species.darkvisionFt} ft` : 'None'}</dd>
      <dt>Traits</dt>
      <dd>
        {species.traits.map((t, i) => (
          <span key={t.name}>
            {i > 0 && ', '}
            <MaybeContentTooltip content={resolveSpeciesTraitTooltip(t, species.name)} ariaLabel={`About ${t.name}`}>
              {t.name}
            </MaybeContentTooltip>
          </span>
        ))}
      </dd>
    </dl>
  );
}

export interface SpeciesDetailsProps {
  selected: SpeciesData | undefined;
  onChoose: (id: SpeciesId) => void;
}

/**
 * Creation-wizard species help: who the selected species are (a short paraphrase
 * of the PHB introduction), its size, Speed, Darkvision and traits (each with
 * its tooltip), and a collapsible list comparing every species. The select
 * above holds the choice; "Choose" here just sets it.
 */
export function SpeciesDetails({ selected, onChoose }: SpeciesDetailsProps) {
  return (
    <>
      {/* PHB 2024: ability score increases come from the background (L1720), and
          older books' species increases are ignored (L1695-1698). */}
      <p className={styles.hint} role="note">
        In the 2024 rules your species doesn&apos;t change your ability scores (your background does),
        so pick the people you&apos;d enjoy playing.
      </p>
      {selected ? (
        <section className={styles.bgPanel} aria-label={`${selected.name} species details`}>
          <h3 className={styles.guidanceTitle}>{selected.name}</h3>
          {SPECIES_INFO[selected.id] && <p className={styles.hint}>{SPECIES_INFO[selected.id].summary}</p>}
          <SpeciesFacts species={selected} />
          <p className={styles.guidanceCite}>
            Source: {SPECIES_INFO[selected.id]?.source ?? selected.source}; {selected.source}.
          </p>
        </section>
      ) : (
        <p className={styles.hint}>Pick a species to see its traits, or compare them all below.</p>
      )}
      <details className={styles.bgCompare}>
        <summary className={styles.bgCompareSummary}>Compare all species</summary>
        <ul className={styles.bgCompareList}>
          {SPECIES_LIST.map((s) => (
            <li key={s.id} className={styles.bgCompareItem}>
              <div className={styles.bgCompareHead}>
                <strong>{s.name}</strong>
                <button
                  type="button"
                  className={styles.bgChoose}
                  aria-label={`Choose ${s.name}`}
                  aria-pressed={selected?.id === s.id}
                  onClick={() => onChoose(s.id as SpeciesId)}
                >
                  {selected?.id === s.id ? 'Chosen' : 'Choose'}
                </button>
              </div>
              {SPECIES_INFO[s.id] && <p className={styles.hint}>{SPECIES_INFO[s.id].summary}</p>}
              <SpeciesFacts species={s} />
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
