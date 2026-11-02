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
import {
  resolveClass,
  resolveSubclass,
  classProficiencies,
  classFeaturesByLevel,
} from '../../logic/classes';
import { allSavingThrowBreakdowns } from '../../logic/saving-throws';
import { allSkillBreakdowns, getSkillTraining } from '../../logic/skills';
import {
  darkvisionBreakdown,
  resolveSize,
  resolveSpecies,
  speciesTraits,
  speedBreakdown,
} from '../../logic/species';
import { SPECIES_LIST, getSpecies } from '../../data/species';
import type { SpeciesChoiceSpec, SpeciesData } from '../../data/species';
import { CLASS_LIST, getClass } from '../../data/classes';
import type { ClassData } from '../../data/classes';
import type { ClassSelection, SpeciesSelection } from '../../types/character';
import { CalculatedValue } from '../shared/CalculatedValue';
import { Card } from '../shared/Card';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { EditableField } from '../shared/EditableField';
import { SIZE_LABELS, choiceOptions, srdBadge } from './sheet-helpers';
import styles from './CharacterPage.module.css';

export interface CharacterPageProps {
  character: Character;
  onChange: (next: Character) => void;
}

/**
 * The Character tab: identity, the six ability scores + derived modifiers, the
 * Proficiency Bonus, Species (incl. Speed/Darkvision), Class + features, Saving
 * Throws, and Skills. Section logic and every CalculatedValue call-site are
 * lifted verbatim from the former single-page CharacterSheet.
 */
