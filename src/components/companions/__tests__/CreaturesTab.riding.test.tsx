import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { CreaturesTab } from '../CreaturesTab';
import type { Character, CompanionRecord } from '../../../types/character';
import { plainCharacter, track, undoStub } from './helpers';
import { Stateful } from './Stateful';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

/** Mounts, pack animals and their riding details now live on the Creatures tab (formerly the Mounts tab). */
const pet = (over: Partial<CompanionRecord> & { id: string; creatureId: string }): CompanionRecord => ({ origin: 'pet', ...over });

function renderTab(initial: Character, latest?: { current: Character }) {
  render(
    <Stateful initial={initial} onState={latest ? track(latest) : undefined}>
      {(character, onChange) => <CreaturesTab character={character} onChange={onChange} undo={undoStub()} />}
    </Stateful>,
  );
}

function open(id: string) {
  fireEvent.click(within(screen.getByTestId(`companion-${id}`)).getAllByRole('button')[0]);
}

function setCarried(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe('CreaturesTab: riding and packing', () => {
  it('adds a pony as a pet from the table animals, with its capacity in the picker', () => {
    const latest = { current: plainCharacter() };
    renderTab(latest.current, latest);
    fireEvent.click(screen.getByRole('button', { name: 'Add Creature' }));
    const dialog = screen.getByRole('dialog', { name: 'Add creature' });
    fireEvent.change(within(dialog).getByLabelText('Source'), { target: { value: 'pet' } });
    expect(within(dialog).getByRole('option', { name: 'Pony (carries 225 lb)' })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Creature'), { target: { value: 'pony' } });
    fireEvent.change(within(dialog).getByLabelText('Nickname (optional)'), { target: { value: 'Biscuit' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add creature' }));
    expect(latest.current.companions?.[0]).toMatchObject({ creatureId: 'pony', origin: 'pet', nickname: 'Biscuit' });
  });

  it('opens Riding & packing for a mount and shows the printed capacity, warning only past the limit', () => {
    renderTab(plainCharacter({ companions: [pet({ id: 'm1', creatureId: 'pony' })] }));
    open('m1');
    expect(screen.getByRole('button', { name: 'Riding & packing' })).toHaveAttribute('aria-expanded', 'true');
    // Pony capacity 225 lb (PHB Mounts and Other Animals table).
    expect(screen.getByRole('button', { name: /^Pony carrying capacity:/ })).toHaveTextContent('225 lb');

    setCarried('Pony weight carried', '225');
    expect(screen.queryByText(/Over carrying capacity/)).toBeNull();
    expect(screen.getByText('0 lb remaining')).toBeInTheDocument();

    setCarried('Pony weight carried', '226');
    expect(screen.getByText(/Over carrying capacity by 1 lb/)).toBeInTheDocument();
    expect(screen.getByText('Over capacity')).toBeInTheDocument();
  });

  it('keeps Riding & packing closed (but available) for a creature that is not a mount', () => {
    renderTab(plainCharacter({ companions: [pet({ id: 'w', creatureId: 'wolf' })] }));
    open('w');
    const toggle = screen.getByRole('button', { name: 'Riding & packing' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('riding-packing')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId('riding-packing')).toBeInTheDocument();
  });

  it('the Mule keeps its printed 420 lb (Beast of Burden is not applied twice)', () => {
    renderTab(plainCharacter({ companions: [pet({ id: 'm1', creatureId: 'mule' })] }));
    open('m1');
    expect(screen.getByRole('button', { name: /^Mule carrying capacity:/ })).toHaveTextContent('420 lb');
  });

  it('sums pulling animals into a five-times vehicle limit', () => {
    renderTab(
      plainCharacter({
        companions: [
          pet({ id: 'm1', creatureId: 'draft-horse', pullsVehicle: true, vehicleWeightLb: 600 }),
          pet({ id: 'm2', creatureId: 'draft-horse', pullsVehicle: true }),
        ],
      }),
    );
    const summary = screen.getByTestId('vehicle-summary');
    // 2 x 540 lb x 5 = 5400 lb.
    expect(within(summary).getByRole('button', { name: /^Vehicle pull limit:/ })).toHaveTextContent('5400 lb');
    expect(summary).toHaveTextContent('Vehicle weight:600 lb');
    expect(summary).toHaveTextContent('Cargo left:4800 lb');
    expect(within(summary).queryByRole('alert')).toBeNull();
  });

  it('warns when the vehicle is over the pull limit, and ignores dismissed pullers', () => {
    renderTab(plainCharacter({ companions: [pet({ id: 'm1', creatureId: 'pony', pullsVehicle: true, vehicleWeightLb: 1126 })] }));
    // Pony 225 x 5 = 1125; one pound over.
    expect(within(screen.getByTestId('vehicle-summary')).getByRole('alert')).toHaveTextContent('over the pull limit by 1 lb');
    cleanup();
    renderTab(plainCharacter({ companions: [pet({ id: 'm1', creatureId: 'pony', pullsVehicle: true, dismissed: true })] }));
    expect(screen.queryByTestId('vehicle-summary')).toBeNull();
  });

  it('shows barding at four times the cost and twice the weight', () => {
    renderTab(plainCharacter({ companions: [pet({ id: 'm1', creatureId: 'warhorse', bardingArmorId: 'plate-armor' })] }));
    open('m1');
    // Plate: 1500 GP, 65 lb -> barding 6000 GP, 130 lb.
    expect(screen.getByRole('button', { name: /^Warhorse barding cost:/ })).toHaveTextContent('6000 GP');
    expect(screen.getByRole('button', { name: /^Warhorse barding weight:/ })).toHaveTextContent('130 lb');
  });

  it('shows the mounted-combat strip only when a creature is a mount or steed', () => {
    renderTab(plainCharacter({ companions: [pet({ id: 'c', creatureId: 'cat' })] }));
    expect(screen.queryByTestId('mounted-summary')).toBeNull();
    cleanup();
    renderTab(plainCharacter({ companions: [pet({ id: 'h', creatureId: 'riding-horse' })] }));
    expect(screen.getByRole('button', { name: /^Mounting movement cost:/ })).toHaveTextContent('15 ft');
  });
});
