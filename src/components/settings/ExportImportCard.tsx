import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import type { Character } from '../../types/character';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { exportToFile, importFromJSON } from '../../storage/export-import';
import { base64ToBlob } from '../../storage/portrait-codec';
import { getPortraitStore } from '../../storage/portrait-store';
import styles from './ExportImportCard.module.css';

export interface ExportImportCardProps {
  /** The active character to export. */
  character: Character;
  /**
   * Adopt an imported character as a NEW character (manager mints a fresh id and
   * makes it active). Returns the saved record so its real id is known for the
   * portrait association. Import ADDS — it never overwrites the active one.
   */
  onAdopt: (next: Character) => Promise<Character>;
}

/** Transient status shown under the import/export controls. */
type Status = { kind: 'idle' } | { kind: 'ok'; text: string } | { kind: 'error'; text: string };

/**
 * The Settings "Export / Import" card (Stage B2).
 *
 * Export downloads the ACTIVE character as a `.json` file with its portrait
 * embedded. Import reads a chosen `.json` file, validates it, and on success
 * ADOPTS it as a NEW character via the manager (fresh id — the active character
 * is never overwritten), restoring any embedded portrait into the Portrait
 * Store under the new id. No ConfirmDialog is needed: import is purely additive.
 */
export function ExportImportCard({ character, onAdopt }: ExportImportCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setStatus({ kind: 'idle' });
    try {
      await exportToFile(character, character.id);
      setStatus({ kind: 'ok', text: `Exported “${character.name || 'character'}”.` });
    } catch {
      setStatus({ kind: 'error', text: 'Export failed. Please try again.' });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so choosing the SAME file again still fires onChange.
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setStatus({ kind: 'idle' });
    try {
      const text = await file.text();
      const result = importFromJSON(text);
      if (!result.success || !result.character) {
        setStatus({ kind: 'error', text: result.error ?? 'Import failed.' });
        return;
      }

      // Adopt as a NEW character (manager mints a fresh id + makes it active).
      const saved = await onAdopt(result.character);

      // Restore the embedded portrait into the Portrait Store under the new id.
      if (result.portraitDataUrl) {
        const blob = base64ToBlob(result.portraitDataUrl);
        if (blob) {
          await getPortraitStore().savePortrait(saved.id, blob);
        }
      }

      setStatus({ kind: 'ok', text: `Imported “${saved.name || 'character'}” as a new character.` });
    } catch {
      setStatus({ kind: 'error', text: 'Could not read that file.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionHeader icon={Download} title="Export / Import" />
      <p className={styles.hint}>
        Export the current character to a <code>.json</code> file (its portrait is
        included). Importing a file adds it as a <strong>new</strong> character — your
        existing characters are never overwritten.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          onClick={() => void handleExport()}
          disabled={busy}
        >
          <Download size={16} aria-hidden="true" />
          Export current character
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={handleImportClick}
          disabled={busy}
        >
          <Upload size={16} aria-hidden="true" />
          {busy ? 'Importing…' : 'Import from file'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className={styles.fileInput}
          onChange={(e) => void handleFileChosen(e)}
          aria-label="Choose a character JSON file to import"
        />
      </div>
      {status.kind !== 'idle' && (
        <p
          className={status.kind === 'error' ? styles.error : styles.ok}
          role={status.kind === 'error' ? 'alert' : 'status'}
        >
          {status.text}
        </p>
      )}
    </Card>
  );
}
