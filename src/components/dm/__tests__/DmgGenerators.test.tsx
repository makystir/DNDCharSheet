import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import { createCampaign, emptyDmData } from '../../../logic/dm-campaign';
import type { DmNote } from '../../../types/dm';
import { createSeededRng } from '../../../logic/random';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dmgPartKeys, dmgResultTitle, rollDmgGenerator, rollDmgPart, type DmgGeneratorId, type RolledPart } from '../../../logic/dmg-generators';

function Routed({ initial }: { initial: DmPage }) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell page={page} onNavigate={setPage} onOpenPlayer={() => {}} onTurnOff={() => {}} theme="dark" onThemeToggle={() => {}} />
    </SWUpdateProvider>
  );
}
const seed = () =>
  localStorage.setItem(DM_DATA_KEY, JSON.stringify(createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 })));
const journal = () => JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].journal as DmNote[];

beforeEach(() => localStorage.clear());

const GENERATORS: { id: DmgGeneratorId; tab: string; button: string; card: string; labels: string[] }[] = [
  { id: 'settlement', tab: 'Settlement', button: 'Generate settlement', card: 'Generated settlement', labels: ['Defining trait', 'Claim to fame', 'Current calamity', 'Local leader'] },
  { id: 'adventure', tab: 'Adventure seed', button: 'Generate adventure seed', card: 'Generated adventure seed', labels: ['Adventure situation', 'Patron hook', 'Adventure climax'] },
  { id: 'dungeon', tab: 'Dungeon', button: 'Generate dungeon', card: 'Generated dungeon', labels: ['Dungeon quirk', 'State of ruin'] },
  { id: 'npcDetails', tab: 'NPC details', button: 'Generate NPC details', card: 'Generated npc details', labels: ['Appearance', 'Secret'] },
  { id: 'weather', tab: 'Weather', button: 'Roll weather', card: 'Generated weather', labels: ['Temperature', 'Wind', 'Precipitation'] },
  { id: 'monster', tab: 'Monster behavior', button: 'Generate monster behavior', card: 'Generated monster behavior', labels: ['Monster personality', 'Monster relationship'] },
];

describe('DMG generators on the Generators page', () => {
  for (const g of GENERATORS) {
    describe(g.tab, () => {
      it('renders, rolls and shows every part', () => {
        seed();
        render(<Routed initial="generators" />);
        fireEvent.click(screen.getByRole('tab', { name: g.tab }));
        expect(screen.queryByLabelText(g.card)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: g.button }));
        const card = screen.getByLabelText(g.card);
        for (const label of g.labels) {
          expect(within(card).getByRole('button', { name: `Roll the ${label.toLowerCase()} again` })).toBeInTheDocument();
        }
        expect(card.textContent).toMatch(/Rolled \d+\./);
        expect(card).not.toHaveTextContent(/[{}]|undefined/);
      });

      it('rolls one line again and saves to the journal', () => {
        seed();
        render(<Routed initial="generators" />);
        fireEvent.click(screen.getByRole('tab', { name: g.tab }));
        fireEvent.click(screen.getByRole('button', { name: g.button }));
        fireEvent.click(screen.getByRole('button', { name: `Roll the ${g.labels[0].toLowerCase()} again` }));
        fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
        expect(journal()).toHaveLength(1);
        expect(journal()[0].kind).toBe('note');
        expect(journal()[0].body).toContain(`${g.labels[0]}: `);
      });
    });
  }

  it('disables saving until a campaign exists', () => {
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Dungeon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate dungeon' }));
    expect(screen.getByRole('button', { name: 'Save to journal' })).toBeDisabled();
  });

  it('settlement shows the chosen size from the DMG size table', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Settlement' }));
    fireEvent.change(screen.getByLabelText('Size (optional)'), { target: { value: 'Town' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate settlement' }));
    expect(screen.getByLabelText('Generated settlement')).toHaveTextContent('population 501-5,000');
    expect(screen.getByLabelText('Generated settlement')).toHaveTextContent('2,000 GP');
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
    expect(journal()[0].body).toContain('Size: Town');
  });

  it('adventure seed follows the chosen tier and hook table', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Adventure seed' }));
    fireEvent.change(screen.getByLabelText('Kind of hook'), { target: { value: 'supernatural' } });
    fireEvent.change(screen.getByLabelText('Party level'), { target: { value: '17-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate adventure seed' }));
    const card = screen.getByLabelText('Generated adventure seed');
    expect(card).toHaveTextContent('Supernatural hook.');
    expect(card).toHaveTextContent('DMG 2024 p.108, d10');
  });
});

