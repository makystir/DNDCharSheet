import { useState } from 'react';
import type { CSSProperties } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Character } from '../../types/character';
import {
  CONDITION_COLORS,
  CONDITION_COLOR_FALLBACK,
  EXHAUSTION,
  getCondition,
  type ConditionId,
} from '../../data/conditions';
import {
  addCondition,
  dropCondition,
  exhaustionEffects,
  exhaustionLevelOf,
  setConditionDetails,
  setExhaustion,
} from '../../logic/conditions';
import { resolveConditionTooltip, resolveExhaustionLevelTooltip } from '../../logic/tooltip-content';
import { derivedConditionIds, knockOut } from '../../logic/hit-points-state';
import { Card } from '../shared/Card';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import { AddButton } from '../shared/AddButton';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import { ConditionPicker } from './ConditionPicker';
import styles from './ActiveConditions.module.css';

export interface ActiveConditionsProps {
  character: Character;
  onChange: (next: Character) => void;
}

/**
 * Active Conditions section for the Combat tab. Mirrors the PWACharSheet
 * CombatDashboard condition-badge row (colour-coded badge per condition with a
 * descriptive tooltip, a remove control, and an add control that opens the
 * ConditionPicker). It records conditions and shows derived information
 * (implied conditions, Exhaustion penalties); it never changes any other
 * derived total.
 *
 * Stage A5a additions (decision D2): conditions the character has because it is
 * at 0 HP (Unconscious plus the Incapacitated and Prone it implies) are shown as
 * read-only "from 0 HP" badges and are never written to `character.conditions`;
 * a separate, explicit "Knock out" button WRITES Unconscious (ends 'Short Rest').
 */
