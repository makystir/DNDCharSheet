import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './CharacterNameHeader.module.css';

interface CharacterNameHeaderProps {
  characterName: string;
  onOpen: () => void;
}

/**
 * Mobile-only active-character header + switcher (Stage B1). Shows the active
 * character name and opens the CharacterManagementSheet on tap. Ported from the
 * WFRP CharacterNameHeader, re-themed to this app's tokens. Hidden on desktop
 * (the sidebar hosts the switcher there).
 */
export const CharacterNameHeader = forwardRef<HTMLButtonElement, CharacterNameHeaderProps>(
  function CharacterNameHeader({ characterName, onOpen }, ref) {
    const displayName = characterName.trim() === '' ? 'Unnamed Character' : characterName;

    return (
      <button
        ref={ref}
        type="button"
        aria-label="Manage characters"
        aria-haspopup="dialog"
        className={styles.header}
        onClick={onOpen}
      >
        <span className={styles.name}>{displayName}</span>
        <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
      </button>
    );
  },
);
