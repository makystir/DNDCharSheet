import type { Ability, Character, SkillId } from '../../types/character';
import { ABILITY_ABBR, ABILITY_NAMES, SKILLS } from '../../types/character';
import { getClass } from '../../data/classes';
import { getBackground } from '../../data/backgrounds';
import type { BackgroundId } from '../../data/backgrounds';
import { getFeat } from '../../data/feats';
import type { SpeciesId } from '../../data/species';
import { speciesGrantedSkills } from '../../logic/skills';
import styles from './CreationWizard.module.css';

export interface SkillsStepProps {
  classId: string;
  backgroundId: BackgroundId | '';
  speciesId: SpeciesId | '';
  /** Species sub-choices picked on the Origin step (e.g. skillfulSkill). */
  speciesChoices: Record<string, string>;
  /** The class skills picked so far. */
  chosen: SkillId[];
  onChange: (next: SkillId[]) => void;
}

const SKILL_NAME = Object.fromEntries(SKILLS.map((s) => [s.id, s.name])) as Record<SkillId, string>;

/**
 * Wizard "Skills" step. PHB 2024 Core <Class> Traits: the class grants two
 * Saving Throw Proficiencies automatically and lets you choose N skills from its
 * list (any skill for the Bard). Nothing here blocks the Next button: unfinished
 * picks are reminded about on the Overview ("Finish setting up").
 *
 * The PHB prints no "pick a different skill if you already have it" rule, only
 * that the Proficiency Bonus is never added twice (L525), so a skill already
 * held from the background or species stays selectable with a quiet note.
 */
export function SkillsStep({
  classId,
  backgroundId,
  speciesId,
  speciesChoices,
  chosen,
  onChange,
}: SkillsStepProps) {
  const cls = getClass(classId);
  const background = getBackground(backgroundId || undefined);
  if (!cls) return <p className={styles.hint}>Choose a class first.</p>;

  const { count, from } = cls.skillChoices;
  const options: SkillId[] = from === 'any' ? SKILLS.map((s) => s.id) : from;
  const atCap = chosen.length >= count;

  // Skills already held from other origin sources, with the source named.
  const held: Partial<Record<SkillId, string>> = {};
  for (const skill of background?.skills ?? []) held[skill] = `${background?.name} background`;
  const speciesSkills = speciesGrantedSkills({
    species: speciesId === '' ? undefined : { id: speciesId, ...speciesChoices },
  } as Character);
  for (const [skill, label] of Object.entries(speciesSkills)) {
    const id = skill as SkillId;
    held[id] = held[id] === undefined ? label : `${held[id]} and ${label}`;
  }

  const toggle = (skill: SkillId, checked: boolean) => {
    if (checked) {
      if (chosen.includes(skill) || atCap) return;
      onChange([...chosen, skill]);
    } else {
      onChange(chosen.filter((s) => s !== skill));
    }
  };

  const feat = background ? getFeat(background.originFeatId) : undefined;
  const savingThrows = cls.savingThrows as Ability[];

  return (
    <>
      <section className={styles.grantedPanel} aria-label="Granted automatically">
        <h3 className={styles.guidanceTitle}>Granted automatically</h3>
        <p className={styles.hint}>You don&apos;t choose these. You are already proficient.</p>
        <ul className={styles.grantedList}>
          <li>
            Saving throws ({cls.name}):{' '}
            {savingThrows.map((a) => ABILITY_NAMES[a]).join(' & ')}
          </li>
          {cls.armorTraining.length > 0 && <li>Armor training: {cls.armorTraining.join(', ')}</li>}
          {cls.weaponProficiencies.length > 0 && (
            <li>Weapons: {cls.weaponProficiencies.join(', ')}</li>
          )}
          {cls.toolProficiencies.length > 0 && <li>Tools: {cls.toolProficiencies.join(', ')}</li>}
          {background && (
            <li>
              Background skills ({background.name}):{' '}
              {background.skills.map((s) => SKILL_NAME[s]).join(' & ')}
            </li>
          )}
          {background && feat && <li>Origin feat: {feat.name}</li>}
          {Object.entries(speciesSkills).map(([skill, label]) => (
            <li key={skill}>
              Species skill ({label}): {SKILL_NAME[skill as SkillId]}
            </li>
          ))}
        </ul>
      </section>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldLabel}>
          Choose {count} class skill{count === 1 ? '' : 's'}
          {from === 'any' ? ' (any skill)' : ''}
        </legend>
        <p className={styles.hint} role="status" data-testid="skills-counter">
          {chosen.length} of {count} chosen
        </p>
        {chosen.length < count && (
          <p className={styles.hint} role="note">
            You can finish this later: the Overview will remind you.
          </p>
        )}
        <div className={styles.skillGrid}>
          {options.map((skill) => {
            const selected = chosen.includes(skill);
            const abilityAbbr = ABILITY_ABBR[SKILLS.find((s) => s.id === skill)!.ability];
            const source = held[skill];
            return (
              <div key={skill} className={styles.skillCell}>
                <label className={styles.skillRow}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={!selected && atCap}
                    aria-label={SKILL_NAME[skill]}
                    onChange={(e) => toggle(skill, e.target.checked)}
                  />
                  {SKILL_NAME[skill]} <span className={styles.skillAbility}>({abilityAbbr})</span>
                </label>
                {source !== undefined && (
                  <span className={styles.skillNote}>
                    already proficient from {source}: this adds nothing (Proficiency Bonus isn&apos;t
                    added twice)
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}
