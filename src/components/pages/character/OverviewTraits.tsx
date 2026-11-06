import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Character, FeatSelection } from '../../../types/character';
import { SKILLS } from '../../../types/character';
import { getFeat } from '../../../data/feats';
import { proficiencyBonusBreakdown } from '../../../logic/abilities';
import { classFeaturesByLevelTagged } from '../../../logic/classes';
import { characterFeats } from '../../../logic/feats';
import { speciesTraits } from '../../../logic/species';
import { Card } from '../../shared/Card';
import { CalculatedValue } from '../../shared/CalculatedValue';
import { CollapsibleSection } from '../../shared/CollapsibleSection';
import { SectionHeader } from '../../shared/SectionHeader';
import styles from './OverviewTraits.module.css';

export interface OverviewTraitsProps {
  character: Character;
}

/** One-line text that expands on demand (keyboard accessible button). */
function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <p className={expanded ? styles.text : `${styles.text} ${styles.clamped}`}>{text}</p>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </>
  );
}

function choiceLine(selection: FeatSelection): string | null {
  const choices = selection.choices;
  if (!choices) return null;
  const parts: string[] = [];
  if (choices.skills?.length) {
    parts.push(
      `Skills: ${choices.skills.map((id) => SKILLS.find((s) => s.id === id)?.name ?? id).join(', ')}`,
    );
  }
  if (choices.tools?.length) parts.push(`Tools: ${choices.tools.join(', ')}`);
  if (choices.notes?.trim()) parts.push(choices.notes.trim());
  return parts.length > 0 ? parts.join(' \u00B7 ') : null;
}

/**
 * Read-only mirror of species traits, feats and gained class features. The
 * effect texts come from the existing data catalogs; feats are edited only on
 * Advancement, class on Class & Features.
 */
export function OverviewTraits({ character }: OverviewTraitsProps) {
  const traits = speciesTraits(character);
  const feats = characterFeats(character);
  const proficiency = proficiencyBonusBreakdown(character.level);
  const features = [...classFeaturesByLevelTagged(character).values()]
    .flat()
    // Hide ASI / Epic Boon placeholders; those appear as feats once chosen.
    .filter(({ feature }) => feature.kind !== 'asi-marker');

  return (
    <Card>
      <SectionHeader icon={Sparkles} title="Traits & Feats" />
      <CollapsibleSection title="Traits, feats and features" storageKey="dnd-collapse-overview-traits">
        <div className={styles.groups}>
          <section className={styles.group} aria-label="Species traits">
            <h4 className={styles.groupTitle}>Species traits</h4>
            {traits.length === 0 ? (
              <p className={styles.muted}>No species selected.</p>
            ) : (
              <ul className={styles.list}>
                {traits.map((trait) => (
                  <li key={trait.name} className={styles.item} data-testid="overview-species-trait">
                    <span className={styles.name}>{trait.name}</span>
                    <ExpandableText text={trait.effect} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.group} aria-label="Feats">
            <h4 className={styles.groupTitle}>Feats</h4>
            {feats.length === 0 ? (
              <p className={styles.muted}>No feats yet.</p>
            ) : (
              <ul className={styles.list}>
                {feats.map((selection, i) => {
                  const feat = getFeat(selection.featId);
                  const choices = choiceLine(selection);
                  return (
                    <li
                      key={`${selection.featId}-${selection.level}-${i}`}
                      className={styles.item}
                      data-testid="overview-feat"
                    >
                      <span className={styles.name}>
                        {feat?.name ?? selection.featId}
                        <span className={styles.tag}>
                          {selection.level === 0 ? 'Origin (Background)' : 'Feat'}
                        </span>
                      </span>
                      {feat && <ExpandableText text={feat.effect} />}
                      {selection.featId === 'lucky' && (
                        <p className={styles.derived} data-testid="overview-lucky">
                          Luck Points: up to{' '}
                          <CalculatedValue label="Proficiency Bonus" breakdown={proficiency} />{' '}
                          per Long Rest
                        </p>
                      )}
                      {choices && <p className={styles.muted}>{choices}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
            <a className={styles.manage} href="#advancement">
              Manage feats on Advancement
            </a>
          </section>

          <section className={styles.group} aria-label="Class features">
            <h4 className={styles.groupTitle}>Class features</h4>
            {features.length === 0 ? (
              <p className={styles.muted}>No class selected.</p>
            ) : (
              <ul className={styles.list}>
                {features.map(({ feature, classId }) => (
                  <li key={`${classId}-${feature.name}-${feature.level}`} className={styles.line}>
                    <span className={styles.name}>{feature.name}</span>
                    <span className={styles.muted}>Level {feature.level}</span>
                  </li>
                ))}
              </ul>
            )}
            <a className={styles.manage} href="#character/build">
              Full list on Class &amp; Features
            </a>
          </section>
        </div>
      </CollapsibleSection>
    </Card>
  );
}
