import { useState } from 'react';
import { TrendingUp, Heart, ArrowUpCircle, ListChecks, ScrollText, Trash2 } from 'lucide-react';
import type { Character } from '../../types/character';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { SegmentedControl } from '../shared/SegmentedControl';
import { HpRollDialog } from '../shared/HpRollDialog';
import { formatSigned } from '../../logic/breakdown';
import {
  abilityModifier,
  clampLevel,
  proficiencyBonusBreakdown,
  MAX_LEVEL,
} from '../../logic/abilities';
import { resolveClass, resolveSubclass } from '../../logic/classes';
import { effectiveAbilityScores } from '../../logic/feats';
import {
  advancementLog,
  applyLevelUp,
  canLevelUp,
  characterXp,
  featSlotLevels,
  hitPointMaxWithAdvancement,
  hpChoiceTooltip,
  levelingMode,
  levelingModeTooltip,
  nextLevelPreview,
  setLevel as setLevelLogic,
  setLevelHp,
  xpForLevel,
  xpToLevel,
  type HpChoice,
  type LevelingMode,
} from '../../logic/advancement';
import { featSlotAssignments } from '../../logic/feats';
import { FeatSlotsSection } from './advancement/FeatSlotsSection';
import { ProgressionAdvisor } from './advancement/ProgressionAdvisor';
import { AdvancementPlanner } from './advancement/AdvancementPlanner';
import { useXpAward } from './useXpAward';
import styles from './AdvancementPage.module.css';

export interface AdvancementPageProps {
  character: Character;
  onChange: (next: Character) => void;
  /**
   * Injected clock for log timestamps + HP records, so awards/level-ups are
   * deterministic in tests (same seam the advancement logic uses). Defaults to
   * Date.now in production.
   */
  now?: () => number;
}

/**
 * The Advancement tab (Stage A6a): the authoritative Level control, the
 * XP-vs-milestone leveling mode, a per-level Hit Point choice (fixed or rolled),
 * a next-level preview, a choices-pending summary, and a minimal audit log.
 *
 * NO rule is computed in this component. Every derived number and gate comes
 * from logic/advancement.ts (level clamp + spellcasting reconcile, canLevelUp,
 * xpToLevel/xpForLevel, the HP-max breakdown, nextLevelPreview, feat slots) and
 * the existing abilities/classes resolvers. Every displayed total is a
 * CalculatedValue breakdown (calculated-totals steering); named rules content
 * (Proficiency Bonus, the HP choice, the leveling mode) is a ContentTooltip
 * (content-tooltips steering). PHB 2024 "Gaining a Level".
 */
