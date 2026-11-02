import type {
  Character,
  Ability,
  SkillId,
  SkillTraining,
} from '../../types/character';
import {
  ABILITIES,
  ABILITY_ABBR,
  ABILITY_NAMES,
  SKILLS,
} from '../../types/character';
import {
  abilityModifierBreakdown,
  proficiencyBonusBreakdown,
  clampAbilityScore,
  clampLevel,
} from '../../logic/abilities';
import { formatSigned } from '../../logic/breakdown';
import { armorClassBreakdown } from '../../logic/armor-class';
import { hitPointMaxBreakdown } from '../../logic/hit-points';
import { initiativeBreakdown } from '../../logic/initiative';
import { passivePerceptionBreakdown } from '../../logic/passive-checks';
import { allSavingThrowBreakdowns } from '../../logic/saving-throws';
import { allSkillBreakdowns, getSkillTraining } from '../../logic/skills';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './CharacterSheet.module.css';

export interface CharacterSheetProps {
  character: Character;
  onChange: (next: Character) => void;
}

/**
 * Parses a numeric input's raw string into a stored value. Empty input and
 * non-finite values become `undefined` (unset) so the breakdown is never
 * poisoned with NaN; otherwise the integer is optionally clamped to >= 0.
 */
function parseNumberInput(raw: string, clampNonNegative: boolean): number | undefined {
  if (raw.trim() === '') return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return clampNonNegative ? Math.max(0, parsed) : parsed;
}

/**
 * The core character sheet. Surfaces identity, the six ability scores with
 * derived modifiers, the Proficiency Bonus, and the Stage-2 derived stats
 * (AC, Initiative, Passive Perception, HP max, saving throws, skills) — every
 * derived number shown through a CalculatedValue so its breakdown is visible
 * on hover/tap (calculated-totals steering).
 */
