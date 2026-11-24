import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { LibraryMonster } from '../../logic/dm-library';
import { MonsterStatBlock } from './MonsterStatBlock';
import styles from './dm.module.css';
import enc from './encounter.module.css';

interface StatBlockDrawerProps {
  title: string;
  /** The creature's own name, when it differs from the combatant's. */
  subtitle?: string;
  /** Printed combat numbers, e.g. "AC 15, HP 7/7". */
  vitals?: string;
  /** One line above the stat block (a custom monster changed or deleted, or why follow is paused). */
  note?: string;
  /** Shown instead of a stat block when there is none. */
  empty?: string;
  monster?: LibraryMonster;
  follow?: { value: boolean; onChange: (value: boolean) => void };
  /** Damage and heal the shown combatant, with the same logic as its card (during a fight). */
  hp?: { onDamage: (amount: number) => void; onHeal: (amount: number) => void };
  /** Next turn, for a running encounter (the toolbar scrolls out of reach on phones). */
  onNextTurn?: () => void;
  onClose: () => void;
}

/** A non-modal side panel (bottom sheet on narrow screens) holding one read-only stat block. */
export function StatBlockDrawer({
  title,
  subtitle,
  vitals,
  note,
  empty,
  monster,
  follow,
  hp,
  onNextTurn,
  onClose,
}: StatBlockDrawerProps) {
  const [amount, setAmount] = useState('');
  const amountNum = Math.max(0, Math.trunc(Number(amount)) || 0);
  const apply = (fn: (n: number) => void) => {
    if (amountNum <= 0) return;
    fn(amountNum);
    setAmount('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };
  return (
    <aside className={enc.drawer} role="complementary" aria-label="Stat block" onKeyDown={onKeyDown}>
      <div className={enc.drawerHead}>
        <div className={enc.drawerTitle}>
          <strong>{title}</strong>
          {subtitle && <span className={styles.muted}> ({subtitle})</span>}
          {vitals && <div className={styles.muted}>{vitals}</div>}
          {hp && (
            <div className={styles.row}>
              <input
                className={`${styles.input} ${enc.amount}`}
                type="number"
                min={0}
                inputMode="numeric"
                aria-label={`Amount for ${title} (stat block)`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') apply(hp.onDamage);
                }}
              />
              <button type="button" className={styles.btnPrimary} onClick={() => apply(hp.onDamage)} aria-label={`Damage ${title} (stat block)`}>
                Damage
              </button>
              <button type="button" className={styles.btn} onClick={() => apply(hp.onHeal)} aria-label={`Heal ${title} (stat block)`}>
                Heal
              </button>
            </div>
          )}
        </div>
        <div className={enc.drawerActions}>
          {follow && (
            <label className={styles.row}>
              <input type="checkbox" checked={follow.value} onChange={(e) => follow.onChange(e.target.checked)} />
              <span>Follow the active turn</span>
            </label>
          )}
          {onNextTurn && (
            <button type="button" className={styles.btnPrimary} onClick={onNextTurn}>
              Next turn
            </button>
          )}
          <button type="button" className={styles.btn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className={enc.drawerBody}>
        {note && (
          <p className={styles.muted} data-testid="stat-block-note">
            {note}
          </p>
        )}
        {monster ? <MonsterStatBlock monster={monster} /> : empty && <p className={styles.muted}>{empty}</p>}
      </div>
    </aside>
  );
}
