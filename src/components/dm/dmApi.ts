import type { useDmData } from '../../hooks/useDmData';

/** The DM data document and its updaters, as handed to each DM page. */
export type DmApi = ReturnType<typeof useDmData>;
