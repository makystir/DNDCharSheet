import { useState } from 'react';
import { PawPrint, Plus } from 'lucide-react';
import type { Character, MountRecord } from '../../types/character';
import { CREATURE_LIST } from '../../data/creatures';
import { mountCapacity, mountingCostFt, vehicleLoad, VEHICLE_PULL_FACTOR } from '../../logic/companions';
import { speedBreakdown } from '../../logic/species';
import { resolveCompanionRuleTooltip } from '../../logic/tooltip-content';
import { generateUUID } from '../../logic/uuid';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { CalculatedValue } from '../shared/CalculatedValue';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import { AddDialog } from './AddDialog';
import { MountCard } from './MountCard';
import { useRecordList } from './useRecordList';
import type { UndoSink } from './CompanionsTab';
import dialogStyles from './CompanionCreationFlow.module.css';
import styles from './CompanionsShared.module.css';

export interface MountsTabProps {
  character: Character;
  onChange: (next: Character) => void;
  undo: UndoSink;
}

const TABLE_ANIMALS = CREATURE_LIST.filter((c) => c.mountTable);
const OTHER_ANIMALS = CREATURE_LIST.filter((c) => !c.mountTable && c.size !== null && c.abilities.str.score !== null);

/**
 * The Mounts & Animals sub-tab (PHB 2024 "Mounts and Vehicles", L10372-10401, and
 * "Mounted Combat", L1031-1043). Same list-of-cards shape as the other tabs.
 * Several animals pulling one vehicle add their capacities (five times the sum);
 * the vehicle weight used is the largest value entered on a pulling animal, so a
 * single vehicle is never counted once per animal.
 */
