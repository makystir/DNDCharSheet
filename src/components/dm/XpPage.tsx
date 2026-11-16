import { useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import type { Breakdown } from '../../logic/breakdown';
import type { DmAward, DmAwardSource } from '../../types/dm';
import type { DmApi } from './dmApi';
import { DIFFICULTIES, DIFFICULTY_LABELS, type EncounterDifficulty } from '../../data/xp-tables';
import { countsForXp } from '../../logic/dm-balance';
import { addAward, activeCampaign, memberStats } from '../../logic/dm-campaign';
import {
  awardIdFromUuid,
  cleanLabel,
  encodeAward,
  fightShare,
  MAX_AWARD_XP,
  MAX_LABEL,
  milestoneShare,
  previewAward,
  shareBreakdown,
  type AwardPayload,
  type AwardPreview,
} from '../../logic/dm-awards';
import { clockNow } from '../../logic/dm-mode';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './dm.module.css';
import xp from './xp.module.css';

interface XpPageProps {
  dm: DmApi;
  onNotify: (text: string) => void;
  /** Source of a UUID for new award IDs. Tests inject a fixed one. */
  newId?: () => string;
}

type Tab = 'fight' | 'milestone' | 'noncombat' | 'level';
const TABS: { id: Tab; label: string }[] = [
  { id: 'fight', label: 'Fight' },
  { id: 'milestone', label: 'Milestone' },
  { id: 'noncombat', label: 'Noncombat' },
  { id: 'level', label: 'Level' },
];

const defaultNewId = () => crypto.randomUUID();
const n = (v: number) => v.toLocaleString();
const PREVIEW_ID = 'preview00000';

interface Amount {
  kind: 'xp' | 'level';
  amount: number;
  source: DmAwardSource;
  /** How the per-character amount was worked out. */
  breakdown: Breakdown | null;
  /** Why Create is disabled, if it is. */
  error: string | null;
}

const BLOCKED_TEXT: Record<'milestone-blocked' | 'multiclass-unsupported', string> = {
  'milestone-blocked': 'Blocked: this sheet levels by milestone. The player must switch to XP leveling first.',
  'multiclass-unsupported': 'Blocked: more than one class.',
};

/** Build one award (DMG 2024 "Awarding XP", "Noncombat Challenges", "Milestones") and copy its code. */
export function XpPage({ dm, onNotify, newId = defaultNewId }: XpPageProps) {
  const campaign = activeCampaign(dm.data);
  const party = campaign?.party ?? [];
  const budgetMembers = party.flatMap((m) => {
    const s = memberStats(m);
    return s ? [{ name: s.name, level: s.level }] : [];
  });

  const [tab, setTab] = useState<Tab>('fight');
  const [label, setLabel] = useState('');
  const [encounterId, setEncounterId] = useState('');
  const [sharers, setSharers] = useState('');
  const [milestone, setMilestone] = useState<'major' | 'minor'>('major');
  const [noncombat, setNoncombat] = useState<EncounterDifficulty | 'typed'>('moderate');
  const [typed, setTyped] = useState('100');
  const [targetLevel, setTargetLevel] = useState('2');
  // `key` ties a shown code to the draft that was current when it was made or re-shown; history marks a re-shown past award.
  const [shownRaw, setShown] = useState<{ code: string; id: string; key: string; history: boolean } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const creating = useRef(false);

  const encounters = campaign?.encounters ?? [];
  const encounter = encounters.find((e) => e.id === encounterId) ?? encounters[0];
  const partySize = Math.max(1, party.length);
  // Blank means the whole party. Anything else must be a whole number of at least 1 (no silent coercion).
  const sharersText = sharers.trim();
  const sharersValid = sharersText === '' || (/^\d+$/.test(sharersText) && Number(sharersText) >= 1);
  const sharerCount = sharersText === '' || !sharersValid ? partySize : Number(sharersText);
  const cleanedLabel = cleanLabel(label);

  const amount: Amount = (() => {
    if (tab === 'fight') {
      if (!sharersValid) return { kind: 'xp', amount: 0, source: 'fight', breakdown: null, error: 'Characters sharing the XP must be a whole number of 1 or more, or blank for the whole party.' };
      if (!encounter) return { kind: 'xp', amount: 0, source: 'fight', breakdown: null, error: 'Save an encounter on the Encounter page first.' };
      const counted = encounter.combatants.filter((c) => c.kind === 'monster' && countsForXp(c));
      const s = fightShare(counted, sharerCount);
      const unknown = counted.filter((c) => typeof c.xp !== 'number').map((c) => c.name);
      const breakdown = shareBreakdown(s.total, sharerCount);
      const error =
        unknown.length > 0
          ? `Set the XP of ${unknown.join(', ')} on the Encounter page, or untick ${unknown.length === 1 ? 'it' : 'them'}, before creating the award.`
          : s.share.total < 1
            ? 'No XP to award'
            : s.share.total > MAX_AWARD_XP
              ? `The share is over the ${n(MAX_AWARD_XP)} XP limit.`
              : null;
      return { kind: 'xp', amount: s.share.total, source: 'fight', breakdown, error };
    }
    if (tab === 'milestone' || (tab === 'noncombat' && noncombat !== 'typed')) {
      const kind = tab === 'milestone' ? milestone : (noncombat as EncounterDifficulty);
      const s = milestoneShare(budgetMembers, kind, partySize);
      return {
        kind: 'xp',
        amount: s.share.total,
        source: tab === 'milestone' ? kind === 'major' ? 'major' : 'minor' : 'noncombat',
        breakdown: { ...shareBreakdown(s.total, partySize), note: `${s.total.note ?? ''} Total budget ${n(s.total.total)} XP.${s.note ? ` ${s.note}` : ''}`.trim() },
        error: s.share.total < 1 ? 'No XP to award' : s.share.total > MAX_AWARD_XP ? `The share is over the ${n(MAX_AWARD_XP)} XP limit.` : null,
      };
    }
    if (tab === 'noncombat') {
      const v = Number(typed);
      const ok = Number.isInteger(v) && v >= 1 && v <= MAX_AWARD_XP;
      return { kind: 'xp', amount: ok ? v : 0, source: 'manual', breakdown: null, error: ok ? null : `Enter a whole number from 1 to ${n(MAX_AWARD_XP)}.` };
    }
    const v = Number(targetLevel);
    const ok = Number.isInteger(v) && v >= 1 && v <= 20;
    return { kind: 'level', amount: ok ? v : 0, source: 'level', breakdown: null, error: ok ? null : 'Enter a level from 1 to 20.' };
  })();

  const labelError = cleanedLabel.length > MAX_LABEL ? `The label can be at most ${MAX_LABEL} characters.` : null;
  const problem = amount.error ?? labelError;

  const previewAwardPayload: AwardPayload = { kind: amount.kind, amount: Math.max(1, amount.amount), id: PREVIEW_ID, label: cleanedLabel };
  const rows: AwardPreview[] = problem ? [] : party.map((m) => previewAward(m, previewAwardPayload));
  const totalAdded: Breakdown = {
    total: rows.reduce((s, r) => s + (r.addedXp?.total ?? 0), 0),
    components: rows.map((r) => ({ label: r.name, value: r.addedXp?.total ?? 0 })),
  };

  const draftKey = JSON.stringify([amount.kind, amount.amount, amount.source, cleanedLabel]);
  // A shown code (created or re-shown from history) is hidden as soon as the draft changes, so Copy never sends an award that differs from the form.
  const shown = shownRaw && shownRaw.key === draftKey ? shownRaw : null;

  const create = async (another = false) => {
    if (problem) return;
    if (!another && shown && !shown.history) return; // already created for this draft; reuse it
    if (creating.current) return;
    creating.current = true;
    try {
      await createAward(draftKey);
    } finally {
      creating.current = false;
    }
  };

  const createAward = async (key: string) => {
    const award: DmAward = {
      id: awardIdFromUuid(newId()),
      kind: amount.kind,
      amount: amount.amount,
      label: cleanedLabel,
      source: amount.source,
      createdAt: clockNow(),
    };
    const encoded = await encodeAward({ kind: award.kind, amount: award.amount, id: award.id, label: award.label });
    if (!encoded.ok) {
      setCreateError(encoded.error);
      setShown(null);
      return;
    }
    setCreateError(null);
    if (campaign) dm.update((d) => addAward(d, campaign.id, award));
    setShown({ code: encoded.code, id: award.id, key, history: false });
  };

  const showCode = async (award: DmAward) => {
    const encoded = await encodeAward({ kind: award.kind, amount: award.amount, id: award.id, label: award.label });
    if (!encoded.ok) {
      setCreateError(encoded.error);
      return;
    }
    setCreateError(null);
    setShown({ code: encoded.code, id: award.id, key: draftKey, history: true });
  };

  const copy = async () => {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown.code);
      onNotify('Code copied');
    } catch {
      onNotify('Select the code and copy it by hand');
      codeRef.current?.select();
    }
  };

  const history = [...(campaign?.awards ?? [])].reverse();

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Party XP</h1>
          <div className={styles.muted}>
            {campaign ? campaign.name : 'No campaign yet'} · Dungeon Master's Guide 2024, "Awarding XP" and "Milestones"
          </div>
        </div>
      </div>

      <Card>
        <SectionHeader icon={Trophy} title="Build an award" />
        <div className={styles.tabs} role="tablist" aria-label="Kind of award">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? styles.tabActive : styles.tab}
              onClick={() => {
                setTab(t.id);
                setShown(null);
                setCreateError(null);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.stack} style={{ marginTop: 16 }}>
          {tab === 'fight' && (
            <div className={styles.row}>
              <label className={styles.field} style={{ flex: '1 1 220px' }}>
                <span className={styles.fieldLabel}>Encounter</span>
                <select className={styles.input} value={encounter?.id ?? ''} onChange={(e) => setEncounterId(e.target.value)} disabled={encounters.length === 0}>
                  {encounters.length === 0 && <option value="">No saved encounters</option>}
                  {encounters.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field} style={{ flex: '0 1 200px' }}>
                <span className={styles.fieldLabel}>Characters sharing the XP</span>
                <input className={styles.input} type="number" min={1} value={sharers} placeholder={String(partySize)} onChange={(e) => setSharers(e.target.value)} />
              </label>
              <p className={styles.muted} style={{ flexBasis: '100%', margin: 0 }}>
                Creatures count when they are ticked on the Encounter page (or dead). The characters divide the total evenly, rounded down.
              </p>
            </div>
          )}
          {tab === 'milestone' && (
            <>
              <label className={styles.field} style={{ flex: '0 1 240px' }}>
                <span className={styles.fieldLabel}>Milestone size</span>
                <select className={styles.input} value={milestone} onChange={(e) => setMilestone(e.target.value as 'major' | 'minor')}>
                  <option value="major">Major (a high-difficulty encounter)</option>
                  <option value="minor">Minor (a low-difficulty encounter)</option>
                </select>
              </label>
              <p className={styles.muted} style={{ margin: 0 }}>
                Other milestone rewards (DMG): a Short Rest, a Hit Point Die or a level 1 spell slot back, or magic items regain their expended uses.
              </p>
            </>
          )}
          {tab === 'noncombat' && (
            <div className={styles.row}>
              <label className={styles.field} style={{ flex: '0 1 240px' }}>
                <span className={styles.fieldLabel}>Difficulty of the challenge</span>
                <select className={styles.input} value={noncombat} onChange={(e) => setNoncombat(e.target.value as EncounterDifficulty | 'typed')}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY_LABELS[d]}
                    </option>
                  ))}
                  <option value="typed">Type an amount</option>
                </select>
              </label>
              {noncombat === 'typed' && (
                <label className={styles.field} style={{ flex: '0 1 200px' }}>
                  <span className={styles.fieldLabel}>XP per character</span>
                  <input className={styles.input} type="number" min={1} max={MAX_AWARD_XP} value={typed} onChange={(e) => setTyped(e.target.value)} />
                </label>
              )}
            </div>
          )}
          {tab === 'level' && (
            <label className={styles.field} style={{ flex: '0 1 200px' }}>
              <span className={styles.fieldLabel}>Target level</span>
              <input className={styles.input} type="number" min={1} max={20} value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)} />
            </label>
          )}

          <label className={styles.field} style={{ flex: '0 1 360px' }}>
            <span className={styles.fieldLabel}>Label (optional)</span>
            <input className={styles.input} type="text" maxLength={MAX_LABEL} value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>

          <div data-testid="award-amount">
            {amount.kind === 'level' ? (
              <strong>{amount.amount > 0 ? `Characters reach level ${amount.amount}` : '-'}</strong>
            ) : amount.breakdown ? (
              <CalculatedValue label="XP per character" breakdown={amount.breakdown}>
                {n(amount.amount)} XP per character
              </CalculatedValue>
            ) : (
              <strong>{n(amount.amount)} XP per character</strong>
            )}
          </div>
          {problem && (
            <p className={styles.error} role="alert">
              {problem}
            </p>
          )}
        </div>
      </Card>

      {campaign && party.length > 0 ? (
        <Card>
          <SectionHeader icon={Trophy} title="What each member gets" />
          {problem ? (
            <p className={styles.muted}>Fix the award above to see what each member would gain.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={xp.table}>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Level</th>
                    <th>Current XP</th>
                    <th>+ XP</th>
                    <th>New XP</th>
                    <th>Level you can reach</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.memberId}>
                      <td>{r.name}</td>
                      <td>{r.currentLevel}</td>
                        <>
                          <td>
                            {r.currentXp ? (
                              <CalculatedValue label={`${r.name}: current XP`} breakdown={r.currentXp}>
                                {n(r.currentXp.total)}
                              </CalculatedValue>
                            ) : (
                              <span className={xp.blocked}>XP not tracked</span>
                            )}
                          </td>
                          <td>
                            {r.addedXp && (
                              <CalculatedValue label={`${r.name}: XP added`} breakdown={r.addedXp}>
                                {n(r.addedXp.total)}
                              </CalculatedValue>
                            )}
                          </td>
                          <td>
                            {r.newXp ? (
                              <CalculatedValue label={`${r.name}: new XP`} breakdown={r.newXp}>
                                {n(r.newXp.total)}
                              </CalculatedValue>
                            ) : (
                              <span className={xp.blocked}>XP not tracked</span>
                            )}
                          </td>
                          <td>
                            {r.reachableLevel ? (
                              <CalculatedValue label={`${r.name}: level you can reach`} breakdown={r.reachableLevel}>
                                {r.reachableLevel.total}
                              </CalculatedValue>
                            ) : (
                              <span className={xp.blocked}>Needs current XP</span>
                            )}
                          </td>
                          <td>{r.blocked === 'milestone-blocked' || r.blocked === 'multiclass-unsupported' ? <span className={xp.blocked}>{BLOCKED_TEXT[r.blocked]}</span> : r.levelsGained > 0 && <span className={xp.badge}>Levels up</span>}</td>
                        </>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Party total</td>
                    <td>
                      <CalculatedValue label="Party total XP" breakdown={totalAdded}>
                        {n(totalAdded.total)}
                      </CalculatedValue>
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className={styles.muted}>
            Based on the imported snapshot, which may be out of date. Sheets without an XP mode set count as milestone sheets.
          </p>
        </Card>
      ) : (
        <Card>
          <p className={styles.muted}>
            {campaign
              ? 'The party is empty. Add members on the Party page to see what each would gain. You can still create a code.'
              : 'Create a campaign to keep a party and a history of awards. You can still create a code.'}
          </p>
        </Card>
      )}

      <Card>
        <SectionHeader icon={Trophy} title="Award code" />
        <div className={styles.stack}>
          <div className={styles.row}>
            <button type="button" className={styles.btnPrimary} disabled={problem !== null} onClick={() => void create()}>
              Create code
            </button>
          </div>
          {createError && (
            <p className={styles.error} role="alert">
              {createError}
            </p>
          )}
          {shown && (
            <>
              <textarea ref={codeRef} className={`${styles.textarea} ${xp.code}`} readOnly value={shown.code} aria-label="Award code" onFocus={(e) => e.currentTarget.select()} />
              <div className={styles.row}>
                <button type="button" className={styles.btn} onClick={() => void copy()}>
                  Copy
                </button>
                {!shown.history && (
                  <button type="button" className={styles.btn} onClick={() => void create(true)}>
                    Create another award with these values
                  </button>
                )}
                <span className={styles.muted}>Send this to each player. They paste it on their Advancement page.</span>
              </div>
            </>
          )}
        </div>
      </Card>

      {campaign && (
        <Card>
          <SectionHeader icon={Trophy} title="Award history" />
          {history.length === 0 ? (
            <p className={styles.muted}>No awards yet.</p>
          ) : (
            <ul className={xp.history}>
              {history.map((a) => (
                <li key={a.id} className={xp.historyItem}>
                  <span>
                    {a.label || 'Award'} · {a.kind === 'xp' ? `${n(a.amount)} XP` : `level ${a.amount}`} · {a.source} · {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                  <button type="button" className={styles.btn} onClick={() => void showCode(a)}>
                    Show code
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
