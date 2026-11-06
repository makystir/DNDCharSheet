import type { Character } from '../../types/character';
import { buildPrintSheetData, signed } from './printLayoutGenerators';
import styles from './PrintLayout.module.css';

/**
 * Print-only, read-only single-page D&D character sheet (Stage B9).
 *
 * Bucket-1 port of PWACharSheet's PrintLayout: the print-sheet SHELL (page
 * sizing, section boxes, screen-hidden/print-shown, a page footer) ports; the
 * WFRP-specific sections are REPLACED by the D&D equivalents. Every number is
 * read from an existing src/logic derived function via buildPrintSheetData —
 * this component RECOMPUTES NOTHING and mutates nothing. It is strictly
 * READ-ONLY: no inputs, no handlers, no state.
 *
 * The brief exempts the print sheet from the calculated-total-tooltip steering
 * (the printout shows the plain numbers, not tooltips); the totals still come
 * from the same logic functions the on-screen sheet uses.
 *
 * Mounted by App inside a screen-hidden / print-shown wrapper so `window.print()`
 * captures it regardless of the active page. The Spells section renders ONLY for
 * a spellcaster, matching the app's conditional Spells nav/route visibility.
 */

interface PrintLayoutProps {
  character: Character;
}

function PageFooter({ name }: { name: string }) {
  return (
    <div className={styles.pageFooter}>
      {name || 'Unnamed Character'} — D&D 5.5e Character Record — Generated{' '}
      {new Date().toLocaleDateString()}
    </div>
  );
}

