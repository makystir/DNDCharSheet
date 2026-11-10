import { useMemo, useState } from 'react';
import { ALIGNMENT_CODE_LABEL, PANTHEON_LABELS } from '../../data/deity-reference';
import type { DeityPantheon } from '../../data/deity-reference';
import {
  deityTooltip,
  findDeityInfo,
  suggestDeities,
} from '../../logic/deity-recommendations';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import styles from './CreationWizard.module.css';

export interface DeitySuggestionsProps {
  classId: string;
  speciesId: string;
  speciesChoices: Record<string, string>;
  alignment: string;
  /** The name currently in the Faith field. */
  faith: string;
  onChoose: (name: string) => void;
}

const SETTINGS: { value: DeityPantheon | 'all'; label: string }[] = [
  { value: 'all', label: 'Any setting' },
  { value: 'forgotten-realms', label: PANTHEON_LABELS['forgotten-realms'] },
  { value: 'greyhawk', label: PANTHEON_LABELS.greyhawk },
  { value: 'racial', label: PANTHEON_LABELS.racial },
  { value: 'dragonlance', label: PANTHEON_LABELS.dragonlance },
];

/**
 * Wizard "Suggested deities": a short ranked list built from the character's
 * class, species and alignment, with the reasons. It only suggests: Choose fills
 * the Faith field, and any god (or a homebrew one) can still be typed in.
 */
export function DeitySuggestions({
  classId,
  speciesId,
  speciesChoices,
  alignment,
  faith,
  onChoose,
}: DeitySuggestionsProps) {
  const [setting, setSetting] = useState<DeityPantheon | 'all'>('all');
  const suggestions = useMemo(
    () => suggestDeities({ classId, speciesId, speciesChoices, alignment, pantheon: setting }),
    [classId, speciesId, speciesChoices, alignment, setting],
  );
  const noAlignment = alignment === '' || alignment === 'Unaligned';

  return (
    <section className={styles.equipBlock} aria-label="Deity suggestions">
      <h3 className={styles.guidanceTitle}>Suggested deities</h3>
      <p className={styles.hint}>
        Based on your class, species and alignment. Gods usually belong to one setting, so pick
        the one your DM&apos;s world uses. These are only suggestions: you can name any god, or
        your own.
      </p>
      <label className={styles.fieldLabel} htmlFor="wiz-deity-setting">
        Setting
      </label>
      <select
        id="wiz-deity-setting"
        className={styles.select}
        value={setting}
        aria-label="Deity setting"
        onChange={(e) => setSetting(e.target.value as DeityPantheon | 'all')}
      >
        {SETTINGS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      {noAlignment && (
        <p className={styles.hint} role="note">
          Pick an alignment above to sharpen these. Evil gods are only suggested for evil
          characters.
        </p>
      )}
      {suggestions.length === 0 ? (
        <p className={styles.hint}>
          No strong matches in this setting. Try another setting, or choose any god you like.
        </p>
      ) : (
        <ul className={styles.deityList} aria-label="Suggested deities">
          {suggestions.map((s) => {
            const info = findDeityInfo(s.name);
            const chosen = faith.trim().toLowerCase() === s.name.toLowerCase();
            return (
              <li key={s.name} className={styles.deityItem}>
                <div className={styles.deityHead}>
                  <MaybeContentTooltip
                    content={info ? deityTooltip(info) : null}
                    ariaLabel={`About ${s.name}`}
                  >
                    <strong>{s.name}</strong>
                  </MaybeContentTooltip>
                  <span className={styles.hint}>
                    {PANTHEON_LABELS[s.pantheon]} · {ALIGNMENT_CODE_LABEL[s.alignment]}
                  </span>
                  <button
                    type="button"
                    className={styles.bgChoose}
                    aria-label={`Choose ${s.name} as deity`}
                    aria-pressed={chosen}
                    onClick={() => onChoose(s.name)}
                  >
                    {chosen ? 'Chosen' : 'Choose'}
                  </button>
                </div>
                <span className={styles.hint}>{s.portfolio}</span>
                <ul className={styles.deityReasons}>
                  {s.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
