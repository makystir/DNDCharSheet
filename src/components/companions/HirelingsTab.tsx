import { useState } from 'react';
import { Briefcase, Plus } from 'lucide-react';
import type { Character, HirelingRecord } from '../../types/character';
import { loyaltyEnabled, loyaltyMaximumFor, setLoyaltyMaxOverride } from '../../logic/companions-actions';
import {
  clampHirelingUnits,
  formatCopper,
  HIRELING_RATES,
  HIRELING_UNITS_MAX,
  hirelingTotalCp,
  hirelingsTotalCp,
  hirelingUnitName,
} from '../../logic/companions';
import type { HirelingKind } from '../../logic/companions';
import type { RNG } from '../../logic/random';
import { generateUUID } from '../../logic/uuid';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { CalculatedValue } from '../shared/CalculatedValue';
import { AddDialog } from './AddDialog';
import { HirelingCard } from './HirelingCard';
import { HIRELING_KIND_LABELS } from '../../logic/companion-model';
import { LoyaltyMaximumField } from './LoyaltyControl';
import { useRecordList } from './useRecordList';
import type { UndoSink } from './CompanionsTab';
import dialogStyles from './CompanionCreationFlow.module.css';
import styles from './CompanionsShared.module.css';

export interface HirelingsTabProps {
  character: Character;
  onChange: (next: Character) => void;
  undo: UndoSink;
  /** Random source for Loyalty rolls (injected in tests). */
  rng?: RNG;
}

/**
 * The Hirelings sub-tab (PHB 2024 services table, L10523-10533). Mirrors the
 * WFRP Retinue "Hirelings" tab: Card + SectionHeader with an add button, an
 * EmptyState, a list of cards and delete with an undo toast. Deviations: costs
 * come from the PHB table and a running total for all hirelings is shown; each
 * hireling has an editable (never pre-filled) stat block; optional Loyalty.
 */
export function HirelingsTab({ character, onChange, undo, rng }: HirelingsTabProps) {
  const [creating, setCreating] = useState(false);
  const { list, atMax, patch, add, deleting, requestDelete, cancelDelete, confirmDelete } = useRecordList(
    character,
    onChange,
    undo,
    'hirelings',
    'Hireling removed',
  );
  const loyaltyOn = loyaltyEnabled(character);
  const loyalty = loyaltyMaximumFor(character);

  const totalCp = hirelingsTotalCp(list);
  const totalBreakdown = {
    total: totalCp,
    components: list.map((h) => ({ label: `${h.name} (${formatCopper(hirelingTotalCp(h))})`, value: hirelingTotalCp(h) })),
    note: `Amounts in copper pieces (1 GP = 100 CP, 1 SP = 10 CP). Total ${formatCopper(totalCp)}.`,
  };

  return (
    <>
      <Card>
        <SectionHeader
          icon={Briefcase}
          title="Hirelings"
          action={
            <button type="button" className={styles.addBtn} disabled={atMax} onClick={() => setCreating(true)}>
              <Plus size={14} aria-hidden="true" />
              Add Hireling
            </button>
          }
        />

        {list.length > 0 && (
          <div className={styles.summary}>
            <span className={styles.summaryTitle}>Hirelings running total</span>
            <CalculatedValue label="Total for all hirelings" breakdown={totalBreakdown}>
              {formatCopper(totalCp)}
            </CalculatedValue>
          </div>
        )}

        {loyaltyOn && (
          <LoyaltyMaximumField
            max={loyalty.max}
            breakdown={loyalty.breakdown}
            override={character.loyaltyMaxOverride}
            onOverride={(v) => onChange(setLoyaltyMaxOverride(character, v))}
          />
        )}

        {list.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            heading="No hirelings yet"
            description="Track skilled hirelings, untrained hirelings and messengers with their pay from the PHB services table."
            tip="A hireling's stat block is not in the PHB. Open a hireling and use Edit stat block to enter a Monster Manual stat block (a Guard or Scout, for example) by hand. Templates will come later."
          />
        ) : (
          <div className={styles.list}>
            {list.map((rec) => (
              <HirelingCard
                key={rec.id}
                record={rec}
                loyalty={loyaltyOn ? { max: loyalty.max } : null}
                onPatch={patch}
                onDelete={requestDelete}
                rng={rng}
              />
            ))}
          </div>
        )}
      </Card>

      {creating && (
        <HirelingCreationFlow
          onCancel={() => setCreating(false)}
          onConfirm={(record) => {
            add(record);
            setCreating(false);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          message={`Remove ${deleting.name}? You can undo this for a few seconds.`}
          confirmLabel="Remove"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </>
  );
}

function HirelingCreationFlow({ onConfirm, onCancel }: { onConfirm: (record: HirelingRecord) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<HirelingKind>('skilled');
  const [name, setName] = useState('');
  const [units, setUnits] = useState('1');
  const unit = hirelingUnitName(kind);

  const confirm = () => {
    const n = name.trim().slice(0, 80);
    if (!n) return;
    const parsed = Number.parseInt(units, 10);
    onConfirm({ id: generateUUID(), name: n, kind, units: Number.isFinite(parsed) ? clampHirelingUnits(parsed) : 0 });
  };

  return (
    <AddDialog title="Add hireling" confirmLabel="Add hireling" confirmDisabled={name.trim() === ''} onConfirm={confirm} onCancel={onCancel}>
      <label className={dialogStyles.field}>
        Kind
        <select className={dialogStyles.control} value={kind} onChange={(e) => setKind(e.target.value as HirelingKind)}>
          {(Object.keys(HIRELING_KIND_LABELS) as HirelingKind[]).map((k) => (
            <option key={k} value={k}>
              {`${HIRELING_KIND_LABELS[k]} (${HIRELING_RATES[k].printed})`}
            </option>
          ))}
        </select>
      </label>
      <label className={dialogStyles.field}>
        Name
        <input type="text" className={dialogStyles.control} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={dialogStyles.field}>
        {unit === 'day' ? 'Days hired' : 'Miles'}
        <input
          type="number"
          className={dialogStyles.control}
          min={0}
          max={HIRELING_UNITS_MAX}
          value={units}
          onChange={(e) => setUnits(e.target.value)}
        />
      </label>
    </AddDialog>
  );
}
