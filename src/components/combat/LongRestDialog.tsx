import { useEffect, useId, useRef, useState } from 'react';
import type { Character } from '../../types/character';
import { getSpell } from '../../data/spells';
import { characterHitPointMaxBreakdown, hitPointMaxOf } from '../../logic/hit-points-state';
import {
  longRest,
  longRestGapAdvisory,
  longRestHoursRequired,
  restInterruptOutcome,
} from '../../logic/rests';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { CalculatedValue } from '../shared/CalculatedValue';
import { RecoveredList } from './RecoveredList';
import styles from './Rests.module.css';

export interface LongRestDialogProps {
  character: Character;
  /** Epoch ms captured when the dialog opened (injected so tests control it). */
  now: number;
  /** The rest finished. `next` is the character to store. */
  onComplete: (next: Character, message: string) => void;
  /** The rest was interrupted after 1+ hours: hand over to the Short Rest dialog. */
  onInterruptedToShortRest: () => void;
  onClose: () => void;
}

/** Parse a whole number of at least 0; null when empty or invalid. */
function parseCount(raw: string): number | null {
  if (!/^\s*\d+\s*$/.test(raw)) return null;
  return Number.parseInt(raw, 10);
}

/**
 * Long Rest confirm dialog (Stage A5b): lists exactly what will reset, shows the
 * decision-D5 advisory ("Less than 16 hours since your last Long Rest") with a
 * "Rest anyway" confirm that is never blocked, and offers an Interrupted helper
 * (hours completed -> restInterruptOutcome; extra hours -> longRestHoursRequired).
 * A character below 1 Hit Point cannot start.
 *
 * Presentation parity: PWACharSheet has no rest code. The shell follows
 * ConfirmDialog / RollPrompt (overlay, focus trap with focus restore, Escape
 * cancels, body scroll lock, bottom sheet on mobile). The "after" values come
 * from logic/rests.ts longRest() applied to a copy; nothing is computed here.
 */
