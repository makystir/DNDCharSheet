import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Character, CompanionRecord, CompanionSpiritType } from '../../types/character';
import { resolveClasses } from '../../logic/classes';
import { entryIsSpellcaster } from '../../logic/spellcasting';
import { buildCompanionModel, companionDisplayName, hasRidingDetails, ORIGIN_LABELS, ridingOpenByDefault } from '../../logic/companion-model';
import { trackedHpOf } from '../../logic/companions-actions';
import { capacityStatus, mountCapacity } from '../../logic/companions';
import { OTHERWORLDLY_STEED_MAX_SPELL_LEVEL, OTHERWORLDLY_STEED_MIN_SPELL_LEVEL, OTHERWORLDLY_STEED_TYPES } from '../../logic/primal-companion';
import { zeroHpRuleKeyForOrigin } from '../../logic/tooltip-content';
import { companionPortraitKey } from '../../storage/companion-portraits';
import { BlurInput } from './BlurInput';
import { PrimalCompanionActions } from './PrimalCompanionActions';
import { RecordCard } from './RecordCard';
import { RidingPackingSection } from './RidingPackingSection';
import { TrackedVitals } from './TrackedVitals';
import { StatBlockView } from './StatBlockView';
import styles from './CompanionsShared.module.css';

export interface CompanionCardProps {
  record: CompanionRecord;
  character: Character;
  onPatch: (id: string, patch: Partial<CompanionRecord>) => void;
  onDelete: (id: string) => void;
  /** Whole-character changes (the Primal Companion's revive spends a spell slot). */
  onCharacterChange: (next: Character) => void;
}

const SPELL_LEVELS = Array.from(
  { length: OTHERWORLDLY_STEED_MAX_SPELL_LEVEL - OTHERWORLDLY_STEED_MIN_SPELL_LEVEL + 1 },
  (_, i) => OTHERWORLDLY_STEED_MIN_SPELL_LEVEL + i,
);

/**
 * One tracked creature (Creatures tab): a Primal Companion, familiar, steed,
 * Animate Dead servant, or a pet, mount or pack animal. Uses the shared
 * RecordCard shell. The body holds the identity fields, HP and conditions, the
 * Riding & packing section (formerly the Mounts tab), the full stat block and
 * notes. All derived numbers are rebuilt from the live character on every
 * render.
 */
export function CompanionCard({ record, character, onPatch, onDelete, onCharacterChange }: CompanionCardProps) {
  const built = buildCompanionModel(record, character);
  const [ridingOpen, setRidingOpen] = useState(() => (built ? ridingOpenByDefault(record, built.creature) : false));
  if (!built) return null;

  const { creature, model, hpMax, warning, formulaNote, notes } = built;
  const name = companionDisplayName(record);
  const cur = hpMax !== null ? trackedHpOf(record, hpMax) : null;
  const patch = (p: Partial<CompanionRecord>) => onPatch(record.id, p);
  const dismissed = record.dismissed === true;
  const cap = mountCapacity(creature).capacityLb;
  const riding = hasRidingDetails(record);
  const over = cap !== null && riding && capacityStatus(record.carriedLb ?? 0, cap).over;

  const meta = (
    <>
      {record.nickname?.trim() && <span className={styles.badge}>{creature.name}</span>}
      {dismissed && <span className={styles.badgeMuted}>Dismissed</span>}
      {warning && <span className={styles.badgeWarn}>Check owner</span>}
      {cap !== null && riding && <span className={styles.chip}>{`${record.carriedLb ?? 0}/${cap} lb`}</span>}
      {over && <span className={styles.badgeWarn}>Over capacity</span>}
    </>
  );

  // The spirit type chosen for a familiar or the Otherworldly Steed (Wild
  // Companion is always Fey), else the stat block's own type.
  const spirit = record.origin === 'wild-companion' ? 'Fey' : (record.familiarType ?? record.steedType);
  const primal = record.origin === 'primal-companion';
  const portrait = {
    storeKey: companionPortraitKey(character.id, record.id),
    prompt: {
      subject: 'creature' as const,
      name,
      creatureName: creature.name,
      size: creature.size ?? undefined,
      creatureType: spirit ?? (creature.id === 'otherworldly-steed' ? undefined : (creature.creatureType ?? undefined)),
      // PHB 2024 Beast Master (L5583): the beast bears primal markings showing its supernatural origin.
      flavor: primal ? ['It bears primal markings that show its supernatural origin.'] : undefined,
    },
    appearance: {
      value: record.appearance,
      onChange: (v: string | undefined) => patch({ appearance: v }),
      label: primal ? 'Kind of animal and appearance' : 'Appearance',
      hint: primal ? 'You choose what kind of animal it is, one that fits its stat block (PHB, Beast Master).' : undefined,
    },
  };

  return (
    <RecordCard
      testId={`companion-${record.id}`}
      name={name}
      kind={ORIGIN_LABELS[record.origin]}
      meta={meta}
      hp={cur !== null && hpMax !== null ? { current: cur, max: hpMax } : null}
      muted={dismissed}
      portrait={portrait}
      onDelete={() => onDelete(record.id)}
    >
      {() => (
        <CompanionBody
          record={record}
          character={character}
          name={name}
          hpMax={hpMax}
          ridingOpen={ridingOpen}
          onToggleRiding={() => setRidingOpen((v) => !v)}
          built={{ creature, model, warning, formulaNote, notes }}
          patch={patch}
          onCharacterChange={onCharacterChange}
          down={cur === 0}
        />
      )}
    </RecordCard>
  );
}

