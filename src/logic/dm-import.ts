/**
 * Read a player's character into DM mode from whatever the player sent: a full
 * share link (`https://.../#view/<code>`), the bare code after `#view/`, or the
 * text of an exported character file. The input is untrusted; decoding and
 * validation reuse the share viewer's path (size caps, bounded gunzip, the
 * character importer), so a bad paste yields a message, never a crash.
 */
import type { Character } from '../types/character';
import { decodeSharePayload } from './share-codec';
import { validateSharedPayload } from './share-validate';
import { VIEW_ROUTE_PREFIX } from './view-route';

export type ImportResult = { ok: true; character: Character } | { ok: false; error: string };

const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

/** The share code inside a pasted link or a bare code, or null when there is none. */
export function extractShareCode(input: string): string | null {
  const text = input.trim();
  const marker = `#${VIEW_ROUTE_PREFIX}/`;
  const at = text.indexOf(marker);
  const code = (at >= 0 ? text.slice(at + marker.length) : text).trim();
  return CODE_PATTERN.test(code) ? code : null;
}

export async function importCharacterFromText(input: string): Promise<ImportResult> {
  const text = input.trim();
  if (text === '') return { ok: false, error: 'Paste a share link, a share code, or an exported character file.' };

  if (text.startsWith('{')) {
    const validated = validateSharedPayload(text);
    return validated.ok ? validated : { ok: false, error: validated.error };
  }

  const code = extractShareCode(text);
  if (code === null) {
    return { ok: false, error: 'That does not look like a share link. Ask the player to copy it from Settings > Share.' };
  }
  const decoded = await decodeSharePayload(code);
  if (!decoded.ok) return { ok: false, error: decoded.error };
  const validated = validateSharedPayload(decoded.json);
  return validated.ok ? validated : { ok: false, error: validated.error };
}
