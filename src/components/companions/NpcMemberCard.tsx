import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { NpcPartyMemberRecord } from '../../types/character';
import { npcChallengeRatingCheck } from '../../logic/companions';
import type { RNG } from '../../logic/random';
import { trackedHpOf } from '../../logic/companions-actions';
import { resolveCompanionRuleTooltip } from '../../logic/tooltip-content';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import { BlurInput } from './BlurInput';
import { CustomStatBlockEditor } from './CustomStatBlockEditor';
import { LoyaltyControl } from './LoyaltyControl';
import { TrackedVitals } from './TrackedVitals';
import styles from './CompanionsShared.module.css';

export interface NpcMemberCardProps {
  record: NpcPartyMemberRecord;
  /** The character's level: the party level for the Challenge Rating guideline. */
  partyLevel: number;
  /** Present only while the Loyalty house rule is on. */
  loyalty: { max: number } | null;
  onPatch: (id: string, patch: Partial<NpcPartyMemberRecord>) => void;
  onDelete: (id: string) => void;
  rng?: RNG;
}

/**
 * One NPC party member (DMG 2024 L833, L3553-3557). Same shape as the hireling
 * card: collapsed two-line header, expandable body with an editable stat block
 * (nothing pre-filled; Monster Manual templates are a later extension). The
 * Challenge Rating guideline (no higher than half the characters' level) is a
 * warning only and never blocks.
 */
export function NpcMemberCard({ record, partyLevel, loyalty, onPatch, onDelete, rng }: NpcMemberCardProps) {
  const [expanded, setExpanded] = useState(false);
  const patch = (p: Partial<NpcPartyMemberRecord>) => onPatch(record.id, p);
  const crCheck = npcChallengeRatingCheck(record.stats?.cr, partyLevel);
  const hpMax = record.stats?.hpMax !== undefined && record.stats.hpMax > 0 ? record.stats.hpMax : null;
  const bodyId = `npc-body-${record.id}`;

  return (
    <div className={styles.card} data-testid={`npc-${record.id}`}>
      <button type="button" className={styles.header} aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded((v) => !v)}>
        <span className={styles.nameLine}>{record.name}</span>
        <span className={styles.metaLine}>
          {record.role && <span className={styles.badge}>{record.role}</span>}
          {record.stats?.cr && <span className={styles.chip}>{`CR ${record.stats.cr}`}</span>}
          {crCheck.status === 'exceeds' && <span className={styles.badgeWarn}>CR above half level</span>}
          {hpMax !== null && <span className={styles.chip}>{`HP ${trackedHpOf(record, hpMax)}/${hpMax}`}</span>}
          <ChevronDown size={16} aria-hidden="true" className={expanded ? styles.chevronOpen : styles.chevron} />
        </span>
      </button>

      {expanded && (
        <div className={styles.body} id={bodyId}>
          <div className={styles.row}>
            <label className={styles.field}>
              Name
              <BlurInput className={styles.control} value={record.name} maxLength={80} ariaLabel={`NPC ${record.name} name`} onCommit={(v) => typeof v === 'string' && patch({ name: v })} />
            </label>
            <label className={styles.field}>
              Role
              <BlurInput className={styles.control} value={record.role} maxLength={80} ariaLabel={`${record.name} role`} placeholder="Healer, scout..." onCommit={(v) => patch({ role: typeof v === 'string' ? v : undefined })} />
            </label>
            <MaybeContentTooltip content={resolveCompanionRuleTooltip('npc-party-cr')} className={styles.chip} ariaLabel="About NPC party members">
              NPC party rules
            </MaybeContentTooltip>
          </div>

          {crCheck.status === 'exceeds' && (
            <p className={styles.warning} role="status">
              {crCheck.message}
            </p>
          )}

          <TrackedVitals record={record} max={hpMax} subject={record.name} zeroHpRule="monster-death" onPatch={(p) => patch(p)} />

          {loyalty && <LoyaltyControl score={record.loyalty} max={loyalty.max} subject={record.name} onChange={(s) => patch({ loyalty: s })} rng={rng} />}

          <CustomStatBlockEditor subject={record.name} stats={record.stats} onChange={(stats) => patch({ stats })} />

          <label className={styles.field}>
            Notes
            <textarea
              className={styles.textarea}
              value={record.notes ?? ''}
              maxLength={2000}
              placeholder="Notes..."
              aria-label={`${record.name} notes`}
              onChange={(e) => patch({ notes: e.target.value || undefined })}
            />
          </label>

          <div className={styles.footer}>
            <button type="button" className={styles.deleteBtn} onClick={() => onDelete(record.id)}>
              <Trash2 size={14} aria-hidden="true" /> {`Remove ${record.name}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
