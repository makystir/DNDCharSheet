import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Upload, Trash2, ImageOff, X } from 'lucide-react';
import { validatePortraitFile } from '../../logic/portrait';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import styles from './CharacterPortrait.module.css';

interface CharacterPortraitProps {
  /** Object URL for the portrait, or '' for the placeholder. */
  portrait: string;
  /** Used for alt / aria names. */
  characterName: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}

/**
 * Character portrait: a framed image with upload / remove controls and an
 * enlarge-on-click dialog. Ported and re-themed from the WFRP app, minus its
 * optional "Generate Portrait Prompt" button (out of scope this stage).
 *
 * `handleFileChange` validates the file for the immediate aria-live message and
 * to skip a doomed store round-trip, but the authoritative validate-before-
 * persist guard lives in usePortrait.uploadPortrait, so this check is
 * defence-in-depth rather than the sole gate.
 */
export function CharacterPortrait({
  portrait,
  characterName,
  onUpload,
  onRemove,
}: CharacterPortraitProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [enlarged, setEnlarged] = useState(false);
  // Focus trap + return-focus for the enlarged-portrait dialog.
  const overlayRef = useRef<HTMLDivElement>(null);
  useFocusTrap(overlayRef, enlarged);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Close the enlarged view on Escape while it is open.
  useEffect(() => {
    if (!enlarged) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnlarged(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enlarged]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected later.
    e.target.value = '';

    setError('');
    const validation = validatePortraitFile(file);
    if (!validation.valid) {
      setError(validation.error ?? 'Invalid file.');
      return;
    }

    onUpload(file);
  };

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.frame}
        style={{ width: 200, height: 280 }}
        data-testid="portrait-frame"
      >
        {portrait ? (
          <button
            type="button"
            className={styles.enlargeTrigger}
            onClick={() => setEnlarged(true)}
            aria-label={`View enlarged portrait of ${characterName}`}
            aria-haspopup="dialog"
          >
            <img
              src={portrait}
              alt={`Portrait of ${characterName}`}
              className={styles.img}
            />
          </button>
        ) : (
          <div className={styles.placeholder}>
            <ImageOff size={40} />
            <span>No portrait set</span>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <span className={styles.guidance}>Recommended: 400×560 px (max 5 MB)</span>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          aria-label="Upload portrait"
        />

        <button type="button" className={styles.btn} onClick={handleUploadClick}>
          <Upload size={14} />
          Upload Portrait
        </button>

        {portrait && (
          <button type="button" className={styles.removeBtn} onClick={onRemove}>
            <Trash2 size={14} />
            Remove
          </button>
        )}

        <div aria-live="polite" className={styles.error}>
          {error}
        </div>
      </div>

      {enlarged && portrait && (
        <div
          ref={overlayRef}
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label={`Enlarged portrait of ${characterName}`}
          onClick={() => setEnlarged(false)}
        >
          <button
            type="button"
            className={styles.overlayClose}
            onClick={() => setEnlarged(false)}
            aria-label="Close enlarged portrait"
          >
            <X size={24} />
          </button>
          {/* Stop propagation so clicking the image itself doesn't close it. */}
          <img
            src={portrait}
            alt={`Enlarged portrait of ${characterName}`}
            className={styles.overlayImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
