import { useCallback, useEffect, useRef, useState } from 'react';
import type { Character } from './types/character';
import { saveCharacter } from './storage/character-store';
import { useCharacterManager } from './hooks/useCharacterManager';
import { CharacterManagementSheet } from './components/shared/CharacterManagementSheet';
import { CharacterNameHeader } from './components/shared/CharacterNameHeader';
import { useHashRoute } from './hooks/useHashRoute';
import { useConditionalRouteGuard } from './hooks/useConditionalRouteGuard';
import { usePortrait } from './hooks/usePortrait';
import { Navigation } from './components/layout/Navigation';
import { PageContainer } from './components/layout/PageContainer';
import { NAV_ITEMS } from './components/layout/navItems';
import { AriaLiveAnnouncer } from './components/shared/AriaLiveAnnouncer';
import { CharacterPage } from './components/pages/CharacterPage';
import { WelcomeScreen } from './components/creation/WelcomeScreen';
import { CombatPage } from './components/pages/CombatPage';
import { InventoryPage } from './components/pages/InventoryPage';
import { SpellsPage } from './components/pages/SpellsPage';
import { AdvancementPage } from './components/pages/AdvancementPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { isSpellcaster } from './logic/spellcasting';
import { Toast } from './components/shared/Toast';
import { useConcentrationAutoEnd } from './hooks/useConcentrationAutoEnd';
import styles from './App.module.css';

const THEME_KEY = 'dnd-theme';

