import { ListChecks } from 'lucide-react';
import type { Character } from '../../../types/character';
import { ABILITIES, ABILITY_ABBR, ABILITY_NAMES, SKILLS } from '../../../types/character';
import { formatSigned } from '../../../logic/breakdown';
import { allSkillBreakdowns, getSkillTraining } from '../../../logic/skills';
import { allSavingThrowBreakdowns } from '../../../logic/saving-throws';
import { Card } from '../../shared/Card';
import { CalculatedValue } from '../../shared/CalculatedValue';
import { CollapsibleSection } from '../../shared/CollapsibleSection';
import { SectionHeader } from '../../shared/SectionHeader';
import styles from './OverviewSkills.module.css';

export interface OverviewSkillsProps {
  character: Character;
}

/**
 * Read-only mirror of the saving throws and skills. Every modifier comes from
 * allSavingThrowBreakdowns / allSkillBreakdowns (the same functions the
 * Abilities & Skills tab uses) and keeps its breakdown tooltip. Proficiency and
 * expertise are edited only on Abilities & Skills, so this card just links there.
 * Proficiency is shown with a text marker (P / E) plus an aria-label, never
 * colour alone.
 */
export function OverviewSkills({ character }: OverviewSkillsProps) {
  const skillBreakdowns = allSkillBreakdowns(character);
  const saveBreakdowns = allSavingThrowBreakdowns(character);
  // Alphabetical, as printed on the sheet.
  const skills = [...SKILLS].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card>
      <SectionHeader icon={ListChecks} title="Skills & Saves" />
      <CollapsibleSection title="Saves and skills" storageKey="dnd-collapse-overview-skills">
        <ul className={styles.saves} aria-label="Saving throws">
          {ABILITIES.map((ability) => {
            const breakdown = saveBreakdowns[ability];
            const proficient = character.saveProficiencies?.[ability] ?? false;
            return (
              <li
                key={ability}
                className={`${styles.chip} ${proficient ? styles.trained : ''}`}
                data-testid={`overview-save-${ability}`}
              >
                <span className={styles.chipName}>{ABILITY_ABBR[ability]}</span>
                <CalculatedValue label={`${ABILITY_NAMES[ability]} Save`} breakdown={breakdown}>
                  {formatSigned(breakdown.total)}
                </CalculatedValue>
                {proficient && (
                  <span className={styles.marker} role="img" aria-label="proficient" title="Proficient">
                    P
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <ul className={styles.skills} aria-label="Skills">
          {skills.map((skill) => {
            const breakdown = skillBreakdowns[skill.id];
            const training = getSkillTraining(character, skill.id);
            const proficient = training.proficient ?? false;
            const expertise = proficient && (training.expertise ?? false);
            const status = expertise ? 'expertise' : proficient ? 'proficient' : '';
            return (
              <li
                key={skill.id}
                className={`${styles.row} ${proficient ? styles.trained : ''}`}
                data-testid={`overview-skill-${skill.id}`}
              >
                <span className={styles.name}>
                  {skill.name}
                  <span className={styles.ability}> ({ABILITY_ABBR[skill.ability]})</span>
                </span>
                {status && (
                  <span className={styles.marker} role="img" aria-label={status} title={status}>
                    {expertise ? 'E' : 'P'}
                  </span>
                )}
                <span className={styles.value}>
                  <CalculatedValue label={`${skill.name} Check`} breakdown={breakdown}>
                    {formatSigned(breakdown.total)}
                  </CalculatedValue>
                </span>
              </li>
            );
          })}
        </ul>
        <p className={styles.legend}>P = proficient, E = expertise</p>
        <a className={styles.manage} href="#character/abilities">
          Edit proficiencies on Abilities &amp; Skills
        </a>
      </CollapsibleSection>
    </Card>
  );
}
