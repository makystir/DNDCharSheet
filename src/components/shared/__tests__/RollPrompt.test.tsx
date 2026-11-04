import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { RollPrompt, type RollPromptResult } from '../RollPrompt';
import type { RNG } from '../../../logic/random';

/** A deterministic RNG that replays a fixed sequence of floats in [0, 1). */
function sequence(values: number[]): RNG {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('RNG over-drawn');
    return values[i++];
  };
}

// d20 face = floor(r * 20) + 1, so r = (face - 1) / 20 (+ a hair) gives that face.
const face = (n: number) => (n - 1) / 20 + 0.001;

function setup(props: Partial<Parameters<typeof RollPrompt>[0]> = {}) {
  const onResolve = vi.fn<(r: RollPromptResult) => void>();
  const onClose = vi.fn();
  render(
    <RollPrompt
      title="Test Roll"
      exhaustionLevel={0}
      onResolve={onResolve}
      onClose={onClose}
      diceEntryMode="manual"
      {...props}
    />,
  );
  return { onResolve, onClose };
}

afterEach(() => {
  document.body.style.overflow = '';
});

describe('RollPrompt: manual entry', () => {
  it('rejects values outside 1-20 and blanks with an alert', () => {
    const { onResolve } = setup();
    const input = screen.getByLabelText('Your d20 roll');
    for (const bad of ['', '0', '21', '-3', '1.5', 'abc']) {
      fireEvent.change(input, { target: { value: bad } });
      fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
      expect(screen.getByRole('alert')).toHaveTextContent(/between 1 and 20/);
    }
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('shows the die, the Exhaustion line and the total, then hands back the raw die', () => {
    const { onResolve } = setup({ exhaustionLevel: 2, modifiers: [{ label: 'Bless', value: 1 }] });
    fireEvent.change(screen.getByLabelText('Your d20 roll'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(screen.getByTestId('roll-dice')).toHaveTextContent('12');
    const total = within(screen.getByTestId('roll-total')).getByRole('button');
    // 12 (d20) + 1 (Bless) - 4 (Exhaustion) = 9, every component visible.
    expect(total).toHaveTextContent('9');
    expect(total.getAttribute('aria-label')).toContain('12 (d20 roll)');
    expect(total.getAttribute('aria-label')).toContain('1 (Bless)');
    expect(total.getAttribute('aria-label')).toContain('4 (Exhaustion -4)');

    fireEvent.click(screen.getByRole('button', { name: 'Apply result' }));
    expect(onResolve).toHaveBeenCalledWith({ natural: 12, rolls: [12], mode: 'normal', total: 9 });
  });

  it('judges on the raw die: a natural 20 stays 20 even when Exhaustion lowers the total', () => {
    const { onResolve } = setup({ exhaustionLevel: 3 });
    fireEvent.change(screen.getByLabelText('Your d20 roll'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply result' }));
    expect(onResolve.mock.calls[0][0].natural).toBe(20);
    expect(onResolve.mock.calls[0][0].total).toBe(14);
  });

  it('asks for two dice with Advantage and keeps the higher', () => {
    const { onResolve } = setup();
    fireEvent.click(screen.getByLabelText('Advantage'));
    fireEvent.change(screen.getByLabelText('First d20 roll'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/both d20 results/);
    fireEvent.change(screen.getByLabelText('Second d20 roll'), { target: { value: '17' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    expect(screen.getByTestId('roll-dice')).toHaveTextContent('417');
    fireEvent.click(screen.getByRole('button', { name: 'Apply result' }));
    expect(onResolve).toHaveBeenCalledWith({ natural: 17, rolls: [4, 17], mode: 'advantage', total: 17 });
  });

  it('keeps the lower die with Disadvantage', () => {
    const { onResolve } = setup({ initialMode: 'disadvantage' });
    fireEvent.change(screen.getByLabelText('First d20 roll'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Second d20 roll'), { target: { value: '17' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply result' }));
    expect(onResolve.mock.calls[0][0]).toMatchObject({ natural: 4, rolls: [4, 17], mode: 'disadvantage' });
  });

  it('lets a manual result be edited before it is applied', () => {
    const { onResolve } = setup();
    fireEvent.change(screen.getByLabelText('Your d20 roll'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit result' }));
    fireEvent.change(screen.getByLabelText('Your d20 roll'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply result' }));
    expect(onResolve.mock.calls[0][0].natural).toBe(15);
  });
});

describe('RollPrompt: automatic roll', () => {
  it('rolls from the injected RNG, shows the die, and offers no re-roll', () => {
    const { onResolve } = setup({ diceEntryMode: 'auto', rng: sequence([face(14)]) });
    expect(screen.queryByLabelText('Your d20 roll')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    expect(screen.getByTestId('roll-dice')).toHaveTextContent('14');
    expect(screen.queryByRole('button', { name: /roll again/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apply result' }));
    expect(onResolve).toHaveBeenCalledWith({ natural: 14, rolls: [14], mode: 'normal', total: 14 });
  });

  it('rolls two dice for Disadvantage and keeps the lower', () => {
    const { onResolve } = setup({
      diceEntryMode: 'auto',
      rng: sequence([face(18), face(6)]),
      initialMode: 'disadvantage',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply result' }));
    expect(onResolve.mock.calls[0][0]).toMatchObject({ natural: 6, rolls: [18, 6] });
  });
});

describe('RollPrompt: dialog behaviour', () => {
  it('is a labelled modal dialog, locks body scroll, and closes on Escape', () => {
    const { onClose } = setup({ hint: 'DC 10' });
    const dialog = screen.getByRole('dialog', { name: 'Test Roll' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('DC 10')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cancel and overlay click close without resolving', () => {
    const { onClose, onResolve } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('moves focus into the dialog (focus trap)', () => {
    setup();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });
});
