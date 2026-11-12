import { Sparkles } from 'lucide-react';
import type { Character } from '../../types/character';
import { getSpell } from '../../data/spells';
import { formatSigned } from '../../logic/breakdown';
import {
  anySpellcaster,
  perClassSpellcasting,
  spellSlotAvailableBreakdown,
} from '../../logic/spellcasting';
import { knownSpellsByClass } from '../../logic/known-spells';
import { pactSlots, setPactExpended, setSlotsExpended, slotLevels } from '../../logic/spell-slot-spend';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import { SpellName } from '../shared/SpellName';
import styles from './SpellcastingQuickCard.module.css';

export interface SpellcastingQuickCardProps {
  character: Character;
  onChange: (next: Character) => void;
}

/** One pip per slot: filled = available. Tapping an available pip spends one; a spent pip recovers one. */
function SlotPips({
  label,
  max,
  expended,
  onSet,
}: {
  label: string;
  max: number;
  expended: number;
  onSet: (expended: number) => void;
}) {
  const available = max - expended;
  return (
    <div className={styles.slotRow} data-testid={`slots-${label}`}>
      <span className={styles.slotLabel}>
        <CalculatedValue label={`${label} slots available`} breakdown={spellSlotAvailableBreakdown(max, expended, label)}>
          {label}: {available}/{max}
        </CalculatedValue>
      </span>
      <span className={styles.pips}>
        {Array.from({ length: max }, (_, i) => {
          const isAvailable = i < available;
          return (
            <button
              key={i}
              type="button"
              className={isAvailable ? styles.pipOn : styles.pipOff}
              aria-label={isAvailable ? `Spend a ${label} slot` : `Recover a ${label} slot`}
              onClick={() => onSet(isAvailable ? expended + 1 : expended - 1)}
            />
          );
        })}
      </span>
    </div>
  );
}

/**
 * Spellcasting at a glance for the Combat page: save DC and spell attack per
 * casting class, spell slots you tap to spend or recover, and the cantrips and
 * prepared spells with their casting time and Concentration / Ritual tags (each
 * name opens its spell tooltip). The full lists are edited on the Spells page.
 * Renders nothing for a character who cannot cast spells.
 */
export function SpellcastingQuickCard({ character, onChange }: SpellcastingQuickCardProps) {
  if (!anySpellcaster(character)) return null;
  const casters = perClassSpellcasting(character);
  const levels = slotLevels(character);
  const pact = pactSlots(character);
  const known = knownSpellsByClass(character);

  const spellRow = (id: string) => {
    const spell = getSpell(id);
    if (!spell) return null;
    return (
      <li key={id} className={styles.spell}>
        <span className={styles.spellName}>
          <SpellName id={id} />
        </span>
        <span className={styles.spellMeta}>
          {spell.castingTime.split(',')[0]}
          {spell.concentration && <span className={styles.tag}>Conc.</span>}
          {spell.ritual && <span className={styles.tag}>Ritual</span>}
        </span>
      </li>
    );
  };

  return (
    <Card>
      <SectionHeader icon={Sparkles} title="Spellcasting" />
      <div className={styles.stats}>
        {casters.map((c) => (
          <div key={c.classId} className={styles.statGroup}>
            {casters.length > 1 && <span className={styles.className}>{c.className}</span>}
            <span className={styles.stat}>
              <span className={styles.statLabel}>Save DC</span>
              <CalculatedValue label={`${c.className} Spell Save DC`} breakdown={c.saveDc}>
                {c.saveDc.total}
              </CalculatedValue>
            </span>
            <span className={styles.stat}>
              <span className={styles.statLabel}>Spell attack</span>
              <CalculatedValue label={`${c.className} Spell Attack Bonus`} breakdown={c.attack}>
                {formatSigned(c.attack.total)}
              </CalculatedValue>
            </span>
          </div>
        ))}
      </div>

      {(levels.length > 0 || pact) && (
        <div className={styles.slots} aria-label="Spell slots" role="group">
          {levels.map((s) => (
            <SlotPips
              key={s.level}
              label={`Level ${s.level}`}
              max={s.max}
              expended={s.expended}
              onSet={(n) => onChange(setSlotsExpended(character, s.level, n))}
            />
          ))}
          {pact && (
            <SlotPips
              label={`Pact Magic (level ${pact.slotLevel})`}
              max={pact.max}
              expended={pact.expended}
              onSet={(n) => onChange(setPactExpended(character, n))}
            />
          )}
          <p className={styles.note}>
            Spell slots come back on a Long Rest{pact ? '; Pact Magic slots on a Short or Long Rest' : ''}.
          </p>
        </div>
      )}

      {known.map((k) => (
        <section key={k.classId} className={styles.lists} aria-label={`${k.className} spells to cast`}>
          {known.length > 1 && <h4 className={styles.className}>{k.className}</h4>}
          {k.cantrips.length > 0 && (
            <>
              <h5 className={styles.listHeading}>Cantrips</h5>
              <ul className={styles.spellList}>{k.cantrips.map(spellRow)}</ul>
            </>
          )}
          {k.prepared.length > 0 && (
            <>
              <h5 className={styles.listHeading}>Prepared</h5>
              {[...new Set(k.prepared.map((id) => getSpell(id)?.level ?? 0))].map((level) => (
                <div key={level} className={styles.levelGroup}>
                  <span className={styles.levelBadge}>Level {level}</span>
                  <ul className={styles.spellList} aria-label={`${k.className} level ${level} spells`}>
                    {k.prepared.filter((id) => (getSpell(id)?.level ?? 0) === level).map(spellRow)}
                  </ul>
                </div>
              ))}
            </>
          )}
          {k.cantrips.length === 0 && k.prepared.length === 0 && (
            <p className={styles.note}>
              No spells chosen yet. Pick them on the <a href="#spells/prepared">Spells page</a>.
            </p>
          )}
        </section>
      ))}
      <p className={styles.note}>
        <a href="#spells">Open the Spells page</a> to change your spells.
      </p>
    </Card>
  );
}