interface CompanionBodyProps {
  record: CompanionRecord;
  character: Character;
  name: string;
  hpMax: number | null;
  ridingOpen: boolean;
  onToggleRiding: () => void;
  built: Pick<NonNullable<ReturnType<typeof buildCompanionModel>>, 'creature' | 'model' | 'warning' | 'formulaNote' | 'notes'>;
  patch: (p: Partial<CompanionRecord>) => void;
  onCharacterChange: (next: Character) => void;
  down: boolean;
}

function CompanionBody({ record, character, name, hpMax, ridingOpen, onToggleRiding, built, patch, onCharacterChange, down }: CompanionBodyProps) {
  const { creature, model, warning, formulaNote, notes } = built;
  const casters = resolveClasses(character).filter((r) => entryIsSpellcaster(r.entry));
  const showTypeChoice = record.origin === 'find-familiar' || record.origin === 'pact-of-the-chain';
  const canRide = mountCapacity(creature).capacityLb !== null;
  const ridingId = `companion-${record.id}-riding`;

  return (
    <>
      {warning && (
        <p className={styles.warning} role="alert">
          {warning}
        </p>
      )}

      <div className={styles.row}>
        <label className={styles.field}>
          Nickname
          <BlurInput
            className={styles.control}
            value={record.nickname}
            maxLength={80}
            ariaLabel={`${name} nickname`}
            onCommit={(v) => patch({ nickname: typeof v === 'string' ? v : undefined })}
          />
        </label>
        <label className={styles.checkLabel}>
          <input type="checkbox" checked={record.dismissed === true} onChange={(e) => patch({ dismissed: e.target.checked ? true : undefined })} />
          Dismissed
        </label>
      </div>

      {showTypeChoice && (
        <label className={styles.field}>
          Familiar type
          <select
            className={styles.control}
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
        <div className={styles.row}>
          <label className={styles.field}>
            Spell slot level
            <select
              className={styles.control}
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
          <label className={styles.field}>
            Steed type
            <select
              className={styles.control}
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
            <label className={styles.field}>
              Casting class
              <select
                className={styles.control}
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
        maxBreakdown={model.hp?.breakdown}
        subject={name}
        zeroHpRule={zeroHpRuleKeyForOrigin(record.origin)}
        onPatch={(p) => patch(p)}
      />

      {record.origin === 'primal-companion' && hpMax !== null && (
        <PrimalCompanionActions record={record} character={character} down={down} onCharacterChange={onCharacterChange} />
      )}

      {canRide && (
        <div>
          <button type="button" className={styles.disclosure} aria-expanded={ridingOpen} aria-controls={ridingId} onClick={onToggleRiding}>
            <ChevronDown size={16} aria-hidden="true" className={ridingOpen ? styles.chevronOpen : styles.chevron} />
            Riding & packing
          </button>
          {ridingOpen && (
            <div id={ridingId}>
              <RidingPackingSection details={record} creature={creature} name={name} onPatch={(p) => patch(p)} />
            </div>
          )}
        </div>
      )}

      {formulaNote && <p className={styles.figureLabel}>Formulas (not computed yet): {formulaNote}.</p>}

      <StatBlockView model={model} />

      {notes.length > 0 && (
        <ul className={styles.noteList}>
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <label className={styles.field}>
        Notes
        <textarea
          className={styles.textarea}
          value={record.notes ?? ''}
          maxLength={2000}
          placeholder="Notes..."
          aria-label={`${name} notes`}
          onChange={(e) => patch({ notes: e.target.value || undefined })}
        />
      </label>
    </>
  );
}
