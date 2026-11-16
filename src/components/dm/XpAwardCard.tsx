import { useState } from 'react';
import { Trophy } from 'lucide-react';
import type { DmEncounter } from '../../types/dm';
import { updateCombatant } from '../../logic/dm-encounter';
import { xpAward } from '../../logic/dm-balance';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './dm.module.css';
import bal from './balance.module.css';

interface XpAwardCardProps {
  encounter: DmEncounter;
  /** Characters who share the XP unless the DM changes it. */
  defaultSharers: number;
  onCommit: (next: DmEncounter) => void;
}

/** Who counts as overcome, and what each character earns (DMG 2024 "Awarding XP"). */
export function XpAwardCard({ encounter, defaultSharers, onCommit }: XpAwardCardProps) {
  const [sharers, setSharers] = useState(String(Math.max(1, defaultSharers)));
  const monsters = encounter.combatants.filter((c) => c.kind === 'monster');
  const counts = (c: (typeof monsters)[number]) => c.xpCounts ?? c.hp.dead;
  const counted = monsters.filter(counts);
  const size = Math.max(1, Math.trunc(Number(sharers)) || 1);
  const award = xpAward(counted, size);

  return (
    <Card>
      <SectionHeader icon={Trophy} title="XP for this fight" />
      <div className={bal.award}>
        <p className={styles.muted}>
          Tick every creature the party overcame: killed, routed, captured or cleverly avoided. The characters divide the total
          evenly. Count an NPC who helped substantially as one of the characters.
        </p>
        {monsters.length === 0 ? (
          <p className={styles.muted}>There were no monsters in this encounter.</p>
        ) : (
          monsters.map((c) => (
            <label key={c.id} className={bal.awardRow}>
              <span className={styles.row}>
                <input
                  type="checkbox"
                  checked={counts(c)}
                  onChange={(e) => onCommit(updateCombatant(encounter, c.id, { xpCounts: e.target.checked }))}
                  aria-label={`Count ${c.name} for XP`}
                />
                {c.name}
              </span>
              <span className={typeof c.xp === 'number' ? undefined : styles.error}>
                {typeof c.xp === 'number' ? `${c.xp.toLocaleString()} XP` : 'no XP value'}
              </span>
            </label>
          ))
        )}
        <div className={styles.row}>
          <label className={styles.field} style={{ flex: '0 1 180px' }}>
            <span className={styles.fieldLabel}>Characters sharing the XP</span>
            <input className={styles.input} type="number" min={1} value={sharers} onChange={(e) => setSharers(e.target.value)} />
          </label>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Total XP</span>
            <span className={styles.statValue}>
              <CalculatedValue label="XP from overcome creatures" breakdown={award.total}>
                {award.total.total.toLocaleString()}
              </CalculatedValue>
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Each character</span>
            <span className={styles.statValue} data-testid="xp-share">
              <CalculatedValue label="XP for each character" breakdown={award.share}>
                {award.share.total.toLocaleString()}
              </CalculatedValue>
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
