import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import { createCampaign, emptyDmData } from '../../../logic/dm-campaign';
import { FLAGGED_NOTE, resolveMagicItem } from '../../../logic/magic-item-resolve';
import type { RolledMagicItem } from '../../../logic/dm-treasure';

const flaggedItem = (): RolledMagicItem => ({
  theme: 'arcana',
  tier: 'uncommon',
  themeRoll: null,
  d100: 7,
  item: resolveMagicItem('Totally Made Up Trinket'),
});

let forceFlagged = false;

vi.mock('../../../logic/dm-treasure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../logic/dm-treasure')>();
  return {
    ...actual,
    rollMagicItems: (...args: Parameters<typeof actual.rollMagicItems>) =>
      forceFlagged ? [flaggedItem(), ...actual.rollMagicItems(...args).slice(1)] : actual.rollMagicItems(...args),
  };
});

function Routed({ initial }: { initial: DmPage }) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell page={page} onNavigate={setPage} onOpenPlayer={() => {}} onTurnOff={() => {}} theme="dark" onThemeToggle={() => {}} />
    </SWUpdateProvider>
  );
}

const seed = () => {
  localStorage.setItem(DM_DATA_KEY, JSON.stringify(createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 })));
};

const rollHoardWithItems = () => {
  render(<Routed initial="treasure" />);
  fireEvent.click(screen.getByRole('tab', { name: 'Hoard' }));
  fireEvent.change(screen.getByLabelText("Monster's (or leader's) CR"), { target: { value: '9' } });
  fireEvent.click(screen.getByLabelText('Use the average instead of rolling'));
  fireEvent.click(screen.getByRole('button', { name: 'Use the average' }));
};

beforeEach(() => {
  localStorage.clear();
  forceFlagged = false;
});
afterEach(() => vi.restoreAllMocks());

describe('Treasure page: random magic items', () => {
  it('rolls the hoard magic items and shows rarity, category, attunement, description and source', () => {
    seed();
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    rollHoardWithItems();
    fireEvent.change(screen.getByLabelText('Magic item rarity'), { target: { value: 'common' } });
    fireEvent.change(screen.getByLabelText('Treasure theme (optional)'), { target: { value: 'relics' } });
    fireEvent.click(screen.getByRole('button', { name: 'Roll 2 magic items' }));
    const list = screen.getByRole('list', { name: 'Rolled magic items' });
    const items = within(list).getAllByTestId('magic-item-dmg');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Ear Horn of Hearing');
    expect(items[0]).toHaveTextContent('Wondrous Item, Common, no attunement');
    expect(items[0]).toHaveTextContent('suppresses the Deafened condition');
    expect(items[0]).toHaveTextContent('Source: DMG 2024 p.256');
    expect(within(list).queryByRole('note')).not.toBeInTheDocument();
  });

  it('shows an SRD item with its source', () => {
    seed();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    rollHoardWithItems();
    fireEvent.change(screen.getByLabelText('Magic item rarity'), { target: { value: 'legendary' } });
    fireEvent.change(screen.getByLabelText('Treasure theme (optional)'), { target: { value: 'relics' } });
    fireEvent.click(screen.getByRole('button', { name: 'Roll 2 magic items' }));
    const items = screen.getAllByTestId('magic-item-srd');
    expect(items[0]).toHaveTextContent('Talisman of Ultimate Evil');
    expect(items[0]).toHaveTextContent('requires attunement');
    expect(items[0]).toHaveTextContent('Source: SRD 5.2.1');
  });

  it('flags an item with no description visibly instead of leaving it blank', () => {
    seed();
    forceFlagged = true;
    rollHoardWithItems();
    fireEvent.click(screen.getByRole('button', { name: 'Roll 2 magic items' }));
    const flagged = screen.getByTestId('magic-item-flagged');
    expect(flagged).toHaveTextContent('Totally Made Up Trinket');
    expect(flagged).toHaveTextContent(FLAGGED_NOTE);
    expect(within(flagged).getByRole('note')).toHaveTextContent('Flagged:');
  });

  it('saves the rolled items to the journal', () => {
    seed();
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    rollHoardWithItems();
    fireEvent.change(screen.getByLabelText('Magic item rarity'), { target: { value: 'common' } });
    fireEvent.change(screen.getByLabelText('Treasure theme (optional)'), { target: { value: 'relics' } });
    fireEvent.click(screen.getByRole('button', { name: 'Roll 2 magic items' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
    const body = JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].journal[0].body as string;
    expect(body).toContain('Ear Horn of Hearing: Wondrous Item, Common, no attunement');
  });
});
