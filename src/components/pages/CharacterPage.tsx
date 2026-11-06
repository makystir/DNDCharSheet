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
import { effectiveAbilityScores, abilityScoreBreakdown } from '../../logic/feats';
import { formatSigned } from '../../logic/breakdown';
import {
  primaryClass,
  allClasses,
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
import {
  reconcileSpellcastingForLevel,
  shouldResetSpellcasting,
} from '../../logic/spellcasting';
import { knownLanguages } from '../../logic/languages';
import { SPECIES_LIST, getSpecies } from '../../data/species';
import type { SpeciesChoiceSpec, SpeciesData } from '../../data/species';
import { getBackground } from '../../data/backgrounds';
import { CLASS_LIST, getClass } from '../../data/classes';
import type { ClassData } from '../../data/classes';
import type { ClassEntry, SpeciesSelection } from '../../types/character';
import { useEffect, useState } from 'react';
import { CalculatedValue } from '../shared/CalculatedValue';
import { Card } from '../shared/Card';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { PersonalDetailsSection } from './character/PersonalDetailsSection';
import { SubTabBar } from '../shared/SubTabBar';
import { useTabOrder } from '../../hooks/useTabOrder';
import { loadLastSubTab, saveLastSubTab } from '../../logic/sub-tab-store';
import { SIZE_LABELS, choiceOptions, formatLanguage, srdBadge } from './sheet-helpers';
import styles from './CharacterPage.module.css';

export interface CharacterPageProps {
  character: Character;
  onChange: (next: Character) => void;
  /** The sub-tab from the URL hash (or null); the page owns final resolution. */
  subTab?: string | null;
  /** Called when the user selects a sub-tab, to sync the hash. */
  onSubTabChange?: (tab: string) => void;
  /** Portrait object URL (owned by the shell's usePortrait), or '' for none. */
  portraitURL?: string;
  /** Upload a portrait file for the active character. */
  onPortraitUpload?: (file: File) => void;
  /** Remove the active character's portrait. */
  onPortraitRemove?: () => void;
}

type CharSubTab = 'overview' | 'skills' | 'species' | 'class';

// Stable identity (module scope) so it stays out of effect dependency arrays.
const VALID_SUBTABS: CharSubTab[] = ['overview', 'skills', 'species', 'class'];

const DEFAULT_SUBTABS: { id: CharSubTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'skills', label: 'Skills & Saves' },
  { id: 'species', label: 'Species' },
  { id: 'class', label: 'Class & Features' },
];

/**
 * The Character tab: identity, the six ability scores + derived modifiers, the
 * Proficiency Bonus, Species (incl. Speed/Darkvision), Class + features, Saving
 * Throws, and Skills. Section logic and every CalculatedValue call-site are
 * lifted verbatim from the former single-page CharacterSheet.
 */
