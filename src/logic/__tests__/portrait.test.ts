import { describe, it, expect } from 'vitest';
import {
  validatePortraitFile,
  PORTRAIT_MAX_BYTES,
} from '../portrait';

/** Build a File with a controlled size (jsdom cannot set .size from content). */
function makeFile(type: string, size: number): File {
  const file = new File(['x'], 'portrait', { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('validatePortraitFile', () => {
  it('accepts JPEG, PNG, and WebP images under the size limit', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validatePortraitFile(makeFile(type, 1024)).valid).toBe(true);
    }
  });

  it('rejects a non-image MIME type', () => {
    const result = validatePortraitFile(makeFile('application/pdf', 1024));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/JPEG, PNG, or WebP/);
  });

  it('rejects a file larger than PORTRAIT_MAX_BYTES', () => {
    const result = validatePortraitFile(makeFile('image/png', PORTRAIT_MAX_BYTES + 1));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/5 MB or smaller/);
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validatePortraitFile(makeFile('image/png', PORTRAIT_MAX_BYTES)).valid).toBe(true);
  });

  it('PORTRAIT_MAX_BYTES is 5 MB', () => {
    expect(PORTRAIT_MAX_BYTES).toBe(5 * 1024 * 1024);
  });
});
