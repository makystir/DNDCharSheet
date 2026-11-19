import { createContext } from 'react';

/**
 * The id of the record to open and scroll into view: set from a deep link
 * (#companions/creatures/<id>, from the Combat Allies card) or right after a
 * record is added. RecordCard reads it; null means nobody is targeted.
 */
export const RecordFocusContext = createContext<string | null>(null);

