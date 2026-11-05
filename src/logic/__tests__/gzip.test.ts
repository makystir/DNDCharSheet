import { describe, it, expect, vi, afterEach } from 'vitest';
import { gzip, gunzip, isGzipSupported } from '../gzip';

/** gzip round-trip, the size-cap guard, and the no-CompressionStream fallback. */
describe('gzip / gunzip', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports support when CompressionStream is present (Node >= 20 global)', () => {
    expect(isGzipSupported()).toBe(true);
  });

  it('round-trips bytes through gzip -> gunzip', async () => {
    const text = 'The quick brown fox jumps over the lazy dog. '.repeat(50);
    const bytes = new TextEncoder().encode(text);
    const compressed = await gzip(bytes);
    const restored = await gunzip(compressed, 10_000_000);
    expect(new TextDecoder().decode(restored)).toBe(text);
  });

  it('aborts decompression once the output exceeds maxBytes (zip-bomb guard)', async () => {
    // Highly compressible input inflates well past a tiny cap.
    const bytes = new TextEncoder().encode('A'.repeat(100_000));
    const compressed = await gzip(bytes);
    await expect(gunzip(compressed, 1000)).rejects.toThrow(/exceeds maximum/);
  });

  it('rejects invalid gzip data without an uncaught throw path', async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(gunzip(garbage, 10_000)).rejects.toBeInstanceOf(Error);
  });

  it('falls back to identity passthrough when CompressionStream is unavailable', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    vi.stubGlobal('DecompressionStream', undefined);
    expect(isGzipSupported()).toBe(false);

    const bytes = new TextEncoder().encode('hello fallback');
    const out = await gzip(bytes);
    // Identity: output equals input when compression is unavailable.
    expect(out).toEqual(bytes);
    const restored = await gunzip(out, 10_000);
    expect(new TextDecoder().decode(restored)).toBe('hello fallback');
  });

  it('still enforces the size cap on the fallback gunzip path', async () => {
    vi.stubGlobal('DecompressionStream', undefined);
    const bytes = new Uint8Array(2000);
    await expect(gunzip(bytes, 1000)).rejects.toThrow(/exceeds maximum/);
  });
});
