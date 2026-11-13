import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { ImageOff, Sparkles, Trash2, Upload } from 'lucide-react';
import { COMPANION_PORTRAIT_MAX_SIDE, PORTRAIT_MAX_SIZE_LABEL, validatePortraitFile } from '../../logic/portrait';
import { buildRecordPortraitPrompt } from '../../logic/creature-portrait-prompt';
import type { RecordPortraitSubject } from '../../logic/creature-portrait-prompt';
import type { UsePortraitResult } from '../../hooks/usePortrait';
import { PortraitPromptDialog } from '../shared/PortraitPromptDialog';
import { BlurInput } from './BlurInput';
import styles from './CompanionsShared.module.css';

/** The record's portrait settings, supplied by each card. */
export interface RecordPortraitConfig {
  /** Portrait Store key: `<characterId>:<recordId>` (storage/companion-portraits.ts). */
  storeKey: string;
  /** What the portrait prompt knows about the subject. */
  prompt: RecordPortraitSubject;
  /** The record's Appearance text and its setter. */
  appearance: {
    value?: string;
    onChange: (value: string | undefined) => void;
    /** Field label; defaults to "Appearance". */
    label?: string;
    /** Help line under the field. */
    hint?: string;
  };
}

/** Small round thumbnail for the card header; nothing when no portrait is set. */
export function RecordThumbnail({ url }: { url: string }) {
  if (!url) return null;
  return <img src={url} alt="" className={styles.thumb} data-testid="record-thumbnail" />;
}

/**
 * The portrait block at the top of a card body: the image (or a placeholder),
 * Upload / Generate prompt / Remove, and the Appearance field that feeds the
 * prompt. Uploads are checked (type, size) and shrunk before they are stored.
 */
export function RecordPortrait({
  name,
  config,
  portrait,
}: {
  name: string;
  config: RecordPortraitConfig;
  portrait: UsePortraitResult;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [prompting, setPrompting] = useState(false);
  const { portraitURL, portraitError, uploadPortrait, removePortrait } = portrait;

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validatePortraitFile(file);
    if (!check.valid) {
      setError(check.error ?? 'Invalid file.');
      return;
    }
    setError('');
    void uploadPortrait(file);
  };

  return (
    <div className={styles.portraitRow}>
      <div className={styles.portraitFrame}>
        {portraitURL ? (
          <img src={portraitURL} alt={`Portrait of ${name}`} className={styles.portraitImg} />
        ) : (
          <ImageOff size={28} aria-hidden="true" className={styles.portraitPlaceholder} />
        )}
      </div>
      <div className={styles.portraitControls}>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.srOnly}
          tabIndex={-1}
          aria-label={`Upload portrait of ${name}`}
          onChange={onFile}
        />
        <div className={styles.inline}>
          <button type="button" className={styles.btn} onClick={() => fileRef.current?.click()}>
            <Upload size={14} aria-hidden="true" />
            {portraitURL ? 'Change portrait' : 'Upload portrait'}
          </button>
          <button type="button" className={styles.btn} onClick={() => setPrompting(true)}>
            <Sparkles size={14} aria-hidden="true" />
            Portrait prompt
          </button>
          {portraitURL && (
            <button type="button" className={styles.btn} onClick={() => void removePortrait()}>
              <Trash2 size={14} aria-hidden="true" />
              Remove portrait
            </button>
          )}
        </div>
        <span className={styles.figureLabel}>
          {`Square images work best. Up to ${PORTRAIT_MAX_SIZE_LABEL}; larger pictures are shrunk to ${COMPANION_PORTRAIT_MAX_SIDE} px.`}
        </span>
        <div aria-live="polite" className={styles.figureLabel}>
          {error || portraitError || ''}
        </div>
        <label className={styles.field}>
          {config.appearance.label ?? 'Appearance'}
          <BlurInput
            className={styles.control}
            value={config.appearance.value}
            maxLength={300}
            ariaLabel={`${name} ${(config.appearance.label ?? 'appearance').toLowerCase()}`}
            placeholder="Colouring, markings, build, clothing..."
            onCommit={(v) => config.appearance.onChange(typeof v === 'string' ? v : undefined)}
          />
        </label>
        {config.appearance.hint && <span className={styles.figureLabel}>{config.appearance.hint}</span>}
      </div>

      {prompting && (
        <PortraitPromptDialog
          hint={`Copy this prompt into an AI image generator to create a portrait of ${name}.`}
          buildPrompt={(options) => buildRecordPortraitPrompt({ ...config.prompt, appearance: config.appearance.value }, options)}
          onClose={() => setPrompting(false)}
        />
      )}
    </div>
  );
}