export function AdvancementPage({ character, onChange, now = Date.now }: AdvancementPageProps) {
  const [showLog, setShowLog] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // The HP-roll dialog is opened by two distinct buttons with different intent;
  // we track which one so the resolver never has to re-derive it from mayLevelUp
  // (which is ambiguous in milestone mode, where a level-up is always permitted).
  const [hpRoll, setHpRoll] = useState<null | 'level-up' | 'record-current'>(null);

  const { xpAwardAmount, setXpAwardAmount, xpAwardReason, setXpAwardReason, canAward, handleAwardXp } =
    useXpAward((mutator) => onChange(mutator(character)), now);

  const cls = resolveClass(character);
  const subclass = resolveSubclass(character);
  const level = clampLevel(character.level);
  const mode = levelingMode(character);
  const xp = characterXp(character);

  const hpMaxBreakdown = hitPointMaxWithAdvancement(character);
  const pbBreakdown = proficiencyBonusBreakdown(level);

  const permittedLevel = xpToLevel(xp);
  const mayLevelUp = canLevelUp(character);
  const preview = nextLevelPreview(character);

  // ── Authoritative level control (logic setLevel: clamp + spellcasting reconcile).
  const setLevel = (raw: string) => {
    onChange(setLevelLogic(character, Number.parseInt(raw, 10)));
  };

  // ── Leveling mode toggle. Milestone is the default; switching to XP records the
  //    mode so canLevelUp consults the XP threshold from then on.
  const setMode = (next: LevelingMode) => {
    onChange({
      ...character,
      advancement: {
        ...character.advancement,
        leveling: { ...character.advancement?.leveling, mode: next, xp: character.advancement?.leveling?.xp },
      },
    });
  };

  const setXp = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const nextXp = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    onChange({
      ...character,
      advancement: {
        ...character.advancement,
        leveling: { mode: 'xp', xp: nextXp },
      },
    });
  };

  // ── Level up with a fixed HP choice (applyLevelUp gates on canLevelUp).
  const handleFixedLevelUp = () => {
    const next = applyLevelUp(character, { mode: 'fixed' }, now());
    if (next) onChange(next);
  };

  // ── Level up with a rolled HP choice: the dialog captures the raw Hit Die face,
  //    then applyLevelUp records it. The HP math (Con rider, min-1) is in the logic.
  const handleRolledLevelUp = (choice: HpChoice) => {
    setHpRoll(null);
    const next = applyLevelUp(character, choice, now());
    if (next) onChange(next);
  };

  // ── Re-record the HP choice for the CURRENT level (a correction, not a level-up).
  const handleRecordCurrentHp = (choice: HpChoice) => {
    onChange(setLevelHp(character, level, choice, now()));
  };

  const clearLog = () => {
    const nextAdvancement = { ...character.advancement };
    delete nextAdvancement.log;
    const hasRest = Object.keys(nextAdvancement).length > 0;
    const next: Character = { ...character };
    if (hasRest) next.advancement = nextAdvancement;
    else delete next.advancement;
    onChange(next);
    setShowClearConfirm(false);
  };

  const log = advancementLog(character);
  const hpTip = hpChoiceTooltip(character);

  // ── Choices pending: UNFILLED feat slots at asi-marker levels, the subclass
  //    not chosen at level >= subclassLevel, and any level missing an HP record.
  //    All read from the logic; none computed here.
  const unfilledFeatLevels = featSlotAssignments(character, featSlotLevels(character))
    .filter((a) => a.filled === undefined)
    .map((a) => a.level);
  const subclassDue =
    cls !== undefined && level >= cls.subclassLevel && subclass === undefined;
  const recordedHpLevels = new Set(
    (character.advancement?.levels ?? []).filter((l) => l.hp !== undefined).map((l) => l.level),
  );
  const unrecordedHpLevels: number[] = [];
  for (let l = 2; l <= level; l += 1) {
    if (!recordedHpLevels.has(l)) unrecordedHpLevels.push(l);
  }
  const pendingCount = unfilledFeatLevels.length + (subclassDue ? 1 : 0) + unrecordedHpLevels.length;

  return (
    <div className={styles.page}>
      {/* ── Level + leveling mode ───────────────────────────────────────────── */}
      <Card>
        <SectionHeader icon={TrendingUp} title="Level &amp; Experience" />

        <div className={styles.levelRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="adv-level">
              Level
            </label>
            <input
              id="adv-level"
              className={styles.levelInput}
              type="number"
              min={1}
              max={20}
              value={character.level}
              onChange={(e) => setLevel(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              <ContentTooltip
                content={{
                  title: 'Proficiency Bonus',
                  sections: [{ label: 'Rule', text: 'Set by your character level (PHB 2024 "Character Advancement").' }],
                }}
              >
                Proficiency Bonus
              </ContentTooltip>
            </span>
            <span className={styles.derivedValue}>
              <CalculatedValue label="Proficiency Bonus" breakdown={pbBreakdown}>
                {formatSigned(pbBreakdown.total)}
              </CalculatedValue>
            </span>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              <ContentTooltip
                content={{
                  title: 'Leveling mode',
                  sections: [{ label: 'Rule', text: levelingModeTooltip(character) }],
                }}
              >
                Leveling mode
              </ContentTooltip>
            </span>
            <SegmentedControl<LevelingMode>
              ariaLabel="Leveling mode"
              options={[
                { value: 'milestone', label: 'Milestone' },
                { value: 'xp', label: 'XP' },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
        </div>

        {mode === 'xp' && (
          <div className={styles.xpRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="adv-xp">
                Experience Points
              </label>
              <input
                id="adv-xp"
                className={styles.xpInput}
                type="number"
                min={0}
                value={xp}
                aria-label="Experience Points"
                onChange={(e) => setXp(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Permitted level</span>
              {/* The permitted level is a THRESHOLD TABLE LOOKUP, not an additive
                  sum, so it is presented as a ContentTooltip (the XP figures are
                  descriptive, not addends) rather than a CalculatedValue — forcing
                  a summing Breakdown here would violate the "components sum to
                  total" invariant (XP magnitudes cannot sum to a level ordinal).
                  PHB 2024 "Character Advancement" XP table. */}
              <span className={styles.derivedValue}>
                <ContentTooltip
                  content={{
                    title: 'XP-permitted level',
                    sections: [
                      {
                        label: 'Lookup',
                        text: `Current XP (${xp}) has reached the level-${permittedLevel} threshold (${xpForLevel(
                          permittedLevel,
                        )} XP).`,
                      },
                      {
                        label: 'Next',
                        text:
                          permittedLevel < MAX_LEVEL
                            ? `Level ${permittedLevel + 1} needs ${xpForLevel(permittedLevel + 1)} XP total.`
                            : 'At the level cap (20).',
                      },
                    ],
                  }}
                >
                  {permittedLevel}
                </ContentTooltip>
              </span>
              {/* Live region: announce the permitted-level change to screen-reader
                  users who are not focused on the control above. */}
              <span className={styles.srOnly} role="status" aria-live="polite">
                Permitted level: {permittedLevel}
              </span>
            </div>

            <div className={styles.awardBlock}>
              <span className={styles.fieldLabel}>Award XP</span>
              <div className={styles.awardRow}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Amount"
                  aria-label="XP amount to award"
                  value={xpAwardAmount}
                  onChange={(e) => setXpAwardAmount(e.target.value)}
                  className={styles.awardInput}
                />
                <input
                  type="text"
                  placeholder="Reason (e.g. Session 5)"
                  aria-label="Reason for XP award"
                  value={xpAwardReason}
                  onChange={(e) => setXpAwardReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAwardXp();
                  }}
                  className={styles.awardInput}
                />
                <button
                  type="button"
                  onClick={handleAwardXp}
                  disabled={!canAward}
                  className={styles.awardBtn}
                >
                  Award
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Progression Advisor (read-only XP/milestone projection + prompts) ─ */}
      <ProgressionAdvisor character={character} />

      {/* ── Hit Points ──────────────────────────────────────────────────────── */}
      <Card>
        <SectionHeader icon={Heart} title="Hit Points" />
        {cls === undefined ? (
          <p className={styles.placeholder}>
            No class selected. Choose a class on the Character tab to gain a Hit Die and
            per-level Hit Point choices.
          </p>
        ) : (
          <>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>
                {hpTip ? (
                  <ContentTooltip
                    content={{ title: 'Hit Points on level up', sections: [{ label: 'Rule', text: hpTip }] }}
                  >
                    Hit Point maximum
                  </ContentTooltip>
                ) : (
                  'Hit Point maximum'
                )}
              </span>
              <span className={styles.derivedValueLarge}>
                <CalculatedValue label="Hit Point maximum" breakdown={hpMaxBreakdown}>
                  {hpMaxBreakdown.total}
                </CalculatedValue>
              </span>
              {/* Live region: announce HP-max changes (after a level-up or an HP
                  record) to screen-reader users not focused on the value above. */}
              <span className={styles.srOnly} role="status" aria-live="polite">
                Hit Point maximum: {hpMaxBreakdown.total}
              </span>
            </div>

            {level >= 2 && (
              <div className={styles.hpChoiceRow}>
                <span className={styles.fieldLabel}>Record HP for level {level}</span>
                <div className={styles.hpChoiceButtons}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => handleRecordCurrentHp({ mode: 'fixed' })}
                  >
                    Take fixed value
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => setHpRoll('record-current')}
                  >
                    Roll the Hit Die
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── Next-level preview + Level Up ───────────────────────────────────── */}
      <Card>
        <SectionHeader icon={ArrowUpCircle} title="Next Level" />
        {preview === null ? (
          <p className={styles.placeholder}>At the level cap (20). Nothing further to gain.</p>
        ) : (
          <>
            <p className={styles.previewHeading}>Advancing to level {preview.nextLevel}:</p>
            <ul className={styles.previewList}>
              {preview.proficiencyBonusChangesTo !== undefined && (
                <li>
                  Proficiency Bonus rises to {formatSigned(preview.proficiencyBonusChangesTo)}
                </li>
              )}
              {preview.subclassChoice && <li>Choose a subclass</li>}
              {preview.featSlotOpens && (
                <li>
                  <ContentTooltip
                    content={{
                      title: 'Feat slot',
                      sections: [
                        {
                          label: 'Rule',
                          text:
                            'This level grants a feat (an Ability Score Improvement feat or another you qualify for; level 19 is an Epic Boon). Choose it below in "Feats & Ability Score Improvements" after leveling up.',
                        },
                      ],
                    }}
                  >
                    A feat slot opens
                  </ContentTooltip>
                </li>
              )}
              {preview.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
              {preview.features.length === 0 &&
                !preview.subclassChoice &&
                !preview.featSlotOpens &&
                preview.proficiencyBonusChangesTo === undefined && <li>No new features</li>}
            </ul>

            <div className={styles.levelUpRow}>
              <span className={styles.hint}>
                {mode === 'xp' && !mayLevelUp
                  ? `Not enough XP: level ${preview.nextLevel} needs ${xpForLevel(preview.nextLevel)} XP total.`
                  : cls === undefined
                    ? 'Fixed HP only until a class is chosen.'
                    : 'Choose how to gain Hit Points this level:'}
              </span>
              <div className={styles.hpChoiceButtons}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={!mayLevelUp}
                  onClick={handleFixedLevelUp}
                >
                  Level up (fixed HP)
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={!mayLevelUp || cls === undefined}
                  onClick={() => setHpRoll('level-up')}
                >
                  Level up (roll HP)
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* ── Advancement Planner (read-only upcoming milestones + preview) ───── */}
      <AdvancementPlanner character={character} />

      {/* ── Feats & Ability Score Improvements ──────────────────────────────── */}
      <FeatSlotsSection character={character} onChange={onChange} now={now} />

      {/* ── Choices pending ─────────────────────────────────────────────────── */}
      <Card>
        <SectionHeader icon={ListChecks} title={`Choices Pending (${pendingCount})`} />
        {pendingCount === 0 ? (
          <p className={styles.placeholder}>No outstanding choices.</p>
        ) : (
          <ul className={styles.pendingList}>
            {subclassDue && <li className={styles.pendingItem}>Subclass not chosen (due at level {cls?.subclassLevel})</li>}
            {unfilledFeatLevels.map((l) => (
              <li key={`feat-${l}`} className={styles.pendingItem}>
                Feat not chosen for level {l}
              </li>
            ))}
            {unrecordedHpLevels.map((l) => (
              <li key={`hp-${l}`} className={styles.pendingItem}>
                Hit Points not recorded for level {l} (using the fixed value)
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Audit log ───────────────────────────────────────────────────────── */}
      <Card>
        <CollapsibleSection title={`Advancement Log (${log.length})`} storageKey="dnd-collapse-adv-log">
          <div className={styles.logActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setShowLog((v) => !v)}
            >
              <ScrollText size={14} /> {showLog ? 'Hide entries' : 'Show entries'}
            </button>
            {log.length > 0 && (
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setShowClearConfirm(true)}
              >
                <Trash2 size={14} /> Clear log…
              </button>
            )}
          </div>
          {showLog &&
            (log.length === 0 ? (
              <p className={styles.placeholder}>No advancement entries yet.</p>
            ) : (
              <ul className={styles.logList} aria-label="Advancement log entries">
                {[...log].reverse().map((entry) => (
                  <li key={entry.timestamp} className={styles.logItem}>
                    <span className={styles.logKind}>{entry.kind}</span>
                    <span className={styles.logDetail}>{entry.detail}</span>
                  </li>
                ))}
              </ul>
            ))}
        </CollapsibleSection>
      </Card>

      {hpRoll !== null && cls !== undefined && (
        <HpRollDialog
          title={`Roll Hit Points — level ${
            hpRoll === 'level-up' ? preview?.nextLevel ?? level : level
          }`}
          hitDie={cls.hitDie}
          conMod={abilityModifier(effectiveAbilityScores(character).con)}
          onResolve={(result) => {
            // The dialog's intent is recorded in hpRoll, so there is no need to
            // re-derive it from mayLevelUp (ambiguous in milestone mode). A
            // level-up is additionally guarded by the permit + preview.
            if (hpRoll === 'level-up' && mayLevelUp && preview !== null) {
              handleRolledLevelUp({ mode: 'rolled', face: result.face });
            } else {
              setHpRoll(null);
              handleRecordCurrentHp({ mode: 'rolled', face: result.face });
            }
          }}
          onClose={() => setHpRoll(null)}
        />
      )}

      {showClearConfirm && (
        <ConfirmDialog
          message="Clear the entire advancement log? This cannot be undone."
          confirmLabel="Clear log"
          onConfirm={clearLog}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}