export function LongRestDialog({
  character,
  now,
  onComplete,
  onInterruptedToShortRest,
  onClose,
}: LongRestDialogProps) {
  const [showInterrupt, setShowInterrupt] = useState(false);
  const [hoursRaw, setHoursRaw] = useState('0');
  const [interruptionsRaw, setInterruptionsRaw] = useState('1');

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

  const preview = longRest(character, { now });
  const blocked = preview.outcome === 'rejected' ? preview.error : undefined;
  const advisory = longRestGapAdvisory(character.lastLongRestAt, now);

  const max = hitPointMaxOf(character);
  const changes = preview.longRestBreakdowns;
  const recovered = preview.resourcesRecovered ?? [];
  const concentratingOn = character.concentration
    ? (getSpell(character.concentration.spellId)?.name ?? character.concentration.spellId)
    : null;

  const hours = parseCount(hoursRaw);
  const interruptions = parseCount(interruptionsRaw);
  const outcome = hours === null ? null : restInterruptOutcome('long', hours);
  const hoursRequired = interruptions === null ? null : longRestHoursRequired(interruptions);

  const handleConfirm = () => {
    if (preview.outcome !== 'completed') return;
    const n = recovered.length;
    onComplete(preview.character, `Long Rest finished. Resources restored.${n > 0 ? ` ${n} limited-use feature${n === 1 ? '' : 's'} recovered.` : ''}`);
  };

  const blockedText =
    blocked === 'dead'
      ? 'A dead character cannot take a Long Rest.'
      : blocked === 'needs-hp'
        ? 'You need at least 1 Hit Point to start a Long Rest. Regain Hit Points or stabilise first.'
        : '';

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div ref={dialogRef} className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId} className={styles.title}>
          Long Rest
        </h2>

        {blocked || !changes ? (
          <>
            <p className={styles.blocked} role="alert" data-testid="long-rest-blocked">
              {blockedText}
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.primaryBtn} onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.text}>Finishing a Long Rest resets the following.</p>
            <ul className={styles.resetList} aria-label="What a Long Rest resets" data-testid="long-rest-resets">
              <li>
                Hit Points to maximum
                {changes?.hitPoints ? (
                  <>
                    : <CalculatedValue label="Hit Points after Long Rest" breakdown={changes.hitPoints} />
                    {max !== undefined && (
                      <>
                        {' / '}
                        <CalculatedValue label="Hit Point maximum" breakdown={characterHitPointMaxBreakdown(character)} />
                      </>
                    )}
                  </>
                ) : (
                  ' (set an HP maximum to track them)'
                )}
              </li>
              <li>
                All spent Hit Dice come back. Spent afterwards:{' '}
                <CalculatedValue
                  label="Hit Dice spent after Long Rest"
                  breakdown={changes.hitDiceSpent}
                />
              </li>
              <li>
                Temporary Hit Points:{' '}
                <CalculatedValue
                  label="Temporary Hit Points after Long Rest"
                  breakdown={changes.tempHp}
                />
              </li>
              <li>
                Exhaustion level goes down by 1:{' '}
                <CalculatedValue
                  label="Exhaustion level after Long Rest"
                  breakdown={changes.exhaustion}
                />
              </li>
              <li>Spell slots, including Pact Magic slots and Mystic Arcanum uses</li>
              <li>
                Concentration ends
                {concentratingOn ? ` (you are concentrating on ${concentratingOn})` : ' (you are not concentrating)'}
              </li>
              <li>Death Saving Throw counters clear</li>
            </ul>
            {recovered.length > 0 && <RecoveredList recovered={recovered} testId="long-rest-recovered" />}

            {advisory && (
              <p className={styles.advisory} role="status" data-testid="long-rest-advisory">
                Less than 16 hours since your last Long Rest. You can still rest.
              </p>
            )}

            {showInterrupt && (
              <div className={styles.interrupt} role="group" aria-label="Rest interrupted" data-testid="long-rest-interrupt">
                <p className={styles.interruptTitle}>Interrupted rest</p>
                <p className={styles.muted}>
                  Rolling Initiative, casting a spell other than a cantrip, taking damage or 1 hour of
                  walking or other exertion interrupts a Long Rest.
                </p>
                <div className={styles.spendRow}>
                  <label className={styles.field}>
                    Hours rested before the interruption
                    <input
                      type="number"
                      className={styles.input}
                      min={0}
                      value={hoursRaw}
                      aria-label="Hours rested before the interruption"
                      onChange={(e) => setHoursRaw(e.target.value)}
                    />
                  </label>
                  <label className={styles.field}>
                    Interruptions so far
                    <input
                      type="number"
                      className={styles.input}
                      min={0}
                      value={interruptionsRaw}
                      aria-label="Interruptions so far"
                      onChange={(e) => setInterruptionsRaw(e.target.value)}
                    />
                  </label>
                </div>
                <div role="status" aria-live="polite" className={styles.text} data-testid="long-rest-interrupt-result">
                  {outcome === 'short-rest'
                    ? 'You rested at least 1 hour, so you gain the benefits of a Short Rest.'
                    : outcome === 'none'
                      ? 'You rested less than 1 hour, so you gain no benefits.'
                      : 'Enter the whole hours rested.'}
                  {hoursRequired !== null &&
                    ` Resuming the Long Rest takes ${hoursRequired} hours in total (8, plus 1 per interruption).`}
                </div>
                <div className={styles.actions}>
                  {outcome === 'short-rest' ? (
                    <button type="button" className={styles.actionBtn} onClick={onInterruptedToShortRest}>
                      Take Short Rest benefits
                    </button>
                  ) : (
                    <button type="button" className={styles.actionBtn} onClick={onClose} disabled={outcome === null}>
                      Abandon Long Rest
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className={styles.actions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                aria-expanded={showInterrupt}
                onClick={() => setShowInterrupt((v) => !v)}
              >
                Interrupted
              </button>
              <button type="button" className={styles.primaryBtn} onClick={handleConfirm}>
                {advisory ? 'Rest anyway' : 'Finish Long Rest'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
