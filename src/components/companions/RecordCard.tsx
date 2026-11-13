import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { usePortrait } from '../../hooks/usePortrait';
import { COMPANION_PORTRAIT_MAX_SIDE, downscaleImage } from '../../logic/portrait';
import { RecordPortrait, RecordThumbnail } from './RecordPortrait';
import type { RecordPortraitConfig } from './RecordPortrait';
import styles from './CompanionsShared.module.css';

/** Companion portraits are shrunk before they are stored (stable identity for the hook). */
const shrinkPortrait = (file: File) => downscaleImage(file, COMPANION_PORTRAIT_MAX_SIDE);

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
  /** Portrait (thumbnail in the header, upload and Appearance in the body). */
  portrait: RecordPortraitConfig;
  /** Called with the record's delete request (the tab confirms it). */
  onDelete: () => void;
  /** The expanded body. Called only while the card is open. */
  children: () => ReactNode;
}

/**
 * The one card shell every record on the Companions page uses: a collapsed
 * header (portrait thumbnail; name; kind badge, extra chips, HP) that expands
 * to the body: the portrait block, the card's own content, and a
 * "Remove <name>" button at the foot. Mirrors the WFRP HirelingCard. Each card
 * supplies only its body, so headers, spacing, portraits and delete wording
 * stay the same on every tab.
 */
export function RecordCard({ testId, name, kind, meta, hp, muted, portrait, onDelete, children }: RecordCardProps) {
  const [expanded, setExpanded] = useState(false);
  const image = usePortrait(portrait.storeKey, shrinkPortrait);
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
        <span className={styles.headerRow}>
          <RecordThumbnail url={image.portraitURL} />
          <span className={styles.headerText}>
            <span className={styles.nameLine}>{name}</span>
            <span className={styles.metaLine}>
              <span className={styles.badge}>{kind}</span>
              {meta}
              {hp && <span className={hp.current === 0 ? styles.badgeWarn : styles.chip}>{`HP ${hp.current}/${hp.max}`}</span>}
              <ChevronDown size={16} aria-hidden="true" className={expanded ? styles.chevronOpen : styles.chevron} />
            </span>
          </span>
        </span>
      </button>

      {expanded && (
        <div className={styles.body} id={bodyId}>
          <RecordPortrait name={name} config={portrait} portrait={image} />
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
