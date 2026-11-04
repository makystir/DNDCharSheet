import { useEffect, useId, useRef, useState } from 'react';
import type { BreakdownComponent } from '../../logic/breakdown';
import { d20FromFaces, d20TestBreakdown, rollD20, type D20Mode, type D20Roll } from '../../logic/dice';
import { createDefaultRng, type RNG } from '../../logic/random';
import { getDiceEntryMode, type DiceEntryMode } from '../../hooks/useDiceEntryMode';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { CalculatedValue } from './CalculatedValue';
import styles from './RollPrompt.module.css';

/** What a resolved RollPrompt hands back to its caller. */
export interface RollPromptResult {
  /** The raw die kept (natural 1 / 20 are judged on this, never on the total). */
  natural: number;
  /** Every face that was rolled or typed (two for Advantage / Disadvantage). */
  rolls: number[];
  mode: D20Mode;
  /** d20 + modifiers + Exhaustion. */
  total: number;
}

export interface RollPromptProps {
  /** Dialog heading, e.g. "Death Saving Throw". */
  title: string;
  /** Exhaustion level; shown as its own component, -2 per level (decision D1). */
  exhaustionLevel: number;
  /** Extra modifier components shown between the die and the Exhaustion line. */
  modifiers?: BreakdownComponent[];
  /** Optional line of guidance shown above the die (for example the DC). */
  hint?: string;
  initialMode?: D20Mode;
  /** Label of the button that hands the result back. */
  confirmLabel?: string;
  onResolve: (result: RollPromptResult) => void;
  onClose: () => void;
  /** Override the persisted dice-entry preference (mainly for tests). */
  diceEntryMode?: DiceEntryMode;
  /** Override the random source (mainly for tests). */
  rng?: RNG;
}

const MODE_OPTIONS: { value: D20Mode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'advantage', label: 'Advantage' },
  { value: 'disadvantage', label: 'Disadvantage' },
];

/** Parse a typed d20 face; null unless it is a whole number 1..20. */
function parseFace(raw: string): number | null {
  if (!/^\s*\d+\s*$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return n >= 1 && n <= 20 ? n : null;
}

/**
 * Reusable d20 roll dialog (Stage A5a). Structure ported from PWACharSheet's
 * src/components/shared/RollDialog.tsx: overlay + dialog, focus trap, auto Roll
 * button or manual-entry input with range validation (1-20 here, the PWA's
 * d100 is 1-100), mobile bottom sheet. Deviations: it is a d20 prompt with an
 * Advantage / Disadvantage selector instead of Difficulty and Opposed Test,
 * adds Escape-to-close and a body scroll lock (as ConfirmDialog does), and
 * shows the result (dice, modifier breakdown with the Exhaustion line, total)
 * before it is applied.
 *
 * It judges nothing: the caller receives the raw die and the total and hands
 * them to the rules functions.
 */
export function RollPrompt({
  title,
  exhaustionLevel,
  modifiers = [],
  hint,
  initialMode = 'normal',
  confirmLabel = 'Apply result',
  onResolve,
  onClose,
  diceEntryMode,
  rng,
}: RollPromptProps) {
  const [entryMode] = useState<DiceEntryMode>(() => diceEntryMode ?? getDiceEntryMode());
  const [source] = useState<RNG>(() => rng ?? createDefaultRng());
  const isManual = entryMode === 'manual';
  const [mode, setMode] = useState<D20Mode>(initialMode);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState('');
  const [rolled, setRolled] = useState<D20Roll | null>(null);

  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);
  useBodyScrollLock(true);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const needsTwo = mode !== 'normal';

  const handleRoll = () => {
    setError('');
    if (!isManual) {
      setRolled(rollD20(source, mode));
      return;
    }
    const a = parseFace(first);
    const b = parseFace(second);
    if (a === null || (needsTwo && b === null)) {
      setError(
        needsTwo
          ? 'Enter both d20 results as whole numbers between 1 and 20.'
          : 'Enter a d20 result between 1 and 20.',
      );
      return;
    }
    setRolled(d20FromFaces(needsTwo && b !== null ? [a, b] : [a], mode));
  };

  const breakdown = rolled ? d20TestBreakdown(rolled.natural, exhaustionLevel, modifiers) : null;

  const handleConfirm = () => {
    if (!rolled || !breakdown) return;
    onResolve({ natural: rolled.natural, rolls: rolled.rolls, mode, total: breakdown.total });
  };

  const modeLabel = MODE_OPTIONS.find((o) => o.value === mode)?.label ?? 'Normal';
  // The kept die is highlighted (the first face equal to the kept value).
  const keptIndex = rolled ? rolled.rolls.indexOf(rolled.used) : -1;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div ref={dialogRef} className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {hint && <p className={styles.hint}>{hint}</p>}

        {rolled === null ? (
          <>
            <div role="radiogroup" aria-label="Roll type" className={styles.modes}>
              {MODE_OPTIONS.map((o) => (
                <label key={o.value} className={styles.modeLabel}>
                  <input
                    type="radio"
                    name="roll-prompt-mode"
                    value={o.value}
                    checked={mode === o.value}
                    onChange={() => setMode(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>

            {isManual && (
              <div className={styles.manual}>
                <label className={styles.label}>
                  {needsTwo ? 'First d20' : 'Your d20 roll'}
                  <input
                    type="number"
                    className={styles.input}
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                    placeholder="1-20"
                    min={1}
                    max={20}
                    aria-label={needsTwo ? 'First d20 roll' : 'Your d20 roll'}
                  />
                </label>
                {needsTwo && (
                  <label className={styles.label}>
                    Second d20
                    <input
                      type="number"
                      className={styles.input}
                      value={second}
                      onChange={(e) => setSecond(e.target.value)}
                      placeholder="1-20"
                      min={1}
                      max={20}
                      aria-label="Second d20 roll"
                    />
                  </label>
                )}
              </div>
            )}

            {error && (
              <div className={styles.error} role="alert">
                {error}
              </div>
            )}

            <div className={styles.actions}>
              <button type="button" onClick={onClose} className={styles.cancelBtn}>
                Cancel
              </button>
              <button type="button" onClick={handleRoll} className={styles.primaryBtn}>
                {isManual ? 'Resolve' : 'Roll'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.result} role="status" aria-live="polite">
              <div className={styles.dice} data-testid="roll-dice">
                {rolled.rolls.map((face, i) => (
                  <span key={i} className={i === keptIndex ? styles.dieKept : styles.die}>
                    {face}
                  </span>
                ))}
              </div>
              <div className={styles.caption}>
                {rolled.rolls.length === 1
                  ? 'd20'
                  : `${modeLabel}: kept ${rolled.used}`}
              </div>
              <div className={styles.totalRow}>
                <span className={styles.label}>Total</span>
                <span className={styles.total} data-testid="roll-total">
                  {breakdown && <CalculatedValue label={`${title} total`} breakdown={breakdown} />}
                </span>
              </div>
            </div>
            <div className={styles.actions}>
              {/* Manual entry can be corrected; an automatic roll cannot be
                  re-rolled, so it only offers Cancel. */}
              {isManual ? (
                <button type="button" onClick={() => setRolled(null)} className={styles.cancelBtn}>
                  Edit result
                </button>
              ) : (
                <button type="button" onClick={onClose} className={styles.cancelBtn}>
                  Cancel
                </button>
              )}
              <button type="button" onClick={handleConfirm} className={styles.primaryBtn} autoFocus>
                {confirmLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
