import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import type { Character, SidekickRecord } from '../../types/character';
import { CREATURE_CATALOG } from '../../data/creatures';
import { loyaltyEnabled, loyaltyMaximumFor, setLoyaltyMaxOverride, sidekicksEnabled } from '../../logic/companions-actions';
import { formatCopper, hirelingsTotalCp, hirelingTotalCp } from '../../logic/companions';
import { NPC_TEMPLATES } from '../../logic/companion-model';
import type { NpcTemplate } from '../../logic/companion-model';
import type { RNG } from '../../logic/random';
import { resolveCompanionRuleTooltip } from '../../logic/tooltip-content';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { CalculatedValue } from '../shared/CalculatedValue';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import { AddDialog } from './AddDialog';
import { HirelingCard } from './HirelingCard';
import { LoyaltyMaximumField } from './LoyaltyControl';
import { NpcMemberCard } from './NpcMemberCard';
import { HirelingCreationFlow, NpcCreationFlow, SidekickCreationFlow } from './PeopleCreationFlows';
import { EDITION_MARK, SidekickCard } from './SidekickCard';
import { useRecordList } from './useRecordList';
import type { UndoSink } from './useRecordList';
import styles from './CompanionsShared.module.css';

/** Which people the People tab lists. */
export type PeopleFilter = 'all' | 'hirelings' | 'npc' | 'sidekicks';
type PersonKind = Exclude<PeopleFilter, 'all'>;

export interface PeopleTabProps {
  character: Character;
  onChange: (next: Character) => void;
  undo: UndoSink;
  filter: PeopleFilter;
  onFilterChange: (filter: PeopleFilter) => void;
  /** Templates offered when adding an NPC party member; defaults to the (currently empty) catalog. */
  templates?: readonly NpcTemplate[];
  /** Random source for Loyalty and Hit Die rolls (injected in tests). */
  rng?: RNG;
}

const KIND_LABELS: Record<PersonKind, { plural: string; add: string; hint: string }> = {
  hirelings: { plural: 'Hirelings', add: 'Add Hireling', hint: 'Paid help from the PHB services table: skilled, untrained or a messenger.' },
  npc: { plural: 'NPC party members', add: 'Add NPC Party Member', hint: 'An NPC who travels with the party (DMG). Enter a Monster Manual stat block.' },
  sidekicks: { plural: 'Sidekicks', add: 'Add Sidekick', hint: `A friendly creature that gains a sidekick class (${EDITION_MARK}).` },
};

function sidekickName(rec: SidekickRecord): string {
  return rec.nickname?.trim() || CREATURE_CATALOG[rec.creatureId]?.name || 'this sidekick';
}

/**
 * The People sub-tab: everyone (rather than every creature) who travels with or
 * works for the character. Hirelings (PHB 2024 services table, L10523-10533),
 * NPC party members (DMG 2024 L833, L3553-3557) and, while the Tasha's house
 * rule is on, sidekicks. The three record types stay separate in the data; the
 * tab lists them together with filter chips. Each card uses the shared
 * RecordCard shell. The Loyalty maximum (DMG optional rule) is shown once, and
 * the hireling pay total sits in its own strip.
 */
