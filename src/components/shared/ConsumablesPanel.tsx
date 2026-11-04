import { useState } from 'react';
import type { Character, InventoryItem } from '../../types/character';
import { incrementDose, decrementDose } from '../../logic/consumables';
import { newCharacterId } from '../../storage/character-store';
import { Card } from './Card';
import styles from './ConsumablesPanel.module.css';

export interface ConsumablesPanelProps {
  character: Character;
  onChange: (next: Character) => void;
}

interface NewConsumableForm {
  name: string;
  maxDoses: string;
  effect: string;
}

const EMPTY_FORM: NewConsumableForm = { name: '', maxDoses: '', effect: '' };

type FormMode = 'hidden' | 'inline' | 'expanded';

/** An inventory item is dose-tracked when it carries a maxDoses value. */
function isConsumable(item: InventoryItem): boolean {
  return item.maxDoses !== undefined;
}

/**
 * Dose-tracking panel for consumable inventory items.
 *
 * Ported in structure from PWACharSheet's src/components/shared/
 * ConsumablesPanel.tsx (ui-parity: dose +/- steppers + inline/expanded add
 * form). Retargeted from the WFRP `Consumable` type onto the D&D `InventoryItem`
 * (kind 'equipment', with `currentDoses`/`maxDoses`); the dose math reuses the
 * A1-ported logic/consumables helpers. The free-text `effect` is stored in the
 * item's `notes` field.
 */
export function ConsumablesPanel({ character, onChange }: ConsumablesPanelProps) {
  const [formMode, setFormMode] = useState<FormMode>('hidden');
  const [form, setForm] = useState<NewConsumableForm>(EMPTY_FORM);

  const inventory = character.inventory ?? [];
  const consumables = inventory.filter(isConsumable);

  const mapItem = (id: string, fn: (item: InventoryItem) => InventoryItem) =>
    onChange({
      ...character,
      inventory: inventory.map((item) => (item.id === id ? fn(item) : item)),
    });

  const handleIncrement = (id: string) => mapItem(id, incrementDose);
  const handleDecrement = (id: string) => mapItem(id, decrementDose);

  const handleDelete = (id: string) =>
    onChange({ ...character, inventory: inventory.filter((item) => item.id !== id) });

  const isFormValid = () => {
    const maxDoses = parseInt(form.maxDoses, 10);
    return form.name.trim() !== '' && !isNaN(maxDoses) && maxDoses > 0;
  };

  const handleSubmit = () => {
    if (!isFormValid()) return;
    const maxDoses = parseInt(form.maxDoses, 10);
    const newItem: InventoryItem = {
      id: newCharacterId(),
      kind: 'equipment',
      name: form.name.trim(),
      quantity: 1,
      currentDoses: maxDoses,
      maxDoses,
      notes: form.effect.trim() || undefined,
    };
    onChange({ ...character, inventory: [...inventory, newItem] });
    setForm(EMPTY_FORM);
    setFormMode('hidden');
  };

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setFormMode('hidden');
  };

  return (
    <Card>
      <div className={styles.container}>
        {consumables.length === 0 ? (
          <div className={styles.emptyState}>No consumables tracked. Tap + to add.</div>
        ) : (
          <div className={styles.consumableList}>
            {consumables.map((item) => {
              const current = item.currentDoses ?? 0;
              const max = item.maxDoses ?? 0;
              const label = item.name ?? 'Consumable';
              return (
                <div
                  key={item.id}
                  className={current === 0 ? styles.consumableItemDepleted : styles.consumableItem}
                >
                  <div className={styles.itemHeader}>
                    <span className={styles.itemName}>{label}</span>
                    <span className={current === 0 ? styles.doseBadgeDepleted : styles.doseBadge}>
                      {current}/{max}
                    </span>
                  </div>
                  {item.notes && <div className={styles.itemEffect}>{item.notes}</div>}
                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      className={styles.decrementBtn}
                      onClick={() => handleDecrement(item.id)}
                      disabled={current === 0}
                      aria-label={`Use one dose of ${label}`}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className={styles.incrementBtn}
                      onClick={() => handleIncrement(item.id)}
                      disabled={current === max}
                      aria-label={`Restore one dose of ${label}`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(item.id)}
                      aria-label={`Remove ${label}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {formMode !== 'hidden' ? (
          <div className={styles.addForm}>
            <div className={styles.inlineRow}>
              <input
                type="text"
                className={styles.inlineInput}
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-label="Consumable name"
              />
              <input
                type="number"
                className={styles.inlineDosesInput}
                placeholder="Doses"
                min="1"
                value={form.maxDoses}
                onChange={(e) => setForm({ ...form, maxDoses: e.target.value })}
                aria-label="Max doses"
              />
              <button
                type="button"
                className={styles.inlineAddBtn}
                onClick={handleSubmit}
                disabled={!isFormValid()}
                aria-label="Add consumable"
              >
                Add
              </button>
            </div>

            {formMode === 'expanded' && (
              <div className={styles.expandedFields}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Effect</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="e.g. Heals 2d4 + 2 HP"
                    value={form.effect}
                    onChange={(e) => setForm({ ...form, effect: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className={styles.formFooter}>
              {formMode === 'inline' ? (
                <button
                  type="button"
                  className={styles.moreOptionsBtn}
                  onClick={() => setFormMode('expanded')}
                >
                  More options
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.moreOptionsBtn}
                  onClick={() => setFormMode('inline')}
                >
                  Fewer options
                </button>
              )}
              <button type="button" className={styles.cancelBtn} onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={styles.addToggleBtn}
            onClick={() => setFormMode('inline')}
          >
            + Add Consumable
          </button>
        )}
      </div>
    </Card>
  );
}
