import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ability, AbilityScores, FeatSelection, SkillId } from '../../types/character';
import { ABILITIES, ABILITY_ABBR, ABILITY_NAMES, SKILLS } from '../../types/character';
import type { FeatData } from '../../data/feats';
import { isAsiAllocationValid } from '../../logic/feats';
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
  /** Commit the finished FeatSelection (applied by the caller via applyFeat). */
  onConfirm: (selection: FeatSelection) => void;
  onCancel: () => void;
}

/**
 * Captures the player choices a chosen feat still needs before it is applied
 * (Stage A6b): the ability-increase allocation and any skill grants.
 *
 *  - ASI feat (kind 'asi'): +2 to one ability OR +1 to two, validated by the
 *    pure isAsiAllocationValid (PHB 2024 "Ability Score Improvement" L8558).
 *  - 'choose-one' (Resilient, +1 max 20) / 'epic-boon' (+1 max 30): a single
 *    ability chooser.
 *  - 'fixed' (Actor +1 Cha): no ability choice — shown read-only.
 *  - grants.skills (Skilled): N skill-proficiency pickers.
 *
 * NO rule is computed here; the ASI shape is validated by isAsiAllocationValid
 * and the caps come from the feat's abilityIncrease.max.
 */
export function FeatAllocationDialog({
  effectiveBefore,
  feat,
  slotLevel,
  onConfirm,
  onCancel,
}: FeatAllocationDialogProps) {
  const inc = feat.abilityIncrease;

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
  // ── Skill grants (Skilled): the chosen skill ids.
  const skillCount = feat.grants?.skills ?? 0;
  const [skills, setSkills] = useState<SkillId[]>([]);

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

  const setSkill = (index: number, id: SkillId | '') => {
    setSkills((prev) => {
      const next = [...prev];
      if (id === '') next.splice(index, 1);
      else next[index] = id;
      return next.filter(Boolean) as SkillId[];
    });
  };

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
  const skillsComplete = skillCount === 0 || skills.filter(Boolean).length === skillCount;
  const abilityComplete = (() => {
    if (!inc) return true;
    if (inc.kind === 'fixed') return true;
    if (inc.kind === 'asi') return asiValidity.valid;
    // choose-one / epic-boon: a single ability under its cap.
    if (chosenAbility === '') return false;
    return effectiveBefore[chosenAbility] + inc.amount <= inc.max;
  })();
  const complete = skillsComplete && abilityComplete;

  const handleConfirm = () => {
    if (!complete) return;
    const selection: FeatSelection = { featId: feat.id, level: slotLevel };
    const increases = buildIncreases();
    if (increases && Object.keys(increases).length > 0) selection.abilityIncreases = increases;
    if (skillCount > 0 && skills.length > 0) selection.choices = { skills };
    onConfirm(selection);
  };

  // Abilities that would exceed the single-ability cap are disabled.
  const abilityOverCap = (ability: Ability, amount: number, max: number) =>
    effectiveBefore[ability] + amount > max;

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

        {/* ── choose-one / epic-boon: a single ability ─────────────────────── */}
        {(inc?.kind === 'choose-one' || inc?.kind === 'epic-boon') && (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>
              Increase one ability by {inc.amount} (max {inc.max})
            </legend>
            <select
              className={styles.select}
              value={chosenAbility}
              aria-label="Ability to increase"
              onChange={(e) => setChosenAbility(e.target.value as Ability | '')}
            >
              <option value="">— Choose an ability —</option>
              {ABILITIES.map((ability) => (
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

        {/* ── Skill grants (Skilled) ───────────────────────────────────────── */}
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
                onChange={(e) => setSkill(i, e.target.value as SkillId | '')}
              >
                <option value="">— Choose a skill —</option>
                {SKILLS.map((s) => (
                  <option
                    key={s.id}
                    value={s.id}
                    disabled={skills.includes(s.id) && skills[i] !== s.id}
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
