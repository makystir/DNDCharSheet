import { useState } from 'react';
import { Swords } from 'lucide-react';
import type { DmCombatant, DmEncounter } from '../../types/dm';
import type { DmApi, OpenJournal } from './dmApi';
import { activeCampaign, memberStats } from '../../logic/dm-campaign';
import type { BudgetMember } from '../../logic/dm-balance';
import { encounterSummary } from '../../logic/dm-encounter-summary';
import {
  activeEncounter,
  combatantsMissingInitiative,
  dealDamage,
  healCombatant,
  markAfterCombat,
  addCombatants,
  combatSummaryText,
  applyEncounterHpToParty,
  combatantFromMember,
  createEncounter,
  deleteEncounter,
  duplicateEncounter,
  endEncounter,
  isOut,
  nextTurn,
  openEncounter,
  previousTurn,
  removeCombatant,
  restoreCombatant,
  rollInitiatives,
  saveEncounter,
  sortByInitiative,
  startEncounter,
} from '../../logic/dm-encounter';
import { appendToLatestSession } from '../../logic/dm-journal';
import { encounterTreasureSource, type EncounterCrGroup } from '../../logic/dm-treasure';
import { canShowStatBlock, resolveCombatantStatBlock } from '../../logic/dm-library';
import { useUndoToast } from '../../hooks/useUndoToast';
import { createDefaultRng } from '../../logic/random';
import { clockNow } from '../../logic/dm-mode';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { CalculatedValue } from '../shared/CalculatedValue';
import { Toast } from '../shared/Toast';
import { AddCombatantsDialog } from './AddCombatantsDialog';
import { CombatantCard } from './CombatantCard';
import { EncounterBalance } from './EncounterBalance';
import { StatBlockDrawer } from './StatBlockDrawer';
import { XpAwardCard } from './XpAwardCard';
import styles from './dm.module.css';
import enc from './encounter.module.css';

interface EncounterPageProps {
  dm: DmApi;
  onNotify: (text: string) => void;
  onOpenCampaign: () => void;
  /** Open the Party XP page's Fight tab with this encounter already chosen. */
  onOpenPartyXp: (encounterId: string, sharers?: number) => void;
  /** Open the Treasure page with the CRs of the creatures overcome in this fight. */
  onOpenTreasure: (groups: EncounterCrGroup[], encounterId?: string) => void;
  /** Open the Journal, with the given note selected when there is one. */
  onOpenJournal: OpenJournal;
}

/** Combat log lines pasted into the session note with the summary (a long fight's log can run past 100 lines). */
const SUMMARY_LOG_LINES = 10;

const STATUS_LABEL = { setup: 'Setting up', running: 'In progress', ended: 'Finished' } as const;

