import type { Character, SkillId } from '../../types/character';
import { SKILLS } from '../../types/character';
import {
  primaryClass,
  allClasses,
  resolveClass,
  classProficiencies,
  classFeaturesByLevel,
} from '../../logic/classes';
import { shouldResetSpellcasting } from '../../logic/spellcasting';
import { getSpecies } from '../../data/species';
import type { SpeciesChoiceSpec } from '../../data/species';
import { CLASS_LIST, getClass } from '../../data/classes';
import type { ClassData } from '../../data/classes';
import type { ClassEntry, SpeciesSelection } from '../../types/character';
import { useEffect, useState } from 'react';
import { Card } from '../shared/Card';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { PersonalDetailsSection } from './character/PersonalDetailsSection';
import { OverviewSetup } from './character/OverviewSetup';
import { OverviewVitals } from './character/OverviewVitals';
import { OverviewRest } from './character/OverviewRest';
import { SubclassDetails } from './character/SubclassDetails';
import { WeaponMasteryChooser } from '../combat/WeaponMasteryChooser';
import { masteryChoices } from '../../logic/weapon-mastery';
import { OverviewInspiration } from './character/OverviewInspiration';
import { OverviewSpellcasting } from './character/OverviewSpellcasting';
import { OverviewNow } from './character/OverviewNow';
import { OverviewAbilities } from './character/OverviewAbilities';
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
  /** Optional app-level Toast sink (rest results on the Overview Rest card). */
  onNotify?: (message: string) => void;
}

// The Character page has TWO sub-tabs: Overview (id 'identity') and Class &
// Features (id 'build'). The ids are stable; older ids alias to them below. The
// former Abilities & Skills tab ('abilities') was merged into the Overview's
// Abilities, Saves & Skills card, which showed the same saves and skills twice.
type CharSubTab = 'identity' | 'build';

// Stable identity (module scope) so it stays out of effect dependency arrays.
const VALID_SUBTABS: CharSubTab[] = ['identity', 'build'];

const DEFAULT_SUBTABS: { id: CharSubTab; label: string }[] = [
  { id: 'identity', label: 'Overview' },
  { id: 'build', label: 'Class & Features' },
];

