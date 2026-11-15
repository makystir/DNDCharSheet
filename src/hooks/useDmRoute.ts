import { useSyncExternalStore } from 'react';
import { parseDmRoute, type DmRoute } from '../logic/dm-mode';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const getHash = () => window.location.hash;
const getServerHash = () => '';

/**
 * The Dungeon Master route for the current URL hash (see logic/dm-mode). Tracks
 * `hashchange`, which `useHashRoute.navigate` also dispatches after its
 * `replaceState`, so the DM and player areas switch without a reload.
 */
export function useDmRoute(): DmRoute {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  return parseDmRoute(hash);
}
