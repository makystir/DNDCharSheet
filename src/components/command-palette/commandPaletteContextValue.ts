import { createContext, useContext } from 'react';
import type { Character } from '../../types/character';
import type { PageSection } from '../../components/layout/navItems';

// The context object + its value type + the consumer hook, split out of
// CommandPaletteContext.tsx so that file exports ONLY the Provider component
// (keeps react-refresh fast-refresh happy; same split the WFRP app uses for its
// assistant context). FRAMEWORK derived from PWACharSheet's
// CommandPaletteContext.tsx; extended for the D&D app with navigate/runAction/
// character so the palette can dispatch through the App's navigation path.

export interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Whether the keyboard-shortcuts help overlay is open. */
  shortcutsOpen: boolean;
  /** Open the keyboard-shortcuts help overlay (also closes the palette). */
  openShortcuts: () => void;
  /** Close the keyboard-shortcuts help overlay. */
  closeShortcuts: () => void;
  /** The active character, used to gate the conditional 'spells' page command. */
  character: Character | undefined;
  /** Navigate to a page (the same App navigation path the nav uses). */
  navigate: (page: PageSection) => void;
  /** Run an app-level action by key (e.g. 'toggle-theme'). */
  runAction: (action: string) => void;
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPaletteContext(): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext);
  if (context === null) {
    throw new Error('useCommandPaletteContext must be used within a CommandPaletteProvider');
  }
  return context;
}
