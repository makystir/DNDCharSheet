import { useCallback, useEffect, useState } from 'react';
import type { Character } from './types/character';
import {
  listCharacters,
  createCharacter,
  saveCharacter,
} from './storage/character-store';
import { CharacterSheet } from './components/pages/CharacterSheet';
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
          message: err instanceof Error ? err.message : 'Failed to load character data.',
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

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <span className={styles.brand}>D&amp;D 5.5e Character Assistant</span>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </header>

      <main id="main-content" className={styles.main}>
        {state.status === 'loading' && (
          <p className={styles.status}>Loading…</p>
        )}
        {state.status === 'error' && (
          <p className={styles.status} role="alert">
            {state.message}
          </p>
        )}
        {state.status === 'ready' && (
          <CharacterSheet character={state.character} onChange={handleChange} />
        )}
      </main>
    </div>
  );
}

export default App;
