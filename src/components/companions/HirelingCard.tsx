import type { CustomStatBlock, HirelingRecord } from '../../types/character';
import {
  clampHirelingUnits,
  effectiveRatePerUnitCp,
  formatCopper,
  hirelingCostBreakdown,
  hirelingRatePerUnitCp,
  hirelingTotalCp,
  hirelingUnitName,
  HIRELING_RATES,
  HIRELING_UNITS_MAX,
  isBelowMinimumRate,
} from '../../logic/companions';
import type { HirelingKind } from '../../logic/companions';
import type { RNG } from '../../logic/random';
import { HIRELING_KIND_LABELS } from '../../logic/companion-model';
import { trackedHpOf } from '../../logic/companions-actions';
import { resolveCompanionRuleTooltip } from '../../logic/tooltip-content';
import { CalculatedValue } from '../shared/CalculatedValue';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import { companionPortraitKey } from '../../storage/companion-portraits';
import { BlurInput } from './BlurInput';
import { CustomStatBlockEditor } from './CustomStatBlockEditor';
import { LoyaltyControl } from './LoyaltyControl';
import { RecordCard } from './RecordCard';
import { TrackedVitals } from './TrackedVitals';
import styles from './CompanionsShared.module.css';

export interface HirelingCardProps {
  record: HirelingRecord;
  /** The owning character's id (portrait store key). */
  ownerId: string;
  /** Present only while the Loyalty house rule is on. */
  loyalty: { max: number } | null;
  onPatch: (id: string, patch: Partial<HirelingRecord>) => void;
  onDelete: (id: string) => void;
  rng?: RNG;
}

/**
 * One hireling (People tab), in the shared RecordCard shell. Deviations (D&D content): pay comes from the PHB
 * services table (2 GP/day skilled, 2 SP/day untrained, 2 CP/mile messenger)
 * instead of upkeep; the 12-characteristic grid is the 2024 stat block, which
 * starts EMPTY and is typed in by hand (the PHB gives hirelings no stats).
 */
export function HirelingCard({ record, ownerId, loyalty, onPatch, onDelete, rng }: HirelingCardProps) {
  const patch = (p: Partial<HirelingRecord>) => onPatch(record.id, p);
  const unit = hirelingUnitName(record.kind);
  const units = clampHirelingUnits(record.units);
  const rate = effectiveRatePerUnitCp(record);
  const total = hirelingTotalCp(record);
  const below = isBelowMinimumRate(record);
  const hpMax = record.stats?.hpMax !== undefined && record.stats.hpMax > 0 ? record.stats.hpMax : null;

  const rateBreakdown = {
    total: rate,
    components: [{ label: record.customRateCp !== undefined ? 'Rate you entered' : 'Table rate (PHB)', value: rate }],
  };

  return (
    <RecordCard
      testId={`hireling-${record.id}`}
      name={record.name}
      kind={HIRELING_KIND_LABELS[record.kind]}
      meta={<span className={styles.chip}>{`${units} ${unit}${units === 1 ? '' : 's'}: ${formatCopper(total)}`}</span>}
      hp={hpMax !== null ? { current: trackedHpOf(record, hpMax), max: hpMax } : null}
      portrait={{
        storeKey: companionPortraitKey(ownerId, record.id),
        prompt: { subject: 'person', name: record.name, role: HIRELING_KIND_LABELS[record.kind], size: record.stats?.size, creatureType: record.stats?.creatureType },
        appearance: { value: record.appearance, onChange: (v) => patch({ appearance: v }) },
      }}
      onDelete={() => onDelete(record.id)}
    >
      {() => (
        <>
          <div className={styles.row}>
            <label className={styles.field}>
              Name
              <BlurInput className={styles.control} value={record.name} maxLength={80} ariaLabel={`Hireling ${record.name} name`} onCommit={(v) => typeof v === 'string' && patch({ name: v })} />
            </label>
            <label className={styles.field}>
              Kind
              <select
                className={styles.control}
                value={record.kind}
                aria-label={`${record.name} kind`}
                onChange={(e) => patch({ kind: e.target.value as HirelingKind })}
              >
                {(Object.keys(HIRELING_KIND_LABELS) as HirelingKind[]).map((k) => (
                  <option key={k} value={k}>
                    {`${HIRELING_KIND_LABELS[k]} (${HIRELING_RATES[k].printed})`}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              {unit === 'day' ? 'Days hired' : 'Miles'}
              <BlurInput
                kind="number"
                min={0}
                max={HIRELING_UNITS_MAX}
                className={`${styles.control} ${styles.controlNarrow}`}
                value={record.units}
                ariaLabel={`${record.name} ${unit === 'day' ? 'days' : 'miles'}`}
                onCommit={(v) => patch({ units: typeof v === 'number' ? clampHirelingUnits(v) : 0 })}
              />
            </label>
            <label className={styles.field}>
              {`Your pay per ${unit} (CP, optional)`}
              <BlurInput
                kind="number"
                min={0}
                max={10_000_000}
                className={`${styles.control} ${styles.controlNarrow}`}
                value={record.customRateCp}
                placeholder={String(hirelingRatePerUnitCp(record.kind))}
                ariaLabel={`${record.name} pay per ${unit} in copper`}
                onCommit={(v) => patch({ customRateCp: typeof v === 'number' ? v : undefined })}
              />
            </label>
          </div>

          <div className={styles.figure}>
            <MaybeContentTooltip content={resolveCompanionRuleTooltip('hireling-services')} className={styles.chip} ariaLabel="About hireling pay">
              Hireling pay
            </MaybeContentTooltip>
            <span className={styles.figureLabel}>{`Per ${unit}:`}</span>
            <CalculatedValue label={`${record.name} pay per ${unit}`} breakdown={rateBreakdown}>
              {formatCopper(rate)}
            </CalculatedValue>
            <span className={styles.figureLabel}>Total:</span>
            <CalculatedValue label={`${record.name} total cost`} breakdown={hirelingCostBreakdown(record)}>
              {formatCopper(total)}
            </CalculatedValue>
          </div>
          {below && (
            <p className={styles.warning} role="status">
              {`The table pay (${HIRELING_RATES[record.kind].printed}) is a minimum; your rate is lower. This is only a warning.`}
            </p>
          )}

          <TrackedVitals
            record={record}
            max={hpMax}
            subject={record.name}
            zeroHpRule="monster-death"
            onPatch={(p) => patch(p)}
          />

          {loyalty && <LoyaltyControl score={record.loyalty} max={loyalty.max} subject={record.name} onChange={(s) => patch({ loyalty: s })} rng={rng} />}

          <CustomStatBlockEditor
            subject={record.name}
            stats={record.stats}
            onChange={(stats: CustomStatBlock | undefined) => patch({ stats })}
          />

          <label className={styles.field}>
            Notes
            <textarea
              className={styles.textarea}
              value={record.notes ?? ''}
              maxLength={2000}
              placeholder="Notes..."
              aria-label={`${record.name} notes`}
              onChange={(e) => patch({ notes: e.target.value || undefined })}
            />
          </label>

        </>
      )}
    </RecordCard>
  );
}
