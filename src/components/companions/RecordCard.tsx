import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import styles from './CompanionsShared.module.css';

export interface RecordCardProps {
  /** data-testid of the card root, e.g. `companion-<id>`. */
  testId: string;
  /** The tracked name: nickname or given name, else the creature name. */
  name: string;
  /** Kind badge, e.g. "Primal Companion" or "Skilled hireling". */
  kind: string;
  /** Extra header badges and chips, after the kind badge and before HP. */
  meta?: ReactNode;
  /** HP chip; omitted when the maximum is not known. */
  hp?: { current: number; max: number } | null;
  /** Dimmed, dashed card (dismissed companion, dead sidekick). */
  muted?: boolean;
  /** Called with the record's delete request (the tab confirms it). */
  onDelete: () => void;
  /** The expanded body. Called only while the card is open. */
  children: () => ReactNode;
}

/**
 * The one card shell every record on the Companions page uses: a collapsed
 * two-line header (name; kind badge, extra chips, HP) that expands to the body
 * with a "Remove <name>" button at the foot. Mirrors the WFRP HirelingCard.
 * Each card supplies only its body, so headers, spacing and delete wording
 * stay the same on every tab.
 */
export function RecordCard({ testId, name, kind, meta, hp, muted, onDelete, children }: RecordCardProps) {
  const [expanded, setExpanded] = useState(false);
  const bodyId = `${testId}-body`;
  return (
    <div className={muted ? styles.cardMuted : styles.card} data-testid={testId}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={styles.nameLine}>{name}</span>
        <span className={styles.metaLine}>
          <span className={styles.badge}>{kind}</span>
          {meta}
          {hp && <span className={hp.current === 0 ? styles.badgeWarn : styles.chip}>{`HP ${hp.current}/${hp.max}`}</span>}
          <ChevronDown size={16} aria-hidden="true" className={expanded ? styles.chevronOpen : styles.chevron} />
        </span>
      </button>

      {expanded && (
        <div className={styles.body} id={bodyId}>
          {children()}
          <div className={styles.footer}>
            <button type="button" className={styles.deleteBtn} onClick={onDelete}>
              <Trash2 size={14} aria-hidden="true" /> {`Remove ${name}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
