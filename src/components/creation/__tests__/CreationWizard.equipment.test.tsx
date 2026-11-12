import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CreationWizard } from '../CreationWizard';
import { ABILITIES } from '../../../types/character';

function next() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

/** Walk the wizard to the Equipment step for the given class (acolyte + human). */
function toEquipment(classId: string) {
  fireEvent.change(screen.getByLabelText('Class'), { target: { value: classId } });
  fireEvent.change(screen.getByLabelText('Character Name'), { target: { value: 'Tester' } });
  next();
  fireEvent.change(screen.getByLabelText('Background'), { target: { value: 'acolyte' } });
  fireEvent.change(screen.getByLabelText('Intelligence background increase'), {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByLabelText('Wisdom background increase'), { target: { value: '1' } });
  next(); // Background -> Species
  fireEvent.change(screen.getByLabelText('Species'), { target: { value: 'human' } });
  next(); // Skills
  next(); // Ability Scores
  const names: Record<string, string> = {
    str: 'Strength',
    dex: 'Dexterity',
    con: 'Constitution',
    int: 'Intelligence',
    wis: 'Wisdom',
    cha: 'Charisma',
  };
  ABILITIES.forEach((a, i) => {
    fireEvent.change(screen.getByLabelText(`${names[a]} score assignment`), {
      target: { value: String(i) },
    });
  });
  next(); // (Spells for casters) / Details
  while (!screen.queryByRole('region', { name: 'Class equipment' })) {
    next();
  }
}

describe('CreationWizard equipment step', () => {
  it('shows the class options and a gold budget with a breakdown', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toEquipment('fighter');
    expect(screen.getByRole('tab', { name: 'Package A' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Package B' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '155 GP' })).toBeInTheDocument();
    // Fighter A (4 GP) + Acolyte package (8 GP) = 12 GP.
    expect(screen.getByRole('button', { name: /^Gold remaining:/ })).toHaveTextContent('12 GP');
  });

  it('spends gold on the shop and updates what is left', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toEquipment('fighter');
    fireEvent.click(screen.getByRole('tab', { name: '155 GP' }));
    // 155 + 8 = 163 GP.
    expect(screen.getByRole('button', { name: /^Gold remaining:/ })).toHaveTextContent('163 GP');
    fireEvent.click(screen.getByRole('button', { name: 'Buy one Dagger' }));
    expect(screen.getByRole('button', { name: /^Gold remaining:/ })).toHaveTextContent('161 GP');
  });

  it('flags a Wizard buying Plate armor, without blocking the purchase', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toEquipment('wizard');
    fireEvent.click(screen.getByRole('tab', { name: '55 GP' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Armor' }));
    // Not enough gold yet: Plate Armor costs 1,500 GP, so the buy button is disabled.
    expect(screen.getByRole('button', { name: 'Buy one Plate Armor' })).toBeDisabled();
    // Studded leather (45 GP) is affordable but a Wizard has no armor training.
    fireEvent.click(screen.getByRole('button', { name: 'Buy one Studded Leather Armor' }));
    const alert = screen.getByRole('alert', { name: /may not be able to use well/ });
    expect(within(alert).getByText(/isn't trained with light armor/)).toBeInTheDocument();
    expect(within(alert).getByText(/can.t cast spells/)).toBeInTheDocument();
  });

  it('flags a Rogue buying a Greatsword but not a Rapier', () => {
    render(<CreationWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
    toEquipment('rogue');
    fireEvent.click(screen.getByRole('tab', { name: '100 GP' }));
    expect(screen.getByRole('button', { name: 'Heads up about Greatsword' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Heads up about Rapier' })).toBeNull();
  });

  it('grants the class package, the purchases and the leftover gold when finished', () => {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    toEquipment('fighter');
    fireEvent.click(screen.getByRole('tab', { name: '155 GP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Buy one Dagger' }));
    next(); // Review
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    const character = onComplete.mock.calls[0][0];
    // Gold only (no class package): 155 + 8 (Acolyte package) - 2 (Dagger) = 161 GP.
    expect(character.coins.gp).toBe(161);
    expect(
      character.inventory.some((i: { catalogId?: string }) => i.catalogId === 'dagger'),
    ).toBe(true);
  });

  it('grants the Fighter package and wears the Chain Mail', () => {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    toEquipment('fighter');
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    const character = onComplete.mock.calls[0][0];
    const chain = character.inventory.find((i: { catalogId?: string }) => i.catalogId === 'chain-mail');
    expect(chain).toBeDefined();
    expect(character.equipped.armorItemId).toBe(chain.id);
    expect(character.coins.gp).toBe(12);
  });

  it('asks the Monk to pick a tool or instrument and grants the pick', () => {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    toEquipment('monk');
    fireEvent.change(screen.getByLabelText("Choose Artisan's Tools or Musical Instrument"), {
      target: { value: 'Lute' },
    });
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    const character = onComplete.mock.calls[0][0];
    expect(character.inventory.some((i: { catalogId?: string }) => i.catalogId === 'instrument-lute')).toBe(true);
  });

  it('gives a free trinket from the table', () => {
    const onComplete = vi.fn();
    render(<CreationWizard onComplete={onComplete} onCancel={vi.fn()} />);
    toEquipment('fighter');
    fireEvent.change(screen.getByLabelText('Choose a trinket'), { target: { value: '100' } });
    expect(screen.getByText(/metal urn containing the ashes of a hero/, { selector: 'p' })).toBeInTheDocument();
    // A rolled trinket can't be re-rolled (roll once); a choice can be cleared first.
    expect(screen.getByRole('button', { name: /Roll for a trinket/ })).toBeDisabled();
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    const character = onComplete.mock.calls[0][0];
    expect(
      character.inventory.some(
        (i: { name?: string; notes?: string }) =>
          i.notes === 'Trinket' && i.name === 'A metal urn containing the ashes of a hero',
      ),
    ).toBe(true);
  });
});