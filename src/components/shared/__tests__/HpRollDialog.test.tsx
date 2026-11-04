import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HpRollDialog, type HpRollResult } from '../HpRollDialog';
import type { RNG } from '../../../logic/random';

/** A deterministic RNG that replays a fixed sequence of floats in [0, 1). */
function sequence(values: number[]): RNG {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error('RNG over-drawn');
    return values[i++];
  };
}

// dN face = floor(r * N) + 1, so r = (face - 1) / N (+ a hair) gives that face.
const faceFor = (n: number, sides: number) => (n - 1) / sides + 0.0001;

function setup(props: Partial<Parameters<typeof HpRollDialog>[0]> = {}) {
  const onResolve = vi.fn<(r: HpRollResult) => void>();
  const onClose = vi.fn();
  render(
    <HpRollDialog
      title="Roll Hit Points — level 4"
      hitDie={10}
      conMod={2}
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

describe('HpRollDialog: manual entry', () => {
  it('rejects a face outside 1..hitDie with an alert', () => {
    const { onResolve } = setup();
    const input = screen.getByLabelText('Your d10 roll');
    for (const bad of ['', '0', '11', '-1', '1.5', 'x']) {
      fireEvent.change(input, { target: { value: bad } });
      fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
      expect(screen.getByRole('alert')).toHaveTextContent(/between 1 and 10/);
    }
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('shows the HP-gained breakdown (face + Con mod) and hands back the raw face', () => {
    const { onResolve } = setup();
    fireEvent.change(screen.getByLabelText('Your d10 roll'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    // face 7 + Con +2 = 9 HP gained.
    expect(screen.getByRole('button', { name: /Hit Points gained: .*= 9/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Record HP' }));
    expect(onResolve).toHaveBeenCalledWith({ face: 7 });
  });

  it('notes the minimum-1 floor when face + a large negative Con would drop below 1', () => {
    setup({ hitDie: 6, conMod: -4 });
    fireEvent.change(screen.getByLabelText('Your d6 roll'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    // 1 + (-4) = -3 → floored to 1; the note explains the floor.
    expect(screen.getByRole('button', { name: /Hit Points gained: .*= 1/ })).toBeInTheDocument();
  });
});

describe('HpRollDialog: auto roll', () => {
  it('rolls the Hit Die with the injected RNG and hands back the face', () => {
    const { onResolve } = setup({ diceEntryMode: 'auto', rng: sequence([faceFor(10, 10)]) });
    fireEvent.click(screen.getByRole('button', { name: /Roll d10/ }));
    expect(screen.getByTestId('hp-roll-dice')).toHaveTextContent('10');
    fireEvent.click(screen.getByRole('button', { name: 'Record HP' }));
    expect(onResolve).toHaveBeenCalledWith({ face: 10 });
  });
});
