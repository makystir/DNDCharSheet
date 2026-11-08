import type { Character } from '../../../types/character';
import { languagePicksStatus, featureLanguageOptions } from '../../../logic/language-picks';
import type { LanguagePicksStatus } from '../../../logic/language-picks';
import { formatLanguage } from '../sheet-helpers';
import styles from './ExpertisePending.module.css';

export interface LanguagePicksPendingProps {
  character: Character;
  onChange: (next: Character) => void;
  status?: LanguagePicksStatus;
}

/**
 * The feature-language pick in the Advancement "Choices Pending" list (Rogue L1
 * Thieves' Cant; Ranger L2 Deft Explorer — PHB 2024). Shown while picks remain;
 * counts come from logic/language-picks.ts. Picks are stored in
 * languages.granted. Ticking beyond the grant is allowed (non-blocking warning).
 */
export function LanguagePicksPending({ character, onChange, status }: LanguagePicksPendingProps) {
  const s = status ?? languagePicksStatus(character);
  if (s.remaining === 0) return null;

  const granted = (character.languages?.granted ?? []).map((l) => l.trim().toLowerCase());
  const options = featureLanguageOptions(character);

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...granted, id] : granted.filter((g) => g !== id);
    onChange({
      ...character,
      languages: { chosen: character.languages?.chosen ?? [], granted: next },
    });
  };

  return (
    <li className={styles.item} data-testid="pending-languages">
      <span>
        Choose {s.remaining} more language{s.remaining === 1 ? '' : 's'} ({s.chosen} of {s.owed}{' '}
        chosen) — from your class features (Thieves&apos; Cant, Deft Explorer)
      </span>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Feature languages</legend>
        {options.map((lang) => (
          <label key={lang} className={styles.option}>
            <input
              type="checkbox"
              checked={granted.includes(lang)}
              onChange={(e) => toggle(lang, e.target.checked)}
            />
            {formatLanguage(lang)}
          </label>
        ))}
      </fieldset>
    </li>
  );
}

/** A non-blocking warning when more feature languages are picked than granted. */
export function LanguagePicksOverNote({ status }: { status: LanguagePicksStatus }) {
  if (status.over === 0) return null;
  return (
    <p className={styles.warning} role="note" data-testid="language-picks-over-note">
      Languages: {status.chosen} feature languages picked, but your class features grant{' '}
      {status.owed}. Only the granted number count toward your known languages.
    </p>
  );
}
