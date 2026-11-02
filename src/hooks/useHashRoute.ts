import { useState, useEffect, useCallback } from 'react';
import type { PageSection } from '../components/layout/navItems';
import { parseHash, formatHash } from '../logic/hash-route';

interface UseHashRouteResult {
  page: PageSection;
  navigate: (page: PageSection) => void;
}

/**
 * Manages URL hash synchronisation with app navigation state.
 * - Parses the hash on mount and on `hashchange`.
 * - Validates the page against known PageSection values, falling back to
 *   'character' for an unknown/empty hash.
 * - Uses `history.replaceState` so tab switches do not pollute back-history.
 */
export function useHashRoute(): UseHashRouteResult {
  const [page, setPage] = useState<PageSection>(() => {
    if (typeof window === 'undefined') {
      return 'character';
    }
    return parseHash(window.location.hash).page;
  });

  useEffect(() => {
    const handleHashChange = () => {
      setPage(parseHash(window.location.hash).page);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((next: PageSection) => {
    const hash = formatHash(next);
    // Use replaceState to avoid polluting back-button history
    history.replaceState(null, '', hash);
    setPage(next);
  }, []);

  return { page, navigate };
}
