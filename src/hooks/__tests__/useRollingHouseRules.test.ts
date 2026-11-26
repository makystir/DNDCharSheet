import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  ROLLING_HOUSE_RULES_KEY,
  getEnabledRollingHouseRules,
  useRollingHouseRules,
} from '../useRollingHouseRules';

afterEach(() => localStorage.clear());

describe('useRollingHouseRules', () => {
  it('is off for every method by default', () => {
    expect(getEnabledRollingHouseRules()).toEqual([]);
    const { result } = renderHook(() => useRollingHouseRules());
    expect(result.current.enabled).toEqual([]);
  });
  it('enables and disables one method and persists it', () => {
    const { result } = renderHook(() => useRollingHouseRules());
    act(() => result.current.setEnabled('2d6-plus-6', true));
    act(() => result.current.setEnabled('grid-6x6', true));
    expect(result.current.enabled).toEqual(['2d6-plus-6', 'grid-6x6']);
    expect(JSON.parse(localStorage.getItem(ROLLING_HOUSE_RULES_KEY) ?? '[]')).toEqual(['2d6-plus-6', 'grid-6x6']);
    act(() => result.current.setEnabled('2d6-plus-6', false));
    expect(getEnabledRollingHouseRules()).toEqual(['grid-6x6']);
  });
  it('ignores malformed or unknown stored data', () => {
    localStorage.setItem(ROLLING_HOUSE_RULES_KEY, '{bad');
    expect(getEnabledRollingHouseRules()).toEqual([]);
    localStorage.setItem(ROLLING_HOUSE_RULES_KEY, JSON.stringify(['nope', '5d6-drop-two']));
    expect(getEnabledRollingHouseRules()).toEqual(['5d6-drop-two']);
  });
});
