import { useEffect } from 'react';
import type { Character } from '../types/character';
import type { PageSection } from '../components/layout/navItems';
import { visibleNavItems } from '../components/layout/navItems';

/**
 * Redirects off a conditional tab the active character can no longer see.
 *
 * When the active route points at a page whose nav item is hidden for the
 * current character (e.g. #spells after switching to a non-caster class or
 * dropping below the subclass casting level), this effect navigates back to
 * Character. It fires whenever the character OR the active page changes, so it
 * covers both a deep-link into an invalid route AND an in-session change that
 * invalidates the currently active route (blueprint §6.4).
 *
 * `navigate` must use history.replaceState (as useHashRoute's does), so the
 * redirect leaves no back-history entry — consistent with the unknown-hash
 * fallback in parseHash.
 */
export function useConditionalRouteGuard(
  character: Character | undefined,
  page: PageSection,
  navigate: (page: PageSection) => void,
): void {
  useEffect(() => {
    if (character === undefined) return;
    const visibleIds = visibleNavItems(character).map((i) => i.id);
    if (!visibleIds.includes(page)) {
      navigate('character');
    }
  }, [character, page, navigate]);
}
