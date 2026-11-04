import { Hand, Swords } from 'lucide-react';
import type { Character } from '../../types/character';
import { proficiencyBonus } from '../../logic/abilities';
import { formatSigned } from '../../logic/breakdown';
import { unarmedStrike } from '../../logic/attacks';
import { UNARMED_ATTACK_ID } from '../../logic/attack-flow';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './WeaponCards.module.css';

export interface UnarmedStrikeCardProps {
  character: Character;
  /** Called with `UNARMED_ATTACK_ID` when Attack is pressed. Disabled without it. */
  onAttack?: (weaponItemId: string) => void;
}

/**
 * Unarmed Strike card (Stage A5d). Attack bonus, damage, grapple DC and shove DC,
 * each a CalculatedValue over the Breakdown from logic/attacks.ts `unarmedStrike`
 * (PHB 2024 "Unarmed Strike"). Always shown: every character can make one.
 */
export function UnarmedStrikeCard({ character, onAttack }: UnarmedStrikeCardProps) {
  const strike = unarmedStrike(character.abilities, proficiencyBonus(character.level));
  return (
    <Card>
      <SectionHeader icon={Hand} title="Unarmed Strike" />
      <div className={styles.unarmedCard} data-testid="unarmed-strike-card">
        <div className={styles.name}>Unarmed Strike</div>
        <div className={styles.statsLine}>
          <span className={styles.stat}>
            <span className={styles.statLabel}>Attack</span>
            <CalculatedValue label="Unarmed Strike attack bonus" breakdown={strike.attack} className={styles.valueBtn}>
              {formatSigned(strike.attack.total)}
            </CalculatedValue>
          </span>
          <span className={styles.stat}>
            <span className={styles.statLabel}>Damage</span>
            <CalculatedValue label="Unarmed Strike damage" breakdown={strike.damage} className={styles.valueBtn}>
              {strike.damage.total} bludgeoning
            </CalculatedValue>
          </span>
          <span className={styles.stat}>
            <span className={styles.statLabel}>Grapple DC</span>
            <CalculatedValue label="Grapple DC" breakdown={strike.grappleDc} className={styles.valueBtn} />
          </span>
          <span className={styles.stat}>
            <span className={styles.statLabel}>Shove DC</span>
            <CalculatedValue label="Shove DC" breakdown={strike.shoveDc} className={styles.valueBtn} />
          </span>
          <button
            type="button"
            className={styles.attackBtn}
            disabled={!onAttack}
            onClick={() => onAttack?.(UNARMED_ATTACK_ID)}
            aria-label="Attack with Unarmed Strike"
          >
            <Swords size={16} aria-hidden="true" /> Attack
          </button>
        </div>
      </div>
    </Card>
  );
}
