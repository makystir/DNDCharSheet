import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentedControl } from '../SegmentedControl';

const OPTIONS = [
  { value: 'attack' as const, label: 'Attack' },
  { value: 'defend' as const, label: 'Defend' },
  { value: 'status' as const, label: 'Status' },
];

function Harness({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState<'attack' | 'defend' | 'status'>('attack');
  return (
    <SegmentedControl
      ariaLabel="Combat mode"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
      idBase="combat-mode"
    />
  );
}

describe('SegmentedControl', () => {
  it('renders a labelled tablist of tabs with aria-selected on the active one', () => {
    render(<Harness />);
    const tablist = screen.getByRole('tablist', { name: 'Combat mode' });
    expect(tablist).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Attack' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Defend' })).toHaveAttribute('aria-selected', 'false');
  });

  it('uses a roving tabindex: only the selected tab is in the tab order', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'Attack' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Defend' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Status' })).toHaveAttribute('tabindex', '-1');
  });

  it('wires aria-controls to the tabpanel id derived from idBase', () => {
    render(<Harness />);
    expect(screen.getByRole('tab', { name: 'Attack' })).toHaveAttribute(
      'aria-controls',
      'combat-mode-panel-attack',
    );
    expect(screen.getByRole('tab', { name: 'Attack' })).toHaveAttribute('id', 'combat-mode-tab-attack');
  });

  it('clicking a tab selects it', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Status' }));
    expect(onChange).toHaveBeenCalledWith('status');
    expect(screen.getByRole('tab', { name: 'Status' })).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowRight moves selection forward and ArrowLeft back, wrapping at the ends', () => {
    render(<Harness />);
    const attack = screen.getByRole('tab', { name: 'Attack' });
    fireEvent.keyDown(attack, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Defend' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Defend' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Attack' })).toHaveAttribute('aria-selected', 'true');

    // ArrowLeft from the first tab wraps to the last.
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Attack' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Status' })).toHaveAttribute('aria-selected', 'true');
  });

  it('Home selects the first tab and End the last', () => {
    render(<Harness />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Attack' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Status' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Status' }), { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Attack' })).toHaveAttribute('aria-selected', 'true');
  });
});
