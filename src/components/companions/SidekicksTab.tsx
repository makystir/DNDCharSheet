import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import type { Character, SidekickRecord } from '../../types/character';
import { CREATURE_LIST } from '../../data/creatures';
import { SIDEKICK_CLASSES, SIDEKICK_CLASS_IDS, SIDEKICK_MAX_LEVEL, SIDEKICK_MIN_LEVEL } from '../../data/sidekicks';
import type { SidekickClassId } from '../../data/sidekicks';
import { sidekickEligibility } from '../../logic/sidekick';
import { sidekickDefaultStartLevel } from '../../logic/companions';
import { resolveCompanionRuleTooltip } from '../../logic/tooltip-content';
import type { RNG } from '../../logic/random';
import { generateUUID } from '../../logic/uuid';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import { AddDialog } from './AddDialog';
import { EDITION_MARK, SidekickCard } from './SidekickCard';
import { useRecordList } from './useRecordList';
import type { UndoSink } from './CompanionsTab';
import dialogStyles from './CompanionCreationFlow.module.css';
import styles from './CompanionsShared.module.css';

export interface SidekicksTabProps {
  character: Character;
  onChange: (next: Character) => void;
  undo: UndoSink;
  rng?: RNG;
}

/**
 * The Sidekicks sub-tab. The page shows it only while the `sidekicks` house rule
 * is on. Tasha's Cauldron of Everything (2020), a 2014-edition (5e) optional
 * rule: every label and tooltip carries the "Tasha's 2020 (5e, 2014 rules)" mark.
 */
export function SidekicksTab({ character, onChange, undo, rng }: SidekicksTabProps) {
  const [creating, setCreating] = useState(false);
  const { list, atMax, patch, add, deleting, requestDelete, cancelDelete, confirmDelete } = useRecordList(
    character,
    onChange,
    undo,
    'sidekicks',
    'Sidekick removed',
  );

  return (
    <>
      <Card>
        <SectionHeader
          icon={Users}
          title={
            <span className={styles.titleRow}>
              Sidekicks
              <MaybeContentTooltip content={resolveCompanionRuleTooltip('sidekick-edition')} className={styles.badge} ariaLabel="About sidekicks and their edition">
                {EDITION_MARK}
              </MaybeContentTooltip>
            </span>
          }
          action={
            <button type="button" className={styles.addBtn} disabled={atMax} onClick={() => setCreating(true)}>
              <Plus size={14} aria-hidden="true" />
              Add Sidekick
            </button>
          }
        />
        <p className={styles.banner}>
          {`${EDITION_MARK}. Optional rule. A sidekick is a creature with a challenge rating of 1/2 or lower that gains a sidekick class.`}
        </p>

        {list.length === 0 ? (
          <EmptyState
            icon={Users}
            heading="No sidekicks yet"
            description="Turn a friendly creature with a challenge rating of 1/2 or lower into an Expert, Spellcaster or Warrior sidekick."
          />
        ) : (
          <div className={styles.list}>
            {list.map((rec) => (
              <SidekickCard key={rec.id} record={rec} character={character} onPatch={patch} onDelete={requestDelete} rng={rng} />
            ))}
          </div>
        )}
      </Card>

      {creating && (
        <SidekickCreationFlow
          character={character}
          onCancel={() => setCreating(false)}
          onConfirm={(record) => {
            add(record);
            setCreating(false);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          message={`Remove this sidekick? You can undo this for a few seconds.`}
          confirmLabel="Remove"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </>
  );
}

function SidekickCreationFlow({
  character,
  onConfirm,
  onCancel,
}: {
  character: Character;
  onConfirm: (record: SidekickRecord) => void;
  onCancel: () => void;
}) {
  const [classId, setClassId] = useState<SidekickClassId>('warrior');
  const [creatureId, setCreatureId] = useState(() => CREATURE_LIST.find((c) => sidekickEligibility(c, 'warrior').eligible)?.id ?? CREATURE_LIST[0].id);
  const [level, setLevel] = useState(String(sidekickDefaultStartLevel(character.level)));
  const [hpInput, setHpInput] = useState<string | null>(null);

  const creature = CREATURE_LIST.find((c) => c.id === creatureId) ?? CREATURE_LIST[0];
  const eligibility = sidekickEligibility(creature, classId);
  const parsedLevel = Number.parseInt(level, 10);
  const levelOk = Number.isInteger(parsedLevel) && parsedLevel >= SIDEKICK_MIN_LEVEL && parsedLevel <= SIDEKICK_MAX_LEVEL;
  const average = 'average' in creature.hp ? creature.hp.average : null;
  // The book only defines hit points at level 1 (the stat block); above that the user enters them.
  const hpText = hpInput ?? (parsedLevel === 1 && average !== null ? String(average) : '');
  const hp = Number.parseInt(hpText, 10);
  const hpOk = Number.isInteger(hp) && hp >= 1 && hp <= 99999;

  const confirm = () => {
    if (!eligibility.eligible || !levelOk || !hpOk) return;
    onConfirm({ id: generateUUID(), creatureId, classId, level: parsedLevel, baseHpMax: hp, levelUps: [] });
  };

  return (
    <AddDialog title="Add sidekick" confirmLabel="Add sidekick" confirmDisabled={!eligibility.eligible || !levelOk || !hpOk} onConfirm={confirm} onCancel={onCancel}>
      <p className={styles.notice}>{EDITION_MARK}</p>
      <label className={dialogStyles.field}>
        Sidekick class
        <select
          className={dialogStyles.control}
          value={classId}
          onChange={(e) => {
            const next = e.target.value as SidekickClassId;
            setClassId(next);
            const current = CREATURE_LIST.find((c) => c.id === creatureId);
            if (!current || !sidekickEligibility(current, next).eligible) {
              setCreatureId(CREATURE_LIST.find((c) => sidekickEligibility(c, next).eligible)?.id ?? creatureId);
            }
          }}
        >
          {SIDEKICK_CLASS_IDS.map((id) => (
            <option key={id} value={id}>
              {SIDEKICK_CLASSES[id].name}
            </option>
          ))}
        </select>
      </label>
      <label className={dialogStyles.field}>
        Creature
        <select className={dialogStyles.control} value={creatureId} onChange={(e) => setCreatureId(e.target.value)}>
          {CREATURE_LIST.map((c) => {
            const ok = sidekickEligibility(c, classId).eligible;
            return (
              <option key={c.id} value={c.id} disabled={!ok}>
                {ok ? c.name : `${c.name} (not eligible)`}
              </option>
            );
          })}
        </select>
      </label>
      {!eligibility.eligible && (
        <p className={dialogStyles.warning} role="alert">
          {eligibility.reasons.join('. ')}
        </p>
      )}
      <label className={dialogStyles.field}>
        {`Starting level (defaults to your level, ${character.level})`}
        <input type="number" className={dialogStyles.control} min={SIDEKICK_MIN_LEVEL} max={SIDEKICK_MAX_LEVEL} value={level} onChange={(e) => setLevel(e.target.value)} />
      </label>
      <label className={dialogStyles.field}>
        {parsedLevel === 1 ? 'Hit Points maximum (from the stat block)' : 'Hit Points maximum (you enter it: the book does not define it above level 1)'}
        <input type="number" className={dialogStyles.control} min={1} max={99999} value={hpText} onChange={(e) => setHpInput(e.target.value)} />
      </label>
    </AddDialog>
  );
}
