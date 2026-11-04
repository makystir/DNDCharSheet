import { Map as MapIcon } from 'lucide-react';
import type { Character } from '../../../types/character';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { ContentTooltip } from '../../shared/ContentTooltip';
import { formatSigned } from '../../../logic/breakdown';
import { nextLevelPreview } from '../../../logic/advancement';
import { upcomingMilestones } from '../../../logic/advancement-planner';
import styles from './AdvancementPlanner.module.css';

export interface AdvancementPlannerProps {
  character: Character;
}

/**
 * The Advancement Planner panel (Stage A6c). READ-ONLY: it shows the upcoming
 * structural milestones from the class feature table — the next feat/ASI slot
 * level, the remaining asi-marker levels ahead, and whether the subclass choice
 * is still ahead — plus the A6a next-level preview (features gained, PB change,
 * feat slot opens, subclass choice) for the immediate next level.
 *
 * Mirrors the WFRP source app's advancement-planner UX (a read-only "what is
 * ahead" projection on the advancement surface). No rule is computed here: the
 * milestones come from logic/advancement-planner.ts (reading the class feature
 * table) and the preview from logic/advancement.ts. Named rules content uses a
 * ContentTooltip (content-tooltips steering).
 */
export function AdvancementPlanner({ character }: AdvancementPlannerProps) {
  const milestones = upcomingMilestones(character);
  const preview = nextLevelPreview(character);

  const nothingAhead =
    preview === null &&
    milestones.featSlotLevelsAhead.length === 0 &&
    !milestones.subclassAhead;

  return (
    <Card>
      <SectionHeader icon={MapIcon} title="Advancement Planner" />

      {nothingAhead ? (
        <p className={styles.note}>At the level cap (20). Nothing further to plan.</p>
      ) : (
        <>
          {/* ── Immediate next level (A6a nextLevelPreview). ──────────────── */}
          {preview !== null && (
            <div className={styles.block}>
              <p className={styles.blockHeading}>Next level ({preview.nextLevel}) at a glance</p>
              <ul className={styles.list}>
                {preview.proficiencyBonusChangesTo !== undefined && (
                  <li>
                    <ContentTooltip
                      content={{
                        title: 'Proficiency Bonus increase',
                        sections: [
                          {
                            // PHB 2024 "Character Advancement" table:
                            // PB = 2 + floor((level − 1) ÷ 4).
                            label: 'Formula',
                            text: `Proficiency Bonus = 2 + floor((level − 1) ÷ 4): at level ${preview.nextLevel} it becomes ${formatSigned(preview.proficiencyBonusChangesTo)} (PHB 2024 "Character Advancement").`,
                          },
                        ],
                      }}
                    >
                      Proficiency Bonus will be {formatSigned(preview.proficiencyBonusChangesTo)}
                    </ContentTooltip>
                  </li>
                )}
                {preview.subclassChoice && <li>Subclass selection unlocks</li>}
                {preview.featSlotOpens && (
                  <li>
                    <ContentTooltip
                      content={{
                        title: 'Feat slot',
                        sections: [
                          {
                            label: 'Rule',
                            text: 'This level opens an Ability Score Improvement slot (level 19 is an Epic Boon); take a feat after leveling up (PHB 2024 "Ability Score Improvement").',
                          },
                        ],
                      }}
                    >
                      Feat / ASI slot unlocks
                    </ContentTooltip>
                  </li>
                )}
                {preview.features.map((f) => (
                  <li key={f}>Feature: {f}</li>
                ))}
                {preview.features.length === 0 &&
                  !preview.subclassChoice &&
                  !preview.featSlotOpens &&
                  preview.proficiencyBonusChangesTo === undefined && <li>No new features</li>}
              </ul>
            </div>
          )}

          {/* ── Upcoming milestones (class feature table projection). ──────── */}
          <div className={styles.block}>
            <p className={styles.blockHeading}>Looking ahead</p>
            <ul className={styles.list}>
              <li>
                {milestones.nextFeatSlotLevel !== null ? (
                  <ContentTooltip
                    content={{
                      title: 'Next feat / ASI slot',
                      sections: [
                        {
                          label: 'Rule',
                          text: `Your next Ability Score Improvement slot opens at level ${milestones.nextFeatSlotLevel} (PHB 2024 "Ability Score Improvement").`,
                        },
                      ],
                    }}
                  >
                    Next feat slot: level {milestones.nextFeatSlotLevel}
                  </ContentTooltip>
                ) : (
                  'No further feat slots ahead'
                )}
              </li>
              {milestones.featSlotLevelsAhead.length > 0 && (
                <li>
                  Feat slots ahead: {milestones.featSlotLevelsAhead.join(', ')}
                </li>
              )}
              {milestones.subclassAhead && <li>Subclass choice still ahead (level 3)</li>}
            </ul>
          </div>
        </>
      )}
    </Card>
  );
}
