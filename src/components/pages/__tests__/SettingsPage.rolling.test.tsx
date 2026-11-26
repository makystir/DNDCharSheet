import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsPage } from '../SettingsPage';
import { createCharacter } from '../../../storage/character-store';
import { getEnabledRollingHouseRules } from '../../../hooks/useRollingHouseRules';
import { ROLLING_HOUSE_RULES, ROLLING_HOUSE_RULE_IDS } from '../../../logic/house-rule-rolling';

afterEach(() => localStorage.clear());

function renderSettings() {
  const onChange = vi.fn();
  render(
    <SettingsPage
      theme="dark"
      onThemeToggle={vi.fn()}
      character={createCharacter('Tester')}
      onChange={onChange}
      onAdopt={vi.fn(async (c) => c)}
      onRestored={vi.fn()}
    />,
  );
  return { onChange };
}

describe('SettingsPage: ability score rolling house rules', () => {
  it('shows one toggle per method, all off by default', () => {
    renderSettings();
    for (const id of ROLLING_HOUSE_RULE_IDS) {
      expect(screen.getByLabelText(`Enable ${ROLLING_HOUSE_RULES[id].name} (house rule)`)).not.toBeChecked();
    }
  });
  it('toggling persists app-wide and does not touch the character', () => {
    const { onChange } = renderSettings();
    fireEvent.click(screen.getByLabelText('Enable 70+ Minimum Total (house rule)'));
    expect(getEnabledRollingHouseRules()).toEqual(['min-total-70']);
    expect(screen.getByLabelText('Enable 70+ Minimum Total (house rule)')).toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });
});
