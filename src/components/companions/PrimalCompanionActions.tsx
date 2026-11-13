import { useState } from 'react';
import type { Character, CompanionRecord } from '../../types/character';
import { CREATURE_CATALOG } from '../../data/creatures';
import { availableSlots, revivePrimalCompanion, swapPrimalBeast } from '../../logic/companion-play';
import type { SlotChoice } from '../../logic/companion-play';
import { PRIMAL_COMPANION_IDS } from '../../logic/primal-companion';
import styles from './CompanionsShared.module.css';

export interface PrimalCompanionActionsProps {
  record: CompanionRecord;
  character: Character;
  /** At 0 Hit Points (the revive is offered only then). */
  down: boolean;
  onCharacterChange: (next: Character) => void;
}

function slotLabel(s: SlotChoice): string {
  return s.kind === 'pact' ? `Pact Magic slot (level ${s.level})` : `Level ${s.level} slot`;
}

/**
 * The Primal Companion's two book actions (PHB 2024 Beast Master, L5589-5591):
 * revive a beast that died within the last hour by expending a spell slot (it
 * returns with all its Hit Points), and, after a Long Rest, summon a different
 * primal beast in its place. Both are buttons the player presses; the timing
 * ("within the last hour", "after a Long Rest") is theirs to judge.
 */
export function PrimalCompanionActions({ record, character, down, onCharacterChange }: PrimalCompanionActionsProps) {
  const slots = availableSlots(character);
  const [slotIndex, setSlotIndex] = useState(0);
  const others = PRIMAL_COMPANION_IDS.filter((id) => id !== record.creatureId);
  const [beast, setBeast] = useState<string>(others[0] ?? '');
  const slot = slots[Math.min(slotIndex, slots.length - 1)];

  return (
    <div className={styles.subsection} data-testid="primal-actions">
      {down && (
        <div className={styles.row}>
          {slots.length > 0 ? (
            <>
              <label className={styles.field}>
                Spell slot to expend
                <select className={styles.control} value={Math.min(slotIndex, slots.length - 1)} onChange={(e) => setSlotIndex(Number(e.target.value))}>
                  {slots.map((s, i) => (
                    <option key={`${s.kind}-${s.level}`} value={i}>
                      {slotLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  const next = slot ? revivePrimalCompanion(character, record.id, slot) : null;
                  if (next) onCharacterChange(next);
                }}
              >
                Revive the beast
              </button>
            </>
          ) : (
            <span className={styles.figureLabel}>No spell slot left to revive it.</span>
          )}
          <span className={styles.figureLabel}>
            If it died within the last hour, a Magic action and a spell slot bring it back after 1 minute with all its Hit Points (PHB, Beast Master).
          </span>
        </div>
      )}
      <div className={styles.row}>
        <label className={styles.field}>
          Summon a different beast
          <select className={styles.control} value={beast} onChange={(e) => setBeast(e.target.value)}>
            {others.map((id) => (
              <option key={id} value={id}>
                {CREATURE_CATALOG[id]?.name ?? id}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={styles.btn}
          onClick={() => {
            const next = swapPrimalBeast(character, record.id, beast);
            if (next) onCharacterChange(next);
          }}
        >
          Summon instead
        </button>
        <span className={styles.figureLabel}>
          Whenever you finish a Long Rest you can summon a different primal beast; the old one vanishes (PHB, Beast Master).
        </span>
      </div>
    </div>
  );
}