export function ActiveConditions({ character, onChange }: ActiveConditionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmKnockOut, setConfirmKnockOut] = useState(false);
  // De-duplicate by id so hand-edited/imported data cannot yield duplicate keys.
  const active = (character.conditions ?? []).filter((c, i, arr) => arr.findIndex((o) => o.id === c.id) === i);
  const exhaustion = exhaustionLevelOf(character);
  // Read-only conditions derived from 0 HP (never stored; decision D2).
  const derived = derivedConditionIds(character);
  const canKnockOut = knockOut(character) !== null;
  const isEmpty = active.length === 0 && exhaustion === 0 && derived.length === 0;

  const badgeStyle = (id: ConditionId): CSSProperties => {
    const c = CONDITION_COLORS[id] ?? CONDITION_COLOR_FALLBACK;
    return { backgroundColor: c.bg, color: c.text, borderColor: c.bg };
  };

  const impliedText = (id: ConditionId): string | null => {
    const implies = getCondition(id)?.implies ?? [];
    if (implies.length === 0) return null;
    return `Also applies: ${implies.map((i) => getCondition(i)?.name ?? i).join(', ')}`;
  };

  const effects = exhaustion > 0 ? exhaustionEffects(exhaustion) : null;
  const exhaustionTooltip = exhaustion > 0 ? resolveExhaustionLevelTooltip(exhaustion) : null;

  return (
    <Card>
      <SectionHeader
        icon={AlertTriangle}
        title="Active Conditions"
        action={
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.knockBtn}
              disabled={!canKnockOut}
              title="A melee attack that would reduce a creature to 0 HP can leave it at 1 HP and Unconscious instead"
              onClick={() => setConfirmKnockOut(true)}
            >
              Knock out
            </button>
            <AddButton label="Add Condition" onClick={() => setPickerOpen(true)} />
          </div>
        }
      />
      {isEmpty ? (
        <EmptyState
          compact
          icon={AlertTriangle}
          heading="No Conditions"
          description="No active conditions. Use Add Condition to apply one."
        />
      ) : (
        <div className={styles.list} data-testid="active-conditions">
          {active.map((cond) => {
            const data = getCondition(cond.id);
            const tip = resolveConditionTooltip(cond.id);
            const implied = impliedText(cond.id);
            return (
              <div key={cond.id} className={styles.row} data-testid={`active-${cond.id}`}>
                <div className={styles.badgeLine}>
                  <div className={styles.badge} style={badgeStyle(cond.id)}>
                    {tip ? (
                      <ContentTooltip content={tip} className={styles.badgeName}>
                        {data?.name ?? cond.id}
                      </ContentTooltip>
                    ) : (
                      <span>{data?.name ?? cond.id}</span>
                    )}
                    <button
                      type="button"
                      className={styles.removeBtn}
                      aria-label={`Remove ${data?.name ?? cond.id}`}
                      onClick={() => onChange(dropCondition(character, cond.id))}
                    >
                      {'\u2715'}
                    </button>
                  </div>
                </div>
                {implied && <span className={styles.implied}>{implied}</span>}
                <label className={styles.endsLabel}>
                  Ends / note
                  <input
                    className={styles.endsInput}
                    type="text"
                    value={cond.ends ?? ''}
                    placeholder="e.g. save ends, 1 minute, until a Long Rest"
                    aria-label={`${data?.name ?? cond.id} ends note`}
                    onChange={(e) =>
                      onChange({
                        ...character,
                        conditions: setConditionDetails(character.conditions, cond.id, {
                          ends: e.target.value,
                        }),
                      })
                    }
                  />
                </label>
              </div>
            );
          })}

          {derived.map((id) => {
            const data = getCondition(id);
            const tip = resolveConditionTooltip(id);
            return (
              <div key={id} className={styles.row} data-testid={`derived-${id}`}>
                <div className={styles.badgeLine}>
                  <div className={styles.badge} style={badgeStyle(id)}>
                    {tip ? (
                      <ContentTooltip content={tip} className={styles.badgeName}>
                        {data?.name ?? id}
                      </ContentTooltip>
                    ) : (
                      <span>{data?.name ?? id}</span>
                    )}
                    <span className={styles.derivedTag}>from 0 HP</span>
                  </div>
                </div>
                <span className={styles.implied}>
                  Applies while at 0 Hit Points. It ends when Hit Points are regained, and cannot be removed here.
                </span>
              </div>
            );
          })}

          {exhaustion > 0 && effects && (
            <div className={styles.row} data-testid="active-exhaustion">
              <div className={styles.badgeLine}>
                <div
                  className={styles.badge}
                  style={badgeStyle('exhaustion')}
                >
                  {exhaustionTooltip ? (
                    <ContentTooltip content={exhaustionTooltip} className={styles.badgeName}>
                      {`Exhaustion (${exhaustion})`}
                    </ContentTooltip>
                  ) : (
                    <span>{`Exhaustion (${exhaustion})`}</span>
                  )}
                  <button
                    type="button"
                    className={styles.removeBtn}
                    aria-label="Remove Exhaustion"
                    onClick={() => onChange(dropCondition(character, 'exhaustion'))}
                  >
                    {'\u2715'}
                  </button>
                </div>
                <div className={styles.stepper} role="group" aria-label="Exhaustion level">
                  <button
                    type="button"
                    className={styles.stepBtn}
                    aria-label="Decrease Exhaustion level"
                    onClick={() => onChange(setExhaustion(character, exhaustion - 1))}
                  >
                    {'\u2212'}
                  </button>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    aria-label="Increase Exhaustion level"
                    disabled={exhaustion >= EXHAUSTION.maxLevel}
                    onClick={() => onChange(addCondition(character, 'exhaustion'))}
                  >
                    +
                  </button>
                </div>
              </div>
              <span className={styles.effectLine}>
                D20 Tests:
                <span className={styles.effectValue}>
                  <CalculatedValue label="Exhaustion D20 Test penalty" breakdown={effects.d20Test} />
                </span>
                Speed:
                <span className={styles.effectValue}>
                  <CalculatedValue label="Exhaustion Speed reduction (ft)" breakdown={effects.speed}>
                    {`${effects.speed.total} ft`}
                  </CalculatedValue>
                </span>
              </span>
              {effects.fatal && (
                <span className={styles.fatal} role="alert">
                  Exhaustion level {EXHAUSTION.deathLevel}: the character dies.
                </span>
              )}
              <span className={styles.implied}>
                Applied to in-app rolls such as Death Saving Throws; not applied to the static skill, save, attack, or Speed totals.
              </span>
            </div>
          )}
        </div>
      )}

      {confirmKnockOut && (
        <ConfirmDialog
          message="Knock out the character? Hit Points become 1 and the Unconscious condition is added (ends after a Short Rest)."
          confirmLabel="Knock out"
          onConfirm={() => {
            setConfirmKnockOut(false);
            const next = knockOut(character);
            if (next) onChange(next);
          }}
          onCancel={() => setConfirmKnockOut(false)}
        />
      )}

      {pickerOpen && (
        <ConditionPicker
          conditions={active}
          exhaustionLevel={exhaustion}
          onApply={(id) => onChange(addCondition(character, id))}
          onRemove={(id) => onChange(dropCondition(character, id))}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </Card>
  );
}
