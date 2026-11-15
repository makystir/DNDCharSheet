import type { MemberStats } from '../../logic/dm-campaign';
import type { Breakdown } from '../../logic/breakdown';
import type { DmPartyMember } from '../../types/dm';
import { Card } from '../shared/Card';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './dm.module.css';

interface PartyMemberCardProps {
  member: DmPartyMember;
  stats: MemberStats;
  onUpdate: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

function Stat({ label, breakdown, suffix = '' }: { label: string; breakdown: Breakdown; suffix?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>
        <CalculatedValue label={label} breakdown={breakdown}>
          {breakdown.total}
          {suffix}
        </CalculatedValue>
      </span>
    </div>
  );
}

function formatWhen(ms: number): string {
  return ms > 0 ? new Date(ms).toLocaleDateString() : 'unknown';
}

/** One party member's table-side numbers. */
export function PartyMemberCard({ member, stats, onUpdate, onEdit, onRemove }: PartyMemberCardProps) {
  const hp = stats.hp;
  return (
    <Card>
      <div className={styles.memberCard} data-testid="party-member-card">
        <div>
          <h3 className={styles.memberName}>{stats.name}</h3>
          <div className={styles.muted}>{stats.identity}</div>
          <div className={styles.muted}>
            {member.source === 'imported' ? 'Shared character' : 'Entered by hand'} · updated {formatWhen(member.updatedAt)}
          </div>
        </div>

        <div className={styles.statGrid}>
          <Stat label="Armor Class" breakdown={stats.ac} />
          {hp ? (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Hit Points</span>
              <span className={styles.statValue}>
                {hp.current}
                {' / '}
                <CalculatedValue label="Hit Point maximum" breakdown={hp.max} />
                {hp.temp > 0 && <span className={styles.muted}> +{hp.temp} temp</span>}
              </span>
            </div>
          ) : (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Hit Points</span>
              <span className={styles.muted}>Not set yet</span>
            </div>
          )}
          <Stat label="Speed" breakdown={stats.speed} suffix=" ft" />
          <Stat label="Passive Perception" breakdown={stats.passivePerception} />
          <Stat label="Passive Insight" breakdown={stats.passiveInsight} />
          <Stat label="Passive Investigation" breakdown={stats.passiveInvestigation} />
          {stats.spellSaveDc && <Stat label="Spell Save DC" breakdown={stats.spellSaveDc} />}
          <div className={styles.stat}>
            <span className={styles.statLabel}>Darkvision</span>
            <span className={styles.statValue}>
              {stats.darkvision.total > 0 ? (
                <CalculatedValue label="Darkvision" breakdown={stats.darkvision}>
                  {stats.darkvision.total} ft
                </CalculatedValue>
              ) : (
                <span className={styles.muted}>None</span>
              )}
            </span>
          </div>
        </div>

        <div>
          <div className={styles.statLabel}>Conditions</div>
          {stats.conditions.length === 0 ? (
            <span className={styles.muted}>None</span>
          ) : (
            <div className={styles.chips}>
              {stats.conditions.map((c) => (
                <span key={c} className={styles.chipWarn}>
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className={styles.statLabel}>Languages</div>
          {stats.languages.length === 0 ? (
            <span className={styles.muted}>None listed</span>
          ) : (
            <div className={styles.chips}>
              {stats.languages.map((l) => (
                <span key={l} className={styles.chip}>
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={styles.row}>
          {member.source === 'imported' ? (
            <button type="button" className={styles.btn} onClick={onUpdate}>
              Update from link
            </button>
          ) : (
            <button type="button" className={styles.btn} onClick={onEdit}>
              Edit
            </button>
          )}
          <button type="button" className={styles.btnDanger} onClick={onRemove} aria-label={`Remove ${stats.name} from the party`}>
            Remove
          </button>
        </div>
      </div>
    </Card>
  );
}
