import type { Suggestion, SuggestionAction } from '../../logic/assistant/types';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './SuggestionItem.module.css';

export interface SuggestionItemProps {
  suggestion: Suggestion;
  /** Invoke the real handler for an action descriptor (navigate / roll / backup). */
  onAction: (action: SuggestionAction) => void;
  /** Dismiss this suggestion until its condition clears and re-triggers. */
  onDismiss: (id: string) => void;
  /** Snooze this suggestion for the fixed window (24h). */
  onSnooze: (id: string) => void;
}

/**
 * Human label for a primary/secondary action button.
 */
function actionLabel(action: SuggestionAction): string {
  if (action.kind === 'roll') return `Roll: ${action.label}`;
  if (action.kind === 'backup-file') return 'Back up now';
  // navigate
  switch (action.page) {
    case 'advancement':
      return 'Open Advancement';
    case 'inventory':
      return 'Open Inventory';
    case 'combat':
      return 'Open Combat';
    case 'spells':
      return 'Open Spells';
    case 'settings':
      return 'Open Settings';
    case 'character':
      return 'Open Character';
    default:
      return 'Go';
  }
}

/**
 * One suggestion row: title, rationale, any calculated-total breakdown
 * (rendered through the shared CalculatedValue so every number is explainable —
 * calculated-totals steering), the primary and optional secondary action, the
 * rulebook citation, and dismiss + snooze controls. All controls are real
 * keyboard-operable buttons.
 *
 * The item NEVER mutates the character — it only invokes the injected
 * onAction/onDismiss/onSnooze callbacks, which route through existing,
 * player-confirmed flows. Each calculated total carries the SAME Breakdown the
 * engine produced (never recomputed here).
 */
export function SuggestionItem({ suggestion, onAction, onDismiss, onSnooze }: SuggestionItemProps) {
  const totals = suggestion.totals ?? [];

  return (
    <li
      className={styles.item}
      data-urgency={suggestion.urgency}
      data-testid={`suggestion-${suggestion.id}`}
    >
      <div className={styles.title}>{suggestion.title}</div>
      <div className={styles.rationale}>{suggestion.rationale}</div>

      {totals.length > 0 && (
        <div className={styles.totals}>
          {totals.map((total, index) => (
            <div key={index} className={styles.totalRow}>
              <span className={styles.totalLabel}>{total.label}</span>
              <span className={styles.totalValue}>
                <CalculatedValue label={total.label} breakdown={total.breakdown}>
                  {total.display}
                </CalculatedValue>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryAction}
          onClick={() => onAction(suggestion.action)}
        >
          {actionLabel(suggestion.action)}
        </button>
        {suggestion.secondaryAction && (
          <button
            type="button"
            className={styles.secondaryAction}
            onClick={() => onAction(suggestion.secondaryAction!)}
          >
            {actionLabel(suggestion.secondaryAction)}
          </button>
        )}
      </div>

      {suggestion.citation && <div className={styles.citation}>{suggestion.citation}</div>}

      <div className={styles.dismissControls}>
        <button
          type="button"
          className={styles.dismissButton}
          onClick={() => onDismiss(suggestion.id)}
        >
          Dismiss
        </button>
        <button
          type="button"
          className={styles.snoozeButton}
          onClick={() => onSnooze(suggestion.id)}
        >
          Snooze
        </button>
      </div>
    </li>
  );
}
