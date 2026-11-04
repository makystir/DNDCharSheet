import { useState, useMemo } from 'react';
import styles from './Picker.module.css';
import { groupItems } from './pickerUtils';

interface PickerProps<T> {
  items: T[];
  getLabel: (item: T) => string;
  getGroup?: (item: T) => string;
  isDisabled?: (item: T) => boolean;
  onSelect: (item: T) => void;
  onClose: () => void;
  title?: string;
}

/**
 * A searchable, optionally-grouped item picker modal.
 *
 * Ported in structure from PWACharSheet's src/components/shared/Picker.tsx
 * (ui-parity). The overlay/modal CSS is inlined here (this app has no shared
 * styles module) and re-themed to global.css tokens.
 */
export function Picker<T>({
  items,
  getLabel,
  getGroup,
  isDisabled,
  onSelect,
  onClose,
  title,
}: PickerProps<T>) {
  const [search, setSearch] = useState('');
  const searchLower = search.toLowerCase();

  const filtered = useMemo(
    () => items.filter((item) => getLabel(item).toLowerCase().includes(searchLower)),
    [items, getLabel, searchLower],
  );

  const renderItem = (item: T, key: number) => {
    const disabled = isDisabled?.(item) ?? false;
    return disabled ? (
      <div key={key} className={styles.itemDisabled} aria-disabled="true">
        {getLabel(item)}
      </div>
    ) : (
      <button key={key} type="button" className={styles.item} onClick={() => onSelect(item)}>
        {getLabel(item)}
      </button>
    );
  };

  const renderList = () => {
    if (!getGroup) {
      if (filtered.length === 0) {
        return <div className={styles.emptyMessage}>No items found</div>;
      }
      return filtered.map((item, i) => renderItem(item, i));
    }

    const groups = groupItems(items, getGroup);
    let keyCounter = 0;
    let hasAnyVisibleItem = false;

    const content = groups.map((group) => {
      const visibleItems = group.items.filter((item) =>
        getLabel(item).toLowerCase().includes(searchLower),
      );
      if (visibleItems.length === 0) return null;
      hasAnyVisibleItem = true;
      return (
        <div
          key={`group-${group.group}`}
          role="group"
          aria-label={group.group}
          className={styles.group}
        >
          <div className={styles.groupHeader} aria-hidden="true">
            {group.group}
          </div>
          {visibleItems.map((item) => renderItem(item, keyCounter++))}
        </div>
      );
    });

    if (!hasAnyVisibleItem) {
      return <div className={styles.emptyMessage}>No items found</div>;
    }
    return content;
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-label={title || 'Picker'}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {title && <h3 className={styles.title}>{title}</h3>}
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
          aria-label="Search items"
          autoFocus
        />
        <div className={styles.list}>{renderList()}</div>
        <button type="button" onClick={onClose} className={styles.close}>
          Close
        </button>
      </div>
    </div>
  );
}
