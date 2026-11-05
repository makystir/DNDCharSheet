import { base64urlEncode, base64urlDecode } from './base64url';
import { gzip, gunzip } from './gzip';

/**
 * Versioned share-codec envelope for read-only character links (Stage B5).
 *
 * Wire format: base64url( [SHARE_FORMAT_V] ++ gzip(utf8(json)) )
 * A single leading version byte lets a future reader reject a payload produced
 * by an incompatible encoder. Decoding NEVER throws — every failure mode
 * (oversized, non-base64url, wrong version, bad gzip, invalid UTF-8) returns a
 * structured `{ ok: false }` result so a hostile/corrupt `#view/…` link yields
 * a clean "invalid link" state in the viewer rather than a crash.
 *
 * SECURITY: the decoded payload is UNTRUSTED (attacker-controllable via the URL
 * hash). The caps below are enforced BEFORE any decompression so a decompression
 * bomb cannot inflate without bound: the encoded string is length-capped first,
 * then gunzip aborts as soon as the running decompressed total exceeds the cap.
 *
 * Bucket-1 port from the WFRP app's `src/logic/share-codec.ts`. No game rules,
 * so no re-theming and no rulebook citation.
 */
export const SHARE_FORMAT_V = 1;

/**
 * Reject an encoded payload longer than this before doing any work. Guards BOTH
 * the link length and (together with the decompressed cap) the decompression
 * budget. Attacker-facing size cap, enforced first.
 */
export const MAX_ENCODED_CHARS = 2_000_000;
/** Zip-bomb guard: cap the decompressed byte count (gunzip aborts past this). */
export const MAX_DECOMPRESSED_BYTES = 4_000_000;
/** Upper bound on the decoded JSON string length (used by the validator / viewer). */
export const MAX_JSON_CHARS = 3_000_000;

export type DecodeResult =
  | { ok: true; json: string }
  | { ok: false; error: string; code: string };

/** Encode a JSON string into the versioned, gzipped, base64url envelope. */
export async function encodeSharePayload(json: string): Promise<string> {
  const encoded = new TextEncoder().encode(json);
  // Copy into an ArrayBuffer-backed view so the Web Streams types (which require
  // Uint8Array<ArrayBuffer>, not a possibly-shared buffer) accept it.
  const utf8 = new Uint8Array(new ArrayBuffer(encoded.length));
  utf8.set(encoded);
  const compressed = await gzip(utf8);
  const framed = new Uint8Array(new ArrayBuffer(compressed.length + 1));
  framed[0] = SHARE_FORMAT_V;
  framed.set(compressed, 1);
  return base64urlEncode(framed);
}

/**
 * Decode an encoded share payload back to its JSON string.
 * Order of checks: oversized > base64url decode > version byte > gunzip
 * (bounded) > strict UTF-8 decode. Never throws — returns a typed failure.
 */
export async function decodeSharePayload(encoded: string): Promise<DecodeResult> {
  // (1) Size cap BEFORE any work — cheapest guard, applied to untrusted input.
  if (encoded.length > MAX_ENCODED_CHARS) {
    return { ok: false, error: 'Shared data is too large.', code: 'too-large' };
  }

  // (2) base64url decode — rejects any out-of-alphabet character.
  let framed: Uint8Array;
  try {
    framed = base64urlDecode(encoded);
  } catch {
    return { ok: false, error: 'Shared data is not valid.', code: 'bad-base64url' };
  }

  if (framed.length < 1) {
    return { ok: false, error: 'Shared data is not valid.', code: 'empty' };
  }

  // (3) Version byte.
  if (framed[0] !== SHARE_FORMAT_V) {
    return { ok: false, error: 'Unsupported share link version.', code: 'bad-version' };
  }

  // (4) Bounded gunzip — zip-bomb guard aborts past MAX_DECOMPRESSED_BYTES.
  const compressed = framed.slice(1);
  let decompressed: Uint8Array;
  try {
    decompressed = await gunzip(compressed, MAX_DECOMPRESSED_BYTES);
  } catch {
    return { ok: false, error: 'Shared data could not be read.', code: 'bad-gzip' };
  }

  // (5) Strict UTF-8 decode — rejects malformed byte sequences.
  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(decompressed);
    return { ok: true, json };
  } catch {
    return { ok: false, error: 'Shared data could not be read.', code: 'bad-utf8' };
  }
}
