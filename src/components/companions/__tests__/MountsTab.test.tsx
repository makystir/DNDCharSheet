import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MountsTab } from '../MountsTab';
import type { Character } from '../../../types/character';
import { plainCharacter, track, undoStub } from './helpers';
import { Stateful } from './Stateful';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

function renderTab(initial: Character, latest?: { current: Character }) {
  render(
    <Stateful initial={initial} onState={latest ? track(latest) : undefined}>
      {(character, onChange) => <MountsTab character={character} onChange={onChange} undo={undoStub()} />}
    </Stateful>,
  );
}

function setCarried(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe('MountsTab', () => {
  it('adds a mount from the table animals and removes it again', () => {
    const latest = { current: plainCharacter() };
    renderTab(latest.current, latest);
    expect(screen.getByText('No mounts or pack animals yet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add Mount or Animal' }));
    const dialog = screen.getByRole('dialog', { name: 'Add mount or animal' });
    fireEvent.change(within(dialog).getByLabelText('Animal'), { target: { value: 'pony' } });
    fireEvent.change(within(dialog).getByLabelText('Nickname (optional)'), { target: { value: 'Biscuit' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add animal' }));
    expect(latest.current.mounts).toHaveLength(1);
    expect(latest.current.mounts?.[0]).toMatchObject({ creatureId: 'pony', nickname: 'Biscuit' });

    fireEvent.click(screen.getByRole('button', { name: /Biscuit/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Biscuit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(latest.current.mounts ?? []).toHaveLength(0);
  });

  it('shows the printed capacity with a breakdown and warns only past the limit', () => {
    renderTab(plainCharacter({ mounts: [{ id: 'm1', creatureId: 'pony' }] }));
    fireEvent.click(screen.getByRole('button', { name: /Pony/ }));
    // Pony capacity 225 lb (PHB Mounts and Other Animals table).
    expect(screen.getByRole('button', { name: /^Pony carrying capacity:/ })).toHaveTextContent('225 lb');

    setCarried('Pony weight carried', '225');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('0 lb remaining')).toBeInTheDocument();

    setCarried('Pony weight carried', '226');
    expect(screen.getByRole('alert')).toHaveTextContent('Over carrying capacity by 1 lb');
    expect(screen.getByText('Over capacity')).toBeInTheDocument();
  });

  it('the Mule keeps its printed 420 lb (Beast of Burden is not applied twice)', () => {
    renderTab(plainCharacter({ mounts: [{ id: 'm1', creatureId: 'mule' }] }));
    fireEvent.click(screen.getByRole('button', { name: /Mule/ }));
    expect(screen.getByRole('button', { name: /^Mule carrying capacity:/ })).toHaveTextContent('420 lb');
  });

  it('sums pulling animals into a five-times vehicle limit', () => {
    renderTab(
      plainCharacter({
        mounts: [
          { id: 'm1', creatureId: 'draft-horse', pullsVehicle: true, vehicleWeightLb: 600 },
          { id: 'm2', creatureId: 'draft-horse', pullsVehicle: true },
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

  it('warns when the vehicle is over the pull limit', () => {
    renderTab(plainCharacter({ mounts: [{ id: 'm1', creatureId: 'pony', pullsVehicle: true, vehicleWeightLb: 1126 }] }));
    // Pony 225 x 5 = 1125; one pound over.
    expect(within(screen.getByTestId('vehicle-summary')).getByRole('alert')).toHaveTextContent('over the pull limit by 1 lb');
  });

  it('shows barding at four times the cost and twice the weight', () => {
    renderTab(plainCharacter({ mounts: [{ id: 'm1', creatureId: 'warhorse', bardingArmorId: 'plate-armor' }] }));
    fireEvent.click(screen.getByRole('button', { name: /Warhorse/ }));
    // Plate: 1500 GP, 65 lb -> barding 6000 GP, 130 lb.
    expect(screen.getByRole('button', { name: /^Warhorse barding cost:/ })).toHaveTextContent('6000 GP');
    expect(screen.getByRole('button', { name: /^Warhorse barding weight:/ })).toHaveTextContent('130 lb');
  });
});
