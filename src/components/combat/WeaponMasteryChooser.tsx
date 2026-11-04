import { useRef, useState } from 'react';
import { Lock, Medal } from 'lucide-react';
import type { Character } from '../../types/character';
import type { Breakdown } from '../../logic/breakdown';
import { getWeapon, WEAPON_LIST } from '../../data/weapons';
import { resolveClass } from '../../logic/classes';
import {
  chooseWeaponMastery,
  masteryChoices,
  removeWeaponMastery,
  weaponMasteryStatus,
  masteryEligible,
  type ChooseMasteryResult,
} from '../../logic/weapon-mastery';
import {
  resolveAttackRuleTooltip,
  resolveMasteryLockedTooltip,
  resolveWeaponMasteryTooltip,
} from '../../logic/tooltip-content';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import styles from './WeaponMastery.module.css';

export interface WeaponMasteryChooserProps {
  character: Character;
  onChange: (next: Character) => void;
}

const titleCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const FAILURE_TEXT: Record<NonNullable<ChooseMasteryResult['reason']>, string> = {
  'no-class': 'Choose a class first.',
  'no-feature': 'Your class has no Weapon Mastery feature.',
  'unknown-weapon': 'That weapon is not in the catalog.',
  'not-eligible': 'Your class cannot use Weapon Mastery with that weapon.',
  'already-chosen': 'That weapon is already in your list.',
  'list-full': 'Your list is full. Remove a weapon first.',
};

/**
 * Weapon Mastery chooser (Stage A5d, decision D8). The character's chosen weapon
 * kinds (`Character.weaponMasteries`) are capped by `masteryCount`. An over-cap list
 * is kept and flagged, never trimmed: only the Remove button removes an entry.
 * A class with no Weapon Mastery feature (or no class) gets no chooser, only a note
 * that every mastery is locked. All rules live in logic/weapon-mastery.ts.
 */
export function WeaponMasteryChooser({ character, onChange }: WeaponMasteryChooserProps) {
  const [pick, setPick] = useState('');
  const [message, setMessage] = useState('');
  // Focus anchor: Add/Remove disable or unmount the focused button, so focus moves here.
  const anchorRef = useRef<HTMLParagraphElement>(null);
  const klass = resolveClass(character);
  const { cap, chosen, overCap, slotsLeft } = masteryChoices(character);
  const ruleTip = resolveAttackRuleTooltip('weapon-mastery');
  const title = ruleTip ? <ContentTooltip content={ruleTip}>Weapon Mastery</ContentTooltip> : 'Weapon Mastery';

  const capBreakdown: Breakdown = {
    total: cap,
    components: [{ label: `${klass?.name ?? 'Class'} level ${character.level} Weapon Mastery`, value: cap }],
  };

  if (!klass || cap === 0) {
    const status = weaponMasteryStatus(character, '');
    const tip = resolveMasteryLockedTooltip(status.reason ?? 'no-feature');
    return (
      <Card>
        <SectionHeader icon={Medal} title={title} />
        <p className={styles.note} data-testid="mastery-locked-note">
          <Lock size={12} aria-hidden="true" />{' '}
          {tip ? <ContentTooltip content={tip}>Every weapon mastery is locked</ContentTooltip> : 'Every weapon mastery is locked'}
          . {status.explanation}
        </p>
      </Card>
    );
  }

  const eligible = WEAPON_LIST.filter((w) => !chosen.includes(w.id) && masteryEligible(klass.id, w));

  const handleAdd = () => {
    if (!pick) return;
    const result = chooseWeaponMastery(character, pick);
    if (result.ok) {
      onChange(result.character);
      setMessage(`Added ${getWeapon(pick)?.name ?? pick} to your Weapon Mastery list.`);
      setPick('');
      anchorRef.current?.focus();
    } else {
      setMessage(FAILURE_TEXT[result.reason ?? 'list-full']);
    }
  };

  const handleRemove = (id: string) => {
    onChange(removeWeaponMastery(character, id));
    setMessage(`Removed ${getWeapon(id)?.name ?? id} from your Weapon Mastery list.`);
    anchorRef.current?.focus();
  };

  return (
    <Card>
      <SectionHeader icon={Medal} title={title} />
      <div className={styles.stack}>
        <div role="status" aria-live="polite" className={styles.srOnly} data-testid="mastery-status">
          {message}
        </div>
        <p className={styles.note} ref={anchorRef} tabIndex={-1}>
          Weapons chosen: <strong>{chosen.length}</strong> of{' '}
          <CalculatedValue label="Weapon Mastery limit" breakdown={capBreakdown} className={styles.valueBtn} />
        </p>

        {overCap.length > 0 && (
          <p className={styles.warning} role="alert" data-testid="mastery-over-cap">
            You have chosen {chosen.length} weapons but your level allows {cap}. The extra ones are locked until you remove{' '}
            {overCap.length} (over the limit: {overCap.map((id) => getWeapon(id)?.name ?? id).join(', ')}). Nothing has
            been removed for you.
          </p>
        )}

        {chosen.length === 0 ? (
          <p className={styles.note}>No weapons chosen yet.</p>
        ) : (
          <ul className={styles.list} aria-label="Chosen weapon masteries">
            {chosen.map((id) => {
              const weapon = getWeapon(id);
              const status = weaponMasteryStatus(character, id);
              const name = weapon?.name ?? id;
              const masteryTip = weapon ? resolveWeaponMasteryTooltip(weapon.mastery) : null;
              const lockTip = status.reason ? resolveMasteryLockedTooltip(status.reason) : null;
              return (
                <li key={id} className={styles.row} data-testid={`mastery-row-${id}`}>
                  <span className={styles.name}>{name}</span>
                  {weapon &&
                    (status.usable ? (
                      masteryTip ? (
                        <ContentTooltip content={masteryTip} className={styles.chipTrigger}>
                          <span className={styles.chip}>{titleCase(weapon.mastery)}</span>
                        </ContentTooltip>
                      ) : (
                        <span className={styles.chip}>{titleCase(weapon.mastery)}</span>
                      )
                    ) : lockTip ? (
                      <ContentTooltip content={lockTip} className={styles.chipTrigger}>
                        <span className={styles.lockedChip}>
                          <Lock size={12} aria-hidden="true" />
                          {titleCase(weapon.mastery)} (locked)
                        </span>
                      </ContentTooltip>
                    ) : null)}
                  <button
                    type="button"
                    className={styles.removeBtn}
                    aria-label={`Remove ${name} from Weapon Mastery`}
                    onClick={() => handleRemove(id)}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className={styles.addRow}>
          <label className={styles.label} htmlFor="mastery-pick">
            Add a weapon
          </label>
          <select
            id="mastery-pick"
            className={styles.select}
            value={pick}
            disabled={slotsLeft === 0}
            onChange={(e) => setPick(e.target.value)}
          >
            <option value="">Choose a weapon</option>
            {eligible.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({titleCase(w.mastery)})
              </option>
            ))}
          </select>
          <button type="button" className={styles.addBtn} disabled={!pick || slotsLeft === 0} onClick={handleAdd}>
            Add
          </button>
        </div>
        {slotsLeft === 0 && <p className={styles.note}>Your list is full. Remove a weapon to choose another.</p>}
      </div>
    </Card>
  );
}
