import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { AdvancementPage } from '../AdvancementPage';
import { SettingsPage } from '../SettingsPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

afterEach(cleanup);

/**
 * Stage 3 extras on the Advancement / Settings pages: owed spell picks in Choices
 * Pending (linking to Spells), multiclass skill picks, bonus-feat slots behind the
 * opt-in house rule. The counts and rules live in logic tests.
 */
function renderAdvancement(overrides: Partial<Character>) {
  let latest: Character = { ...createCharacter('Tester'), ...overrides };
  function Harness() {
    const [character, setCharacter] = useState<Character>(latest);
    return (
      <AdvancementPage
        character={character}
        now={() => 1000}
        onChange={(next) => {
          latest = next;
          setCharacter(next);
        }}
      />
    );
  }
  render(<Harness />);
  return { get: () => latest };
}

describe('Choices Pending: owed spell picks', () => {
  it('a Wizard 2 with nothing chosen lists cantrips, spellbook and prepared with Spells links', () => {
    renderAdvancement({ level: 2, classes: [{ id: 'wizard', level: 2 }] });
    for (const kind of ['cantrips', 'spellbook', 'prepared']) {
      const item = screen.getByTestId(`pending-spell-${kind}`);
      expect(within(item).getByRole('link', { name: 'Choose on the Spells page' })).toHaveAttribute('href', '#spells');
    }
  });

  it('each spell item is counted once in the heading (no double count)', () => {
    renderAdvancement({
      level: 1,
      classes: [{ id: 'wizard', level: 1 }],
      advancement: { levels: [] },
    });
    // 3 spell items (cantrips, spellbook, prepared); class skills are not a spell pick.
    const heading = screen.getByRole('heading', { name: /Choices Pending/ });
    const listed = screen.getAllByTestId(/^pending-spell-/).length;
    expect(listed).toBe(3);
    expect(heading.textContent).toContain(`(${listed})`);
  });

  it('a Warlock 11 lists the level 6 Mystic Arcanum', () => {
    renderAdvancement({ level: 11, classes: [{ id: 'warlock', level: 11 }] });
    expect(screen.getByTestId('pending-spell-mystic-arcanum-6')).toHaveTextContent('Level 6 Mystic Arcanum spell');
  });

  it('a Fighter has no spell items', () => {
    renderAdvancement({ level: 1, classes: [{ id: 'fighter', level: 1 }] });
    expect(screen.queryAllByTestId(/^pending-spell-/)).toHaveLength(0);
  });
});

describe('Choices Pending: multiclass skill picks', () => {
  it('Fighter 1 / Rogue 1 lists the Rogue multiclass skill and a pick clears it', () => {
    const { get } = renderAdvancement({
      level: 2,
      classes: [
        { id: 'fighter', level: 1 },
        { id: 'rogue', level: 1 },
      ],
    });
    const item = screen.getByTestId('pending-multiclass-rogue-skill');
    fireEvent.click(within(item).getByLabelText('Stealth'));
    expect(get().classes?.[1].skillChoices).toEqual(['stealth']);
    expect(screen.queryByTestId('pending-multiclass-rogue-skill')).not.toBeInTheDocument();
  });
});

describe('Feat slots: bonus feats (house rule)', () => {
  const l20: Partial<Character> = {
    level: 20,
    classes: [{ id: 'fighter', level: 20 }],
    advancement: { leveling: { mode: 'xp', xp: 415_000 } },
  };

  it('off by default: no bonus slot labels', () => {
    renderAdvancement(l20);
    expect(screen.queryByText(/Bonus feat \(XP\)/)).not.toBeInTheDocument();
  });

  it('on: two bonus slots at 415,000 XP', () => {
    renderAdvancement({ ...l20, houseRules: { bonusFeatsAfter20: true } });
    expect(screen.getAllByText(/Bonus feat \(XP\)/)).toHaveLength(2);
  });
});

describe('Settings: bonus feats house rule', () => {
  it('is off by default and toggles houseRules.bonusFeatsAfter20', () => {
    let latest: Character = createCharacter('Tester');
    const onChange = vi.fn();
    function Harness() {
      const [character, setCharacter] = useState<Character>(latest);
      return (
        <SettingsPage
          theme="dark"
          onThemeToggle={vi.fn()}
          character={character}
          onChange={(next) => {
            onChange(next);
            latest = next;
            setCharacter(next);
          }}
          onAdopt={vi.fn(async (c: Character) => c)}
          onRestored={vi.fn()}
        />
      );
    }
    render(<Harness />);
    const toggle = screen.getByLabelText('Bonus feats after level 20 (house rule)');
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(latest.houseRules?.bonusFeatsAfter20).toBe(true);
    expect(screen.getByLabelText('Bonus feats after level 20 (house rule)')).toBeChecked();
  });
});
