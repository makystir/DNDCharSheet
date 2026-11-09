import { useEffect, useRef, useState } from 'react';
import { PawPrint, Plus } from 'lucide-react';
import type { Character, CompanionRecord } from '../../types/character';
import { addRecord, recordsOf, removeRecord, restoreRecord, updateRecord } from '../../logic/companions-actions';
import { canAddRecord } from '../../logic/companions';
import { companionDisplayName } from '../../logic/companion-model';
import { getHelpContent } from '../../logic/help-content';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { HelpPopover } from '../shared/HelpPopover';
import { CompanionCard } from './CompanionCard';
import { CompanionCreationFlow } from './CompanionCreationFlow';
import styles from './CompanionsTab.module.css';

export interface UndoSink {
  show: (message: string, item: unknown, index: number, restore: (item: unknown, index: number) => void) => void;
}

export interface CompanionsTabProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Shows the page's undo toast after a delete. */
  undo: UndoSink;
}

/**
 * The Companions sub-tab: permanent creature companions (Primal Companion,
 * familiars, Otherworldly Steed, Animate Dead servants and pets). Mirrors the
 * WFRP Retinue page's list-of-cards tab: Card + SectionHeader with an add
 * button, EmptyState, delete via ConfirmDialog with an undo toast.
 *
 * Creatures that exist only temporarily from summoning spells are deliberately
 * not tracked (user decision).
 */
export function CompanionsTab({ character, onChange, undo }: CompanionsTabProps) {
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // The undo toast outlives this render: restore against the LATEST character so
  // edits made while the toast is showing are not overwritten.
  const latest = useRef({ character, onChange });
  useEffect(() => {
    latest.current = { character, onChange };
  });

  const list = recordsOf(character, 'companions');
  const atMax = !canAddRecord('companions', list.length);

  const patch = (id: string, p: Partial<CompanionRecord>) => onChange(updateRecord(character, 'companions', id, p));

  const confirmDelete = () => {
    const id = pendingDelete;
    setPendingDelete(null);
    if (id === null) return;
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return;
    const record = list[index];
    onChange(removeRecord(character, 'companions', id));
    undo.show('Companion removed', record, index, (item, idx) => {
      const { character: current, onChange: emit } = latest.current;
      emit(restoreRecord(current, 'companions', item as CompanionRecord, idx));
    });
  };

  const deleting = pendingDelete ? list.find((r) => r.id === pendingDelete) : undefined;

  return (
    <>
      <Card>
        <SectionHeader
          icon={PawPrint}
          title={
            <span className={styles.titleRow}>
              Companions
              <HelpPopover concept="companions-tab" autoShow={false}>{getHelpContent('companions-tab')}</HelpPopover>
            </span>
          }
          action={
            <button type="button" className={styles.addBtn} disabled={atMax} onClick={() => setCreating(true)}>
              <Plus size={14} aria-hidden="true" />
              Add Companion
            </button>
          }
        />

        {list.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            heading="No companions yet"
            description="Add a Primal Companion, a familiar, a steed or a pet. Hirelings and NPC party members are on their own tabs."
            tip="Summoned creatures that only last a short time are not tracked here."
          />
        ) : (
          <div className={styles.list}>
            {list.map((rec) => (
              <CompanionCard key={rec.id} record={rec} character={character} onPatch={patch} onDelete={setPendingDelete} />
            ))}
          </div>
        )}
      </Card>

      {creating && (
        <CompanionCreationFlow
          character={character}
          onCancel={() => setCreating(false)}
          onConfirm={(record) => {
            onChange(addRecord(character, 'companions', record));
            setCreating(false);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          message={`Remove ${companionDisplayName(deleting)}? You can undo this for a few seconds.`}
          confirmLabel="Remove"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}
