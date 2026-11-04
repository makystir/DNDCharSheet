import { useEffect, useId, useRef, useState } from 'react';
import type { HitDie } from '../../data/classes';
import { rollDie } from '../../logic/dice';
import { createDefaultRng, type RNG } from '../../logic/random';
import { getDiceEntryMode, type DiceEntryMode } from '../../hooks/useDiceEntryMode';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { CalculatedValue } from './CalculatedValue';
import { formatSigned } from '../../logic/breakdown';
import type { Breakdown } from '../../logic/breakdown';
import styles from './RollPrompt.module.css';

export interface HpRollResult {
  /** The raw Hit Die face rolled or typed (1..hitDie). */
  face: number;
}

export interface HpRollDialogProps {
  /** Dialog heading, e.g. "Roll Hit Points — Level 4". */
  title: string;
  /** The class Hit Die to roll (d6/d8/d10/d12). */
  hitDie: HitDie;
  /** The Constitution modifier added to the rolled face (minimum total of 1). */
  conMod: number;
  onResolve: (result: HpRollResult) => void;
  onClose: () => void;
  /** Override the persisted dice-entry preference (mainly for tests). */
  diceEntryMode?: DiceEntryMode;
  /** Override the random source (mainly for tests). */
  rng?: RNG;
}

/** Parse a typed Hit-Die face; null unless it is a whole number 1..sides. */
function parseFace(raw: string, sides: number): number | null {
  if (!/^\s*\d+\s*$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return n >= 1 && n <= sides ? n : null;
}

/**
 * Hit-Die roll dialog for a per-level HP choice (Stage A6a).
 *
 * DEVIATION (ui-parity): the shared RollPrompt (A5a) is a d20-only prompt with
 * Advantage / Disadvantage; a per-level HP gain rolls the CLASS HIT DIE
 * (d6/d8/d10/d12) with no advantage. Rather than widen RollPrompt's d20
 * contract, this reuses the SAME dice-entry-mode seam (getDiceEntryMode +
 * rollDie) and the SAME RollPrompt.module.css styling/structure (overlay,
 * focus trap, body-scroll-lock, Escape-to-close, auto-roll vs manual entry,
 * mobile bottom sheet). It judges no rule: the HP MATH (Con rider, minimum-1
 * floor) lives in logic/advancement.ts; this only captures the raw face.
 *
 * PHB 2024 "Gaining a Level" (L2013-2014): roll the class Hit Die and add your
 * Constitution modifier (minimum total of 1).
 */
export function HpRollDialog({
  title,
  hitDie,
  conMod,
  onResolve,
  onClose,
  diceEntryMode,
  rng,
}: HpRollDialogProps) {
  const [entryMode] = useState<DiceEntryMode>(() => diceEntryMode ?? getDiceEntryMode());
  const [source] = useState<RNG>(() => rng ?? createDefaultRng());
  const isManual = entryMode === 'manual';
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [face, setFace] = useState<number | null>(null);

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

  const handleRoll = () => {
    setError('');
    if (!isManual) {
      setFace(rollDie(source, hitDie));
      return;
    }
    const parsed = parseFace(typed, hitDie);
    if (parsed === null) {
      setError(`Enter a d${hitDie} result between 1 and ${hitDie}.`);
      return;
    }
    setFace(parsed);
  };

  // The HP-gain breakdown: rolled face + Con modifier, floored at 1. Components
  // sum to the pre-floor subtotal; the minimum-1 floor is shown as a note when
  // it applies (it is not an addend). PHB 2024 "Gaining a Level".
  const breakdown: Breakdown | null =
    face === null
      ? null
      : (() => {
          const subtotal = face + conMod;
          const total = Math.max(1, subtotal);
          return {
            total,
            components: [
              { label: `d${hitDie} roll`, value: face },
              { label: 'Con modifier', value: conMod },
            ],
            note: total !== subtotal ? 'Raised to the minimum of 1 per level.' : undefined,
          };
        })();

  const handleConfirm = () => {
    if (face === null) return;
    onResolve({ face });
  };

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div ref={dialogRef} className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p className={styles.hint}>
          Roll a d{hitDie} and add your Constitution modifier ({formatSigned(conMod)}), to a
          minimum of 1.
        </p>

        {face === null ? (
          <>
            {isManual && (
              <div className={styles.manual}>
                <label className={styles.label}>
                  Your d{hitDie} roll
                  <input
                    type="number"
                    className={styles.input}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={`1-${hitDie}`}
                    min={1}
                    max={hitDie}
                    aria-label={`Your d${hitDie} roll`}
                  />
                </label>
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
                {isManual ? 'Resolve' : `Roll d${hitDie}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.result} role="status" aria-live="polite">
              <div className={styles.dice} data-testid="hp-roll-dice">
                <span className={styles.dieKept}>{face}</span>
              </div>
              <div className={styles.caption}>d{hitDie}</div>
              <div className={styles.totalRow}>
                <span className={styles.label}>HP gained</span>
                <span className={styles.total} data-testid="hp-roll-total">
                  {breakdown && (
                    <CalculatedValue label="Hit Points gained" breakdown={breakdown} />
                  )}
                </span>
              </div>
            </div>
            <div className={styles.actions}>
              {isManual ? (
                <button type="button" onClick={() => setFace(null)} className={styles.cancelBtn}>
                  Edit result
                </button>
              ) : (
                <button type="button" onClick={onClose} className={styles.cancelBtn}>
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                className={styles.primaryBtn}
                autoFocus
              >
                Record HP
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