export function CharacterSheet({ character, onChange }: CharacterSheetProps) {
  const setName = (name: string) => onChange({ ...character, name });

  const setLevel = (raw: string) => {
    const level = clampLevel(Number.parseInt(raw, 10));
    onChange({ ...character, level });
  };

  const setScore = (ability: Ability, raw: string) => {
    const score = clampAbilityScore(Number.parseInt(raw, 10));
    onChange({
      ...character,
      abilities: { ...character.abilities, [ability]: score },
    });
  };

  const setSkill = (id: SkillId, patch: Partial<SkillTraining>) => {
    const current = getSkillTraining(character, id);
    onChange({
      ...character,
      skills: { ...character.skills, [id]: { ...current, ...patch } },
    });
  };

  const setSaveProficiency = (ability: Ability, proficient: boolean) => {
    onChange({
      ...character,
      saveProficiencies: { ...character.saveProficiencies, [ability]: proficient },
    });
  };

  const setAcOverride = (raw: string) =>
    onChange({ ...character, acOverride: parseNumberInput(raw, true) });

  const setHpMax = (raw: string) =>
    onChange({ ...character, hpMax: parseNumberInput(raw, true) });

  const setInitiativeBonus = (raw: string) =>
    onChange({ ...character, initiativeBonus: parseNumberInput(raw, false) });

  const profBreakdown = proficiencyBonusBreakdown(character.level);
  const acBreakdown = armorClassBreakdown(character.abilities, character.acOverride);
  const initBreakdown = initiativeBreakdown(character.abilities, character.initiativeBonus);
  const ppBreakdown = passivePerceptionBreakdown(character);
  const hpBreakdown = hitPointMaxBreakdown(
    character.abilities,
    character.level,
    character.hpMax,
  );
  const saveBreakdowns = allSavingThrowBreakdowns(character);
  const skillBreakdowns = allSkillBreakdowns(character);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <input
          className={styles.nameInput}
          type="text"
          value={character.name}
          placeholder="Unnamed Adventurer"
          aria-label="Character name"
          onChange={(e) => setName(e.target.value)}
        />

        <div className={styles.levelField}>
          <label className={styles.fieldLabel} htmlFor="char-level">
            Level
          </label>
          <input
            id="char-level"
            className={styles.levelInput}
            type="number"
            min={1}
            max={20}
            value={character.level}
            onChange={(e) => setLevel(e.target.value)}
          />
        </div>

        <div className={styles.profField}>
          <span className={styles.fieldLabel}>Proficiency Bonus</span>
          <span className={styles.profValue}>
            <CalculatedValue label="Proficiency Bonus" breakdown={profBreakdown}>
              {formatSigned(profBreakdown.total)}
            </CalculatedValue>
          </span>
        </div>
      </header>

      <section aria-labelledby="abilities-heading">
        <h2 id="abilities-heading" className={styles.sectionTitle}>
          Ability Scores
        </h2>
        <div className={styles.abilityGrid}>
          {ABILITIES.map((ability) => {
            const score = character.abilities[ability];
            const modBreakdown = abilityModifierBreakdown(ability, score);
            return (
              <div key={ability} className={styles.abilityCard}>
                <span className={styles.abilityName} title={ABILITY_NAMES[ability]}>
                  {ABILITY_ABBR[ability]}
                </span>
                <span className={styles.abilityMod}>
                  <CalculatedValue
                    label={`${ABILITY_NAMES[ability]} Modifier`}
                    breakdown={modBreakdown}
                  >
                    {formatSigned(modBreakdown.total)}
                  </CalculatedValue>
                </span>
                <input
                  className={styles.abilityScore}
                  type="number"
                  min={1}
                  max={30}
                  value={score}
                  aria-label={`${ABILITY_NAMES[ability]} score`}
                  onChange={(e) => setScore(ability, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="derived-heading">
        <h2 id="derived-heading" className={styles.sectionTitle}>
          Core Stats
        </h2>
        <div className={styles.derivedGrid}>
          <div className={styles.derivedCard}>
            <span className={styles.fieldLabel}>Armor Class</span>
            <span className={styles.derivedValue}>
              <CalculatedValue label="Armor Class" breakdown={acBreakdown} />
            </span>
            <label className={styles.derivedInputLabel} htmlFor="ac-override">
              Override
            </label>
            <input
              id="ac-override"
              className={styles.derivedInput}
              type="number"
              min={0}
              value={character.acOverride ?? ''}
              placeholder="auto"
              aria-label="Armor Class override"
              onChange={(e) => setAcOverride(e.target.value)}
            />
          </div>

          <div className={styles.derivedCard}>
            <span className={styles.fieldLabel}>Initiative</span>
            <span className={styles.derivedValue}>
              <CalculatedValue label="Initiative" breakdown={initBreakdown}>
                {formatSigned(initBreakdown.total)}
              </CalculatedValue>
            </span>
            <label className={styles.derivedInputLabel} htmlFor="init-bonus">
              Bonus
            </label>
            <input
              id="init-bonus"
              className={styles.derivedInput}
              type="number"
              value={character.initiativeBonus ?? ''}
              placeholder="0"
              aria-label="Initiative bonus"
              onChange={(e) => setInitiativeBonus(e.target.value)}
            />
          </div>

          <div className={styles.derivedCard}>
            <span className={styles.fieldLabel}>Passive Perception</span>
            <span className={styles.derivedValue}>
              <CalculatedValue
                label="Passive Perception"
                breakdown={ppBreakdown}
              />
            </span>
          </div>

          <div className={styles.derivedCard}>
            <span className={styles.fieldLabel}>Hit Point Maximum</span>
            <span className={styles.derivedValue}>
              <CalculatedValue label="Hit Point Maximum" breakdown={hpBreakdown} />
            </span>
            <label className={styles.derivedInputLabel} htmlFor="hp-max">
              HP max
            </label>
            <input
              id="hp-max"
              className={styles.derivedInput}
              type="number"
              min={0}
              value={character.hpMax ?? ''}
              placeholder="set"
              aria-label="Hit Point maximum"
              onChange={(e) => setHpMax(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="saves-heading">
        <h2 id="saves-heading" className={styles.sectionTitle}>
          Saving Throws
        </h2>
        <ul className={styles.statList}>
          {ABILITIES.map((ability) => {
            const breakdown = saveBreakdowns[ability];
            const proficient = character.saveProficiencies?.[ability] ?? false;
            return (
              <li key={ability} className={styles.statRow}>
                <span className={styles.statName}>{ABILITY_NAMES[ability]}</span>
                <label className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={proficient}
                    aria-label={`${ABILITY_NAMES[ability]} save proficiency`}
                    onChange={(e) => setSaveProficiency(ability, e.target.checked)}
                  />
                  <span className={styles.checkboxText}>Prof</span>
                </label>
                <span className={styles.statValue}>
                  <CalculatedValue
                    label={`${ABILITY_NAMES[ability]} Save`}
                    breakdown={breakdown}
                  >
                    {formatSigned(breakdown.total)}
                  </CalculatedValue>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="skills-heading">
        <h2 id="skills-heading" className={styles.sectionTitle}>
          Skills
        </h2>
        <ul className={styles.statList}>
          {SKILLS.map((skill) => {
            const breakdown = skillBreakdowns[skill.id];
            const training = getSkillTraining(character, skill.id);
            const proficient = training.proficient ?? false;
            const expertise = training.expertise ?? false;
            return (
              <li key={skill.id} className={styles.statRow}>
                <span className={styles.statName}>
                  {skill.name}{' '}
                  <span className={styles.statAbility}>
                    ({ABILITY_ABBR[skill.ability]})
                  </span>
                </span>
                <label className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={proficient}
                    aria-label={`${skill.name} proficiency`}
                    onChange={(e) => setSkill(skill.id, { proficient: e.target.checked })}
                  />
                  <span className={styles.checkboxText}>Prof</span>
                </label>
                <label className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={expertise}
                    disabled={!proficient}
                    aria-label={`${skill.name} expertise`}
                    onChange={(e) => setSkill(skill.id, { expertise: e.target.checked })}
                  />
                  <span className={styles.checkboxText}>Exp</span>
                </label>
                <span className={styles.statValue}>
                  <CalculatedValue label={`${skill.name} Check`} breakdown={breakdown}>
                    {formatSigned(breakdown.total)}
                  </CalculatedValue>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
