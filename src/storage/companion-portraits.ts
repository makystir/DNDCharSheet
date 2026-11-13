/**
 * Companion portraits: images for the records on the Companions page
 * (creatures, hirelings, NPC party members, sidekicks).
 *
 * They live in the same Portrait Store as the character portrait, keyed
 * `<characterId>:<recordId>`, so they never bloat the character JSON. These
 * helpers move them with the character: export and backup embed them (by
 * record id), import and restore save them under the new character id,
 * duplicate copies them, delete removes them, and `pruneCompanionPortraits`
 * drops images whose record was removed. Share links leave them out
 * (logic/share-portrait.ts). No game rules here.
 */

import type { Character } from '../types/character';
import { getPortraitStore } from './portrait-store';
import { base64ToBlob, blobToBase64, isValidPortraitDataUrl } from './portrait-codec';

/** Guard on how many companion portraits one imported character may carry. */
const COMPANION_PORTRAITS_MAX = 120;

/** The store key of one record's portrait. */
export function companionPortraitKey(characterId: string, recordId: string): string {
  return `${characterId}:${recordId}`;
}

function prefixOf(characterId: string): string {
  return `${characterId}:`;
}

/** Every record id on the character's Companions page lists. */
export function trackedRecordIds(character: Pick<Character, 'companions' | 'hirelings' | 'npcPartyMembers' | 'sidekicks'>): string[] {
  return [
    ...(character.companions ?? []),
    ...(character.hirelings ?? []),
    ...(character.npcPartyMembers ?? []),
    ...(character.sidekicks ?? []),
  ].map((r) => r.id);
}

/**
 * Read the portraits of the character's records as base64 data-URLs, keyed by
 * record id. Undefined when there are none (or the store is unavailable).
 */
export async function collectCompanionPortraits(
  character: Character,
  characterId: string = character.id,
): Promise<Record<string, string> | undefined> {
  const store = getPortraitStore();
  const out: Record<string, string> = {};
  for (const recordId of trackedRecordIds(character)) {
    try {
      const result = await store.getPortraitBlob(companionPortraitKey(characterId, recordId));
      if (result.ok && result.value) out[recordId] = await blobToBase64(result.value);
    } catch {
      // One unreadable image never blocks the export or backup.
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Validate an untrusted portrait map from an import: only image data-URLs for
 * record ids the (already sanitized) character has, capped in count.
 */
export function sanitizeCompanionPortraitMap(
  value: unknown,
  character: Pick<Character, 'companions' | 'hirelings' | 'npcPartyMembers' | 'sidekicks'>,
): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const ids = new Set(trackedRecordIds(character));
  const out: Record<string, string> = {};
  let count = 0;
  for (const [recordId, dataUrl] of Object.entries(value as Record<string, unknown>)) {
    if (count >= COMPANION_PORTRAITS_MAX) break;
    if (!ids.has(recordId) || typeof dataUrl !== 'string' || !isValidPortraitDataUrl(dataUrl)) continue;
    out[recordId] = dataUrl;
    count++;
  }
  return count > 0 ? out : undefined;
}

/**
 * Save imported or restored companion portraits under `character.id`. Entries
 * for records the character does not have are skipped. Reports a quota stop.
 */
export async function restoreCompanionPortraits(
  character: Character,
  portraits: unknown,
): Promise<{ saved: number; quota: boolean }> {
  const clean = sanitizeCompanionPortraitMap(portraits, character);
  if (!clean) return { saved: 0, quota: false };
  const store = getPortraitStore();
  let saved = 0;
  for (const [recordId, dataUrl] of Object.entries(clean)) {
    const blob = base64ToBlob(dataUrl);
    if (!blob) continue;
    const result = await store.savePortrait(companionPortraitKey(character.id, recordId), blob);
    if (!result.ok) {
      if (/quota/i.test(result.error)) return { saved, quota: true };
      continue;
    }
    saved++;
  }
  return { saved, quota: false };
}

/** Copy every companion portrait of one character to another (duplicate keeps record ids). */
export async function copyCompanionPortraits(fromCharacterId: string, toCharacterId: string): Promise<void> {
  const store = getPortraitStore();
  const keys = await store.listKeysWithPrefix(prefixOf(fromCharacterId));
  if (!keys.ok) return;
  for (const key of keys.value) {
    const recordId = key.slice(prefixOf(fromCharacterId).length);
    const blob = await store.getPortraitBlob(key);
    if (blob.ok && blob.value) await store.savePortrait(companionPortraitKey(toCharacterId, recordId), blob.value);
  }
}

/** Delete every companion portrait of a character (character deleted). */
export async function deleteCompanionPortraits(characterId: string): Promise<void> {
  const store = getPortraitStore();
  const keys = await store.listKeysWithPrefix(prefixOf(characterId));
  if (!keys.ok) return;
  for (const key of keys.value) await store.deletePortrait(key);
}

/**
 * Drop portraits whose record no longer exists. Run when the Companions page
 * mounts, so a removed record keeps its image during the undo window and the
 * leftover is cleaned on the next visit.
 */
export async function pruneCompanionPortraits(character: Character): Promise<void> {
  const store = getPortraitStore();
  const keys = await store.listKeysWithPrefix(prefixOf(character.id));
  if (!keys.ok) return;
  const live = new Set(trackedRecordIds(character).map((id) => companionPortraitKey(character.id, id)));
  for (const key of keys.value) if (!live.has(key)) await store.deletePortrait(key);
}
