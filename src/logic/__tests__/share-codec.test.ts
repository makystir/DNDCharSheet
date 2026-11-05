import { describe, it, expect } from 'vitest';
import {
  encodeSharePayload,
  decodeSharePayload,
  SHARE_FORMAT_V,
  MAX_ENCODED_CHARS,
} from '../share-codec';
import { base64urlEncode } from '../base64url';

/**
 * share-codec encode->decode round-trip, the over-hard-limit rejection, and
 * defensive (never-throw) typed failures for malformed/garbage input (Stage
 * B5). The decoded payload is UNTRUSTED, so decode must never throw.
 */
describe('share-codec', () => {
  it('round-trips a JSON string through encode -> decode', async () => {
    const json = JSON.stringify({ name: 'Aric the Bold', level: 7, abilities: { str: 16 } });
    const encoded = await encodeSharePayload(json);
    const decoded = await decodeSharePayload(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.json).toBe(json);
  });

  it('round-trips an empty object and unicode content', async () => {
    const json = JSON.stringify({ name: 'Dæmon — Ælfûne 🐉', notes: '' });
    const encoded = await encodeSharePayload(json);
    const decoded = await decodeSharePayload(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(JSON.parse(decoded.json).name).toBe('Dæmon — Ælfûne 🐉');
  });

  it('rejects an over-hard-limit encoded payload with a typed failure (no throw)', async () => {
    const tooBig = 'A'.repeat(MAX_ENCODED_CHARS + 1);
    const decoded = await decodeSharePayload(tooBig);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.code).toBe('too-large');
  });

  it('returns a typed failure for non-base64url garbage (never throws)', async () => {
    const decoded = await decodeSharePayload('!!!not-base64url!!!');
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.code).toBe('bad-base64url');
  });

  it('returns a typed failure for an empty payload', async () => {
    const decoded = await decodeSharePayload('');
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.code).toBe('empty');
  });

  it('returns a typed failure for a wrong version byte', async () => {
    // Framed with a version byte that is not SHARE_FORMAT_V.
    const framed = new Uint8Array([SHARE_FORMAT_V + 9, 1, 2, 3]);
    const decoded = await decodeSharePayload(base64urlEncode(framed));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.code).toBe('bad-version');
  });

  it('returns a typed failure for a correct version byte but non-gzip body', async () => {
    const framed = new Uint8Array([SHARE_FORMAT_V, 9, 9, 9, 9]);
    const decoded = await decodeSharePayload(base64urlEncode(framed));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.code).toBe('bad-gzip');
  });
});
