import { useRef, useState } from 'react';
import { Gem } from 'lucide-react';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { newCharacterId } from '../../storage/character-store';
import { decodeItemCode, previewItem, type ItemCodePayload } from '../../logic/dm-item-codes';
import styles from './InventoryPage.module.css';

export interface ItemRedeemCardProps {
  /** Adds the item built from a checked code to the inventory (one change, nothing else touched). */
  onAdd: (payload: ItemCodePayload, id: string) => void;
}

/** Paste a DM's item code, preview the item, and add it to the inventory. */
export function ItemRedeemCard({ onAdd }: ItemRedeemCardProps) {
  const [text, setTextRaw] = useState('');
  const [payload, setPayload] = useState<ItemCodePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // Editing the text invalidates any earlier Check, so Add can never use a stale item.
  const latestText = useRef('');

  const setText = (v: string) => {
    latestText.current = v;
    setTextRaw(v);
    setPayload(null);
    setError(null);
    setResult(null);
  };

  const check = async () => {
    setResult(null);
    const checked = text;
    const decoded = await decodeItemCode(checked);
    if (latestText.current !== checked) return;
    if (!decoded.ok) {
      setPayload(null);
      setError(decoded.error);
      return;
    }
    setError(null);
    setPayload(decoded.payload);
  };

  const add = () => {
    if (!payload) return;
    const preview = previewItem(payload);
    onAdd(payload, newCharacterId());
    setResult(`${preview.name} added to your inventory.`);
    setPayload(null);
    latestText.current = '';
    setTextRaw('');
  };

  const preview = payload ? previewItem(payload) : null;

  return (
    <Card>
      <SectionHeader icon={Gem} title="DM item code" />
      <div className={styles.customEditRow}>
        <label className={styles.customEditLabel} htmlFor="item-code-input">
          Paste an item code
        </label>
        <textarea
          id="item-code-input"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ITEM-..."
          style={{ width: '100%' }}
        />
        <div>
          <button type="button" onClick={() => void check()}>
            Check
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" style={{ margin: '8px 0 0' }}>
          {error}
        </p>
      )}
      {result && <p role="status">{result}</p>}
      {preview && (
        <div data-testid="item-preview">
          <p style={{ margin: 0 }}>
            <strong>{preview.name}</strong>
          </p>
          <p style={{ margin: 0 }}>
            {preview.typeDetail ? `${preview.category} (${preview.typeDetail})` : preview.category}, {preview.rarity}.{' '}
            {preview.attunement}.
          </p>
          <p>{preview.description}</p>
          <p style={{ margin: 0 }}>Source: {preview.source}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={add}>
              Add to inventory
            </button>
            <button type="button" onClick={() => setPayload(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
