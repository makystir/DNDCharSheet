import { ABILITY_NAMES } from '../../types/character';
import { CLASS_LIST } from '../../data/classes';
import type { ClassId } from '../../data/classes';
import { classGuidance } from '../../logic/class-guidance';
import { CLASS_OVERVIEW, CLASS_OVERVIEW_SOURCE, lowComplexityClasses } from '../../logic/creation-guidance';
import styles from './CreationWizard.module.css';

export interface ClassCompareProps {
  selected: ClassId | '';
  onChoose: (id: ClassId) => void;
}

/**
 * Creation-wizard class help for players who don't know the classes yet: a tip
 * naming the PHB's Low-complexity classes, and a collapsible list comparing
 * every class (what it likes, how complex it is, its primary ability, Hit Die
 * and a one-line summary). The select above stays the one control that holds
 * the choice; "Choose" here just sets it.
 */
export function ClassCompare({ selected, onChoose }: ClassCompareProps) {
  const easy = lowComplexityClasses()
    .map((id) => CLASS_LIST.find((c) => c.id === id)?.name ?? id)
    .join(' and ');
  return (
    <>
      <p className={styles.hint} role="note" aria-label="Tip for new players">
        New to D&amp;D? The Player&apos;s Handbook rates {easy} as Low complexity, the simplest classes to
        learn. Compare every class below.
      </p>
      <details className={styles.bgCompare}>
        <summary className={styles.bgCompareSummary}>Compare all classes</summary>
        <ul className={styles.bgCompareList}>
          {CLASS_LIST.map((c) => {
            const g = classGuidance(c.id);
            const row = CLASS_OVERVIEW[c.id];
            return (
              <li key={c.id} className={styles.bgCompareItem}>
                <div className={styles.bgCompareHead}>
                  <strong>{c.name}</strong>
                  <button
                    type="button"
                    className={styles.bgChoose}
                    aria-label={`Choose ${c.name}`}
                    aria-pressed={selected === c.id}
                    onClick={() => onChoose(c.id as ClassId)}
                  >
                    {selected === c.id ? 'Chosen' : 'Choose'}
                  </button>
                </div>
                {g?.blurb && <p className={styles.hint}>{g.blurb}</p>}
                <dl className={styles.bgFacts}>
                  {row && (
                    <>
                      <dt>Likes</dt>
                      <dd>{row.likes}</dd>
                      <dt>Complexity</dt>
                      <dd>{row.complexity}</dd>
                    </>
                  )}
                  {g && (
                    <>
                      <dt>Primary ability</dt>
                      <dd>{g.primaryAbilities.map((a) => ABILITY_NAMES[a]).join(g.primaryIsOr ? ' or ' : ' & ')}</dd>
                      <dt>Hit Die</dt>
                      <dd>d{g.hitDie}</dd>
                      <dt>Casts spells</dt>
                      <dd>{g.spellcastingAbility ? `Yes (${ABILITY_NAMES[g.spellcastingAbility]})` : 'No'}</dd>
                    </>
                  )}
                </dl>
              </li>
            );
          })}
        </ul>
        <p className={styles.guidanceCite}>Source: {CLASS_OVERVIEW_SOURCE}; PHB 2024 Core Class Traits.</p>
      </details>
    </>
  );
}
