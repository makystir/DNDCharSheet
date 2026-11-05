import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Copy, Trash2 } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ConfirmDialog } from './ConfirmDialog';
import type { CharacterSummary } from '../../storage/character-manager';
import styles from './CharacterManagementSheet.module.css';

/** Short "Level N <Class>" subtitle for a card, degrading when no class chosen. */
function describeCharacter(character: CharacterSummary): string {
  if (character.className) {
    return `Level ${character.level} ${character.className}`;
  }
  return `Level ${character.level}`;
}

interface CharacterCardProps {
  character: CharacterSummary;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  onSwitch: () => void;
  onRename: (newName: string) => void;
  onRenameStart: () => void;
  onRenameChange: (value: string) => void;
  onRenameCancel: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  announce: (message: string) => void;
}

function CharacterCard({
  character,
  isActive,
  isRenaming,
  renameValue,
  onSwitch,
  onRename,
  onRenameStart,
  onRenameChange,
  onRenameCancel,
  onDuplicate,
  onDelete,
  announce,
}: CharacterCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Guards against a double-fire: pressing Enter confirms the rename and the
  // input then unmounts, whose blur also calls handleRenameConfirm. Without
  // this, onRenameCharacter would run twice for one confirm. Reset whenever a
  // fresh rename begins.
  const settledRef = useRef(false);

  // Auto-focus + select the input when entering rename mode.
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      settledRef.current = false;
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameConfirm = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    const trimmed = renameValue.trim();
    if (trimmed.length >= 1 && trimmed.length <= 50) {
      onRename(trimmed);
      announce(`Renamed to ${trimmed}`);
    } else {
      // Empty / whitespace-only / too long — cancel without renaming.
      onRenameCancel();
    }
  }, [renameValue, onRename, onRenameCancel, announce]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRenameConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        // Mark settled so the ensuing blur-on-unmount doesn't re-run confirm.
        settledRef.current = true;
        onRenameCancel();
      }
    },
    [handleRenameConfirm, onRenameCancel],
  );

  return (
    <div
      role="listitem"
      className={`${styles.characterCard}${isActive ? ` ${styles.characterCardActive}` : ''}`}
    >
      {isRenaming ? (
        <div className={styles.renameInputWrapper}>
          <input
            ref={inputRef}
            type="text"
            className={styles.renameInput}
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleRenameConfirm}
            maxLength={50}
            aria-label="Rename character"
          />
        </div>
      ) : (
        <button
          className={styles.characterNameButton}
          onClick={onSwitch}
          type="button"
          aria-label={isActive ? `${character.name} (active)` : `Switch to ${character.name}`}
        >
          <span className={styles.characterName}>
            {character.name.trim() === '' ? 'Unnamed Character' : character.name}
          </span>
          <span className={styles.characterMeta}>{describeCharacter(character)}</span>
        </button>
      )}
      <div className={styles.actionButtons}>
        <button
          className={styles.actionButton}
          onClick={onRenameStart}
          type="button"
          aria-label={`Rename ${character.name}`}
        >
          <Pencil size={18} aria-hidden="true" />
        </button>
        <button
          className={styles.actionButton}
          onClick={onDuplicate}
          type="button"
          aria-label={`Duplicate ${character.name}`}
        >
          <Copy size={18} aria-hidden="true" />
        </button>
        <button
          className={`${styles.actionButton} ${styles.actionButtonDanger}`}
          onClick={onDelete}
          type="button"
          aria-label={`Delete ${character.name}`}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export interface CharacterManagementSheetProps {
  isOpen: boolean;
  onClose: () => void;
  characters: CharacterSummary[];
  activeId: string;
  onSwitchCharacter: (id: string) => void;
  onCreateCharacter: () => void;
  onRenameCharacter: (id: string, name: string) => void;
  onDuplicateCharacter: (id: string) => void;
  onDeleteCharacter: (id: string) => void;
  /** The control that opened the sheet; focus returns to it on close. */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * The multi-character management sheet (Stage B1). A modal bottom-sheet listing
 * every saved character as a card with Switch / Rename / Duplicate / Delete,
 * plus a "New character" action. Ported from the WFRP
 * `CharacterManagementSheet` (structure + UX), re-bound to this app's manager
 * hook + D&D summary fields and its shared `ConfirmDialog` for deletes.
 *
 * A11y matches the app's other dialogs (ConfirmDialog/FeatAllocationDialog):
 * focus trap, Escape to close, body-scroll-lock, aria-modal, and return-focus
 * to the trigger (handled by useFocusTrap).
 */
export function CharacterManagementSheet({
  isOpen,
  onClose,
  characters,
  activeId,
  onSwitchCharacter,
  onCreateCharacter,
  onRenameCharacter,
  onDuplicateCharacter,
  onDeleteCharacter,
  triggerRef,
}: CharacterManagementSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  const [announcement, setAnnouncement] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rename state (sheet-level, so only one card renames at a time).
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Delete confirmation state.
  const [deletingCharacter, setDeletingCharacter] = useState<CharacterSummary | null>(null);

  useFocusTrap(sheetRef, isOpen);
  useBodyScrollLock(isOpen);

  // Reset transient rename/error state when the sheet closes. The sheet stays
  // MOUNTED across open/close (App always renders it), so this state must be
  // cleared on close rather than relying on unmount. Intentional
  // setState-in-effect reacting to the external `isOpen` prop (same sanctioned
  // pattern as the app's other prop-driven dialogs).
  useEffect(() => {
    if (!isOpen) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setRenamingId(null);
      setRenameValue('');
      setErrorMessage(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen]);

  // Escape closes the sheet — unless a rename input is open, which handles its
  // own Escape (cancel the rename, keep the sheet open).
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (renamingId) return;
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, renamingId]);

  // Explicitly return focus to the opening trigger when the sheet closes. This
  // is an explicit focus-return contract for the caller's chosen switcher
  // (desktop sidebar vs. mobile header); it complements useFocusTrap's own
  // restore-on-cleanup and is idempotent (focusing an already-focused element
  // is a no-op).
  const prevOpen = useRef(isOpen);
  useEffect(() => {
    if (prevOpen.current && !isOpen) {
      const trigger = triggerRef.current;
      if (trigger && document.contains(trigger)) trigger.focus();
    }
    prevOpen.current = isOpen;
  }, [isOpen, triggerRef]);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const handleRenameStart = useCallback((id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  }, []);

  const handleRenameConfirm = useCallback(
    (id: string, newName: string) => {
      onRenameCharacter(id, newName);
      setRenamingId(null);
      setRenameValue('');
    },
    [onRenameCharacter],
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleDuplicate = useCallback(
    (id: string, name: string) => {
      setErrorMessage(null);
      try {
        onDuplicateCharacter(id);
        announce(`Duplicated ${name}`);
      } catch {
        setErrorMessage('Could not duplicate character.');
        announce('Character duplication failed.');
      }
    },
    [onDuplicateCharacter, announce],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deletingCharacter) return;
    const deletedName = deletingCharacter.name;
    onDeleteCharacter(deletingCharacter.id);
    setDeletingCharacter(null);
    announce(`Deleted ${deletedName}`);
  }, [deletingCharacter, onDeleteCharacter, announce]);

  const handleSwitch = useCallback(
    (id: string, name: string) => {
      setErrorMessage(null);
      if (id === activeId) {
        // Tapping the active card just closes the sheet.
        onClose();
        return;
      }
      const targetExists = characters.some((c) => c.id === id);
      if (!targetExists) {
        setErrorMessage('Could not load character. It may have been deleted.');
        announce('Character switch failed. Could not load character.');
        return;
      }
      onSwitchCharacter(id);
      announce(`Switched to ${name}`);
      onClose();
    },
    [activeId, characters, onSwitchCharacter, onClose, announce],
  );

  if (!isOpen) return null;

  const sorted = [...characters].sort((a, b) => b.updatedAt - a.updatedAt);

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="char-management-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="char-management-title" className={styles.title}>
            Manage Characters
          </h2>
          <p className={styles.subtitle}>Create, rename, duplicate, or delete characters</p>
        </div>

        <div className={styles.content}>
          {errorMessage && (
            <div className={styles.errorBanner} role="alert">
              {errorMessage}
            </div>
          )}
          {sorted.length === 0 ? (
            <p className={styles.emptyMessage}>No characters saved</p>
          ) : (
            <div role="list" className={styles.characterList}>
              {sorted.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  isActive={character.id === activeId}
                  isRenaming={renamingId === character.id}
                  renameValue={renamingId === character.id ? renameValue : ''}
                  onSwitch={() => handleSwitch(character.id, character.name)}
                  onRename={(newName) => handleRenameConfirm(character.id, newName)}
                  onRenameStart={() => handleRenameStart(character.id, character.name)}
                  onRenameChange={setRenameValue}
                  onRenameCancel={handleRenameCancel}
                  onDuplicate={() => handleDuplicate(character.id, character.name)}
                  onDelete={() => setDeletingCharacter(character)}
                  announce={announce}
                />
              ))}
            </div>
          )}
          <button type="button" className={styles.newCharacterButton} onClick={onCreateCharacter}>
            New Character
          </button>
        </div>

        {deletingCharacter && (
          <ConfirmDialog
            message={`Are you sure you want to delete ${
              deletingCharacter.name.trim() === '' ? 'this character' : deletingCharacter.name
            }?`}
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeletingCharacter(null)}
            confirmLabel="Delete"
          />
        )}

        <div className={styles.liveRegion} aria-live="polite" aria-atomic="true" role="status">
          {announcement}
        </div>
      </div>
    </div>,
    document.body,
  );
}
