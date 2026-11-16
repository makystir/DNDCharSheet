import { useRef, useState } from 'react';
import type { DmNote, DmNoteKind, DmQuestStatus } from '../../types/dm';
import {
  KIND_LABELS,
  MAX_BODY,
  MAX_TITLE,
  NOTE_KINDS,
  QUEST_STATUSES,
  STATUS_LABELS,
  backlinks,
  parseBody,
  resolveLink,
} from '../../logic/dm-journal';
import styles from './dm.module.css';
import jr from './journal.module.css';

interface NoteViewProps {
  note: DmNote;
  journal: DmNote[];
  onOpen: (id: string) => void;
  onCreateLinked: (title: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (status: DmQuestStatus) => void;
}

/** One entry, read-only, with its `[[links]]` as buttons and the entries that link back to it. */
export function NoteView({ note, journal, onOpen, onCreateLinked, onEdit, onDelete, onStatus }: NoteViewProps) {
  const segments = parseBody(note.body);
  const back = backlinks(journal, note);
  return (
    <article className={jr.note} aria-label={`${note.title} entry`}>
      <header className={jr.noteHead}>
        <div>
          <h2 className={jr.noteTitle}>{note.title}</h2>
          <div className={styles.muted}>
            {KIND_LABELS[note.kind]}
            {note.kind === 'session' && note.sessionNumber !== null && ` ${note.sessionNumber}`}
          </div>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.btn} onClick={onEdit}>
            Edit
          </button>
          <button type="button" className={styles.btnDanger} onClick={onDelete}>
            Delete
          </button>
        </div>
      </header>

      {note.kind === 'quest' && (
        <label className={styles.field} style={{ flex: '0 1 200px' }}>
          <span className={styles.fieldLabel}>Quest status</span>
          <select className={styles.input} value={note.status} onChange={(e) => onStatus(e.target.value as DmQuestStatus)}>
            {QUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className={jr.body} data-testid="note-body">
        {note.body.trim() === '' ? (
          <span className={styles.muted}>Nothing written yet. Press Edit to add to it. Write [[Another entry]] to link to it.</span>
        ) : (
          segments.map((s, i) => {
            if (s.type === 'text') return <span key={i}>{s.text}</span>;
            const target = resolveLink(journal, s.title);
            return target ? (
              <button key={i} type="button" className={jr.link} onClick={() => onOpen(target.id)} aria-label={`Open ${target.title}`}>
                {s.title}
              </button>
            ) : (
              <button
                key={i}
                type="button"
                className={jr.linkMissing}
                onClick={() => onCreateLinked(s.title)}
                aria-label={`Create ${s.title}`}
                title="No entry has this title yet. Press to create it."
              >
                {s.title} (new)
              </button>
            );
          })
        )}
      </div>

      {back.length > 0 && (
        <section aria-label="Linked from">
          <h3 className={jr.sectionTitle}>Linked from</h3>
          <div className={styles.chips}>
            {back.map((b) => (
              <button key={b.id} type="button" className={jr.link} onClick={() => onOpen(b.id)} aria-label={`Open ${b.title}`}>
                {b.title}
              </button>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

interface NoteEditorProps {
  note: DmNote;
  journal: DmNote[];
  onTitle: (title: string) => void;
  onPatch: (patch: { body?: string; kind?: DmNoteKind; status?: DmQuestStatus; sessionNumber?: number | null }) => void;
  onDone: () => void;
}

/** Edit one entry. Changes are saved as you type; the title is saved when you leave the field. */
export function NoteEditor({ note, journal, onTitle, onPatch, onDone }: NoteEditorProps) {
  const [body, setBody] = useState(note.body);
  const ref = useRef<HTMLTextAreaElement>(null);
  const others = journal.filter((n) => n.id !== note.id).sort((a, b) => a.title.localeCompare(b.title));

  const change = (value: string) => {
    setBody(value);
    onPatch({ body: value });
  };

  const insertLink = (title: string) => {
    if (title === '') return;
    const el = ref.current;
    const at = el ? el.selectionStart : body.length;
    const end = el ? el.selectionEnd : body.length;
    const next = `${body.slice(0, at)}[[${title}]]${body.slice(end)}`;
    change(next);
  };

  return (
    <div className={jr.note} role="group" aria-label={`Editing ${note.title}`}>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Title</span>
          <input
            key={`${note.id}-${note.title}`}
            className={styles.input}
            defaultValue={note.title}
            maxLength={MAX_TITLE}
            onBlur={(e) => {
              const v = e.currentTarget.value;
              if (v.trim() === '') e.currentTarget.value = note.title;
              else onTitle(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </label>
        <label className={styles.field} style={{ flex: '0 1 160px' }}>
          <span className={styles.fieldLabel}>Kind</span>
          <select className={styles.input} value={note.kind} onChange={(e) => onPatch({ kind: e.target.value as DmNoteKind })}>
            {NOTE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        {note.kind === 'quest' && (
          <label className={styles.field} style={{ flex: '0 1 160px' }}>
            <span className={styles.fieldLabel}>Quest status</span>
            <select className={styles.input} value={note.status} onChange={(e) => onPatch({ status: e.target.value as DmQuestStatus })}>
              {QUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        )}
        {note.kind === 'session' && (
          <label className={styles.field} style={{ flex: '0 1 140px' }}>
            <span className={styles.fieldLabel}>Session number</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              value={note.sessionNumber ?? ''}
              onChange={(e) => onPatch({ sessionNumber: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </label>
        )}
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Text</span>
        <textarea
          ref={ref}
          className={styles.textarea}
          style={{ minHeight: 260 }}
          value={body}
          maxLength={MAX_BODY}
          onChange={(e) => change(e.target.value)}
        />
      </label>

      <div className={styles.row}>
        <label className={styles.field} style={{ flex: '0 1 260px' }}>
          <span className={styles.fieldLabel}>Insert a link to...</span>
          <select
            className={styles.input}
            value=""
            onChange={(e) => {
              insertLink(e.target.value);
            }}
            disabled={others.length === 0}
          >
            <option value="">{others.length === 0 ? 'No other entries yet' : 'Choose an entry'}</option>
            {others.map((n) => (
              <option key={n.id} value={n.title}>
                {n.title}
              </option>
            ))}
          </select>
        </label>
        <span className={styles.muted}>
          You can also type [[Title]]. If you change a title, links to it are updated.
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className={styles.btnPrimary} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
