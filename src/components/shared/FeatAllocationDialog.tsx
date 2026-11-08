import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ability, AbilityScores, Character, FeatSelection, SkillId } from '../../types/character';
import { ABILITIES, ABILITY_ABBR, ABILITY_NAMES, SKILLS } from '../../types/character';
import type { FeatData } from '../../data/feats';
import { EQUIPMENT_LIST } from '../../data/equipment';
import { isAsiAllocationValid } from '../../logic/feats';
import { effectiveSkillTraining } from '../../logic/skills';
import { savingThrowProficiency } from '../../logic/saving-throws';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import styles from './FeatAllocationDialog.module.css';

export interface FeatAllocationDialogProps {
  /** The effective ability scores BEFORE this feat's increases (the cap base). */
  effectiveBefore: AbilityScores;
  /** The chosen feat to allocate. */
  feat: FeatData;
  /** The slot level this feat fills. */
  slotLevel: number;
  /**
   * The character, used to filter skill/tool/save choices by what they already
   * have (Resilient only offers abilities lacking save proficiency; Expertise
   * only offers proficient skills). Optional: without it nothing is filtered.
   */
  character?: Character;
  /** Commit the finished FeatSelection (applied by the caller via applyFeat). */
  onConfirm: (selection: FeatSelection) => void;
  onCancel: () => void;
}

/** Fast Crafting Artisan's Tools (PHB 2024 "Crafter", Fast Crafting table L8476). */
const FAST_CRAFTING_TOOLS = [
  "Carpenter's Tools",
  "Leatherworker's Tools",
  "Mason's Tools",
  "Potter's Tools",
  "Smith's Tools",
  "Tinker's Tools",
  "Weaver's Tools",
  "Woodcarver's Tools",
];

const INSTRUMENT_NAMES = EQUIPMENT_LIST.filter((e) => e.id.startsWith('instrument-')).map((e) => e.name);
const TOOL_NAMES = [...new Set(EQUIPMENT_LIST.filter((e) => e.kind === 'tool').map((e) => e.name))].sort();

const SKILL_PREFIX = 'skill:';
const TOOL_PREFIX = 'tool:';

/**
 * Captures the player choices a chosen feat still needs before it is applied:
 * the ability-increase allocation and the skill / tool / Expertise picks.
 *
 *  - ASI feat (kind 'asi'): +2 to one ability OR +1 to two, validated by the
 *    pure isAsiAllocationValid (PHB 2024 "Ability Score Improvement" L8558).
 *  - 'choose-one' / 'epic-boon': a single ability chooser limited to the feat's
 *    allowed abilities (Resilient also drops abilities already proficient).
 *  - 'fixed' (Actor +1 Cha): no ability choice — shown read-only.
 *  - mechanics.grants: free skill picks (Skill Expert), tool picks (Crafter,
 *    Musician), any-three skills-or-tools (Skilled), Expertise picks (Skill
 *    Expert, Boon of Skill) and the lore/observer skill choice (Keen Mind,
 *    Observant: proficiency if lacking, Expertise if already proficient).
 *
 * Spell, damage-type and weapon choices (Magic Initiate, Elemental Adept...)
 * are not collected here; they stay in the feat's description.
 *
 * NO rule is computed here; the ASI shape is validated by isAsiAllocationValid
 * and the caps come from the feat's abilityIncrease.max.
 */
