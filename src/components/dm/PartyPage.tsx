import { useMemo, useState } from 'react';
import { Users, UserPlus } from 'lucide-react';
import type { Character } from '../../types/character';
import type { DmManualStats, DmPartyMember } from '../../types/dm';
import type { DmApi } from './dmApi';
import {
  activeCampaign,
  addImportedMember,
  addManualMember,
  memberStats,
  partySummary,
  removeMember,
  updateManualMember,
} from '../../logic/dm-campaign';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { AddMemberDialog, type AddMemberMode } from './AddMemberDialog';
import { PartyMemberCard } from './PartyMemberCard';
import styles from './dm.module.css';

interface PartyPageProps {
  dm: DmApi;
  onNotify: (text: string) => void;
  onOpenCampaign: () => void;
}

type DialogState =
  | { kind: 'add'; mode: AddMemberMode }
  | { kind: 'refresh'; memberId: string }
  | { kind: 'edit'; memberId: string }
  | null;

function listOrNone(items: string[]): string {
  return items.length === 0 ? 'None' : items.join(', ');
}

/** The party at a glance: summary row plus one card per member. */
export function PartyPage({ dm, onNotify, onOpenCampaign }: PartyPageProps) {
  const campaign = activeCampaign(dm.data);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [removing, setRemoving] = useState<DmPartyMember | null>(null);

  const rows = useMemo(
    () =>
      (campaign?.party ?? []).flatMap((member) => {
        const stats = memberStats(member);
        return stats ? [{ member, stats }] : [];
      }),
    [campaign],
  );
  const summary = useMemo(() => partySummary(rows.map((r) => r.stats)), [rows]);

  if (!campaign) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Party</h1>
        <Card>
          <div className={styles.stack}>
            <p className={styles.muted}>Create a campaign first. The party belongs to a campaign.</p>
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

  const editing = dialog?.kind === 'edit' ? campaign.party.find((m) => m.id === dialog.memberId) : undefined;
  const hidden = campaign.party.length - rows.length;

  const handleImport = (character: Character) => {
    const replaceMemberId = dialog?.kind === 'refresh' ? dialog.memberId : undefined;
    // Computed from the current document (not inside an updater) so the
    // message can say whether the member was added or refreshed.
    const result = addImportedMember(dm.data, campaign.id, {
      id: crypto.randomUUID(),
      character,
      now: Date.now(),
      replaceMemberId,
    });
    dm.replace(result.data);
    onNotify(`${character.name.trim() || 'Character'} ${result.outcome === 'added' ? 'added to' : 'updated in'} the party.`);
    setDialog(null);
  };

  const handleManual = (name: string, stats: DmManualStats) => {
    if (dialog?.kind === 'edit') {
      const memberId = dialog.memberId;
      dm.update((d) => updateManualMember(d, campaign.id, memberId, { name, stats, now: Date.now() }));
      onNotify(`${name.trim() || 'Member'} saved.`);
    } else {
      dm.update((d) => addManualMember(d, campaign.id, { id: crypto.randomUUID(), name, stats, now: Date.now() }));
      onNotify(`${name.trim() || 'Member'} added to the party.`);
    }
    setDialog(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Party</h1>
          <div className={styles.muted}>{campaign.name}</div>
        </div>
        <button type="button" className={styles.btnPrimary} onClick={() => setDialog({ kind: 'add', mode: 'import' })}>
          <UserPlus size={16} aria-hidden="true" /> Add member
        </button>
      </div>

      {rows.length > 0 && (
        <Card>
          <SectionHeader icon={Users} title="Party at a glance" />
          <div className={styles.summaryGrid}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Members</span>
              <span className={styles.statValue}>{summary.size}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Average level</span>
              <span className={styles.statValue}>
                <CalculatedValue label="Total party levels" breakdown={summary.levels}>
                  {summary.averageLevel}
                </CalculatedValue>
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>No Darkvision</span>
              <span>{listOrNone(summary.withoutDarkvision)}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Languages everyone knows</span>
              <span>{listOrNone(summary.sharedLanguages)}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Languages anyone knows</span>
              <span>{listOrNone(summary.allLanguages)}</span>
            </div>
          </div>
        </Card>
      )}

      {hidden > 0 && (
        <p className={styles.error} role="alert">
          {hidden} saved {hidden === 1 ? 'member' : 'members'} could not be read and {hidden === 1 ? 'is' : 'are'} not shown.
        </p>
      )}

      {rows.length === 0 ? (
        <Card>
          <p className={styles.muted}>
            No party members yet. Add a player from the share link they send you, or enter their numbers by hand.
          </p>
        </Card>
      ) : (
        <div className={styles.memberGrid}>
          {rows.map(({ member, stats }) => (
            <PartyMemberCard
              key={member.id}
              member={member}
              stats={stats}
              onUpdate={() => setDialog({ kind: 'refresh', memberId: member.id })}
              onEdit={() => setDialog({ kind: 'edit', memberId: member.id })}
              onRemove={() => setRemoving(member)}
            />
          ))}
        </div>
      )}

      {dialog && (dialog.kind === 'add' || dialog.kind === 'refresh' || (dialog.kind === 'edit' && editing?.manual)) && (
        <AddMemberDialog
          initialMode={dialog.kind === 'add' ? dialog.mode : dialog.kind === 'refresh' ? 'import' : 'manual'}
          lockedTo={dialog.kind === 'refresh' ? 'import' : dialog.kind === 'edit' ? 'manual' : undefined}
          initialManual={editing?.manual ? { name: editing.name, stats: editing.manual } : undefined}
          onImport={handleImport}
          onSaveManual={handleManual}
          onClose={() => setDialog(null)}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Remove party member"
          message={`Remove ${removing.name} from ${campaign.name}? A player's own character is not affected.`}
          confirmLabel="Remove"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const id = removing.id;
            dm.update((d) => removeMember(d, campaign.id, id, Date.now()));
            setRemoving(null);
          }}
        />
      )}
    </div>
  );
}
