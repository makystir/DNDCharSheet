import { useState, useEffect, useCallback } from 'react';
import type { PageSection } from '../components/layout/navItems';
import { parseHash, formatHash } from '../logic/hash-route';

interface UseHashRouteResult {
  page: PageSection;
  subTab: string | null;
  navigate: (page: PageSection, subTab?: string | null) => void;
}

/**
 * Manages URL hash synchronisation with app navigation state.
 * - Parses the hash on mount and on `hashchange` into a page + optional sub-tab.
 * - Validates the page against known PageSection values, falling back to
 *   'character' for an unknown/empty hash; the sub-tab is returned verbatim and
 *   validated by the owning page.
 * - Uses `history.replaceState` so tab switches do not pollute back-history.
 */
export function useHashRoute(): UseHashRouteResult {
  const [state, setState] = useState<{ page: PageSection; subTab: string | null }>(() => {
    if (typeof window === 'undefined') {
      return { page: 'character', subTab: null };
    }
    const parsed = parseHash(window.location.hash);
    return { page: parsed.page as PageSection, subTab: parsed.subTab };
  });

  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHash(window.location.hash);
      setState({ page: parsed.page as PageSection, subTab: parsed.subTab });
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((page: PageSection, subTab?: string | null) => {
    const hash = formatHash(page, subTab);
    // Use replaceState to avoid polluting back-button history
    history.replaceState(null, '', hash);
    setState({ page, subTab: subTab ?? null });
  }, []);

  return { page: state.page, subTab: state.subTab, navigate };
}
