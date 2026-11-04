import { Sparkles } from 'lucide-react';
import type { Character } from '../../types/character';
import {
  isSpellcaster,
  pactMagicSlots,
  spellSlotAvailableBreakdown,
  spellSlots,
} from '../../logic/spellcasting';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './SpellSlotSummary.module.css';

export interface SpellSlotSummaryProps {
  character: Character;
}

/**
 * A READ-ONLY spell-slot summary for the Status mode (Stage A5e): the
 * character's standard spell-slot levels (or Warlock Pact Magic slots) showing
 * available / max per level. Changing slots stays on the Spells tab — this is a
 * combat-side glance only.
 *
 * Every count comes from the A3 spellcasting logic (`spellSlots`,
 * `pactMagicSlots`) and the expended counts stored on `character.spellcasting`;
 * the available/max breakdown reuses `spellSlotAvailableBreakdown`. No rule is
 * computed here. Renders nothing for a non-caster.
 */
export function SpellSlotSummary({ character }: SpellSlotSummaryProps) {
  if (!isSpellcaster(character)) return null;

  const slots = spellSlots(character);
  const pact = pactMagicSlots(character);
  const expendedByLevel = character.spellcasting?.slotsExpended ?? {};
  const pactExpended = character.spellcasting?.pactSlotsExpended ?? 0;

  // Standard slots: levels 1..9 with a non-zero maximum.
  const standardRows: { level: number; max: number; expended: number }[] = [];
  if (slots) {
    for (let level = 1; level <= 9; level++) {
      const max = slots[level] ?? 0;
      if (max > 0) {
        standardRows.push({ level, max, expended: expendedByLevel[level] ?? 0 });
      }
    }
  }

  const hasAnything = standardRows.length > 0 || (pact !== undefined && pact.slots > 0);
  if (!hasAnything) return null;

  return (
    <Card>
      <div className={styles.stack}>
        <SectionHeader icon={Sparkles} title="Spell Slots" />
        <p className={styles.hint}>
          Read-only. Spend and recover slots on the Spells tab, or with a rest.
        </p>
        <ul className={styles.list} aria-label="Spell slots">
          {standardRows.map((row) => {
            const available = Math.max(0, row.max - row.expended);
            return (
              <li key={row.level} className={styles.row}>
                <span className={styles.rowLabel}>Level {row.level}</span>
                <span className={styles.rowValue}>
                  <CalculatedValue
                    label={`Level ${row.level} slots available`}
                    breakdown={spellSlotAvailableBreakdown(row.max, row.expended, `Level ${row.level}`)}
                  >
                    {available} / {row.max}
                  </CalculatedValue>
                </span>
              </li>
            );
          })}
          {pact !== undefined && pact.slots > 0 && (
            <li className={styles.row}>
              <span className={styles.rowLabel}>Pact Magic (level {pact.slotLevel})</span>
              <span className={styles.rowValue}>
                <CalculatedValue
                  label="Pact Magic slots available"
                  breakdown={spellSlotAvailableBreakdown(pact.slots, pactExpended, 'Pact Magic')}
                >
                  {Math.max(0, pact.slots - pactExpended)} / {pact.slots}
                </CalculatedValue>
              </span>
            </li>
          )}
        </ul>
      </div>
    </Card>
  );
}
