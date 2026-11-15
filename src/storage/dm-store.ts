/**
 * Persistence for Dungeon Master mode data. One JSON document in localStorage,
 * kept separate from the player's characters (IndexedDB). Reads are sanitised,
 * so a damaged value yields empty data rather than a crash.
 */
import type { DmData } from '../types/dm';
import { emptyDmData } from '../logic/dm-campaign';
import { parseDmData } from '../logic/dm-sanitize';
import { getItem, setItem, type StorageWriteResult } from './local-storage';

export const DM_DATA_KEY = 'dnd-dm-data';

export function loadDmData(): DmData {
  const raw = getItem(DM_DATA_KEY);
  if (raw === null) return emptyDmData();
  const parsed = parseDmData(raw);
  return parsed.ok ? parsed.data : emptyDmData();
}

export function saveDmData(data: DmData): StorageWriteResult {
  return setItem(DM_DATA_KEY, JSON.stringify(data));
}

export function dmDataToJson(data: DmData): string {
  return JSON.stringify(data, null, 2);
}

export function dmExportFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `dm-data-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
