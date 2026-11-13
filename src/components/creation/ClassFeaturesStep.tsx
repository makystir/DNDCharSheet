import type { Character, ClassChoiceKey, SkillId } from '../../types/character';
import { SKILLS } from '../../types/character';
import { getClass } from '../../data/classes';
import { allFeats } from '../../data/feats';
import { getWeapon } from '../../data/weapons';
import { applyFightingStyle, characterFeats, removeFeat } from '../../logic/feats';
import { choiceStatus, invocationEligibility, parseInvocationEntry, setClassChoice, toggleClassChoice } from '../../logic/class-choices';
import { choiceOptionViews } from '../../logic/class-choice-options';
import { expertiseStatus, setSkillExpertise } from '../../logic/expertise';
import { effectiveSkillTraining } from '../../logic/skills';
import { chooseWeaponMastery, masteryChoices, masteryEligibleForCharacter } from '../../logic/weapon-mastery';
import { skillsUsingPrimaryAbility } from '../../logic/creation-guidance';
import { creationFeatureNeeds } from '../../logic/creation-features';
import { resolveClassFeatureTooltip, resolveFeatTooltip } from '../../logic/tooltip-content';
import { ContentTooltip, MaybeContentTooltip } from '../shared/ContentTooltip';
import { WeaponMasteryChooser } from '../combat/WeaponMasteryChooser';
import styles from './ClassFeaturesStep.module.css';

export interface ClassFeaturesStepProps {
  classId: string;
  /** The character as the wizard would build it right now (incl. these picks). */
  preview: Character;
  /** The edited preview; the wizard reads the picks back from it. */
  onChange: (next: Character) => void;
}

/** The class feature (from the class data) that grants a pick, for its description and tooltip. */
function FeatureIntro({ classId, featureName, children }: { classId: string; featureName: string; children?: React.ReactNode }) {
  const cls = getClass(classId);
  const feature = cls?.features.find((f) => f.name === featureName && f.level === 1);
  const tip = feature ? resolveClassFeatureTooltip(feature, cls?.name) : null;
  return (
    <div className={styles.intro}>
      <h3 className={styles.sectionTitle}>
        <MaybeContentTooltip content={tip}>{featureName}</MaybeContentTooltip>
      </h3>
      {feature && <p className={styles.featureText}>{feature.effect}</p>}
      {children}
    </div>
  );
}

const CHOICE_FEATURE: Partial<Record<ClassChoiceKey, string>> = {
  'cleric.divineOrder': 'Divine Order',
  'druid.primalOrder': 'Primal Order',
  'warlock.invocations': 'Eldritch Invocations',
};

/**
 * The creation wizard's "Class Features" step: the level 1 picks a class's
 * features ask for, so the character is complete when the wizard ends. Each
 * section opens with the feature's own description (class data), lists every
 * option with its description before anything is picked, and offers a
 * suggestion where the class data gives one (skills that use the class's main
 * ability; weapons in the starting gear). Nothing blocks: unfinished picks
 * still show on the sheet afterwards.
 */
