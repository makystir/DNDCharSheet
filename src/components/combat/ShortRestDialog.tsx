import { useEffect, useId, useRef, useState } from 'react';
import type { Breakdown } from '../../logic/breakdown';
import type { Character } from '../../types/character';
import { abilityModifier } from '../../logic/abilities';
import { effectiveAbilityScores } from '../../logic/feats';
import { hitDiceTotal, resolveClass } from '../../logic/classes';
import { rollDie } from '../../logic/dice';
import { createDefaultRng, type RNG } from '../../logic/random';
import { characterHitPointMaxBreakdown, hitPointMaxOf } from '../../logic/hit-points-state';
import { hitDiceAvailable, shortRest } from '../../logic/rests';
import { getDiceEntryMode, type DiceEntryMode } from '../../hooks/useDiceEntryMode';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './Rests.module.css';

export interface ShortRestDialogProps {
  character: Character;
  /** The rest finished (or was interrupted). `next` is the character to store. */
  onComplete: (next: Character, message: string) => void;
  onClose: () => void;
  /** Override the persisted dice-entry preference (mainly for tests). */
  diceEntryMode?: DiceEntryMode;
  /** Override the random source (mainly for tests). */
  rng?: RNG;
}

/** Parse a typed die face; null unless a whole number of at least 1. */
function parseFace(raw: string): number | null {
  if (!/^\s*\d+\s*$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return n >= 1 ? n : null;
}

/**
 * Short Rest dialog (Stage A5b). Spend Hit Dice one at a time (rolled by the app
 * or typed in from a physical die, per the dice entry mode), watch the running
 * total and the capped Hit Point preview, then Finish, or mark the rest
 * Interrupted (no benefits). A character below 1 Hit Point cannot start.
 *
 * Presentation parity: PWACharSheet has no rest code. The shell follows
 * RollPrompt (overlay + focus trap with focus restore, Escape closes, body
 * scroll lock, bottom sheet on mobile). RollPrompt itself is a d20 prompt, so
 * the Hit Die roll/enter control is local to this dialog and mirrors its
 * auto / manual split. Every rule (start check, per-die minimum 1, the cap, the
 * Pact slot reset) is computed by logic/rests.ts shortRest(); the preview below
 * is that function applied to the dice entered so far.
 */
export function ShortRestDialog({
  character,
  onComplete,
  onClose,
  diceEntryMode,
  rng,
}: ShortRestDialogProps) {
  const [entryMode] = useState<DiceEntryMode>(() => diceEntryMode ?? getDiceEntryMode());
  const [source] = useState<RNG>(() => rng ?? createDefaultRng());
  const isManual = entryMode === 'manual';
  const [faces, setFaces] = useState<number[]>([]);
  const [manualRaw, setManualRaw] = useState('');
  const [error, setError] = useState('');
  const [announce, setAnnounce] = useState('');

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

  const cls = resolveClass(character);
  const hitDie = cls?.hitDie;
  const total = hitDiceTotal(character);
  const spentBefore = Math.max(0, character.hitDiceSpent ?? 0);
  const remaining = hitDiceAvailable(character) - faces.length;
  const conMod = abilityModifier(effectiveAbilityScores(character).con);

  // The start check and the preview both come from shortRest().
  const startCheck = shortRest(character, { rolls: [] });
  const blocked = startCheck.outcome === 'rejected' ? startCheck.error : undefined;
  const preview = shortRest(character, { rolls: faces });
  const max = hitPointMaxOf(character);
  const canSpendDice = hitDie !== undefined && max !== undefined;

  const remainingBreakdown: Breakdown = {
    total: remaining,
    components: [
      { label: 'Character level (Hit Dice)', value: total },
      { label: 'Already spent', value: -Math.min(total, spentBefore) },
      { label: 'Spent this rest', value: -faces.length },
    ],
  };
  const hpGained = preview.hpGained ?? 0;
  const hitDiceTotalBreakdown: Breakdown = {
    total,
    components: [{ label: 'Character level', value: total }],
  };

  const addFace = (face: number) => {
    const attempt = shortRest(character, { rolls: [...faces, face] });
    if (attempt.outcome === 'rejected') {
      setError(
        attempt.error === 'invalid-roll'
          ? `Enter a result between 1 and ${hitDie ?? 'the Hit Die size'}.`
          : attempt.error === 'not-enough-hit-dice'
            ? 'No Hit Dice remain.'
            : 'Choose a class and a Hit Point maximum to spend Hit Dice.',
      );
      return false;
    }
    setError('');
    setFaces([...faces, face]);
    const healed = attempt.rolled?.[faces.length] ?? face;
    setAnnounce(`Die ${faces.length + 1}: rolled ${face}, regains ${healed}.`);
    return true;
  };

  const handleSpend = () => {
    if (hitDie === undefined) return;
    if (!isManual) {
      addFace(rollDie(source, hitDie));
      return;
    }
    const face = parseFace(manualRaw);
    if (face === null) {
      setError(`Enter a result between 1 and ${hitDie}.`);
      return;
    }
    if (addFace(face)) setManualRaw('');
  };

  const handleUndoLast = () => {
    setFaces(faces.slice(0, -1));
    setError('');
    setAnnounce('Removed the last Hit Die.');
  };

  const handleFinish = () => {
    if (preview.outcome !== 'completed') return;
    const parts = [
      faces.length === 0
        ? 'Short Rest finished with no Hit Dice spent.'
        : `Short Rest finished: spent ${faces.length} Hit ${faces.length === 1 ? 'Die' : 'Dice'}, regained ${hpGained} Hit Point${hpGained === 1 ? '' : 's'}.`,
    ];
    if (character.spellcasting?.pactSlotsExpended) parts.push('Pact Magic slots restored.');
    onComplete(preview.character, parts.join(' '));
  };

  const handleInterrupted = () => {
    const out = shortRest(character, { rolls: [], interrupted: true });
    onComplete(out.character, 'Short Rest interrupted: no benefits gained.');
  };

  const blockedText =
    blocked === 'dead'
      ? 'A dead character cannot take a Short Rest.'
      : blocked === 'needs-hp'
        ? 'You need at least 1 Hit Point to start a Short Rest. Regain Hit Points or stabilise first.'
        : '';

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div ref={dialogRef} className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId} className={styles.title}>
          Short Rest
        </h2>

        {blocked ? (
          <>
            <p className={styles.blocked} role="alert" data-testid="short-rest-blocked">
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
            <p className={styles.muted}>
              A Short Rest lasts 1 hour. Spend Hit Dice one at a time: each regains its roll plus your
              Constitution modifier ({conMod >= 0 ? '+' : ''}
              {conMod}), at least 1 Hit Point per die.
            </p>

            <div className={styles.statList}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Hit Dice remaining</span>
                <span className={styles.statValue} data-testid="short-rest-remaining">
                  <CalculatedValue label="Hit Dice remaining" breakdown={remainingBreakdown} />
                  {' / '}
                  <CalculatedValue label="Hit Dice total" breakdown={hitDiceTotalBreakdown} />
                </span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Hit Points rolled</span>
                <span className={styles.statValue} data-testid="short-rest-rolled">
                  {preview.breakdown ? (
                    <CalculatedValue label="Hit Points rolled" breakdown={preview.breakdown} />
                  ) : (
                    0
                  )}
                </span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Hit Points regained (capped)</span>
                <span className={styles.statValue} data-testid="short-rest-regained">
                  {preview.regainedBreakdown ? (
                    <CalculatedValue label="Hit Points regained" breakdown={preview.regainedBreakdown} />
                  ) : (
                    hpGained
                  )}
                </span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Hit Points after</span>
                <span className={styles.statValue} data-testid="short-rest-after">
                  {preview.afterBreakdown ? (
                    <CalculatedValue label="Hit Points after rest" breakdown={preview.afterBreakdown} />
                  ) : (
                    '—'
                  )}
                  {max !== undefined && (
                    <>
                      {' / '}
                      <CalculatedValue label="Hit Point maximum" breakdown={characterHitPointMaxBreakdown(character)} />
                    </>
                  )}
                </span>
              </div>
            </div>

            {faces.length > 0 && (
              <ol className={styles.diceList} aria-label="Hit Dice spent" data-testid="short-rest-dice">
                {faces.map((face, i) => (
                  <li key={i}>
                    d{hitDie} rolled {face}, regains {preview.rolled?.[i] ?? face}
                  </li>
                ))}
              </ol>
            )}

            {!canSpendDice && (
              <p className={styles.muted} data-testid="short-rest-no-class">
                Choose a class and a Hit Point maximum to spend Hit Dice. You can still finish the rest.
              </p>
            )}

            {canSpendDice && (
              <div className={styles.spendRow}>
                {isManual && (
                  <label className={styles.field}>
                    {`Hit Die result (d${hitDie})`}
                    <input
                      type="number"
                      className={styles.input}
                      value={manualRaw}
                      min={1}
                      max={hitDie}
                      placeholder={`1-${hitDie}`}
                      aria-label={`Hit Die result, 1 to ${hitDie}`}
                      onChange={(e) => setManualRaw(e.target.value)}
                    />
                  </label>
                )}
                <button type="button" className={styles.actionBtn} disabled={remaining <= 0} onClick={handleSpend}>
                  {isManual ? 'Add Hit Die' : `Roll d${hitDie}`}
                </button>
                <button type="button" className={styles.ghostBtn} disabled={faces.length === 0} onClick={handleUndoLast}>
                  Remove last die
                </button>
              </div>
            )}
            {canSpendDice && remaining <= 0 && (
              <p className={styles.muted}>No Hit Dice remain to spend.</p>
            )}

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <div role="status" aria-live="polite" className={styles.muted} data-testid="short-rest-announce">
              {announce}
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.ghostBtn} onClick={onClose}>
                Cancel
              </button>
              <button type="button" className={styles.ghostBtn} onClick={handleInterrupted}>
                Interrupted
              </button>
              <button type="button" className={styles.primaryBtn} onClick={handleFinish}>
                Finish Short Rest
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
