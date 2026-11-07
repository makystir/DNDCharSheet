import { useState } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { OverviewInspiration } from '../OverviewInspiration';
import { createCharacter } from '../../../../storage/character-store';
import { exportToJSON, importFromJSON } from '../../../../storage/export-import';
import { runMigration } from '../../../../storage/migration';
import { PrintLayout } from '../../../layout/PrintLayout';
import { buildPrintSheetData } from '../../../layout/printLayoutGenerators';
import type { Character } from '../../../../types/character';

afterEach(cleanup);

describe('OverviewInspiration', () => {
  it('shows No by default, toggles, and persists through onChange', () => {
    const onChange = vi.fn();
    function Harness() {
      const [c, setC] = useState<Character>(createCharacter('Tester'));
      return (
        <OverviewInspiration
          character={c}
          onChange={(n) => {
            onChange(n);
            setC(n);
          }}
        />
      );
    }
    render(<Harness />);
    const btn = screen.getByRole('button', { name: 'Heroic Inspiration: No' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect((onChange.mock.calls[0][0] as Character).heroicInspiration).toBe(true);
    const on = screen.getByRole('button', { name: 'Heroic Inspiration: Yes' });
    expect(on).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(on);
    expect((onChange.mock.calls[1][0] as Character).heroicInspiration).toBe(false);
  });

  it('shows the rule note about manual setting', () => {
    render(<OverviewInspiration character={createCharacter('T')} onChange={vi.fn()} />);
    expect(
      screen.getByText(/Some features grant it \(e\.g\. Human Resourceful, Musician\)/),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not change it automatically/)).toBeInTheDocument();
  });

  it('prints a read-only Heroic Inspiration line', () => {
    const base = createCharacter('Printer');
    const { unmount } = render(<PrintLayout character={base} />);
    expect(screen.getByText('Heroic Inspiration: No')).toBeInTheDocument();
    unmount();
    render(<PrintLayout character={{ ...base, heroicInspiration: true }} />);
    expect(screen.getByText('Heroic Inspiration: Yes')).toBeInTheDocument();
    expect(buildPrintSheetData({ ...base, heroicInspiration: true }).heroicInspiration).toBe(true);
  });

  it('survives export/import and migration round-trips (absent stays absent)', () => {
    const c: Character = { ...createCharacter('Round'), heroicInspiration: true };
    const result = importFromJSON(exportToJSON(c));
    expect(result.success).toBe(true);
    expect(result.character!.heroicInspiration).toBe(true);

    const migrated = runMigration(c);
    expect(migrated.success).toBe(true);
    if (migrated.success) expect(migrated.character.heroicInspiration).toBe(true);

    const plain = importFromJSON(exportToJSON(createCharacter('Plain')));
    expect(plain.character!.heroicInspiration).toBeUndefined();
  });
});
