import type { SearchResultEntry } from './searchIndex';
import type {
  PageDisplayData,
  ActionDisplayData,
  ConditionDisplayData,
} from './searchIndex';
import styles from './ResultCard.module.css';

export interface ResultCardProps {
  entry: SearchResultEntry;
  isSelected: boolean;
  onClick: () => void;
  id: string;
}

function getTypeBadgeLabel(type: string): string {
  switch (type) {
    case 'page':
      return 'Page';
    case 'action':
      return 'Action';
    case 'condition':
      return 'Condition';
    default:
      return type;
  }
}

function getTypeSummary(entry: SearchResultEntry): string {
  const data = entry.entity.displayData;
  switch (data.type) {
    case 'page': {
      const page = data as PageDisplayData;
      return page.hint || 'Navigate';
    }
    case 'action': {
      const action = data as ActionDisplayData;
      return action.description || '—';
    }
    case 'condition': {
      const condition = data as ConditionDisplayData;
      return condition.description || '—';
    }
    default:
      return '—';
  }
}

export function ResultCard({ entry, isSelected, onClick, id }: ResultCardProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={isSelected}
      className={styles.card}
      onClick={onClick}
      data-testid={`result-${entry.entity.id}`}
    >
      <span className={styles.name}>{entry.entity.name}</span>
      <span className={styles.badge}>{getTypeBadgeLabel(entry.entity.type)}</span>
      <span className={styles.summary}>{getTypeSummary(entry)}</span>
    </div>
  );
}