describe('DMG generator logic', () => {
  const ids: DmgGeneratorId[] = ['settlement', 'adventure', 'dungeon', 'npcDetails', 'weather', 'monster'];
  it('rolls every part in range, over many seeds', () => {
    for (const id of ids) {
      for (let seedN = 0; seedN < 300; seedN++) {
        const parts = rollDmgGenerator(createSeededRng(seedN), id);
        expect(parts.map((p) => p.key)).toEqual(dmgPartKeys(id));
        for (const p of parts) {
          expect(p.roll).toBeGreaterThanOrEqual(1);
          expect(p.text.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('weather rolls the hotter and colder shift as 1d4 x 10 with a breakdown', () => {
    // rng 0.9 -> d20 roll 19 (hotter); then 0.5 -> d4 roll 3
    const seq = [0.9, 0.5];
    let i = 0;
    const part = rollDmgPart(() => seq[i++], 'weather', 'temperature');
    expect(part.roll).toBe(19);
    expect(part.text).toBe('30 degrees Fahrenheit hotter');
    expect(part.shift?.breakdown.total).toBe(30);
    expect(part.shift?.breakdown.components.reduce((s, c) => s + c.value, 0)).toBe(30);
    expect(part.shift?.breakdown.note).toContain('1d4 (3) x 10 = 30');
    // roll 1 is normal for the season and has no shift
    expect(rollDmgPart(() => 0, 'weather', 'temperature').text).toBe('Normal for the season');
  });

  it('shows the weather shift with a tooltip trigger on the page', () => {
    seed();
    const orig = Math.random;
    const seq = [0.9, 0.5, 0, 0];
    let i = 0;
    Math.random = () => seq[Math.min(i++, seq.length - 1)];
    try {
      render(<Routed initial="generators" />);
      fireEvent.click(screen.getByRole('tab', { name: 'Weather' }));
      fireEvent.click(screen.getByRole('button', { name: 'Roll weather' }));
    } finally {
      Math.random = orig;
    }
    const card = screen.getByLabelText('Generated weather');
    expect(within(card).getByRole('button', { name: /30/ })).toBeInTheDocument();
    expect(card).toHaveTextContent('30 degrees Fahrenheit hotter');
  });
});

describe('Generator results across tabs, saving and the journal', () => {
  it('keeps each tab\'s result when switching tabs', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate NPC' }));
    const npc = screen.getByLabelText('Generated NPC').textContent;
    fireEvent.click(screen.getByRole('tab', { name: 'Weather' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll weather' }));
    const weather = screen.getByLabelText('Generated weather').textContent;
    fireEvent.click(screen.getByRole('tab', { name: 'Tavern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate tavern' }));
    const tavern = screen.getByTestId('place-name').textContent;
    fireEvent.click(screen.getByRole('tab', { name: 'Quick NPC' }));
    expect(screen.getByLabelText('Generated NPC').textContent).toBe(npc);
    fireEvent.click(screen.getByRole('tab', { name: 'Weather' }));
    expect(screen.getByLabelText('Generated weather').textContent).toBe(weather);
    fireEvent.click(screen.getByRole('tab', { name: 'Tavern' }));
    expect(screen.getByTestId('place-name').textContent).toBe(tavern);
  });

  it('shows Saved after saving, saves only once, and Open journal selects that note', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Dungeon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate dungeon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
    const saved = screen.getByRole('button', { name: 'Saved' });
    expect(saved).toBeDisabled();
    expect(journal()).toHaveLength(1);
    expect(journal()[0].title).toMatch(/^Dungeon: .+/);
    // The saved state survives a tab switch, and rolling again makes a new, unsaved result.
    fireEvent.click(screen.getByRole('tab', { name: 'Weather' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Dungeon' }));
    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Open journal' }));
    expect(within(screen.getByLabelText('Journal entries')).getByRole('button', { pressed: true })).toHaveTextContent(journal()[0].title);
  });

  it('allows saving again once the result is rolled again', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Monster behavior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate monster behavior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate monster behavior' }));
    expect(screen.getByRole('button', { name: 'Save to journal' })).toBeEnabled();
  });

  it('marks a saved NPC and tavern as Saved too', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate NPC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();
    fireEvent.click(screen.getByRole('tab', { name: 'Tavern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate tavern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();
    expect(journal()).toHaveLength(3);
  });

  const selectedTitle = () => within(screen.getByLabelText('Journal entries')).getByRole('button', { pressed: true }).textContent ?? '';

  it('Open journal selects the saved NPC note', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate NPC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open journal' }));
    expect(selectedTitle()).toContain(journal()[0].title);
  });

  it('Open journal selects the place note, not its owner note', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tavern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Generate tavern' }));
    const name = screen.getByTestId('place-name').textContent ?? '';
    fireEvent.click(screen.getByRole('button', { name: 'Save to journal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open journal' }));
    expect(selectedTitle()).toContain(name);
  });

  it('keeps the DMG shop source and the DMG options after a tab switch', () => {
    seed();
    render(<Routed initial="generators" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Shop' }));
    fireEvent.change(screen.getByLabelText('Name source'), { target: { value: 'dmg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate shop' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Tavern' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Shop' }));
    expect(screen.getByLabelText('Name source')).toHaveValue('dmg');
    fireEvent.click(screen.getByRole('button', { name: 'New name' }));
    // A DMG shop is named from its (re-rolled) DMG shop type, shown in the subtitle; the original word lists would not do that.
    const type = /^An? (.+), owned by/.exec(screen.getByLabelText('Generated shop').querySelector('span')!.textContent ?? '')![1];
    expect(screen.getByTestId('place-name').textContent!.toLowerCase().endsWith(type)).toBe(true);
    fireEvent.click(screen.getByRole('tab', { name: 'Adventure seed' }));
    fireEvent.change(screen.getByLabelText('Party level'), { target: { value: '5-10' } });
    fireEvent.change(screen.getByLabelText('Kind of hook'), { target: { value: 'supernatural' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate adventure seed' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Dungeon' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Adventure seed' }));
    expect(screen.getByLabelText('Party level')).toHaveValue('5-10');
    expect(screen.getByLabelText('Kind of hook')).toHaveValue('supernatural');
  });

  it('wraps the tab strip on narrow screens', () => {
    const css = readFileSync(join(__dirname, '..', 'dm.module.css'), 'utf8');
    expect(css).toMatch(/\.tabs\s*\{[^}]*flex-wrap:\s*wrap/);
  });
});

describe('dmgResultTitle', () => {
  const part = (key: string, text: string): RolledPart => ({ key, label: key, source: '', roll: 1, text });
  it('uses the first rolled line, the size for settlements, and all of weather', () => {
    expect(dmgResultTitle('dungeon', [part('a', 'Haunted'), part('b', 'Ruined')])).toBe('Dungeon: Haunted');
    expect(dmgResultTitle('settlement', [part('a', 'Trade hub')], { size: 'Town' })).toBe('Settlement: Town, Trade hub');
    expect(dmgResultTitle('weather', [part('a', 'Cold'), part('b', 'Calm'), part('c', 'Rain')])).toBe('Weather: Cold, Calm, Rain');
  });
  it('shortens long text and falls back to the generator name', () => {
    expect(dmgResultTitle('dungeon', [part('a', 'x'.repeat(200))]).length).toBeLessThan(90);
    expect(dmgResultTitle('dungeon', [])).toBe('Dungeon');
  });
});
