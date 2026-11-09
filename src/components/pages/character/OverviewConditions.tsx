import type { CSSProperties } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Character } from '../../../types/character';
import {
  CONDITIONS,
  CONDITION_COLORS,
  CONDITION_COLOR_FALLBACK,
  EXHAUSTION,
  getCondition,
  type ConditionId,
} from '../../../data/conditions';
import { getSpell } from '../../../data/spells';
import { exhaustionEffects, exhaustionLevelOf, impliedConditions } from '../../../logic/conditions';
import { attackerConditionSuggestions } from '../../../logic/attacks';
import { describeDuration, durationBreakdown } from '../../../logic/condition-duration';
import {
  derivedConditionIds,
  effectiveConditionIds,
  effectiveDeathSaves,
  lifeStatus,
} from '../../../logic/hit-points-state';
import { resolveConditionTooltip, resolveExhaustionLevelTooltip } from '../../../logic/tooltip-content';
import { Card } from '../../shared/Card';
import { CalculatedValue } from '../../shared/CalculatedValue';
import { ContentTooltip } from '../../shared/ContentTooltip';
import { SectionHeader } from '../../shared/SectionHeader';
import { OverviewEmpty, OverviewFooter } from './OverviewShared';
import { SpellName } from '../../shared/SpellName';
import styles from './OverviewConditions.module.css';

export interface OverviewConditionsProps {
  character: Character;
}

/** Effect lines shown before the rest fold into "More". */
const VISIBLE_EFFECTS = 2;

const badgeStyle = (id: ConditionId): CSSProperties => {
  const c = CONDITION_COLORS[id] ?? CONDITION_COLOR_FALLBACK;
  return { backgroundColor: c.bg, color: c.text, borderColor: c.bg };
};

/**
 * Read-only mirror of the character's active conditions with each condition's
 * effect text (from the conditions catalog; no rules text is written here).
 * Conditions are managed only on Combat. Death saves appear only at 0 HP.
 */
