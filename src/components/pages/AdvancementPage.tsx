import { useState } from 'react';
import { TrendingUp, Heart, TriangleAlert, ListChecks, ScrollText, Trash2, Layers } from 'lucide-react';
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
import { resolveClass, resolveClasses } from '../../logic/classes';
import { effectiveAbilityScores } from '../../logic/feats';
import { multiclassOptions, type MulticlassOption } from '../../logic/multiclass';
import { getClass, type ClassId } from '../../data/classes';
import { HouseRuleIndicator } from '../combat/HouseRuleIndicator';
import {
  advancementLog,
  applyLevelUp,
  applyMulticlassLevel,
  canLevelUp,
  characterXp,
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
import { FeatSlotsSection } from './advancement/FeatSlotsSection';
import { FightingStyleSection } from './advancement/FightingStyleSection';
import { ProgressionAdvisor } from './advancement/ProgressionAdvisor';
import { AdvancementPlanner } from './advancement/AdvancementPlanner';
import { ExpertisePending, ExpertiseOverNote } from './advancement/ExpertisePending';
import { LanguagePicksPending, LanguagePicksOverNote } from './advancement/LanguagePicksPending';
import {
  ClassChoicesPending,
  ClassChoicesOverNote,
  ClassChoicesSection,
  MulticlassPicksOverNote,
  MulticlassPicksPending,
} from './advancement/ClassChoicesPending';
import { spellPickLabel } from '../../logic/spell-picks-pending';
import { pendingChoices } from '../../logic/pending-choices';
import { SpellNameList } from '../shared/SpellName';
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
  // The class selected in the add-a-class control, and the target class for a
  // multiclass roll-HP dialog (a new or existing class gaining the level).
  const [selectedNewClass, setSelectedNewClass] = useState<ClassId | ''>('');
  // Which HELD class the main Level-up action advances. Only meaningful when the
  // character has two or more classes; a single-class character always advances
  // its one class (classes[0]). Empty = fall back to the primary class.
  const [levelUpClass, setLevelUpClass] = useState<ClassId | ''>('');

  const { xpAwardAmount, setXpAwardAmount, xpAwardReason, setXpAwardReason, canAward, handleAwardXp } =
    useXpAward((mutator) => onChange(mutator(character)), now);

  const cls = resolveClass(character);
  const level = clampLevel(character.level);
  const mode = levelingMode(character);
  const xp = characterXp(character);

  const hpMaxBreakdown = hitPointMaxWithAdvancement(character);
  const pbBreakdown = proficiencyBonusBreakdown(level);

  const permittedLevel = xpToLevel(xp);
  const mayLevelUp = canLevelUp(character);
  const preview = nextLevelPreview(character);

  // ── Multiclass: the classes the character could take a NEW level in, each with
  //    its RAW prereq status and the toggle-aware UI decision (logic/multiclass).
  //    A class that fails the prereq is DISABLED when the toggle is off and
  //    SELECTABLE-WITH-WARNING when it is on (option.decision.proceed/warning).
  const mcOptions: MulticlassOption[] = multiclassOptions(character);
  const selectedOption = mcOptions.find((o) => o.classId === selectedNewClass);
  // The current multiclass build label, e.g. "Fighter 5 / Wizard 1".
  const heldClasses = resolveClasses(character);
  const currentBuild = heldClasses
    .map(({ entry, data }) => `${data.name} ${entry.level}`)
    .join(' / ');
  // A character with two or more class entries is a multiclass character.
  const isMulticlass = heldClasses.length >= 2;
  // The HELD class the main Level-up action targets (the picked one, or the
  // primary when none is picked / only one class exists). The level-up records
  // HP against THIS class's Hit Die.
  const levelUpTargetId: ClassId | undefined =
    (levelUpClass || heldClasses[0]?.data.id) as ClassId | undefined;
  const levelUpTargetDie = levelUpTargetId ? getClass(levelUpTargetId)?.hitDie : cls?.hitDie;
  // Rolled HP has no effect on a MULTICLASS Hit Point maximum yet: the multiclass
  // HP-max path is fixed-only until the per-class rolled-HP model lands (M5). So
  // the roll-HP action is offered for single-class characters only; a multiclass
  // character takes the fixed value (a note explains why). PHB 2024
  // "Multiclassing: Hit Points".
  const rolledHpAvailable = !isMulticlass;

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

  // ── Level up with the given HP choice, advancing the TARGET held class. For a
  //    single-class character this is applyLevelUp (unchanged behaviour: advance
  //    classes[0]); for a multiclass character it routes through
  //    applyMulticlassLevel so the user can advance ANY held class (not just the
  //    primary), recording HP against that class's Hit Die. Both gate on
  //    canLevelUp and maintain the total === Σ entry-levels invariant.
  const applyHeldLevelUp = (choice: HpChoice): Character | null => {
    if (isMulticlass && levelUpTargetId) {
      return applyMulticlassLevel(character, levelUpTargetId, choice, now());
    }
    return applyLevelUp(character, choice, now());
  };

  // ── Level up with a fixed HP choice (gates on canLevelUp).
  const handleFixedLevelUp = () => {
    const next = applyHeldLevelUp({ mode: 'fixed' });
    if (next) onChange(next);
  };

  // ── Level up with a rolled HP choice: the dialog captures the raw Hit Die face,
  //    then the level-up records it. The HP math (Con rider, min-1) is in the logic.
  const handleRolledLevelUp = (choice: HpChoice) => {
    setHpRoll(null);
    const next = applyHeldLevelUp(choice);
    if (next) onChange(next);
  };

  // ── Re-record the HP choice for the CURRENT level (a correction, not a level-up).
  const handleRecordCurrentHp = (choice: HpChoice) => {
    onChange(setLevelHp(character, level, choice, now()));
  };

  // ── Add a level in a chosen class (new or existing) — the multiclass level-up.
  //    applyMulticlassLevel maintains the invariant (total === Σ entry levels) and
  //    records the HP choice against the LEVELED class's Hit Die. The prereq /
  //    house-rule gate is enforced by the control below (disabled options), so a
  //    class reaching this handler has already been decided to proceed.
  const handleMulticlassLevel = (classId: ClassId, choice: HpChoice) => {
    const next = applyMulticlassLevel(character, classId, choice, now());
    if (next) {
      onChange(next);
      setSelectedNewClass('');
    }
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

  // Everything still owed (feat slots, subclass, HP records, expertise, languages,
  // class choices, spell picks, ...). Shared with the nav badge so the counts agree.
  const {
    unfilledFeatLevels,
    subclassDue,
    unrecordedHpLevels,
    expertise,
    languagePicks,
    classChoices,
    spellPicks,
    illegalSpells,
    unfilledFightingStyles,
    total: pendingCount,
  } = pendingChoices(character);

  // The pending-choices card. When choices are owed it is shown first and styled as a
  // call to action; with none owed it stays a quiet note at the bottom of the page.
  const owed = pendingCount > 0;
  const pendingCard = (
    <section id="adv-section-pending" aria-labelledby="adv-pending-title">
      <Card className={owed ? styles.pendingAlert : undefined}>
        <SectionHeader
          icon={owed ? TriangleAlert : ListChecks}
          titleId="adv-pending-title"
          title={owed ? `Action needed: Choices Pending (${pendingCount})` : `Choices Pending (${pendingCount})`}
        />
        {owed && (
          <p className={styles.pendingIntro}>
            Your character has choices to make. Work through each item below; the list shrinks as
            you finish them.
          </p>
        )}
        {pendingCount === 0 ? (
          <p className={styles.placeholder}>No outstanding choices.</p>
        ) : (
          <ul className={styles.pendingList}>
            {subclassDue && <li className={styles.pendingItem}>Subclass not chosen (due at level {cls?.subclassLevel})</li>}
            {unfilledFightingStyles.map((s) => (
              <li key={`fighting-style-${s.key}`} className={styles.pendingItem}>
                Fighting Style feat not chosen ({s.className})
              </li>
            ))}
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
            <ExpertisePending character={character} onChange={onChange} status={expertise} />
            <LanguagePicksPending character={character} onChange={onChange} status={languagePicks} />
            <ClassChoicesPending character={character} onChange={onChange} statuses={classChoices} />
            <MulticlassPicksPending character={character} onChange={onChange} />
            {spellPicks.map((item) => (
              <li
                key={`spell-${item.kind}-${item.className ?? ''}-${item.spellLevel ?? ''}`}
                className={styles.pendingItem}
                data-testid={`pending-spell-${item.kind}${item.spellLevel ? `-${item.spellLevel}` : ''}`}
              >
                {spellPickLabel(item)}: {item.have} of {item.need} chosen.{' '}
                <a href="#spells">Choose on Spells</a>
              </li>
            ))}
            {illegalSpells.length > 0 && (
              <li className={styles.pendingItem} data-testid="pending-illegal-spells">
                {illegalSpells.length} selected {illegalSpells.length === 1 ? 'spell is' : 'spells are'} not on your
                class&apos;s spell list:{' '}
                <SpellNameList ids={[...new Set(illegalSpells.map((s) => s.id))]} />.{' '}
                <a href="#spells">Review on Spells</a>
              </li>
            )}
          </ul>
        )}
        <ExpertiseOverNote status={expertise} />
        <LanguagePicksOverNote status={languagePicks} />
        <ClassChoicesOverNote statuses={classChoices} />
        <MulticlassPicksOverNote character={character} />
      </Card>
    </section>
  );

  return (
    <div className={styles.page}>
      {/* Owed choices come first so they cannot be missed. */}
      {owed && pendingCard}

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

        {/* Next level: preview + Level Up, part of the same card. */}
        <div id="adv-section-next-level" tabIndex={-1} className={styles.nextLevelSection}>
          <h4 className={styles.subHeading}>Next Level</h4>
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
  
              {/* Which held class gains the level. Shown only for a multiclass
                  character (a single-class character always advances its one
                  class). PHB 2024 "Multiclassing": a level may be taken in any
                  class you already have. */}
              {isMulticlass && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="adv-levelup-class">
                    Class to advance
                  </label>
                  <select
                    id="adv-levelup-class"
                    className={styles.classSelect}
                    aria-label="Class to advance"
                    value={levelUpTargetId ?? ''}
                    onChange={(e) => setLevelUpClass(e.target.value as ClassId | '')}
                  >
                    {heldClasses.map(({ entry, data }) => (
                      <option key={data.id} value={data.id}>
                        {data.name} {entry.level} → {entry.level + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}
  
              <div className={styles.levelUpRow}>
                <span className={styles.hint}>
                  {mode === 'xp' && !mayLevelUp
                    ? `Not enough XP: level ${preview.nextLevel} needs ${xpForLevel(preview.nextLevel)} XP total.`
                    : cls === undefined
                      ? 'Fixed HP only until a class is chosen.'
                      : isMulticlass
                        ? `Advancing ${getClass(levelUpTargetId ?? '')?.name ?? 'your class'} (d${levelUpTargetDie}). Multiclass HP uses the fixed per-level value.`
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
                  {rolledHpAvailable && (
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={!mayLevelUp || cls === undefined}
                      onClick={() => setHpRoll('level-up')}
                    >
                      Level up (roll HP)
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
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
                  {rolledHpAvailable && (
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => setHpRoll('record-current')}
                    >
                      Roll the Hit Die
                    </button>
                  )}
                </div>
                {!rolledHpAvailable && (
                  <p className={styles.hint}>
                    Multiclass Hit Point maxima use the fixed per-level value; rolling
                    is available once per-class rolled HP is supported.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── Multiclass: add a level in a new (or existing) class ────────────── */}
      <Card>
        <SectionHeader icon={Layers} title="Multiclass" />
        {cls === undefined ? (
          <p className={styles.placeholder}>
            No class selected. Choose a class on the Character tab before adding a
            second class.
          </p>
        ) : (
          <>
            {currentBuild && (
              <p className={styles.multiclassPreview} data-testid="mc-current-build">
                {currentBuild}
              </p>
            )}
            <p className={styles.hint}>
              Add a level in a new class (PHB 2024 "Multiclassing"). You need 13+ in
              the primary ability of the new class and of every class you already
              have. The sheet, spells, and print surfaces still show your primary
              class until the multiclass display update; this page shows the full
              build above.
            </p>
            {/* The warning banner only renders when the house rule is active. */}
            <HouseRuleIndicator houseRules={character.houseRules} />
            <div className={styles.multiclassRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="adv-new-class">
                  New class
                </label>
                <select
                  id="adv-new-class"
                  className={styles.classSelect}
                  aria-label="New class to add a level in"
                  value={selectedNewClass}
                  disabled={!mayLevelUp}
                  onChange={(e) => setSelectedNewClass(e.target.value as ClassId | '')}
                >
                  <option value="">Choose a class…</option>
                  {mcOptions.map((option) => {
                    const failing =
                      option.status.reason === 'prereq'
                        ? ` — needs ${(option.status.failing ?? [])
                            .map((a) => a.toUpperCase())
                            .join(option.classId === 'fighter' ? ' or ' : ' and ')} 13+`
                        : '';
                    // Disabled only when the UI decision says it cannot proceed
                    // (prereq fails AND the toggle is off). With the toggle on a
                    // failing option is selectable (and warns on apply).
                    return (
                      <option
                        key={option.classId}
                        value={option.classId}
                        disabled={!option.decision.proceed}
                      >
                        {option.className}
                        {failing}
                        {option.decision.warning ? ' (house rule)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={!mayLevelUp || selectedOption === undefined || !selectedOption.decision.proceed}
                onClick={() => {
                  if (selectedOption) handleMulticlassLevel(selectedOption.classId, { mode: 'fixed' });
                }}
              >
                Add level (fixed HP)
              </button>
            </div>
            {/* Adding a class makes the character multiclass, whose HP maximum is
                fixed-only until per-class rolled HP lands (M5) — so only the fixed
                value is offered here, and the HP-max breakdown stays consistent
                with what is recorded. PHB 2024 "Multiclassing: Hit Points". */}
            <p className={styles.hint}>
              A new class adds the fixed per-level Hit Points. Rolling Hit Points for
              a multiclass level is not yet supported.
            </p>
            {selectedOption?.decision.warning && (
              <p className={styles.warnText} role="note">
                {selectedOption.className} does not meet the multiclass prerequisite.
                The Allow Illegal Multiclass house rule permits it with this warning.
              </p>
            )}
            {selectedOption && (
              <p className={styles.multiclassPreview} data-testid="mc-result-build">
                After adding: {buildAfterAdding(character, selectedOption.classId)}
              </p>
            )}
            {mode === 'xp' && !mayLevelUp && (
              <p className={styles.hint}>
                Not enough XP to add a level (XP mode permits one level at a time).
              </p>
            )}
          </>
        )}
      </Card>

      {/* ── Advancement Planner (read-only upcoming milestones + preview) ───── */}
      <AdvancementPlanner character={character} />

      {/* ── Fighting Style (Fighter 1, Paladin 2, Ranger 2) ─────────────────── */}
      <FightingStyleSection character={character} onChange={onChange} now={now} />

      {/* ── Feats & Ability Score Improvements ──────────────────────────────── */}
      <FeatSlotsSection character={character} onChange={onChange} now={now} />

      {/* ── Class choices (Metamagic, Invocations, Maneuvers, orders, ...) ──── */}
      {classChoices.length > 0 && (
        <Card>
          <SectionHeader icon={ScrollText} title={`Class Choices (${classChoices.length})`} />
          <ClassChoicesSection character={character} onChange={onChange} statuses={classChoices} />
        </Card>
      )}

      {/* Choices pending: the quiet version, when nothing is owed. */}
      {!owed && pendingCard}

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

/**
 * The multiclass build label after adding one level in `classId` (PHB 2024
 * "Multiclassing"), e.g. "Fighter 5 / Wizard 1". Display-only preview: it does
 * not apply the level. An EXISTING class increments; a NEW class is appended at
 * level 1 — mirroring applyMulticlassLevel so the confirmation shows the real
 * resulting build.
 */
function buildAfterAdding(character: Character, classId: ClassId): string {
  const existing = resolveClasses(character).map(({ entry, data }) => ({
    name: data.name,
    level: entry.level,
  }));
  const index = (character.classes ?? []).findIndex((e) => e.id === classId);
  if (index === -1) {
    existing.push({ name: getClass(classId)?.name ?? classId, level: 1 });
  } else {
    existing[index] = { ...existing[index], level: existing[index].level + 1 };
  }
  return existing.map((c) => `${c.name} ${c.level}`).join(' / ');
}
