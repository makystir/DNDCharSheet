import type { Character, SkillId } from '../../../types/character';
import { SKILLS } from '../../../types/character';
import { expertiseStatus, setSkillExpertise } from '../../../logic/expertise';
import type { ExpertiseStatus } from '../../../logic/expertise';
import { effectiveSkillTraining } from '../../../logic/skills';
import styles from './ExpertisePending.module.css';

export interface ExpertisePendingProps {
  character: Character;
  onChange: (next: Character) => void;
  status?: ExpertiseStatus;
}

/**
 * The Expertise pick in the Advancement "Choices Pending" list. Shown only
 * while picks remain; the skills tab checkbox stays available for manual edits.
 * Counts come from logic/expertise.ts (class features: PHB 2024 Bard, Ranger,
 * Rogue, Wizard). Checking more than are granted is allowed — see
 * {@link ExpertiseOverNote} for the warning.
 */
export function ExpertisePending({ character, onChange, status }: ExpertisePendingProps) {
  const s = status ?? expertiseStatus(character);
  if (s.remaining === 0) return null;

  const sources = s.earned
    .map((e) => (e.grant.count > 1 ? `${e.label} (${e.grant.count})` : e.label))
    .join(', ');
  // Skills worth showing: proficient ones (with or without Expertise yet). If
  // every outstanding grant is restricted (Wizard Scholar) only those skills.
  const choices = SKILLS.filter((skill) => {
    const t = effectiveSkillTraining(character, skill.id);
    if (!t.proficient) return false;
    return s.restrictedTo === undefined || s.restrictedTo.includes(skill.id);
  });

  const toggle = (id: SkillId, value: boolean) => onChange(setSkillExpertise(character, id, value));

  return (
    <li className={styles.item} data-testid="pending-expertise">
      <span>
        Choose {s.remaining} more Expertise skill{s.remaining === 1 ? '' : 's'} ({s.chosen} of{' '}
        {s.owed} chosen) — from {sources}
      </span>
      {choices.length === 0 ? (
        <span className={styles.hint}>
          No eligible skills: Expertise needs a skill you are proficient in.
        </span>
      ) : (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Expertise skills</legend>
          {choices.map((skill) => {
            const t = effectiveSkillTraining(character, skill.id);
            return (
              <label key={skill.id} className={styles.option}>
                <input
                  type="checkbox"
                  checked={t.expertise}
                  onChange={(e) => toggle(skill.id, e.target.checked)}
                />
                {skill.name}
              </label>
            );
          })}
        </fieldset>
      )}
    </li>
  );
}

/** A non-blocking warning when more Expertise is marked than the classes grant. */
export function ExpertiseOverNote({ status }: { status: ExpertiseStatus }) {
  if (status.over === 0) return null;
  return (
    <p className={styles.warning} role="note" data-testid="expertise-over-note">
      Expertise: {status.chosen} skills marked, but your class features grant {status.owed}. Feats,
      subclass features or house rules can account for the difference; otherwise untick the extras
      on Abilities &amp; Skills.
    </p>
  );
}
