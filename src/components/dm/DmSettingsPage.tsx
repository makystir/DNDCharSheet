import { useRef, useState } from 'react';
import { Download, Settings as SettingsIcon, Upload } from 'lucide-react';
import type { DmData } from '../../types/dm';
import type { DmApi } from './dmApi';
import { dmDataToJson, dmExportFileName } from '../../storage/dm-store';
import { parseDmData } from '../../logic/dm-sanitize';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import styles from './dm.module.css';

interface DmSettingsPageProps {
  dm: DmApi;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  onTurnOff: () => void;
  onNotify: (text: string) => void;
}

/** DM mode settings: theme, leaving DM mode, and a file backup of the DM data. */
export function DmSettingsPage({ dm, theme, onThemeToggle, onTurnOff, onNotify }: DmSettingsPageProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<DmData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  const exportData = () => {
    const blob = new Blob([dmDataToJson(dm.data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dmExportFileName(new Date());
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Dungeon Master data exported.');
  };

  const onFile = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    const parsed = parseDmData(await file.text());
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setPending(parsed.data);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Dungeon Master settings</h1>

      <Card>
        <SectionHeader icon={SettingsIcon} title="Appearance and mode" />
        <div className={styles.stack}>
          <div className={styles.settingRow}>
            <span className={styles.settingLabel}>
              <span className={styles.settingName}>Theme</span>
              <span className={styles.muted}>Currently {theme === 'dark' ? 'Dark' : 'Light'}</span>
            </span>
            <button type="button" className={styles.btn} onClick={onThemeToggle} aria-label={`Switch to ${nextTheme} theme`}>
              Switch to {nextTheme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </div>
          <div className={styles.settingRow}>
            <span className={styles.settingLabel}>
              <span className={styles.settingName}>Dungeon Master mode</span>
              <span className={styles.muted}>
                Turn it off to go back to the player sheet. Your campaigns stay saved on this device.
              </span>
            </span>
            <button type="button" className={styles.btn} onClick={onTurnOff}>
              Turn off DM mode
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader icon={Download} title="Back up your campaigns" />
        <div className={styles.stack}>
          <p className={styles.muted}>
            Campaigns, notes and party snapshots are stored in this browser only. Export a file now and then, and keep it
            somewhere safe. Importing a file replaces everything saved here.
          </p>
          <div className={styles.row}>
            <button type="button" className={styles.btn} onClick={exportData}>
              <Download size={16} aria-hidden="true" /> Export DM data
            </button>
            <button type="button" className={styles.btn} onClick={() => fileRef.current?.click()}>
              <Upload size={16} aria-hidden="true" /> Import DM data
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      </Card>

      {pending && (
        <ConfirmDialog
          title="Replace Dungeon Master data"
          message={`Replace everything saved here with the file? It holds ${pending.campaigns.length} ${pending.campaigns.length === 1 ? 'campaign' : 'campaigns'}. Your current campaigns will be lost unless you exported them.`}
          confirmLabel="Replace"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            dm.replace(pending);
            setPending(null);
            onNotify('Dungeon Master data imported.');
          }}
        />
      )}
    </div>
  );
}
