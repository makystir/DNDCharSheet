import { ClipboardList } from 'lucide-react';
import type { Character } from '../../../types/character';
import { pendingFeaturePicks, pendingSetupChoices } from '../../../logic/starting-choices';
import type { FeaturePickKind, PendingItem, PendingKind } from '../../../logic/starting-choices';
import { pendingCreationChoices } from '../../../logic/class-choices';
import { primalCompanionMissing } from '../../../logic/companion-play';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { OverviewLinkAnchor } from './OverviewShared';
import styles from './OverviewSetup.module.css';

export interface OverviewSetupProps {
  character: Character;
}

const LABEL: Record<PendingKind, string> = {
  'class-skills': 'Class skills',
  cantrips: 'Cantrips',
  spellbook: 'Spellbook spells',
  prepared: 'Prepared spells',
};

const FEATURE_LABEL: Record<FeaturePickKind, string> = {
  expertise: 'Expertise skills',
  languages: 'Feature languages',
};

/** Where each kind of choice is made. Spell groups live on the Spells page. */
function destination(kind: PendingKind): { href: string; text: string } {
  return kind === 'class-skills'
    ? { href: '#character/build', text: 'Choose on Class & Features' }
    : { href: '#spells', text: 'Choose on Spells' };
}

/**
 * "Finish setting up" checklist for the Overview. Renders nothing at all when
 * every starting choice is made. Read-only: it never changes the character; each
 * row links to the page where the choice is made.
 */
export function OverviewSetup({ character }: OverviewSetupProps) {
  const pending = pendingSetupChoices(character);
  // Level-1 class-feature picks (Divine Order, Primal Order, Warlock invocations)
  // and the class-feature picks (Expertise, feature languages) are made on the
  // Advancement page; they are listed here as link rows only.
  const creationChoices = pendingCreationChoices(character);
  const featurePicks = pendingFeaturePicks(character);
  // A Beast Master is owed a Primal Companion (PHB Beast Master level 3); it is added on the Companions page.
  const primalMissing = primalCompanionMissing(character);
  if (pending.length === 0 && creationChoices.length === 0 && featurePicks.length === 0 && !primalMissing) return null;
  return (
    <Card>
      <SectionHeader icon={ClipboardList} title="Finish setting up" />
      <p className={styles.intro}>
        A few choices are still open. Finish them any time — this card disappears when you&apos;re
        done.
      </p>
      <ul className={styles.list} aria-label="Open choices">
        {pending.map((item: PendingItem) => {
          const label = item.className ? `${item.className} ${LABEL[item.kind].toLowerCase()}` : LABEL[item.kind];
          const link = destination(item.kind);
          return (
            <li
              key={`${item.kind}-${item.classId ?? ''}`}
              className={styles.row}
              data-testid={`overview-setup-${item.kind}`}
            >
              <span className={styles.label}>{label}</span>
              <span className={styles.count}>
                {item.have} of {item.need}
              </span>
              <OverviewLinkAnchor href={link.href} text={link.text} />
            </li>
          );
        })}
        {creationChoices.map((choice) => (
          <li key={choice.key} className={styles.row} data-testid={`overview-setup-choice-${choice.key}`}>
            <span className={styles.label}>{choice.label}</span>
            <span className={styles.count}>
              {choice.chosen} of {choice.owed}
            </span>
            <OverviewLinkAnchor href="#advancement" text="Choose on Advancement" />
          </li>
        ))}
        {featurePicks.map((item) => (
          <li
            key={`${item.kind}-${item.classId ?? ''}`}
            className={styles.row}
            data-testid={`overview-setup-${item.kind}`}
          >
            <span className={styles.label}>
              {item.className ? `${item.className} ` : ''}
              {FEATURE_LABEL[item.kind]}
            </span>
            <span className={styles.count}>
              {item.have} of {item.need}
            </span>
            <OverviewLinkAnchor href="#advancement" text="Choose on Advancement" />
          </li>
        ))}
        {primalMissing && (
          <li className={styles.row} data-testid="overview-setup-primal-companion">
            <span className={styles.label}>Primal Companion</span>
            <span className={styles.count}>not added</span>
            <OverviewLinkAnchor href="#companions/creatures" text="Add on Companions" />
          </li>
        )}
      </ul>
    </Card>
  );
}

