import { useEffect, useRef, useState } from 'react';
import type { Character } from '../../types/character';
import { createCharacter } from '../../storage/character-store';
import { generateRandomCharacter } from '../../logic/personal-details-generation';
import { createDefaultRng } from '../../logic/random';
import { CreationWizard } from './CreationWizard';
import styles from './WelcomeScreen.module.css';

export interface WelcomeScreenProps {
  /** Called with a finished character from any of the three creation modes. */
  onCharacterReady: (character: Character) => void;
  /**
   * Abort the creation flow entirely, returning to the caller's prior view.
   * Supplied only when creation was launched over existing characters (from the
   * management sheet's "New Character"), so a user who changes their mind can
   * get back to their active character. Omitted on first run (empty store),
   * where there is nothing to return to. Mirrors the WFRP source, whose
   * NewCharacterChoice stayed dismissible with an explicit Cancel.
   */
  onCancel?: () => void;
}

type Mode = 'initial' | 'wizard' | 'skip';

/**
 * The entry chooser shown when no character exists (Stage A7 PART 3). Offers the
 * THREE creation modes mandated by the user request, mirroring the WFRP
 * WelcomeScreen, re-themed to D&D:
 *   1. Guided Wizard — mounts CreationWizard.
 *   2. Fully Random — generateRandomCharacter(createDefaultRng()).
 *   3. Skip the Wizard — a named blank character straight to the sheet.
 *
 * Accessible: the primary action is focused on mount, and the skip-mode name
 * input is focused when it opens.
 */
export function WelcomeScreen({ onCharacterReady, onCancel }: WelcomeScreenProps) {
  const [mode, setMode] = useState<Mode>('initial');
  const [name, setName] = useState('');
  const wizardBtnRef = useRef<HTMLButtonElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'initial') wizardBtnRef.current?.focus();
    if (mode === 'skip') nameInputRef.current?.focus();
  }, [mode]);

  if (mode === 'wizard') {
    return (
      <CreationWizard
        onComplete={onCharacterReady}
        onCancel={() => setMode('initial')}
      />
    );
  }

  if (mode === 'skip') {
    const trimmed = name.trim();
    const valid = trimmed.length > 0;
    const submit = () => {
      if (valid) onCharacterReady(createCharacter(trimmed));
    };
    return (
      <div className={styles.center}>
        <div className={styles.panel}>
          <h2 className={styles.headingSmall}>Name Your Character</h2>
          <input
            ref={nameInputRef}
            className={styles.nameInput}
            type="text"
            placeholder="Character name"
            aria-label="Character name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          <button
            type="button"
            className={valid ? styles.primaryBtn : styles.primaryBtnDisabled}
            onClick={submit}
            disabled={!valid}
          >
            Create Character
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={() => setMode('initial')}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.center}>
      <div className={styles.panel}>
        <h1 className={styles.heading}>D&amp;D Character Sheet</h1>
        <p className={styles.subtitle}>
          Build a character with the guided wizard, roll one at random, or skip
          ahead and fill in the sheet yourself.
        </p>
        <button
          ref={wizardBtnRef}
          type="button"
          className={styles.primaryBtn}
          aria-describedby="welcome-wizard-desc"
          onClick={() => setMode('wizard')}
        >
          Guided Wizard
        </button>
        <p id="welcome-wizard-desc" className={styles.modeDesc}>
          Best if you&apos;re new to D&amp;D. Walks you through each choice, explains your options, and
          suggests picks for your class.
        </p>
        <button
          type="button"
          className={styles.secondaryBtn}
          aria-describedby="welcome-random-desc"
          onClick={() => onCharacterReady(generateRandomCharacter(createDefaultRng()))}
        >
          Roll a Random Character
        </button>
        <p id="welcome-random-desc" className={styles.modeDesc}>
          Ready to play in one tap: a complete level 1 character with gear (and spells, for a spellcaster). Great for a quick
          game; you can change anything on the sheet.
        </p>
        <button
          type="button"
          className={styles.secondaryBtn}
          aria-describedby="welcome-skip-desc"
          onClick={() => setMode('skip')}
        >
          Skip the Wizard
        </button>
        <p id="welcome-skip-desc" className={styles.modeDesc}>
          For experienced players: start from a blank sheet and fill it in yourself.
        </p>
        {/* Abort the whole flow back to the active character. Only rendered when
            creation was launched over existing characters (onCancel supplied). */}
        {onCancel && (
          <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