export function FeatAllocationDialog({
  effectiveBefore,
  feat,
  slotLevel,
  character,
  onConfirm,
  onCancel,
}: FeatAllocationDialogProps) {
  const inc = feat.abilityIncrease;
  const grants = feat.mechanics.grants;

  // Modal a11y parity with ShortRestDialog: focus trap (with focus restore),
  // body scroll lock, Escape-to-cancel, aria-modal.
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);
  useBodyScrollLock(true);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  // ── ASI allocation (+2 one / +1 two). Stored as an ability→amount map.
  const [asi, setAsi] = useState<Partial<Record<Ability, number>>>({});
  // ── Single chosen ability for choose-one / epic-boon feats.
  const [chosenAbility, setChosenAbility] = useState<Ability | ''>('');
  // ── Free skill picks (Skill Expert).
  const skillCount = grants.skills;
  const [skills, setSkills] = useState<SkillId[]>([]);
  // ── Tool picks (Crafter, Musician): tool names.
  const toolCount = grants.tools;
  const [tools, setTools] = useState<string[]>([]);
  // ── Any-combination skills or tools (Skilled): 'skill:<id>' | 'tool:<name>'.
  const mixedCount = grants.skillsOrTools;
  const [mixed, setMixed] = useState<string[]>([]);
  // ── Expertise picks (Skill Expert, Boon of Skill).
  const expertiseCount = grants.expertise;
  const [expertisePicks, setExpertisePicks] = useState<SkillId[]>([]);
  // ── Keen Mind / Observant: one skill from a fixed list (proficiency or Expertise).
  const loreChoice = feat.mechanics.choices.find((c) => c.key === 'skill-proficiency-or-expertise');
  const loreOptions = useMemo(
    () => (loreChoice && Array.isArray(loreChoice.from) ? (loreChoice.from as SkillId[]) : []),
    [loreChoice],
  );
  const [lore, setLore] = useState<SkillId | ''>('');

  // ── ASI toggle handler: cycle 0 → 2 for the first ability, else 0 → 1.
  const setAsiAmount = (ability: Ability, amount: number) => {
    setAsi((prev) => {
      const next = { ...prev };
      if (amount === 0) delete next[ability];
      else next[ability] = amount;
      return next;
    });
  };

  const asiValidity = useMemo(
    () => isAsiAllocationValid(asi, effectiveBefore),
    [asi, effectiveBefore],
  );

  /** Replace slot `index` of a pick list; '' clears it. */
  const setPick = <T extends string>(
    setter: (updater: (prev: T[]) => T[]) => void,
    index: number,
    value: T | '',
  ) => {
    setter((prev) => {
      const next = [...prev];
      if (value === '') next.splice(index, 1);
      else next[index] = value;
      return next.filter(Boolean);
    });
  };

  // ── What the character already has (for filtering the pickers).
  const alreadyProficient = (id: SkillId): boolean =>
    character ? effectiveSkillTraining(character, id).proficient : false;
  const alreadyExpert = (id: SkillId): boolean =>
    character ? effectiveSkillTraining(character, id).expertise : false;

  const mixedSkills = mixed.filter((m) => m.startsWith(SKILL_PREFIX)).map((m) => m.slice(SKILL_PREFIX.length) as SkillId);
  const mixedTools = mixed.filter((m) => m.startsWith(TOOL_PREFIX)).map((m) => m.slice(TOOL_PREFIX.length));
  const loreIsExpertise = lore !== '' && alreadyProficient(lore);

  /** Skills the feat is granting proficiency in right now (for Expertise options). */
  const newlyProficient = (id: SkillId): boolean =>
    grants.allSkills || skills.includes(id) || mixedSkills.includes(id) || (lore === id && !loreIsExpertise);

  const expertiseOptions = SKILLS.filter(
    (s) => (alreadyProficient(s.id) || newlyProficient(s.id)) && !alreadyExpert(s.id),
  );

  // ── Build the ability increases from the chosen shape.
  const buildIncreases = (): Partial<Record<Ability, number>> | undefined => {
    if (!inc) return undefined;
    switch (inc.kind) {
      case 'asi':
        return asi;
      case 'fixed':
        return { [inc.ability]: inc.amount };
      case 'choose-one':
      case 'epic-boon':
        return chosenAbility === '' ? undefined : { [chosenAbility]: inc.amount };
      default:
        return undefined;
    }
  };

  // ── Whether the current allocation is a complete, legal choice.
  const picksComplete =
    skills.length === skillCount &&
    tools.length === toolCount &&
    mixed.length === mixedCount &&
    expertisePicks.length === expertiseCount &&
    (loreChoice === undefined || lore !== '');
  const abilityComplete = (() => {
    if (!inc) return true;
    if (inc.kind === 'fixed') return true;
    if (inc.kind === 'asi') return asiValidity.valid;
    // choose-one / epic-boon: a single ability under its cap.
    if (chosenAbility === '') return false;
    return effectiveBefore[chosenAbility] + inc.amount <= inc.max;
  })();
  const complete = picksComplete && abilityComplete;

  const handleConfirm = () => {
    if (!complete) return;
    const selection: FeatSelection = { featId: feat.id, level: slotLevel };
    const increases = buildIncreases();
    if (increases && Object.keys(increases).length > 0) selection.abilityIncreases = increases;

    const choiceSkills: SkillId[] = [...skills, ...mixedSkills];
    const choiceExpertise: SkillId[] = [...expertisePicks];
    if (lore !== '') {
      // Keen Mind / Observant: Expertise when already proficient, else proficiency.
      if (loreIsExpertise) choiceExpertise.push(lore);
      else choiceSkills.push(lore);
    }
    const choiceTools = [...tools, ...mixedTools];
    const choices: NonNullable<FeatSelection['choices']> = {};
    if (choiceSkills.length > 0) choices.skills = choiceSkills;
    if (choiceExpertise.length > 0) choices.expertise = choiceExpertise;
    if (choiceTools.length > 0) choices.tools = choiceTools;
    if (Object.keys(choices).length > 0) selection.choices = choices;
    onConfirm(selection);
  };

  // Abilities that would exceed the single-ability cap are disabled.
  const abilityOverCap = (ability: Ability, amount: number, max: number) =>
    effectiveBefore[ability] + amount > max;

  // The abilities a choose-one / epic-boon increase may target. Resilient only
  // offers abilities in which the character lacks save proficiency (PHB 2024
  // "Resilient" L8874).
  const allowedAbilities: Ability[] =
    inc?.kind === 'choose-one' || inc?.kind === 'epic-boon'
      ? inc.abilities.filter(
          (a) =>
            !(grants.saveProficiencyChoice && character && savingThrowProficiency(character, a).proficient),
        )
      : [];

  const toolOptions =
    feat.mechanics.toolsFrom === 'artisan-tools-fast-crafting'
      ? FAST_CRAFTING_TOOLS
      : feat.mechanics.toolsFrom === 'musical-instruments'
        ? INSTRUMENT_NAMES
        : TOOL_NAMES;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Allocate ${feat.name}`}
      onClick={onCancel}
    >
      <div ref={dialogRef} className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{feat.name} — level {slotLevel}</h3>
        <p className={styles.effect}>{feat.effect}</p>

        {/* ── ASI: +2 one / +1 two ─────────────────────────────────────────── */}
        {inc?.kind === 'asi' && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>
              Increase one ability by 2, or two abilities by 1 (max 20)
            </legend>
            <div className={styles.abilityRows}>
              {ABILITIES.map((ability) => {
                const current = asi[ability] ?? 0;
                const plus1Disabled = abilityOverCap(ability, 1, 20);
                const plus2Disabled = abilityOverCap(ability, 2, 20);
                return (
                  <div key={ability} className={styles.abilityRow}>
                    <span className={styles.abilityLabel} title={ABILITY_NAMES[ability]}>
                      {ABILITY_ABBR[ability]}{' '}
                      <span className={styles.beforeScore}>({effectiveBefore[ability]})</span>
                    </span>
                    <div className={styles.stepButtons} role="group" aria-label={`${ABILITY_NAMES[ability]} increase`}>
                      <button
                        type="button"
                        className={`${styles.stepBtn} ${current === 0 ? styles.stepBtnActive : ''}`}
                        onClick={() => setAsiAmount(ability, 0)}
                        aria-pressed={current === 0}
                      >
                        +0
                      </button>
                      <button
                        type="button"
                        className={`${styles.stepBtn} ${current === 1 ? styles.stepBtnActive : ''}`}
                        onClick={() => setAsiAmount(ability, 1)}
                        aria-pressed={current === 1}
                        disabled={plus1Disabled}
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        className={`${styles.stepBtn} ${current === 2 ? styles.stepBtnActive : ''}`}
                        onClick={() => setAsiAmount(ability, 2)}
                        aria-pressed={current === 2}
                        disabled={plus2Disabled}
                      >
                        +2
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {!asiValidity.valid && (
              <p className={styles.hint}>
                {asiValidity.reason === 'over-cap'
                  ? 'An increase would raise a score above 20.'
                  : 'Choose +2 to one ability, or +1 to each of two abilities.'}
              </p>
            )}
          </fieldset>
        )}

        {/* ── choose-one / epic-boon: a single allowed ability ─────────────── */}
        {(inc?.kind === 'choose-one' || inc?.kind === 'epic-boon') && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>
              Increase one ability by {inc.amount} (max {inc.max})
              {grants.saveProficiencyChoice ? ' and gain saving throw proficiency in it' : ''}
            </legend>
            <select
              className={styles.select}
              value={chosenAbility}
              aria-label="Ability to increase"
              onChange={(e) => setChosenAbility(e.target.value as Ability | '')}
            >
              <option value="">— Choose an ability —</option>
              {allowedAbilities.map((ability) => (
                <option
                  key={ability}
                  value={ability}
                  disabled={abilityOverCap(ability, inc.amount, inc.max)}
                >
                  {ABILITY_NAMES[ability]} ({effectiveBefore[ability]} → {effectiveBefore[ability] + inc.amount})
                </option>
              ))}
            </select>
          </fieldset>
        )}

        {/* ── fixed: read-only (e.g. Actor +1 Cha) ─────────────────────────── */}
        {inc?.kind === 'fixed' && (
          <p className={styles.fixedNote}>
            Increases {ABILITY_NAMES[inc.ability]} by {inc.amount} (max {inc.max}).
          </p>
        )}

        {/* ── Free skill proficiencies (Skill Expert) ──────────────────────── */}
        {skillCount > 0 && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>
              Choose {skillCount} skill proficienc{skillCount === 1 ? 'y' : 'ies'}
            </legend>
            {Array.from({ length: skillCount }).map((_, i) => (
              <select
                key={i}
                className={styles.select}
                value={skills[i] ?? ''}
                aria-label={`Skill ${i + 1}`}
                onChange={(e) => setPick<SkillId>(setSkills, i, e.target.value as SkillId | '')}
              >
                <option value="">— Choose a skill —</option>
                {SKILLS.map((s) => (
                  <option
                    key={s.id}
                    value={s.id}
                    disabled={(skills.includes(s.id) && skills[i] !== s.id) || alreadyProficient(s.id)}
                  >
                    {s.name}
                    {alreadyProficient(s.id) ? ' (already proficient)' : ''}
                  </option>
                ))}
              </select>
            ))}
          </fieldset>
        )}

        {/* ── Tool / instrument proficiencies (Crafter, Musician) ──────────── */}
        {toolCount > 0 && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>
              Choose {toolCount} {feat.mechanics.toolsFrom === 'musical-instruments' ? 'Musical Instruments' : "Artisan's Tools"}
            </legend>
            {Array.from({ length: toolCount }).map((_, i) => (
              <select
                key={i}
                className={styles.select}
                value={tools[i] ?? ''}
                aria-label={`Tool ${i + 1}`}
                onChange={(e) => setPick<string>(setTools, i, e.target.value)}
              >
                <option value="">— Choose —</option>
                {toolOptions.map((name) => (
                  <option key={name} value={name} disabled={tools.includes(name) && tools[i] !== name}>
                    {name}
                  </option>
                ))}
              </select>
            ))}
          </fieldset>
        )}

        {/* ── Any combination of skills or tools (Skilled) ─────────────────── */}
        {mixedCount > 0 && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Choose {mixedCount} skills or tools</legend>
            {Array.from({ length: mixedCount }).map((_, i) => (
              <select
                key={i}
                className={styles.select}
                value={mixed[i] ?? ''}
                aria-label={`Skill or tool ${i + 1}`}
                onChange={(e) => setPick<string>(setMixed, i, e.target.value)}
              >
                <option value="">— Choose a skill or tool —</option>
                <optgroup label="Skills">
                  {SKILLS.map((s) => (
                    <option
                      key={s.id}
                      value={`${SKILL_PREFIX}${s.id}`}
                      disabled={
                        (mixed.includes(`${SKILL_PREFIX}${s.id}`) && mixed[i] !== `${SKILL_PREFIX}${s.id}`) ||
                        alreadyProficient(s.id)
                      }
                    >
                      {s.name}
                      {alreadyProficient(s.id) ? ' (already proficient)' : ''}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Tools">
                  {TOOL_NAMES.map((name) => (
                    <option
                      key={name}
                      value={`${TOOL_PREFIX}${name}`}
                      disabled={mixed.includes(`${TOOL_PREFIX}${name}`) && mixed[i] !== `${TOOL_PREFIX}${name}`}
                    >
                      {name}
                    </option>
                  ))}
                </optgroup>
              </select>
            ))}
          </fieldset>
        )}

        {/* ── Keen Mind / Observant: proficiency, or Expertise if proficient ── */}
        {loreChoice !== undefined && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>
              Choose a skill: proficiency if you lack it, Expertise if you already have it
            </legend>
            <select
              className={styles.select}
              value={lore}
              aria-label="Skill proficiency or Expertise"
              onChange={(e) => setLore(e.target.value as SkillId | '')}
            >
              <option value="">— Choose a skill —</option>
              {loreOptions.map((id) => {
                const name = SKILLS.find((s) => s.id === id)?.name ?? id;
                return (
                  <option key={id} value={id} disabled={alreadyExpert(id)}>
                    {name}
                    {alreadyExpert(id)
                      ? ' (already Expertise)'
                      : alreadyProficient(id)
                        ? ' (gain Expertise)'
                        : ' (gain proficiency)'}
                  </option>
                );
              })}
            </select>
          </fieldset>
        )}

        {/* ── Expertise picks (Skill Expert, Boon of Skill) ────────────────── */}
        {expertiseCount > 0 && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>
              Choose {expertiseCount} skill{expertiseCount === 1 ? '' : 's'} for Expertise
            </legend>
            {Array.from({ length: expertiseCount }).map((_, i) => (
              <select
                key={i}
                className={styles.select}
                value={expertisePicks[i] ?? ''}
                aria-label={`Expertise ${i + 1}`}
                onChange={(e) => setPick<SkillId>(setExpertisePicks, i, e.target.value as SkillId | '')}
              >
                <option value="">— Choose a skill —</option>
                {expertiseOptions.map((s) => (
                  <option
                    key={s.id}
                    value={s.id}
                    disabled={expertisePicks.includes(s.id) && expertisePicks[i] !== s.id}
                  >
                    {s.name}
                  </option>
                ))}
              </select>
            ))}
          </fieldset>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={!complete}
            onClick={handleConfirm}
          >
            Take {feat.name}
          </button>
        </div>
      </div>
    </div>
  );
}
