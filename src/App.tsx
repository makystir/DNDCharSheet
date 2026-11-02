import { useCallback, useEffect, useState } from 'react';
import type { Character } from './types/character';
import {
  listCharacters,
  createCharacter,
  saveCharacter,
} from './storage/character-store';
import { useHashRoute } from './hooks/useHashRoute';
import { Navigation } from './components/layout/Navigation';
import { PageContainer } from './components/layout/PageContainer';
import { NAV_ITEMS } from './components/layout/navItems';
import { AriaLiveAnnouncer } from './components/shared/AriaLiveAnnouncer';
import { CharacterPage } from './components/pages/CharacterPage';
import { CombatPage } from './components/pages/CombatPage';
import { SettingsPage } from './components/pages/SettingsPage';
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

  const handleChange = useCallback((next: Character) => {
    setState({ status: 'ready', character: next });
    // Persist in the background; the UI already reflects the change.
    void saveCharacter(next).catch((err) => {
      console.error('Failed to save character:', err);
    });
  }, []);

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

      <Navigation activePage={page} onPageChange={navigate} />

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
              />
            )}
            {page === 'combat' && (
              <CombatPage character={state.character} onChange={handleChange} />
            )}
            {page === 'settings' && (
              <SettingsPage theme={theme} onThemeToggle={toggleTheme} />
            )}
          </>
        )}
      </PageContainer>

      {/* Announces the active page label to assistive tech on route change. */}
      <AriaLiveAnnouncer message={activeLabel} />
    </div>
  );
}

export default App;
