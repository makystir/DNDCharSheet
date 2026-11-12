import { BedDouble } from 'lucide-react';
import type { Character } from '../../../types/character';
import { resolveClass, hitDiceTotal } from '../../../logic/classes';
import { CalculatedValue } from '../../shared/CalculatedValue';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { RestControls } from '../../combat/RestControls';
import { parseNumberInput } from '../sheet-helpers';
import styles from './OverviewRest.module.css';

export interface OverviewRestProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Optional app-level Toast sink (rest results). */
  onNotify?: (message: string) => void;
}

/**
 * The Rest card on the Character Overview: Hit Dice (spent / total) and the
 * Short Rest and Long Rest buttons. It lives here, not on the Combat page,
 * because rolling Initiative interrupts both a Short Rest and a Long Rest
 * (PHB 2024 rules glossary "Long Rest" L21256 and "Short Rest" L21485), so a
 * rest is never taken during a fight.
 */
export function OverviewRest({ character, onChange, onNotify }: OverviewRestProps) {
  const selectedClass = resolveClass(character);
  // Hit Dice total equals the character level (PHB 2024 "Hit Points"); shown as
  // a CalculatedValue with a single summing component so the total is explained.
  const total = hitDiceTotal(character);
  const breakdown = { total, components: [{ label: 'Character level', value: total }] };
  const spent = character.hitDiceSpent ?? 0;

  const setSpent = (raw: string) => {
    const parsed = parseNumberInput(raw, true);
    onChange({ ...character, hitDiceSpent: parsed === undefined ? undefined : Math.min(parsed, total) });
  };

  return (
    <Card id="rest">
      <SectionHeader icon={BedDouble} title="Rest" />
      <div className={styles.hitDiceRow}>
        <span className={styles.fieldLabel}>Hit Die</span>
        <span className={styles.statValue}>{selectedClass ? `d${selectedClass.hitDie}` : '-'}</span>
        <span className={styles.fieldLabel}>Total</span>
        <span className={styles.statValue}>
          <CalculatedValue label="Hit Dice total" breakdown={breakdown}>
            {total}
          </CalculatedValue>
        </span>
        <label className={styles.fieldLabel} htmlFor="hit-dice-spent">
          Spent
        </label>
        <input
          id="hit-dice-spent"
          className={styles.input}
          type="number"
          min={0}
          max={total}
          value={character.hitDiceSpent ?? ''}
          placeholder="0"
          aria-label="Hit Dice spent"
          onChange={(e) => setSpent(e.target.value)}
        />
        <span className={styles.note}>
          {spent} / {total}
        </span>
      </div>
      <RestControls character={character} onChange={onChange} onNotify={onNotify} />
    </Card>
  );
}
