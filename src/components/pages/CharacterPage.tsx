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
  clampAbilityScore,
} from '../../logic/abilities';
import { effectiveAbilityScores, abilityScoreBreakdown } from '../../logic/feats';
import { formatSigned } from '../../logic/breakdown';
import {
  primaryClass,
  allClasses,
  resolveClass,
  classProficiencies,
  classFeaturesByLevel,
} from '../../logic/classes';
import { allSavingThrowBreakdowns, savingThrowProficiency } from '../../logic/saving-throws';
import { allSkillBreakdowns, effectiveSkillTraining, getSkillTraining } from '../../logic/skills';
import { shouldResetSpellcasting } from '../../logic/spellcasting';
import { getSpecies } from '../../data/species';
import type { SpeciesChoiceSpec } from '../../data/species';
import { CLASS_LIST, getClass } from '../../data/classes';
import type { ClassData } from '../../data/classes';
import type { ClassEntry, SpeciesSelection } from '../../types/character';
import { useEffect, useState } from 'react';
import { CalculatedValue } from '../shared/CalculatedValue';
import { Card } from '../shared/Card';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { PersonalDetailsSection } from './character/PersonalDetailsSection';
import { OverviewSetup } from './character/OverviewSetup';
import { OverviewVitals } from './character/OverviewVitals';
import { OverviewInspiration } from './character/OverviewInspiration';
import { OverviewAttacks } from './character/OverviewAttacks';
import { OverviewSpellcasting } from './character/OverviewSpellcasting';
import { OverviewConditions } from './character/OverviewConditions';
import { OverviewReactions } from './character/OverviewReactions';
import { OverviewSkills } from './character/OverviewSkills';
import { OverviewTraits } from './character/OverviewTraits';
import { SubTabBar } from '../shared/SubTabBar';
import { useTabOrder } from '../../hooks/useTabOrder';
import { loadLastSubTab, saveLastSubTab } from '../../logic/sub-tab-store';
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

// The Character page has THREE sub-tabs: Overview (id 'identity'), Abilities &
// Skills (id 'abilities') and Class & Features (id 'build'). The ids are stable;
// the older ids (overview/skills/species/class) alias to them below.
type CharSubTab = 'identity' | 'abilities' | 'build';

// Stable identity (module scope) so it stays out of effect dependency arrays.
const VALID_SUBTABS: CharSubTab[] = ['identity', 'abilities', 'build'];

const DEFAULT_SUBTABS: { id: CharSubTab; label: string }[] = [
  { id: 'identity', label: 'Overview' },
  { id: 'abilities', label: 'Abilities & Skills' },
  { id: 'build', label: 'Class & Features' },
];

/**
 * P3 migration: the sub-tab ids changed from the old four-tab set
 * {overview,skills,species,class} to the new three-tab set
 * {identity,abilities,build}. A stored `lastSubTab:character` or a deep-link
 * hash (#character/<old-id>) holding an OLD id is mapped to its NEW home so the
 * page opens on the equivalent tab instead of a blank/broken state:
 *   overview → identity   (personal details + level live on the Overview, id 'identity')
 *   skills   → abilities  (saves & skills live on Abilities & Skills)
 *   species  → build      (species now lives on the Overview)
 *   class    → build      (class & features live on Class & Features, id 'build')
 * Any id not in this map and not a current valid id falls back to the default
 * (first) tab. The stored `tabOrder:character` of OLD ids is handled separately
 * by reconcileTabOrder (tab-order-store.ts): it drops the unknown old ids and
 * appends the new defaults, yielding the new default order rather than an empty
 * bar.
 */
const OLD_SUBTAB_ALIASES: Record<string, CharSubTab> = {
  overview: 'identity',
  skills: 'abilities',
  species: 'build',
  class: 'build',
};

/** Map a stored/deep-linked id (current or legacy) to a current id, or null. */
function aliasSubTab(value: string | null | undefined): CharSubTab | null {
  if (value == null) return null;
  if (VALID_SUBTABS.includes(value as CharSubTab)) return value as CharSubTab;
  return OLD_SUBTAB_ALIASES[value] ?? null;
}