export function MountsTab({ character, onChange, undo }: MountsTabProps) {
  const [creating, setCreating] = useState(false);
  const { list, atMax, patch, add, deleting, requestDelete, cancelDelete, confirmDelete } = useRecordList(
    character,
    onChange,
    undo,
    'mounts',
    'Mount removed',
  );

  const pullers = list.filter((m) => m.pullsVehicle === true);
  const pullerCaps = pullers.flatMap((m) => {
    const c = CREATURE_LIST.find((x) => x.id === m.creatureId);
    const lb = c ? mountCapacity(c).capacityLb : null;
    return lb === null ? [] : [{ m, lb }];
  });
  const vehicleWeight = pullers.reduce((max, m) => Math.max(max, m.vehicleWeightLb ?? 0), 0);
  const load = vehicleLoad(pullerCaps.map((p) => p.lb), vehicleWeight, 0);
  const pullBreakdown = {
    total: load.limitLb,
    components: [
      ...pullerCaps.map((p) => ({
        label: `${p.m.nickname?.trim() || CREATURE_LIST.find((x) => x.id === p.m.creatureId)?.name} capacity ${p.lb} lb x ${VEHICLE_PULL_FACTOR}`,
        value: p.lb * VEHICLE_PULL_FACTOR,
      })),
    ],
    note: 'Five times the sum of the pulling animals\u2019 carrying capacities, including the weight of the vehicle (PHB L10378).',
  };

  const speed = speedBreakdown(character);
  const mountCost = mountingCostFt(speed.total);

  return (
    <>
      <Card>
        <SectionHeader
          icon={PawPrint}
          title="Mounts & Animals"
          action={
            <button type="button" className={styles.addBtn} disabled={atMax} onClick={() => setCreating(true)}>
              <Plus size={14} aria-hidden="true" />
              Add Mount or Animal
            </button>
          }
        />

        <div className={styles.summary}>
          <span className={styles.summaryTitle}>Mounted combat</span>
          <MaybeContentTooltip content={resolveCompanionRuleTooltip('mounted-combat')} className={styles.chip}>
            Mounted combat
          </MaybeContentTooltip>
          <MaybeContentTooltip content={resolveCompanionRuleTooltip('mount-dismount')} className={styles.chip}>
            Mounting and dismounting
          </MaybeContentTooltip>
          <MaybeContentTooltip content={resolveCompanionRuleTooltip('controlled-mount')} className={styles.chip}>
            Controlling a mount
          </MaybeContentTooltip>
          <span className={styles.figureLabel}>Mount or dismount costs:</span>
          <CalculatedValue
            label="Mounting movement cost"
            breakdown={{
              total: mountCost,
              components: [{ label: `Half your Speed (${speed.total} ft), rounded down`, value: mountCost }],
            }}
          >
            {`${mountCost} ft`}
          </CalculatedValue>
        </div>

        {pullers.length > 0 && (
          <div className={styles.summary} data-testid="vehicle-summary">
            <span className={styles.summaryTitle}>
              <MaybeContentTooltip content={resolveCompanionRuleTooltip('vehicle-pull')} ariaLabel="About pulling a vehicle">
                Vehicle
              </MaybeContentTooltip>
            </span>
            <span className={styles.figureLabel}>Pull limit:</span>
            <CalculatedValue label="Vehicle pull limit" breakdown={pullBreakdown}>
              {`${load.limitLb} lb`}
            </CalculatedValue>
            <span className={styles.figureLabel}>Vehicle weight:</span>
            <span>{`${load.usedLb} lb`}</span>
            <span className={styles.figureLabel}>Cargo left:</span>
            <span>{`${load.remainingLb} lb`}</span>
            {load.over && (
              <span className={styles.warning} role="alert">
                {`The vehicle is over the pull limit by ${load.overByLb} lb.`}
              </span>
            )}
          </div>
        )}

        {list.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            heading="No mounts or pack animals yet"
            description="Add a mount or pack animal to track its carrying capacity, barding and saddle."
            tip="Mounts that need Hit Points or a full stat block can also be added on the Companions tab as a pet or mount."
          />
        ) : (
          <div className={styles.list}>
            {list.map((rec) => (
              <MountCard key={rec.id} record={rec} onPatch={patch} onDelete={requestDelete} />
            ))}
          </div>
        )}
      </Card>

      {creating && (
        <MountCreationFlow
          onCancel={() => setCreating(false)}
          onConfirm={(record) => {
            add(record);
            setCreating(false);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          message={`Remove ${deleting.nickname?.trim() || CREATURE_LIST.find((c) => c.id === deleting.creatureId)?.name || 'this animal'}? You can undo this for a few seconds.`}
          confirmLabel="Remove"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </>
  );
}

function MountCreationFlow({ onConfirm, onCancel }: { onConfirm: (record: MountRecord) => void; onCancel: () => void }) {
  const [creatureId, setCreatureId] = useState(TABLE_ANIMALS[0]?.id ?? '');
  const [nickname, setNickname] = useState('');

  const confirm = () => {
    if (!creatureId) return;
    const record: MountRecord = { id: generateUUID(), creatureId };
    const nick = nickname.trim().slice(0, 80);
    if (nick) record.nickname = nick;
    onConfirm(record);
  };

  return (
    <AddDialog title="Add mount or animal" confirmLabel="Add animal" confirmDisabled={!creatureId} onConfirm={confirm} onCancel={onCancel}>
      <label className={dialogStyles.field}>
        Animal
        <select className={dialogStyles.control} value={creatureId} onChange={(e) => setCreatureId(e.target.value)}>
          <optgroup label="Mounts and Other Animals table">
            {TABLE_ANIMALS.map((c) => (
              <option key={c.id} value={c.id}>
                {`${c.name} (${c.mountTable?.carryingCapacityLb} lb)`}
              </option>
            ))}
          </optgroup>
          <optgroup label="Other animals (capacity derived)">
            {OTHER_ANIMALS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label className={dialogStyles.field}>
        Nickname (optional)
        <input type="text" className={dialogStyles.control} value={nickname} maxLength={80} onChange={(e) => setNickname(e.target.value)} />
      </label>
    </AddDialog>
  );
}
