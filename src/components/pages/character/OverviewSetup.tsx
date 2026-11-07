import { ClipboardList } from 'lucide-react';
import type { Character } from '../../../types/character';
import { pendingSetupChoices } from '../../../logic/starting-choices';
import type { PendingItem, PendingKind } from '../../../logic/starting-choices';
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
  if (pending.length === 0) return null;
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
      </ul>
    </Card>
  );
}