export function PrintLayout({ character }: PrintLayoutProps) {
  const data = buildPrintSheetData(character);

  return (
    <div className={styles.printWrapper}>
      <div className={styles.page}>
        {/* Title */}
        <div className={styles.titleArea}>
          <div className={styles.characterName}>{data.identity.name}</div>
          <div className={styles.subtitle}>
            {data.identity.species} · {data.identity.classAndLevel}
          </div>
        </div>

        {/* Identity */}
        <section className={styles.sectionBox} aria-label="Identity">
          <table className={styles.tbl}>
            <tbody>
              <tr>
                <td className={styles.hdrCell}>Species</td>
                <td className={styles.valCell}>{data.identity.species}</td>
                <td className={styles.hdrCell}>Class &amp; Level</td>
                <td className={styles.valCell}>{data.identity.classAndLevel}</td>
              </tr>
              <tr>
                <td className={styles.hdrCell}>Background</td>
                <td className={styles.valCell}>{data.identity.background || '—'}</td>
                <td className={styles.hdrCell}>Alignment</td>
                <td className={styles.valCell}>{data.identity.alignment || '—'}</td>
              </tr>
              <tr>
                <td className={styles.hdrCell}>Languages</td>
                <td className={styles.valCell} colSpan={3}>
                  {data.identity.languages || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Core stats */}
        <section className={styles.sectionBox} aria-label="Core statistics">
          <div className={styles.sectionTitle}>Core Statistics</div>
          <div className={styles.statRow}>
            {data.coreStats.map((stat) => (
              <div key={stat.label} className={styles.statCell}>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={styles.statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Abilities + saves */}
        <section className={styles.sectionBox} aria-label="Ability scores">
          <div className={styles.sectionTitle}>Ability Scores</div>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th className={styles.hdrCell}>Ability</th>
                <th className={styles.hdrCell}>Score</th>
                <th className={styles.hdrCell}>Mod</th>
                <th className={styles.hdrCell}>Save</th>
              </tr>
            </thead>
            <tbody>
              {data.abilities.map((row) => (
                <tr key={row.ability}>
                  <td className={styles.cell}>{row.name}</td>
                  <td className={styles.valCell}>{row.score}</td>
                  <td className={styles.valCellBold}>{signed(row.modifier)}</td>
                  <td className={styles.valCell}>
                    {signed(row.saveModifier)}
                    {row.saveProficient ? ' ●' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Saving throws */}
        <section className={styles.sectionBox} aria-label="Saving throws">
          <div className={styles.sectionTitle}>Saving Throws</div>
          <table className={styles.tbl}>
            <tbody>
              {data.saves.map((row) => (
                <tr key={row.ability}>
                  <td className={styles.cell}>
                    {row.proficient ? '● ' : '○ '}
                    {row.name}
                  </td>
                  <td className={styles.valCellBold}>{signed(row.modifier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Skills */}
        <section className={styles.sectionBox} aria-label="Skills">
          <div className={styles.sectionTitle}>Skills</div>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th className={styles.hdrCell}></th>
                <th className={styles.hdrCell}>Skill</th>
                <th className={styles.hdrCell}>Ability</th>
                <th className={styles.hdrCell}>Mod</th>
              </tr>
            </thead>
            <tbody>
              {data.skills.map((row) => (
                <tr key={row.id}>
                  <td className={styles.markerCell}>
                    {row.expertise ? '◆' : row.proficient ? '●' : '○'}
                  </td>
                  <td className={styles.cell}>{row.name}</td>
                  <td className={styles.valCell}>{row.ability}</td>
                  <td className={styles.valCellBold}>{signed(row.modifier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.legend}>○ untrained · ● proficient · ◆ expertise</div>
        </section>

        {/* Attacks */}
        <section className={styles.sectionBox} aria-label="Attacks and weapons">
          <div className={styles.sectionTitle}>Attacks &amp; Weapons</div>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th className={styles.hdrCell}>Name</th>
                <th className={styles.hdrCell}>Attack</th>
                <th className={styles.hdrCell}>Damage</th>
              </tr>
            </thead>
            <tbody>
              {data.attacks.map((row, i) => (
                <tr key={`${row.name}-${i}`}>
                  <td className={styles.cell}>
                    {row.name}
                    {row.proficient ? '' : ' (not proficient)'}
                  </td>
                  <td className={styles.valCellBold}>{signed(row.attackBonus)}</td>
                  <td className={styles.valCell}>{row.damage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Spells — only for a spellcaster (matches the app's conditional Spells visibility). */}
        {data.spells && (
          <section className={styles.sectionBox} aria-label="Spells" data-section="spells">
            <div className={styles.sectionTitle}>Spells</div>
            <table className={styles.tbl}>
              <tbody>
                <tr>
                  <td className={styles.hdrCell}>Spell Save DC</td>
                  <td className={styles.valCellBold}>{data.spells.saveDc ?? '—'}</td>
                  <td className={styles.hdrCell}>Spell Attack</td>
                  <td className={styles.valCellBold}>
                    {data.spells.attackBonus !== undefined ? signed(data.spells.attackBonus) : '—'}
                  </td>
                </tr>
                <tr>
                  <td className={styles.hdrCell}>Ability</td>
                  <td className={styles.valCell}>{data.spells.ability ?? '—'}</td>
                  <td className={styles.hdrCell}>Cantrips / Prepared</td>
                  <td className={styles.valCell}>
                    {data.spells.cantripsKnown} / {data.spells.preparedCount}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Per-class Save DC / Attack (Stage M5) — only for a multiclass
                caster (PHB 2024 "Multiclassing: Spellcasting"). */}
            {data.spells.perClass && data.spells.perClass.length > 0 && (
              <table className={styles.tbl}>
                <thead>
                  <tr>
                    <th className={styles.hdrCell}>Class</th>
                    <th className={styles.hdrCell}>Ability</th>
                    <th className={styles.hdrCell}>Save DC</th>
                    <th className={styles.hdrCell}>Attack</th>
                  </tr>
                </thead>
                <tbody>
                  {data.spells.perClass.map((row) => (
                    <tr key={row.className}>
                      <td className={styles.cell}>{row.className}</td>
                      <td className={styles.valCell}>{row.ability}</td>
                      <td className={styles.valCellBold}>{row.saveDc}</td>
                      <td className={styles.valCellBold}>{signed(row.attackBonus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {data.spells.slots.length > 0 && (
              <table className={styles.tbl}>
                <thead>
                  <tr>
                    <th className={styles.hdrCell}>Slots</th>
                    <th className={styles.hdrCell}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.spells.slots.map((slot) => (
                    <tr key={slot.label}>
                      <td className={styles.cell}>{slot.label}</td>
                      <td className={styles.valCellBold}>{slot.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {data.spells.cantrips.length > 0 && (
              <div className={styles.textBlock}>
                <span className={styles.hdrInline}>Cantrips:</span>{' '}
                {data.spells.cantrips.join(', ')}
              </div>
            )}
            {data.spells.prepared.length > 0 && (
              <div className={styles.textBlock}>
                <span className={styles.hdrInline}>Prepared:</span>{' '}
                {data.spells.prepared.join(', ')}
              </div>
            )}
          </section>
        )}

        {/* Inventory + encumbrance + currency */}
        <section className={styles.sectionBox} aria-label="Inventory">
          <div className={styles.sectionTitle}>Inventory</div>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th className={styles.hdrCell}>Item</th>
                <th className={styles.hdrCell}>Qty</th>
              </tr>
            </thead>
            <tbody>
              {data.inventory.items.length === 0 ? (
                <tr>
                  <td className={styles.cell} colSpan={2}>
                    No items
                  </td>
                </tr>
              ) : (
                data.inventory.items.map((item, i) => (
                  <tr key={`${item.name}-${i}`}>
                    <td className={styles.cell}>{item.name}</td>
                    <td className={styles.valCell}>{item.quantity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className={styles.textBlock}>
            <span className={styles.hdrInline}>Carried:</span> {data.inventory.carried} /{' '}
            {data.inventory.capacity} lb
          </div>
          <div className={styles.textBlock}>
            <span className={styles.hdrInline}>Coins:</span>{' '}
            {data.inventory.currency.map((c) => `${c.value} ${c.label}`).join(' · ')}
          </div>
        </section>

        {/* Features & traits */}
        <section className={styles.sectionBox} aria-label="Features and traits">
          <div className={styles.sectionTitle}>Features &amp; Traits</div>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th className={styles.hdrCell}>Name</th>
                <th className={styles.hdrCell}>Source</th>
                <th className={styles.hdrCell}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.features.length === 0 ? (
                <tr>
                  <td className={styles.cell} colSpan={3}>
                    No features
                  </td>
                </tr>
              ) : (
                data.features.map((f, i) => (
                  <tr key={`${f.name}-${i}`}>
                    <td className={styles.cellBold}>{f.name}</td>
                    <td className={styles.valCell}>{f.source}</td>
                    <td className={styles.cellSmall}>{f.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* Conditions (only when any are active) */}
        {data.conditions.length > 0 && (
          <section className={styles.sectionBox} aria-label="Conditions" data-section="conditions">
            <div className={styles.sectionTitle}>Conditions</div>
            <div className={styles.textBlock}>{data.conditions.join(', ')}</div>
          </section>
        )}

        <PageFooter name={data.identity.name} />
      </div>
    </div>
  );
}