function App() {
  // Stage B1: the multi-character manager owns the active character + list and
  // the loading status machine (loading/welcome/ready/error), layered on top of
  // the existing IndexedDB character-store. The active character replaces the
  // former single `state.character`; the status drives the same render branches.
  const {
    status,
    errorMessage,
    characters,
    activeId,
    activeCharacter,
    updateActiveCharacter,
    adoptCharacter,
    switchCharacter,
    duplicateCharacter,
    renameCharacter,
    deleteCharacter,
  } = useCharacterManager();

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const { page, subTab, navigate } = useHashRoute();

  // Portrait object-URL lifecycle is owned at the shell, keyed by the active
  // character id so it survives sub-tab navigation (which mounts/unmounts the
  // Overview section). Called unconditionally with a stable call site; an empty
  // id (not yet ready) simply yields no portrait.
  const activeCharacterId = status === 'ready' && activeCharacter ? activeCharacter.id : '';
  const { portraitURL, uploadPortrait, removePortrait } =
    usePortrait(activeCharacterId);

  // Stage B1: the character management sheet open-state + its trigger refs (one
  // per switcher — the desktop sidebar button and the mobile name header — so
  // focus returns to whichever opened it). `creating` forces the welcome flow
  // from the sheet's "New character" action even when characters already exist.
  const [managerOpen, setManagerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  // Which switcher opened the sheet, so focus returns to it on close. Held in
  // state (not a ref) so the ref OBJECT can be passed to the sheet without
  // reading a ref's `.current` during render.
  const [activeTriggerRef, setActiveTriggerRef] = useState<
    React.RefObject<HTMLButtonElement | null>
  >(() => desktopTriggerRef);

  const openManager = useCallback((trigger: React.RefObject<HTMLButtonElement | null>) => {
    setActiveTriggerRef(trigger);
    setManagerOpen(true);
  }, []);

  // Apply + persist theme.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore persistence failure
    }
  }, [theme]);

  // Route guard: if the active route points at a conditional tab the current
  // character can no longer see (e.g. #spells after switching to a non-caster
  // class or dropping below the subclass casting level), redirect to Character.
  // Extracted into a hook so the reactive invalidation (character changes while
  // the route stays active) is unit-testable in isolation (blueprint §6.4).
  useConditionalRouteGuard(
    status === 'ready' ? (activeCharacter ?? undefined) : undefined,
    page,
    navigate,
  );

  const handleChange = useCallback(
    (next: Character) => {
      // Reflect the edit in the manager's in-memory active character + list
      // (name/level/updatedAt) immediately, then persist via the store. The
      // store is the single persistence layer; the manager tracks the index.
      updateActiveCharacter(next);
      void saveCharacter(next).catch((err) => {
        console.error('Failed to save character:', err);
      });
    },
    [updateActiveCharacter],
  );

  // A character produced by the WelcomeScreen (wizard / random / skip): adopt
  // it (persist + make active via the manager), close the management sheet if
  // it drove this creation, and route to the Character tab so the new sheet is
  // shown from the top. Creating from the sheet never blows away existing
  // characters — the store is keyed by id and adopt only adds.
  const handleCharacterReady = useCallback(
    (next: Character) => {
      void adoptCharacter(next).catch((err) => {
        console.error('Failed to save character:', err);
      });
      setCreating(false);
      setManagerOpen(false);
      navigate('character');
    },
    [adoptCharacter, navigate],
  );

  // Stage A5b: Concentration and rest results surface as a Toast. A fresh `id`
  // remounts the Toast so an identical message still shows again.
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const notify = useCallback(
    (text: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text })),
    [],
  );
  useConcentrationAutoEnd(
    status === 'ready' ? (activeCharacter ?? undefined) : undefined,
    handleChange,
    notify,
  );

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  );

  const activeLabel = NAV_ITEMS.find((i) => i.id === page)?.label ?? '';

  // The welcome/creation flow runs on first run (no characters) OR when the
  // management sheet's "New character" action is invoked while characters exist.
  const showWelcome = status === 'welcome' || creating;
  const character = status === 'ready' ? activeCharacter : null;

  return (
    <div className={styles.app}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <Navigation
        activePage={page}
        onPageChange={navigate}
        character={character ?? undefined}
        onOpenCharacterManager={() => openManager(desktopTriggerRef)}
        characterManagerTriggerRef={desktopTriggerRef}
      />

      <PageContainer pageKey={page}>
        {/* Mobile active-character header + switcher (desktop hosts it in the
            sidebar). Shown only when a character is active and not mid-creation. */}
        {character && !showWelcome && (
          <CharacterNameHeader
            ref={mobileTriggerRef}
            characterName={character.name}
            onOpen={() => openManager(mobileTriggerRef)}
          />
        )}

        {status === 'loading' && <p className={styles.status}>Loading…</p>}
        {status === 'error' && (
          <p className={styles.status} role="alert">
            {errorMessage}
          </p>
        )}
        {showWelcome && (
          <WelcomeScreen
            onCharacterReady={handleCharacterReady}
            // Only offer an abort path when creation was launched from the
            // management sheet over an existing active character (`creating`).
            // On true first run (status:'welcome', empty store) there is nothing
            // to return to, so no Cancel is shown. Cancelling clears `creating`,
            // restoring the status:'ready' view of the active character.
            onCancel={creating ? () => setCreating(false) : undefined}
          />
        )}
        {status === 'ready' && !showWelcome && character && (
          <>
            {page === 'character' && (
              <CharacterPage
                character={character}
                onChange={handleChange}
                subTab={subTab}
                onSubTabChange={(tab) => navigate('character', tab)}
                portraitURL={portraitURL}
                onPortraitUpload={uploadPortrait}
                onPortraitRemove={removePortrait}
              />
            )}
            {page === 'combat' && (
              <CombatPage character={character} onChange={handleChange} onNotify={notify} />
            )}
            {page === 'inventory' && (
              <InventoryPage character={character} onChange={handleChange} />
            )}
            {/* Belt-and-braces with the route guard: only render Spells for a
                spellcaster (the guard rewrites the hash, this gates the view). */}
            {page === 'spells' && isSpellcaster(character) && (
              <SpellsPage
                character={character}
                onChange={handleChange}
                onNotify={notify}
                subTab={subTab}
                onSubTabChange={(tab) => navigate('spells', tab)}
              />
            )}
            {page === 'advancement' && (
              <AdvancementPage character={character} onChange={handleChange} />
            )}
            {page === 'settings' && (
              <SettingsPage
                theme={theme}
                onThemeToggle={toggleTheme}
                character={character}
                onChange={handleChange}
              />
            )}
          </>
        )}
      </PageContainer>

      {/* Stage B1: the multi-character management sheet. Mounted whenever the
          app is past loading so it can open from either switcher. */}
      <CharacterManagementSheet
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
        characters={characters}
        activeId={activeId}
        onSwitchCharacter={(id) => {
          void switchCharacter(id);
          navigate('character');
        }}
        onCreateCharacter={() => {
          // Route through the WelcomeScreen creation flow; closing the sheet
          // and flipping `creating` shows it without touching existing
          // characters (adopt only adds on completion).
          setManagerOpen(false);
          setCreating(true);
        }}
        onRenameCharacter={(id, name) => void renameCharacter(id, name)}
        onDuplicateCharacter={(id) => void duplicateCharacter(id)}
        onDeleteCharacter={(id) => void deleteCharacter(id)}
        triggerRef={activeTriggerRef}
      />

      <Toast key={toast?.id ?? 0} message={toast?.text ?? null} duration={5000} />

      {/* Announces the active page label to assistive tech on route change. */}
      <AriaLiveAnnouncer message={activeLabel} />
    </div>
  );
}

export default App;
