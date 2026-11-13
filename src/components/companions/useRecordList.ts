import { useEffect, useRef, useState } from 'react';
import type { Character } from '../../types/character';
import { addRecord, recordsOf, removeRecord, restoreRecord, updateRecord } from '../../logic/companions-actions';
import type { CompanionListKey, CompanionListMap } from '../../logic/companions-actions';
import { canAddRecord } from '../../logic/companions';

/** The page's undo toast, shown after a delete. */
export interface UndoSink {
  show: (message: string, item: unknown, index: number, restore: (item: unknown, index: number) => void) => void;
}

/**
 * List plumbing shared by the Creatures and People tabs: add, patch, and delete
 * with a confirm step and the WFRP-style undo toast (mirrors the RetinuePage
 * delete flow). Every edit goes through the single `onChange` of the page.
 */
export function useRecordList<K extends CompanionListKey>(
  character: Character,
  onChange: (next: Character) => void,
  undo: UndoSink,
  key: K,
  removedMessage: string,
) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // The undo toast outlives this render: restore against the LATEST character so
  // edits made while the toast is showing are not overwritten.
  const latest = useRef({ character, onChange });
  useEffect(() => {
    latest.current = { character, onChange };
  });

  const list = recordsOf(character, key);
  const atMax = !canAddRecord(key, list.length);

  const patch = (id: string, p: Partial<CompanionListMap[K]>) => onChange(updateRecord(character, key, id, p));
  const add = (record: CompanionListMap[K]) => onChange(addRecord(character, key, record));

  const confirmDelete = () => {
    const id = pendingDelete;
    setPendingDelete(null);
    if (id === null) return;
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return;
    const record = list[index];
    onChange(removeRecord(character, key, id));
    undo.show(removedMessage, record, index, (item, idx) => {
      const { character: current, onChange: emit } = latest.current;
      emit(restoreRecord(current, key, item as CompanionListMap[K], idx));
    });
  };

  const deleting = pendingDelete ? list.find((r) => r.id === pendingDelete) : undefined;

  return {
    list,
    atMax,
    patch,
    add,
    deleting,
    requestDelete: (id: string) => setPendingDelete(id),
    cancelDelete: () => setPendingDelete(null),
    confirmDelete,
  };
}
