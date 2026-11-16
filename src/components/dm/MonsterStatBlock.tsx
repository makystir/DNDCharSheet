import type { LibraryMonster } from '../../logic/dm-library';
import { ABILITY_KEYS, ABILITY_LABELS } from '../../logic/dm-library';
import { abilityModifier, abilityModifierBreakdown } from '../../logic/abilities';
import { ABILITY_NAMES } from '../../types/character';
import type { DmMonsterEntry } from '../../types/dm';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './dm.module.css';
import lib from './library.module.css';

const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));

function Line({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <strong>{label}</strong> {value}
    </div>
  );
}

function Entries({ title, entries, intro }: { title: string; entries: DmMonsterEntry[]; intro?: string }) {
  if (entries.length === 0) return null;
  return (
    <section className={lib.section} aria-label={title}>
      <h4 className={lib.sectionTitle}>{title}</h4>
      {intro && <p className={styles.muted}>{intro}</p>}
      {entries.map((e, i) => (
        <p key={`${e.name}-${i}`} className={lib.entry}>
          {e.name && <strong>{e.name}. </strong>}
          {e.description}
        </p>
      ))}
    </section>
  );
}

/** A read-only stat block. Ability modifiers and save bonuses show how they were worked out. */
export function MonsterStatBlock({ monster: m }: { monster: LibraryMonster }) {
  const savesText = ABILITY_KEYS.filter((a) => m.saves[a] !== undefined);
  return (
    <article className={lib.statBlock} aria-label={`${m.name} stat block`}>
      <header>
        <h3 className={lib.statName}>{m.name}</h3>
        <div className={styles.muted}>
          {[m.size, m.creatureType].filter(Boolean).join(' ')}
          {m.alignment ? `, ${m.alignment}` : ''}
        </div>
        <div className={styles.muted}>{m.source}</div>
      </header>

      <div className={lib.lines}>
        <div>
          <strong>AC</strong> {m.ac !== null ? m.ac : (m.acNote || 'not printed')}
          {m.ac !== null && m.acNote ? ` (${m.acNote})` : ''}
          {m.initiativeMod !== null && (
            <>
              {' '}
              <strong>Initiative</strong> {signed(m.initiativeMod)}
            </>
          )}
        </div>
        <div>
          <strong>HP</strong> {m.hpAverage !== null ? m.hpAverage : 'not printed'}
          {m.hpDice ? ` (${m.hpDice})` : ''}
        </div>
        <Line label="Speed" value={m.speed} />
      </div>

      {ABILITY_KEYS.some((a) => m.abilities[a] !== undefined) && (
        <table className={lib.abilities}>
          <thead>
            <tr>
              {ABILITY_KEYS.map((a) => (
                <th key={a} scope="col">
                  {ABILITY_LABELS[a]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {ABILITY_KEYS.map((a) => {
                const score = m.abilities[a];
                return (
                  <td key={a}>
                    {score === undefined ? (
                      '-'
                    ) : (
                      <>
                        {score}{' '}
                        <CalculatedValue label={`${ABILITY_NAMES[a]} modifier`} breakdown={abilityModifierBreakdown(a, score)}>
                          ({signed(abilityModifier(score))})
                        </CalculatedValue>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      )}

      <div className={lib.lines}>
        {savesText.length > 0 && (
          <div>
            <strong>Saves</strong>{' '}
            {savesText.map((a, i) => {
              const score = m.abilities[a];
              const bonus = m.saves[a] as number;
              const mod = score === undefined ? bonus : abilityModifier(score);
              return (
                <span key={a}>
                  {i > 0 && ', '}
                  <CalculatedValue
                    label={`${ABILITY_NAMES[a]} saving throw`}
                    breakdown={{
                      total: bonus,
                      components: [
                        { label: `${ABILITY_NAMES[a]} modifier`, value: mod },
                        { label: 'Proficiency Bonus', value: bonus - mod },
                      ],
                    }}
                  >
                    {ABILITY_LABELS[a]} {signed(bonus)}
                  </CalculatedValue>
                </span>
              );
            })}
          </div>
        )}
        <Line label="Skills" value={m.skills} />
        <Line label="Vulnerabilities" value={m.vulnerabilities} />
        <Line label="Resistances" value={m.resistances} />
        <Line label="Immunities" value={m.immunities} />
        <Line label="Condition immunities" value={m.conditionImmunities} />
        <Line label="Gear" value={m.gear} />
        <Line label="Senses" value={m.senses} />
        <Line label="Languages" value={m.languages} />
        <div>
          <strong>CR</strong> {m.cr ?? 'not printed'}
          {m.xp !== null && ` (XP ${m.xp.toLocaleString()})`}
          {m.proficiencyBonus !== null && `, PB ${signed(m.proficiencyBonus)}`}
        </div>
      </div>

      <Entries title="Traits" entries={m.traits} />
      <Entries title="Actions" entries={m.actions} />
      <Entries title="Bonus Actions" entries={m.bonusActions} />
      <Entries title="Reactions" entries={m.reactions} />
      <Entries
        title="Legendary Actions"
        entries={m.legendaryActions}
        intro={m.legendaryUses > 0 ? `Legendary Action Uses: ${m.legendaryUses}${m.legendaryUsesInLair !== undefined ? ` (${m.legendaryUsesInLair} in Lair)` : ''}. Used right after another creature's turn; all uses return at the start of this creature's turn.` : undefined}
      />
      <Entries title="Lair Actions" entries={m.lairActions ?? []} />
    </article>
  );
}
