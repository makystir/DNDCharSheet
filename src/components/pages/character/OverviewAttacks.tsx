import { Swords } from 'lucide-react';
import type { Character } from '../../../types/character';
import { formatSigned } from '../../../logic/breakdown';
import { equippedWeapons, weaponAttackProfile } from '../../../logic/attacks';
import { itemMasteryStatus } from '../../../logic/weapon-mastery';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { CalculatedValue } from '../../shared/CalculatedValue';
import styles from './OverviewAttacks.module.css';

export interface OverviewAttacksProps {
  character: Character;
}

const titleCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Read-only mirror of the equipped weapons' attack bonus and damage. Every
 * number comes from logic/attacks (weaponAttackProfile) and keeps its breakdown
 * tooltip; making the attacks (and the Advantage/Disadvantage hint) lives on
 * Combat and Overview Conditions, so neither is repeated here.
 */
export function OverviewAttacks({ character }: OverviewAttacksProps) {
  const weapons = equippedWeapons(character);
  const rows = weapons.flatMap((entry) => {
    const profile = weaponAttackProfile(character, entry.item);
    return profile ? [{ entry, profile }] : [];
  });

  return (
    <Card>
      <SectionHeader icon={Swords} title="Attacks" />
      {rows.length === 0 ? (
        <p className={styles.empty}>
          No weapons equipped{' '}
          <a className={styles.manage} href="#inventory">
            Equip weapons on Inventory
          </a>
        </p>
      ) : (
        <ul className={styles.list}>
          {rows.map(({ entry, profile }) => {
            const { weapon } = entry;
            const { attack, damage } = profile;
            const status = itemMasteryStatus(character, entry.item);
            return (
              <li key={entry.item.id} className={styles.item} data-testid="overview-attack">
                <span className={styles.name}>{weapon.name}</span>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Attack</span>
                  <CalculatedValue label={`${weapon.name} attack bonus`} breakdown={attack.breakdown}>
                    {formatSigned(attack.breakdown.total)}
                  </CalculatedValue>
                </span>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Damage</span>
                  <CalculatedValue label={`${weapon.name} damage`} breakdown={damage.breakdown}>
                    {damage.dice}
                    {formatSigned(damage.flat)} {damage.damageType}
                  </CalculatedValue>
                </span>
                <span className={styles.mastery}>
                  Mastery: {titleCase(weapon.mastery)}
                  {status.usable ? '' : ' (locked)'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <a className={styles.manage} href="#combat">
        Make attacks on Combat
      </a>
    </Card>
  );
}
