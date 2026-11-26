import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CreationWizard } from '../CreationWizard';
import { ROLLING_HOUSE_RULES_KEY } from '../../../hooks/useRollingHouseRules';

const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|Finish)$/ }));

function goToAbilities() {
  fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
  fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Tess' } });
  next();
  fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
  fireEvent.change(screen.getByLabelText('Intelligence background increase'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Wisdom background increase'), { target: { value: '1' } });
  next();
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'human' } });
  next();
  for (let i = 0; i < 10 && !screen.queryByRole('heading', { name: /Ability Scores/ }); i++) next();
  fireEvent.click(screen.getByRole('tab', { name: 'Roll 4d6' }));
}

beforeEach(() => localStorage.clear());

describe('Creation wizard: house-rule rolling methods', () => {
  it('hides every house-rule method when none is enabled (default)', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    goToAbilities();
    expect(screen.queryByLabelText('Rolling method')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Roll 4d6 \(drop lowest\)/ })).toBeInTheDocument();
  });

  it('offers only the enabled methods, plus the PHB method', () => {
    localStorage.setItem(ROLLING_HOUSE_RULES_KEY, JSON.stringify(['2d6-plus-6', 'grid-6x6']));
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    goToAbilities();
    const select = screen.getByLabelText('Rolling method') as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toEqual([
      'Standard: 4d6, drop lowest (PHB)',
      '2d6 + 6 (Heroic)',
      'The 6x6 Grid (3d6)',
      'The 6x6 Grid (4d6, drop lowest)',
    ]);
  });

  it('rolls 2d6 + 6 scores (8..18) that can be assigned', () => {
    localStorage.setItem(ROLLING_HOUSE_RULES_KEY, JSON.stringify(['2d6-plus-6']));
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    goToAbilities();
    fireEvent.change(screen.getByLabelText('Rolling method'), { target: { value: '2d6-plus-6' } });
    fireEvent.click(screen.getByRole('button', { name: /Roll: 2d6 \+ 6 \(Heroic\)/ }));
    const select = screen.getByLabelText('Strength score assignment') as HTMLSelectElement;
    const values = Array.from(select.options)
      .map((o) => Number(o.textContent))
      .filter((n) => Number.isFinite(n) && n > 0);
    expect(values).toHaveLength(6);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(8);
      expect(v).toBeLessThanOrEqual(18);
    }
  });

  it('6x6 grid: rolls 36 cells, then a chosen line becomes the six scores', () => {
    localStorage.setItem(ROLLING_HOUSE_RULES_KEY, JSON.stringify(['grid-6x6']));
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    goToAbilities();
    fireEvent.change(screen.getByLabelText('Rolling method'), { target: { value: 'grid-3d6' } });
    fireEvent.click(screen.getByRole('button', { name: /Roll: The 6x6 Grid \(3d6\)/ }));
    const cells = Array.from({ length: 36 }, (_, i) => Number(screen.getByTestId(`grid-cell-${i}`).textContent));
    expect(cells).toHaveLength(36);
    fireEvent.change(screen.getByLabelText('Grid line'), { target: { value: 'col-2' } });
    const expected = [0, 1, 2, 3, 4, 5].map((r) => cells[r * 6 + 1]);
    expect(screen.getByText(new RegExp(`Rolled: ${expected.join(', ')}\\.`))).toBeInTheDocument();
    for (const i of [1, 7, 13, 19, 25, 31]) {
      expect(screen.getByTestId(`grid-cell-${i}`)).toHaveAttribute('data-selected', 'true');
    }
    expect(screen.getByTestId('grid-cell-0')).toHaveAttribute('data-selected', 'false');
  });
});
