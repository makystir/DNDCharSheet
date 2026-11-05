import { describe, it, expect } from 'vitest';
import { base64urlEncode, base64urlDecode } from '../base64url';

/** base64url round-trip + out-of-alphabet rejection (Stage B5). */
describe('base64url', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 127, 128]);
    const encoded = base64urlEncode(bytes);
    expect(base64urlDecode(encoded)).toEqual(bytes);
  });

  it('round-trips the empty byte array', () => {
    const encoded = base64urlEncode(new Uint8Array([]));
    expect(base64urlDecode(encoded)).toEqual(new Uint8Array([]));
  });

  it('produces URL-safe output with no +, /, or = padding', () => {
    const bytes = new Uint8Array(Array.from({ length: 32 }, (_, i) => (i * 7) & 0xff));
    const encoded = base64urlEncode(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('throws on input containing characters outside the base64url alphabet', () => {
    expect(() => base64urlDecode('!!!not-base64url!!!')).toThrow();
    expect(() => base64urlDecode('abc+def')).toThrow();
    expect(() => base64urlDecode('abc/def')).toThrow();
  });
});
