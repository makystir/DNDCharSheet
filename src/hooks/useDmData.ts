import { useCallback, useEffect, useRef, useState } from 'react';
import type { DmData } from '../types/dm';
import { loadDmData, saveDmData } from '../storage/dm-store';

/**
 * The Dungeon Master data document: loaded once, saved after every change.
 * `update` takes a pure function over the whole document (see logic/dm-campaign).
 */
export function useDmData() {
  const [data, setData] = useState<DmData>(loadDmData);
  const [saveFailed, setSaveFailed] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    // Skip the write for the value that was just loaded.
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    const result = saveDmData(data);
    // Reconciling React with the external storage write result.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveFailed(!result.ok);
  }, [data]);

  const update = useCallback((fn: (d: DmData) => DmData) => setData((prev) => fn(prev)), []);
  const replace = useCallback((next: DmData) => setData(next), []);

  return { data, update, replace, saveFailed };
}
