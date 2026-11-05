import { describe, it, expect } from 'vitest';
import { base64ToBlob, blobToBase64, isValidPortraitDataUrl } from '../portrait-codec';

/**
 * Ported from the WFRP portrait-codec tests (Bucket-1 port, Stage B2). The codec
 * is system-agnostic image encoding, so the suite transfers verbatim.
 */

describe('isValidPortraitDataUrl', () => {
  it('accepts a valid JPEG data-URL', () => {
    expect(isValidPortraitDataUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
  });

  it('accepts a valid PNG data-URL', () => {
    expect(isValidPortraitDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('accepts a valid WebP data-URL', () => {
    expect(isValidPortraitDataUrl('data:image/webp;base64,UklGR')).toBe(true);
  });

  it('accepts data-URL with padding characters', () => {
    expect(isValidPortraitDataUrl('data:image/png;base64,AAAA==')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidPortraitDataUrl('')).toBe(false);
  });

  it('rejects a malformed data-URL (missing base64 indicator)', () => {
    expect(isValidPortraitDataUrl('data:image/jpeg,/9j/4AAQ')).toBe(false);
  });

  it('rejects a non-image MIME type', () => {
    expect(isValidPortraitDataUrl('data:text/plain;base64,SGVsbG8=')).toBe(false);
  });

  it('rejects an unsupported image MIME type (gif)', () => {
    expect(isValidPortraitDataUrl('data:image/gif;base64,R0lGODlh')).toBe(false);
  });

  it('rejects a plain URL', () => {
    expect(isValidPortraitDataUrl('https://example.com/image.png')).toBe(false);
  });

  it('rejects data-URL with invalid base64 characters', () => {
    expect(isValidPortraitDataUrl('data:image/png;base64,inv@lid!')).toBe(false);
  });
});

describe('base64ToBlob', () => {
  it('converts a valid JPEG data-URL to a Blob with correct type', () => {
    const blob = base64ToBlob('data:image/jpeg;base64,/9j/4AAQ');
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('image/jpeg');
    expect(blob!.size).toBeGreaterThan(0);
  });

  it('converts a valid PNG data-URL to a Blob with correct type', () => {
    const blob = base64ToBlob('data:image/png;base64,iVBORw0KGgo=');
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('image/png');
    expect(blob!.size).toBeGreaterThan(0);
  });

  it('converts a valid WebP data-URL to a Blob with correct type', () => {
    const blob = base64ToBlob('data:image/webp;base64,UklGRg==');
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe('image/webp');
    expect(blob!.size).toBeGreaterThan(0);
  });

  it('returns null for an empty string', () => {
    expect(base64ToBlob('')).toBeNull();
  });

  it('returns null for a malformed data-URL', () => {
    expect(base64ToBlob('not-a-data-url')).toBeNull();
  });

  it('returns null for a non-image MIME type', () => {
    expect(base64ToBlob('data:text/plain;base64,SGVsbG8=')).toBeNull();
  });

  it('returns null for unsupported image MIME (gif)', () => {
    expect(base64ToBlob('data:image/gif;base64,R0lGODlh')).toBeNull();
  });

  it('produces a Blob whose size matches the decoded base64 length', () => {
    // "AAAA" in base64 decodes to 3 bytes
    const blob = base64ToBlob('data:image/png;base64,AAAA');
    expect(blob).not.toBeNull();
    expect(blob!.size).toBe(3);
  });
});

describe('blobToBase64', () => {
  it('converts a small Blob to a base64 data-URL string', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const blob = new Blob([bytes], { type: 'image/png' });
    const result = await blobToBase64(blob);
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it('round-trips: base64ToBlob then blobToBase64 produces original data-URL content', async () => {
    const originalDataUrl = 'data:image/jpeg;base64,AQIDBAUG';
    const blob = base64ToBlob(originalDataUrl);
    expect(blob).not.toBeNull();
    const roundTripped = await blobToBase64(blob!);
    expect(roundTripped).toBe(originalDataUrl);
  });

  it('round-trips a PNG payload correctly', async () => {
    const originalDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
    const blob = base64ToBlob(originalDataUrl);
    expect(blob).not.toBeNull();
    const roundTripped = await blobToBase64(blob!);
    expect(roundTripped).toBe(originalDataUrl);
  });

  it('round-trips a WebP payload correctly', async () => {
    const originalDataUrl = 'data:image/webp;base64,UklGRg==';
    const blob = base64ToBlob(originalDataUrl);
    expect(blob).not.toBeNull();
    const roundTripped = await blobToBase64(blob!);
    expect(roundTripped).toBe(originalDataUrl);
  });
});