export function CharacterPage({ character, onChange }: CharacterPageProps) {
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

  // Selecting a class starts a fresh selection (dropping a stale subclass/skill
  // choice from a previous class); the empty value clears the class entirely.
  // The class level mirrors the character level this stage (single-class).
  const setClass = (raw: string) => {
    if (raw === '' || getClass(raw) === undefined) {
      const next = { ...character };
      delete next.class;
      onChange(next);
      return;
    }
    onChange({
      ...character,
      class: { id: raw as ClassSelection['id'], level: character.level },
    });
  };

  const setSubclass = (raw: string) => {
    if (character.class === undefined) return;
    const next: ClassSelection = { ...character.class };
    if (raw === '') {
      delete next.subclassId;
    } else {
      next.subclassId = raw as ClassSelection['subclassId'];
    }
    onChange({ ...character, class: next });
  };

  // Toggles a single class skill-choice proficiency, deduped and capped at the
  // class's allowed count (PHB 2024 Core <Class> Traits: Skill Proficiencies).
  const setClassSkill = (skillId: SkillId, checked: boolean, count: number) => {
    if (character.class === undefined) return;
    const current = character.class.skillChoices ?? [];
    let next: SkillId[];
    if (checked) {
      if (current.includes(skillId)) return;
      next = [...current, skillId].slice(0, count);
    } else {
      next = current.filter((s) => s !== skillId);
    }
    onChange({
      ...character,
      class: { ...character.class, skillChoices: next },
    });
  };

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

  const profBreakdown = proficiencyBonusBreakdown(character.level);
  const saveBreakdowns = allSavingThrowBreakdowns(character);
  const skillBreakdowns = allSkillBreakdowns(character);

  const selectedClass: ClassData | undefined = resolveClass(character);
  const selectedSubclass = resolveSubclass(character);
  const classProfs = classProficiencies(character);
  const featuresByLevel = classFeaturesByLevel(character);
  // The class's starting skill-choice list ('any' means every skill is
  // eligible — PHB 2024 Core <Class> Traits: Skill Proficiencies).
  const classSkillOptions =
    selectedClass === undefined
      ? []
      : selectedClass.skillChoices.from === 'any'
        ? SKILLS.map((s) => s.id as SkillId)
        : selectedClass.skillChoices.from;
  const chosenClassSkills = character.class?.skillChoices ?? [];

  return (
    <div className={styles.page}>
      <Card>
        <div className={styles.header}>
          <EditableField
            label="Character name"
            value={character.name}
            type="text"
            mode="tap-to-edit"
            required={false}
            onSave={(v) => setName(String(v))}
            style={{ flex: '1 1 240px', minWidth: '180px' }}
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
        </div>
      </Card>

      <Card>
        <h2 className={styles.fieldLabel}>Ability Scores</h2>
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
      </Card>

      <Card>
        <CollapsibleSection title="Species" storageKey="dnd-collapse-species">
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
                  title={srdBadge(selectedSpecies.srd).title}
                >
                  {srdBadge(selectedSpecies.srd).text}
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
        </CollapsibleSection>
      </Card>

      <Card>
        <CollapsibleSection title="Class" storageKey="dnd-collapse-class">
          <div className={styles.classGrid}>
            <div className={styles.speciesField}>
              <label className={styles.fieldLabel} htmlFor="class-select">
                Class
              </label>
              <select
                id="class-select"
                className={styles.speciesSelect}
                value={character.class?.id ?? ''}
                aria-label="Class"
                onChange={(e) => setClass(e.target.value)}
              >
                <option value="">— None —</option>
                {CLASS_LIST.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {selectedClass && (
                <span
                  className={styles.srdBadge}
                  title={srdBadge(selectedClass.srd).title}
                >
                  {srdBadge(selectedClass.srd).text}
                </span>
              )}
            </div>

            {selectedClass && character.level >= selectedClass.subclassLevel && (
              <div className={styles.speciesField}>
                <label className={styles.fieldLabel} htmlFor="subclass-select">
                  Subclass
                </label>
                <select
                  id="subclass-select"
                  className={styles.speciesSelect}
                  value={character.class?.subclassId ?? ''}
                  aria-label="Subclass"
                  onChange={(e) => setSubclass(e.target.value)}
                >
                  <option value="">choose…</option>
                  {selectedClass.subclasses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {selectedSubclass && (
                  <span
                    className={styles.srdBadge}
                    title={srdBadge(selectedSubclass.srd).title}
                  >
                    {srdBadge(selectedSubclass.srd).text}
                  </span>
                )}
              </div>
            )}

            <div className={styles.speciesField}>
              <span className={styles.fieldLabel}>Hit Die</span>
              <span className={styles.speciesText}>
                {selectedClass ? `d${selectedClass.hitDie}` : '—'}
              </span>
            </div>
          </div>

          {selectedClass && classSkillOptions.length > 0 && (
            <div className={styles.classSkills}>
              <span className={styles.fieldLabel}>
                Skill Proficiencies — choose {selectedClass.skillChoices.count} (
                {chosenClassSkills.length} chosen)
              </span>
              <ul className={styles.classSkillList} aria-label="Class skill choices">
                {classSkillOptions.map((skillId) => {
                  const skill = SKILLS.find((s) => s.id === skillId);
                  if (!skill) return null;
                  const checked = chosenClassSkills.includes(skillId);
                  const atCap =
                    chosenClassSkills.length >= selectedClass.skillChoices.count;
                  return (
                    <li key={skillId} className={styles.classSkillRow}>
                      <label className={styles.checkboxCell}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={checked}
                          disabled={!checked && atCap}
                          aria-label={`${skill.name} class proficiency`}
                          onChange={(e) =>
                            setClassSkill(
                              skillId,
                              e.target.checked,
                              selectedClass.skillChoices.count,
                            )
                          }
                        />
                        <span className={styles.checkboxText}>{skill.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {featuresByLevel.size > 0 && (
            <div className={styles.featureList} aria-label="Class Features">
              {[...featuresByLevel.entries()].map(([level, features]) => (
                <div key={level} className={styles.featureLevelGroup}>
                  <h3 className={styles.featureLevelHeading}>Level {level}</h3>
                  {features.map((feature) => (
                    <div key={feature.name} className={styles.featureRow}>
                      <span className={styles.featureName}>
                        {feature.name}
                        {feature.kind === 'asi-marker' && (
                          <span className={styles.featureTag}> — take ASI or feat</span>
                        )}
                      </span>
                      <span className={styles.featureEffect}>{feature.effect}</span>
                      <span className={styles.featureSource}>
                        source: {feature.source}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {selectedClass && (
            <div className={styles.classProficiencies}>
              <h3 className={styles.featureLevelHeading}>
                Equipment Training &amp; Proficiencies
              </h3>
              <ul className={styles.traitList}>
                <li className={styles.traitRow}>
                  <span className={styles.traitName}>Armor Training</span>
                  <span className={styles.traitEffect}>
                    {classProfs.armor.length > 0 ? classProfs.armor.join(', ') : 'None'}
                  </span>
                </li>
                <li className={styles.traitRow}>
                  <span className={styles.traitName}>Weapons</span>
                  <span className={styles.traitEffect}>
                    {classProfs.weapons.length > 0
                      ? classProfs.weapons.join(', ')
                      : 'None'}
                  </span>
                </li>
                <li className={styles.traitRow}>
                  <span className={styles.traitName}>Tools</span>
                  <span className={styles.traitEffect}>
                    {classProfs.tools.length > 0 ? classProfs.tools.join(', ') : 'None'}
                  </span>
                </li>
                <li className={styles.traitRow}>
                  <span className={styles.traitName}>Starting Equipment</span>
                  <span className={styles.traitEffect}>
                    {selectedClass.startingEquipment}
                  </span>
                </li>
              </ul>
            </div>
          )}

          {selectedClass === undefined && (
            <p className={styles.classPlaceholder}>
              No class selected. Choose a class to see its Hit Die, features,
              proficiencies, and Hit Point maximum.
            </p>
          )}
        </CollapsibleSection>
      </Card>

      <Card>
        <CollapsibleSection title="Saving Throws" storageKey="dnd-collapse-saves">
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
        </CollapsibleSection>
      </Card>

      <Card>
        <CollapsibleSection title="Skills" storageKey="dnd-collapse-skills">
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
                      onChange={(e) =>
                        setSkill(skill.id, { proficient: e.target.checked })
                      }
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
                      onChange={(e) =>
                        setSkill(skill.id, { expertise: e.target.checked })
                      }
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
        </CollapsibleSection>
      </Card>
    </div>
  );
}
