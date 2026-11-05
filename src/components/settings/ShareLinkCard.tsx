import { useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import type { Character } from '../../types/character';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { exportCharacter } from '../../storage/export-import';
import { encodeSharePayload } from '../../logic/share-codec';
import { isGzipSupported } from '../../logic/gzip';
import { trimForLink, classifyLinkLength } from '../../logic/share-portrait';
import { formatViewHref } from '../../logic/view-route';
import styles from './ExportImportCard.module.css';

export interface ShareLinkCardProps {
  /** The active character to share. */
  character: Character;
}

/** Transient status under the Share control. */
type Status =
  | { kind: 'idle' }
  | { kind: 'ok'; text: string }
  | { kind: 'warn'; text: string }
  | { kind: 'error'; text: string };

/**
 * The Settings "Share (read-only link)" card (Stage B5).
 *
 * Builds a `#view/<payload>` link for the ACTIVE character and copies it to the
 * clipboard. The link embeds the whole character in its URL hash (no backend);
 * the PORTRAIT is trimmed (`trimForLink`) so the link stays within the size cap.
 * A recipient opening the link sees the strictly READ-ONLY SharedCharacterViewer
 * — nothing is written to their character list.
 *
 * Feedback: a success message on copy, a size WARNING when the href crosses the
 * soft/hard length thresholds (`classifyLinkLength`), and an error when the
 * clipboard write or codec fails. When the runtime lacks CompressionStream the
 * action is disabled (the link codec needs gzip) and the card says so, steering
 * the user to the file/clipboard Export instead.
 *
 * Bucket-1 port of the WFRP SettingsPage GM share link, re-themed. No game rules.
 */
export function ShareLinkCard({ character }: ShareLinkCardProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const gzipOk = isGzipSupported();

  const handleShareLink = async () => {
    setStatus({ kind: 'idle' });
    setBusy(true);
    try {
      // Build the export envelope (portrait embedded from the Portrait Store),
      // then strip the portrait for the link variant so the URL stays small.
      const envelope = await exportCharacter(character, character.id);
      const linkJson = trimForLink(envelope);
      const encoded = await encodeSharePayload(linkJson);
      const href = formatViewHref(location.origin, location.pathname, encoded);

      await navigator.clipboard.writeText(href);

      const length = classifyLinkLength(href.length);
      if (length === 'hard') {
        setStatus({
          kind: 'warn',
          text: 'Link copied, but it is very long and may not open reliably everywhere. Consider sharing an exported file instead.',
        });
      } else if (length === 'soft') {
        setStatus({
          kind: 'warn',
          text: 'Link copied. It is on the long side — if the recipient has trouble opening it, share an exported file instead.',
        });
      } else {
        setStatus({ kind: 'ok', text: 'Read-only share link copied to clipboard.' });
      }
    } catch {
      setStatus({ kind: 'error', text: 'Could not create the share link. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const statusRole =
    status.kind === 'error' || status.kind === 'warn' ? 'alert' : 'status';
  const statusClass = status.kind === 'error' || status.kind === 'warn' ? styles.error : styles.ok;

  return (
    <Card>
      <SectionHeader icon={LinkIcon} title="Share (read-only link)" />
      <p className={styles.hint}>
        Copy a link that opens a <strong>read-only</strong> view of the current character
        for a GM or friend. The whole character is encoded in the link itself (no
        account or server); the portrait is left out to keep the link short. Opening
        the link never changes the recipient’s own characters.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          onClick={() => void handleShareLink()}
          disabled={busy || !gzipOk}
          title={gzipOk ? undefined : 'Share links are unavailable in this browser — use Export instead.'}
        >
          <LinkIcon size={16} aria-hidden="true" />
          {busy ? 'Building link…' : 'Copy read-only share link'}
        </button>
      </div>
      {!gzipOk && (
        <p className={styles.ok} role="status">
          Share links aren’t available in this browser. Use Export / Import to share a file instead.
        </p>
      )}
      {status.kind !== 'idle' && (
        <p className={statusClass} role={statusRole}>
          {status.text}
        </p>
      )}
    </Card>
  );
}
