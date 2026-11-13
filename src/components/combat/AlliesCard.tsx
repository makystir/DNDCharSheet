import { PawPrint } from 'lucide-react';
import type { Character } from '../../types/character';
import { combatAllies } from '../../logic/companion-play';
import type { AllyEntry } from '../../logic/companion-play';
import type { StatValue } from '../../logic/stat-block-model';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './AlliesCard.module.css';

export interface AlliesCardProps {
  character: Character;
}

/** A stat block value: with its breakdown tooltip when derived, as printed otherwise. */
function Value({ label, value }: { label: string; value: StatValue }) {
  return value.breakdown ? (
    <CalculatedValue label={label} breakdown={value.breakdown}>
      {value.text}
    </CalculatedValue>
  ) : (
    <span>{value.text}</span>
  );
}

function AllyRow({ ally }: { ally: AllyEntry }) {
  const down = ally.hp?.current === 0;
  return (
    <li className={down ? styles.rowDown : styles.row} data-testid={`ally-${ally.id}`}>
      <span className={styles.name}>
        {ally.name}
        <span className={styles.kind}>{ally.kind}</span>
      </span>
      <span className={styles.stats}>
        {ally.hp && <span className={down ? styles.statWarn : styles.stat}>{`HP ${ally.hp.current}/${ally.hp.max}`}</span>}
        {ally.ac && (
          <span className={styles.stat}>
            AC <Value label={`${ally.name} Armor Class`} value={ally.ac} />
          </span>
        )}
        {ally.attack && (
          <span className={styles.stat}>
            {`${ally.attack.name} `}
            <Value label={`${ally.name} ${ally.attack.name} attack bonus`} value={ally.attack.bonus} />
          </span>
        )}
      </span>
      {ally.conditions.length > 0 && <span className={styles.conditions}>{ally.conditions.join(', ')}</span>}
    </li>
  );
}

/**
 * Allies glance for the Combat page: each active companion, hireling, NPC party
 * member and sidekick with HP, AC, its first attack and any conditions.
 * Read-only: their HP and conditions are edited on the Companions page (one
 * editor), so the card links there. Hidden when nobody is tracked. A Primal
 * Companion acts on your turn (PHB 2024 Beast Master, L5587), so its numbers
 * belong next to yours.
 */
export function AlliesCard({ character }: AlliesCardProps) {
  const allies = combatAllies(character);
  if (allies.length === 0) return null;
  const creatures = allies.filter((a) => a.tab === 'creatures');
  const people = allies.filter((a) => a.tab === 'people');
  return (
    <Card>
      <SectionHeader icon={PawPrint} title="Allies" />
      <ul className={styles.list} aria-label="Allies">
        {[...creatures, ...people].map((a) => (
          <AllyRow key={a.id} ally={a} />
        ))}
      </ul>
      <p className={styles.links}>
        {creatures.length > 0 && <a href="#companions/creatures">Change HP or conditions on Companions</a>}
        {creatures.length === 0 && people.length > 0 && <a href="#companions/people">Change HP or conditions on Companions</a>}
      </p>
    </Card>
  );
}