/** Run an encounter: build the order, roll Initiative, step through turns, track Hit Points. */
export function EncounterPage({ dm, onNotify, onOpenCampaign, onOpenPartyXp, onOpenTreasure, onOpenJournal }: EncounterPageProps) {
  const campaign = activeCampaign(dm.data);
  const [adding, setAdding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [deleting, setDeleting] = useState<DmEncounter | null>(null);
  const [newName, setNewName] = useState('');
  const [startError, setStartError] = useState<string | null>(null);
  const [confirmParty, setConfirmParty] = useState(false);
  const undoToast = useUndoToast();
  // The stat block drawer. id is the creature last shown (the pinned one when follow is off).
  const [statBlock, setStatBlock] = useState<{ encounterId: string; id: string; follow: boolean } | null>(null);

  if (!campaign) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Encounter</h1>
        <Card>
          <div className={styles.stack}>
            <p className={styles.muted}>Create a campaign first. Encounters belong to a campaign.</p>
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

  const open = activeEncounter(campaign);

  const summaryOf = (e: DmEncounter) => encounterSummary(campaign, e);

  const commit = (next: DmEncounter) => {
    const now = clockNow();
    dm.update((d) => saveEncounter(d, campaign.id, next, now));
  };

  if (!open) {
    const create = () => {
      const now = clockNow();
      const created = createEncounter(crypto.randomUUID(), newName, now);
      dm.update((d) => openEncounter(saveEncounter(d, campaign.id, created, now), campaign.id, created.id));
      setNewName('');
    };
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Encounter</h1>
            <div className={styles.muted}>{campaign.name}</div>
          </div>
        </div>
        <Card>
          <SectionHeader icon={Swords} title="Encounters" />
          <div className={styles.stack}>
            {campaign.encounters.length === 0 ? (
              <p className={styles.muted}>No encounters yet. Name one below to set up a fight.</p>
            ) : (
              <ul className={styles.campaignList}>
                {campaign.encounters.map((e) => {
                  const sum = summaryOf(e);
                  return (
                  <li key={e.id} className={styles.campaignItem}>
                    <span>
                      <span className={styles.campaignName}>{e.name}</span>
                      <span className={styles.muted}>
                        {' '}
                        · {STATUS_LABEL[e.status]} · {e.combatants.length} {e.combatants.length === 1 ? 'combatant' : 'combatants'}
                        {e.status !== 'setup' && ` · round ${e.round}`}
                      </span>
                      <span className={styles.muted} data-testid="encounter-summary">
                        {' '}
                        ·{' '}
                        <CalculatedValue label="Encounter XP" breakdown={sum.xpBreakdown}>
                          {sum.xp.toLocaleString()} XP
                        </CalculatedValue>{' '}
                        · {sum.fit}
                      </span>
                    </span>
                    <span className={styles.row}>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => dm.update((d) => openEncounter(d, campaign.id, e.id))}
                        aria-label={`Open encounter ${e.name}`}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => {
                          const now = clockNow();
                          dm.update((d) => saveEncounter(d, campaign.id, duplicateEncounter(e, () => crypto.randomUUID(), now), now));
                        }}
                        aria-label={`Duplicate encounter ${e.name}`}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className={styles.btnDanger}
                        onClick={() => setDeleting(e)}
                        aria-label={`Delete encounter ${e.name}`}
                      >
                        Delete
                      </button>
                    </span>
                  </li>
                  );
                })}
              </ul>
            )}
            <form
              className={styles.row}
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
            >
              <label className={styles.field}>
                <span className={styles.fieldLabel}>New encounter name</span>
                <input
                  className={styles.input}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={80}
                  placeholder="For example: Goblin ambush"
                />
              </label>
              <button type="submit" className={styles.btnPrimary} style={{ alignSelf: 'flex-end' }}>
                Create encounter
              </button>
            </form>
          </div>
        </Card>
        {deleting && (
          <ConfirmDialog
            title="Delete encounter"
            message={`Delete "${deleting.name}"? This cannot be undone.`}
            confirmLabel="Delete"
            onCancel={() => setDeleting(null)}
            onConfirm={() => {
              const id = deleting.id;
              const now = Date.now();
              dm.update((d) => deleteEncounter(d, campaign.id, id, now));
              setDeleting(null);
            }}
          />
        )}
      </div>
    );
  }

  const setup = open.status === 'setup';
  const running = open.status === 'running';
  const ended = open.status === 'ended';
  const presentMemberIds = open.combatants.flatMap((c) => (c.memberId ? [c.memberId] : []));
  const activeName = running ? open.combatants.find((c) => c.id === open.activeId)?.name : undefined;

  const addWholeParty = () => {
    const made = campaign.party
      .filter((m) => !presentMemberIds.includes(m.id))
      .flatMap((m) => {
        const c = combatantFromMember(m, crypto.randomUUID());
        return c ? [c] : [];
      });
    if (made.length === 0) {
      onNotify('Everyone in the party is already in this encounter.');
      return;
    }
    commit(addCombatants(open, made));
  };

  const start = () => {
    const result = startEncounter(open);
    if (!result.ok) {
      setStartError(result.error);
      return;
    }
    setStartError(null);
    commit(result.encounter);
  };

  // Budget for the characters in this fight, or the whole party until some are added.
  const levelOf = (memberId: string) => {
    const m = campaign.party.find((p) => p.id === memberId);
    return m ? memberStats(m) : undefined;
  };
  const inFight: BudgetMember[] = open.combatants.flatMap((c) => {
    const s = c.kind === 'pc' && c.memberId ? levelOf(c.memberId) : undefined;
    return s ? [{ name: c.name, level: s.level }] : [];
  });
  const wholeParty: BudgetMember[] = campaign.party.flatMap((m) => {
    const s = memberStats(m);
    return s ? [{ name: m.name, level: s.level }] : [];
  });
  const budgetMembers = inFight.length > 0 ? inFight : wholeParty;

  const survivors = open.combatants.filter((c) => !isOut(c));
  const defeated = open.combatants.filter((c) => isOut(c));
  const pcs = open.combatants.filter((c) => c.kind === 'pc');

  // Stat block drawer: which combatant it shows (see the follow-mode cases in the stat-block design).
  const sb = statBlock && statBlock.encounterId === open.id ? statBlock : null;
  const activeCombatant = open.combatants.find((c) => c.id === open.activeId);
  const followTarget = sb?.follow && running && activeCombatant && canShowStatBlock(activeCombatant) ? activeCombatant : undefined;
  const shownId = followTarget?.id ?? sb?.id;
  const shownFound = open.combatants.find((c) => c.id === shownId);
  const shown = shownFound && canShowStatBlock(shownFound) ? shownFound : undefined;
  // Adjust state while rendering (guarded, so it settles on the next pass).
  if (sb && followTarget && followTarget.id !== sb.id) setStatBlock({ ...sb, id: followTarget.id });
  if (sb && !sb.follow && !shown) setStatBlock(null);
  const drawerOpen = sb !== null && (sb.follow || shown !== undefined);
  const resolved = shown ? resolveCombatantStatBlock(shown, open, dm.data.customMonsters) : undefined;
  const customNote =
    resolved?.customStatus === 'changed'
      ? 'This monster was edited in the library after it was added. This is the version used in this fight.'
      : resolved?.customStatus === 'deleted'
        ? 'This monster was deleted from the library after it was added. This is the version used in this fight.'
        : undefined;
  const followNote = !sb?.follow
    ? undefined
    : !running || !activeCombatant
      ? 'No active turn'
      : !canShowStatBlock(activeCombatant)
        ? 'Active combatant has no stat block'
        : undefined;
  const drawerNote = [followNote, customNote].filter(Boolean).join(' ') || undefined;

  // Removing a combatant is undoable for a few seconds; the restore applies to the latest saved encounter.
  const removeWithUndo = (id: string) => {
    const index = open.combatants.findIndex((x) => x.id === id);
    const removed = open.combatants[index];
    if (!removed) return;
    const before = open;
    commit(removeCombatant(open, id));
    undoToast.show(`${removed.name} removed from the encounter`, removed, index, (item, at) => {
      dm.update((d) => {
        const current = d.campaigns.find((x) => x.id === campaign.id)?.encounters.find((x) => x.id === before.id);
        return current ? saveEncounter(d, campaign.id, restoreCombatant(current, item as DmCombatant, at, before), Date.now()) : d;
      });
    });
  };

  const updateParty = () => {
    const now = clockNow();
    dm.update((d) => markAfterCombat(applyEncounterHpToParty(d, campaign.id, open, now), campaign.id, open.id, { partyUpdated: true }, now));
    onNotify('Party cards updated with the end-of-fight Hit Points.');
  };

  const renderCard = (c: DmCombatant) => (
    <CombatantCard
      key={c.id}
      encounter={open}
      combatant={c}
      isActive={running && c.id === open.activeId}
      onCommit={commit}
      onNotify={onNotify}
      onRemove={removeWithUndo}
      hasStatBlock={canShowStatBlock(c)}
      statBlockOpen={drawerOpen && c.id === shown?.id}
      onToggleStatBlock={() =>
        setStatBlock(drawerOpen && c.id === shown?.id ? null : { encounterId: open.id, id: c.id, follow: sb?.follow ?? running })
      }
    />
  );

  return (
    <div className={`${styles.page} ${drawerOpen ? `${enc.withDrawer} ${enc.withSheet}` : ''}`}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{open.name}</h1>
          <div className={styles.muted}>
            {campaign.name} · {STATUS_LABEL[open.status]}
          </div>
        </div>
        <button type="button" className={styles.btn} onClick={() => dm.update((d) => openEncounter(d, campaign.id, null))}>
          All encounters
        </button>
      </div>

      {!ended && (
      <div className={running ? `${enc.toolbar} ${enc.toolbarSticky}` : enc.toolbar} data-testid="encounter-toolbar">
        {running && (
          <>
            <button type="button" className={styles.btn} onClick={() => setAdding(true)}>
              Add combatants
            </button>
          </>
        )}
        {setup && (
          <>
            <div className={enc.cluster} role="group" aria-label="Add">
              <span className={enc.clusterTitle}>Add</span>
              <div className={enc.clusterButtons}>
                <button type="button" className={styles.btn} onClick={() => setAdding(true)}>
                  Add combatants
                </button>
                <button type="button" className={styles.btn} onClick={addWholeParty}>
                  Add whole party
                </button>
              </div>
              <span className={styles.muted}>Pick monsters and characters one at a time, or bring in every party member at once.</span>
            </div>
            <div className={enc.cluster} role="group" aria-label="Initiative">
              <span className={enc.clusterTitle}>Initiative</span>
              <div className={enc.clusterButtons}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => commit(rollInitiatives(open, createDefaultRng(), { monstersOnly: true }))}
                >
                  Roll Initiative for monsters
                </button>
                <button type="button" className={styles.btn} onClick={() => commit(rollInitiatives(open, createDefaultRng()))}>
                  Roll everyone missing
                </button>
              </div>
              <span className={styles.muted}>
                Players roll their own Initiative: type it in. The DM rolls for monsters, and a group of identical creatures
                shares one roll. A surprised combatant rolls with Disadvantage. Ties are yours to break: move a combatant up or
                down.
              </span>
            </div>
            <span className={enc.spacer} />
            <button type="button" className={styles.btnPrimary} onClick={start}>
              Start combat
            </button>
          </>
        )}
        {running && (
          <>
            <span className={enc.roundBadge} aria-live="polite">
              Round {open.round}
            </span>
            {activeName && (
              <span className={enc.roundBadge} data-testid="active-turn" aria-live="polite">
                Turn: {activeName}
              </span>
            )}
            <button type="button" className={styles.btn} onClick={() => commit(previousTurn(open))}>
              Previous turn
            </button>
            <button type="button" className={styles.btnPrimary} onClick={() => commit(nextTurn(open))}>
              Next turn
            </button>
            <button type="button" className={styles.btn} onClick={() => commit(sortByInitiative(open))}>
              Sort by Initiative
            </button>
            {combatantsMissingInitiative(open).length > 0 && (
              <button type="button" className={styles.btn} onClick={() => commit(sortByInitiative(rollInitiatives(open, createDefaultRng())))}>
                Roll Initiative for new combatants
              </button>
            )}
            <span className={enc.spacer} />
            <button type="button" className={styles.btnDanger} onClick={() => setConfirmEnd(true)}>
              End combat
            </button>
          </>
        )}
      </div>
      )}

      {startError && (
        <p className={styles.error} role="alert">
          {startError}
        </p>
      )}

      {ended && (
        <XpAwardCard
          encounter={open}
          // The Party XP page awards every party member and rejects a smaller count, so start from the same number.
          defaultSharers={Math.max(1, campaign.party.length)}
          onCommit={commit}
          onOpenPartyXp={(sharers) => onOpenPartyXp(open.id, sharers)}
        />
      )}

      {ended && (
        <Card>
          <div className={styles.stack}>
            <strong>
              Combat finished after {Math.max(1, open.round)} {open.round === 1 ? 'round' : 'rounds'}.
            </strong>
            <span className={styles.muted}>
              Still standing: {survivors.length === 0 ? 'nobody' : survivors.map((c) => c.name).join(', ')}.
              {defeated.length > 0 && ` Down for good: ${defeated.map((c) => c.name).join(', ')}.`}
            </span>
            <div className={styles.row} data-testid="after-combat">
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  const src = encounterTreasureSource(open);
                  if (src.groups.length === 0) {
                    onNotify(
                      src.skipped > 0
                        ? 'The creatures counted for XP have no CR. Roll treasure on the Treasure page.'
                        : 'No creatures are counted as overcome. Tick them under "XP for this fight" above first.',
                    );
                    return;
                  }
                  onOpenTreasure(src.groups, open.id);
                }}
              >
                Roll treasure for this encounter
              </button>
              {open.treasureRolled && <span className={styles.chip} data-testid="done-treasure">Done: treasure rolled</span>}
              <button
                type="button"
                className={styles.btn}
                disabled={open.summaryAdded === true}
                onClick={() => {
                  if (open.summaryAdded) return;
                  const now = clockNow();
                  // The session note gets the outcome and the last lines of the log; the full log stays on the encounter.
                  const result = appendToLatestSession(
                    dm.data,
                    campaign.id,
                    combatSummaryText(open, { maxLogLines: SUMMARY_LOG_LINES }),
                    crypto.randomUUID(),
                    now,
                  );
                  dm.replace(
                    markAfterCombat(result.data, campaign.id, open.id, { summaryAdded: true, summaryNoteId: result.noteId, summaryNoteTitle: result.title }, now),
                  );
                  onNotify(`Combat summary ${result.created ? 'saved in the new' : 'added to'} session note "${result.title}".`);
                }}
              >
                {open.summaryAdded ? `Added to ${open.summaryNoteTitle ?? 'the session note'}` : 'Add combat summary to the session note'}
              </button>
              {open.summaryAdded && <span className={styles.chip} data-testid="done-summary">Done: summary added</span>}
              {open.summaryAdded && (
                <button type="button" className={styles.btn} onClick={() => onOpenJournal(open.summaryNoteId)}>
                  Open journal
                </button>
              )}
              <span className={styles.muted}>The combat log is lost if you delete this encounter.</span>
            </div>
            {pcs.length > 0 && (
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => (open.partyUpdated ? setConfirmParty(true) : updateParty())}
                >
                  {open.partyUpdated ? 'Update party cards again' : 'Update party cards with these Hit Points'}
                </button>
                {open.partyUpdated && <span className={styles.chip} data-testid="done-party">Done: party cards updated</span>}
                <span className={styles.muted}>Players keep their own numbers on their sheets.</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {!ended && !running && <EncounterBalance members={budgetMembers} combatants={open.combatants} />}

      {open.combatants.length === 0 ? (
        <Card>
          <p className={styles.muted}>No combatants yet. Use Add combatants, or Add whole party.</p>
        </Card>
      ) : (
        <div className={enc.cards}>{open.combatants.map(renderCard)}</div>
      )}

      {open.log.length > 0 && (
        <Card>
          <details>
            <summary>Combat log</summary>
            <ul className={enc.log} aria-label="Combat log">
              {[...open.log].reverse().map((line, i) => (
                <li key={`${open.log.length - i}-${line}`}>{line}</li>
              ))}
            </ul>
          </details>
        </Card>
      )}

      {drawerOpen && sb && (
        <StatBlockDrawer
          key={shown?.id ?? 'none'}
          hp={
            shown && running && !isOut(shown)
              ? {
                  // The same logic as the combatant card's Damage and Heal buttons.
                  onDamage: (amount) => {
                    const outcome = dealDamage(open, shown.id, { amount, resistance: false, vulnerability: false, immune: false, crit: false });
                    if (outcome) commit(outcome.encounter);
                  },
                  onHeal: (amount) => commit(healCombatant(open, shown.id, amount)),
                }
              : undefined
          }
          title={shown ? shown.name : 'Stat block'}
          subtitle={shown && resolved && resolved.monster.name !== shown.name ? resolved.monster.name : undefined}
          vitals={shown ? `AC ${shown.ac}, HP ${shown.hp.hp}/${shown.hp.max}` : undefined}
          note={drawerNote}
          monster={resolved?.monster}
          empty={
            shown
              ? 'No stat block is linked to this combatant. Combatants added before stat blocks were shown in combat, and custom monsters that no longer exist, cannot be matched.'
              : 'Waiting for a combatant with a stat block'
          }
          follow={{ value: sb.follow, onChange: (value) => setStatBlock({ ...sb, follow: value }) }}
          onNextTurn={running ? () => commit(nextTurn(open)) : undefined}
          onClose={() => setStatBlock(null)}
        />
      )}

      {adding && (
        <AddCombatantsDialog
          party={campaign.party}
          customMonsters={dm.data.customMonsters}
          presentMemberIds={presentMemberIds}
          onAdd={(list, keepOpen) => {
            commit(addCombatants(open, list, dm.data.customMonsters));
            if (!keepOpen) setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}

      <Toast
        message={undoToast.pending?.message ?? null}
        duration={5000}
        action={undoToast.pending ? { label: 'Undo', onAction: undoToast.undo } : undefined}
      />

      {confirmParty && (
        <ConfirmDialog
          title="Update party cards again"
          message="The party cards were already updated with this fight's Hit Points. Copy them again?"
          confirmLabel="Update again"
          onCancel={() => setConfirmParty(false)}
          onConfirm={() => {
            updateParty();
            setConfirmParty(false);
          }}
        />
      )}

      {confirmEnd && (
        <ConfirmDialog
          title="End combat"
          message="End this combat? You can still read it afterwards, but it cannot be restarted."
          confirmLabel="End combat"
          onCancel={() => setConfirmEnd(false)}
          onConfirm={() => {
            commit(endEncounter(open, Date.now()));
            setConfirmEnd(false);
          }}
        />
      )}
    </div>
  );
}
