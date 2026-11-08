import { useState } from 'react';
import { Award, Trash2 } from 'lucide-react';
import type { Ability, Character, FeatSelection } from '../../../types/character';
import { ABILITIES, ABILITY_ABBR } from '../../../types/character';
import { getFeat, type FeatData } from '../../../data/feats';
import {
  applyFeat,
  removeFeat,
  featSlotAssignments,
  effectiveAbilityScores,
} from '../../../logic/feats';
import { featSlotLevels } from '../../../logic/advancement';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { ContentTooltip } from '../../shared/ContentTooltip';
import { resolveFeatTooltip } from '../../../logic/tooltip-content';
import { FeatPicker } from '../../shared/FeatPicker';
import { FeatAllocationDialog } from '../../shared/FeatAllocationDialog';
import styles from './FeatSlotsSection.module.css';

export interface FeatSlotsSectionProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Injected clock for the log timestamps (deterministic in tests). */
  now?: () => number;
}

/** "+2 Str, +1 Dex" from a FeatSelection's increases (empty = none). */
function increaseSummary(increases: Partial<Record<Ability, number>> | undefined): string {
  if (!increases) return '';
  const parts: string[] = [];
  for (const ability of ABILITIES) {
    const amount = increases[ability];
    if (amount !== undefined && Number.isFinite(amount) && amount !== 0) {
      parts.push(`+${amount} ${ABILITY_ABBR[ability]}`);
    }
  }
  return parts.join(', ');
}

/** Whether a feat needs skill / tool / Expertise picks before it can be applied. */
function featNeedsPicks(feat: FeatData): boolean {
  const g = feat.mechanics.grants;
  return (
    g.skills > 0 ||
    g.tools > 0 ||
    g.skillsOrTools > 0 ||
    g.expertise > 0 ||
    feat.mechanics.choices.some((c) => c.key === 'skill-proficiency-or-expertise')
  );
}

/**
 * The feat / Ability Score Improvement slots on the Advancement page (Stage
 * A6b). Each asi-marker slot level (from featSlotLevels — read from the class
 * data, never hard-coded) is a feat picker: an empty slot opens the FeatPicker
 * (canTakeFeat gates the list), and a feat with an ability increase or skill
 * grant opens the FeatAllocationDialog before it is applied. A filled slot shows
 * the feat (with a content tooltip) and its increases, and can be removed —
 * removing clears the slot and reverts the increase everywhere (effective
 * scores stop summing it).
 *
 * NO rule is computed here: slots come from featSlotLevels, pairing from
 * featSlotAssignments, apply/remove from applyFeat/removeFeat, and the detail
 * from resolveFeatTooltip. PHB 2024 "Gaining a Level" / "Ability Score
 * Improvement".
 */
