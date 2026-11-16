import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import { createCampaign, addManualMember, DEFAULT_MANUAL_STATS, emptyDmData } from '../../../logic/dm-campaign';

function Routed({ initial }: { initial: DmPage }) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell page={page} onNavigate={setPage} onOpenPlayer={() => {}} onTurnOff={() => {}} theme="dark" onThemeToggle={() => {}} />
    </SWUpdateProvider>
  );
}

function seedCampaign(withMember = true) {
  let d = createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 });
  if (withMember) {
    d = addManualMember(d, 'c', {
      id: 'm1',
      name: 'Borin',
      stats: { ...DEFAULT_MANUAL_STATS, ac: 18, hpMax: 30, hpCurrent: 30 },
      now: 1,
    });
  }
  localStorage.setItem(DM_DATA_KEY, JSON.stringify(d));
}

function newEncounter(name = 'Ambush') {
  fireEvent.change(screen.getByLabelText('New encounter name'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Create encounter' }));
}

function addCustom(name: string, hp: string, qty = '1') {
  fireEvent.click(screen.getByRole('button', { name: 'Add combatants' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Hit Points'), { target: { value: hp } });
  fireEvent.change(screen.getByLabelText('How many'), { target: { value: qty } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to encounter' }));
}

const cards = () => screen.getAllByTestId('combatant-card');

beforeEach(() => localStorage.clear());

describe('Encounter page', () => {
  it('asks for a campaign first', () => {
    render(<Routed initial="encounter" />);
    expect(screen.getByText(/Create a campaign first/)).toBeInTheDocument();
  });

  it('creates an encounter and saves it', () => {
    seedCampaign();
    render(<Routed initial="encounter" />);
    newEncounter();
    expect(screen.getByRole('heading', { name: 'Ambush' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].encounters[0].name).toBe('Ambush');
  });

  it('adds numbered copies of a creature, and the whole party', () => {
    seedCampaign();
    render(<Routed initial="encounter" />);
    newEncounter();
    addCustom('Goblin', '7', '3');
    expect(cards()).toHaveLength(3);
    expect(screen.getByText('Goblin 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add whole party' }));
    expect(cards()).toHaveLength(4);
    expect(screen.getByText('Borin')).toBeInTheDocument();
  });

  it('will not start until everyone has Initiative, then runs turns and rounds', () => {
    seedCampaign();
    render(<Routed initial="encounter" />);
    newEncounter();
    addCustom('Goblin', '7', '2');
    fireEvent.click(screen.getByRole('button', { name: 'Add whole party' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Set Initiative for: .*Borin/);

    fireEvent.click(screen.getByRole('button', { name: 'Roll Initiative for monsters' }));
    fireEvent.change(screen.getByLabelText('Initiative for Borin'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));

    expect(screen.getByText('Round 1')).toBeInTheDocument();
    // Highest Initiative acts first.
    expect(cards()[0]).toHaveAttribute('data-active', 'true');
    expect(within(cards()[0]).getByText('Borin')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next turn' }));
    expect(cards()[1]).toHaveAttribute('data-active', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Next turn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next turn' }));
    expect(screen.getByText('Round 2')).toBeInTheDocument();
    expect(cards()[0]).toHaveAttribute('data-active', 'true');
  });

  function runningWith(hp: string) {
    seedCampaign(false);
    render(<Routed initial="encounter" />);
    newEncounter();
    addCustom('Ogre', hp);
    fireEvent.change(screen.getByLabelText('Initiative for Ogre'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
  }

  it('applies damage and healing to a monster, and defeats it at 0 HP', () => {
    runningWith('30');
    fireEvent.change(screen.getByLabelText('Amount for Ogre'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Damage Ogre' }));
    expect(within(cards()[0]).getByText(/18 \/ 30/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Amount for Ogre'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Heal Ogre' }));
    expect(within(cards()[0]).getByText(/23 \/ 30/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Amount for Ogre'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Damage Ogre' }));
    expect(within(cards()[0]).getByText('Defeated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revive at 1 HP' })).toBeInTheDocument();
  });

  it('halves damage for a resisted type', () => {
    runningWith('40');
    fireEvent.click(screen.getByRole('button', { name: 'Show more for Ogre' }));
    fireEvent.change(screen.getByLabelText('Damage type for Ogre'), { target: { value: 'Fire' } });
    fireEvent.click(screen.getByLabelText(/Resistance \(half\)/));
    fireEvent.change(screen.getByLabelText('Amount for Ogre'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Damage Ogre' }));
    expect(within(cards()[0]).getByText(/36 \/ 40/)).toBeInTheDocument();
  });

  it('asks for a Concentration save, with the DC explained, and resolves it', () => {
    runningWith('200');
    fireEvent.click(screen.getByRole('button', { name: 'Show more for Ogre' }));
    fireEvent.click(screen.getByLabelText('Concentrating'));
    fireEvent.change(screen.getByLabelText('Amount for Ogre'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Damage Ogre' }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Constitution save, DC\s*20/);
    expect(within(alert).getByRole('button', { name: /20/ })).toBeInTheDocument(); // DC has a breakdown tooltip
    fireEvent.click(within(alert).getByRole('button', { name: 'Kept it' }));
    expect(screen.queryByText(/must save to keep Concentration/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Concentrating')).toBeChecked();
  });

  it('adds a timed condition and shows it as a removable chip', () => {
    runningWith('30');
    fireEvent.click(screen.getByRole('button', { name: 'Show more for Ogre' }));
    fireEvent.change(screen.getByLabelText('Condition for Ogre'), { target: { value: 'poisoned' } });
    fireEvent.change(screen.getByLabelText('Condition rounds for Ogre'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }));
    const chip = screen.getByRole('button', { name: 'Remove Poisoned from Ogre' });
    expect(screen.getByRole('button', { name: /^Poisoned \(3\)/ })).toBeInTheDocument();
    fireEvent.click(chip);
    expect(screen.queryByRole('button', { name: 'Remove Poisoned from Ogre' })).not.toBeInTheDocument();
  });

  it('ends combat after confirming, and shows the summary', () => {
    runningWith('30');
    fireEvent.click(screen.getByRole('button', { name: 'End combat' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'End combat' })).getByRole('button', { name: 'End combat' }));
    expect(screen.getByText(/Combat finished after 1 round/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next turn' })).not.toBeInTheDocument();
  });

  it('keeps the fight when the page is left and reopened', () => {
    runningWith('30');
    fireEvent.change(screen.getByLabelText('Amount for Ogre'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Damage Ogre' }));
    const saved = JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0];
    expect(saved.encounters[0].combatants[0].hp.hp).toBe(20);
    expect(saved.activeEncounterId).toBe(saved.encounters[0].id);
  });

  it('lists encounters and deletes one after confirming', () => {
    seedCampaign(false);
    render(<Routed initial="encounter" />);
    newEncounter('First');
    fireEvent.click(screen.getByRole('button', { name: 'All encounters' }));
    expect(screen.getByText('First')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete encounter First' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete encounter' })).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByText('First')).not.toBeInTheDocument();
  });

  it('sets the encounter XP against the budget for the party', () => {
    seedCampaign();
    render(<Routed initial="encounter" />);
    newEncounter();
    fireEvent.click(screen.getByRole('button', { name: 'Add whole party' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add combatants' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ogre' } });
    fireEvent.change(screen.getByLabelText(/^XP value/), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to encounter' }));

    // One level 1 character: budgets 50 / 75 / 100.
    expect(screen.getByTestId('balance-fit')).toHaveTextContent('Fits the Moderate budget');
    expect(within(screen.getByTestId('budget-low')).getByText('25 over')).toBeInTheDocument();
    expect(within(screen.getByTestId('budget-moderate')).getByText('0')).toBeInTheDocument();
    expect(within(screen.getByTestId('budget-high')).getByText('25')).toBeInTheDocument();
    // Each total explains itself.
    expect(screen.getByRole('button', { name: /^Encounter XP: .*Ogre/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Moderate XP budget: .*Borin \(level 1\)/ })).toBeInTheDocument();
  });

  it('flags a creature with no XP value and counts it once it has one', () => {
    seedCampaign();
    render(<Routed initial="encounter" />);
    newEncounter();
    fireEvent.click(screen.getByRole('button', { name: 'Add whole party' }));
    addCustom('Mystery', '9');
    expect(screen.getByText(/No XP value for Mystery/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show more for Mystery' }));
    fireEvent.change(screen.getByLabelText('XP value for Mystery'), { target: { value: '30' } });
    expect(screen.queryByText(/No XP value for/)).not.toBeInTheDocument();
    expect(screen.getByTestId('balance-fit')).toHaveTextContent('Fits the Low budget');
  });

  it('shares the XP of the defeated creatures when combat ends', () => {
    seedCampaign(false);
    render(<Routed initial="encounter" />);
    newEncounter();
    fireEvent.click(screen.getByRole('button', { name: 'Add combatants' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Orc' } });
    fireEvent.change(screen.getByLabelText(/^XP value/), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to encounter' }));
    fireEvent.change(screen.getByLabelText('Initiative for Orc'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    fireEvent.change(screen.getByLabelText('Amount for Orc'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Damage Orc' }));
    fireEvent.click(screen.getByRole('button', { name: 'End combat' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'End combat' })).getByRole('button', { name: 'End combat' }));

    expect(screen.getByLabelText('Count Orc for XP')).toBeChecked();
    fireEvent.change(screen.getByLabelText('Characters sharing the XP'), { target: { value: '3' } });
    expect(screen.getByTestId('xp-share')).toHaveTextContent('33');
    fireEvent.click(screen.getByLabelText('Count Orc for XP'));
    expect(screen.getByTestId('xp-share')).toHaveTextContent('0');
  });
  it('opens Party XP for the finished fight with the encounter already chosen', () => {
    seedCampaign();
    render(<Routed initial="encounter" />);
    newEncounter();
    fireEvent.click(screen.getByRole('button', { name: 'Add combatants' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Orc' } });
    fireEvent.change(screen.getByLabelText(/^XP value/), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to encounter' }));
    fireEvent.change(screen.getByLabelText('Initiative for Orc'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    fireEvent.click(screen.getByRole('button', { name: 'End combat' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'End combat' })).getByRole('button', { name: 'End combat' }));

    // The sharers box starts at the party size, the same number the Party XP page uses.
    expect(screen.getByLabelText('Characters sharing the XP')).toHaveValue(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open Party XP for this fight' }));
    expect(screen.getByRole('tab', { name: 'Fight' })).toHaveAttribute('aria-selected', 'true');
    const id = JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].encounters[0].id;
    expect(screen.getByLabelText('Encounter')).toHaveValue(id);
  });
});

describe('Encounter page: DM quality of life', () => {
  it('shows whose turn it is next to the round', () => {
    seedCampaign(false);
    render(<Routed initial="encounter" />);
    newEncounter();
    addCustom('Ogre', '30');
    fireEvent.change(screen.getByLabelText('Initiative for Ogre'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start combat' }));
    expect(screen.getByTestId('active-turn')).toHaveTextContent('Turn: Ogre');
  });

  it('duplicates a monster with one click', () => {
    seedCampaign(false);
    render(<Routed initial="encounter" />);
    newEncounter();
    addCustom('Goblin', '7');
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Goblin' }));
    expect(cards()).toHaveLength(2);
    expect(screen.getByText('Goblin 2')).toBeInTheDocument();
  });

  it('shows CR and a notes preview on the collapsed card', () => {
    seedCampaign(false);
    render(<Routed initial="encounter" />);
    newEncounter();
    fireEvent.click(screen.getByRole('button', { name: 'Add combatants' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ogre' } });
    fireEvent.change(screen.getByLabelText(/^Challenge Rating/), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to encounter' }));
    expect(within(cards()[0]).getByText(/CR 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show more for Ogre' }));
    const notes = within(cards()[0]).getByLabelText('Notes');
    fireEvent.change(notes, { target: { value: 'Has the key' } });
    fireEvent.blur(notes);
    expect(screen.getByTestId('notes-preview')).toHaveTextContent('Has the key');
  });

  it('shows the condition rules on a chip without removing it', () => {
    seedCampaign(false);
    render(<Routed initial="encounter" />);
    newEncounter();
    addCustom('Ogre', '30');
    fireEvent.click(screen.getByRole('button', { name: 'Show more for Ogre' }));
    fireEvent.change(screen.getByLabelText('Condition for Ogre'), { target: { value: 'poisoned' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }));
    fireEvent.click(screen.getByRole('button', { name: /^Poisoned: rules for Poisoned/ }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Poisoned/);
    expect(screen.getByRole('button', { name: 'Remove Poisoned from Ogre' })).toBeInTheDocument();
  });

  it('lists encounter XP and fit, and duplicates an encounter as a fresh setup', () => {
    seedCampaign();
    render(<Routed initial="encounter" />);
    newEncounter('Ambush');
    fireEvent.click(screen.getByRole('button', { name: 'Add combatants' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ogre' } });
    fireEvent.change(screen.getByLabelText(/^XP value/), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to encounter' }));
    fireEvent.click(screen.getByRole('button', { name: 'All encounters' }));
    expect(screen.getByTestId('encounter-summary')).toHaveTextContent('75 XP');
    expect(screen.getByTestId('encounter-summary')).toHaveTextContent('Fits the Moderate budget');

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate encounter Ambush' }));
    expect(screen.getByText('Ambush (copy)')).toBeInTheDocument();
    const encounters = JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].encounters;
    expect(encounters).toHaveLength(2);
    expect(encounters[1].status).toBe('setup');
    expect(encounters[1].combatants).toHaveLength(1);
  });

  it('filters the creature library by CR and keeps the dialog open to add more', () => {
    seedCampaign(false);
    render(<Routed initial="encounter" />);
    newEncounter();
    fireEvent.click(screen.getByRole('button', { name: 'Add combatants' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Creature library' }));
    const list = () => within(screen.getByRole('list', { name: 'Creatures' })).getAllByRole('radio');
    expect(list()).toHaveLength(100);
    expect(screen.getByText(/Showing the first 100 of/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search creatures'), { target: { value: 'Aboleth' } });
    fireEvent.change(screen.getByLabelText('Challenge Rating'), { target: { value: '10' } });
    expect(list()).toHaveLength(1);
    fireEvent.click(list()[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Add and keep browsing' }));
    expect(screen.getByRole('dialog', { name: 'Add combatants' })).toBeInTheDocument();
    expect(screen.getByText('Added Aboleth.')).toBeInTheDocument();
    expect(cards()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add and keep browsing' }));
    expect(cards()).toHaveLength(2);
  });
});
