/**
 * Link-size thresholds and portrait trimming for GM share links (Stage B5).
 *
 * A shareable URL has practical length limits, so the link variant of a
 * character drops the heaviest, non-essential data — the embedded portrait
 * image — to keep the encoded URL small. The snapshot/export path (file /
 * clipboard) keeps the portrait; only the link variant trims it.
 *
 * In this app a portrait is NOT stored on the `Character` record (it lives in
 * the Portrait Store and is embedded under a `portrait` field only at export
 * time — see storage/export-import.ts `exportCharacter`). `trimForLink`
 * therefore operates on the EXPORT ENVELOPE JSON string, stripping that
 * embedded `portrait` field before the payload is compressed into the link.
 *
 * Bucket-1 port from the WFRP app's `src/logic/share-portrait.ts`, re-themed to
 * the D&D export envelope. No game rules, so no rulebook citation.
 */

/** Below SOFT: link length is comfortable. Between SOFT and HARD: warn. */
export const SHARE_SOFT_LIMIT = 8000;
/** At/above HARD: the link is too long to rely on. */
export const SHARE_HARD_LIMIT = 16000;

export type ShareLinkLength = 'none' | 'soft' | 'hard';

/**
 * Produce the link variant of an export-envelope JSON string: the embedded
 * `portrait` and `companionPortraits` fields are removed so the compressed URL
 * stays small. Pure: it never
 * mutates the input. A payload that is not a JSON object, or has no portrait, is
 * returned unchanged (best-effort — the caller still bounds the link length).
 */
export function trimForLink(envelopeJson: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(envelopeJson);
  } catch {
    return envelopeJson;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return envelopeJson;
  }
  const obj = parsed as Record<string, unknown>;
  if (!('portrait' in obj) && !('companionPortraits' in obj)) {
    return envelopeJson;
  }
  const { portrait: _portrait, companionPortraits: _companions, ...rest } = obj;
  void _portrait;
  void _companions;
  return JSON.stringify(rest);
}

/**
 * Classify a full view-link href by length. Uses `>=` so a length exactly at a
 * limit falls into the heavier bucket.
 */
export function classifyLinkLength(hrefLength: number): ShareLinkLength {
  if (hrefLength >= SHARE_HARD_LIMIT) return 'hard';
  if (hrefLength >= SHARE_SOFT_LIMIT) return 'soft';
  return 'none';
}
