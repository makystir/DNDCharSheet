import { Sparkles } from 'lucide-react';
import type { CatalogSpell, SpellId } from '../../data/spells';
import { SCHOOL_LABELS } from './spellSchoolLabels';
import { ContentTooltip } from './ContentTooltip';
import { SpellName } from './SpellName';
import { resolveSpellTooltip } from '../../logic/tooltip-content';
import { EmptyState } from './EmptyState';
import styles from './SpellPickList.module.css';

export interface SpellPickListProps {
  spells: CatalogSpell[];
  selectedIds: SpellId[];
  atCap: boolean;
  onToggle: (id: SpellId, checked: boolean) => void;
  showLevel?: boolean;
  /** Ids that are always selected and cannot be unchecked (e.g. Mage Hand). */
  lockedIds?: SpellId[];
  /** Badge/aria text for locked rows (defaults to "required"). */
  lockedLabel?: string;
  /**
   * When given, ids in this set are castable RIGHT NOW given available slots
   * across both pools (cross-pool, PHB 2024 L2168); a chosen leveled spell NOT
   * in the set is marked "no slot". Only passed by the multiclass per-class
   * prepared picker, so single-class rows are unchanged.
   */
  castableIds?: Set<SpellId>;
  /** The spell currently concentrated on (Stage A5b); enables the toggle column. */
  concentratingId?: SpellId;
  /** When given, each chosen concentration spell shows a "Concentrating" toggle. */
  onToggleConcentration?: (id: SpellId, on: boolean) => void;
  /**
   * Compact detail mode (used by the creation wizard): each row also shows
   * school, casting time and Concentration / Ritual tags, plus a details
   * tooltip carrying the catalog description.
   */
  showDetails?: boolean;
}

/** A checkbox list of spells, disabling unchecked rows once the cap is reached. */
export function SpellPickList({
  spells,
  selectedIds,
  atCap,
  onToggle,
  showLevel,
  lockedIds = [],
  lockedLabel = 'required',
  castableIds,
  concentratingId,
  onToggleConcentration,
  showDetails,
}: SpellPickListProps) {
  if (spells.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        heading="No spells available"
        description="There are no spells of this kind on your class list yet."
        compact
      />
    );
  }
  return (
    <ul className={styles.pickList} aria-label="Spell choices">
      {spells.map((s) => {
        const checked = selectedIds.includes(s.id);
        const locked = lockedIds.includes(s.id);
        return (
          <li key={s.id} className={styles.pickRow}>
            <label className={styles.pickLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={checked}
                // Locked (required) cantrips stay checked and cannot be toggled
                // off; otherwise unchecked rows disable once the cap is reached.
                disabled={locked || (!checked && atCap)}
                aria-label={`${s.name}${showLevel ? ` (level ${s.level})` : ''}${
                  locked ? ` (${lockedLabel})` : ''
                }`}
                onChange={(e) => onToggle(s.id, e.target.checked)}
              />
              <span className={styles.pickName}>
                <SpellName id={s.id} />
                {locked && <span className={styles.pickLevel}> · {lockedLabel}</span>}
                {showLevel && <span className={styles.pickLevel}> · L{s.level}</span>}
                {/* Cross-pool castability (PHB 2024 L2168): only annotated when
                    a castableIds set is supplied (multiclass per-class picker)
                    and the spell is prepared. A leveled spell with no available
                    slot in either pool is marked "no slot". */}
                {castableIds && checked && s.level > 0 && (
                  <span className={styles.pickLevel}>
                    {' '}· {castableIds.has(s.id) ? 'castable' : 'no slot'}
                  </span>
                )}
              </span>
            </label>
            {showDetails && (
              <span className={styles.pickMeta}>
                {SCHOOL_LABELS[s.school]} · {s.castingTime}
                {s.concentration && <span className={styles.tag}>Concentration</span>}
                {s.ritual && <span className={styles.tag}>Ritual</span>}
                <ContentTooltip
                  className={styles.detailsTrigger}
                  content={resolveSpellTooltip(s.id) ?? {
                    title: s.name,
                    sections: [
                      {
                        label: 'Spell',
                        text: `${s.level === 0 ? 'Cantrip' : `Level ${s.level}`} ${SCHOOL_LABELS[s.school]} · ${s.castingTime} · ${s.range} · ${s.duration}`,
                      },
                      { label: 'Description', text: s.description },
                    ],
                  }}
                >
                  Details{' '}
                  <span className={styles.srOnly}>for {s.name}</span>
                </ContentTooltip>
              </span>
            )}
            {onToggleConcentration && checked && s.concentration && (
              <label className={styles.concentrateLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={concentratingId === s.id}
                  aria-label={`Concentrating on ${s.name}`}
                  onChange={(e) => onToggleConcentration(s.id, e.target.checked)}
                />
                <span>Concentrating</span>
              </label>
            )}
          </li>
        );
      })}
    </ul>
  );
}
