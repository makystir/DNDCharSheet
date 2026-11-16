import { useMemo, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import type { DmNote, DmNoteKind, DmQuestStatus } from '../../types/dm';
import type { DmApi } from './dmApi';
import { activeCampaign } from '../../logic/dm-campaign';
import {
  KIND_LABELS,
  KIND_PLURAL,
  NOTE_KINDS,
  QUEST_STATUSES,
  STATUS_LABELS,
  backlinks,
  deleteNote,
  newNote,
  noteById,
  patchNote,
  retitleNote,
  saveNote,
  searchJournal,
  MAX_NOTES,
  type NotePatch,
} from '../../logic/dm-journal';
import { clockNow } from '../../logic/dm-mode';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { NoteEditor, NoteView } from './JournalNote';
import styles from './dm.module.css';
import jr from './journal.module.css';

interface JournalPageProps {
  dm: DmApi;
  onNotify: (text: string) => void;
  onOpenCampaign: () => void;
}

/** Sessions, NPCs, places, quests and notes for the open campaign, with search and links between them. */
export function JournalPage({ dm, onNotify, onOpenCampaign }: JournalPageProps) {
  const campaign = activeCampaign(dm.data);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<DmNoteKind | ''>('');
  const [status, setStatus] = useState<DmQuestStatus | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<DmNote | null>(null);

  const journal = useMemo(() => campaign?.journal ?? [], [campaign]);
  const hits = useMemo(
    () => searchJournal(journal, { query, kind: kind || undefined, status: kind === 'quest' && status ? status : undefined }),
    [journal, query, kind, status],
  );

  if (!campaign) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Journal</h1>
        <Card>
          <div className={styles.stack}>
            <p className={styles.muted}>Create a campaign first. The journal belongs to a campaign.</p>
            <div className={styles.row}>
              <button type="button" className={styles.btnPrimary} onClick={onOpenCampaign}>
                Go to Campaign
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const selected = noteById(journal, selectedId);
  const campaignId = campaign.id;

  const create = (k: DmNoteKind, title?: string) => {
    if (journal.length >= MAX_NOTES) {
      onNotify(`A campaign journal holds up to ${MAX_NOTES} entries.`);
      return;
    }
    const now = clockNow();
    const note = newNote(journal, { id: crypto.randomUUID(), kind: k, now, title });
    dm.update((d) => saveNote(d, campaignId, note, now));
    setSelectedId(note.id);
    setEditing(true);
    // Make sure the new entry shows in the list.
    setQuery('');
    if (kind !== '' && kind !== k) setKind('');
  };

  const patch = (id: string, p: NotePatch) => {
    const now = clockNow();
    dm.update((d) => patchNote(d, campaignId, id, p, now));
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Journal</h1>
          <div className={styles.muted}>
            {campaign.name} · {journal.length} {journal.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>
      </div>

      <Card>
        <div className={styles.stack}>
          <div className={jr.newRow} role="group" aria-label="New entry">
            {NOTE_KINDS.map((k) => (
              <button key={k} type="button" className={k === 'session' ? styles.btnPrimary : styles.btn} onClick={() => create(k)}>
                New {KIND_LABELS[k].toLowerCase()}
              </button>
            ))}
          </div>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Search titles and text</span>
              <input
                className={styles.input}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="For example: innkeeper"
              />
            </label>
            <label className={styles.field} style={{ flex: '0 1 180px' }}>
              <span className={styles.fieldLabel}>Show</span>
              <select className={styles.input} value={kind} onChange={(e) => setKind(e.target.value as DmNoteKind | '')}>
                <option value="">Everything</option>
                {NOTE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_PLURAL[k]}
                  </option>
                ))}
              </select>
            </label>
            {kind === 'quest' && (
              <label className={styles.field} style={{ flex: '0 1 160px' }}>
                <span className={styles.fieldLabel}>Quest status</span>
                <select className={styles.input} value={status} onChange={(e) => setStatus(e.target.value as DmQuestStatus | '')}>
                  <option value="">Any</option>
                  {QUEST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </Card>

      <div className={jr.layout}>
        <ul className={jr.list} aria-label="Journal entries">
          {hits.length === 0 && (
            <li className={styles.muted} style={{ padding: 12 }}>
              {journal.length === 0 ? 'No entries yet. Start with a session, an NPC or a place.' : 'Nothing matches that search.'}
            </li>
          )}
          {hits.map(({ note, snippet }) => (
            <li key={note.id}>
              <button
                type="button"
                className={note.id === selectedId ? jr.itemActive : jr.item}
                aria-pressed={note.id === selectedId}
                onClick={() => {
                  setSelectedId(note.id);
                  setEditing(false);
                }}
              >
                <span>{note.title}</span>
                <span className={jr.itemMeta}>
                  {KIND_LABELS[note.kind]}
                  {note.kind === 'session' && note.sessionNumber !== null ? ` ${note.sessionNumber}` : ''}
                  {note.kind === 'quest' ? ` · ${STATUS_LABELS[note.status]}` : ''}
                </span>
                {snippet && <span className={jr.snippet}>{snippet}</span>}
              </button>
            </li>
          ))}
        </ul>

        <Card>
          {!selected ? (
            <>
              <SectionHeader icon={NotebookPen} title="Entry" />
              <p className={styles.muted}>Pick an entry from the list, or start a new one.</p>
            </>
          ) : editing ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              journal={journal}
              onTitle={(title) => {
                const now = clockNow();
                dm.update((d) => retitleNote(d, campaignId, selected.id, title, now));
              }}
              onPatch={(p) => patch(selected.id, p)}
              onDone={() => setEditing(false)}
            />
          ) : (
            <NoteView
              note={selected}
              journal={journal}
              onOpen={(id) => setSelectedId(id)}
              onCreateLinked={(title) => create('note', title)}
              onEdit={() => setEditing(true)}
              onDelete={() => setDeleting(selected)}
              onStatus={(s) => patch(selected.id, { status: s })}
            />
          )}
        </Card>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Delete entry"
          message={(() => {
            const n = backlinks(journal, deleting).length;
            return `Delete "${deleting.title}"? This cannot be undone.${n > 0 ? ` ${n} other ${n === 1 ? 'entry links' : 'entries link'} to it; those links will show as missing.` : ''}`;
          })()}
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const id = deleting.id;
            const now = clockNow();
            dm.update((d) => deleteNote(d, campaignId, id, now));
            setSelectedId(null);
            setDeleting(null);
            onNotify('Entry deleted.');
          }}
        />
      )}
    </div>
  );
}

