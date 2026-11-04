import { useRef, useState } from 'react';
import { Brain } from 'lucide-react';
import type { Character } from '../../types/character';
import { getSpell } from '../../data/spells';
import { endConcentration } from '../../logic/concentration';
import { resolveRestRuleTooltip } from '../../logic/tooltip-content';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { ContentTooltip } from '../shared/ContentTooltip';
import styles from './Concentration.module.css';

export interface ConcentrationCardProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Optional app-level Toast sink. */
  onNotify?: (message: string) => void;
}

/**
 * Concentration readout for the Combat tab (Stage A5b): the spell being
 * concentrated on, a rule tooltip, and an End Concentration button (PHB 2024
 * "Concentration": the creator can end it at any time, no action needed).
 * Renders a card only while concentrating; the live region is always mounted so
 * the ending is announced after the card is gone.
 *
 * Presentation parity: PWACharSheet has no Concentration. The chip follows the
 * HP card's chip look (bordered pill + ContentTooltip), and the card follows
 * the other Combat cards (Card + SectionHeader). Every rule lives in
 * logic/concentration.ts.
 */
export function ConcentrationCard({ character, onChange, onNotify }: ConcentrationCardProps) {
  const [status, setStatus] = useState('');
  const statusRef = useRef<HTMLDivElement>(null);
  const spellId = character.concentration?.spellId;
  const tip = resolveRestRuleTooltip('concentration');
  const name = spellId ? (getSpell(spellId)?.name ?? spellId) : '';

  const handleEnd = () => {
    if (!spellId) return;
    onChange(endConcentration(character));
    const message = `Concentration on ${name} ended.`;
    setStatus(message);
    onNotify?.(message);
    // The button unmounts with the card, so return focus to the status region.
    requestAnimationFrame(() => statusRef.current?.focus());
  };

  return (
    <>
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className={styles.srOnly}
        data-testid="concentration-status"
      >
        {status}
      </div>
      {spellId && (
        <Card>
          <SectionHeader
            icon={Brain}
            title={tip ? <ContentTooltip content={tip}>Concentration</ContentTooltip> : 'Concentration'}
          />
          <div className={styles.row}>
            <span className={styles.chip} data-testid="concentration-chip">
              <span className={styles.chipLabel}>
                {tip ? <ContentTooltip content={tip}>Concentrating on</ContentTooltip> : 'Concentrating on'}
              </span>
              <span className={styles.spellName}>{name}</span>
            </span>
            <button type="button" className={styles.endBtn} onClick={handleEnd}>
              End Concentration
            </button>
          </div>
        </Card>
      )}
    </>
  );
}
