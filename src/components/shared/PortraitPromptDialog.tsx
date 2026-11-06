import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import type { Character } from '../../types/character';
import {
  buildPortraitPrompt,
  PORTRAIT_MOODS,
  PORTRAIT_STYLES,
} from '../../logic/portrait-prompt';
import type { PortraitFraming, PortraitMood, PortraitStyle } from '../../logic/portrait-prompt';
import { loadPortraitPrefs, savePortraitPrefs } from '../../logic/portrait-prompt-prefs';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import styles from './PortraitPromptDialog.module.css';

interface PortraitPromptDialogProps {
  character: Character;
  onClose: () => void;
}

const EXTRA_DETAILS_MAX = 300;

/**
 * Modal that builds a copy-pasteable AI image-generation prompt for a character
 * portrait. It only shows/copies text: it never changes the character. Style,
 * framing and mood are remembered in localStorage.
 */
export function PortraitPromptDialog({ character, onClose }: PortraitPromptDialogProps) {
  const [initialPrefs] = useState(loadPortraitPrefs);
  const [framing, setFraming] = useState<PortraitFraming>(initialPrefs.framing);
  const [style, setStyle] = useState<PortraitStyle>(initialPrefs.style);
  const [mood, setMood] = useState<PortraitMood>(initialPrefs.mood);
  const [extraDetails, setExtraDetails] = useState('');
  const [copied, setCopied] = useState(false);

  const styleId = useId();
  const moodId = useId();
  const extraId = useId();
  const textId = useId();

  const overlayRef = useRef<HTMLDivElement>(null);
  useFocusTrap(overlayRef, true);

  const prompt = useMemo(
    () => buildPortraitPrompt(character, { framing, style, mood, extraDetails }),
    [character, framing, style, mood, extraDetails],
  );

  useEffect(() => {
    savePortraitPrefs({ style, framing, mood });
  }, [style, framing, mood]);

  // Close on Escape.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Reset the "Copied" confirmation shortly after it shows.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); select the text instead.
      const el = document.getElementById(textId) as HTMLTextAreaElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }
  };

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Generate portrait prompt"
      onClick={onClose}
    >
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Generate Portrait Prompt</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <p className={styles.hint}>
          Copy this prompt into an AI image generator to create a portrait for your character.
        </p>

        <div className={styles.framingGroup} role="radiogroup" aria-label="Framing">
          <span className={styles.label}>Framing</span>
          <div className={styles.framingOptions}>
            <button
              type="button"
              role="radio"
              aria-checked={framing === 'portrait'}
              className={framing === 'portrait' ? styles.framingBtnActive : styles.framingBtn}
              onClick={() => setFraming('portrait')}
            >
              Portrait (bust)
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={framing === 'fullBody'}
              className={framing === 'fullBody' ? styles.framingBtnActive : styles.framingBtn}
              onClick={() => setFraming('fullBody')}
            >
              Full body
            </button>
          </div>
        </div>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={styleId}>
              Art style
            </label>
            <select
              id={styleId}
              className={styles.select}
              value={style}
              onChange={(e) => setStyle(e.target.value as PortraitStyle)}
            >
              {PORTRAIT_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={moodId}>
              Expression
            </label>
            <select
              id={moodId}
              className={styles.select}
              value={mood}
              onChange={(e) => setMood(e.target.value as PortraitMood)}
            >
              {PORTRAIT_MOODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={extraId}>
            Extra details (optional)
          </label>
          <input
            id={extraId}
            type="text"
            className={styles.input}
            value={extraDetails}
            maxLength={EXTRA_DETAILS_MAX}
            placeholder="e.g. a scar over the left eyebrow"
            onChange={(e) => setExtraDetails(e.target.value)}
          />
        </div>

        <textarea
          id={textId}
          className={styles.promptText}
          value={prompt}
          readOnly
          rows={12}
          aria-label="Generated portrait prompt"
        />

        <div className={styles.actions}>
          <span className={styles.srOnly} role="status" aria-live="polite">
            {copied ? 'Prompt copied to clipboard' : ''}
          </span>
          <button type="button" className={styles.copyBtn} onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Prompt'}
          </button>
          <button type="button" className={styles.doneBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
