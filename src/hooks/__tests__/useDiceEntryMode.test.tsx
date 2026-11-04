import { afterEach, describe, expect, it } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import {
  DICE_ENTRY_MODE_KEY,
  getDiceEntryMode,
  setDiceEntryModeStorage,
  useDiceEntryMode,
} from '../useDiceEntryMode';

afterEach(() => {
  localStorage.clear();
});

function Probe() {
  const { mode } = useDiceEntryMode();
  return <span data-testid="probe">{mode}</span>;
}

describe('useDiceEntryMode', () => {
  it('defaults to auto and uses the renamed storage key', () => {
    expect(DICE_ENTRY_MODE_KEY).toBe('dnd-dice-entry-mode');
    expect(getDiceEntryMode()).toBe('auto');
    const { result } = renderHook(() => useDiceEntryMode());
    expect(result.current.mode).toBe('auto');
  });

  it('treats an unknown stored value as auto', () => {
    localStorage.setItem(DICE_ENTRY_MODE_KEY, 'bogus');
    expect(getDiceEntryMode()).toBe('auto');
  });

  it('setMode persists the preference', () => {
    const { result } = renderHook(() => useDiceEntryMode());
    act(() => result.current.setMode('manual'));
    expect(result.current.mode).toBe('manual');
    expect(localStorage.getItem(DICE_ENTRY_MODE_KEY)).toBe('manual');
    expect(getDiceEntryMode()).toBe('manual');
  });

  it('syncs other mounted consumers in the same tab', () => {
    const { result } = renderHook(() => useDiceEntryMode());
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('auto');
    act(() => result.current.setMode('manual'));
    expect(screen.getByTestId('probe')).toHaveTextContent('manual');
  });

  it('syncs on a cross-tab storage event', () => {
    render(<Probe />);
    act(() => {
      setDiceEntryModeStorage('manual');
      window.dispatchEvent(new Event('storage'));
    });
    expect(screen.getByTestId('probe')).toHaveTextContent('manual');
  });
});
