/**
 * Pure logic for the campaign journal: entries (sessions, NPCs, places, quests,
 * notes), `[[Title]]` links between them, backlinks, search and ordering.
 *
 * This is the DM's own bookkeeping, not a game rule, so no rulebook applies.
 * Bodies are plain text and are only ever shown as text, never as HTML.
 */
import type { DmCampaign, DmData, DmNote, DmNoteKind, DmQuestStatus } from '../types/dm';

export const NOTE_KINDS: readonly DmNoteKind[] = ['session', 'npc', 'location', 'quest', 'note'];

export const KIND_LABELS: Record<DmNoteKind, string> = {
  session: 'Session',
  npc: 'NPC',
  location: 'Location',
  quest: 'Quest',
  note: 'Note',
};

export const KIND_PLURAL: Record<DmNoteKind, string> = {
  session: 'Sessions',
  npc: 'NPCs',
  location: 'Locations',
  quest: 'Quests',
  note: 'Notes',
};

export const QUEST_STATUSES: readonly DmQuestStatus[] = ['open', 'done', 'dropped'];

export const STATUS_LABELS: Record<DmQuestStatus, string> = { open: 'Open', done: 'Done', dropped: 'Dropped' };

export const MAX_NOTES = 500;
export const MAX_TITLE = 100;
export const MAX_BODY = 50000;

/** A starting outline for a new session entry. The DM can change or delete it. */
export const SESSION_TEMPLATE = 'Recap:\n\nWhat happened:\n\nLoose ends:\n\nNext time:\n';

// ------------------------------------------------------------------- links

export type BodySegment = { type: 'text'; text: string } | { type: 'link'; title: string };

const LINK = /\[\[([^[\]\n]{1,80})\]\]/g;

/** Split a body into plain text and `[[Title]]` links. */
export function parseBody(body: string): BodySegment[] {
  const out: BodySegment[] = [];
  let last = 0;
  for (const m of body.matchAll(LINK)) {
    const title = m[1].trim();
    if (title === '') continue;
    if (m.index > last) out.push({ type: 'text', text: body.slice(last, m.index) });
    out.push({ type: 'link', title });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ type: 'text', text: body.slice(last) });
  return out;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The entry a link points at (matched by title, ignoring case), if any. */
export function resolveLink(journal: DmNote[], title: string): DmNote | undefined {
  return journal.find((n) => same(n.title, title));
}

/** Titles an entry links to, without repeats. */
export function outgoingLinks(note: DmNote): string[] {
  const seen = new Map<string, string>();
  for (const s of parseBody(note.body)) if (s.type === 'link' && !seen.has(s.title.toLowerCase())) seen.set(s.title.toLowerCase(), s.title);
  return [...seen.values()];
}

/** Other entries whose body links to this one. */
export function backlinks(journal: DmNote[], note: DmNote): DmNote[] {
  return journal.filter((o) => o.id !== note.id && outgoingLinks(o).some((t) => same(t, note.title)));
}

// ------------------------------------------------------------------ search

export interface SearchFilter {
  query?: string;
  kind?: DmNoteKind;
  status?: DmQuestStatus;
}

function snippet(body: string, q: string): string {
  const at = body.toLowerCase().indexOf(q);
  if (at < 0) return '';
  const start = Math.max(0, at - 30);
  const text = body.slice(start, at + q.length + 50).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${text}${at + q.length + 50 < body.length ? '…' : ''}`;
}

export interface JournalHit {
  note: DmNote;
  /** A bit of body text around the match, when the match was in the body. */
  snippet: string;
}

/** Order for a list: sessions newest first, other kinds by title, a mixed list by last change. */
export function sortNotes(notes: DmNote[], kind?: DmNoteKind): DmNote[] {
  const list = [...notes];
  if (kind === 'session') return list.sort((a, b) => (b.sessionNumber ?? 0) - (a.sessionNumber ?? 0) || b.updatedAt - a.updatedAt);
  if (kind) return list.sort((a, b) => a.title.localeCompare(b.title));
  return list.sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title));
}

/** Filter and search. Title matches come before body matches. */
export function searchJournal(journal: DmNote[], f: SearchFilter): JournalHit[] {
  const q = (f.query ?? '').trim().toLowerCase();
  const pool = sortNotes(
    journal.filter((n) => (!f.kind || n.kind === f.kind) && (!f.status || (n.kind === 'quest' && n.status === f.status))),
    f.kind,
  );
  if (q === '') return pool.map((note) => ({ note, snippet: '' }));
  const inTitle = pool.filter((n) => n.title.toLowerCase().includes(q));
  const inBody = pool.filter((n) => !n.title.toLowerCase().includes(q) && n.body.toLowerCase().includes(q));
  return [
    ...inTitle.map((note) => ({ note, snippet: snippet(note.body, q) })),
    ...inBody.map((note) => ({ note, snippet: snippet(note.body, q) })),
  ];
}

// ------------------------------------------------------------------- edits

function cleanTitle(title: string): string {
  return title.replace(/[[\]\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);
}

/** The next free session number. */
export function nextSessionNumber(journal: DmNote[]): number {
  return journal.reduce((m, n) => Math.max(m, n.sessionNumber ?? 0), 0) + 1;
}

/** A title no other entry uses, adding a number when needed ("New NPC 2"). */
export function uniqueTitle(journal: DmNote[], wanted: string, ignoreId?: string): string {
  const base = cleanTitle(wanted) || 'Untitled';
  const taken = (t: string) => journal.some((n) => n.id !== ignoreId && same(n.title, t));
  if (!taken(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base.slice(0, MAX_TITLE - 4)} ${i}`;
    if (!taken(candidate)) return candidate;
  }
  return base;
}

