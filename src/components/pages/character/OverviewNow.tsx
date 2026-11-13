import type { CSSProperties, ReactNode } from 'react';
import { Gauge } from 'lucide-react';
import type { Character } from '../../../types/character';
import {
  CONDITIONS,
  CONDITION_COLORS,
  CONDITION_COLOR_FALLBACK,
  EXHAUSTION,
  getCondition,
  type ConditionId,
} from '../../../data/conditions';
import { exhaustionEffects, exhaustionLevelOf, impliedConditions } from '../../../logic/conditions';
import { describeDuration } from '../../../logic/condition-duration';
import { derivedConditionIds, effectiveConditionIds, effectiveDeathSaves, lifeStatus } from '../../../logic/hit-points-state';
import { isReactionBlocked, isReactionSpent } from '../../../logic/reactions';
import { characterResources, usesUnitLabel } from '../../../logic/resources';
import { anySpellcaster, effectiveSpellSlots, pactMagicSlotsForClass, spellSlotAvailableBreakdown } from '../../../logic/spellcasting';
import { resolveConditionTooltip, resolveExhaustionLevelTooltip } from '../../../logic/tooltip-content';
import { Card } from '../../shared/Card';
import { CalculatedValue } from '../../shared/CalculatedValue';
import { ContentTooltip } from '../../shared/ContentTooltip';
import { SectionHeader } from '../../shared/SectionHeader';
import { SpellName } from '../../shared/SpellName';
import { OverviewEmpty, OverviewFooter } from './OverviewShared';
import styles from './OverviewNow.module.css';

export interface OverviewNowProps {
  character: Character;
}

const badgeStyle = (id: ConditionId): CSSProperties => {
  const c = CONDITION_COLORS[id] ?? CONDITION_COLOR_FALLBACK;
  return { backgroundColor: c.bg, color: c.text, borderColor: c.bg };
};

function Row({ label, children, testId }: { label: string; children: ReactNode; testId: string }) {
  return (
    <div className={styles.row} data-testid={testId}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.rowBody}>{children}</div>
    </div>
  );
}

/**
 * The Overview "Right now" card: a compact, read-only summary of what is
 * affecting the character and what they have left, for use between fights.
 * Combat owns every control (conditions, death saves, reactions, resources);
 * the Spells page and rests own spell slots. Each row hides when it has nothing
 * to show:
 *  - conditions as chips (each chip's tooltip holds the condition's effects;
 *    0-HP and implied conditions are marked), Exhaustion with its D20 Test and
 *    Speed penalties;
 *  - the spell being concentrated on; death saves at 0 HP;
 *  - the Reaction, only when it is used or blocked;
 *  - limited-use feature counts and spell slots.
 * Every number comes from the logic layer with its breakdown tooltip.
 */
