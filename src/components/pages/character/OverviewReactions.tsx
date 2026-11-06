import { useState } from 'react';
import { Zap } from 'lucide-react';
import type { Character } from '../../../types/character';
import {
  availableReactions,
  isReactionBlocked,
  isReactionSpent,
} from '../../../logic/reactions';
import type { ReactionEntry, ReactionKind, ReactionUnavailable } from '../../../logic/reactions';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import styles from './OverviewReactions.module.css';

export interface OverviewReactionsProps {
  character: Character;
}

const KIND_LABEL: Record<ReactionKind, string> = {
  universal: 'Universal',
  'class-feature': 'Class feature',
  spell: 'Spell',
};

const REASON_TEXT: Record<ReactionUnavailable, string> = {
  incapacitated: 'Incapacitated',
  spent: 'Reaction already used',
  'no-slot': 'No spell slot available',
};

/** One-line text that expands on demand (keyboard accessible button). */
function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <p className={expanded ? styles.text : `${styles.text} ${styles.clamped}`}>{text}</p>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </>
  );
}

function statusText(character: Character): string {
  if (isReactionBlocked(character)) return "Can't take Reactions (Incapacitated)";
  if (isReactionSpent(character)) return 'Reaction used this round';
  return 'Reaction available';
}

/**
 * Read-only mirror of the Reactions the character has access to. All
 * availability logic lives in logic/reactions; the Reaction-used flag is managed
 * on Combat.
 */
export function OverviewReactions({ character }: OverviewReactionsProps) {
  const entries = availableReactions(character);
  return (
    <Card>
      <SectionHeader icon={Zap} title="Reactions" />
      <p className={styles.status} role="status" data-testid="overview-reaction-status">
        {statusText(character)}
      </p>
      <ul className={styles.list}>
        {entries.map((entry: ReactionEntry) => (
          <li
            key={`${entry.kind}-${entry.name}`}
            className={entry.unavailable ? `${styles.item} ${styles.unavailable}` : styles.item}
            data-testid="overview-reaction"
          >
            <span className={styles.head}>
              <span className={styles.name}>{entry.name}</span>
              <span className={styles.tag}>
                {KIND_LABEL[entry.kind]}
                {entry.spellLevel !== undefined ? ` \u00B7 Level ${entry.spellLevel}` : ''}
              </span>
              {entry.unavailable && (
                <span className={styles.reason}>{REASON_TEXT[entry.unavailable]}</span>
              )}
            </span>
            <ExpandableText text={entry.summary} />
          </li>
        ))}
      </ul>
      <p className={styles.note}>Subclass and feat reactions are not listed yet.</p>
      <a className={styles.manage} href="#combat">
        Reaction used? Manage on Combat
      </a>
    </Card>
  );
}
