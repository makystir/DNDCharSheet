import { Scale } from 'lucide-react';
import type { DmCombatant } from '../../types/dm';
import { DIFFICULTIES, DIFFICULTY_LABELS } from '../../data/xp-tables';
import {
  balanceNotes,
  difficultyFit,
  encounterXp,
  fitLabel,
  xpBudget,
  type BudgetMember,
} from '../../logic/dm-balance';
import { crToNumber } from '../../logic/dm-library';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './dm.module.css';
import bal from './balance.module.css';

interface EncounterBalanceProps {
  members: BudgetMember[];
  combatants: DmCombatant[];
}

const n = (v: number) => v.toLocaleString();

/** The encounter's XP set against the DMG 2024 XP budget for this party. */
export function EncounterBalance({ members, combatants }: EncounterBalanceProps) {
  const xp = encounterXp(combatants);
  const budgets = DIFFICULTIES.map((d) => ({ d, b: xpBudget(members, d) }));
  const fit = difficultyFit(xp.total.total, {
    low: budgets[0].b.total,
    moderate: budgets[1].b.total,
    high: budgets[2].b.total,
  });
  const notes = balanceNotes(members, combatants, (c) => crToNumber(c.cr));
  const monsters = combatants.filter((c) => c.kind === 'monster');

  return (
    <Card>
      <SectionHeader icon={Scale} title="Encounter balance" />
      <div className={styles.stack}>
        {members.length === 0 ? (
          <p className={styles.muted}>
            Add your party (or party members to the encounter) to compare this encounter's XP with the budget for their level.
          </p>
        ) : (
          <>
            <div className={bal.summary}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Encounter XP</span>
                <span className={styles.statValue}>
                  <CalculatedValue label="Encounter XP" breakdown={xp.total}>
                    {n(xp.total.total)}
                  </CalculatedValue>
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Where it sits</span>
                <span className={bal.fit} data-testid="balance-fit">
                  {fitLabel(fit)}
                </span>
              </div>
            </div>
            <table className={bal.table}>
              <caption className={styles.muted}>
                XP budget for {members.length} {members.length === 1 ? 'character' : 'characters'} (Dungeon Master's Guide 2024)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Difficulty</th>
                  <th scope="col">Budget</th>
                  <th scope="col">Left to spend</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map(({ d, b }) => {
                  const left = b.total - xp.total.total;
                  return (
                    <tr key={d} data-testid={`budget-${d}`}>
                      <th scope="row">{DIFFICULTY_LABELS[d]}</th>
                      <td>
                        <CalculatedValue label={`${DIFFICULTY_LABELS[d]} XP budget`} breakdown={b}>
                          {n(b.total)}
                        </CalculatedValue>
                      </td>
                      <td className={left < 0 ? bal.over : undefined}>
                        {left < 0 ? `${n(-left)} over` : n(left)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {monsters.length > 0 && xp.unknown.length > 0 && (
          <p className={styles.error}>
            No XP value for {xp.unknown.join(', ')}, so {xp.unknown.length === 1 ? 'it is' : 'they are'} not counted. Set the XP
            under More on its card.
          </p>
        )}
        {notes.length > 0 && (
          <ul className={bal.notes} aria-label="Balance notes">
            {notes.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        <p className={styles.muted}>
          The 2024 rules add up the creatures' XP with no multiplier. Spend as much of a budget as you can without going over.
          Which budget an encounter fits is a reading of that rule, not a printed label.
        </p>
      </div>
    </Card>
  );
}