export function OverviewNow({ character }: OverviewNowProps) {
  // Conditions: stored + 0-HP derived + implied, in catalog order; Exhaustion apart.
  const implied = new Map(impliedConditions(character).map((i) => [i.id, i.impliedBy]));
  const shown = new Set<ConditionId>([...effectiveConditionIds(character), ...implied.keys()]);
  const ids = CONDITIONS.map((c) => c.id).filter((id) => id !== 'exhaustion' && shown.has(id));
  const derived = new Set(derivedConditionIds(character));
  const stored = new Set<ConditionId>((character.conditions ?? []).map((c) => c.id));
  const exhaustion = exhaustionLevelOf(character);
  const exhaustionFx = exhaustion > 0 ? exhaustionEffects(exhaustion) : null;
  const exhaustionTip = exhaustion > 0 ? resolveExhaustionLevelTooltip(exhaustion) : null;
  const durationOf = (id: ConditionId) => describeDuration((character.conditions ?? []).find((c) => c.id === id)?.duration);

  const showDeathSaves = lifeStatus(character) === 'making-death-saves';
  const saves = effectiveDeathSaves(character);
  const reactionNote = isReactionBlocked(character)
    ? "Can't take Reactions (Incapacitated)"
    : isReactionSpent(character)
      ? 'Reaction used this round'
      : null;
  const resources = characterResources(character);

  // Spell slots: the combined pool by level, plus a separate Pact Magic pool.
  const slotRows: { key: string; label: string; max: number; expended: number }[] = [];
  if (anySpellcaster(character)) {
    const slots = effectiveSpellSlots(character);
    const expended = character.spellcasting?.slotsExpended ?? {};
    for (let level = 1; level <= 9; level++) {
      const max = slots?.[level] ?? 0;
      if (max > 0) slotRows.push({ key: `l${level}`, label: `Level ${level}`, max, expended: expended[level] ?? 0 });
    }
    const pact = pactMagicSlotsForClass(character);
    if (pact && pact.slots > 0) {
      slotRows.push({ key: 'pact', label: `Pact Magic (level ${pact.slotLevel})`, max: pact.slots, expended: character.spellcasting?.pactSlotsExpended ?? 0 });
    }
  }

  const hasConditions = ids.length > 0 || exhaustion > 0;
  const isEmpty =
    !hasConditions && !character.concentration && !showDeathSaves && !reactionNote && resources.length === 0 && slotRows.length === 0;

  return (
    <Card>
      <SectionHeader icon={Gauge} title="Right now" />
      {isEmpty ? (
        <OverviewEmpty text="Nothing affecting you and nothing to track" />
      ) : (
        <div className={styles.rows}>
          {hasConditions && (
            <Row label="Conditions" testId="now-conditions">
              <ul className={styles.chips} aria-label="Active conditions">
                {ids.map((id) => {
                  const data = getCondition(id);
                  const tip = resolveConditionTooltip(id);
                  const origin = stored.has(id)
                    ? null
                    : derived.has(id)
                      ? 'from 0 HP'
                      : `implied by ${(implied.get(id) ?? []).map((i) => getCondition(i)?.name ?? i).join(', ')}`;
                  const duration = durationOf(id);
                  const label = data?.name ?? id;
                  return (
                    <li key={id} className={styles.chipItem} data-testid={`now-condition-${id}`}>
                      <span className={styles.badge} style={badgeStyle(id)}>
                        {tip ? <ContentTooltip content={tip}>{label}</ContentTooltip> : label}
                      </span>
                      {(origin || duration) && <span className={styles.meta}>{[origin, duration].filter(Boolean).join(', ')}</span>}
                    </li>
                  );
                })}
                {exhaustionFx && (
                  <li className={styles.chipItem} data-testid="now-condition-exhaustion">
                    <span className={styles.badge} style={badgeStyle('exhaustion')}>
                      {exhaustionTip ? (
                        <ContentTooltip content={exhaustionTip}>{`Exhaustion (${exhaustion})`}</ContentTooltip>
                      ) : (
                        `Exhaustion (${exhaustion})`
                      )}
                    </span>
                    <span className={styles.meta}>
                      D20 Tests <CalculatedValue label="Exhaustion D20 Test penalty" breakdown={exhaustionFx.d20Test} />, Speed{' '}
                      <CalculatedValue label="Exhaustion Speed reduction (ft)" breakdown={exhaustionFx.speed}>
                        {`${exhaustionFx.speed.total} ft`}
                      </CalculatedValue>
                    </span>
                  </li>
                )}
              </ul>
              {exhaustionFx?.fatal && (
                <p className={styles.fatal} role="alert">
                  Exhaustion level {EXHAUSTION.deathLevel}: the character dies.
                </p>
              )}
            </Row>
          )}

          {character.concentration && (
            <Row label="Concentrating" testId="now-concentration">
              <span className={styles.value}>
                <SpellName id={character.concentration.spellId} />
              </span>
            </Row>
          )}

          {showDeathSaves && (
            <Row label="Death saves" testId="now-death-saves">
              <span className={styles.pips} role="img" aria-label={`Successes ${saves.successes} of 3`}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`${styles.pip} ${i < saves.successes ? styles.success : ''}`}>
                    {i < saves.successes ? '\u2713' : ''}
                  </span>
                ))}
              </span>
              <span className={styles.pips} role="img" aria-label={`Failures ${saves.failures} of 3`}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`${styles.pip} ${i < saves.failures ? styles.failure : ''}`}>
                    {i < saves.failures ? '\u2715' : ''}
                  </span>
                ))}
              </span>
            </Row>
          )}

          {reactionNote && (
            <Row label="Reaction" testId="now-reaction">
              <span className={styles.value}>{reactionNote}</span>
            </Row>
          )}

          {resources.length > 0 && (
            <Row label="Resources" testId="now-resources">
              <ul className={styles.counts} aria-label="Limited-use features">
                {resources.map((state) => (
                  <li key={state.id} className={styles.count} data-testid="now-resource">
                    <span className={styles.countName}>{state.name}</span>{' '}
                    <span className={styles.countValue}>
                      {state.remaining} /{' '}
                      <CalculatedValue label={`${state.name} maximum`} breakdown={state.maxBreakdown}>
                        {state.max}
                      </CalculatedValue>{' '}
                      {usesUnitLabel(state, state.max)}
                    </span>
                  </li>
                ))}
              </ul>
            </Row>
          )}

          {slotRows.length > 0 && (
            <Row label="Spell slots" testId="now-spell-slots">
              <ul className={styles.counts} aria-label="Spell slots">
                {slotRows.map((row) => (
                  <li key={row.key} className={styles.count}>
                    <span className={styles.countName}>{row.label}</span>{' '}
                    <span className={styles.countValue}>
                      <CalculatedValue
                        label={`${row.label} slots available`}
                        breakdown={spellSlotAvailableBreakdown(row.max, row.expended, row.label)}
                      >
                        {Math.max(0, row.max - row.expended)} / {row.max}
                      </CalculatedValue>
                    </span>
                  </li>
                ))}
              </ul>
            </Row>
          )}
        </div>
      )}
      <OverviewFooter links={[{ href: '#combat', text: 'Manage on Combat' }]} />
    </Card>
  );
}
