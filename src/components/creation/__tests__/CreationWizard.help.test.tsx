import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CreationWizard } from '../CreationWizard';

function next() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  // The Class Features step (classes with level 1 feature picks) never blocks: step over it.
  if (screen.queryByRole('heading', { name: /Class Features/ })) {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  }
}

function toOrigin() {
  fireEvent.change(screen.getByLabelText('Class'), { target: { value: 'fighter' } });
  fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Aldric' } });
  next();
}

describe('CreationWizard help: backgrounds and class skills', () => {
  it('shows the selected background description and grants', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toOrigin();
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
    const panel = screen.getByRole('region', { name: 'Acolyte background details' });
    expect(within(panel).getByText(/Served in a temple/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'About Insight' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'About Religion' })).toBeInTheDocument();
  });

  it('lets the compare list choose a background', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toOrigin();
    fireEvent.click(screen.getByText('Compare all backgrounds'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose Sage' }));
    expect(screen.getByLabelText('Background')).toHaveValue('sage');
    expect(screen.getByRole('region', { name: 'Sage background details' })).toBeInTheDocument();
  });

  it('opens a class skill tooltip without toggling the checkbox', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toOrigin();
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
    fireEvent.change(screen.getByLabelText('Intelligence background increase'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Wisdom background increase'), {
      target: { value: '1' },
    });
    next(); // Background -> Species
    fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'human' } });
    next();
    const checkbox = screen.getByRole('checkbox', { name: 'Acrobatics' });
    expect(checkbox).not.toBeChecked();
    const fieldset = screen.getByRole('group', { name: /Choose \d+ class skill/ });
    fireEvent.click(within(fieldset).getByRole('button', { name: 'About Acrobatics' }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });
});
