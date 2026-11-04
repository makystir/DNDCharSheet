import { useCallback, useEffect, useState } from 'react';
import type { Character } from './types/character';
import {
  listCharacters,
  createCharacter,
  saveCharacter,
} from './storage/character-store';
import { useHashRoute } from './hooks/useHashRoute';
import { useConditionalRouteGuard } from './hooks/useConditionalRouteGuard';
import { usePortrait } from './hooks/usePortrait';
import { Navigation } from './components/layout/Navigation';
import { PageContainer } from './components/layout/PageContainer';
import { NAV_ITEMS } from './components/layout/navItems';
import { AriaLiveAnnouncer } from './components/shared/AriaLiveAnnouncer';
import { CharacterPage } from './components/pages/CharacterPage';
import { CombatPage } from './components/pages/CombatPage';
import { InventoryPage } from './components/pages/InventoryPage';
import { SpellsPage } from './components/pages/SpellsPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { isSpellcaster } from './logic/spellcasting';
import { Toast } from './components/shared/Toast';
import { useConcentrationAutoEnd } from './hooks/useConcentrationAutoEnd';
import styles from './App.module.css';

const THEME_KEY = 'dnd-theme';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; character: Character }
  | { status: 'error'; message: string };

function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
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
  const activeCharacterId = state.status === 'ready' ? state.character.id : '';
  const { portraitURL, uploadPortrait, removePortrait } =
    usePortrait(activeCharacterId);

  // Load the most recent character, or create a fresh one if none exist.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await listCharacters();
        if (cancelled) return;
        if (existing.length > 0) {
          setState({ status: 'ready', character: existing[0] });
        } else {
          const fresh = await saveCharacter(createCharacter());
          if (cancelled) return;
          setState({ status: 'ready', character: fresh });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          status: 'error',
          message:
            err instanceof Error ? err.message : 'Failed to load character data.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
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
    state.status === 'ready' ? state.character : undefined,
    page,
    navigate,
  );

  const handleChange = useCallback((next: Character) => {
    setState({ status: 'ready', character: next });
    // Persist in the background; the UI already reflects the change.
    void saveCharacter(next).catch((err) => {
      console.error('Failed to save character:', err);
    });
  }, []);

  // Stage A5b: Concentration and rest results surface as a Toast. A fresh `id`
  // remounts the Toast so an identical message still shows again.
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const notify = useCallback(
    (text: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text })),
    [],
  );
  useConcentrationAutoEnd(
    state.status === 'ready' ? state.character : undefined,
    handleChange,
    notify,
  );

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  );

  const activeLabel = NAV_ITEMS.find((i) => i.id === page)?.label ?? '';

  return (
    <div className={styles.app}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <Navigation
        activePage={page}
        onPageChange={navigate}
        character={state.status === 'ready' ? state.character : undefined}
      />

      <PageContainer pageKey={page}>
        {state.status === 'loading' && <p className={styles.status}>Loading…</p>}
        {state.status === 'error' && (
          <p className={styles.status} role="alert">
            {state.message}
          </p>
        )}
        {state.status === 'ready' && (
          <>
            {page === 'character' && (
              <CharacterPage
                character={state.character}
                onChange={handleChange}
                subTab={subTab}
                onSubTabChange={(tab) => navigate('character', tab)}
                portraitURL={portraitURL}
                onPortraitUpload={uploadPortrait}
                onPortraitRemove={removePortrait}
              />
            )}
            {page === 'combat' && (
              <CombatPage character={state.character} onChange={handleChange} onNotify={notify} />
            )}
            {page === 'inventory' && (
              <InventoryPage character={state.character} onChange={handleChange} />
            )}
            {/* Belt-and-braces with the route guard: only render Spells for a
                spellcaster (the guard rewrites the hash, this gates the view). */}
            {page === 'spells' && isSpellcaster(state.character) && (
              <SpellsPage
                character={state.character}
                onChange={handleChange}
                onNotify={notify}
                subTab={subTab}
                onSubTabChange={(tab) => navigate('spells', tab)}
              />
            )}
            {page === 'settings' && (
              <SettingsPage
                theme={theme}
                onThemeToggle={toggleTheme}
                character={state.character}
                onChange={handleChange}
              />
            )}
          </>
        )}
      </PageContainer>

      <Toast key={toast?.id ?? 0} message={toast?.text ?? null} duration={5000} />

      {/* Announces the active page label to assistive tech on route change. */}
      <AriaLiveAnnouncer message={activeLabel} />
    </div>
  );
}

export default App;
