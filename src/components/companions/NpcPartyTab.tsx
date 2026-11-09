import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import type { Character, NpcPartyMemberRecord } from '../../types/character';
import { loyaltyEnabled, loyaltyMaximumFor, setLoyaltyMaxOverride } from '../../logic/companions-actions';
import { NPC_TEMPLATES } from '../../logic/companion-model';
import type { NpcTemplate } from '../../logic/companion-model';
import type { RNG } from '../../logic/random';
import { generateUUID } from '../../logic/uuid';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { AddDialog } from './AddDialog';
import { LoyaltyMaximumField } from './LoyaltyControl';
import { NpcMemberCard } from './NpcMemberCard';
import { useRecordList } from './useRecordList';
import type { UndoSink } from './CompanionsTab';
import dialogStyles from './CompanionCreationFlow.module.css';
import styles from './CompanionsShared.module.css';

export interface NpcPartyTabProps {
  character: Character;
  onChange: (next: Character) => void;
  undo: UndoSink;
  /** Templates offered when adding a member; defaults to the (currently empty) catalog. */
  templates?: readonly NpcTemplate[];
  rng?: RNG;
}

/**
 * The NPC Party Members sub-tab (DMG 2024 L833, L3553-3557). Same shape as the
 * Hirelings tab minus the pay: an editable stat block, the Challenge Rating
 * guideline warning (never blocks) and the optional Loyalty Score.
 */
export function NpcPartyTab({ character, onChange, undo, templates = NPC_TEMPLATES, rng }: NpcPartyTabProps) {
  const [creating, setCreating] = useState(false);
  const { list, atMax, patch, add, deleting, requestDelete, cancelDelete, confirmDelete } = useRecordList(
    character,
    onChange,
    undo,
    'npcPartyMembers',
    'NPC party member removed',
  );
  const loyaltyOn = loyaltyEnabled(character);
  const loyalty = loyaltyMaximumFor(character);

  return (
    <>
      <Card>
        <SectionHeader
          icon={Users}
          title="NPC Party Members"
          action={
            <button type="button" className={styles.addBtn} disabled={atMax} onClick={() => setCreating(true)}>
              <Plus size={14} aria-hidden="true" />
              Add NPC Party Member
            </button>
          }
        />

        <p className={styles.banner}>
          DMG 2024: choose a Monster Manual stat block whose Challenge Rating is no higher than half the characters&apos; level.
          These NPCs don&apos;t gain XP and don&apos;t become more powerful.
        </p>

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
            icon={Users}
            heading="No NPC party members yet"
            description="Add an NPC who travels with the party."
            tip="Open a member and use Edit stat block to enter a Monster Manual stat block by hand. Templates (Guard, Scout, Noble, Commoner) will come later."
          />
        ) : (
          <div className={styles.list}>
            {list.map((rec) => (
              <NpcMemberCard
                key={rec.id}
                record={rec}
                partyLevel={character.level}
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
        <NpcCreationFlow
          templates={templates}
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

function NpcCreationFlow({
  templates,
  onConfirm,
  onCancel,
}: {
  templates: readonly NpcTemplate[];
  onConfirm: (record: NpcPartyMemberRecord) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [templateId, setTemplateId] = useState('');

  const confirm = () => {
    const n = name.trim().slice(0, 80);
    if (!n) return;
    const record: NpcPartyMemberRecord = { id: generateUUID(), name: n };
    const r = role.trim().slice(0, 80);
    if (r) record.role = r;
    const template = templates.find((t) => t.id === templateId);
    if (template) record.stats = template.stats;
    onConfirm(record);
  };

  return (
    <AddDialog title="Add NPC party member" confirmLabel="Add member" confirmDisabled={name.trim() === ''} onConfirm={confirm} onCancel={onCancel}>
      <label className={dialogStyles.field}>
        Name
        <input type="text" className={dialogStyles.control} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={dialogStyles.field}>
        Role (optional)
        <input type="text" className={dialogStyles.control} value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} />
      </label>
      {templates.length > 0 && (
        <label className={dialogStyles.field}>
          Start from template
          <select className={dialogStyles.control} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Blank stat block</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </AddDialog>
  );
}
