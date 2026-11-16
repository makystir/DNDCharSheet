import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import { addManualMember, createCampaign, DEFAULT_MANUAL_STATS, emptyDmData } from '../../../logic/dm-campaign';
import type { DmNote } from '../../../types/dm';

function Routed({ initial }: { initial: DmPage }) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell page={page} onNavigate={setPage} onOpenPlayer={() => {}} onTurnOff={() => {}} theme="dark" onThemeToggle={() => {}} />
    </SWUpdateProvider>
  );
}

const seed = (withParty = false) => {
  let d = createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 });
  if (withParty) {
    d = addManualMember(d, 'c', { id: 'm1', name: 'A', stats: { ...DEFAULT_MANUAL_STATS, level: 7 }, now: 1 });
    d = addManualMember(d, 'c', { id: 'm2', name: 'B', stats: { ...DEFAULT_MANUAL_STATS, level: 8 }, now: 1 });
  }
  localStorage.setItem(DM_DATA_KEY, JSON.stringify(d));
};
const journal = () => JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].journal as DmNote[];

beforeEach(() => localStorage.clear());

describe('Treasure page', () => {
  it('uses the average for individual treasure and shows how it was worked out', () => {
    seed();
    render(<Routed initial="treasure" />);
    fireEvent.change(screen.getByLabelText("Monster's CR"), { target: { value: '7' } });
    fireEvent.click(screen.getByLabelText('Use the average instead of rolling'));
    fireEvent.click(screen.getByRole('button', { name: 'Use the average' }));
    const money = screen.getByTestId('money');
    expect(money).toHaveTextContent('90 GP');
    expect(within(money).getByRole('button', { name: /^Monetary treasure: .*Average of 2d8/ })).toBeInTheDocument();
  });

  it('shows platinum for a high CR and what it is worth in GP', () => {
    seed();
    render(<Routed initial="treasure" />);
    fireEvent.change(screen.getByLabelText("Monster's CR"), { target: { value: '12' } });
    fireEvent.click(screen.getByLabelText('Use the average instead of rolling'));
    fireEvent.click(screen.getByRole('button', { name: 'Use the average' }));
    expect(screen.getByTestId('money')).toHaveTextContent('110 PP');
    expect(screen.getByText('1,100 GP in all')).toBeInTheDocument();
  });

  it('multiplies a group by the number of creatures', () => {
    seed();
    render(<Routed initial="treasure" />);
    fireEvent.change(screen.getByLabelText("Monster's CR"), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Creatures in the group'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('Use the average instead of rolling'));
    fireEvent.click(screen.getByRole('button', { name: 'Use the average' }));
    expect(screen.getByTestId('money')).toHaveTextContent('270 GP');
  });

  it('rolls a hoard with money and a magic item count, and doubles it for a dragon', () => {
    seed();
    render(<Routed initial="treasure" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Hoard' }));
    fireEvent.change(screen.getByLabelText("Monster's (or leader's) CR"), { target: { value: '9' } });
    fireEvent.click(screen.getByLabelText('Use the average instead of rolling'));
    fireEvent.click(screen.getByRole('button', { name: 'Use the average' }));
    expect(screen.getByTestId('money')).toHaveTextContent('4,400 GP');
    expect(screen.getByTestId('magic')).toHaveTextContent('2');

    fireEvent.click(screen.getByLabelText(/Fond of treasure/));
    fireEvent.click(screen.getByRole('button', { name: 'Use the average' }));
    expect(screen.getByTestId('money')).toHaveTextContent('8,800 GP');
    expect(screen.getByTestId('magic')).toHaveTextContent('4');
  });

  it('takes the money as gems and keeps the total', () => {
    seed();
    render(<Routed initial="treasure" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Hoard' }));
    fireEvent.change(screen.getByLabelText("Monster's (or leader's) CR"), { target: { value: '9' } });
    fireEvent.click(screen.getByLabelText('Use the average instead of rolling'));
    fireEvent.click(screen.getByRole('button', { name: 'Use the average' }));
    fireEvent.change(screen.getByLabelText('Take the money as'), { target: { value: 'gems:500' } });
    const lines = within(screen.getByLabelText('Form of the money')).getAllByRole('listitem');
    const counts = lines.filter((l) => l.textContent!.includes(' × ')).map((l) => Number(l.textContent!.split(' × ')[0]));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(8); // 4,400 / 500, rounded down
    expect(lines[lines.length - 1]).toHaveTextContent('400 GP in coins');
  });

  it('suggests a form from the treasure theme', () => {
    seed();
    render(<Routed initial="treasure" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Hoard' }));
    fireEvent.change(screen.getByLabelText('Treasure theme (optional)'), { target: { value: 'relics' } });
    expect(screen.getByLabelText('Take the money as')).toHaveValue('art:250');
    expect(screen.getByText(/Art objects plus magic items that have religious origins/)).toBeInTheDocument();
  });

  it('uses the party level for a quest reward', () => {
    seed(true);
    render(<Routed initial="treasure" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Quest reward' }));
    expect(screen.getByLabelText("Characters' level")).toHaveValue(7); // average of 7 and 8, rounded down
    fireEvent.click(screen.getByLabelText('Use the average instead of rolling'));
    fireEvent.click(screen.getByRole('button', { name: 'Use the average' }));
    expect(screen.getByRole('heading', { name: /Quest reward, level 7 \(CR 5-10 row\)/ })).toBeInTheDocument();
    expect(screen.getByTestId('money')).toHaveTextContent('4,400 GP');
  });

  it('rolls gems and art by name', () => {
    seed();
    render(<Routed initial="treasure" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Gems and art' }));
    fireEvent.change(screen.getByLabelText('How many'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    const lines = within(screen.getByLabelText('Rolled items')).getAllByRole('listitem');
    expect(lines.reduce((s, l) => s + Number(l.textContent!.split(' × ')[0]), 0)).toBe(4);
    expect(lines[0]).toHaveTextContent('100 GP each');
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'art' } });
    expect(screen.queryByLabelText('Rolled items')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('Worth each')).getByRole('option', { name: '25 GP' })).toBeInTheDocument();
  });

  it('shows the reference tables', () => {
    seed();
    render(<Routed initial="treasure" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Reference' }));
    expect(screen.getByText('8d10 × 100 (4,400) GP')).toBeInTheDocument();
    expect(screen.getByText('5-pound gold bar')).toBeInTheDocument();
    expect(screen.getByText(/check them against your book/)).toBeInTheDocument();
  });

  it('saves a result to the journal', () => {
    seed();
    render(<Routed initial="treasure" />);
    fireEvent.click(screen.getByLabelText('Use the average instead of rolling'));
    fireEvent.click(screen.getByRole('button', { name: 'Use the average' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
    expect(journal()).toHaveLength(1);
    expect(journal()[0].title).toMatch(/^Treasure: Individual treasure/);
    expect(journal()[0].body).toContain('Monetary treasure:');
  });

  it('offers Open journal only after saving, and opens the journal', () => {
    seed();
    render(<Routed initial="treasure" />);
    fireEvent.click(screen.getByLabelText('Use the average instead of rolling'));
    fireEvent.click(screen.getByRole('button', { name: 'Use the average' }));
    expect(screen.queryByRole('button', { name: 'Open journal' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open journal' }));
    expect(screen.queryByRole('heading', { name: 'Treasure' })).not.toBeInTheDocument();
  });
});
