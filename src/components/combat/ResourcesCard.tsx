import { Hourglass } from 'lucide-react';
import type { Character } from '../../types/character';
import {
  characterResources,
  rechargeLabel,
  regainResource,
  setResourceRemaining,
  spendResource,
  usesUnitLabel,
} from '../../logic/resources';
import type { ResourceState } from '../../logic/resources';
import { resolveResourceTooltip } from '../../logic/tooltip-content';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import styles from './ResourcesCard.module.css';

export interface ResourcesCardProps {
  character: Character;
  onChange: (next: Character) => void;
}

/** Group heading: the class (with subclass names kept per row), Feats, or Eldritch Invocations. */
function groupLabel(state: ResourceState): string {
  if (state.sourceKind === 'feat') return 'Feats';
  if (state.sourceKind === 'invocation') return 'Eldritch Invocations';
  return state.ownerName;
}

/**
 * The editable Resources card (D1): per-use tracking for class, subclass, feat and
 * Eldritch Invocation features. This is the ONE place resources are edited; the
 * Overview mirrors them read-only. Everything (max, tooltips, recharge) comes
 * from logic/resources.ts; spent counts are stored on `character.resourcesSpent`.
 * Renders nothing when the character has no limited-use features.
 */
export function ResourcesCard({ character, onChange }: ResourcesCardProps) {
  const states = characterResources(character);
  if (states.length === 0) return null;

  const groups: Array<{ label: string; rows: ResourceState[] }> = [];
  for (const state of states) {
    const label = groupLabel(state);
    const group = groups.find((g) => g.label === label);
    if (group) group.rows.push(state);
    else groups.push({ label, rows: [state] });
  }

  return (
    <Card>
      <div className={styles.stack}>
        <SectionHeader icon={Hourglass} title="Resources" />
        <p className={styles.hint}>Limited-use features. Short and Long Rests restore them as the rules say.</p>
        {groups.map((group) => (
          <section key={group.label} className={styles.group} aria-label={`${group.label} resources`}>
            <h3 className={styles.groupTitle}>{group.label}</h3>
            <ul className={styles.list}>
              {group.rows.map((state) => {
                const tooltip = resolveResourceTooltip(character, state);
                const name = tooltip ? <ContentTooltip content={tooltip}>{state.name}</ContentTooltip> : state.name;
                const inputId = `resource-remaining-${state.id}`;
                return (
                  <li key={state.id} className={styles.row} data-testid="resource-row">
                    <div className={styles.head}>
                      <span className={styles.name}>{name}</span>
                      {state.subclassName && <span className={styles.tag}>{state.subclassName}</span>}
                      <span className={styles.count} data-testid="resource-count">
                        {state.remaining} /{' '}
                        <CalculatedValue label={`${state.name} maximum`} breakdown={state.maxBreakdown}>
                          {state.max}
                        </CalculatedValue>{' '}
                        {usesUnitLabel(state, state.max)}
                        {state.dieSize !== undefined ? ` (d${state.dieSize})` : ''}
                      </span>
                    </div>
                    <div className={styles.controls}>
                      <button
                        type="button"
                        className={styles.btn}
                        disabled={state.remaining <= 0}
                        aria-label={`Spend one use of ${state.name}`}
                        onClick={() => onChange(spendResource(character, state.id))}
                      >
                        Spend
                      </button>
                      <button
                        type="button"
                        className={styles.btn}
                        disabled={state.spent <= 0}
                        aria-label={`Regain one use of ${state.name}`}
                        onClick={() => onChange(regainResource(character, state.id))}
                      >
                        Regain
                      </button>
                      <label className={styles.remainingLabel} htmlFor={inputId}>
                        Remaining
                      </label>
                      <input
                        id={inputId}
                        className={styles.input}
                        type="number"
                        min={0}
                        max={state.max}
                        value={state.remaining}
                        aria-label={`${state.name} remaining`}
                        onChange={(e) => {
                          if (e.target.value === '') return;
                          onChange(setResourceRemaining(character, state.id, Number(e.target.value)));
                        }}
                      />
                    </div>
                    <p className={styles.note}>Recharge: {rechargeLabel(state.recharge)}</p>
                    {state.uses.alsoRestoredBy && (
                      <p className={styles.note}>Also restored by: {state.uses.alsoRestoredBy}</p>
                    )}
                    {state.spendsFeatures.length > 0 && (
                      <p className={styles.note}>Spent by: {state.spendsFeatures.map((f) => f.name).join(', ')}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  );
}
