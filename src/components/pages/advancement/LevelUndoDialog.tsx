import { useState } from 'react';
import type { Character } from '../../../types/character';
import { getClass } from '../../../data/classes';
import { lastLevelClassId, undoableClassIds, undoLastLevel } from '../../../logic/level-undo';
import { ConfirmDialog } from '../../shared/ConfirmDialog';

export interface LevelUndoDialogProps {
  character: Character;
  /** Injected clock for the log entry. */
  now: () => number;
  onConfirm: (next: Character) => void;
  onCancel: () => void;
}

/**
 * "Undo last level-up" confirmation. It runs the undo in preview first and
 * lists exactly what will be removed (and what is kept but now over the limit),
 * then applies that same result only when the player confirms. When a
 * multiclass character's last level was never recorded, the player picks
 * which class gained it.
 */
export function LevelUndoDialog({ character, now, onConfirm, onCancel }: LevelUndoDialogProps) {
  const known = lastLevelClassId(character);
  const candidates = undoableClassIds(character);
  const [picked, setPicked] = useState<string>(candidates[candidates.length - 1] ?? '');
  const classId = known ?? picked;
  const result = undoLastLevel(character, now(), classId);

  const message = result.ok
    ? result.preview.classTo <= 0
      ? `Undo your last level-up? You go from level ${result.preview.fromLevel} to ${result.preview.toLevel}, and the ${result.preview.className} class is removed.`
      : `Undo your last level-up? You go from level ${result.preview.fromLevel} to ${result.preview.toLevel} (${result.preview.className} ${result.preview.classFrom} to ${result.preview.classTo}).`
    : result.reason;

  return (
    <ConfirmDialog
      title="Undo last level-up"
      message={message}
      confirmLabel="Undo level-up"
      confirmDisabled={!result.ok}
      onCancel={onCancel}
      onConfirm={() => {
        if (result.ok) onConfirm(result.character);
      }}
    >
      {known === undefined && candidates.length > 0 && (
        <label>
          Which class gained your last level?{' '}
          <select value={picked} aria-label="Class that gained the last level" onChange={(e) => setPicked(e.target.value)}>
            {candidates.map((id) => (
              <option key={id} value={id}>
                {getClass(id)?.name ?? id}
              </option>
            ))}
          </select>
        </label>
      )}
      {result.ok && (
        <>
          <h4>This will remove</h4>
          {result.preview.removals.length > 0 ? (
            <ul data-testid="level-undo-removals">
              {result.preview.removals.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p data-testid="level-undo-removals">Nothing else: only the level itself.</p>
          )}
          {result.preview.notes.length > 0 && (
            <>
              <h4>Kept, but more than you&apos;re owed now</h4>
              <ul data-testid="level-undo-notes">
                {result.preview.notes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p>The Advancement page flags these so you can remove the extras.</p>
            </>
          )}
        </>
      )}
    </ConfirmDialog>
  );
}
