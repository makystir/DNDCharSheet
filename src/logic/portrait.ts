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
