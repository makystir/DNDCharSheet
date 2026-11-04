import { useRef } from 'react';
import type { ReactNode } from 'react';
import styles from './SegmentedControl.module.css';

export interface SegmentedControlOption<T extends string> {
  /** The mode value this segment selects. */
  value: T;
  /** The visible label for the segment. */
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name for the tablist (aria-label). */
  ariaLabel: string;
  /** The ordered segments. */
  options: SegmentedControlOption<T>[];
  /** The currently selected value. */
  value: T;
  /** Called with the newly selected value. */
  onChange: (value: T) => void;
  /**
   * The id of the tabpanel each tab controls. When provided, each tab gets an
   * `id` of `${idBase}-tab-${value}` and `aria-controls` of
   * `${idBase}-panel-${value}`, so a consumer can associate its panels with
   * `role="tabpanel"` and `aria-labelledby`.
   */
  idBase?: string;
  /** Optional extra class on the tablist (e.g. a sticky modifier). */
  className?: string;
}

/**
 * An accessible Attack / Defend / Status style segmented control, mirroring
 * PWACharSheet's CombatPage segmented control (a `role="tablist"` strip of
 * `role="tab"` buttons). Parity note: the PWA inlines the three buttons on the
 * page; this extracts the identical pattern into a reusable primitive so the
 * tab semantics live in one place and can be unit-tested. The markup, classes
 * and sticky behaviour match the PWA's `.segmentedControl` / `.segment` idiom.
 *
 * Accessibility: a true tablist with roving tabindex (only the selected tab is
 * in the tab order), arrow-key navigation (Left/Right/Home/End wrap and move
 * selection), `aria-selected`, and optional `aria-controls` → tabpanel wiring.
 * The control never computes any rule; it is pure presentation.
 */
export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  idBase,
  className,
}: SegmentedControlProps<T>) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const focusTab = (index: number) => {
    const wrapped = (index + options.length) % options.length;
    onChange(options[wrapped].value);
    // Move focus to the newly selected tab on the next frame (after commit).
    requestAnimationFrame(() => tabRefs.current[wrapped]?.focus());
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        focusTab(selectedIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        focusTab(selectedIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTab(0);
        break;
      case 'End':
        event.preventDefault();
        focusTab(options.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className={className ? `${styles.segmentedControl} ${className}` : styles.segmentedControl} role="tablist" aria-label={ariaLabel}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${option.value}` : undefined}
            aria-selected={selected}
            aria-controls={idBase ? `${idBase}-panel-${option.value}` : undefined}
            tabIndex={selected ? 0 : -1}
            className={selected ? styles.segmentActive : styles.segment}
            onClick={() => onChange(option.value)}
            onKeyDown={onKeyDown}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
