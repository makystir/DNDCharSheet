import type { SearchResultEntry } from './searchIndex';
import type {
  PageDisplayData,
  ActionDisplayData,
  ConditionDisplayData,
} from './searchIndex';
import styles from './DetailView.module.css';

// ─── Props ───────────────────────────────────────────────────────────────────

interface DetailViewProps {
  entity: SearchResultEntry;
  onBack: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Display "—" for missing/undefined/empty fields */
function display(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const str = String(value).trim();
  return str.length === 0 ? '—' : str;
}

function Field({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={styles.fieldValue}>{display(value)}</dd>
    </>
  );
}

// ─── Detail Panels ───────────────────────────────────────────────────────────

function PageDetail({ data }: { data: PageDisplayData }) {
  return (
    <dl className={styles.fieldList}>
      <Field label="Page" value={data.page} />
      <Field label="Sections" value={data.hint} />
    </dl>
  );
}

function ActionDetail({ data }: { data: ActionDisplayData }) {
  return (
    <dl className={styles.fieldList}>
      <Field label="Description" value={data.description} />
    </dl>
  );
}

function ConditionDetail({ data }: { data: ConditionDisplayData }) {
  return (
    <dl className={styles.fieldList}>
      <Field label="Description" value={data.description} />
      <Field label="Effects" value={data.effects} />
      <Field label="Ends" value={data.endsWhen} />
    </dl>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DetailView({ entity, onBack }: DetailViewProps) {
  const { displayData } = entity.entity;

  function renderDetail() {
    switch (displayData.type) {
      case 'page':
        return <PageDetail data={displayData} />;
      case 'action':
        return <ActionDetail data={displayData} />;
      case 'condition':
        return <ConditionDetail data={displayData} />;
      default:
        return null;
    }
  }

  return (
    <div data-testid="command-palette-detail" className={styles.container}>
      <button
        className={styles.backButton}
        onClick={onBack}
        type="button"
        aria-label="Back to results"
      >
        ← Back
      </button>
      <h2 className={styles.heading}>{entity.entity.name}</h2>
      {renderDetail()}
    </div>
  );
}
