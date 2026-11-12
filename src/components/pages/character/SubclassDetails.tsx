import type { ClassData, SubclassData } from '../../../data/classes';
import { SUBCLASS_INFO } from '../../../data/subclass-info';
import { resolveClassFeatureTooltip } from '../../../logic/tooltip-content';
import { ContentTooltip } from '../../shared/ContentTooltip';
import styles from './SubclassDetails.module.css';

function FeatureList({ subclass, className }: { subclass: SubclassData; className: string }) {
  const byLevel = [...subclass.features].sort((a, b) => a.level - b.level);
  return (
    <ul className={styles.features} aria-label={`${subclass.name} features`}>
      {byLevel.map((f) => (
        <li key={`${f.level}-${f.name}`}>
          <span className={styles.level}>Level {f.level}</span>{' '}
          <ContentTooltip content={resolveClassFeatureTooltip(f, `${className}: ${subclass.name}`)}>{f.name}</ContentTooltip>
        </li>
      ))}
    </ul>
  );
}

export interface SubclassDetailsProps {
  cls: ClassData;
  /** The character's level in this class. */
  classLevel: number;
  selectedId: string | undefined;
  onChoose: (id: string) => void;
}

/**
 * Subclass help on Class & Features, so a player choosing one knows what each
 * offers: the chosen subclass's summary and its features by level (each with
 * its tooltip), and a list comparing every subclass of the class with a
 * Choose button. Before the subclass level the list is a preview (no Choose).
 * Summaries are paraphrased from the PHB 2024 (data/subclass-info.ts).
 */
export function SubclassDetails({ cls, classLevel, selectedId, onChoose }: SubclassDetailsProps) {
  const selected = cls.subclasses.find((s) => s.id === selectedId);
  const canChoose = classLevel >= cls.subclassLevel;
  return (
    <div className={styles.wrap}>
      {selected ? (
        <section className={styles.panel} aria-label={`${selected.name} details`}>
          <h4 className={styles.title}>{selected.name}</h4>
          {SUBCLASS_INFO[selected.id] && <p className={styles.summary}>{SUBCLASS_INFO[selected.id].summary}</p>}
          <FeatureList subclass={selected} className={cls.name} />
          <p className={styles.cite}>Source: {SUBCLASS_INFO[selected.id]?.source ?? selected.source}.</p>
        </section>
      ) : canChoose ? (
        <p className={styles.hint}>Choose a subclass to see what it gives you, or compare them all below.</p>
      ) : (
        <p className={styles.hint}>
          You choose your {cls.name} subclass at level {cls.subclassLevel}. Preview them below.
        </p>
      )}
      <details className={styles.compare}>
        <summary className={styles.compareSummary}>
          {canChoose ? `Compare all ${cls.name} subclasses` : `Preview ${cls.name} subclasses`}
        </summary>
        <ul className={styles.compareList}>
          {cls.subclasses.map((s) => (
            <li key={s.id} className={styles.compareItem}>
              <div className={styles.compareHead}>
                <strong>{s.name}</strong>
                {canChoose && (
                  <button
                    type="button"
                    className={styles.choose}
                    aria-label={`Choose ${s.name}`}
                    aria-pressed={s.id === selectedId}
                    onClick={() => onChoose(s.id)}
                  >
                    {s.id === selectedId ? 'Chosen' : 'Choose'}
                  </button>
                )}
              </div>
              {SUBCLASS_INFO[s.id] && <p className={styles.summary}>{SUBCLASS_INFO[s.id].summary}</p>}
              <FeatureList subclass={s} className={cls.name} />
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
