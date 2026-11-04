import { useState } from 'react';
import type { Character } from '../../types/character';
import { resolveRestRuleTooltip } from '../../logic/tooltip-content';
import { ContentTooltip } from '../shared/ContentTooltip';
import { ShortRestDialog } from './ShortRestDialog';
import { LongRestDialog } from './LongRestDialog';
import styles from './Rests.module.css';

export interface RestControlsProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Optional app-level Toast sink. */
  onNotify?: (message: string) => void;
  /** Clock for the Long Rest record and the 16-hour advisory (tests inject it). */
  now?: () => number;
}

type OpenDialog = 'short' | 'long' | null;

/**
 * Short Rest and Long Rest buttons for the Hit Dice card (Stage A5b), each with
 * a rule-tooltip trigger, plus the live region that announces the outcome.
 * Closing a dialog returns focus to the button that opened it (the dialogs'
 * focus trap restores it; the buttons stay mounted).
 *
 * Presentation parity: PWACharSheet has no rests. Buttons and the status line
 * follow the HP card's control rows (actionBtn + live region).
 */
export function RestControls({ character, onChange, onNotify, now = Date.now }: RestControlsProps) {
  const [open, setOpen] = useState<OpenDialog>(null);
  const [openedAt, setOpenedAt] = useState(0);
  const [status, setStatus] = useState('');
  const shortTip = resolveRestRuleTooltip('short-rest');
  const longTip = resolveRestRuleTooltip('long-rest');

  const finish = (next: Character, message: string) => {
    onChange(next);
    setStatus(message);
    onNotify?.(message);
    setOpen(null);
  };

  const openLong = () => {
    setOpenedAt(now());
    setOpen('long');
  };

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <button type="button" className={styles.actionBtn} onClick={() => setOpen('short')}>
            Short Rest
          </button>
          {shortTip && <ContentTooltip content={shortTip}>Short Rest rules</ContentTooltip>}
        </div>
        <div className={styles.controlGroup}>
          <button type="button" className={styles.actionBtn} onClick={openLong}>
            Long Rest
          </button>
          {longTip && <ContentTooltip content={longTip}>Long Rest rules</ContentTooltip>}
        </div>
      </div>
      <div role="status" aria-live="polite" className={styles.status} data-testid="rest-status">
        {status}
      </div>

      {open === 'short' && (
        <ShortRestDialog character={character} onComplete={finish} onClose={() => setOpen(null)} />
      )}
      {open === 'long' && (
        <LongRestDialog
          character={character}
          now={openedAt}
          onComplete={finish}
          onInterruptedToShortRest={() => setOpen('short')}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
