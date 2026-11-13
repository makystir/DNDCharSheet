import { useId, useState } from 'react';
import { ListChecks, Pencil, Check } from 'lucide-react';
import type { Ability, Character, SkillId, SkillTraining } from '../../../types/character';
import { ABILITIES, ABILITY_ABBR, ABILITY_NAMES, SKILLS } from '../../../types/character';
import { abilityModifierBreakdown, clampAbilityScore } from '../../../logic/abilities';
import { formatSigned } from '../../../logic/breakdown';
import { abilityScoreBreakdown, effectiveAbilityScores } from '../../../logic/feats';
import { allSkillBreakdowns, effectiveSkillTraining, getSkillTraining } from '../../../logic/skills';
import { allSavingThrowBreakdowns, savingThrowProficiency } from '../../../logic/saving-throws';
import { resolveAbilityTooltip, resolveSaveTooltip, resolveSkillTooltip } from '../../../logic/tooltip-content';
import { usePersistedExpanded } from '../../../hooks/usePersistedExpanded';
import { Card } from '../../shared/Card';
import { CalculatedValue } from '../../shared/CalculatedValue';
import { SectionHeader } from '../../shared/SectionHeader';
import { MaybeContentTooltip } from '../../shared/ContentTooltip';
import styles from './OverviewAbilities.module.css';

export interface OverviewAbilitiesProps {
  character: Character;
  onChange: (next: Character) => void;
}

/**
 * The Overview's "Abilities, Saves & Skills" card: the six ability scores, the
 * six saving throws and all 18 skills, in one place. It reads as a clean,
 * read-only glance (P / E markers for proficiency and expertise, every number a
 * CalculatedValue with its breakdown). The Edit toggle in its header reveals the
 * editors in place: each ability's BASE score (feat increases stay separate and
 * shown in the score's breakdown, PHB 2024 "Ability Score Improvement"), the
 * save proficiency ticks (class-granted saves locked, PHB Core <Class> Traits)
 * and the skill Prof / Exp ticks (class-, species- and feat-granted skills
 * locked). This replaces the separate Abilities & Skills tab, which showed the
 * same saves and skills a second time.
 *
 * Every modifier comes from allSavingThrowBreakdowns / allSkillBreakdowns /
 * abilityModifierBreakdown; no rule is computed here.
 */
