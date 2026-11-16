import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import { generateRandomCharacter } from '../../../logic/personal-details-generation';
import { createSeededRng } from '../../../logic/random';
import { exportToJSON } from '../../../storage/export-import';
import { encodeSharePayload } from '../../../logic/share-codec';

function Harness({ initial = 'campaign' as DmPage, onOpenPlayer = () => {}, onTurnOff = () => {} }) {
  // Tiny stand-in for App's routing: the shell is told which page to show.
  return <Routed initial={initial} onOpenPlayer={onOpenPlayer} onTurnOff={onTurnOff} />;
}

import { useState } from 'react';
function Routed({
  initial,
  onOpenPlayer,
  onTurnOff,
}: {
  initial: DmPage;
  onOpenPlayer: () => void;
  onTurnOff: () => void;
}) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell
        page={page}
        onNavigate={setPage}
        onOpenPlayer={onOpenPlayer}
        onTurnOff={onTurnOff}
        theme="dark"
        onThemeToggle={() => {}}
      />
    </SWUpdateProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
});

function createCampaign(name: string) {
  fireEvent.change(screen.getByLabelText('New campaign name'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }));
}

describe('DmShell', () => {
  it('labels the area as the Dungeon Master workspace and links to the player sheet', () => {
    const onOpenPlayer = vi.fn();
    render(<Harness onOpenPlayer={onOpenPlayer} />);
    expect(screen.getByRole('navigation', { name: 'Dungeon Master navigation' })).toBeInTheDocument();
    expect(screen.getByText('DM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /My characters/ }));
    expect(onOpenPlayer).toHaveBeenCalled();
  });

  it('creates a campaign, saves it, and shows the empty party', () => {
    render(<Harness />);
    createCampaign('Ember Throne');
    expect(screen.getByDisplayValue('Ember Throne')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].name).toBe('Ember Throne');
    fireEvent.click(screen.getByRole('button', { name: 'Open party' }));
    expect(screen.getByRole('heading', { name: 'Party' })).toBeInTheDocument();
    expect(screen.getByText(/No party members yet/)).toBeInTheDocument();
  });

  it('asks for a campaign before showing a party', () => {
    render(<Harness initial="party" />);
    expect(screen.getByText(/Create a campaign first/)).toBeInTheDocument();
  });

  it('adds a party member by hand and shows their numbers with tooltips', () => {
    render(<Harness />);
    createCampaign('Test');
    fireEvent.click(screen.getByRole('button', { name: 'Open party' }));
    fireEvent.click(screen.getByRole('button', { name: /Add member/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Enter by hand' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Borin' } });
    fireEvent.change(screen.getByLabelText('Armor Class'), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText('Passive Perception'), { target: { value: '14' } });
    fireEvent.change(screen.getByLabelText('Languages (separate with commas)'), { target: { value: 'Common, Dwarvish' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to party' }));

    const card = screen.getByTestId('party-member-card');
    expect(within(card).getByText('Borin')).toBeInTheDocument();
    expect(within(card).getByText('Dwarvish')).toBeInTheDocument();
    // AC renders through CalculatedValue, so it is a button with a breakdown.
    expect(within(card).getByRole('button', { name: /18/ })).toBeInTheDocument();
    expect(screen.getByText('Party at a glance')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].party[0].name).toBe('Borin');
  });

  it('requires a name for a hand-entered member', () => {
    render(<Harness />);
    createCampaign('Test');
    fireEvent.click(screen.getByRole('button', { name: 'Open party' }));
    fireEvent.click(screen.getByRole('button', { name: /Add member/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Enter by hand' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to party' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give the member a name.');
  });

  it('adds a player from a share link, and reports a bad link', async () => {
    const c = generateRandomCharacter(createSeededRng(11), {});
    const code = await encodeSharePayload(exportToJSON(c));
    render(<Harness />);
    createCampaign('Test');
    fireEvent.click(screen.getByRole('button', { name: 'Open party' }));
    fireEvent.click(screen.getByRole('button', { name: /Add member/ }));

    const box = screen.getByLabelText(/Share link, code/);
    fireEvent.change(box, { target: { value: 'not a link!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to party' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/does not look like a share link/);

    fireEvent.change(box, { target: { value: `https://example.com/#view/${code}` } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to party' }));
    await waitFor(() => expect(screen.getByTestId('party-member-card')).toBeInTheDocument());
    expect(within(screen.getByTestId('party-member-card')).getByText(c.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update from link' })).toBeInTheDocument();
  });

  it('removes a member only after confirming', () => {
    render(<Harness />);
    createCampaign('Test');
    fireEvent.click(screen.getByRole('button', { name: 'Open party' }));
    fireEvent.click(screen.getByRole('button', { name: /Add member/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Enter by hand' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pip' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to party' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove Pip from the party' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Remove party member' })).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('party-member-card')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Pip from the party' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Remove party member' })).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByTestId('party-member-card')).not.toBeInTheDocument();
  });

  it('restores campaigns saved earlier', () => {
    const first = render(<Harness />);
    createCampaign('Saved one');
    first.unmount();
    render(<Harness />);
    expect(screen.getByDisplayValue('Saved one')).toBeInTheDocument();
  });

  it('opens Party XP with key 8 and Settings with key 9', () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: '8' });
    expect(screen.getByRole('heading', { name: 'Party XP' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: '9' });
    expect(screen.getByRole('button', { name: 'Turn off DM mode' })).toBeInTheDocument();
    const labels = within(screen.getByRole('navigation', { name: 'Dungeon Master navigation' }))
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(labels.indexOf('Party XP')).toBe(labels.indexOf('Settings') - 1);
  });
  it('turns DM mode off from its settings page', () => {
    const onTurnOff = vi.fn();
    render(<Harness initial="settings" onTurnOff={onTurnOff} />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn off DM mode' }));
    expect(onTurnOff).toHaveBeenCalled();
  });

  it('asks before replacing data with an imported file, and rejects a bad file', async () => {
    render(<Harness initial="settings" />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bad = new File(['{oops'], 'dm.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [bad] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid JSON/);

    const good = new File([JSON.stringify({ v: 1, campaigns: [{ id: 'z', name: 'From file', party: [] }] })], 'dm.json');
    fireEvent.change(input, { target: { files: [good] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].name).toBe('From file'));
  });
});

describe('DM navigation shortcuts', () => {
  it('shows the number key of each page on its nav button', () => {
    render(<Harness />);
    const encounter = document.querySelector('[data-section="encounter"]')!;
    expect(encounter).toHaveAttribute('aria-keyshortcuts', '3');
    expect(encounter).toHaveAttribute('title', 'Encounter (press 3)');
  });
});
