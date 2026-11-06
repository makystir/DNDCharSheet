import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { DefenseReadout } from '../DefenseReadout';
import { SpellSlotSummary } from '../SpellSlotSummary';
import { HouseRuleIndicator } from '../HouseRuleIndicator';
import { createCharacter } from '../../../storage/character-store';

function char(overrides = {}) {
  return { ...createCharacter('Tester'), ...overrides };
}

describe('DefenseReadout', () => {
  it('shows AC and Speed as CalculatedValues with their breakdowns', () => {
    render(
      <DefenseReadout
        character={char({
          species: { id: 'human' },
          abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
        })}
      />,
    );
    const ac = screen.getByRole('button', { name: /^Armor Class:/ });
    expect(ac).toHaveTextContent('12'); // 10 + Dex +2
    const speed = screen.getByRole('button', { name: /^Speed:/ });
    expect(speed).toHaveTextContent('30 ft'); // Human base speed
  });

  it('reflects a Barbarian Unarmored Defense AC (Con-based)', () => {
    render(
      <DefenseReadout
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

  it('shows movement used / remaining dashes out of combat', () => {
    render(<DefenseReadout character={char()} />);
    // With no combat state, movement used is "—" and remaining falls back to allowance.
    expect(screen.getByTestId('defend-movement-used')).toHaveTextContent('—');
  });

  it('P2: consolidates HP maximum, Initiative and Passive Perception into the one panel', () => {
    render(
      <DefenseReadout
        character={char({
          level: 3,
          abilities: { str: 10, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
          classes: [{ id: 'wizard', level: 3 }],
        })}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Defenses & Combat Stats' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hit Point Maximum/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Initiative/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Passive Perception/ })).toBeInTheDocument();
  });

  it('P2: hides the Adjust editors when read-only (no onChange), shows them with onChange', () => {
    const { rerender } = render(<DefenseReadout character={char()} />);
    // Read-only: no AC override / Initiative bonus inputs.
    expect(screen.queryByLabelText('Armor Class override')).toBeNull();
    expect(screen.queryByLabelText('Initiative bonus')).toBeNull();

    rerender(<DefenseReadout character={char()} onChange={() => {}} />);
    expect(screen.getByLabelText('Armor Class override')).toBeInTheDocument();
    expect(screen.getByLabelText('Initiative bonus')).toBeInTheDocument();
  });

  it('P2: editing the AC override emits acOverride through onChange', () => {
    const onChange = vi.fn();
    render(<DefenseReadout character={char()} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Armor Class override'), {
      target: { value: '17' },
    });
    expect(onChange.mock.calls.at(-1)?.[0].acOverride).toBe(17);
  });
});

describe('SpellSlotSummary', () => {
  it('renders nothing for a non-caster', () => {
    const { container } = render(<SpellSlotSummary character={char({ classes: [{ id: 'fighter', level: 1 }] })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists standard spell-slot levels for a caster with available / max', () => {
    render(
      <SpellSlotSummary
        character={char({ level: 1, classes: [{ id: 'wizard', level: 1 }] })}
      />,
    );
    const list = screen.getByRole('list', { name: 'Spell slots' });
    // A level-1 Wizard has level-1 slots.
    expect(within(list).getByText('Level 1')).toBeInTheDocument();
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
