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
import {
  darkvisionBreakdown,
  resolveSize,
  resolveSpecies,
  speciesTraits,
  speedBreakdown,
} from '../../logic/species';
import {
  SPECIES_LIST,
  getSpecies,
} from '../../data/species';
import type {
  SpeciesChoiceOption,
  SpeciesChoiceSpec,
  SpeciesData,
} from '../../data/species';
import type { SpeciesSelection } from '../../types/character';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './CharacterSheet.module.css';

/** Human-readable size labels. */
const SIZE_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
};

/**
 * The options a sub-choice presents. Human's Skillful choice has empty data
 * options (any skill), so its list is filled from the SKILLS table here, keeping
 * the data module choice-spec free of the full skill list.
 */
function choiceOptions(spec: SpeciesChoiceSpec): SpeciesChoiceOption[] {
  if (spec.kind === 'skillfulSkill') {
    return SKILLS.map((s) => ({ id: s.id as string, label: s.name }));
  }
  return spec.options;
}

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

  // Selecting a species starts a fresh selection (dropping stale sub-choices
  // from a previous species); the empty value clears the species entirely.
  const setSpecies = (raw: string) => {
    if (raw === '' || getSpecies(raw) === undefined) {
      const next = { ...character };
      delete next.species;
      onChange(next);
      return;
    }
    onChange({ ...character, species: { id: raw as SpeciesSelection['id'] } });
  };

  // Writes a single sub-choice field; an empty value unsets that field.
  const setSpeciesChoice = (field: SpeciesChoiceSpec['field'], raw: string) => {
    if (character.species === undefined) return;
    const next: SpeciesSelection = { ...character.species };
    if (raw === '') {
      delete next[field];
    } else {
      // The field/value pairing is constrained by the choice spec; the union
      // over SpeciesSelection fields is widened here to a single assignment.
      (next as unknown as Record<string, unknown>)[field] = raw;
    }
    onChange({ ...character, species: next });
  };

  const selectedSpecies: SpeciesData | undefined = resolveSpecies(character);
  const speedBd = speedBreakdown(character);
  const darkvisionBd = darkvisionBreakdown(character);
  const size = resolveSize(character);
  const traits = speciesTraits(character);
  const hpPerLevel = selectedSpecies?.traits.find((t) => t.mechanics?.hpPerLevel)
    ?.mechanics?.hpPerLevel;

  const profBreakdown = proficiencyBonusBreakdown(character.level);
  const acBreakdown = armorClassBreakdown(character.abilities, character.acOverride);
  const initBreakdown = initiativeBreakdown(character.abilities, character.initiativeBonus);
  const ppBreakdown = passivePerceptionBreakdown(character);
  const hpBreakdown = hitPointMaxBreakdown(
    character.abilities,
    character.level,
    character.hpMax,
    hpPerLevel,
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

      <section aria-labelledby="species-heading">
        <h2 id="species-heading" className={styles.sectionTitle}>
          Species
        </h2>
        <div className={styles.speciesGrid}>
          <div className={styles.speciesField}>
            <label className={styles.fieldLabel} htmlFor="species-select">
              Species
            </label>
            <select
              id="species-select"
              className={styles.speciesSelect}
              value={character.species?.id ?? ''}
              aria-label="Species"
              onChange={(e) => setSpecies(e.target.value)}
            >
              <option value="">— None —</option>
              {SPECIES_LIST.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {selectedSpecies && (
              <span
                className={styles.srdBadge}
                title={
                  selectedSpecies.srd === 'non-srd'
                    ? 'Not confirmed as SRD content — review licensing before redistributing.'
                    : 'SRD status unconfirmed — review licensing before redistributing.'
                }
              >
                {selectedSpecies.srd === 'non-srd'
                  ? 'non-SRD'
                  : 'SRD status unconfirmed'}
              </span>
            )}
          </div>

          {selectedSpecies?.choices?.map((spec) => {
            const value =
              (character.species?.[spec.field] as string | undefined) ?? '';
            const options = choiceOptions(spec);
            const selectId = `species-choice-${spec.field}`;
            return (
              <div key={spec.field} className={styles.speciesField}>
                <label className={styles.fieldLabel} htmlFor={selectId}>
                  {spec.label}
                </label>
                <select
                  id={selectId}
                  className={styles.speciesSelect}
                  value={value}
                  aria-label={spec.label}
                  onChange={(e) => setSpeciesChoice(spec.field, e.target.value)}
                >
                  <option value="">choose…</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                      {o.note ? ` (${o.note})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          <div className={styles.speciesField}>
            <span className={styles.fieldLabel}>Size</span>
            <span className={styles.speciesText}>
              {size ? SIZE_LABELS[size] : '—'}
            </span>
          </div>

          <div className={styles.speciesField}>
            <span className={styles.fieldLabel}>Languages</span>
            <span className={styles.speciesText}>
              Common + 2 chosen
              <span className={styles.speciesNote}> (from character creation)</span>
            </span>
          </div>
        </div>

        {traits.length > 0 && (
          <ul className={styles.traitList} aria-label="Species Traits">
            {traits.map((trait) => (
              <li key={trait.name} className={styles.traitRow}>
                <span className={styles.traitName}>{trait.name}</span>
                <span className={styles.traitEffect}>{trait.effect}</span>
                <span className={styles.traitSource}>source: {trait.source}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="derived-heading">
        <h2 id="derived-heading" className={styles.sectionTitle}>
          Core Stats
        </h2>
        <div className={styles.derivedGrid}>
          <div className={styles.derivedCard}>
            <span className={styles.fieldLabel}>Speed</span>
            <span className={styles.derivedValue}>
              <CalculatedValue label="Speed" breakdown={speedBd}>
                {speedBd.total} ft
              </CalculatedValue>
            </span>
          </div>

          <div className={styles.derivedCard}>
            <span className={styles.fieldLabel}>Darkvision</span>
            <span className={styles.derivedValue}>
              <CalculatedValue label="Darkvision" breakdown={darkvisionBd}>
                {darkvisionBd.total > 0 ? `${darkvisionBd.total} ft` : 'none'}
              </CalculatedValue>
            </span>
          </div>

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
