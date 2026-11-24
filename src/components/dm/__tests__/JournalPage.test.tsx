import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import { createCampaign, emptyDmData } from '../../../logic/dm-campaign';
import { saveNote } from '../../../logic/dm-journal';
import type { DmNote } from '../../../types/dm';

function Routed({ initial }: { initial: DmPage }) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell page={page} onNavigate={setPage} onOpenPlayer={() => {}} onTurnOff={() => {}} theme="dark" onThemeToggle={() => {}} />
    </SWUpdateProvider>
  );
}

const mk = (id: string, title: string, body = '', over: Partial<DmNote> = {}): DmNote => ({
  id,
  kind: 'note',
  title,
  body,
  status: 'open',
  sessionNumber: null,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

function seed(...notes: DmNote[]) {
  let d = createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 });
  for (const n of notes) d = saveNote(d, 'c', n, 1);
  localStorage.setItem(DM_DATA_KEY, JSON.stringify(d));
}

const saved = () => JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].journal as DmNote[];
const list = () => within(screen.getByRole('list', { name: 'Journal entries' }));

beforeEach(() => localStorage.clear());

describe('Journal page', () => {
  it('asks for a campaign first', () => {
    render(<Routed initial="journal" />);
    expect(screen.getByText(/Create a campaign first/)).toBeInTheDocument();
  });

  it('starts a session from an outline with the next number, and saves as you type', () => {
    seed();
    render(<Routed initial="journal" />);
    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    expect(screen.getByRole('group', { name: 'Editing Session 1' })).toBeInTheDocument();
    const text = screen.getByLabelText('Text') as HTMLTextAreaElement;
    expect(text.value).toContain('Recap:');
    fireEvent.change(text, { target: { value: 'The party met [[Mira]].' } });
    expect(saved()[0]).toMatchObject({ kind: 'session', title: 'Session 1', sessionNumber: 1, body: 'The party met [[Mira]].' });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    expect(screen.getByRole('group', { name: 'Editing Session 2' })).toBeInTheDocument();
  });

  it('drops a new entry that is left untouched, and keeps one that was edited', () => {
    seed();
    render(<Routed initial="journal" />);
    fireEvent.click(screen.getByRole('button', { name: 'New npc' }));
    expect(saved()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(saved()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'New npc' }));
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Runs the inn.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(saved()).toHaveLength(1);
    // Starting another entry while one is untouched also drops the first.
    fireEvent.click(screen.getByRole('button', { name: 'New location' }));
    fireEvent.click(screen.getByRole('button', { name: 'New quest' }));
    expect(saved().map((n) => n.kind).sort()).toEqual(['npc', 'quest']);
  });
  it('shows links as buttons, opens the target, and offers to create a missing one', () => {
    seed(mk('a', 'Session 1', 'Met [[Mira]] near [[The Docks]].', { kind: 'session', sessionNumber: 1 }), mk('m', 'Mira', '', { kind: 'npc' }));
    render(<Routed initial="journal" />);
    fireEvent.click(list().getByRole('button', { name: /^Session 1/ }));
    const body = screen.getByTestId('note-body');
    fireEvent.click(within(body).getByRole('button', { name: 'Open Mira' }));
    expect(screen.getByRole('article', { name: 'Mira entry' })).toBeInTheDocument();
    // Mira is linked from Session 1.
    const back = screen.getByRole('region', { name: 'Linked from' });
    fireEvent.click(within(back).getByRole('button', { name: 'Open Session 1' }));
    expect(screen.getByRole('article', { name: 'Session 1 entry' })).toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId('note-body')).getByRole('button', { name: 'Create The Docks' }));
    expect(screen.getByRole('group', { name: 'Editing The Docks' })).toBeInTheDocument();
    expect(saved().map((n) => n.title)).toContain('The Docks');
  });

  it('searches titles and text', () => {
    seed(mk('a', 'Mira', 'Runs the inn.', { kind: 'npc' }), mk('b', 'The Inn', 'Mira works here.', { kind: 'location' }), mk('c', 'Docks'));
    render(<Routed initial="journal" />);
    expect(list().getAllByRole('button')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Search titles and text'), { target: { value: 'mira' } });
    const hits = list().getAllByRole('button');
    expect(hits).toHaveLength(2);
    expect(hits[0]).toHaveTextContent('Mira');
    expect(hits[1]).toHaveTextContent('Mira works here.');
    fireEvent.change(screen.getByLabelText('Search titles and text'), { target: { value: 'nothing-like-this' } });
    expect(screen.getByText('Nothing matches that search.')).toBeInTheDocument();
  });

  it('filters quests by status and changes a status from the entry', () => {
    seed(
      mk('a', 'Find the map', '', { kind: 'quest', status: 'open' }),
      mk('b', 'Burn the mill', '', { kind: 'quest', status: 'done' }),
      mk('c', 'Mira', '', { kind: 'npc' }),
    );
    render(<Routed initial="journal" />);
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'quest' } });
    expect(list().getAllByRole('button')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Quest status'), { target: { value: 'done' } });
    expect(list().getAllByRole('button')).toHaveLength(1);
    expect(list().getByRole('button')).toHaveTextContent('Burn the mill');

    fireEvent.change(screen.getByLabelText('Quest status'), { target: { value: '' } });
    fireEvent.click(list().getByRole('button', { name: /^Find the map/ }));
    fireEvent.change(within(screen.getByRole('article', { name: 'Find the map entry' })).getByLabelText('Quest status'), {
      target: { value: 'dropped' },
    });
    expect(saved().find((n) => n.id === 'a')?.status).toBe('dropped');
  });

  it('keeps links working when an entry is renamed', () => {
    seed(mk('m', 'Mira', '', { kind: 'npc' }), mk('a', 'Notes', 'Talk to [[Mira]].'));
    render(<Routed initial="journal" />);
    fireEvent.click(list().getByRole('button', { name: /^Mira/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const title = screen.getByLabelText('Title');
    fireEvent.change(title, { target: { value: 'Mira Vance' } });
    fireEvent.blur(title);
    expect(saved().find((n) => n.id === 'm')?.title).toBe('Mira Vance');
    expect(saved().find((n) => n.id === 'a')?.body).toBe('Talk to [[Mira Vance]].');
  });

  it('inserts a link from the picker', () => {
    seed(mk('m', 'Mira', '', { kind: 'npc' }), mk('a', 'Notes', 'Talk to '));
    render(<Routed initial="journal" />);
    fireEvent.click(list().getByRole('button', { name: /^Notes/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Insert a link to...'), { target: { value: 'Mira' } });
    expect(saved().find((n) => n.id === 'a')?.body).toContain('[[Mira]]');
  });

  it('shows text as text, never as markup', () => {
    seed(mk('a', 'Odd', '<img src=x onerror=alert(1)> <b>bold</b>'));
    render(<Routed initial="journal" />);
    fireEvent.click(list().getByRole('button', { name: /^Odd/ }));
    const body = screen.getByTestId('note-body');
    expect(body).toHaveTextContent('<img src=x onerror=alert(1)> <b>bold</b>');
    expect(body.querySelector('img')).toBeNull();
    expect(body.querySelector('b')).toBeNull();
  });

  it('warns about incoming links before deleting, then deletes', () => {
    seed(mk('m', 'Mira', '', { kind: 'npc' }), mk('a', 'Notes', 'See [[Mira]].'));
    render(<Routed initial="journal" />);
    fireEvent.click(list().getByRole('button', { name: /^Mira/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete entry' });
    expect(dialog).toHaveTextContent('1 other entry links to it');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(saved()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete entry' })).getByRole('button', { name: 'Delete' }));
    expect(saved().map((n) => n.id)).toEqual(['a']);
  });

  it('keeps each campaign\'s journal apart', () => {
    let d = createCampaign(emptyDmData(), { id: 'c', name: 'One', now: 1 });
    d = saveNote(d, 'c', mk('a', 'Only in One'), 1);
    d = createCampaign(d, { id: 'd', name: 'Two', now: 2 });
    localStorage.setItem(DM_DATA_KEY, JSON.stringify(d));
    render(<Routed initial="journal" />);
    expect(screen.getByText('No entries yet. Start with a session, an NPC or a place.')).toBeInTheDocument();
  });
});
