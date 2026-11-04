import { useState, useEffect, useRef, useCallback } from 'react';
import type { ActiveCondition } from '../../types/character';
import { CONDITIONS, EXHAUSTION, type ConditionId } from '../../data/conditions';
import { resolveConditionTooltip } from '../../logic/tooltip-content';
import { Tooltip } from '../shared/Tooltip';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { Check, Info, X } from 'lucide-react';
import styles from './ConditionPicker.module.css';

// Ported from PWACharSheet src/components/combat/ConditionPicker.tsx: modal with
// a wrapping grid of condition buttons (info / name-to-apply / remove). D&D
// deviations: conditions are keyed by id; most conditions are not stackable, so
// tapping an active one is a no-op (PHB "No Stacking"); Exhaustion is the sole
// stackable condition, so tapping it adds a level (up to 6) and its remove (x)
// clears all levels.

export interface ConditionPickerProps {
  conditions: ActiveCondition[];
  exhaustionLevel: number;
  onApply: (id: ConditionId) => void;
  onRemove: (id: ConditionId) => void;
  onClose: () => void;
}

export function ConditionPicker({
  conditions,
  exhaustionLevel,
  onApply,
  onRemove,
  onClose,
}: ConditionPickerProps) {
  const [conditionTooltip, setConditionTooltip] = useState<{
    id: ConditionId;
    anchorEl: HTMLElement;
  } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, true);
  useBodyScrollLock(true);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const tooltipContent = conditionTooltip ? resolveConditionTooltip(conditionTooltip.id) : null;

  return (
    <div className={styles.overlay} onClick={handleOverlayClick} data-testid="condition-picker-overlay">
      <div
        ref={modalRef}
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Condition Picker"
        aria-modal="true"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Conditions</h2>
          <button
            type="button"
            aria-label="Close condition picker"
            onClick={onClose}
            className={styles.closeBtn}
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.grid} data-testid="condition-grid">
          {CONDITIONS.map((cond) => {
            const isExhaustion = cond.id === 'exhaustion';
            const isActive = isExhaustion
              ? exhaustionLevel > 0
              : conditions.some((c) => c.id === cond.id);
            const atMax = isExhaustion && exhaustionLevel >= EXHAUSTION.maxLevel;

            return (
              <div
                key={cond.id}
                className={isActive ? `${styles.conditionBtn} ${styles.conditionBtnActive}` : styles.conditionBtn}
                data-testid={`condition-${cond.id}`}
              >
                {isActive && (
                  <span className={styles.activeIndicator} aria-hidden="true">
                    <Check size={14} />
                  </span>
                )}

                <button
                  type="button"
                  aria-label={`Info for ${cond.name}`}
                  aria-describedby={
                    conditionTooltip?.id === cond.id ? `tooltip-picker-${cond.id}` : undefined
                  }
                  onClick={(e) => {
                    if (conditionTooltip?.id === cond.id) {
                      setConditionTooltip(null);
                      return;
                    }
                    setConditionTooltip({ id: cond.id, anchorEl: e.currentTarget });
                  }}
                  className={styles.infoBtn}
                >
                  <Info size={14} />
                </button>

                <button
                  type="button"
                  aria-label={
                    isExhaustion
                      ? atMax
                        ? `Exhaustion is at maximum level ${EXHAUSTION.maxLevel}`
                        : `Add Exhaustion level`
                      : isActive
                        ? `${cond.name} already applied`
                        : `Apply ${cond.name}`
                  }
                  aria-disabled={isExhaustion ? atMax : isActive}
                  onClick={() => {
                    if (isExhaustion ? !atMax : !isActive) onApply(cond.id);
                  }}
                  className={styles.nameBtn}
                >
                  {cond.name}
                  {isExhaustion && exhaustionLevel > 0 ? ` (${exhaustionLevel})` : ''}
                </button>

                {isActive && (
                  <button
                    type="button"
                    aria-label={`Remove ${cond.name}`}
                    onClick={() => onRemove(cond.id)}
                    className={styles.removeBtn}
                  >
                    {'\u2715'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {conditionTooltip && tooltipContent && (
        <Tooltip
          anchorEl={conditionTooltip.anchorEl}
          title={tooltipContent.title}
          onClose={() => setConditionTooltip(null)}
          id={`tooltip-picker-${conditionTooltip.id}`}
        >
          {tooltipContent.sections.map((s, idx) => (
            <div
              key={idx}
              className={idx < tooltipContent.sections.length - 1 ? styles.tooltipSection : styles.tooltipSectionLast}
            >
              <div className={styles.tooltipLabel}>{s.label}</div>
              <div>{s.text}</div>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  );
}
