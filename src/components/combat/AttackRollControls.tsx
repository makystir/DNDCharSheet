import { useState } from 'react';
import { Swords, Dices } from 'lucide-react';
import type { Character } from '../../types/character';
import type { BreakdownComponent } from '../../logic/breakdown';
import type { WeaponDamage } from '../../logic/attacks';
import { doubleDice, rollWeaponDamage } from '../../logic/attacks';
import { attackModeAdvice, attackNaturalNote } from '../../logic/attack-rolls';
import { exhaustionLevelOf } from '../../logic/conditions';
import { formatSigned } from '../../logic/breakdown';
import { createDefaultRng } from '../../logic/random';
import { getDiceEntryMode } from '../../hooks/useDiceEntryMode';
import { RollPrompt, type RollPromptResult } from '../shared/RollPrompt';
import styles from './AttackRollControls.module.css';

export interface AttackRollControlsProps {
  character: Character;
  /** Weapon (or Unarmed Strike) name, used in labels. */
  name: string;
  /** Attack bonus components WITHOUT Exhaustion (the roll adds it once). */
  attackModifiers: BreakdownComponent[];
  damage: WeaponDamage;
  /** Why the attack cannot be made now (for example no ammunition), or null. */
  blockedReason?: string | null;
  /** Called once a rolled attack is kept (for example to use one piece of ammunition). */
  onAttackRolled?: () => void;
}

const damageText = (dice: string, flat: number) => (/^\d+$/.test(dice) ? `${Math.max(0, Number(dice) + flat)}` : `${dice}${flat !== 0 ? formatSigned(flat) : ''}`);

/**
 * "Roll attack" and "Roll damage" for one weapon. The attack roll goes through the
 * shared RollPrompt (manual dice supported, Exhaustion added once) and shows the
 * total for the DM, flagging a natural 20 or 1. Damage rolls the weapon's dice,
 * doubled when "Critical hit" is ticked (ticked for you after a natural 20). With
 * manual dice the damage button shows what to roll instead.
 */
export function AttackRollControls({
  character,
  name,
  attackModifiers,
  damage,
  blockedReason,
  onAttackRolled,
}: AttackRollControlsProps) {
  const [rolling, setRolling] = useState(false);
  const [crit, setCrit] = useState(false);
  const [attackLine, setAttackLine] = useState('');
  const [damageLine, setDamageLine] = useState('');
  const advice = attackModeAdvice(character);
  const manual = getDiceEntryMode() === 'manual';
  const dice = crit ? doubleDice(damage.dice) : damage.dice;
  const fixed = /^\d+$/.test(damage.dice);

  const handleAttack = (result: RollPromptResult) => {
    setRolling(false);
    onAttackRolled?.();
    const note = attackNaturalNote(result.natural);
    setCrit(result.natural === 20);
    setDamageLine('');
    setAttackLine(`Attack: ${result.total} (rolled ${result.natural})${note ? `. ${note}` : ''}`);
  };

  const handleDamage = () => {
    if (manual) {
      setDamageLine(`Roll ${damageText(dice, damage.flat)} ${damage.damageType}${crit ? ' (Critical Hit)' : ''}.`);
      return;
    }
    const r = rollWeaponDamage(damage, crit, createDefaultRng());
    const parts = r.rolls.length > 0 ? `${r.dice}: ${r.rolls.join(' + ')}` : r.dice;
    const flat = r.flat !== 0 ? ` ${r.flat > 0 ? '+' : '-'} ${Math.abs(r.flat)}` : '';
    setDamageLine(`Damage: ${r.total} ${damage.damageType} (${parts}${flat})${crit ? ', Critical Hit' : ''}`);
  };

  return (
    <div className={styles.controls}>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.attackBtn}
          disabled={Boolean(blockedReason)}
          aria-label={`Roll attack with ${name}`}
          onClick={() => setRolling(true)}
        >
          <Swords size={16} aria-hidden="true" /> Attack
        </button>
        <button
          type="button"
          className={styles.damageBtn}
          aria-label={`Roll damage for ${name}`}
          onClick={handleDamage}
        >
          <Dices size={16} aria-hidden="true" /> Damage
        </button>
        {!fixed && (
          <label className={styles.crit}>
            <input
              type="checkbox"
              checked={crit}
              aria-label={`${name} Critical Hit (double the damage dice)`}
              onChange={(e) => setCrit(e.target.checked)}
            />
            Critical hit
          </label>
        )}
      </div>
      {blockedReason && <p className={styles.blocked}>{blockedReason}</p>}
      <p className={styles.result} role="status" aria-live="polite" data-testid={`attack-result-${name}`}>
        {attackLine}
        {attackLine && damageLine ? ' · ' : ''}
        {damageLine}
      </p>
      {rolling && (
        <RollPrompt
          title={`${name} attack`}
          exhaustionLevel={exhaustionLevelOf(character)}
          modifiers={attackModifiers}
          initialMode={advice.mode}
          hint="Tell your DM the total. A natural 20 is a Critical Hit; a natural 1 misses."
          notice={advice.notes.length > 0 ? advice.notes.join(' ') : undefined}
          confirmLabel="Done"
          onResolve={handleAttack}
          onClose={() => setRolling(false)}
        />
      )}
    </div>
  );
}
