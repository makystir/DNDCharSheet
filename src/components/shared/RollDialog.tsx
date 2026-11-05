import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BreakdownComponent } from '../../logic/breakdown';
import { d20FromFaces, d20TestBreakdown, rollD20, type D20Mode, type D20Roll } from '../../logic/dice';
import { createDefaultRng, type RNG } from '../../logic/random';
import { rollSummary, toRollPayload } from '../../logic/roll-log';
import { triggerRollHaptic } from '../../logic/haptics';
import { getDiceEntryMode, type DiceEntryMode } from '../../hooks/useDiceEntryMode';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import type { RollEventPayload } from '../../types/character';
import { RollResultDisplay } from './RollResultDisplay';
import styles from './RollDialog.module.css';

export interface RollDialogProps {
  /** Dialog heading / roll label, e.g. 'Stealth' or 'Longsword attack'. */
  label: string;
  /** Exhaustion level; shown as its own component, -2 per level. */
  exhaustionLevel: number;
  /** Extra modifier components shown between the die and the Exhaustion line. */
  modifiers?: BreakdownComponent[];
  /** Optional DC (ability/save) or target AC (attack). */
  dc?: number;
  /** Optional line of guidance shown above the die. */
  hint?: string;
  /** Optional extra content under the hint. */
  notice?: ReactNode;
  initialMode?: D20Mode;
  /** Hands the resolved roll payload back to the caller. */
  onRoll: (payload: RollEventPayload) => void;
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
 * The d20 roll dialog (Stage B7). Structure mirrors RollPrompt.tsx: overlay +
 * dialog, focus trap, body-scroll lock, Escape-to-close, an Advantage/
 * Disadvantage radiogroup, and a manual-entry path (physical dice, 1-20) when
 * the dice-entry preference is 'manual'.
 *
 * Resolution REUSES dice.ts (rollD20 / d20FromFaces / d20TestBreakdown) — it is
 * NOT reimplemented here. On resolve, the single roll-log path (rollSummary /
 * toRollPayload) produces the {@link RollEventPayload} handed to `onRoll`, and
 * haptics fire on crit/fumble.
 *
 * RULES (PHB 2024 "D20 Tests", Docs/PlayersHandbook.md L364): a hit is total ≥
 * DC/AC; a natural 20 is a crit and a natural 1 a fumble, judged on the kept die
 * (L457-461). This dialog judges nothing itself — it delegates to roll-log.ts.
 */
export function RollDialog({
  label,
  exhaustionLevel,
  modifiers = [],
  dc,
  hint,
  notice,
  initialMode = 'normal',
  onRoll,
  onClose,
  diceEntryMode,
  rng,
}: RollDialogProps) {
  const [entryMode] = useState<DiceEntryMode>(() => diceEntryMode ?? getDiceEntryMode());
  const [source] = useState<RNG>(() => rng ?? createDefaultRng());
  const isManual = entryMode === 'manual';
  const [mode, setMode] = useState<D20Mode>(initialMode);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState('');
  const [rolled, setRolled] = useState<D20Roll | null>(null);
  // The effective DC: a caller-fixed `dc` takes precedence; otherwise the player
  // may type an optional DC/AC to compare against (empty = a flat roll).
  const [dcInput, setDcInput] = useState('');

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

  // A caller-fixed `dc` wins; otherwise use a typed whole-number DC if present.
  const typedDc = /^\s*\d+\s*$/.test(dcInput) ? Number.parseInt(dcInput, 10) : undefined;
  const effectiveDc = dc ?? typedDc;

  // The resolved payload (single roll-log path). Recomputed from the kept die +
  // breakdown; stable per render once `rolled` is set.
  const payload: RollEventPayload | null =
    rolled && breakdown
      ? toRollPayload({ label, natural: rolled.natural, total: breakdown.total, mode, dc: effectiveDc })
      : null;

  const handleConfirm = () => {
    if (!rolled || !breakdown || !payload) return;
    // One roll-log path: the summary flags and the payload flags come from the
    // same resolved roll, so they can never disagree.
    const summary = rollSummary({ label, natural: rolled.natural, total: breakdown.total, mode, dc: effectiveDc });
    triggerRollHaptic(summary.isCrit, summary.isFumble);
    onRoll(payload);
  };

  const modeLabel = MODE_OPTIONS.find((o) => o.value === mode)?.label ?? 'Normal';
  const keptIndex = rolled ? rolled.rolls.indexOf(rolled.used) : -1;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div ref={dialogRef} className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId} className={styles.title}>
          {label}
        </h2>
        {dc !== undefined && <p className={styles.hint}>Target: DC {dc}</p>}
        {hint && <p className={styles.hint}>{hint}</p>}
        {notice && <div className={styles.hint}>{notice}</div>}

        {rolled === null ? (
          <>
            <div role="radiogroup" aria-label="Roll type" className={styles.modes}>
              {MODE_OPTIONS.map((o) => (
                <label key={o.value} className={styles.modeLabel}>
                  <input
                    type="radio"
                    name="roll-dialog-mode"
                    value={o.value}
                    checked={mode === o.value}
                    onChange={() => setMode(o.value)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>

            {dc === undefined && (
              <label className={styles.label}>
                DC / AC (optional)
                <input
                  type="number"
                  className={styles.input}
                  value={dcInput}
                  onChange={(e) => setDcInput(e.target.value)}
                  placeholder="none"
                  min={1}
                  aria-label="Difficulty Class or Armor Class (optional)"
                />
              </label>
            )}

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
            <div className={styles.dice} data-testid="roll-dice">
              {rolled.rolls.map((face, i) => (
                <span key={i} className={i === keptIndex ? styles.dieKept : styles.die}>
                  {face}
                </span>
              ))}
            </div>
            <div className={styles.caption}>
              {rolled.rolls.length === 1 ? 'd20' : `${modeLabel}: kept ${rolled.used}`}
            </div>
            {payload && breakdown && <RollResultDisplay payload={payload} breakdown={breakdown} />}
            <div className={styles.actions}>
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
                Log roll
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
