import { useState } from 'react';
import { Skull } from 'lucide-react';
import type { Character } from '../../types/character';
import { exhaustionEffects, exhaustionLevelOf } from '../../logic/conditions';
import {
  effectiveDeathSaves,
  lifeStatus,
  resolveDeathSave,
  stabilize,
  type DeathSaveRoll,
  type DeathSaveAdvance,
} from '../../logic/hit-points-state';
import { resolveHitPointRuleTooltip } from '../../logic/tooltip-content';
import { useDiceEntryMode } from '../../hooks/useDiceEntryMode';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { RollPrompt, type RollPromptResult } from '../shared/RollPrompt';
import styles from './HitPoints.module.css';

export interface DeathSavesCardProps {
  character: Character;
  onChange: (next: Character) => void;
}

const PIPS = [0, 1, 2];

function Pips({ kind, filled }: { kind: 'success' | 'failure'; filled: number }) {
  const label = kind === 'success' ? 'Successes' : 'Failures';
  return (
    <span className={styles.pipGroup}>
      <span className={styles.pipLabel}>{label}</span>
      <span role="img" aria-label={`${label}: ${filled} of 3`} data-testid={`pips-${kind}`} className={styles.pips}>
        {PIPS.map((i) => (
          <span
            key={i}
            aria-hidden="true"
            data-filled={i < filled ? 'true' : 'false'}
            className={`${styles.pip} ${kind === 'success' ? styles.pipSuccess : styles.pipFailure} ${i < filled ? styles.pipFilled : ''}`}
          />
        ))}
      </span>
    </span>
  );
}

/** Announcement for a resolved Death Saving Throw. Formatting only. */
function announce(roll: DeathSaveRoll, advance: DeathSaveAdvance): string {
  const head =
    roll.outcome === 'critical-failure'
      ? 'Death save: natural 1, two failures.'
      : roll.outcome === 'regain-hp'
        ? 'Death save: natural 20, regained 1 Hit Point and is conscious again.'
        : roll.outcome === 'success'
          ? `Death save succeeded with a ${roll.total}.`
          : `Death save failed with a ${roll.total}.`;
  if (advance.dead) return `${head} Third failure: the character dies.`;
  if (advance.stable) return `${head} Third success: the character is Stable.`;
  return head;
}

/**
 * Death Saves widget for the Combat tab (Stage A5a): three success pips, three
 * failure pips, a Roll / Enter-result button that opens the shared RollPrompt
 * (with the Exhaustion line, decision D1), Stable and Dead states, and an
 * aria-live announcement of each result.
 *
 * Shown only while it matters (0 HP making saves, Stable, or Dead). The PWA has
 * no equivalent (WFRP has no death saves), so there is no source component; it
 * follows the HP card's structure. Every rule lives in
 * logic/hit-points-state.ts (resolveDeathSave, stabilize).
 */
export function DeathSavesCard({ character, onChange }: DeathSavesCardProps) {
  const { mode } = useDiceEntryMode();
  const [rolling, setRolling] = useState(false);
  const [confirmStable, setConfirmStable] = useState(false);
  const [status, setStatus] = useState('');

  const life = lifeStatus(character);
  const relevant = life === 'making-death-saves' || life === 'stable' || life === 'dead';

  const saves = effectiveDeathSaves(character);
  const exhaustionLevel = exhaustionLevelOf(character);
  const exhaustion = exhaustionEffects(exhaustionLevel);
  const stableTip = resolveHitPointRuleTooltip('stable');
  const deathTip = resolveHitPointRuleTooltip('death-saves');

  const handleResolve = (result: RollPromptResult) => {
    setRolling(false);
    const out = resolveDeathSave(character, result.natural);
    if (!out) return;
    onChange(out.character);
    setStatus(announce(out.roll, out.advance));
  };

  const handleStabilize = () => {
    setConfirmStable(false);
    const next = stabilize(character);
    if (!next) return;
    onChange(next);
    setStatus('The character is Stable: no more Death Saving Throws until damage.');
  };

  return (
    <>
      {/* Always mounted, so a result that ends the card (a natural 20 wakes the
          character) is still announced to assistive technology. */}
      <div role="status" aria-live="polite" className={styles.srOnly} data-testid="death-save-status">
        {status}
      </div>
      {relevant && (
        <Card>
          <SectionHeader
            icon={Skull}
            title={deathTip ? <ContentTooltip content={deathTip}>Death Saves</ContentTooltip> : 'Death Saves'}
          />

          <div className={styles.pipRow}>
            <Pips kind="success" filled={saves.successes} />
            <Pips kind="failure" filled={saves.failures} />
          </div>

          {life === 'dead' && (
            <p className={styles.deadNote} data-testid="death-saves-dead">
              Dead. No more Death Saving Throws.
            </p>
          )}

          {life === 'stable' && (
            <p className={styles.stableNote} data-testid="death-saves-stable">
              {stableTip ? <ContentTooltip content={stableTip}>Stable</ContentTooltip> : 'Stable'}: at 0 HP, makes
              no Death Saving Throws.
            </p>
          )}

          {life === 'making-death-saves' && (
            <>
              {exhaustionLevel > 0 && (
                <p className={styles.hint}>
                  Exhaustion on the roll:{' '}
                  <CalculatedValue label="Exhaustion death save modifier" breakdown={exhaustion.d20Test} />. The PHB
                  does not say outright that a death save is a D20 Test; this app treats it as one.
                </p>
              )}
              <div className={styles.controls}>
                <button type="button" className={styles.actionBtn} onClick={() => setRolling(true)}>
                  {mode === 'manual' ? 'Enter death save result' : 'Roll death save'}
                </button>
                <button type="button" className={styles.ghostBtn} onClick={() => setConfirmStable(true)}>
                  Stabilize
                </button>
              </div>
            </>
          )}

          {status && (
            <p className={styles.liveRegion} data-testid="death-save-result">
              {status}
            </p>
          )}

          {rolling && (
            <RollPrompt
              title="Death Saving Throw"
              hint="10 or higher succeeds. A natural 1 is two failures; a natural 20 regains 1 Hit Point."
              exhaustionLevel={exhaustionLevel}
              confirmLabel="Apply result"
              onResolve={handleResolve}
              onClose={() => setRolling(false)}
            />
          )}

          {confirmStable && (
            <ConfirmDialog
              message="Mark the character Stable? Do this after a successful DC 10 Wisdom (Medicine) check with the Help action."
              confirmLabel="Mark Stable"
              onConfirm={handleStabilize}
              onCancel={() => setConfirmStable(false)}
            />
          )}
        </Card>
      )}
    </>
  );
}