/**
 * The Character tab. Overview is the one-page session sheet, top to bottom:
 * Personal Details + portrait, Species, Vitals, Heroic Inspiration, then a grid
 * of read-only cards (Conditions, Reactions, Attacks, Spellcasting for casters,
 * Skills & Saves, Traits & Feats). Abilities & Skills holds the six ability
 * scores with the saving throws and skills derived from them. Class & Features
 * holds class, subclass, skill choices and the feature list. Every
 * CalculatedValue keeps its breakdown tooltip.
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

  // Resolve order (WFRP): hash sub-tab → last-used → first ordered → default.
  // aliasSubTab accepts a current id OR a legacy id (overview/skills/species/
  // class), so a deep link or stored value from the old four-tab set resolves to
  // its new home (P3 migration) instead of a blank page; anything unknown falls
  // through to the first ordered / default tab.
  const resolveInitialTab = (): CharSubTab => {
    const fromHash = aliasSubTab(subTab);
    if (fromHash) return fromHash;
    const fromLastUsed = aliasSubTab(loadLastSubTab('character'));
    if (fromLastUsed) return fromLastUsed;
    const firstOrdered = orderedTabs[0]?.id;
    if (isValidSubTab(firstOrdered)) return firstOrdered;
    return VALID_SUBTABS[0];
  };

  const [activeSubTab, setActiveSubTabInternal] = useState<CharSubTab>(resolveInitialTab);

  // Mirror an external hash sub-tab into local state (deep link / paste). A
  // legacy id is aliased to its new home; an unknown id is ignored (keeps the
  // current tab rather than blanking).
  useEffect(() => {
    const resolved = aliasSubTab(subTab);
    if (resolved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSubTabInternal(resolved);
    }
    // Only the external hash prop should retrigger this mirror; aliasSubTab
    // reads only module-scoped constants, so subTab is the sole dependency.
  }, [subTab]);

  const setActiveSubTab = (tab: CharSubTab) => {
    setActiveSubTabInternal(tab);
    saveLastSubTab('character', tab);
    onSubTabChange?.(tab);
  };

  // P4: Level is authoritative on the Advancement tab (which delegates to
  // logic/advancement.setLevel for the clamp + single-class invariant +
  // spellcasting reconcile). Character → Overview now shows it READ-ONLY, so the
  // duplicate editor and its hand-rolled reconcile path are gone.

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

  // Effective ability scores (base + feat increases) drive the displayed
  // modifier and every derived total; the base-score editor stays the creation
  // value (A6b). effectiveAbilityScores is pure and never mutates abilities.
  const effective = effectiveAbilityScores(character);
  const saveBreakdowns = allSavingThrowBreakdowns(character);
  const skillBreakdowns = allSkillBreakdowns(character);

  const selectedClass: ClassData | undefined = resolveClass(character);
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

      {activeSubTab === 'identity' && (
        <>
          <PersonalDetailsSection
            character={character}
            onChange={onChange}
            portraitURL={portraitURL}
            onPortraitUpload={onPortraitUpload ?? (() => {})}
            onPortraitRemove={onPortraitRemove ?? (() => {})}
            onSpeciesChange={setSpecies}
            onSpeciesChoiceChange={setSpeciesChoice}
          />
          <OverviewSetup character={character} />
          <OverviewVitals character={character} />
          <OverviewInspiration character={character} onChange={onChange} />
          {/* Two independent column stacks (no shared grid rows, so a short
              card never leaves a hole beside a tall one): the "right now"
              cards on the left, the reference cards on the right. On a narrow
              page the columns stack in DOM order, so mobile reads Conditions,
              Reactions, Attacks, Spellcasting, then Skills & Saves, Traits. */}
          <div className={styles.overviewGrid} data-testid="overview-grid">
            <div className={styles.overviewColumns}>
              <div className={styles.overviewColumn} data-testid="overview-column-now">
                <OverviewConditions character={character} />
                <OverviewReactions character={character} />
                <OverviewAttacks character={character} />
                <OverviewSpellcasting character={character} />
              </div>
              <div className={styles.overviewColumn} data-testid="overview-column-reference">
                <OverviewSkills character={character} />
                <OverviewTraits character={character} />
              </div>
            </div>
          </div>
        </>
      )}

      {activeSubTab === 'abilities' && (
        <>
      <Card>
        {/* Same shared header as the Saving Throws / Skills cards beside it. */}
        <CollapsibleSection title="Ability Scores" storageKey="dnd-collapse-ability-scores">
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
        </CollapsibleSection>
      </Card>

      <Card>
        <CollapsibleSection title="Saving Throws" storageKey="dnd-collapse-saves">
          <ul className={styles.statList}>
            {ABILITIES.map((ability) => {
              const breakdown = saveBreakdowns[ability];
              // Class-granted saves (initial class only, PHB Core <Class> Traits)
              // show ticked and locked; the editable tick is for manual extras
              // such as feats.
              const profInfo = savingThrowProficiency(character, ability);
              const fromClass = profInfo.source === 'class';
              return (
                <li key={ability} className={styles.statRow}>
                  <span className={styles.statName}>
                    {ABILITY_NAMES[ability]}
                    {fromClass && (
                      <span className={styles.saveSource}>from {profInfo.classLabel} (class)</span>
                    )}
                  </span>
                  <label className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={profInfo.proficient}
                      disabled={fromClass}
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
              // Effective view: class- and species-granted skills show ticked and
              // locked (like class saving throws); the tick is editable otherwise.
              const training = effectiveSkillTraining(character, skill.id);
              const proficient = training.proficient;
              const expertise = training.expertise;
              const granted = training.source === 'class' || training.source === 'species';
              return (
                <li key={skill.id} className={styles.statRow}>
                  <span className={styles.statName}>
                    {skill.name}{' '}
                    <span className={styles.statAbility}>
                      ({ABILITY_ABBR[skill.ability]})
                    </span>
                    {granted && (
                      <span className={styles.saveSource}>from {training.sourceLabel}</span>
                    )}
                  </span>
                  <label className={styles.checkboxCell}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={proficient}
                      disabled={granted}
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

      {activeSubTab === 'build' && (
        <>
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
        </>
      )}
    </div>
  );
}
