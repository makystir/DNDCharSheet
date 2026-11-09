import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { MountRecord, SaddleKind } from '../../types/character';
import { CREATURE_CATALOG } from '../../data/creatures';
import { ARMOR_LIST, ARMOR_CATALOG } from '../../data/armor';
import {
  BARDING_COST_FACTOR,
  BARDING_WEIGHT_FACTOR,
  bardingCostGp,
  bardingWeightLb,
  capacityStatus,
  mountCapacity,
} from '../../logic/companions';
import { resolveCompanionRuleTooltip, resolveCreatureTooltip } from '../../logic/tooltip-content';
import { CalculatedValue } from '../shared/CalculatedValue';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import { BlurInput } from './BlurInput';
import styles from './CompanionsShared.module.css';

const SADDLES: { id: SaddleKind; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'riding', label: 'Riding saddle' },
  { id: 'military', label: 'Military Saddle' },
  { id: 'exotic', label: 'Exotic Saddle' },
];

export interface MountCardProps {
  record: MountRecord;
  onPatch: (id: string, patch: Partial<MountRecord>) => void;
  onDelete: (id: string) => void;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/**
 * One mount or pack animal. Mirrors the Companions card pattern (collapsed
 * two-line header, expandable body). Capacity comes from the PHB Mounts and
 * Other Animals table (which already includes the Mule's Beast of Burden step);
 * animals without a table row derive Strength x size multiplier. The over
 * capacity warning never blocks and invents no further penalty.
 */
export function MountCard({ record, onPatch, onDelete }: MountCardProps) {
  const [expanded, setExpanded] = useState(false);
  const creature = CREATURE_CATALOG[record.creatureId];
  if (!creature) return null;
  const patch = (p: Partial<MountRecord>) => onPatch(record.id, p);
  const name = record.nickname?.trim() || creature.name;
  const cap = mountCapacity(creature);
  const carried = record.carriedLb ?? 0;
  const status = cap.capacityLb !== null ? capacityStatus(carried, cap.capacityLb) : null;
  const bodyId = `mount-body-${record.id}`;

  const armor = record.bardingArmorId ? ARMOR_CATALOG[record.bardingArmorId] : undefined;
  const baseCost = armor ? armor.costGp : record.bardingCustom?.costGp;
  const baseWeight = armor ? armor.weightLb : record.bardingCustom?.weightLb;
  const hasBarding = baseCost !== undefined && baseWeight !== undefined;

  return (
    <div className={styles.card} data-testid={`mount-${record.id}`}>
      <button type="button" className={styles.header} aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded((v) => !v)}>
        <span className={styles.nameLine}>{name}</span>
        <span className={styles.metaLine}>
          {record.nickname?.trim() && <span className={styles.badge}>{creature.name}</span>}
          {cap.capacityLb !== null && <span className={styles.chip}>{`${fmt(carried)}/${cap.capacityLb} lb`}</span>}
          {status?.over && <span className={styles.badgeWarn}>Over capacity</span>}
          <ChevronDown size={16} aria-hidden="true" className={expanded ? styles.chevronOpen : styles.chevron} />
        </span>
      </button>

      {expanded && (
        <div className={styles.body} id={bodyId}>
          <div className={styles.row}>
            <label className={styles.field}>
              Nickname
              <BlurInput className={styles.control} value={record.nickname} maxLength={80} ariaLabel={`${name} nickname`} onCommit={(v) => patch({ nickname: typeof v === 'string' ? v : undefined })} />
            </label>
            <MaybeContentTooltip content={resolveCreatureTooltip(record.creatureId)} className={styles.chip} ariaLabel={`About ${creature.name}`}>
              {creature.name}
            </MaybeContentTooltip>
          </div>

          <div className={styles.figure}>
            <MaybeContentTooltip content={resolveCompanionRuleTooltip('carrying-capacity')} className={styles.chip} ariaLabel="About carrying capacity">
              Carrying capacity
            </MaybeContentTooltip>
            {cap.capacityLb !== null ? (
              <CalculatedValue label={`${name} carrying capacity`} breakdown={cap.breakdown}>
                {`${cap.capacityLb} lb`}
              </CalculatedValue>
            ) : (
              <span className={styles.figureLabel}>Unknown (the stat block has no size or Strength)</span>
            )}
            {cap.source === 'derived' && <span className={styles.figureLabel}>(derived from Strength and size)</span>}
          </div>

          <div className={styles.row}>
            <label className={styles.field}>
              Weight carried (lb)
              <BlurInput kind="number" min={0} max={1_000_000} className={`${styles.control} ${styles.controlNarrow}`} value={record.carriedLb} ariaLabel={`${name} weight carried`} onCommit={(v) => patch({ carriedLb: typeof v === 'number' ? v : undefined })} />
            </label>
            {status && (
              <span className={styles.figure}>{status.over ? '' : `${fmt(status.remainingLb)} lb remaining`}</span>
            )}
          </div>
          {status?.over && (
            <p className={styles.warning} role="alert">
              {`Over carrying capacity by ${fmt(status.overByLb)} lb. The PHB gives no further penalty; this is only a warning.`}
            </p>
          )}

          <div className={styles.row}>
            <label className={styles.field}>
              Saddle
              <select className={styles.control} value={record.saddle ?? 'none'} aria-label={`${name} saddle`} onChange={(e) => patch({ saddle: e.target.value === 'none' ? undefined : (e.target.value as SaddleKind) })}>
                {SADDLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <MaybeContentTooltip content={resolveCompanionRuleTooltip('saddles')} className={styles.chip} ariaLabel="About saddles">
              Saddle rules
            </MaybeContentTooltip>
          </div>
          {record.saddle === 'military' && <p className={styles.notice}>A Military Saddle gives Advantage on any ability check you make to remain mounted.</p>}
          {record.saddle === 'exotic' && <p className={styles.notice}>An Exotic Saddle is required for riding an aquatic or a flying mount.</p>}

          <div className={styles.row}>
            <label className={styles.field}>
              Barding (armor)
              <select
                className={styles.control}
                value={record.bardingArmorId ?? ''}
                aria-label={`${name} barding armor`}
                onChange={(e) => patch({ bardingArmorId: e.target.value || undefined, ...(e.target.value ? { bardingCustom: undefined } : {}) })}
              >
                <option value="">None</option>
                {ARMOR_LIST.filter((a) => a.category !== 'shield').map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <MaybeContentTooltip content={resolveCompanionRuleTooltip('barding')} className={styles.chip} ariaLabel="About barding">
              Barding rules
            </MaybeContentTooltip>
          </div>
          {hasBarding && (
            <div className={styles.figure}>
              <span className={styles.figureLabel}>Barding cost:</span>
              <CalculatedValue
                label={`${name} barding cost`}
                breakdown={{ total: bardingCostGp(baseCost), components: [{ label: `Normal cost ${fmt(baseCost)} GP x ${BARDING_COST_FACTOR}`, value: bardingCostGp(baseCost) }] }}
              >
                {`${fmt(bardingCostGp(baseCost))} GP`}
              </CalculatedValue>
              <span className={styles.figureLabel}>Barding weight:</span>
              <CalculatedValue
                label={`${name} barding weight`}
                breakdown={{ total: bardingWeightLb(baseWeight), components: [{ label: `Normal weight ${fmt(baseWeight)} lb x ${BARDING_WEIGHT_FACTOR}`, value: bardingWeightLb(baseWeight) }] }}
              >
                {`${fmt(bardingWeightLb(baseWeight))} lb`}
              </CalculatedValue>
              <span className={styles.figureLabel}>(not added to the weight carried)</span>
            </div>
          )}

          <label className={styles.checkLabel}>
            <input type="checkbox" checked={record.pullsVehicle === true} onChange={(e) => patch({ pullsVehicle: e.target.checked ? true : undefined })} />
            Pulls a vehicle
          </label>
          {record.pullsVehicle && (
            <label className={styles.field}>
              Vehicle weight (lb)
              <BlurInput kind="number" min={0} max={1_000_000} className={`${styles.control} ${styles.controlNarrow}`} value={record.vehicleWeightLb} ariaLabel={`${name} vehicle weight`} onCommit={(v) => patch({ vehicleWeightLb: typeof v === 'number' ? v : undefined })} />
            </label>
          )}

          <label className={styles.field}>
            Notes
            <textarea className={styles.textarea} value={record.notes ?? ''} maxLength={2000} placeholder="Notes..." aria-label={`${name} notes`} onChange={(e) => patch({ notes: e.target.value || undefined })} />
          </label>

          <div className={styles.footer}>
            <button type="button" className={styles.deleteBtn} onClick={() => onDelete(record.id)}>
              <Trash2 size={14} aria-hidden="true" /> {`Remove ${name}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