export function PeopleTab({ character, onChange, undo, filter, onFilterChange, templates = NPC_TEMPLATES, rng }: PeopleTabProps) {
  const [creating, setCreating] = useState<PersonKind | 'choose' | null>(null);
  const hirelings = useRecordList(character, onChange, undo, 'hirelings', 'Hireling removed');
  const npcs = useRecordList(character, onChange, undo, 'npcPartyMembers', 'NPC party member removed');
  const sidekicks = useRecordList(character, onChange, undo, 'sidekicks', 'Sidekick removed');
  const sidekicksOn = sidekicksEnabled(character);
  const loyaltyOn = loyaltyEnabled(character);
  const loyalty = loyaltyMaximumFor(character);

  // A Sidekicks filter left over from when the house rule was on falls back to All.
  const shown: PeopleFilter = filter === 'sidekicks' && !sidekicksOn ? 'all' : filter;
  const kinds: PersonKind[] = sidekicksOn ? ['hirelings', 'npc', 'sidekicks'] : ['hirelings', 'npc'];
  const lists = { hirelings, npc: npcs, sidekicks };
  const counts: Record<PersonKind, number> = {
    hirelings: hirelings.list.length,
    npc: npcs.list.length,
    sidekicks: sidekicksOn ? sidekicks.list.length : 0,
  };
  const total = kinds.reduce((sum, k) => sum + counts[k], 0);
  const visibleKinds = shown === 'all' ? kinds : [shown];
  const visibleCount = visibleKinds.reduce((sum, k) => sum + counts[k], 0);

  const addLabel = shown === 'all' ? 'Add Person' : KIND_LABELS[shown].add;
  const addDisabled = shown === 'all' ? kinds.every((k) => lists[k].atMax) : lists[shown].atMax;

  const totalCp = hirelingsTotalCp(hirelings.list);
  const totalBreakdown = {
    total: totalCp,
    components: hirelings.list.map((h) => ({ label: `${h.name} (${formatCopper(hirelingTotalCp(h))})`, value: hirelingTotalCp(h) })),
    note: `Amounts in copper pieces (1 GP = 100 CP, 1 SP = 10 CP). Total ${formatCopper(totalCp)}.`,
  };

  const loyaltyCard = { max: loyalty.max };
  const renderKind = (kind: PersonKind) => {
    if (kind === 'hirelings') {
      return hirelings.list.map((rec) => (
        <HirelingCard key={rec.id} record={rec} loyalty={loyaltyOn ? loyaltyCard : null} onPatch={hirelings.patch} onDelete={hirelings.requestDelete} rng={rng} />
      ));
    }
    if (kind === 'npc') {
      return npcs.list.map((rec) => (
        <NpcMemberCard
          key={rec.id}
          record={rec}
          partyLevel={character.level}
          loyalty={loyaltyOn ? loyaltyCard : null}
          onPatch={npcs.patch}
          onDelete={npcs.requestDelete}
          rng={rng}
        />
      ));
    }
    return sidekicks.list.map((rec) => (
      <SidekickCard key={rec.id} record={rec} character={character} onPatch={sidekicks.patch} onDelete={sidekicks.requestDelete} rng={rng} />
    ));
  };

  const empty = {
    all: { heading: 'No people yet', description: 'Add a hireling or an NPC party member who travels with you. Creatures (companions, mounts, pets) are on the Creatures tab.' },
    hirelings: { heading: 'No hirelings yet', description: 'Track skilled hirelings, untrained hirelings and messengers with their pay from the PHB services table.' },
    npc: { heading: 'No NPC party members yet', description: 'Add an NPC who travels with the party.' },
    sidekicks: { heading: 'No sidekicks yet', description: 'Turn a friendly creature with a challenge rating of 1/2 or lower into an Expert, Spellcaster or Warrior sidekick.' },
  }[shown];

  return (
    <>
      <Card>
        <SectionHeader
          icon={Users}
          title="People"
          action={
            <button type="button" className={styles.addBtn} disabled={addDisabled} onClick={() => setCreating(shown === 'all' ? 'choose' : shown)}>
              <Plus size={14} aria-hidden="true" />
              {addLabel}
            </button>
          }
        />

        <div className={styles.filters} role="group" aria-label="Show">
          <button type="button" className={styles.filterChip} aria-pressed={shown === 'all'} onClick={() => onFilterChange('all')}>
            {`All (${total})`}
          </button>
          {kinds.map((k) => (
            <button key={k} type="button" className={styles.filterChip} aria-pressed={shown === k} onClick={() => onFilterChange(k)}>
              {`${KIND_LABELS[k].plural} (${counts[k]})`}
            </button>
          ))}
        </div>

        {hirelings.list.length > 0 && (shown === 'all' || shown === 'hirelings') && (
          <div className={styles.summary}>
            <span className={styles.summaryTitle}>Hirelings running total</span>
            <CalculatedValue label="Total for all hirelings" breakdown={totalBreakdown}>
              {formatCopper(totalCp)}
            </CalculatedValue>
          </div>
        )}

        {loyaltyOn && shown !== 'sidekicks' && (
          <LoyaltyMaximumField
            max={loyalty.max}
            breakdown={loyalty.breakdown}
            override={character.loyaltyMaxOverride}
            onOverride={(v) => onChange(setLoyaltyMaxOverride(character, v))}
          />
        )}

        {shown === 'npc' && (
          <p className={styles.banner}>
            DMG 2024: choose a Monster Manual stat block whose Challenge Rating is no higher than half the characters&apos; level.
            These NPCs don&apos;t gain XP and don&apos;t become more powerful.
          </p>
        )}
        {shown === 'sidekicks' && (
          <p className={styles.banner}>
            <MaybeContentTooltip content={resolveCompanionRuleTooltip('sidekick-edition')} className={styles.badge} ariaLabel="About sidekicks and their edition">
              {EDITION_MARK}
            </MaybeContentTooltip>{' '}
            Optional rule. A sidekick is a creature with a challenge rating of 1/2 or lower that gains a sidekick class.
          </p>
        )}

        {visibleCount === 0 ? (
          <EmptyState
            icon={Users}
            heading={empty.heading}
            description={empty.description}
            tip="A hireling's or NPC's stat block is not in the PHB. Open one and use Edit stat block to enter a Monster Manual stat block (a Guard or Scout, for example) by hand. Templates will come later."
          />
        ) : shown === 'all' ? (
          kinds
            .filter((k) => counts[k] > 0)
            .map((k) => (
              <section key={k} aria-label={KIND_LABELS[k].plural}>
                <h4 className={styles.groupHeading}>{`${KIND_LABELS[k].plural} (${counts[k]})`}</h4>
                <div className={styles.list}>{renderKind(k)}</div>
              </section>
            ))
        ) : (
          <div className={styles.list}>{renderKind(shown)}</div>
        )}
      </Card>

      {creating === 'choose' && (
        <KindChooser
          kinds={kinds.filter((k) => !lists[k].atMax)}
          onCancel={() => setCreating(null)}
          onChoose={(k) => setCreating(k)}
        />
      )}
      {creating === 'hirelings' && (
        <HirelingCreationFlow
          onCancel={() => setCreating(null)}
          onConfirm={(record) => {
            hirelings.add(record);
            setCreating(null);
          }}
        />
      )}
      {creating === 'npc' && (
        <NpcCreationFlow
          templates={templates}
          onCancel={() => setCreating(null)}
          onConfirm={(record) => {
            npcs.add(record);
            setCreating(null);
          }}
        />
      )}
      {creating === 'sidekicks' && (
        <SidekickCreationFlow
          character={character}
          onCancel={() => setCreating(null)}
          onConfirm={(record) => {
            sidekicks.add(record);
            setCreating(null);
          }}
        />
      )}

      {hirelings.deleting && (
        <ConfirmDialog
          message={`Remove ${hirelings.deleting.name}? You can undo this for a few seconds.`}
          confirmLabel="Remove"
          onConfirm={hirelings.confirmDelete}
          onCancel={hirelings.cancelDelete}
        />
      )}
      {npcs.deleting && (
        <ConfirmDialog
          message={`Remove ${npcs.deleting.name}? You can undo this for a few seconds.`}
          confirmLabel="Remove"
          onConfirm={npcs.confirmDelete}
          onCancel={npcs.cancelDelete}
        />
      )}
      {sidekicks.deleting && (
        <ConfirmDialog
          message={`Remove ${sidekickName(sidekicks.deleting)}? You can undo this for a few seconds.`}
          confirmLabel="Remove"
          onConfirm={sidekicks.confirmDelete}
          onCancel={sidekicks.cancelDelete}
        />
      )}
    </>
  );
}

/** "What are you adding?" step for the All view's Add Person button. */
function KindChooser({ kinds, onChoose, onCancel }: { kinds: PersonKind[]; onChoose: (k: PersonKind) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<PersonKind | undefined>(kinds[0]);
  return (
    <AddDialog title="Add a person" confirmLabel="Next" confirmDisabled={!kind} onConfirm={() => kind && onChoose(kind)} onCancel={onCancel}>
      <fieldset className={styles.kindList}>
        <legend className={styles.srOnly}>Kind of person</legend>
        {kinds.map((k) => (
          <label key={k} className={styles.kindOption}>
            <input type="radio" name="person-kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
            <span>
              {KIND_LABELS[k].plural.replace(/s$/, '')}
              <span className={styles.kindHint}>{KIND_LABELS[k].hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </AddDialog>
  );
}
