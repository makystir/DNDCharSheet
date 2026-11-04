import { useState, type FormEvent } from 'react';
import { parseCurrencyInput, type CurrencyDelta } from '../../logic/currency';
import styles from './CurrencyInput.module.css';

export interface CurrencyInputProps {
  onSubmit: (deltas: CurrencyDelta) => void;
}

/**
 * Free-text coin-purse adjustment input.
 *
 * Ported near-verbatim from PWACharSheet's src/components/shared/CurrencyInput.tsx
 * (ui-parity: same free-text delta parser + Apply affordance + inline error
 * row). The only D&D change is the denomination set in the placeholder / error
 * text (pp/gp/ep/sp/cp instead of WFRP's GC/SS/D); the parser accepts all five
 * PHB denominations via logic/currency.parseCurrencyInput.
 */
export function CurrencyInput({ onSubmit }: CurrencyInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmed = value.trim();
    if (!trimmed) {
      setError('Enter amounts like "+2 GP -5 SP +10 CP"');
      return;
    }

    const result = parseCurrencyInput(trimmed);
    if (result === null) {
      setError('Invalid format. Use amounts like "+2 GP -5 SP +10 CP"');
      return;
    }

    onSubmit(result);
    setValue('');
    setError(null);
  }

  function handleChange(input: string) {
    setValue(input);
    if (error) {
      setError(null);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.inputRow}>
        <input
          type="text"
          className={styles.input}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          maxLength={60}
          placeholder="e.g. +2 GP -5 SP +10 CP"
          aria-label="Currency adjustment"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'currency-input-error' : undefined}
        />
        <button type="submit" className={styles.submitButton}>
          Apply
        </button>
      </div>
      {error && (
        <p id="currency-input-error" className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
