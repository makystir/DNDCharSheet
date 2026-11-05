import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RollDialog } from '../RollDialog';
import type { RNG } from '../../../logic/random';

/** A seeded RNG that returns the provided fractions in order (then 0). */
function seededRng(fractions: number[]): RNG {
  let i = 0;
  return () => (i < fractions.length ? fractions[i++] : 0);
}

describe('RollDialog', () => {
  it('auto-rolls via the injected RNG and hands back the expected d20 payload', () => {
    const onRoll = vi.fn();
    // rollDie = floor(r*20)+1; 0.5*20=10 → face 11.
    render(
      <RollDialog
        label="Stealth"
        exhaustionLevel={0}
        modifiers={[{ label: 'Dex mod', value: 3 }]}
        dc={13}
        onRoll={onRoll}
        onClose={vi.fn()}
        diceEntryMode="auto"
        rng={seededRng([0.5])}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    fireEvent.click(screen.getByRole('button', { name: 'Log roll' }));

    expect(onRoll).toHaveBeenCalledTimes(1);
    const payload = onRoll.mock.calls[0][0];
    expect(payload.name).toBe('Stealth');
    expect(payload.natural).toBe(11);
    // 11 (die) + 3 (Dex) + 0 (exhaustion) = 14.
    expect(payload.total).toBe(14);
    expect(payload.mode).toBe('normal');
    expect(payload.dc).toBe(13);
    expect(payload.passed).toBe(true);
    expect(payload.isCrit).toBe(false);
    expect(payload.isFumble).toBe(false);
  });

  it('resolves a manual-entry roll (crit on a typed natural 20)', () => {
    const onRoll = vi.fn();
    render(
      <RollDialog
        label="Longsword attack"
        exhaustionLevel={0}
        modifiers={[{ label: 'Attack bonus', value: 7 }]}
        dc={16}
        onRoll={onRoll}
        onClose={vi.fn()}
        diceEntryMode="manual"
      />,
    );
    fireEvent.change(screen.getByLabelText('Your d20 roll'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Log roll' }));

    expect(onRoll).toHaveBeenCalledTimes(1);
    const payload = onRoll.mock.calls[0][0];
    expect(payload.natural).toBe(20);
    expect(payload.total).toBe(27);
    expect(payload.isCrit).toBe(true);
    expect(payload.passed).toBe(true);
  });
});