export function ClassFeaturesStep({ classId, preview, onChange }: ClassFeaturesStepProps) {
  const needs = creationFeatureNeeds(classId);
  const className = getClass(classId)?.name ?? classId;

  // ── Fighting Style ────────────────────────────────────────────────────────
  const styleFeats = allFeats().filter((f) => f.category === 'fighting-style');
  const chosenStyle = characterFeats(preview).find((f) => f.grantedBy === classId)?.featId;
  const pickStyle = (featId: string) => onChange(applyFightingStyle(preview, classId, featId, 0));
  const clearStyle = () => chosenStyle && onChange(removeFeat(preview, 0, 0, chosenStyle));

  // ── Class choices (Divine Order, Primal Order, Invocations) ───────────────
  const statuses = choiceStatus(preview).filter((s) => needs.choiceKeys.includes(s.key));

  // ── Expertise ─────────────────────────────────────────────────────────────
  const expertise = expertiseStatus(preview);
  const proficient = SKILLS.filter((s) => effectiveSkillTraining(preview, s.id).proficient);
  const suggestedExpertise = new Set(skillsUsingPrimaryAbility(classId, proficient.map((s) => s.id)));

  // ── Weapon Mastery suggestions: weapons in the starting gear ──────────────
  const mastery = masteryChoices(preview);
  const gearWeapons = [
    ...new Set(
      (preview.inventory ?? [])
        .filter((i) => i.kind === 'weapon' && i.catalogId)
        .map((i) => i.catalogId as string),
    ),
  ].filter((id) => {
    const w = getWeapon(id);
    return w !== undefined && !mastery.chosen.includes(id) && masteryEligibleForCharacter(preview, w);
  });

  return (
    <div className={styles.step} data-testid="class-features-step">
      <p className={styles.hint}>
        At level 1 your {className} features ask you to make a few picks. Each option is explained below; you can change any of
        them later on the Advancement page or on Class &amp; Features.
      </p>

      {needs.fightingStyle && (
        <section className={styles.section} aria-label="Fighting Style" data-testid="features-fighting-style">
          <FeatureIntro classId={classId} featureName="Fighting Style" />
          <p className={styles.count}>{chosenStyle ? '1 of 1 chosen' : 'Choose 1'}</p>
          <ul className={styles.options}>
            {styleFeats.map((feat) => {
              const tip = resolveFeatTooltip(feat.id);
              const checked = chosenStyle === feat.id;
              return (
                <li key={feat.id} className={checked ? `${styles.option} ${styles.optionChosen}` : styles.option}>
                  <label className={styles.optionLabel}>
                    <input
                      type="radio"
                      name="wizard-fighting-style"
                      checked={checked}
                      aria-label={feat.name}
                      onChange={() => pickStyle(feat.id)}
                    />
                    <span className={styles.optionName}>
                      {tip ? <ContentTooltip content={tip}>{feat.name}</ContentTooltip> : feat.name}
                    </span>
                  </label>
                  <p className={styles.optionText}>{feat.effect}</p>
                </li>
              );
            })}
          </ul>
          {chosenStyle && (
            <button type="button" className={styles.linkBtn} onClick={clearStyle}>
              Clear Fighting Style
            </button>
          )}
        </section>
      )}

      {statuses.map((status) => {
        const options = choiceOptionViews(preview, status.key);
        const isInvocation = status.key === 'warlock.invocations';
        const single = status.owed === 1 && !isInvocation;
        const heldBases = status.entries.map((e) => parseInvocationEntry(e).id);
        return (
          <section key={status.key} className={styles.section} aria-label={status.label} data-testid={`features-${status.key}`}>
            <FeatureIntro classId={classId} featureName={CHOICE_FEATURE[status.key] ?? status.label} />
            <p className={styles.count}>
              {status.chosen} of {status.owed} chosen
            </p>
            <ul className={styles.options}>
              {options.map((option) => {
                const checked = status.entries.includes(option.id);
                const eligibility = isInvocation ? invocationEligibility(preview, option.id, heldBases) : { ok: true, reasons: [] };
                const disabled = !checked && !eligibility.ok;
                const toggle = () =>
                  onChange(single ? setClassChoice(preview, status.key, [option.id]) : toggleClassChoice(preview, status.key, option.id));
                return (
                  <li
                    key={option.id}
                    className={`${styles.option}${checked ? ` ${styles.optionChosen}` : ''}${disabled ? ` ${styles.optionDisabled}` : ''}`}
                  >
                    <label className={styles.optionLabel}>
                      <input
                        type={single ? 'radio' : 'checkbox'}
                        name={`wizard-${status.key}`}
                        checked={checked}
                        disabled={disabled}
                        aria-label={option.name}
                        onChange={toggle}
                      />
                      <span className={styles.optionName}>{option.name}</span>
                      {disabled && <span className={styles.reason}>({eligibility.reasons.join('; ')})</span>}
                    </label>
                    <p className={styles.optionText}>{option.summary}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {needs.expertise > 0 && (
        <section className={styles.section} aria-label="Expertise" data-testid="features-expertise">
          <FeatureIntro classId={classId} featureName="Expertise" />
          <p className={styles.count}>
            {expertise.chosen} of {expertise.owed} chosen
          </p>
          {proficient.length === 0 ? (
            <p className={styles.hint}>
              Expertise needs skills you are proficient in. Choose your skills on the Skills step first.
            </p>
          ) : (
            <ul className={styles.options}>
              {proficient.map((skill) => {
                const checked = effectiveSkillTraining(preview, skill.id).expertise;
                return (
                  <li key={skill.id} className={checked ? `${styles.option} ${styles.optionChosen}` : styles.option}>
                    <label className={styles.optionLabel}>
                      <input
                        type="checkbox"
                        checked={checked}
                        aria-label={`${skill.name} Expertise`}
                        onChange={(e) => onChange(setSkillExpertise(preview, skill.id as SkillId, e.target.checked))}
                      />
                      <span className={styles.optionName}>{skill.name}</span>
                      {suggestedExpertise.has(skill.id) && <span className={styles.tag}>Suggested</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {suggestedExpertise.size > 0 && (
            <p className={styles.hint}>
              Suggested skills use your {className}&apos;s main ability, so Expertise in them helps most often.
            </p>
          )}
        </section>
      )}

      {needs.weaponMastery > 0 && (
        <section className={styles.section} aria-label="Weapon Mastery" data-testid="features-weapon-mastery">
          <FeatureIntro classId={classId} featureName="Weapon Mastery" />
          {gearWeapons.length > 0 && mastery.slotsLeft > 0 && (
            <div className={styles.suggest}>
              <span>Suggested: weapons in your starting gear.</span>
              {gearWeapons.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={styles.suggestBtn}
                  onClick={() => {
                    const r = chooseWeaponMastery(preview, id);
                    if (r.ok) onChange(r.character);
                  }}
                >
                  Add {getWeapon(id)?.name ?? id}
                </button>
              ))}
            </div>
          )}
          <WeaponMasteryChooser character={preview} onChange={onChange} />
        </section>
      )}
    </div>
  );
}
