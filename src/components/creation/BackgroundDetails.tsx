import { ABILITY_NAMES, SKILLS } from '../../types/character';
import type { SkillId } from '../../types/character';
import { BACKGROUND_LIST, BACKGROUND_OPTION_B_GOLD } from '../../data/backgrounds';
import type { BackgroundData, BackgroundId } from '../../data/backgrounds';
import { getFeat } from '../../data/feats';
import { resolveFeatTooltip, resolveSkillTooltip } from '../../logic/tooltip-content';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import styles from './CreationWizard.module.css';

const SKILL_NAME = Object.fromEntries(SKILLS.map((s) => [s.id, s.name])) as Record<SkillId, string>;

function SkillList({ skills }: { skills: readonly SkillId[] }) {
  return (
    <>
      {skills.map((s, i) => (
        <span key={s}>
          {i > 0 && ' & '}
          <MaybeContentTooltip content={resolveSkillTooltip(s)} ariaLabel={`About ${SKILL_NAME[s]}`}>
            {SKILL_NAME[s]}
          </MaybeContentTooltip>
        </span>
      ))}
    </>
  );
}

function BackgroundFacts({ bg }: { bg: BackgroundData }) {
  const feat = getFeat(bg.originFeatId);
  return (
    <dl className={styles.bgFacts}>
      <dt>Ability scores</dt>
      <dd>{bg.abilities.map((a) => ABILITY_NAMES[a]).join(', ')}</dd>
      <dt>Skills</dt>
      <dd>
        <SkillList skills={bg.skills} />
      </dd>
      <dt>Tool</dt>
      <dd>{bg.tool.label}</dd>
      <dt>Origin feat</dt>
      <dd>
        <MaybeContentTooltip
          content={resolveFeatTooltip(bg.originFeatId)}
          ariaLabel={`About ${feat?.name ?? bg.originFeatId}`}
        >
          {feat?.name ?? bg.originFeatId}
        </MaybeContentTooltip>
      </dd>
      <dt>Equipment</dt>
      <dd>
        A: {bg.equipment.packageItems.join(', ')}, {bg.equipment.packageGold} GP. Or B:{' '}
        {BACKGROUND_OPTION_B_GOLD} GP.
      </dd>
    </dl>
  );
}

export interface BackgroundDetailsProps {
  selected: BackgroundData | undefined;
  onChoose: (id: BackgroundId) => void;
}

/**
 * Creation-wizard background help: a summary of the selected background and a
 * collapsible list comparing every background. Descriptions are paraphrased
 * (PHB 2024 "Background Descriptions"); the select above stays the one control
 * that holds the choice, "Choose" here just sets it.
 */
export function BackgroundDetails({ selected, onChoose }: BackgroundDetailsProps) {
  return (
    <>
      {selected ? (
        <section className={styles.bgPanel} aria-label={`${selected.name} background details`}>
          <h3 className={styles.guidanceTitle}>{selected.name}</h3>
          <p className={styles.hint}>{selected.description}</p>
          <BackgroundFacts bg={selected} />
          <p className={styles.guidanceCite}>Source: {selected.source}.</p>
        </section>
      ) : (
        <p className={styles.hint}>
          Pick a background to see what it grants, or compare them all below.
        </p>
      )}
      <details className={styles.bgCompare}>
        <summary className={styles.bgCompareSummary}>Compare all backgrounds</summary>
        <ul className={styles.bgCompareList}>
          {BACKGROUND_LIST.map((bg) => (
            <li key={bg.id} className={styles.bgCompareItem}>
              <div className={styles.bgCompareHead}>
                <strong>{bg.name}</strong>
                <button
                  type="button"
                  className={styles.bgChoose}
                  aria-label={`Choose ${bg.name}`}
                  aria-pressed={selected?.id === bg.id}
                  onClick={() => onChoose(bg.id)}
                >
                  {selected?.id === bg.id ? 'Chosen' : 'Choose'}
                </button>
              </div>
              <p className={styles.hint}>{bg.description}</p>
              <BackgroundFacts bg={bg} />
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
