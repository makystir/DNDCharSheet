import { ClipboardList } from 'lucide-react';
import type { Character } from '../../../types/character';
import { pendingSetupChoices } from '../../../logic/starting-choices';
import type { PendingItem, PendingKind } from '../../../logic/starting-choices';
import { pendingCreationChoices } from '../../../logic/class-choices';
import { earnedExpertiseGrants, expertiseStatus } from '../../../logic/expertise';
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
  // and Rogue Expertise are made on the Advancement page; they are listed here as
  // link rows only. pendingSetupChoices itself is unchanged.
  const creationChoices = pendingCreationChoices(character);
  const expertise = expertiseStatus(character);
  const showExpertise =
    expertise.remaining > 0 && earnedExpertiseGrants(character).some((e) => e.grant.level === 1);
  if (pending.length === 0 && creationChoices.length === 0 && !showExpertise) return null;
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
        {showExpertise && (
          <li className={styles.row} data-testid="overview-setup-expertise">
            <span className={styles.label}>Expertise skills</span>
            <span className={styles.count}>
              {expertise.chosen} of {expertise.owed}
            </span>
            <OverviewLinkAnchor href="#advancement" text="Choose on Advancement" />
          </li>
        )}
      </ul>
    </Card>
  );
}