export function newNote(journal: DmNote[], input: { id: string; kind: DmNoteKind; now: number; title?: string }): DmNote {
  const isSession = input.kind === 'session';
  const number = isSession ? nextSessionNumber(journal) : null;
  const fallback = isSession ? `Session ${number}` : `New ${KIND_LABELS[input.kind]}`;
  return {
    id: input.id,
    kind: input.kind,
    title: uniqueTitle(journal, input.title ?? fallback),
    body: isSession ? SESSION_TEMPLATE : '',
    status: 'open',
    sessionNumber: number,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

function mapCampaign(data: DmData, campaignId: string, fn: (c: DmCampaign) => DmCampaign): DmData {
  return { ...data, campaigns: data.campaigns.map((c) => (c.id === campaignId ? fn(c) : c)) };
}

/** Add an entry, or replace the entry with the same id. Past the limit, a new entry is not added. */
export function saveNote(data: DmData, campaignId: string, note: DmNote, now: number): DmData {
  return mapCampaign(data, campaignId, (c) => {
    const exists = c.journal.some((n) => n.id === note.id);
    if (!exists && c.journal.length >= MAX_NOTES) return c;
    const next: DmNote = { ...note, body: note.body.slice(0, MAX_BODY), updatedAt: now };
    return {
      ...c,
      updatedAt: now,
      journal: exists ? c.journal.map((n) => (n.id === note.id ? next : n)) : [...c.journal, next],
    };
  });
}

function replaceLinks(body: string, from: string, to: string): string {
  return body.replace(LINK, (whole, inner: string) => (same(inner, from) ? `[[${to}]]` : whole));
}

/**
 * Change an entry's title and keep every `[[link]]` to it working: links in the
 * other entries are rewritten to the new title. A title another entry already
 * has is made unique.
 */
export function retitleNote(data: DmData, campaignId: string, noteId: string, title: string, now: number): DmData {
  return mapCampaign(data, campaignId, (c) => {
    const note = c.journal.find((n) => n.id === noteId);
    if (!note) return c;
    const next = uniqueTitle(c.journal, title, noteId);
    if (next === note.title) return c;
    return {
      ...c,
      updatedAt: now,
      journal: c.journal.map((n) =>
        n.id === noteId
          ? { ...n, title: next, updatedAt: now }
          : n.body.includes('[[')
            ? { ...n, body: replaceLinks(n.body, note.title, next) }
            : n,
      ),
    };
  });
}

export interface NotePatch {
  body?: string;
  kind?: DmNoteKind;
  status?: DmQuestStatus;
  sessionNumber?: number | null;
}

/**
 * Change an entry's body, kind, quest status or session number (not its title:
 * see retitleNote). A new session entry gets the next free number, and an entry
 * that stops being a session loses its number.
 */
export function patchNote(data: DmData, campaignId: string, noteId: string, patch: NotePatch, now: number): DmData {
  return mapCampaign(data, campaignId, (c) => ({
    ...c,
    updatedAt: now,
    journal: c.journal.map((n) => {
      if (n.id !== noteId) return n;
      const kind = patch.kind ?? n.kind;
      let sessionNumber = patch.sessionNumber !== undefined ? patch.sessionNumber : n.sessionNumber;
      if (kind !== 'session') sessionNumber = null;
      else if (sessionNumber === null) sessionNumber = nextSessionNumber(c.journal);
      else sessionNumber = Math.min(9999, Math.max(1, Math.trunc(sessionNumber)));
      return {
        ...n,
        kind,
        body: patch.body !== undefined ? patch.body.slice(0, MAX_BODY) : n.body,
        status: patch.status ?? n.status,
        sessionNumber,
        updatedAt: now,
      };
    }),
  }));
}

export function deleteNote(data: DmData, campaignId: string, noteId: string, now: number): DmData {
  return mapCampaign(data, campaignId, (c) => ({ ...c, updatedAt: now, journal: c.journal.filter((n) => n.id !== noteId) }));
}

export function noteById(journal: DmNote[], id: string | null): DmNote | undefined {
  return id === null ? undefined : journal.find((n) => n.id === id);
}
