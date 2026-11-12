import { ListChecks } from 'lucide-react';
import type { Character } from '../../types/character';
import { availableReactions } from '../../logic/reactions';
import type { ReactionUnavailable } from '../../logic/reactions';
import {
  bonusActionSpells,
  featureTurnOptionsFor,
  STANDARD_ACTIONS,
  STANDARD_ACTIONS_SOURCE,
  type FeatureTurnOptionEntry,
} from '../../logic/turn-options';
import { resolveClassFeatureTooltip } from '../../logic/tooltip-content';
import { resolveSpellTooltip } from '../../logic/tooltip-content';
import { SPELL_CATALOG } from '../../data/spells';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { ContentTooltip, MaybeContentTooltip } from '../shared/ContentTooltip';
import { SpellName } from '../shared/SpellName';
import styles from './TurnOptionsCard.module.css';

export interface TurnOptionsCardProps {
  character: Character;
}

const REASON_TEXT: Record<ReactionUnavailable, string> = {
  incapacitated: 'Incapacitated',
  spent: 'Reaction already used',
  'no-uses': 'No uses left',
  'no-slot': 'No spell slot available',
};

/**
 * "On your turn": the standard actions every creature can take, the Bonus Action
 * spells the character has ready, and the Reactions available (with why one is
 * unavailable). A reference only; nothing here is tracked. Each name opens a
 * tooltip with the details.
 */
export function TurnOptionsCard({ character }: TurnOptionsCardProps) {
  const bonus = bonusActionSpells(character);
  const features = featureTurnOptionsFor(character);
  const actionFeatures = features.filter((f) => f.activation === 'action');
  const bonusFeatures = features.filter((f) => f.activation === 'bonus-action');

  const featureList = (items: FeatureTurnOptionEntry[], label: string) => (
    <ul className={styles.list} aria-label={label}>
      {items.map((f) => (
        <li key={`${f.origin}-${f.name}`} className={styles.item}>
          <ContentTooltip content={resolveClassFeatureTooltip(f.feature, f.origin)}>{f.name}</ContentTooltip>
          <span className={styles.meta}>{f.origin}</span>
        </li>
      ))}
    </ul>
  );
  const reactions = availableReactions(character);

  return (
    <Card>
      <SectionHeader icon={ListChecks} title="On your turn" />
      <p className={styles.hint}>
        On your turn you can move up to your Speed and take one action. You get a Bonus Action
        only when a feature or spell gives you one, and one Reaction a round.
      </p>

      <section aria-labelledby="turn-actions">
        <h4 id="turn-actions" className={styles.heading}>
          Actions
        </h4>
        <ul className={styles.chips} aria-label="Standard actions">
          {STANDARD_ACTIONS.map((a) => (
            <li key={a.name}>
              <ContentTooltip
                content={{
                  title: `${a.name} [Action]`,
                  sections: [
                    { label: 'Effect', text: a.summary },
                    { label: 'Source', text: STANDARD_ACTIONS_SOURCE },
                  ],
                }}
                className={styles.chip}
              >
                {a.name}
              </ContentTooltip>
            </li>
          ))}
        </ul>
        {actionFeatures.length > 0 && (
          <>
            <h5 className={styles.subheading}>Your features that use an action</h5>
            {featureList(actionFeatures, 'Features that use an action')}
          </>
        )}
      </section>

      <section aria-labelledby="turn-bonus">
        <h4 id="turn-bonus" className={styles.heading}>
          Bonus Actions
        </h4>
        {bonusFeatures.length > 0 && featureList(bonusFeatures, 'Features that use a Bonus Action')}
        {bonus.length === 0 ? (
          bonusFeatures.length === 0 && <p className={styles.empty}>No Bonus Actions available.</p>
        ) : (
          <ul className={styles.list} aria-label="Bonus Action spells">
            {bonus.map((s) => (
              <li key={s.id} className={styles.item}>
                <SpellName id={s.id} />
                <span className={styles.meta}>
                  {s.level === 0 ? 'Cantrip' : `Level ${s.level}`}
                  {s.castingTime !== 'Bonus Action' ? ` · ${s.castingTime.replace(/^Bonus Action,\s*/i, '')}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="turn-reactions">
        <h4 id="turn-reactions" className={styles.heading}>
          Reactions
        </h4>
        <ul className={styles.list} aria-label="Reactions">
          {reactions.map((r) => {
            const spell = r.kind === 'spell' ? SPELL_CATALOG.find((s) => s.name === r.name) : undefined;
            const tip = spell
              ? resolveSpellTooltip(spell.id)
              : {
                  title: r.name,
                  sections: [
                    ...(r.origin ? [{ label: 'From', text: r.origin }] : []),
                    { label: 'Effect', text: r.summary },
                    ...(r.source ? [{ label: 'Source', text: r.source }] : []),
                  ],
                };
            return (
              <li
                key={`${r.kind}-${r.name}`}
                className={r.unavailable ? `${styles.item} ${styles.unavailable}` : styles.item}
              >
                <MaybeContentTooltip content={tip}>{r.name}</MaybeContentTooltip>
                <span className={styles.meta}>
                  {r.origin ?? ''}
                  {r.unavailable ? `${r.origin ? ' · ' : ''}${REASON_TEXT[r.unavailable]}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </Card>
  );
}