export function FeatSlotsSection({ character, onChange, now = Date.now }: FeatSlotsSectionProps) {
  // Which slot level is currently picking a feat (the FeatPicker is open).
  const [pickingLevel, setPickingLevel] = useState<number | null>(null);
  // A feat chosen for a slot that still needs allocation (the dialog is open).
  const [allocating, setAllocating] = useState<{ level: number; featId: string } | null>(null);

  const slotLevels = featSlotLevels(character);
  const assignments = featSlotAssignments(character, slotLevels);
  const effectiveBefore = effectiveAbilityScores(character);

  if (slotLevels.length === 0) {
    return (
      <Card>
        <SectionHeader icon={Award} title="Feats & Ability Score Improvements" />
        <p className={styles.placeholder}>
          No feat slots yet. Feat slots open at the Ability Score Improvement levels (PHB 2024:
          4/8/12/16 and 19, plus Fighter 6/14 and Rogue 10).
        </p>
      </Card>
    );
  }

  // When a feat is picked: if it needs player allocation (ability increase or
  // skill grant), open the dialog; otherwise apply it immediately.
  const handlePicked = (level: number, featId: string) => {
    setPickingLevel(null);
    const feat = getFeat(featId);
    const inc = feat?.abilityIncrease;
    // A fixed increase (e.g. Actor +1 Cha) that is already at its cap would be
    // silently clamped by effectiveAbilityScores. Route it through the
    // allocation dialog in that case so the player sees the cap note (and can
    // cancel) before applying, matching the feedback the ASI/choose-one paths
    // give. PHB 2024 "Ability Score Improvement" cap (max 20).
    const fixedClamped =
      inc?.kind === 'fixed' && effectiveBefore[inc.ability] >= inc.max;
    const needsAllocation =
      feat !== undefined &&
      ((inc !== undefined && inc.kind !== 'fixed') ||
        fixedClamped ||
        featNeedsPicks(feat));
    if (needsAllocation) {
      setAllocating({ level, featId });
      return;
    }
    // Fixed increase under its cap, or no increase: build and apply now.
    const selection: FeatSelection = { featId, level };
    if (inc?.kind === 'fixed') {
      selection.abilityIncreases = { [inc.ability]: inc.amount };
    }
    onChange(applyFeat(character, selection, now()));
  };

  const handleAllocationConfirm = (selection: FeatSelection) => {
    setAllocating(null);
    onChange(applyFeat(character, selection, now()));
  };

  const handleRemove = (level: number, featId: string) => {
    onChange(removeFeat(character, level, now(), featId));
  };

  const allocatingFeat = allocating ? getFeat(allocating.featId) : undefined;

  return (
    <Card>
      <SectionHeader icon={Award} title="Feats & Ability Score Improvements" />
      <ul className={styles.slotList}>
        {assignments.map(({ level, filled }) => {
          const feat = filled ? getFeat(filled.featId) : undefined;
          const content = feat ? resolveFeatTooltip(feat.id) : null;
          const summary = filled ? increaseSummary(filled.abilityIncreases) : '';
          const skillNames = filled?.choices?.skills ?? [];
          const expertiseNames = filled?.choices?.expertise ?? [];
          const toolNames = filled?.choices?.tools ?? [];
          return (
            <li key={level} className={styles.slot}>
              <span className={styles.slotLevel}>
                {level > 20 ? `Bonus feat (XP) ${level - 20}` : `Level ${level}`}
              </span>
              {filled && feat ? (
                <div className={styles.filled}>
                  <span className={styles.featName}>
                    {content ? (
                      <ContentTooltip content={content}>{feat.name}</ContentTooltip>
                    ) : (
                      feat.name
                    )}
                  </span>
                  {summary && <span className={styles.summary}>{summary}</span>}
                  {skillNames.length > 0 && (
                    <span className={styles.summary}>Skills: {skillNames.join(', ')}</span>
                  )}
                  {expertiseNames.length > 0 && (
                    <span className={styles.summary}>Expertise: {expertiseNames.join(', ')}</span>
                  )}
                  {toolNames.length > 0 && (
                    <span className={styles.summary}>Tools: {toolNames.join(', ')}</span>
                  )}
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => handleRemove(level, feat.id)}
                    aria-label={`Remove ${feat.name} from level ${level}`}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.chooseBtn}
                  onClick={() => setPickingLevel(level)}
                >
                  Choose a feat…
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {pickingLevel !== null && (
        <FeatPicker
          character={character}
          slotLevel={pickingLevel}
          onSelect={(featId) => handlePicked(pickingLevel, featId)}
          onClose={() => setPickingLevel(null)}
        />
      )}

      {allocating !== null && allocatingFeat !== undefined && (
        <FeatAllocationDialog
          effectiveBefore={effectiveBefore}
          character={character}
          feat={allocatingFeat}
          slotLevel={allocating.level}
          onConfirm={handleAllocationConfirm}
          onCancel={() => setAllocating(null)}
        />
      )}
    </Card>
  );
}
