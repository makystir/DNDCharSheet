import { useState } from 'react';
import { X } from 'lucide-react';
import { clockNow } from '../../logic/dm-mode';
import { dismissDmBackupNudge, getDmBackupNudge } from '../../storage/dm-backup';
import styles from './dm.module.css';

interface DmBackupNudgeProps {
  hasCampaigns: boolean;
  /** Last DM export time (ms since epoch), or null if never exported. */
  lastExportAt: number | null;
  onOpenSettings: () => void;
}

/** Dismissible reminder to export DM data, which lives in this browser only. */
export function DmBackupNudge({ hasCampaigns, lastExportAt, onOpenSettings }: DmBackupNudgeProps) {
  const [now] = useState(clockNow);
  // Dismissal is remembered per export marker, so a new export re-arms the nudge.
  const [dismissedFor, setDismissedFor] = useState<number | null | undefined>(undefined);
  const reminder = getDmBackupNudge(hasCampaigns, lastExportAt, now);
  if (!reminder.show || dismissedFor === lastExportAt) return null;
  return (
    <div className={styles.backupNudge} role="status" data-testid="dm-backup-nudge">
      <span>
        {reminder.never
          ? 'Your campaigns are saved in this browser only, and you have not exported them yet.'
          : `It has been ${reminder.daysSince} days since you last exported your campaigns.`}
      </span>
      <button type="button" className={styles.btn} onClick={onOpenSettings}>
        Back up now
      </button>
      <button
        type="button"
        className={styles.btn}
        aria-label="Dismiss backup reminder"
        onClick={() => {
          dismissDmBackupNudge(lastExportAt);
          setDismissedFor(lastExportAt);
        }}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}