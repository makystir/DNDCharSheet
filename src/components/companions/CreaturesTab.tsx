import { useState } from 'react';
import { ChevronDown, PawPrint, Plus } from 'lucide-react';
import type { Character, CompanionOrigin, CompanionRecord } from '../../types/character';
import { CREATURE_CATALOG } from '../../data/creatures';
import { companionDisplayName, hasRidingDetails } from '../../logic/companion-model';
import { companionSuggestions } from '../../logic/companion-play';
import { mountCapacity, mountingCostFt, vehicleLoad, VEHICLE_PULL_FACTOR } from '../../logic/companions';
import { getHelpContent } from '../../logic/help-content';
import { speedBreakdown } from '../../logic/species';
import { resolveCompanionRuleTooltip } from '../../logic/tooltip-content';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { CalculatedValue } from '../shared/CalculatedValue';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import { HelpPopover } from '../shared/HelpPopover';
import { CompanionCard } from './CompanionCard';
import { CompanionCreationFlow } from './CompanionCreationFlow';
import { useRecordList } from './useRecordList';
import type { UndoSink } from './useRecordList';
import styles from './CompanionsShared.module.css';

export interface CreaturesTabProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Shows the page's undo toast after a delete. */
  undo: UndoSink;
}

/** A creature that is ridden, packed or listed as a mount or steed: the mounted-combat strip is relevant. */
function isRidingCreature(rec: CompanionRecord): boolean {
  const c = CREATURE_CATALOG[rec.creatureId];
  return hasRidingDetails(rec) || c?.forms.mount === true || c?.forms.steed === true;
}

/**
 * The Creatures sub-tab: every permanent creature the character keeps. Primal
 * Companion, familiars, Otherworldly Steed, Animate Dead servants, and pets,
 * mounts and pack animals (which used to be a separate Mounts tab). One card
 * per creature (CompanionCard), with HP, conditions, the stat block and an
 * optional Riding & packing section. Above the list: the mounted-combat rules
 * strip (PHB L1031-1043, L10372-10401) when any creature is a mount, and the
 * vehicle pull limit when any pulls a vehicle. Dismissed creatures collapse
 * into their own group.
 *
 * Creatures that exist only temporarily from summoning spells are deliberately
 * not tracked (user decision).
 */
export function CreaturesTab({ character, onChange, undo }: CreaturesTabProps) {
  const [creating, setCreating] = useState<CompanionOrigin | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const { list, atMax, patch, add, deleting, requestDelete, cancelDelete, confirmDelete } = useRecordList(
    character,
    onChange,
    undo,
    'companions',
    'Creature removed',
  );

  const active = list.filter((r) => r.dismissed !== true);
  const dismissed = list.filter((r) => r.dismissed === true);

  // Vehicle: several animals pulling one vehicle add their capacities (five
  // times the sum, PHB L10378); the vehicle weight is the largest value entered
  // on a pulling animal, so one vehicle is never counted once per animal.
  const pullers = active.filter((m) => m.pullsVehicle === true);
  const pullerCaps = pullers.flatMap((m) => {
    const c = CREATURE_CATALOG[m.creatureId];
    const lb = c ? mountCapacity(c).capacityLb : null;
    return lb === null ? [] : [{ m, lb }];
  });
  const vehicleWeight = pullers.reduce((max, m) => Math.max(max, m.vehicleWeightLb ?? 0), 0);
  const load = vehicleLoad(pullerCaps.map((p) => p.lb), vehicleWeight, 0);
  const pullBreakdown = {
    total: load.limitLb,
    components: pullerCaps.map((p) => ({
      label: `${companionDisplayName(p.m)} capacity ${p.lb} lb x ${VEHICLE_PULL_FACTOR}`,
      value: p.lb * VEHICLE_PULL_FACTOR,
    })),
    note: 'Five times the sum of the pulling animals\u2019 carrying capacities, including the weight of the vehicle (PHB L10378).',
  };

  const speed = speedBreakdown(character);
  const mountCost = mountingCostFt(speed.total);
  const showMounted = active.some(isRidingCreature);
  // What the character's class features or spells give it that is not on the sheet yet.
  const suggestions = companionSuggestions(character);

  const card = (rec: CompanionRecord) => (
    <CompanionCard key={rec.id} record={rec} character={character} onPatch={patch} onDelete={requestDelete} onCharacterChange={onChange} />
  );

  return (
    <>
      <Card>
        <SectionHeader
          icon={PawPrint}
          title={
            <span className={styles.titleRow}>
              Creatures
              <HelpPopover concept="companions-tab" autoShow={false}>{getHelpContent('companions-tab')}</HelpPopover>
            </span>
          }
          action={
            <button type="button" className={styles.addBtn} disabled={atMax} onClick={() => setCreating('primal-companion')}>
              <Plus size={14} aria-hidden="true" />
              Add Creature
            </button>
          }
        />

        {suggestions.length > 0 && (
          <ul className={styles.suggestions} aria-label="Suggested creatures" data-testid="creature-suggestions">
            {suggestions.map((s) => (
              <li key={s.origin} className={styles.suggestion}>
                <span>
                  <strong>{s.label}</strong>
                  <span className={styles.kindHint}>{s.reason}</span>
                </span>
                <button type="button" className={styles.btn} disabled={atMax} onClick={() => setCreating(s.origin)}>
                  <Plus size={14} aria-hidden="true" />
                  {`Add ${s.label}`}
                </button>
              </li>
            ))}
          </ul>
        )}

        {showMounted && (
          <div className={styles.summary} data-testid="mounted-summary">
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
        )}

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
            heading="No creatures yet"
            description="Add a Primal Companion, a familiar, a steed, or a pet, mount or pack animal. Hirelings, NPC party members and sidekicks are on the People tab."
            tip="Summoned creatures that only last a short time are not tracked here."
          />
        ) : (
          <>
            {active.length > 0 && <div className={styles.list}>{active.map(card)}</div>}
            {dismissed.length > 0 && (
              <>
                <button
                  type="button"
                  className={styles.groupToggle}
                  aria-expanded={showDismissed}
                  aria-controls="creatures-dismissed"
                  onClick={() => setShowDismissed((v) => !v)}
                >
                  <ChevronDown size={16} aria-hidden="true" className={showDismissed ? styles.chevronOpen : styles.chevron} />
                  {`Dismissed (${dismissed.length})`}
                </button>
                {showDismissed && (
                  <div className={styles.list} id="creatures-dismissed">
                    {dismissed.map(card)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Card>

      {creating && (
        <CompanionCreationFlow
          character={character}
          initialOrigin={creating}
          onCancel={() => setCreating(null)}
          onConfirm={(record) => {
            add(record);
            setCreating(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          message={`Remove ${companionDisplayName(deleting)}? You can undo this for a few seconds.`}
          confirmLabel="Remove"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </>
  );
}
