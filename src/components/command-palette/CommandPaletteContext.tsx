import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Character } from '../../types/character';
import type { PageSection } from '../../components/layout/navItems';
import { CommandPaletteContext } from './commandPaletteContextValue';

// FRAMEWORK ported from PWACharSheet's CommandPaletteContext.tsx (open/close +
// shortcuts-overlay state). The context object, its value type, and the
// consumer hook live in ./commandPaletteContextValue so THIS file exports only
// the Provider component (fast-refresh friendly); consumers import
// useCommandPaletteContext from ./commandPaletteContextValue.

export function CommandPaletteProvider({
  children,
  character,
  navigate,
  runAction,
}: {
  children: ReactNode;
  /** The active character (gates the Spells page command). */
  character?: Character;
  /** Navigate to a page — the App's navigate callback. */
  navigate: (page: PageSection) => void;
  /** Run an app-level action by key. */
  runAction: (action: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Opening the shortcuts overlay closes the palette so they never overlap.
  const openShortcuts = useCallback(() => {
    setIsOpen(false);
    setShortcutsOpen(true);
  }, []);
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  return (
    <CommandPaletteContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        shortcutsOpen,
        openShortcuts,
        closeShortcuts,
        character,
        navigate,
        runAction,
      }}
    >
      {children}
    </CommandPaletteContext.Provider>
  );
}


