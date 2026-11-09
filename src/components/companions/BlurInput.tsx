import type { KeyboardEvent } from 'react';

export interface BlurInputProps {
  /** Stored value; `undefined` = empty. The input re-syncs whenever this changes. */
  value: string | number | undefined;
  kind?: 'text' | 'number';
  /** Called on blur / Enter with the cleaned value (`undefined` when emptied). */
  onCommit: (value: string | number | undefined) => void;
  min?: number;
  max?: number;
  maxLength?: number;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
  multiline?: boolean;
}

function blurOnEnter(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  if (e.key === 'Enter' && !(e.currentTarget instanceof HTMLTextAreaElement)) e.currentTarget.blur();
}

/**
 * A text or whole-number input that commits on blur or Enter (not on every
 * keystroke), so typing "-5" works and the app's undo stack gets one entry per
 * edit. Numbers are truncated and clamped to [min, max]; an empty field clears
 * the value. Uncontrolled with a key, so an outside change (undo, import)
 * replaces what is shown.
 */
export function BlurInput({
  value,
  kind = 'text',
  onCommit,
  min,
  max,
  maxLength,
  className,
  ariaLabel,
  placeholder,
  multiline,
}: BlurInputProps) {
  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (kind === 'text') {
      onCommit(trimmed === '' ? undefined : trimmed);
      return;
    }
    if (trimmed === '') {
      onCommit(undefined);
      return;
    }
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(n)) return;
    const lo = min ?? -Infinity;
    const hi = max ?? Infinity;
    onCommit(Math.min(hi, Math.max(lo, n)));
  };

  const shown = value === undefined ? '' : String(value);
  if (multiline) {
    return (
      <textarea
        key={shown}
        className={className}
        defaultValue={shown}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onBlur={(e) => commit(e.target.value)}
      />
    );
  }
  return (
    <input
      key={shown}
      type={kind === 'number' ? 'number' : 'text'}
      inputMode={kind === 'number' ? 'numeric' : undefined}
      className={className}
      defaultValue={shown}
      min={min}
      max={max}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={blurOnEnter}
    />
  );
}
