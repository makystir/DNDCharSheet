import { useRef, useState } from 'react';
import type { ResolvedMagicItem } from '../../logic/magic-item-resolve';
import { encodeItemCode } from '../../logic/dm-item-codes';
import styles from './dm.module.css';

export interface ItemCodeShareProps {
  item: ResolvedMagicItem;
  onNotify: (text: string) => void;
}

/** Make a code for one rolled item that a player pastes on their Inventory page. */
export function ItemCodeShare({ item, onNotify }: ItemCodeShareProps) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  const make = async () => {
    const encoded = await encodeItemCode(item);
    if (!encoded.ok) {
      setCode(null);
      setError(encoded.error);
      return;
    }
    setError(null);
    setCode(encoded.code);
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      onNotify('Code copied');
    } catch {
      onNotify('Select the code and copy it by hand');
      ref.current?.select();
    }
  };

  return (
    <div>
      <button type="button" className={styles.btn} onClick={() => void make()}>
        Create item code
      </button>
      {error && <p role="alert">{error}</p>}
      {code && (
        <>
          <textarea
            ref={ref}
            className={styles.textarea}
            readOnly
            rows={2}
            value={code}
            aria-label={`Item code for ${item.name}`}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button type="button" className={styles.btn} onClick={() => void copy()}>
            Copy code
          </button>
        </>
      )}
    </div>
  );
}
