import type { RidingDetails, SaddleKind } from '../../types/character';
import type { CreatureStatBlock } from '../../data/creatures';
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

export interface RidingPackingSectionProps {
  details: RidingDetails;
  creature: CreatureStatBlock;
  /** The tracked name, for labels. */
  name: string;
  onPatch: (patch: Partial<RidingDetails>) => void;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/**
 * Riding and packing details of a creature companion (formerly the Mounts
 * card): carrying capacity, weight carried, saddle, barding and vehicle
 * pulling. PHB 2024 "Mounts and Vehicles" (L10372-10401). Capacity comes from
 * the Mounts and Other Animals table (which already includes the Mule's Beast
 * of Burden step); other creatures derive Strength x size multiplier. The over
 * capacity warning never blocks and invents no further penalty.
 */
export function RidingPackingSection({ details, creature, name, onPatch }: RidingPackingSectionProps) {
  const cap = mountCapacity(creature);
  const carried = details.carriedLb ?? 0;
  const status = cap.capacityLb !== null ? capacityStatus(carried, cap.capacityLb) : null;
  const armor = details.bardingArmorId ? ARMOR_CATALOG[details.bardingArmorId] : undefined;
  const baseCost = armor ? armor.costGp : details.bardingCustom?.costGp;
  const baseWeight = armor ? armor.weightLb : details.bardingCustom?.weightLb;
  const hasBarding = baseCost !== undefined && baseWeight !== undefined;

  return (
    <div className={styles.subsection} data-testid="riding-packing">
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
        <MaybeContentTooltip content={resolveCreatureTooltip(creature.id)} className={styles.chip} ariaLabel={`About ${creature.name}`}>
          {creature.name}
        </MaybeContentTooltip>
      </div>

      <div className={styles.row}>
        <label className={styles.field}>
          Weight carried (lb)
          <BlurInput
            kind="number"
            min={0}
            max={1_000_000}
            className={`${styles.control} ${styles.controlNarrow}`}
            value={details.carriedLb}
            ariaLabel={`${name} weight carried`}
            onCommit={(v) => onPatch({ carriedLb: typeof v === 'number' ? v : undefined })}
          />
        </label>
        {status && !status.over && <span className={styles.figure}>{`${fmt(status.remainingLb)} lb remaining`}</span>}
      </div>
      {status?.over && (
        <p className={styles.warning} role="alert">
          {`Over carrying capacity by ${fmt(status.overByLb)} lb. The PHB gives no further penalty; this is only a warning.`}
        </p>
      )}

      <div className={styles.row}>
        <label className={styles.field}>
          Saddle
          <select
            className={styles.control}
            value={details.saddle ?? 'none'}
            aria-label={`${name} saddle`}
            onChange={(e) => onPatch({ saddle: e.target.value === 'none' ? undefined : (e.target.value as SaddleKind) })}
          >
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
      {details.saddle === 'military' && <p className={styles.notice}>A Military Saddle gives Advantage on any ability check you make to remain mounted.</p>}
      {details.saddle === 'exotic' && <p className={styles.notice}>An Exotic Saddle is required for riding an aquatic or a flying mount.</p>}

      <div className={styles.row}>
        <label className={styles.field}>
          Barding (armor)
          <select
            className={styles.control}
            value={details.bardingArmorId ?? ''}
            aria-label={`${name} barding armor`}
            onChange={(e) => onPatch({ bardingArmorId: e.target.value || undefined, ...(e.target.value ? { bardingCustom: undefined } : {}) })}
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
        <input type="checkbox" checked={details.pullsVehicle === true} onChange={(e) => onPatch({ pullsVehicle: e.target.checked ? true : undefined })} />
        Pulls a vehicle
      </label>
      {details.pullsVehicle && (
        <label className={styles.field}>
          Vehicle weight (lb)
          <BlurInput
            kind="number"
            min={0}
            max={1_000_000}
            className={`${styles.control} ${styles.controlNarrow}`}
            value={details.vehicleWeightLb}
            ariaLabel={`${name} vehicle weight`}
            onCommit={(v) => onPatch({ vehicleWeightLb: typeof v === 'number' ? v : undefined })}
          />
        </label>
      )}
    </div>
  );
}