export function OverviewConditions({ character }: OverviewConditionsProps) {
  // Stored + 0-HP derived, in catalog order. Exhaustion is shown separately.
  const implied = new Map(impliedConditions(character).map((i) => [i.id, i.impliedBy]));
  const shown = new Set<ConditionId>([...effectiveConditionIds(character), ...implied.keys()]);
  const ids = CONDITIONS.map((c) => c.id).filter((id) => id !== 'exhaustion' && shown.has(id));
  const derived = new Set(derivedConditionIds(character));
  const stored = new Set<ConditionId>((character.conditions ?? []).map((c) => c.id));
  const exhaustion = exhaustionLevelOf(character);
  const exhaustionFx = exhaustion > 0 ? exhaustionEffects(exhaustion) : null;
  const exhaustionTip = exhaustion > 0 ? resolveExhaustionLevelTooltip(exhaustion) : null;
  const concentrationSpell = character.concentration
    ? (getSpell(character.concentration.spellId)?.name ?? character.concentration.spellId)
    : null;
  const status = lifeStatus(character);
  const showDeathSaves = status === 'making-death-saves';
  const saves = effectiveDeathSaves(character);
  const suggestions = attackerConditionSuggestions(character);
  const isEmpty = ids.length === 0 && exhaustion === 0;

  // Stage E: the structured duration, read-only here (edited on Combat only).
  const durationOf = (id: ConditionId) => (character.conditions ?? []).find((c) => c.id === id)?.duration;
  const durationText = (id: ConditionId): string | null => describeDuration(durationOf(id));
  const durationNode = (id: ConditionId) => {
    const duration = durationOf(id);
    const text = describeDuration(duration);
    const breakdown = durationBreakdown(duration);
    if (!text) return null;
    return breakdown ? (
      <CalculatedValue label={`${getCondition(id)?.name ?? id} remaining rounds`} breakdown={breakdown}>
        {text}
      </CalculatedValue>
    ) : (
      text
    );
  };

  const attackLine = (side: 'advantage' | 'disadvantage'): string | null => {
    const names = suggestions
      .filter((s) => s.side === side)
      .map((s) => getCondition(s.conditionId)?.name ?? s.conditionId);
    if (names.length === 0) return null;
    const label = side === 'advantage' ? 'Advantage' : 'Disadvantage';
    return `${label} (${[...new Set(names)].join(', ')})`;
  };
  const attackLines = (['advantage', 'disadvantage'] as const)
    .map(attackLine)
    .filter((l): l is string => l !== null);

  return (
    <Card>
      <SectionHeader icon={AlertTriangle} title="Conditions & Effects" />
      {isEmpty ? (
        <OverviewEmpty text="No active conditions" />
      ) : (
        <ul className={styles.list} aria-label="Active conditions">
          {ids.map((id) => {
            const data = getCondition(id);
            const tip = resolveConditionTooltip(id);
            const effects = data?.effects ?? [];
            const origin = !stored.has(id)
              ? derived.has(id)
                ? 'from 0 HP'
                : implied.has(id)
                  ? `implied by ${(implied.get(id) ?? []).map((i) => getCondition(i)?.name ?? i).join(', ')}`
                  : null
              : null;
            return (
              <li key={id} className={styles.item} data-testid={`overview-condition-${id}`}>
                <span className={styles.badge} style={badgeStyle(id)}>
                  {tip ? (
                    <ContentTooltip content={tip}>{data?.name ?? id}</ContentTooltip>
                  ) : (
                    data?.name ?? id
                  )}
                </span>
                {origin && <span className={styles.origin}>{origin}</span>}
                {durationText(id) && (
                  <span className={styles.origin} data-testid={`overview-duration-${id}`}>
                    Duration: {durationNode(id)}
                  </span>
                )}
                <div className={styles.effects}>
                  {effects.slice(0, VISIBLE_EFFECTS).map((e) => (
                    <p key={e} className={styles.effect}>
                      {e}
                    </p>
                  ))}
                  {effects.length > VISIBLE_EFFECTS && (
                    <details className={styles.more}>
                      <summary>More effects</summary>
                      {effects.slice(VISIBLE_EFFECTS).map((e) => (
                        <p key={e} className={styles.effect}>
                          {e}
                        </p>
                      ))}
                    </details>
                  )}
                </div>
              </li>
            );
          })}

          {exhaustion > 0 && exhaustionFx && (
            <li className={styles.item} data-testid="overview-condition-exhaustion">
              <span className={styles.badge} style={badgeStyle('exhaustion')}>
                {exhaustionTip ? (
                  <ContentTooltip content={exhaustionTip}>{`Exhaustion (${exhaustion})`}</ContentTooltip>
                ) : (
                  `Exhaustion (${exhaustion})`
                )}
              </span>
              <p className={styles.effect}>
                D20 Tests:{' '}
                <CalculatedValue label="Exhaustion D20 Test penalty" breakdown={exhaustionFx.d20Test} />
                {' · '}Speed:{' '}
                <CalculatedValue label="Exhaustion Speed reduction (ft)" breakdown={exhaustionFx.speed}>
                  {`${exhaustionFx.speed.total} ft`}
                </CalculatedValue>
              </p>
              {exhaustionFx.fatal && (
                <p className={styles.fatal} role="alert">
                  Exhaustion level {EXHAUSTION.deathLevel}: the character dies.
                </p>
              )}
            </li>
          )}
        </ul>
      )}

      {concentrationSpell && (
        <p className={styles.concentration} data-testid="overview-concentration">
          Concentrating: <SpellName id={character.concentration?.spellId ?? ''} />
        </p>
      )}

      {showDeathSaves && (
        <div className={styles.deathSaves} data-testid="overview-death-saves">
          <span className={styles.deathLabel}>Death saves</span>
          <span
            className={styles.pips}
            role="img"
            aria-label={`Successes ${saves.successes} of 3`}
          >
            {[0, 1, 2].map((i) => (
              <span key={i} className={`${styles.pip} ${i < saves.successes ? styles.success : ''}`}>
                {i < saves.successes ? '\u2713' : ''}
              </span>
            ))}
          </span>
          <span
            className={styles.pips}
            role="img"
            aria-label={`Failures ${saves.failures} of 3`}
          >
            {[0, 1, 2].map((i) => (
              <span key={i} className={`${styles.pip} ${i < saves.failures ? styles.failure : ''}`}>
                {i < saves.failures ? '\u2715' : ''}
              </span>
            ))}
          </span>
        </div>
      )}

      {attackLines.length > 0 && (
        <p className={styles.attacks} data-testid="overview-attack-suggestions">
          Your attacks: {attackLines.join('; ')}
        </p>
      )}

      <OverviewFooter links={[{ href: '#combat', text: 'Manage conditions on Combat' }]} />
    </Card>
  );
}
