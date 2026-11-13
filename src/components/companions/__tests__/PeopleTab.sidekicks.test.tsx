import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { CompanionsPage } from '../../pages/CompanionsPage';
import { CREATURE_CATALOG, CREATURE_LIST } from '../../../data/creatures';
import { creatureHitDie, sidekickEligibility, sidekickHitPointsGained } from '../../../logic/sidekick';
import type { Character } from '../../../types/character';
import { plainCharacter, withHouseRule } from './helpers';
import { renderPeople } from './PeopleHarness';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const EDITION = "Tasha's 2020 (5e, 2014 rules)";
const warriorCreature = CREATURE_LIST.find((c) => sidekickEligibility(c, 'warrior').eligible)!;

function renderTab(initial: Character, latest?: { current: Character }) {
  renderPeople(initial, { latest, filter: 'sidekicks' });
}

describe('House-rule gating of Sidekicks', () => {
  it('has no Sidekicks filter or content with the rule off, and shows both once it is on', () => {
    const off = render(<CompanionsPage character={plainCharacter()} onChange={() => {}} subTab="people" />);
    expect(screen.queryByRole('button', { name: /^Sidekicks/ })).toBeNull();
    expect(screen.queryByText(EDITION)).toBeNull();
    off.unmount();

    // The legacy #companions/sidekicks link lands on People with the Sidekicks filter.
    render(<CompanionsPage character={withHouseRule(plainCharacter(), 'sidekicks')} onChange={() => {}} subTab="sidekicks" />);
    expect(screen.getByRole('tab', { name: 'People', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sidekicks (0)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(EDITION).length).toBeGreaterThan(0);
  });

  it('offers Sidekick in the Add Person chooser only while the rule is on', () => {
    renderPeople(withHouseRule(plainCharacter(), 'sidekicks'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Person' }));
    expect(within(screen.getByRole('dialog', { name: 'Add a person' })).getByRole('radio', { name: /^Sidekick/ })).toBeInTheDocument();
  });
});

describe('PeopleTab: sidekicks', () => {
  it('marks the filter as Tasha 2014 content and shows the empty state', () => {
    renderTab(withHouseRule(plainCharacter(), 'sidekicks'));
    expect(screen.getByText('No sidekicks yet')).toBeInTheDocument();
    expect(screen.getAllByText(EDITION).length).toBeGreaterThan(0);
  });

  it('adds a sidekick at level 1 with the stat block hit points prefilled', () => {
    const latest = { current: withHouseRule(plainCharacter({ level: 1 }), 'sidekicks') };
    renderTab(latest.current, latest);
    fireEvent.click(screen.getByRole('button', { name: 'Add Sidekick' }));
    const dialog = screen.getByRole('dialog', { name: 'Add sidekick' });
    fireEvent.change(within(dialog).getByLabelText('Creature'), { target: { value: warriorCreature.id } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add sidekick' }));
    expect(latest.current.sidekicks).toHaveLength(1);
    expect(latest.current.sidekicks?.[0]).toMatchObject({ creatureId: warriorCreature.id, classId: 'warrior', level: 1 });
  });

  it('blocks an ineligible creature (CR above 1/2) with the reason', () => {
    renderTab(withHouseRule(plainCharacter({ level: 1 }), 'sidekicks'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Sidekick' }));
    const dialog = screen.getByRole('dialog', { name: 'Add sidekick' });
    const ineligible = CREATURE_LIST.find((c) => !sidekickEligibility(c, 'warrior').eligible)!;
    // Disabled options cannot be chosen in the UI, so assert they are disabled.
    const option = within(dialog).getByRole('option', { name: `${ineligible.name} (not eligible)` });
    expect(option).toBeDisabled();
  });

  it('records a level-up with the hit points gained (roll + Constitution, minimum 1)', () => {
    const creature = CREATURE_CATALOG[warriorCreature.id];
    const dieSize = creatureHitDie(creature);
    const conMod = creature.abilities.con.mod ?? 0;
    const latest = {
      current: withHouseRule(
        plainCharacter({
          level: 1,
          sidekicks: [{ id: 's1', creatureId: warriorCreature.id, classId: 'warrior', level: 1, baseHpMax: 20, levelUps: [] }],
        }),
        'sidekicks',
      ),
    };
    renderTab(latest.current, latest);
    fireEvent.click(within(screen.getByTestId('sidekick-s1')).getAllByRole('button')[0]);
    fireEvent.change(screen.getByLabelText(`${creature.name} level-up Hit Die roll`), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Level up to 2' }));

    const rec = latest.current.sidekicks?.[0];
    expect(rec?.level).toBe(2);
    expect(rec?.levelUps).toHaveLength(1);
    expect(rec?.levelUps[0].hpGained).toBe(sidekickHitPointsGained(1, conMod, dieSize ?? undefined));
  });

  it('names the sidekick in the remove confirmation', () => {
    renderTab(
      withHouseRule(
        plainCharacter({ sidekicks: [{ id: 's1', creatureId: warriorCreature.id, nickname: 'Pip', classId: 'warrior', level: 1, baseHpMax: 9, levelUps: [] }] }),
        'sidekicks',
      ),
    );
    fireEvent.click(within(screen.getByTestId('sidekick-s1')).getAllByRole('button')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Pip' }));
    expect(screen.getByText(/^Remove Pip\? You can undo/)).toBeInTheDocument();
  });
});
