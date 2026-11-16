import { Trophy } from 'lucide-react';
import type { Character } from '../../../types/character';
import type { DmPartyMember } from '../../../types/dm';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { CalculatedValue } from '../../shared/CalculatedValue';
import { characterXp, levelingMode, xpForLevel } from '../../../logic/advancement';
import { clampLevel } from '../../../logic/abilities';
import { awardBlocker, MAX_AWARD_XP, previewAward, type AwardPayload } from '../../../logic/dm-awards';
import { OUTCOME_TEXT, useAwardRedeem } from '../useAwardRedeem';
import styles from '../AdvancementPage.module.css';

export interface AwardRedeemCardProps {
  character: Character;
  onChange: (next: Character) => void;
  now?: () => number;
}

const n = (v: number) => v.toLocaleString();

/** Notes shown above the preview, in reading order. */
function previewNotes(character: Character, award: AwardPayload, newXp: number): string[] {
  const notes: string[] = [];
  const level = clampLevel(character.level);
  if (award.kind === 'xp') {
    notes.push('Leveling up is still done on the Advancement page.');
    if (levelingMode(character) !== 'xp' && level === 1) notes.push('Applying XP switches this sheet to XP leveling.');
    if (levelingMode(character) === 'xp' && characterXp(character) < xpForLevel(level)) {
      notes.push(
        `Your recorded XP (${n(characterXp(character))}) is below the level ${level} threshold (${n(xpForLevel(level))}). Enter your current XP on the Advancement page first.`,
      );
    }
    if (newXp > MAX_AWARD_XP) {
      notes.push(
        `XP above ${n(MAX_AWARD_XP)} stays on the sheet, does not raise your level past 20, and counts toward the optional bonus-feat rule.`,
      );
    }
  } else {
    notes.push('Applying this sets your level directly.');
    if (levelingMode(character) === 'xp') {
      notes.push('Your XP is unchanged; later level-ups still need the XP threshold.');
    }
    notes.push('HP for the new levels uses the fixed value until you choose on the Advancement page.');
  }
  return notes;
}

/** Paste a DM's award code, preview it, and apply it (Stage 8). */
export function AwardRedeemCard({ character, onChange, now = Date.now }: AwardRedeemCardProps) {
  const redeem = useAwardRedeem(character, onChange, now);
  const { award } = redeem;

  let body = null;
  if (award) {
    const me: DmPartyMember = { id: 'me', name: character.name || 'You', source: 'imported', character, addedAt: 0, updatedAt: 0 };
    const preview = previewAward(me, award);
    const already = character.advancement?.appliedAwards?.includes(award.id) ?? false;
    const blocker = already ? null : awardBlocker(character, award);
    const blocked = blocker === 'milestone-blocked' || blocker === 'multiclass-unsupported' ? blocker : null;
    const disabled = already || blocked !== null;
    body = (
      <div className={styles.placeholder} data-testid="award-preview">
        <p style={{ margin: 0 }}>
          <strong>{award.label || 'DM award'}</strong>:{' '}
          {award.kind === 'xp' ? `${n(award.amount)} XP` : `reach level ${award.amount}`}
        </p>
        {already && <p role="status">{OUTCOME_TEXT['already-applied']}</p>}
        {blocked && (
          <p role="alert">
            {OUTCOME_TEXT[blocked]}
          </p>
        )}
        {!already && !blocked && preview.newXp && preview.reachableLevel && (
          <>
            <ul>
              {previewNotes(character, award, preview.newXp.total).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p style={{ margin: 0 }}>
              Current level {preview.currentLevel}, current XP {n(characterXp(character))}.
            </p>
            <p style={{ margin: 0 }}>
              New XP:{' '}
              <CalculatedValue label="New XP" breakdown={preview.newXp}>
                {n(preview.newXp.total)}
              </CalculatedValue>
            </p>
            <p style={{ margin: 0 }}>
              Level you can reach:{' '}
              <CalculatedValue label="Level you can reach" breakdown={preview.reachableLevel}>
                {preview.reachableLevel.total}
              </CalculatedValue>
            </p>
            {preview.unchanged && <p>Your level is already at or above this level, so nothing will change.</p>}
          </>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={redeem.apply} disabled={disabled} aria-disabled={disabled}>
            Apply
          </button>
          <button type="button" onClick={redeem.cancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <SectionHeader icon={Trophy} title="DM award code" />
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="award-code-input">
          Paste an award code
        </label>
        <textarea
          id="award-code-input"
          rows={2}
          value={redeem.text}
          onChange={(e) => redeem.setText(e.target.value)}
          placeholder="AWARD-..."
          style={{ width: '100%' }}
        />
        <div>
          <button type="button" onClick={() => void redeem.check()}>
            Check
          </button>
        </div>
      </div>
      {redeem.error && (
        <p role="alert" style={{ margin: '8px 0 0' }}>
          {redeem.error}
        </p>
      )}
      {redeem.result && <p role="status">{redeem.result}</p>}
      {body}
    </Card>
  );
}
