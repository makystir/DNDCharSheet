import { useEffect, useRef, useState } from 'react';
import type { Character } from '../../types/character';
import { getSpell } from '../../data/spells';
import { exhaustionLevelOf } from '../../logic/conditions';
import {
  concentrationCheck,
  constitutionSaveBreakdown,
  endConcentration,
  resolveConcentrationSave,
} from '../../logic/concentration';
import { useDiceEntryMode } from '../../hooks/useDiceEntryMode';
import { CalculatedValue } from '../shared/CalculatedValue';
import { RollPrompt, type RollPromptResult } from '../shared/RollPrompt';
import styles from './Concentration.module.css';

export interface ConcentrationCheckPromptProps {
  /** The character AFTER the damage was applied. */
  character: Character;
  /**
   * Damage that triggers the check: DamageResult.damageDealt, passed only when
   * DamageResult.tookDamage (decision D4: the Temp-HP-absorbed part counts
   * unless the A5a toggle is on).
   */
  damage: number;
  onChange: (next: Character) => void;
  onNotify?: (message: string) => void;
  /** Called once the check is resolved or dismissed, with an announcement. */
  onDone: (message: string) => void;
}

/**
 * "Concentration check: Constitution save DC X" prompt shown after damage while
 * concentrating (Stage A5b). The DC is a CalculatedValue with its Breakdown.
 * Rolling goes through the shared RollPrompt, which carries the manual
 * Advantage / Disadvantage selector (D7) and shows Exhaustion as its own line
 * (D1). The judgement is logic/concentration.ts; success keeps Concentration,
 * failure ends it with a Toast, and the user can dismiss without rolling.
 *
 * Presentation parity: PWACharSheet has no equivalent. It follows the HP card's
 * keep-or-replace prompt (a bordered group with text and buttons).
 */
export function ConcentrationCheckPrompt({
  character,
  damage,
  onChange,
  onNotify,
  onDone,
}: ConcentrationCheckPromptProps) {
  const { mode } = useDiceEntryMode();
  const [rolling, setRolling] = useState(false);
  const rollRef = useRef<HTMLButtonElement>(null);
  // The prompt mounts after damage: move focus to its primary action.
  useEffect(() => {
    rollRef.current?.focus();
  }, []);
  const check = concentrationCheck(damage);
  const spellId = character.concentration?.spellId;
  if (!check.required || check.dc === undefined || !check.breakdown || !spellId) return null;

  const dc = check.dc;
  const name = getSpell(spellId)?.name ?? spellId;
  const saveMods = constitutionSaveBreakdown(character).components;

  const handleResolve = (result: RollPromptResult) => {
    setRolling(false);
    const save = resolveConcentrationSave(character, result.natural, dc);
    if (save.success) {
      onDone(`Concentration on ${name} kept: Constitution save ${save.total} against DC ${dc}.`);
      return;
    }
    onChange(endConcentration(character));
    const message = `Concentration on ${name} ended: Constitution save ${save.total} against DC ${dc}.`;
    onNotify?.(message);
    onDone(message);
  };

  return (
    <div className={styles.prompt} role="group" aria-label="Concentration check" data-testid="concentration-prompt">
      <p className={styles.promptTitle}>
        Concentration check: Constitution save DC{' '}
        <CalculatedValue label="Concentration save DC" breakdown={check.breakdown} />
      </p>
      <p className={styles.promptText}>
        Concentrating on {name}. Damage taken: {damage}. A success keeps the spell; a failure ends it.
      </p>
      <div className={styles.promptActions}>
        <button ref={rollRef} type="button" className={styles.actionBtn} onClick={() => setRolling(true)}>
          {mode === 'manual' ? 'Enter Constitution save' : 'Roll Constitution save'}
        </button>
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() => onDone(`Concentration check for ${name} dismissed. You are still concentrating.`)}
        >
          Dismiss
        </button>
      </div>
      {rolling && (
        <RollPrompt
          title="Concentration Constitution Save"
          hint={`DC ${dc}. Meet or beat it to keep Concentration.`}
          exhaustionLevel={exhaustionLevelOf(character)}
          modifiers={saveMods}
          confirmLabel="Apply result"
          onResolve={handleResolve}
          onClose={() => setRolling(false)}
        />
      )}
    </div>
  );
}