export function OverviewAbilities({ character, onChange }: OverviewAbilitiesProps) {
  const [expanded, toggle] = usePersistedExpanded('dnd-collapse-overview-skills');
  const [editing, setEditing] = useState(false);
  const titleId = useId();
  const effective = effectiveAbilityScores(character);
  const skillBreakdowns = allSkillBreakdowns(character);
  const saveBreakdowns = allSavingThrowBreakdowns(character);
  // Alphabetical, as printed on the sheet.
  const skills = [...SKILLS].sort((a, b) => a.name.localeCompare(b.name));

  const setScore = (ability: Ability, raw: string) => {
    const score = clampAbilityScore(Number.parseInt(raw, 10));
    onChange({ ...character, abilities: { ...character.abilities, [ability]: score } });
  };
  const setSaveProficiency = (ability: Ability, proficient: boolean) =>
    onChange({ ...character, saveProficiencies: { ...character.saveProficiencies, [ability]: proficient } });
  const setSkill = (id: SkillId, patch: Partial<SkillTraining>) => {
    const current = getSkillTraining(character, id);
    onChange({ ...character, skills: { ...character.skills, [id]: { ...current, ...patch } } });
  };

  const editButton = (
    <button
      type="button"
      className={styles.editBtn}
      aria-pressed={editing}
      onClick={() => {
        if (!expanded) toggle();
        setEditing((e) => !e);
      }}
    >
      {editing ? <Check size={14} aria-hidden="true" /> : <Pencil size={14} aria-hidden="true" />}
      {editing ? 'Done' : 'Edit'}
    </button>
  );

  return (
    <Card>
      <SectionHeader
        icon={ListChecks}
        title="Abilities, Saves & Skills"
        titleId={titleId}
        collapsible
        collapsed={!expanded}
        onToggleCollapse={toggle}
        action={editButton}
      />
      <div className={styles.body} role="region" aria-labelledby={titleId} hidden={!expanded}>
        {editing && (
          <p className={styles.editHint}>
            Change your base ability scores and tick proficiencies here. Feat increases are added on
            top automatically; class, species and feat grants are locked.
          </p>
        )}

        <ul className={styles.abilities} aria-label="Ability scores" data-testid="overview-abilities-grid">
          {ABILITIES.map((ability) => {
            const baseScore = character.abilities[ability];
            const effectiveScore = effective[ability];
            const modBreakdown = abilityModifierBreakdown(ability, effectiveScore);
            return (
              <li key={ability} className={styles.abilityTile} data-testid={`overview-ability-${ability}`}>
                <span className={styles.abilityName}>
                  <MaybeContentTooltip content={resolveAbilityTooltip(ability)} ariaLabel={`About ${ABILITY_NAMES[ability]}`}>
                    {ABILITY_ABBR[ability]}
                  </MaybeContentTooltip>
                </span>
                <span className={styles.abilityMod}>
                  <CalculatedValue label={`${ABILITY_NAMES[ability]} Modifier`} breakdown={modBreakdown}>
                    {formatSigned(modBreakdown.total)}
                  </CalculatedValue>
                </span>
                <span className={styles.abilityScore}>
                  <CalculatedValue label={`${ABILITY_NAMES[ability]} Score`} breakdown={abilityScoreBreakdown(character, ability)}>
                    {effectiveScore}
                  </CalculatedValue>
                </span>
                {editing && (
                  <label className={styles.baseField}>
                    <span className={styles.baseLabel}>{effectiveScore !== baseScore ? 'Base' : 'Score'}</span>
                    <input
                      className={styles.baseInput}
                      type="number"
                      min={1}
                      max={30}
                      value={baseScore}
                      // WCAG 2.5.3 (Label in Name): the name contains the visible label.
                      aria-label={`${ABILITY_NAMES[ability]} ${effectiveScore !== baseScore ? 'base ' : ''}score`}
                      onChange={(e) => setScore(ability, e.target.value)}
                    />
                  </label>
                )}
              </li>
            );
          })}
        </ul>

        <h4 className={styles.subheading}>Saving throws</h4>
        <ul className={styles.saves} aria-label="Saving throws" data-testid="overview-saves-grid">
          {ABILITIES.map((ability) => {
            const breakdown = saveBreakdowns[ability];
            const prof = savingThrowProficiency(character, ability);
            const locked = prof.source === 'class';
            const sourceText =
              prof.source === 'class' ? `from ${prof.classLabel} (class)` : prof.source === 'feat' ? 'from Resilient (feat)' : '';
            return (
              <li
                key={ability}
                className={`${styles.chip} ${prof.proficient ? styles.trained : ''}`}
                data-testid={`overview-save-${ability}`}
              >
                <span className={styles.chipName}>
                  <MaybeContentTooltip
                    content={resolveSaveTooltip(ability, character)}
                    ariaLabel={`About ${ABILITY_NAMES[ability]} saving throw`}
                  >
                    {ABILITY_ABBR[ability]}
                  </MaybeContentTooltip>
                </span>
                <CalculatedValue label={`${ABILITY_NAMES[ability]} Save`} breakdown={breakdown}>
                  {formatSigned(breakdown.total)}
                </CalculatedValue>
                {editing ? (
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={prof.proficient}
                    disabled={locked}
                    title={sourceText || 'Proficient'}
                    aria-label={`${ABILITY_NAMES[ability]} save proficiency`}
                    onChange={(e) => setSaveProficiency(ability, e.target.checked)}
                  />
                ) : (
                  <span className={styles.markerSlot}>
                    {prof.proficient && (
                      <span className={styles.marker} role="img" aria-label="proficient" title={sourceText || 'Proficient'}>
                        P
                      </span>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <h4 className={styles.subheading}>Skills</h4>
        <ul className={styles.skills} aria-label="Skills">
          {skills.map((skill) => {
            const breakdown = skillBreakdowns[skill.id];
            const training = effectiveSkillTraining(character, skill.id);
            const { proficient, expertise } = training;
            const granted = training.source === 'class' || training.source === 'species' || training.source === 'feat';
            const status = expertise ? 'expertise' : proficient ? 'proficient' : '';
            return (
              <li
                key={skill.id}
                className={`${styles.row} ${proficient ? styles.trained : ''}`}
                data-testid={`overview-skill-${skill.id}`}
              >
                <span className={styles.name}>
                  <MaybeContentTooltip content={resolveSkillTooltip(skill.id, character)} ariaLabel={`About ${skill.name}`}>
                    {skill.name}
                  </MaybeContentTooltip>
                  <span className={styles.ability}> ({ABILITY_ABBR[skill.ability]})</span>
                  {editing && granted && <span className={styles.source}>from {training.sourceLabel}</span>}
                </span>
                {editing ? (
                  <span className={styles.ticks}>
                    <label className={styles.tick} title="Proficient">
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={proficient}
                        disabled={granted}
                        aria-label={`${skill.name} proficiency`}
                        onChange={(e) => setSkill(skill.id, { proficient: e.target.checked })}
                      />
                      P
                    </label>
                    <label className={styles.tick} title="Expertise">
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={expertise}
                        disabled={!proficient}
                        aria-label={`${skill.name} expertise`}
                        onChange={(e) => setSkill(skill.id, { expertise: e.target.checked })}
                      />
                      E
                    </label>
                  </span>
                ) : (
                  <span className={styles.markerSlot}>
                    {status && (
                      <span className={styles.marker} role="img" aria-label={status} title={status}>
                        {expertise ? 'E' : 'P'}
                      </span>
                    )}
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
        <p className={styles.legend}>P = proficient, E = expertise. Use Edit to change them.</p>
      </div>
    </Card>
  );
}
