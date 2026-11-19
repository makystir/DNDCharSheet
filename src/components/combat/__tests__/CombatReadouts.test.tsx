import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CombatStatusStrip } from '../CombatStatusStrip';
import { HouseRuleIndicator } from '../HouseRuleIndicator';
import { createCharacter } from '../../../storage/character-store';
import { characterResources } from '../../../logic/resources';

function char(overrides = {}) {
  return { ...createCharacter('Tester'), ...overrides };
}

// The Combat page's AC / Speed / Passive Perception glance (it replaced the
// old Defenses & Combat Stats panel, which only repeated these numbers).
describe('CombatStatusStrip', () => {
  it('shows AC, Speed and Passive Perception as CalculatedValues with their breakdowns', () => {
    render(
      <CombatStatusStrip
        character={char({
          species: { id: 'human' },
          abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 12, cha: 10 },
        })}
      />,
    );
    const ac = screen.getByRole('button', { name: /^Armor Class:/ });
    expect(ac).toHaveTextContent('12'); // 10 + Dex +2
    const speed = screen.getByRole('button', { name: /^Speed:/ });
    expect(speed).toHaveTextContent('30 ft'); // Human base speed
    const pp = screen.getByRole('button', { name: /^Passive Perception:/ });
    expect(pp).toHaveTextContent('11'); // 10 + Wis +1
  });

  it('reflects a Barbarian Unarmored Defense AC (Con-based)', () => {
    render(
      <CombatStatusStrip
        character={char({
          level: 1,
          abilities: { str: 10, dex: 14, con: 16, int: 10, wis: 10, cha: 10 },
          classes: [{ id: 'barbarian', level: 1 }],
        })}
      />,
    );
    const ac = screen.getByRole('button', { name: /^Armor Class:/ });
    expect(ac).toHaveTextContent('15'); // 10 + 2 (Dex) + 3 (Con)
  });
});

describe('CombatStatusStrip resource chips', () => {
  it('caps the chips at 4 and summarises the rest as "+N more"', () => {
    const c = char({
      level: 15,
      classes: [
        { id: 'barbarian', level: 3 },
        { id: 'fighter', level: 3 },
        { id: 'paladin', level: 3 },
        { id: 'cleric', level: 3 },
        { id: 'bard', level: 3 },
      ],
    });
    const total = characterResources(c).length;
    expect(total).toBeGreaterThan(4); // precondition: enough trackers to overflow
    const { container } = render(<CombatStatusStrip character={c} />);
    expect(container.querySelectorAll('[data-testid^="strip-resource-"]:not([data-testid="strip-resource-more"])')).toHaveLength(4);
    expect(screen.getByTestId('strip-resource-more')).toHaveTextContent(`+${total - 4} more`);
  });

  it('shows no overflow chip when the trackers fit', () => {
    render(<CombatStatusStrip character={char({ level: 1, classes: [{ id: 'fighter', level: 1 }] })} />);
    expect(screen.queryByTestId('strip-resource-more')).toBeNull();
  });
});

describe('HouseRuleIndicator', () => {
  it('renders nothing when both house rules are at default', () => {
    const { container } = render(<HouseRuleIndicator houseRules={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists Rolled HP when the rule is on', () => {
    render(<HouseRuleIndicator houseRules={{ rolledHp: true }} />);
    const note = screen.getByRole('note', { name: 'Active house rules' });
    expect(within(note).getByText('Rolled HP')).toBeInTheDocument();
  });

  it('lists Variant Encumbrance when the rule is on', () => {
    render(<HouseRuleIndicator houseRules={{ variantEncumbrance: true }} />);
    const note = screen.getByRole('note', { name: 'Active house rules' });
    expect(within(note).getByText('Variant Encumbrance')).toBeInTheDocument();
  });
});
