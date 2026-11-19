import { useState } from 'react';
import { Minus, PawPrint, Plus } from 'lucide-react';
import type { Character } from '../../types/character';
import { combatAllies } from '../../logic/companion-play';
import { damagePatch, healPatch, patchTrackedRecord, recordsOf } from '../../logic/companions-actions';
import type { AllyEntry } from '../../logic/companion-play';
import type { StatValue } from '../../logic/stat-block-model';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './AlliesCard.module.css';

export interface AlliesCardProps {
  character: Character;
  /** Applies an HP change to the character (the same record patch the Companions page uses). */
  onChange: (next: Character) => void;
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

function AllyRow({ ally, character, onChange }: { ally: AllyEntry; character: Character; onChange: (next: Character) => void }) {
  const [amount, setAmount] = useState('');
  const down = ally.hp?.current === 0;
  const attack = ally.attack;
  const parsed = Number.parseInt(amount, 10);
  const amt = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  // HP edits reuse the Companions page's patch builders and record writer (one HP logic).
  const applyHp = (kind: 'damage' | 'heal', by: number) => {
    const max = ally.hp?.max;
    const rec = recordsOf(character, ally.listKey).find((r) => r.id === ally.id);
    if (max === undefined || !rec || by <= 0) return;
    const patch = kind === 'damage' ? damagePatch(rec, max, by) : healPatch(rec, max, by);
    onChange(patchTrackedRecord(character, ally.listKey, ally.id, patch));
    setAmount('');
  };
  return (
    <li className={down ? styles.rowDown : styles.row} data-testid={`ally-${ally.id}`}>
      <span className={styles.name}>
        <a className={styles.nameLink} href={`#companions/${ally.tab}/${ally.id}`} aria-label={`Open ${ally.name} on Companions`}>
          {ally.name}
        </a>
        <span className={styles.kind}>{ally.kind}</span>
      </span>
      <span className={styles.stats}>
        {ally.hp && <span className={down ? styles.statWarn : styles.stat}>{`HP ${ally.hp.current}/${ally.hp.max}`}</span>}
        {ally.ac && (
          <span className={styles.stat}>
            AC <Value label={`${ally.name} Armor Class`} value={ally.ac} />
          </span>
        )}
        {attack && (
          <span className={styles.stat}>
            {`${attack.name} `}
            <Value label={`${ally.name} ${attack.name} attack bonus`} value={attack.bonus} />
            {attack.damage.map((d, i) => (
              <span key={i}>
                {', '}
                {d.prefix}
                <Value label={`${ally.name} ${attack.name} damage`} value={d.value} />
                {d.suffix}
              </span>
            ))}
          </span>
        )}
      </span>
      {ally.hp && (
        <span className={styles.hpControls} role="group" aria-label={`${ally.name} hit point controls`}>
          <button type="button" className={styles.hpBtn} aria-label={`Lose 1 HP: ${ally.name}`} onClick={() => applyHp('damage', 1)}>
            <Minus size={14} aria-hidden="true" />
          </button>
          <button type="button" className={styles.hpBtn} aria-label={`Gain 1 HP: ${ally.name}`} onClick={() => applyHp('heal', 1)}>
            <Plus size={14} aria-hidden="true" />
          </button>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            className={styles.hpAmount}
            value={amount}
            placeholder="Amount"
            aria-label={`${ally.name} hit point amount`}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button type="button" className={styles.hpBtn} disabled={amt === 0} onClick={() => applyHp('damage', amt)}>
            Damage
          </button>
          <button type="button" className={styles.hpBtn} disabled={amt === 0} onClick={() => applyHp('heal', amt)}>
            Heal
          </button>
        </span>
      )}
      {ally.conditions.length > 0 && <span className={styles.conditions}>{ally.conditions.join(', ')}</span>}
    </li>
  );
}

/**
 * Allies glance for the Combat page: each active companion, hireling, NPC party
 * member and sidekick with HP, AC, its first attack and any conditions.
 * HP can be adjusted here (-1 / +1, or an amount with Damage / Heal) through the
 * same record patch builders the Companions page uses; conditions and the rest
 * are edited on the Companions page, and each name links to its own card. Hidden when nobody is tracked. A Primal
 * Companion acts on your turn (PHB 2024 Beast Master, L5587), so its numbers
 * belong next to yours.
 */
export function AlliesCard({ character, onChange }: AlliesCardProps) {
  const allies = combatAllies(character);
  if (allies.length === 0) return null;
  const creatures = allies.filter((a) => a.tab === 'creatures');
  const people = allies.filter((a) => a.tab === 'people');
  return (
    <Card>
      <SectionHeader icon={PawPrint} title="Allies" />
      <ul className={styles.list} aria-label="Allies">
        {[...creatures, ...people].map((a) => (
          <AllyRow key={a.id} ally={a} character={character} onChange={onChange} />
        ))}
      </ul>
      <p className={styles.links}>
        {creatures.length > 0 && <a href="#companions/creatures">{people.length > 0 ? 'Creatures on Companions' : 'Change conditions on Companions'}</a>}
        {people.length > 0 && <a href="#companions/people">{creatures.length > 0 ? 'People on Companions' : 'Change conditions on Companions'}</a>}
      </p>
    </Card>
  );
}
