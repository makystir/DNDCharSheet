import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { Character, CompanionRecord, CompanionSpiritType } from '../../types/character';
import { resolveClasses } from '../../logic/classes';
import { entryIsSpellcaster } from '../../logic/spellcasting';
import { buildCompanionModel, companionDisplayName, ORIGIN_LABELS } from '../../logic/companion-model';
import { trackedHpOf } from '../../logic/companions-actions';
import { OTHERWORLDLY_STEED_MAX_SPELL_LEVEL, OTHERWORLDLY_STEED_MIN_SPELL_LEVEL, OTHERWORLDLY_STEED_TYPES } from '../../logic/primal-companion';
import { zeroHpRuleKeyForOrigin } from '../../logic/tooltip-content';
import { EditableField } from '../shared/EditableField';
import { TrackedVitals } from './TrackedVitals';
import { StatBlockView } from './StatBlockView';
import styles from './CompanionCard.module.css';

export interface CompanionCardProps {
  record: CompanionRecord;
  character: Character;
  onPatch: (id: string, patch: Partial<CompanionRecord>) => void;
  onDelete: (id: string) => void;
}

const SPELL_LEVELS = Array.from(
  { length: OTHERWORLDLY_STEED_MAX_SPELL_LEVEL - OTHERWORLDLY_STEED_MIN_SPELL_LEVEL + 1 },
  (_, i) => OTHERWORLDLY_STEED_MIN_SPELL_LEVEL + i,
);

/**
 * One tracked companion. Presentation mirrors the WFRP HirelingCard: a collapsed
 * two-line header (name; origin and HP chips) that expands to the body (identity
 * fields, HP and conditions, the full stat block, notes, delete). Deviations
 * (D&D content): the 12-characteristic grid becomes the 2024 stat block, wounds
 * become Hit Points with temporary Hit Points, conditions use the catalog picker.
 * All derived numbers are rebuilt from the live character on every render.
 */
export function CompanionCard({ record, character, onPatch, onDelete }: CompanionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const built = buildCompanionModel(record, character);
  if (!built) return null;

  const { model, hpMax, warning, formulaNote, notes } = built;
  const name = companionDisplayName(record);
  const cur = hpMax !== null ? trackedHpOf(record, hpMax) : null;
  const casters = resolveClasses(character).filter((r) => entryIsSpellcaster(r.entry));
  const patch = (p: Partial<CompanionRecord>) => onPatch(record.id, p);
  const dismissed = record.dismissed === true;
  const showTypeChoice = record.origin === 'find-familiar' || record.origin === 'pact-of-the-chain';

  const hpBreakdown = model.hp?.breakdown;
  const bodyId = `companion-body-${record.id}`;

  return (
    <div className={dismissed ? styles.cardDismissed : styles.card} data-testid={`companion-${record.id}`}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={styles.nameLine}>{name}</span>
        <span className={styles.metaLine}>
          <span className={styles.badge}>{ORIGIN_LABELS[record.origin]}</span>
          {record.nickname?.trim() && <span className={styles.badge}>{built.creature.name}</span>}
          {dismissed && <span className={styles.badgeMuted}>Dismissed</span>}
          {warning && <span className={styles.badgeWarn}>Check owner</span>}
          {cur !== null && hpMax !== null && (
            <span className={styles.hpChip}>
              HP {cur}/{hpMax}
            </span>
          )}
          <ChevronDown size={16} aria-hidden="true" className={expanded ? styles.chevronOpen : styles.chevron} />
        </span>
      </button>

      {expanded && (
        <div className={styles.body} id={bodyId}>
          {warning && (
            <p className={styles.warning} role="alert">
              {warning}
            </p>
          )}

          <div className={styles.identityRow}>
            <EditableField
              label="Nickname"
              value={record.nickname ?? ''}
              onSave={(v) => patch({ nickname: String(v).trim().slice(0, 80) || undefined })}
            />
            <label className={styles.dismissLabel}>
              <input type="checkbox" checked={dismissed} onChange={(e) => patch({ dismissed: e.target.checked ? true : undefined })} />
              Dismissed
            </label>
          </div>

          {showTypeChoice && (
            <label className={styles.selectLabel}>
              Familiar type
              <select
                className={styles.select}
                value={record.familiarType ?? ''}
                onChange={(e) => patch({ familiarType: (e.target.value || undefined) as CompanionSpiritType | undefined })}
              >
                <option value="">Not chosen</option>
                {OTHERWORLDLY_STEED_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          )}
          {record.origin === 'find-steed' && (
            <div className={styles.optionRow}>
              <label className={styles.selectLabel}>
                Spell slot level
                <select
                  className={styles.select}
                  value={record.spellSlotLevel ?? OTHERWORLDLY_STEED_MIN_SPELL_LEVEL}
                  onChange={(e) => patch({ spellSlotLevel: Number(e.target.value) })}
                >
                  {SPELL_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.selectLabel}>
                Steed type
                <select
                  className={styles.select}
                  value={record.steedType ?? ''}
                  onChange={(e) => patch({ steedType: (e.target.value || undefined) as CompanionSpiritType | undefined })}
                >
                  <option value="">Not chosen</option>
                  {OTHERWORLDLY_STEED_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              {casters.length > 1 && (
                <label className={styles.selectLabel}>
                  Casting class
                  <select
                    className={styles.select}
                    value={record.castingClassId ?? casters[0].entry.id}
                    onChange={(e) => patch({ castingClassId: e.target.value })}
                  >
                    {casters.map((c) => (
                      <option key={c.entry.id} value={c.entry.id}>
                        {c.data.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          <TrackedVitals
            record={record}
            max={hpMax}
            maxBreakdown={hpBreakdown}
            subject={name}
            zeroHpRule={zeroHpRuleKeyForOrigin(record.origin)}
            onPatch={(p) => patch(p)}
          />

          {formulaNote && <p className={styles.formulaNote}>Formulas (not computed yet): {formulaNote}.</p>}

          <StatBlockView model={model} />

          {notes.length > 0 && (
            <ul className={styles.noteList}>
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}

          <label className={styles.notesLabel}>
            Notes
            <textarea
              className={styles.notes}
              value={record.notes ?? ''}
              maxLength={2000}
              placeholder="Notes..."
              onChange={(e) => patch({ notes: e.target.value || undefined })}
            />
          </label>

          <div className={styles.footer}>
            <button type="button" className={styles.deleteBtn} onClick={() => onDelete(record.id)}>
              <Trash2 size={14} aria-hidden="true" /> Remove {name}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
