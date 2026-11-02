import { Settings as SettingsIcon, SlidersHorizontal } from 'lucide-react';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import styles from './SettingsPage.module.css';

export interface SettingsPageProps {
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

/**
 * The Settings tab: the theme toggle (migrated from the former top-bar button)
 * plus a placeholder region marking where future house-rule/settings toggles
 * will land. Theme state remains owned by App; this page only triggers the
 * toggle callback.
 */
export function SettingsPage({ theme, onThemeToggle }: SettingsPageProps) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  return (
    <div className={styles.page}>
      <Card>
        <SectionHeader icon={SettingsIcon} title="Appearance" />
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>
            <span className={styles.settingName}>Theme</span>
            <span className={styles.settingHint}>
              Currently {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </span>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={onThemeToggle}
            aria-label={`Switch to ${nextTheme} theme`}
          >
            Switch to {nextTheme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>
      </Card>

      <Card>
        <SectionHeader icon={SlidersHorizontal} title="House Rules" />
        <EmptyState
          icon={SlidersHorizontal}
          heading="More settings coming soon"
          description="House-rule and preference toggles will appear here as later stages land."
        />
      </Card>
    </div>
  );
}
