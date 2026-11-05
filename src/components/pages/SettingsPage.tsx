import { Dices, Download, Settings as SettingsIcon, SlidersHorizontal } from 'lucide-react';
import type { Character } from '../../types/character';
import { useDiceEntryMode } from '../../hooks/useDiceEntryMode';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { InstallPromptControl } from '../shared/InstallPromptControl';
import { ExportImportCard } from '../settings/ExportImportCard';
import { ShareLinkCard } from '../settings/ShareLinkCard';
import { AutoBackupCard } from '../settings/AutoBackupCard';
import styles from './SettingsPage.module.css';

export interface SettingsPageProps {
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  character: Character;
  onChange: (next: Character) => void;
  /**
   * Adopt an imported character as a NEW character (manager mints a fresh id +
   * makes it active). Threaded from App, where `useCharacterManager` lives, so
   * the Export/Import card can add an imported character without the page
   * reaching into the manager directly (matches App's prop-drilling style).
   */
  onAdopt: (next: Character) => Promise<Character>;
  /**
   * Refresh the manager's roster + active character after a restore (B3). The
   * auto-backup card restores characters as NEW records (adopt-as-new, never
   * overwrite) via the snapshot service; this lets the shell pick up the new
   * list without a reload.
   */
  onRestored: () => void;
}

/**
 * The Settings tab: the theme toggle (migrated from the former top-bar button)
 * plus the House Rules card, which now hosts the variant-encumbrance toggle
 * (A3). Theme state remains owned by App; the house-rule flag lives on the
 * character and is updated via onChange (same pattern as CombatPage's rolledHp
 * toggle).
 */
export function SettingsPage({
  theme,
  onThemeToggle,
  character,
  onChange,
  onAdopt,
  onRestored,
}: SettingsPageProps) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  // App-wide dice-entry preference (localStorage), not a character house rule.
  const { mode: diceMode, setMode: setDiceMode } = useDiceEntryMode();

  // PWA install affordance: only surface the "Install" card when the browser
  // signals the app is installable (and not already installed), so Settings
  // never shows a dead control. This is the SINGLE useInstallPrompt instance for
  // the Settings surface; the values are passed down to InstallPromptControl so
  // it does not register a second set of beforeinstallprompt/appinstalled
  // listeners for the same control.
  const { canInstall, promptInstall } = useInstallPrompt();

  const variantEncumbrance = character.houseRules?.variantEncumbrance ?? false;
  const setVariantEncumbrance = (on: boolean) =>
    onChange({
      ...character,
      houseRules: { ...character.houseRules, variantEncumbrance: on },
    });
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
        <SectionHeader icon={Dices} title="Dice Rolling" />
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>
            <span className={styles.settingName}>Enter dice results manually</span>
            <span className={styles.settingHint}>
              A preference for this device, not a house rule. Turn it on if you roll
              physical dice: roll prompts then ask you to type the d20 result
              instead of rolling for you. Applies to every character.
            </span>
          </span>
          <label className={styles.toggleControl}>
            <input
              type="checkbox"
              checked={diceMode === 'manual'}
              aria-label="Enter dice results manually"
              onChange={(e) => setDiceMode(e.target.checked ? 'manual' : 'auto')}
            />
            <span>{diceMode === 'manual' ? 'Manual entry' : 'Auto-roll'}</span>
          </label>
        </div>
      </Card>

      <Card>
        <SectionHeader icon={SlidersHorizontal} title="House Rules" />
        <div className={styles.settingRow}>
          <span className={styles.settingLabel}>
            <span className={styles.settingName}>Variant Encumbrance</span>
            <span className={styles.settingHint}>
              Enables the Encumbered (Str × 5) / Heavily Encumbered (Str × 10)
              speed-penalty bands. NOT a 2024 rule — this is an opt-in 2014-era
              variant; off by default (rules-as-written is a binary over/under
              capacity check).
            </span>
          </span>
          <label className={styles.toggleControl}>
            <input
              type="checkbox"
              checked={variantEncumbrance}
              aria-label="Enable variant encumbrance (house rule)"
              onChange={(e) => setVariantEncumbrance(e.target.checked)}
            />
            <span>{variantEncumbrance ? 'On' : 'Off'}</span>
          </label>
        </div>
      </Card>

      {canInstall && (
        <Card>
          <SectionHeader icon={Download} title="Install App" />
          <div className={styles.settingRow}>
            <span className={styles.settingLabel}>
              <span className={styles.settingName}>Install on this device</span>
              <span className={styles.settingHint}>
                Add the app to your device for quick, offline access. Shown only
                when your browser supports installation and the app is not
                already installed.
              </span>
            </span>
            <InstallPromptControl canInstall={canInstall} promptInstall={promptInstall} />
          </div>
        </Card>
      )}

      <ExportImportCard character={character} onAdopt={onAdopt} />

      <ShareLinkCard character={character} />

      <AutoBackupCard onRestored={onRestored} />
    </div>
  );
}
