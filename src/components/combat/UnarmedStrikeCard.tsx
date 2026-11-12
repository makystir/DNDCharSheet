import { Hand } from 'lucide-react';
import type { Character } from '../../types/character';
import { proficiencyBonus } from '../../logic/abilities';
import { formatSigned } from '../../logic/breakdown';
import { exhaustionLevelOf, withExhaustion } from '../../logic/conditions';
import { unarmedStrike } from '../../logic/attacks';
import { effectiveAbilityScores } from '../../logic/feats';
import { AttackRollControls } from './AttackRollControls';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './WeaponCards.module.css';

export interface UnarmedStrikeCardProps {
  character: Character;
}

/**
 * Unarmed Strike card (Stage A5d). Attack bonus, damage, grapple DC and shove DC,
 * each a CalculatedValue over the Breakdown from logic/attacks.ts `unarmedStrike`
 * (PHB 2024 "Unarmed Strike"). Always shown: every character can make one.
 */
export function UnarmedStrikeCard({ character }: UnarmedStrikeCardProps) {
  const strike = unarmedStrike(effectiveAbilityScores(character), proficiencyBonus(character.level));
  // Static attack bonus is a D20 Test total: show the Exhaustion penalty (PHB 2024 L21024).
  const attack = withExhaustion(strike.attack, exhaustionLevelOf(character));
  return (
    <Card>
      <SectionHeader icon={Hand} title="Unarmed Strike" />
      <div className={styles.unarmedCard} data-testid="unarmed-strike-card">
        <div className={styles.name}>Unarmed Strike</div>
        <div className={styles.statsLine}>
          <span className={styles.stat}>
            <span className={styles.statLabel}>Attack</span>
            <CalculatedValue label="Unarmed Strike attack bonus" breakdown={attack} className={styles.valueBtn}>
              {formatSigned(attack.total)}
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
        </div>
        <AttackRollControls
          character={character}
          name="Unarmed Strike"
          attackModifiers={strike.attack.components}
          damage={{ dice: String(strike.damage.total), flat: 0, breakdown: strike.damage, damageType: 'bludgeoning' }}
        />
      </div>
    </Card>
  );
}
