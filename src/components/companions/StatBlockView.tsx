import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { CONDITIONS } from '../../data/conditions';
import {
  resolveConditionTooltip,
  resolveCreatureFeatureTooltip,
  resolveCreatureTooltip,
} from '../../logic/tooltip-content';
import type { CreatureFeatureSection } from '../../logic/tooltip-content';
import type { StatBlockModel, StatFeature, StatLine, StatValue } from '../../logic/stat-block-model';
import { CalculatedValue } from '../shared/CalculatedValue';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import styles from './StatBlockView.module.css';

export interface StatBlockViewProps {
  model: StatBlockModel;
  /** Hide the name heading (the card header already shows it). */
  hideName?: boolean;
  /** Shown when the model has no content at all (a custom block nobody has filled in). */
  emptyHint?: ReactNode;
}

/** Render a value as a CalculatedValue when it has a breakdown, else as plain text. */
function Value({ value, fallbackLabel }: { value: StatValue; fallbackLabel: string }) {
  if (value.breakdown) {
    return (
      <CalculatedValue label={value.breakdownLabel ?? fallbackLabel} breakdown={value.breakdown}>
        {value.text}
      </CalculatedValue>
    );
  }
  return <>{value.text}</>;
}

/** Text with a content tooltip on each token that names a condition ("Charmed, Poisoned"). */
function ConditionAwareText({ text }: { text: string }) {
  const tokens = text.split(/,\s*/);
  return (
    <>
      {tokens.map((token, i) => {
        const cond = CONDITIONS.find((c) => c.name.toLowerCase() === token.trim().toLowerCase());
        return (
          <Fragment key={`${token}-${i}`}>
            {i > 0 && ', '}
            {cond ? (
              <MaybeContentTooltip content={resolveConditionTooltip(cond.id)}>{token}</MaybeContentTooltip>
            ) : (
              token
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function Line({ line }: { line: StatLine }) {
  return (
    <div className={styles.line}>
      <dt className={styles.lineLabel}>{line.label}</dt>
      <dd className={styles.lineValue}>
        {line.label === 'Immunities' && !line.value.breakdown ? (
          <ConditionAwareText text={line.value.text} />
        ) : (
          <Value value={line.value} fallbackLabel={line.label} />
        )}
      </dd>
    </div>
  );
}

function FeatureList({
  title,
  section,
  features,
  creatureId,
}: {
  title: string;
  section: CreatureFeatureSection;
  features: StatFeature[];
  creatureId?: string;
}) {
  if (features.length === 0) return null;
  return (
    <section className={styles.featureSection} aria-label={title}>
      <h4 className={styles.featureHeading}>{title}</h4>
      <ul className={styles.featureList}>
        {features.map((f, i) => (
          <li key={`${f.name}-${i}`} className={styles.feature}>
            <span className={styles.featureName}>
              <MaybeContentTooltip content={creatureId ? resolveCreatureFeatureTooltip(creatureId, section, f.name) : null}>
                {f.name}
              </MaybeContentTooltip>
              {f.usage ? ` (${f.usage})` : ''}.
            </span>{' '}
            <span className={styles.featureText}>{f.description}</span>
            {f.derived.length > 0 && (
              <span className={styles.derivedLines}>
                {f.derived.map((d, j) => (
                  <span key={`${d.label}-${j}`} className={styles.derived}>
                    {d.label}: {d.prefix}
                    <Value value={d.value} fallbackLabel={`${f.name} ${d.label}`} />
                    {d.suffix}
                  </span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The 2024 stat block layout: AC, Initiative, HP, Speed; the six abilities with
 * Score, MOD and SAVE columns; skills, senses, languages, challenge; then traits,
 * actions, bonus actions and reactions. Used for every creature on the
 * Companions page (catalog creatures and hand-entered hireling / NPC blocks), so
 * it only renders the model it is given and never reads the character.
 *
 * Presentation deviation from the WFRP HirelingCard: that card shows a
 * 12-characteristic grid; D&D stat blocks are six abilities with MOD and SAVE.
 */
export function StatBlockView({ model, hideName, emptyHint }: StatBlockViewProps) {
  const hasAbilityData = model.abilities.some((a) => a.score !== '');
  const isEmpty =
    !model.ac && !model.initiative && !model.hp && !model.speed && !hasAbilityData && model.lines.length === 0 &&
    model.traits.length + model.actions.length + model.bonusActions.length + model.reactions.length === 0;
  if (isEmpty && emptyHint) return <>{emptyHint}</>;

  return (
    <div className={styles.block} data-testid="stat-block">
      {!hideName && (
        <h3 className={styles.name}>
          <MaybeContentTooltip content={model.creatureId ? resolveCreatureTooltip(model.creatureId) : null}>
            {model.name}
          </MaybeContentTooltip>
        </h3>
      )}
      {model.subtitle && <p className={styles.subtitle}>{model.subtitle}</p>}

      <dl className={styles.vitals}>
        {model.ac && (
          <div className={styles.vital}>
            <dt>AC</dt>
            <dd>
              <Value value={model.ac} fallbackLabel="Armor Class" />
            </dd>
          </div>
        )}
        {model.initiative && (
          <div className={styles.vital}>
            <dt>Initiative</dt>
            <dd>
              <Value value={model.initiative} fallbackLabel="Initiative" />
            </dd>
          </div>
        )}
        {model.hp && (
          <div className={styles.vital}>
            <dt>HP</dt>
            <dd>
              <Value value={model.hp} fallbackLabel="Hit Points" />
            </dd>
          </div>
        )}
        {model.speed && (
          <div className={styles.vital}>
            <dt>Speed</dt>
            <dd>{model.speed}</dd>
          </div>
        )}
      </dl>

      {hasAbilityData && (
        <table className={styles.abilities}>
          <caption className={styles.srOnly}>Ability scores</caption>
          <thead>
            <tr>
              <th scope="col">Ability</th>
              <th scope="col">Score</th>
              <th scope="col">MOD</th>
              <th scope="col">SAVE</th>
            </tr>
          </thead>
          <tbody>
            {model.abilities.map((a) => (
              <tr key={a.key}>
                <th scope="row">{a.name}</th>
                <td>{a.score}</td>
                <td>
                  <Value value={a.mod} fallbackLabel={`${a.name} modifier`} />
                </td>
                <td>
                  <Value value={a.save} fallbackLabel={`${a.name} saving throw`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {model.lines.length > 0 && (
        <dl className={styles.lines}>
          {model.lines.map((l) => (
            <Line key={l.label} line={l} />
          ))}
        </dl>
      )}

      <FeatureList title="Traits" section="traits" features={model.traits} creatureId={model.creatureId} />
      <FeatureList title="Actions" section="actions" features={model.actions} creatureId={model.creatureId} />
      <FeatureList title="Bonus Actions" section="bonusActions" features={model.bonusActions} creatureId={model.creatureId} />
      <FeatureList title="Reactions" section="reactions" features={model.reactions} creatureId={model.creatureId} />
    </div>
  );
}
