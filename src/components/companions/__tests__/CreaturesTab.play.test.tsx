import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { CreaturesTab } from '../CreaturesTab';
import { CombatPage } from '../../pages/CombatPage';
import { OverviewSetup } from '../../pages/character/OverviewSetup';
import type { Character } from '../../../types/character';
import { slotLevels } from '../../../logic/spell-slot-spend';
import { plainCharacter, rangerCharacter, track, undoStub } from './helpers';
import { Stateful } from './Stateful';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

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

describe('Creatures tab: suggestions from class features and spells', () => {
  it('suggests the Primal Companion to a Beast Master and opens the add form on that source', () => {
    const latest = { current: rangerCharacter(3) };
    renderTab(latest.current, latest);
    const list = screen.getByTestId('creature-suggestions');
    fireEvent.click(within(list).getByRole('button', { name: 'Add Primal Companion' }));
    const dialog = screen.getByRole('dialog', { name: 'Add creature' });
    expect(within(dialog).getByLabelText('Source')).toHaveValue('primal-companion');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add creature' }));
    expect(latest.current.companions?.[0].origin).toBe('primal-companion');
    expect(screen.queryByTestId('creature-suggestions')).toBeNull();
  });

  it('lists the Primal Companion in Finish setting up until it is added', () => {
    render(<OverviewSetup character={{ ...rangerCharacter(3), classes: [{ id: 'ranger', level: 3, subclassId: 'beastMaster', skillChoices: ['animalHandling', 'athletics', 'insight'] }] }} />);
    expect(screen.getByTestId('overview-setup-primal-companion')).toHaveTextContent('Primal Companion');
    expect(screen.getByRole('link', { name: 'Add on Companions' })).toHaveAttribute('href', '#companions/creatures');
  });
});

describe('Creatures tab: Primal Companion revive and swap', () => {
  it('revives a beast at 0 HP by expending a spell slot', () => {
    const latest = { current: { ...rangerCharacter(5, 16), companions: [{ id: 'p1', creatureId: 'beast-of-the-land', origin: 'primal-companion' as const, hp: 0 }] } as Character };
    renderTab(latest.current, latest);
    open('p1');
    fireEvent.click(screen.getByRole('button', { name: 'Revive the beast' }));
    expect(latest.current.companions?.[0].hp).toBeUndefined();
    expect(slotLevels(latest.current).find((s) => s.level === 1)?.expended).toBe(1);
  });

  it('summons a different primal beast in its place', () => {
    const latest = { current: { ...rangerCharacter(5, 16), companions: [{ id: 'p1', creatureId: 'beast-of-the-land', origin: 'primal-companion' as const, hp: 4 }] } as Character };
    renderTab(latest.current, latest);
    open('p1');
    expect(screen.queryByRole('button', { name: 'Revive the beast' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Summon a different beast'), { target: { value: 'beast-of-the-sea' } });
    fireEvent.click(screen.getByRole('button', { name: 'Summon instead' }));
    expect(latest.current.companions?.[0]).toMatchObject({ creatureId: 'beast-of-the-sea' });
    expect(latest.current.companions?.[0].hp).toBeUndefined();
  });
});

describe('Combat page: Allies card', () => {
  it('is hidden with nobody tracked', () => {
    render(<CombatPage character={plainCharacter()} onChange={vi.fn()} />);
    expect(screen.queryByRole('list', { name: 'Allies' })).toBeNull();
  });

  it('shows each active ally with HP, AC and attack, read-only, with a link to edit them', () => {
    const c: Character = {
      ...rangerCharacter(5, 16),
      companions: [
        { id: 'p1', creatureId: 'beast-of-the-land', origin: 'primal-companion', nickname: 'Ash', hp: 0, conditions: [{ id: 'prone' }] },
        { id: 'gone', creatureId: 'cat', origin: 'pet', dismissed: true },
      ],
    };
    render(<CombatPage character={c} onChange={vi.fn()} />);
    const status = screen.getByTestId('combat-column-status');
    const ash = within(status).getByTestId('ally-p1');
    expect(ash).toHaveTextContent('Ash');
    expect(ash).toHaveTextContent('HP 0/30');
    expect(within(ash).getByRole('button', { name: /^Ash Armor Class:/ })).toHaveTextContent('16');
    expect(ash).toHaveTextContent("Beast's Strike");
    expect(ash).toHaveTextContent('Prone');
    expect(within(status).queryByTestId('ally-gone')).toBeNull();
    expect(within(status).queryByRole('button', { name: 'Damage' })).toBeNull();
    expect(within(status).getByRole('link', { name: 'Change HP or conditions on Companions' })).toHaveAttribute('href', '#companions/creatures');
  });
});