export function CharacterPage({
  character,
  onChange,
  subTab,
  onSubTabChange,
  portraitURL = '',
  onPortraitUpload,
  onPortraitRemove,
}: CharacterPageProps) {
  const {
    orderedTabs,
    isEditMode,
    toggleEditMode,
    moveLeft,
    moveRight,
    resetOrder,
    isDefaultOrder,
    saveError,
  } = useTabOrder({ pageKey: 'character', defaultTabs: DEFAULT_SUBTABS });

  const isValidSubTab = (value: string | null | undefined): value is CharSubTab =>
    value != null && VALID_SUBTABS.includes(value as CharSubTab);

  // Resolve order (WFRP): valid hash sub-tab → last-used → first ordered → 'overview'.
  const resolveInitialTab = (): CharSubTab => {
    if (isValidSubTab(subTab)) return subTab;
    const lastUsed = loadLastSubTab('character');
    if (isValidSubTab(lastUsed)) return lastUsed;
    const firstOrdered = orderedTabs[0]?.id;
    if (isValidSubTab(firstOrdered)) return firstOrdered;
    return 'overview';
  };

  const [activeSubTab, setActiveSubTabInternal] = useState<CharSubTab>(resolveInitialTab);

  // Mirror a valid external hash sub-tab into local state (deep link / paste).
  useEffect(() => {
    if (subTab && isValidSubTab(subTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSubTabInternal(subTab);
    }
    // Only the external hash prop should retrigger this mirror; isValidSubTab
    // reads only module-scoped VALID_SUBTABS, so subTab is the sole dependency.
  }, [subTab]);

  const setActiveSubTab = (tab: CharSubTab) => {
    setActiveSubTabInternal(tab);
    saveLastSubTab('character', tab);
    onSubTabChange?.(tab);
  };

  const setLevel = (raw: string) => {
    const level = clampLevel(Number.parseInt(raw, 10));
    const next: Character = { ...character, level };
    // Keep the single-class invariant level === sum(classes[].level): the Level
    // control is single-class (multiclass level-up is the Advancement page's
    // M4 path), so a lone class entry's level must mirror the character level.
    // Without this the per-class level drifts from the total, and per-class
    // resolvers (e.g. Eldritch Knight / Arcane Trickster casting gated at class
    // level 3) would read a stale entry level (PHB 2024 "Multiclassing").
    if (next.classes && next.classes.length === 1) {
      next.classes = [{ ...next.classes[0], level }];
    }
    // Reconcile spell selections to the new level: lowering a level can strand
    // cantrips over the cap or prepared/spellbook spells above the highest
    // castable level, which would otherwise stay hidden yet still count toward
    // caps and be unremovable (review finding: level reduction strands state).
    if (next.spellcasting) {
      const reconciled = reconcileSpellcastingForLevel(next);
      if (reconciled) next.spellcasting = reconciled;
      else delete next.spellcasting;
    }
    onChange(next);
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
    const prevEntry = primaryClass(character);
    if (raw === '' || getClass(raw) === undefined) {
      const next = { ...character };
      const nextClass = undefined;
      delete next.classes;
      // Drop spell selections tied to the old class's list (review finding:
      // spell state must not survive an incompatible class change).
      if (shouldResetSpellcasting(prevEntry, nextClass)) delete next.spellcasting;
      onChange(next);
      return;
    }
    // Single-class this stage: classes[0] is the initial class, level mirrors
    // the character level (PHB 2024 "Multiclassing"; multiclass UI is M4).
    const nextClass: ClassEntry = { id: raw as ClassEntry['id'], level: character.level };
    const next: Character = { ...character, classes: [nextClass] };
    if (shouldResetSpellcasting(prevEntry, nextClass)) delete next.spellcasting;
    onChange(next);
  };

  const setSubclass = (raw: string) => {
    const prevEntry = primaryClass(character);
    if (prevEntry === undefined) return;
    const nextClass: ClassEntry = { ...prevEntry };
    if (raw === '') {
      delete nextClass.subclassId;
    } else {
      nextClass.subclassId = raw as ClassEntry['subclassId'];
    }
    const next: Character = { ...character, classes: [nextClass] };
    // A subclass change on a subclass caster (Eldritch Knight / Arcane
    // Trickster) changes the spell source, so reconcile the spell state.
    if (shouldResetSpellcasting(prevEntry, nextClass)) delete next.spellcasting;
    onChange(next);
  };

  // Toggles a single class skill-choice proficiency, deduped and capped at the
  // class's allowed count (PHB 2024 Core <Class> Traits: Skill Proficiencies).
  const setClassSkill = (skillId: SkillId, checked: boolean, count: number) => {
    const prevEntry = primaryClass(character);
    if (prevEntry === undefined) return;
    const current = prevEntry.skillChoices ?? [];
    let next: SkillId[];
    if (checked) {
      if (current.includes(skillId)) return;
      next = [...current, skillId].slice(0, count);
    } else {
      next = current.filter((s) => s !== skillId);
    }
    onChange({
      ...character,
      classes: [{ ...prevEntry, skillChoices: next }],
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
  // Languages: Common is always known (prepended by resolveLanguages, via
  // knownLanguages) plus the player's chosen additional languages AND any
  // base-class feature grants (Rogue L1 Thieves' Cant + 1 choice, Ranger L2
  // Deft Explorer + 2 choices — PHB 2024). 2024 species grant no fixed
  // languages (PHB 2024 "Choose Languages", L1294). The stored ids are
  // lowercase; title-case them for display.
  const knownLangs = knownLanguages(character);
  const selectedBackground = getBackground(character.backgroundSelection?.id);
  const speedBd = speedBreakdown(character);
  const darkvisionBd = darkvisionBreakdown(character);
  const size = resolveSize(character);
  const traits = speciesTraits(character);

  const profBreakdown = proficiencyBonusBreakdown(character.level);
  // Effective ability scores (base + feat increases) drive the displayed
  // modifier and every derived total; the base-score editor stays the creation
  // value (A6b). effectiveAbilityScores is pure and never mutates abilities.
  const effective = effectiveAbilityScores(character);
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
  const chosenClassSkills = primaryClass(character)?.skillChoices ?? [];

  // Multiclass display (Stage M5): the character's class entries. When 2+
  // classes exist, the Class & Features sub-tab renders one section per class
  // ("<Class> <level>" + its subclass + its reached features, gated at THAT
  // class's level — PHB 2024 "Multiclassing"). A single-class character has one
  // entry, so the per-class section renders exactly as the single-class view
  // did (identical output). classFeaturesByLevel is NOT re-gated here; each
  // per-class block filters to features at or below that class's own level.
  const classEntries = allClasses(character);
  const isMulticlass = classEntries.length >= 2;

  // Per-class feature groups for the multiclass display: each class's features
  // whose level is at or below THAT class's level (PHB 2024 "Multiclassing"),
  // grouped by level ascending. Reuses the same ClassFeature rows the
  // single-class view renders, so each row's name/effect/source are unchanged.
  const perClassSections = classEntries.flatMap((entry) => {
    const data = getClass(entry.id);
    if (!data) return [];
    const subclass = entry.subclassId
      ? data.subclasses.find((s) => s.id === entry.subclassId)
      : undefined;
    const byLevel = new Map<number, typeof data.features>();
    for (const feature of [...data.features].sort((a, b) => a.level - b.level)) {
      if (feature.level > entry.level) continue;
      const bucket = byLevel.get(feature.level);
      if (bucket) bucket.push(feature);
      else byLevel.set(feature.level, [feature]);
    }
    return [{ entry, data, subclassName: subclass?.name, byLevel }];
  });

  return (
    <div className={styles.page}>
      <SubTabBar
        tabs={orderedTabs}
        activeTab={activeSubTab}
        onTabChange={(t) => setActiveSubTab(t as CharSubTab)}
        editMode={{
          isActive: isEditMode,
          onToggle: toggleEditMode,
          onMoveLeft: moveLeft,
          onMoveRight: moveRight,
          onReset: resetOrder,
          isDefaultOrder,
          saveError,
        }}
      />

      {activeSubTab === 'overview' && (
        <>
          <PersonalDetailsSection
            character={character}
            onChange={onChange}
            portraitURL={portraitURL}
            onPortraitUpload={onPortraitUpload ?? (() => {})}
            onPortraitRemove={onPortraitRemove ?? (() => {})}
          />

          <Card>
            <div className={styles.header}>
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
            // The base score is the point-buy/creation value the input edits; it
            // is NEVER mutated by feats. The EFFECTIVE score (base + feat
            // increases) is what the modifier and every derived total use, and is
            // shown with a Base + each feat source breakdown (calculated-totals +
            // the A6b user decision). PHB 2024 "Ability Scores"/"Ability Score
            // Improvement".
            const baseScore = character.abilities[ability];
            const effectiveScore = effective[ability];
            const modBreakdown = abilityModifierBreakdown(ability, effectiveScore);
            const scoreBreakdown = abilityScoreBreakdown(character, ability);
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
                {/* The EFFECTIVE score, with a Base + each feat source breakdown. */}
                <span className={styles.abilityScoreTotal}>
                  <CalculatedValue
                    label={`${ABILITY_NAMES[ability]} Score`}
                    breakdown={scoreBreakdown}
                  >
                    {effectiveScore}
                  </CalculatedValue>
                </span>
                {/* The base-score EDITOR stays the creation value (never a running
                    total). When a feat has raised the score, the editable base is
                    labelled so it is clear this is the base, not the effective. */}
                <label className={styles.abilityBaseLabel} htmlFor={`ability-base-${ability}`}>
                  {effectiveScore !== baseScore ? 'Base' : 'Score'}
                </label>
                <input
                  id={`ability-base-${ability}`}
                  className={styles.abilityScore}
                  type="number"
                  min={1}
                  max={30}
                  value={baseScore}
                  // WCAG 2.5.3 (Label in Name): the accessible name must contain
                  // the visible label, which reads "Base" once a feat has raised
                  // the score, and "Score" otherwise.
                  aria-label={`${ABILITY_NAMES[ability]} ${effectiveScore !== baseScore ? 'base ' : ''}score`}
                  onChange={(e) => setScore(ability, e.target.value)}
                />
              </div>
            );
          })}
        </div>
      </Card>
        </>
      )}

      {activeSubTab === 'species' && (
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
                {knownLangs.map(formatLanguage).join(', ')}
                {knownLangs.length === 1 && (
                  <span className={styles.speciesNote}>
                    {' '}
                    (choose more in character creation)
                  </span>
                )}
              </span>
            </div>

            {selectedBackground && (
              <div className={styles.speciesField}>
                <span className={styles.fieldLabel}>Background</span>
                <span className={styles.speciesText}>
                  {selectedBackground.name}
                  <span
                    className={styles.srdBadge}
                    title={srdBadge(selectedBackground.srd).title}
                  >
                    {' '}
                    {srdBadge(selectedBackground.srd).text}
                  </span>
                </span>
              </div>
            )}
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
      )}

      {activeSubTab === 'class' && (
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
                value={primaryClass(character)?.id ?? ''}
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
                  value={primaryClass(character)?.subclassId ?? ''}
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

          {!isMulticlass && featuresByLevel.size > 0 && (
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

          {/* Multiclass (Stage M5): one section per class — "<Class> <level>"
              + its subclass + its reached features (gated at that class's own
              level). Only rendered for 2+ classes; single-class is unchanged. */}
          {isMulticlass &&
            perClassSections.map(({ entry, data, subclassName, byLevel }) => (
              <div
                key={entry.id}
                className={styles.featureList}
                aria-label={`${data.name} Features`}
              >
                <h3 className={styles.featureLevelHeading}>
                  {data.name} {entry.level}
                  {subclassName ? ` — ${subclassName}` : ''}
                </h3>
                {[...byLevel.entries()].map(([level, features]) => (
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
            ))}

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
      )}

      {activeSubTab === 'skills' && (
        <>
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
        </>
      )}
    </div>
  );
}
