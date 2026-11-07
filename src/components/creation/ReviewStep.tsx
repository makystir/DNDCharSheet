import type { Character, SpellcastingState } from '../../types/character';
import { ABILITIES, ABILITY_NAMES, SKILLS } from '../../types/character';
import { getClass } from '../../data/classes';
import { getSpecies } from '../../data/species';
import { getBackground } from '../../data/backgrounds';
import { getSpell } from '../../data/spells';
import type { SpellId } from '../../data/spells';
import { primaryClass } from '../../logic/classes';
import { abilityModifier } from '../../logic/abilities';
import { formatSigned, type Breakdown } from '../../logic/breakdown';
import { abilityScoreBreakdown, effectiveAbilityScores } from '../../logic/feats';
import { savingThrowProficiency } from '../../logic/saving-throws';
import { effectiveSkillTraining } from '../../logic/skills';
import { pendingSetupChoices } from '../../logic/starting-choices';
import type { PendingItem } from '../../logic/starting-choices';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './CreationWizard.module.css';

export interface ReviewStepProps {
  /** The character as it would be created if the player pressed Finish now. */
  character: Character;
}

const PENDING_LABEL: Record<PendingItem['kind'], string> = {
  'class-skills': 'class skills',
  cantrips: 'cantrips',
  spellbook: 'spellbook spells',
  prepared: 'prepared spells',
};

const spellNames = (ids: SpellId[] | undefined): string =>
  (ids ?? []).map((id) => getSpell(id)?.name ?? id).join(', ');

/**
 * Wizard "Review" step: a read-only summary of everything chosen so far, plus
 * the "Still open" list from pendingSetupChoices. Finish lives in the wizard
 * footer on this step. Nothing here blocks Finish.
 */
export function ReviewStep({ character }: ReviewStepProps) {
  const cls = getClass(primaryClass(character)?.id);
  const species = getSpecies(character.species?.id);
  const background = getBackground(character.backgroundSelection?.id);
  const scores = effectiveAbilityScores(character);
  const pending = pendingSetupChoices(character);

  const savingThrows = ABILITIES.filter((a) => savingThrowProficiency(character, a).proficient);
  const skills = SKILLS.map((s) => ({ skill: s, training: effectiveSkillTraining(character, s.id) })).filter(
    (r) => r.training.proficient,
  );

  const sc: SpellcastingState = character.spellcasting ?? {};
  const spells = cls ? sc.byClass?.[cls.id as keyof NonNullable<SpellcastingState['byClass']>] : undefined;
  const spellGroups: { label: string; ids: SpellId[] | undefined }[] = [
    { label: 'Cantrips', ids: spells?.cantrips },
    { label: 'Spellbook', ids: spells?.spellbook },
    { label: 'Prepared', ids: spells?.prepared },
  ].filter((g) => (g.ids ?? []).length > 0);

  return (
    <div className={styles.grantedPanel} aria-label="Character summary">
      <h3 className={styles.guidanceTitle}>{character.name || 'Unnamed character'}</h3>
      <p className={styles.hint}>
        {[species?.name, cls?.name, background ? `${background.name} background` : undefined]
          .filter(Boolean)
          .join(' · ')}
      </p>

      <h3 className={styles.guidanceTitle}>Ability scores</h3>
      <ul className={styles.grantedList} aria-label="Ability scores">
        {ABILITIES.map((ability) => {
          const mod = abilityModifier(scores[ability]);
          const modBreakdown: Breakdown = {
            total: mod,
            components: [{ label: 'From score', value: mod }],
            note: `Score ${scores[ability]}`,
          };
          return (
            <li key={ability}>
              {ABILITY_NAMES[ability]}{' '}
              <CalculatedValue
                label={`${ABILITY_NAMES[ability]} Score`}
                breakdown={abilityScoreBreakdown(character, ability)}
              >
                {scores[ability]}
              </CalculatedValue>{' '}
              (
              <CalculatedValue label={`${ABILITY_NAMES[ability]} Modifier`} breakdown={modBreakdown}>
                {formatSigned(mod)}
              </CalculatedValue>
              )
            </li>
          );
        })}
      </ul>

      <h3 className={styles.guidanceTitle}>Saving throw proficiencies</h3>
      <p className={styles.hint} data-testid="review-saves">
        {savingThrows.length > 0 ? savingThrows.map((a) => ABILITY_NAMES[a]).join(' & ') : 'None'}
      </p>

      <h3 className={styles.guidanceTitle}>Skill proficiencies</h3>
      <ul className={styles.grantedList} aria-label="Skill proficiencies">
        {skills.length === 0 && <li>None</li>}
        {skills.map(({ skill, training }) => (
          <li key={skill.id}>
            {skill.name}
            {training.sourceLabel ? ` (${training.sourceLabel})` : ''}
          </li>
        ))}
      </ul>

      {spellGroups.length > 0 && (
        <>
          <h3 className={styles.guidanceTitle}>Spells</h3>
          <ul className={styles.grantedList} aria-label="Spells chosen">
            {spellGroups.map((g) => (
              <li key={g.label}>
                {g.label}: {spellNames(g.ids)}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className={styles.guidanceTitle}>Still open</h3>
      {pending.length === 0 ? (
        <p className={styles.hint} data-testid="review-open">
          Everything is set.
        </p>
      ) : (
        <div data-testid="review-open">
          <ul className={styles.grantedList} aria-label="Still open">
            {pending.map((item) => (
              <li key={`${item.kind}-${item.classId ?? ''}`}>
                {item.className ? `${item.className}: ` : ''}
                {PENDING_LABEL[item.kind]}: {item.have} of {item.need}
              </li>
            ))}
          </ul>
          <p className={styles.hint}>You can finish these any time — the Overview will remind you.</p>
        </div>
      )}
    </div>
  );
}