/**
 * Sub-tab migrations: the old four-tab set {overview,skills,species,class}
 * became {identity,abilities,build} (P3), and 'abilities' then merged into
 * 'identity'. A stored `lastSubTab:character` or a deep-link
 * hash (#character/<old-id>) holding an OLD id is mapped to its NEW home so the
 * page opens on the equivalent tab instead of a blank/broken state:
 *   overview → identity   (personal details + level live on the Overview, id 'identity')
 *   skills    → identity  (saves & skills live on the Overview)
 *   abilities → identity  (ability scores, saves & skills live on the Overview)
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
  skills: 'identity',
  // Abilities & Skills was merged into the Overview's Abilities, Saves & Skills card.
  abilities: 'identity',
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
 * of cards (Conditions, Reactions, Attacks, Spellcasting for casters, then
 * Abilities, Saves & Skills with its Edit toggle, and Traits & Feats). Class & Features
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
  onNotify,
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

  // Ability scores, save proficiencies and skill proficiencies are edited in
  // the Overview's Abilities, Saves & Skills card (OverviewAbilities).

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
    const entries = allClasses(character);
    if (entries.length >= 2) {
      // Multiclass: replace only the initial class (classes[0]), keeping its
      // level and every other class. A class the character already has as a
      // multiclass can't be picked here (the option is disabled), so no class
      // is ever listed twice.
      if (entries.slice(1).some((e) => e.id === raw)) return;
      const nextClass: ClassEntry = { id: raw as ClassEntry['id'], level: entries[0].level };
      const next: Character = { ...character, classes: [nextClass, ...entries.slice(1)] };
      // Only the replaced class's spell picks go; the other classes keep theirs.
      if (shouldResetSpellcasting(prevEntry, nextClass) && prevEntry && next.spellcasting?.byClass) {
        const byClass = { ...next.spellcasting.byClass };
        delete byClass[prevEntry.id];
        next.spellcasting = { ...next.spellcasting, byClass };
      }
      onChange(next);
      return;
    }
    // Single class: classes[0] is the initial class and its level mirrors the
    // character level (PHB 2024 "Multiclassing").
    const nextClass: ClassEntry = { id: raw as ClassEntry['id'], level: character.level };
    const next: Character = { ...character, classes: [nextClass] };
    if (shouldResetSpellcasting(prevEntry, nextClass)) delete next.spellcasting;
    onChange(next);
  };

  /**
   * Sets (or clears) the subclass of one class entry, keeping every other class
   * (a multiclass character's other classes must survive a subclass change).
   */
  const setSubclassAt = (index: number, raw: string) => {
    const entries = allClasses(character);
    const prevEntry = entries[index];
    if (prevEntry === undefined) return;
    const nextClass: ClassEntry = { ...prevEntry };
    if (raw === '') {
      delete nextClass.subclassId;
    } else {
      nextClass.subclassId = raw as ClassEntry['subclassId'];
    }
    const next: Character = {
      ...character,
      classes: entries.map((e, i) => (i === index ? nextClass : e)),
    };
    // A subclass change on a subclass caster (Eldritch Knight / Arcane
    // Trickster) changes the spell source, so reconcile the spell state.
    if (shouldResetSpellcasting(prevEntry, nextClass)) delete next.spellcasting;
    onChange(next);
  };
  const setSubclass = (raw: string) => setSubclassAt(0, raw);

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
    // Only the initial class grants skill choices; keep any other classes.
    const entries = allClasses(character);
    onChange({
      ...character,
      classes: [{ ...prevEntry, skillChoices: next }, ...entries.slice(1)],
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

  const selectedClass: ClassData | undefined = resolveClass(character);
  const classProfs = classProficiencies(character);
  const featuresByLevel = classFeaturesByLevel(character);
  // Single-class view: the chosen subclass, so its rows can be labelled.
  const singleSubclass = selectedClass?.subclasses.find(
    (s) => s.id === allClasses(character)[0]?.subclassId,
  );
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
    // Class features plus the chosen subclass's features (both gated at THIS
    // class's level; sort is stable so class rows precede subclass rows).
    const reachable = [...data.features, ...(subclass?.features ?? [])];
    for (const feature of reachable.sort((a, b) => a.level - b.level)) {
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
          <OverviewVitals character={character} onChange={onChange} />
          <OverviewRest character={character} onChange={onChange} onNotify={onNotify} />
          <OverviewInspiration character={character} onChange={onChange} />
          {/* Two independent column stacks on a wide page (no shared grid rows,
              so a short card never leaves a hole beside a tall one). Left: the
              "Right now" summary, Spellcasting, and Traits & Feats (here to
              balance the tall Abilities card). Right: Abilities, Saves & Skills.
              Fights are run on Combat, so nothing here repeats its cards. On a
              narrow page it is one stack: Right now, Spellcasting, Abilities,
              then Traits & Feats. */}
          <div className={styles.overviewGrid} data-testid="overview-grid">
            <div className={styles.overviewColumns}>
              <div className={styles.overviewColumn} data-testid="overview-column-now">
                <OverviewNow character={character} />
                <OverviewSpellcasting character={character} />
                <div className={styles.overviewLast}>
                  <OverviewTraits character={character} />
                </div>
              </div>
              <div className={styles.overviewColumn} data-testid="overview-column-reference">
                <OverviewAbilities character={character} onChange={onChange} />
              </div>
            </div>
          </div>
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
                {/* A multiclass character can't clear the initial class or swap
                    it for one of their other classes. */}
                <option value="" disabled={isMulticlass}>— None —</option>
                {CLASS_LIST.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={classEntries.slice(1).some((e) => e.id === c.id)}
                  >
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedClass && (primaryClass(character)?.level ?? 0) >= selectedClass.subclassLevel && (
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

          {/* What each subclass offers, before and after choosing (single-class
              view; the select above holds the choice). */}
          {selectedClass && selectedClass.subclasses.length > 0 && !isMulticlass && (
            <SubclassDetails
              cls={selectedClass}
              classLevel={primaryClass(character)?.level ?? character.level}
              selectedId={primaryClass(character)?.subclassId}
              onChoose={setSubclass}
            />
          )}

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
                        {singleSubclass?.features.includes(feature) && (
                          <span className={styles.featureTag}> — {singleSubclass.name}</span>
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
                {/* Each class's own subclass: preview below its subclass level,
                    then Choose (PHB 2024: gained at a level in that class). */}
                {data.subclasses.length > 0 && (
                  <SubclassDetails
                    cls={data}
                    classLevel={entry.level}
                    selectedId={entry.subclassId}
                    onChoose={(id) => setSubclassAt(classEntries.indexOf(entry), id)}
                  />
                )}
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
      {/* Weapon Mastery choices change only on a Long Rest, so the chooser lives
          with the class build, not on the Combat page (weapon cards there keep
          their mastery chip). Shown only to a class with Weapon Mastery. */}
      {masteryChoices(character).cap > 0 && (
        <WeaponMasteryChooser character={character} onChange={onChange} />
      )}
        </>
      )}
    </div>
  );
}
