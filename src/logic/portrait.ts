/**
 * Portrait file validation + constants.
 *
 * Ported (trimmed) from the WFRP app's src/logic/portrait.ts. These are
 * app-level UX constraints on uploaded images, not game rules, so no rulebook
 * citation applies. `readFileAsDataURL` is intentionally NOT ported — only the
 * WFRP migration/export paths (out of scope here) used it.
 */

/** Maximum portrait file size in bytes (5 MB). */
export const PORTRAIT_MAX_BYTES = 5 * 1024 * 1024;

/** Recommended portrait width in pixels (portrait-orientation character art). */
export const PORTRAIT_RECOMMENDED_WIDTH = 400;

/** Recommended portrait height in pixels. */
export const PORTRAIT_RECOMMENDED_HEIGHT = 560;

/** Human-readable max file size (keeps UI copy in sync with PORTRAIT_MAX_BYTES). */
export const PORTRAIT_MAX_SIZE_LABEL = '5 MB';

/**
 * Companion portraits are shown small (a header thumbnail and a 96 px frame),
 * so uploads are shrunk to at most this many pixels on the longer side before
 * they are stored. Keeps exports and backups small.
 */
export const COMPANION_PORTRAIT_MAX_SIDE = 400;

/** Accepted MIME types for portrait images. */
export const PORTRAIT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface PortraitValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a portrait file. Checks MIME type first, then size.
 * Returns { valid: true } or { valid: false, error: '...' }.
 */
export function validatePortraitFile(file: File): PortraitValidationResult {
  if (!PORTRAIT_ACCEPTED_TYPES.includes(file.type)) {
    return { valid: false, error: 'File must be a JPEG, PNG, or WebP image.' };
  }
  if (file.size > PORTRAIT_MAX_BYTES) {
    return { valid: false, error: `File must be ${PORTRAIT_MAX_SIZE_LABEL} or smaller.` };
  }
  return { valid: true };
}

/**
 * Shrink an image so its longer side is at most `maxSide` pixels, keeping the
 * aspect ratio. Returns the original file when it is already small enough, or
 * when the browser cannot decode or re-encode it (no canvas, no
 * createImageBitmap): the upload still succeeds, just unshrunk.
 */
export async function downscaleImage(file: Blob, maxSide: number): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const type = file.type === 'image/png' ? 'image/png' : 'image/webp';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    return blob && blob.size > 0 && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
