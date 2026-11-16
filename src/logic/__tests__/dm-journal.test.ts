import { describe, it, expect } from 'vitest';
import type { DmData, DmNote } from '../../types/dm';
import { createCampaign, emptyDmData } from '../dm-campaign';
import {
  MAX_NOTES,
  SESSION_TEMPLATE,
  backlinks,
  deleteNote,
  newNote,
  nextSessionNumber,
  outgoingLinks,
  parseBody,
  patchNote,
  resolveLink,
  retitleNote,
  saveNote,
  searchJournal,
  sortNotes,
  uniqueTitle,
} from '../dm-journal';
import { parseDmData } from '../dm-sanitize';

let n = 0;
const note = (over: Partial<DmNote> = {}): DmNote => ({
  id: `n${++n}`,
  kind: 'note',
  title: `Entry ${n}`,
  body: '',
  status: 'open',
  sessionNumber: null,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

function campaignWith(...notes: DmNote[]): DmData {
  let d = createCampaign(emptyDmData(), { id: 'c', name: 'T', now: 1 });
  for (const x of notes) d = saveNote(d, 'c', x, 1);
  return d;
}

describe('links in a body', () => {
  it('splits text and [[links]]', () => {
    expect(parseBody('Met [[Mira]] in [[The Rusty Nail]] today.')).toEqual([
      { type: 'text', text: 'Met ' },
      { type: 'link', title: 'Mira' },
      { type: 'text', text: ' in ' },
      { type: 'link', title: 'The Rusty Nail' },
      { type: 'text', text: ' today.' },
    ]);
    expect(parseBody('')).toEqual([]);
    expect(parseBody('plain')).toEqual([{ type: 'text', text: 'plain' }]);
  });

  it('ignores empty, nested, multi-line and over-long brackets', () => {
    expect(parseBody('[[]] [[  ]]').every((s) => s.type === 'text')).toBe(true);
    expect(parseBody('[[a\nb]]').every((s) => s.type === 'text')).toBe(true);
    expect(parseBody(`[[${'x'.repeat(81)}]]`).every((s) => s.type === 'text')).toBe(true);
    expect(parseBody('[[outer [[inner]] ]]').filter((s) => s.type === 'link')).toEqual([{ type: 'link', title: 'inner' }]);
  });

  it('finds the target by title ignoring case and spaces', () => {
    const mira = note({ title: 'Mira the Innkeeper' });
    expect(resolveLink([mira], '  mira THE innkeeper ')).toBe(mira);
    expect(resolveLink([mira], 'Nobody')).toBeUndefined();
  });

  it('lists each outgoing title once, and who links back', () => {
    const a = note({ title: 'A', body: '[[B]] and [[b]] and [[C]]' });
    const b = note({ title: 'B' });
    const c = note({ title: 'C', body: '[[B]]' });
    expect(outgoingLinks(a)).toEqual(['B', 'C']);
    expect(backlinks([a, b, c], b).map((x) => x.title).sort()).toEqual(['A', 'C']);
    expect(backlinks([a, b, c], a)).toEqual([]);
    // An entry does not link back to itself.
    const self = note({ title: 'Self', body: '[[Self]]' });
    expect(backlinks([self], self)).toEqual([]);
  });
});

describe('search and order', () => {
  const mira = note({ title: 'Mira', body: 'Runs the inn at the crossroads.', kind: 'npc', updatedAt: 5 });
  const inn = note({ title: 'The Inn', body: 'Mira works here. Cheap beds.', kind: 'location', updatedAt: 9 });
  const quest = note({ title: 'Find the map', kind: 'quest', status: 'done', updatedAt: 7 });
  const quest2 = note({ title: 'Burn the mill', kind: 'quest', status: 'open', updatedAt: 3 });
  const s1 = note({ title: 'Session 1', kind: 'session', sessionNumber: 1, updatedAt: 2 });
  const s2 = note({ title: 'Session 2', kind: 'session', sessionNumber: 2, updatedAt: 1 });
  const all = [mira, inn, quest, quest2, s1, s2];

  it('shows title matches before body matches, with a snippet from the body', () => {
    const hits = searchJournal(all, { query: 'mira' });
    expect(hits.map((h) => h.note.title)).toEqual(['Mira', 'The Inn']);
    expect(hits[1].snippet).toContain('Mira works here');
    expect(searchJournal(all, { query: 'zzz' })).toEqual([]);
  });

  it('filters by kind and by quest status', () => {
    expect(searchJournal(all, { kind: 'npc' }).map((h) => h.note.title)).toEqual(['Mira']);
    expect(searchJournal(all, { kind: 'quest', status: 'open' }).map((h) => h.note.title)).toEqual(['Burn the mill']);
    expect(searchJournal(all, { status: 'done' }).map((h) => h.note.title)).toEqual(['Find the map']);
  });

  it('orders sessions newest first, a kind by title, and a mixed list by last change', () => {
    expect(sortNotes(all.filter((x) => x.kind === 'session'), 'session').map((x) => x.title)).toEqual(['Session 2', 'Session 1']);
    expect(sortNotes(all.filter((x) => x.kind === 'quest'), 'quest').map((x) => x.title)).toEqual(['Burn the mill', 'Find the map']);
    expect(sortNotes(all)[0].title).toBe('The Inn');
  });
});

describe('creating entries', () => {
  it('numbers sessions and starts them from an outline', () => {
    const s = newNote([note({ kind: 'session', sessionNumber: 3, title: 'Session 3' })], { id: 'x', kind: 'session', now: 1 });
    expect(s.sessionNumber).toBe(4);
    expect(s.title).toBe('Session 4');
    expect(s.body).toBe(SESSION_TEMPLATE);
    expect(nextSessionNumber([])).toBe(1);
  });

  it('gives other kinds a plain starting title and no number', () => {
    const e = newNote([], { id: 'x', kind: 'npc', now: 1 });
    expect(e).toMatchObject({ title: 'New NPC', sessionNumber: null, body: '' });
  });

  it('keeps titles unique, because links go by title', () => {
    const j = [note({ title: 'Mira' }), note({ title: 'Mira 2' })];
    expect(uniqueTitle(j, 'mira')).toBe('mira 3');
    expect(uniqueTitle(j, 'Fresh')).toBe('Fresh');
    expect(uniqueTitle(j, '   ')).toBe('Untitled');
    expect(uniqueTitle(j, 'a [[b]]\nc')).toBe('a b c');
    expect(newNote(j, { id: 'x', kind: 'note', now: 1, title: 'Mira' }).title).toBe('Mira 3');
  });

  it('stops adding past the limit but still saves existing entries', () => {
    let d = createCampaign(emptyDmData(), { id: 'c', name: 'T', now: 1 });
    const many = Array.from({ length: MAX_NOTES }, (_, i) => note({ id: `m${i}`, title: `T${i}` }));
    d = { ...d, campaigns: [{ ...d.campaigns[0], journal: many }] };
    const over = saveNote(d, 'c', note({ id: 'extra' }), 2);
    expect(over.campaigns[0].journal).toHaveLength(MAX_NOTES);
    const edit = saveNote(d, 'c', { ...many[0], body: 'changed' }, 2);
    expect(edit.campaigns[0].journal[0].body).toBe('changed');
  });
});

describe('editing entries', () => {
  it('renames an entry and rewrites the links to it in other entries', () => {
    const mira = note({ id: 'm', title: 'Mira' });
    const a = note({ id: 'a', title: 'A', body: 'See [[Mira]] and [[mira]] and [[Mirabel]]. Also [[Other]].' });
    const d = retitleNote(campaignWith(mira, a), 'c', 'm', 'Mira Vance', 9);
    const [m, after] = d.campaigns[0].journal;
    expect(m.title).toBe('Mira Vance');
    expect(after.body).toBe('See [[Mira Vance]] and [[Mira Vance]] and [[Mirabel]]. Also [[Other]].');
    expect(backlinks(d.campaigns[0].journal, m).map((x) => x.id)).toEqual(['a']);
  });

  it('will not rename onto another entry\'s title', () => {
    const d = retitleNote(campaignWith(note({ id: 'm', title: 'Mira' }), note({ id: 'b', title: 'Bo' })), 'c', 'b', 'mira', 9);
    expect(d.campaigns[0].journal[1].title).toBe('mira 2');
  });

  it('leaves everything alone for an unchanged or unknown title', () => {
    const d = campaignWith(note({ id: 'm', title: 'Mira' }));
    expect(retitleNote(d, 'c', 'm', 'Mira', 9)).toEqual(d);
    expect(retitleNote(d, 'c', 'missing', 'X', 9).campaigns[0].journal[0].title).toBe('Mira');
  });

  it('patches text, kind and status, and manages the session number', () => {
    let d = campaignWith(note({ id: 'x', title: 'X' }), note({ id: 's', title: 'Session 1', kind: 'session', sessionNumber: 1 }));
    d = patchNote(d, 'c', 'x', { body: 'hello', kind: 'session' }, 5);
    expect(d.campaigns[0].journal[0]).toMatchObject({ body: 'hello', kind: 'session', sessionNumber: 2 });
    d = patchNote(d, 'c', 'x', { kind: 'quest', status: 'done' }, 6);
    expect(d.campaigns[0].journal[0]).toMatchObject({ kind: 'quest', status: 'done', sessionNumber: null });
    d = patchNote(d, 'c', 's', { sessionNumber: 99999 }, 7);
    expect(d.campaigns[0].journal[1].sessionNumber).toBe(9999);
  });

  it('deletes an entry', () => {
    const d = deleteNote(campaignWith(note({ id: 'a' }), note({ id: 'b' })), 'c', 'a', 3);
    expect(d.campaigns[0].journal.map((x) => x.id)).toEqual(['b']);
  });
});

describe('saved journal', () => {
  it('round-trips and survives damage', () => {
    const d = campaignWith(note({ id: 'a', title: 'A', body: '[[B]]', kind: 'quest', status: 'dropped' }));
    const back = parseDmData(JSON.stringify(d));
    expect(back.ok && back.data.campaigns[0].journal[0]).toMatchObject({ id: 'a', kind: 'quest', status: 'dropped', body: '[[B]]' });

    const raw = {
      campaigns: [
        {
          id: 'c',
          name: 'T',
          party: [],
          journal: [
            'nope',
            { title: 'no id' },
            { id: 'x', kind: 'weird', status: 'huh', title: '[[Bad]]\ntitle', body: 5, sessionNumber: 'x' },
            { id: 's', kind: 'session', title: 'S', sessionNumber: -4 },
          ],
        },
      ],
    };
    const out = parseDmData(JSON.stringify(raw));
    expect(out.ok).toBe(true);
    if (out.ok) {
      const [x, s] = out.data.campaigns[0].journal;
      expect(x).toMatchObject({ kind: 'note', status: 'open', body: '', sessionNumber: null });
      expect(x.title).not.toMatch(/[[\]\n]/);
      expect(s.sessionNumber).toBe(1);
    }
  });

  it('keeps old saved data working (no journal yet)', () => {
    const out = parseDmData(JSON.stringify({ v: 1, campaigns: [{ id: 'c', name: 'T', party: [] }] }));
    expect(out.ok && out.data.campaigns[0].journal).toEqual([]);
  });
});
