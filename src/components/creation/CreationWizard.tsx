import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { Ability, Character, ClassSpellcasting, SkillId } from '../../types/character';
import {
  ABILITIES,
  ABILITY_ABBR,
  ABILITY_NAMES,
  ALIGNMENTS,
} from '../../types/character';
import { CLASS_LIST } from '../../data/classes';
import type { ClassId } from '../../data/classes';
import { SPECIES_LIST, getSpecies } from '../../data/species';
import type { SpeciesChoiceSpec, SpeciesId } from '../../data/species';
import { BACKGROUND_LIST, BACKGROUND_OPTION_B_GOLD, getBackground } from '../../data/backgrounds';
import type { BackgroundId } from '../../data/backgrounds';
import { BackgroundDetails } from './BackgroundDetails';
import { EquipmentStep } from './EquipmentStep';
import {
  cartCopper,
  cartItems,
  classEquipmentOptions,
  grantStartingEquipment,
  newItemId,
  resolveOptionItems,
  startingBudgetCopper,
  trimCartToBudget,
  trinketItem,
} from '../../logic/starting-equipment';
import type { Cart, ClassOptionId } from '../../logic/starting-equipment';
import { createCharacter } from '../../storage/character-store';
import { abilityModifier } from '../../logic/abilities';
import {
  pointBuyCost,
  pointBuyTotalCost,
  isPointBuyValid,
  standardArray,
  rollAbilityScoreSet,
  POINT_BUY_BUDGET,
  POINT_BUY_MIN_SCORE,
  POINT_BUY_MAX_SCORE,
} from '../../logic/ability-score-generation';
import {
  applyBackground,
  isBackgroundAbilityAllocationValid,
  type BackgroundAbilityAllocation,
} from '../../logic/backgrounds';
import {
  knownLanguages,
  featureLanguageGrants,
  LANGUAGES,
  CREATION_LANGUAGE_CHOICES,
} from '../../logic/languages';
import {
  generateName,
  generateAppearance,
  generatePersonality,
  generateDeity,
} from '../../logic/personal-details-generation';
import { DEITY_LIST } from '../../data/deities';
import type { NameGender } from '../../data/name-tables';
import { createDefaultRng } from '../../logic/random';
import { formatSigned, type Breakdown } from '../../logic/breakdown';
import {
  classGuidance,
  abilityHints,
  recommendedArray,
  suggestedBackgrounds,
} from '../../logic/class-guidance';
import { CalculatedValue } from '../shared/CalculatedValue';
import { SegmentedControl } from '../shared/SegmentedControl';
import { StepIndicator } from '../combat/StepIndicator';
import { choiceOptions, formatLanguage } from '../pages/sheet-helpers';
import { SkillsStep } from './SkillsStep';
import { SpellsStep } from './SpellsStep';
import { ReviewStep } from './ReviewStep';
import { startingChoicesFor } from '../../logic/starting-choices';
import { startingSpellPools } from '../../logic/starting-spells';
import styles from './CreationWizard.module.css';

export interface CreationWizardProps {
  /** Called with the finished, valid character when the player completes the flow. */
  onComplete: (character: Character) => void;
  /** Called when the player cancels/aborts the wizard. */
  onCancel: () => void;
}

/**
 * The guided steps, in order. Data-driven: renderers, validation and the
 * indicator all key off the step id, so a conditional step (e.g. Spells) can be
 * inserted by adding an entry here.
 */
type StepId =
  | 'class'
  | 'origin'
  | 'skills'
  | 'abilities'
  | 'spells'
  | 'details'
  | 'equipment'
  | 'review';
const ALL_STEPS: { id: StepId; label: string }[] = [
  { id: 'class', label: 'Class' },
  { id: 'origin', label: 'Origin' },
  { id: 'skills', label: 'Skills' },
  { id: 'abilities', label: 'Ability Scores' },
  // Only for classes with level 1 spellcasting (startingChoicesFor(...).spells).
  { id: 'spells', label: 'Spells' },
  { id: 'details', label: 'Details' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'review', label: 'Review' },
];

type AbilityMethod = 'standard-array' | 'point-buy' | 'roll';
type EquipmentChoice = 'A' | 'B';

const GENDERS: { value: NameGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'neutral', label: 'Neutral' },
];

const EMPTY_SCORES: Record<Ability, number> = {
  str: POINT_BUY_MIN_SCORE,
  dex: POINT_BUY_MIN_SCORE,
  con: POINT_BUY_MIN_SCORE,
  int: POINT_BUY_MIN_SCORE,
  wis: POINT_BUY_MIN_SCORE,
  cha: POINT_BUY_MIN_SCORE,
};

const STANDARD_ARRAY = standardArray();

/**
 * The guided character-creation wizard (D&D 5.5e / 2024), Stage A7 PART 3.
 *
 * Mirrors the WFRP CharacterWizard, re-themed to D&D: a five-step flow driven by
 * StepIndicator in PHB order — Class, Origin (Background + ability allocation,
 * Species + sub-choices, Languages), Ability Scores (Standard Array / Point Buy
 * with a live 27-point budget / Roll 4d6), Alignment & Details (with per-field
 * flavor generators), and Equipment (package A vs 50 GP B). On completion it
 * assembles a valid Character through the audited A6b `applyBackground` path
 * (base abilities never mutated) plus the chosen ability-score method.
 *
 * Every numeric total shown carries a CalculatedValue breakdown tooltip
 * (calculated-totals steering): ability-score totals, their modifiers, and the
 * point-buy spent/remaining budget.
 */
export function CreationWizard({ onComplete, onCancel }: CreationWizardProps) {
  const [step, setStep] = useState(0);

  // Step 1: Class.
  const [name, setName] = useState('');
  const [classId, setClassId] = useState<ClassId | ''>('');

  // Step 2: Origin (background + ability allocation + species + languages).
  const [backgroundId, setBackgroundId] = useState<BackgroundId | ''>('');
  // The allocation amount keyed by ability (only the background's three abilities).
  const [allocation, setAllocation] = useState<Partial<Record<Ability, number>>>({});
  const [speciesId, setSpeciesId] = useState<SpeciesId | ''>('');
  const [speciesChoices, setSpeciesChoices] = useState<Record<string, string>>({});
  const [chosenLanguages, setChosenLanguages] = useState<string[]>([]);
  // Feature "choose N" language picks (Rogue L1 Thieves' Cant → 1; Ranger L2
  // Deft Explorer → 2 — PHB 2024). Stored separately from the creation two and
  // written into languages.granted. The fixed auto-grant (Thieves' Cant) is
  // derived from the class, not picked here.
  const [grantedLanguages, setGrantedLanguages] = useState<string[]>([]);
  const [toolProficiency, setToolProficiency] = useState('');

  // Skills step: the class skill picks (stored in classes[0].skillChoices).
  const [skillChoices, setSkillChoices] = useState<SkillId[]>([]);

  // Spells step (casters only): stored at spellcasting.byClass[classId] on finish.
  const [spellPicks, setSpellPicks] = useState<ClassSpellcasting>({});

  // Ability scores step.
  const [abilityMethod, setAbilityMethod] = useState<AbilityMethod>('standard-array');
  // Which standard-array / rolled value is assigned to which ability (ability -> index into pool).
  const [arrayAssignment, setArrayAssignment] = useState<Partial<Record<Ability, number>>>({});
  const [pointBuyScores, setPointBuyScores] = useState<Record<Ability, number>>({ ...EMPTY_SCORES });
  const [rolledPool, setRolledPool] = useState<number[] | null>(null);
  const [rolledAssignment, setRolledAssignment] = useState<Partial<Record<Ability, number>>>({});

  // Step 4: Alignment & details.
  const [gender, setGender] = useState<NameGender>('neutral');
  const [alignment, setAlignment] = useState('');
  const [details, setDetails] = useState<{
    age: string;
    height: string;
    weight: string;
    eyes: string;
    hair: string;
    skin: string;
    faith: string;
    personality: string;
  }>({ age: '', height: '', weight: '', eyes: '', hair: '', skin: '', faith: '', personality: '' });

  // Step 5: Equipment.
  const [equipmentChoice, setEquipmentChoice] = useState<EquipmentChoice>('A');
  // Class equipment: the lettered option, the player's picks for any 'choose a
  // type' item, and the gear bought with the starting gold.
  const [classOption, setClassOption] = useState<ClassOptionId>('A');
  const [classPicks, setClassPicks] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<Cart>({});
  // Free trinket: its d100 result (1-100), or null for none.
  const [trinketRoll, setTrinketRoll] = useState<number | null>(null);

  const background = getBackground(backgroundId || undefined);
  const species = getSpecies(speciesId || undefined);

  // ─── Derived: deterministic, read-only class guidance (suggest, never apply)
  // All values come from class data + transcribed PHB tables (class-guidance.ts).
  const guidance = useMemo(
    () => (classId === '' ? undefined : classGuidance(classId)),
    [classId],
  );
  const hints = useMemo(
    () => (classId === '' ? undefined : abilityHints(classId)),
    [classId],
  );
  const suggestedBgIds = useMemo(
    () => (classId === '' ? [] : suggestedBackgrounds(classId)),
    [classId],
  );

  // ─── Derived: resolved base ability scores for the current method ──────────

  const resolvedScores = useMemo<Record<Ability, number>>(() => {
    if (abilityMethod === 'point-buy') return pointBuyScores;
    const pool = abilityMethod === 'roll' ? rolledPool : STANDARD_ARRAY;
    const assignment = abilityMethod === 'roll' ? rolledAssignment : arrayAssignment;
    const scores = {} as Record<Ability, number>;
    for (const ability of ABILITIES) {
      const idx = assignment[ability];
      scores[ability] = idx !== undefined && pool ? (pool[idx] ?? 10) : 10;
    }
    return scores;
  }, [abilityMethod, pointBuyScores, rolledPool, rolledAssignment, arrayAssignment]);

  // ─── Validation per step ───────────────────────────────────────────────────

  const allocationList: BackgroundAbilityAllocation[] = useMemo(
    () =>
      Object.entries(allocation)
        .filter(([, amount]) => (amount ?? 0) > 0)
        .map(([ability, amount]) => ({ ability: ability as Ability, amount: amount as number })),
    [allocation],
  );

  // Scores as they will be after the background bonus; used for equipment advice.
  const effectiveScores = useMemo<Record<Ability, number>>(() => {
    const scores = { ...resolvedScores };
    for (const { ability, amount } of allocationList) scores[ability] += amount;
    return scores;
  }, [resolvedScores, allocationList]);
  const allocationValid =
    background !== undefined &&
    isBackgroundAbilityAllocationValid(background.abilities, allocationList);

  const poolUsedOnce = (assignment: Partial<Record<Ability, number>>, poolLen: number): boolean => {
    const used = ABILITIES.map((a) => assignment[a]).filter((v) => v !== undefined);
    return used.length === poolLen && new Set(used).size === poolLen;
  };

  const abilityStepValid = (): boolean => {
    if (abilityMethod === 'point-buy') return isPointBuyValid(pointBuyScores);
    if (abilityMethod === 'roll') {
      return rolledPool !== null && poolUsedOnce(rolledAssignment, rolledPool.length);
    }
    return poolUsedOnce(arrayAssignment, STANDARD_ARRAY.length);
  };

  // The Spells step exists only for a class with level 1 spellcasting.
  const hasSpellsStep = classId !== '' && startingChoicesFor(classId)?.spells != null;
  const steps = useMemo(
    () => ALL_STEPS.filter((s) => s.id !== 'spells' || hasSpellsStep),
    [hasSpellsStep],
  );
  const stepLabels = useMemo(() => steps.map((s) => s.label), [steps]);
  /** The 1-based number shown in a step's heading. */
  const stepNumber = (id: StepId): number => steps.findIndex((s) => s.id === id) + 1;
  const currentStepId = steps[step].id;

  const canProceed = (): boolean => {
    switch (currentStepId) {
      case 'class':
        return name.trim().length > 0 && classId !== '';
      case 'origin':
        return backgroundId !== '' && allocationValid && speciesId !== '';
      case 'abilities':
        return abilityStepValid();
      // Skills never blocks: unfinished picks surface on the Overview later.
      case 'skills':
      case 'spells':
      case 'details':
      case 'equipment':
      case 'review':
        return true;
      default:
        return false;
    }
  };

  // ─── Step 1 handlers ─────────────────────────────────────────────────────

  // Starting gold available to spend: the class option's gold + the background's.
  const budgetFor = (
    option: ClassOptionId,
    bgId: BackgroundId | '',
    bgChoice: EquipmentChoice,
  ): number => {
    const classGold = classEquipmentOptions(classId).find((o) => o.id === option)?.goldGp ?? 0;
    const bg = getBackground(bgId || undefined);
    const bgGold = !bg ? 0 : bgChoice === 'A' ? bg.equipment.packageGold : BACKGROUND_OPTION_B_GOLD;
    return startingBudgetCopper(classGold, bgGold);
  };
  const selectBackground = (id: BackgroundId) => {
    setBackgroundId(id);
    setAllocation({});
    setToolProficiency('');
    // A different background changes the gold; drop purchases that no longer fit.
    setCart((c) => trimCartToBudget(c, budgetFor(classOption, id, equipmentChoice)));
  };
  const chooseClassOption = (option: ClassOptionId) => {
    setClassOption(option);
    setCart((c) => trimCartToBudget(c, budgetFor(option, backgroundId, equipmentChoice)));
  };
  const chooseBackgroundEquipment = (choice: EquipmentChoice) => {
    setEquipmentChoice(choice);
    setCart((c) => trimCartToBudget(c, budgetFor(classOption, backgroundId, choice)));
  };
  const changeCart = (key: string, delta: number) => {
    setCart((c) => {
      const next = { ...c, [key]: Math.max(0, (c[key] ?? 0) + delta) };
      if (next[key] === 0) delete next[key];
      return next;
    });
  };

  const setAllocationAmount = (ability: Ability, amount: number) => {
    setAllocation((prev) => {
      const next = { ...prev };
      if (amount === 0) delete next[ability];
      else next[ability] = amount;
      return next;
    });
  };

  const selectSpecies = (id: SpeciesId) => {
    setSpeciesId(id);
    setSpeciesChoices({});
  };

  const toggleLanguage = (lang: string) => {
    setChosenLanguages((prev) => {
      if (prev.includes(lang)) return prev.filter((l) => l !== lang);
      // PHB 2024 "Choose Languages" (L1627): Common + exactly two chosen. Never
      // add beyond the cap (the UI also disables unchecked boxes at the cap).
      if (prev.length >= CREATION_LANGUAGE_CHOICES) return prev;
      return [...prev, lang];
    });
  };

  // The feature-driven language grant for the chosen class at level 1 (the
  // wizard always creates a level-1 character). Derived from classes.ts via
  // featureLanguageGrants so the wizard stays consistent with the sheet.
  const featureGrant = useMemo(
    () =>
      classId === ''
        ? { fixed: [] as string[], chooseCount: 0 }
        : featureLanguageGrants({
            classes: [{ id: classId as ClassId, level: 1 }],
            level: 1,
          } as Character),
    [classId],
  );

  const toggleGrantedLanguage = (lang: string) => {
    setGrantedLanguages((prev) => {
      if (prev.includes(lang)) return prev.filter((l) => l !== lang);
      // Cap the feature picks at chooseCount, mirroring the creation-language cap.
      if (prev.length >= featureGrant.chooseCount) return prev;
      return [...prev, lang];
    });
  };

  // ─── Step 3 handlers ─────────────────────────────────────────────────────

  const assignScore = (
    ability: Ability,
    idx: number,
    isRoll: boolean,
  ) => {
    const setter = isRoll ? setRolledAssignment : setArrayAssignment;
    setter((prev) => {
      const next = { ...prev };
      // Clear any ability currently holding this pool index (each value used once).
      for (const a of ABILITIES) {
        if (next[a] === idx) delete next[a];
      }
      if (idx === -1) delete next[ability];
      else next[ability] = idx;
      return next;
    });
  };

  const rollScores = () => {
    const pool = rollAbilityScoreSet(createDefaultRng());
    setRolledPool(pool);
    setRolledAssignment({});
  };

  const setPointBuy = (ability: Ability, value: number) => {
    const clamped = Math.max(POINT_BUY_MIN_SCORE, Math.min(POINT_BUY_MAX_SCORE, value));
    setPointBuyScores((prev) => ({ ...prev, [ability]: clamped }));
  };

  // SUGGEST-DON'T-AUTO-APPLY: the ONLY state change this feature makes. On an
  // explicit tap it fills the six Standard-Array slots from the PHB "Standard
  // Array by Class" placement (class-guidance.ts); every slot stays fully
  // editable afterward, exactly like a manual Standard-Array assignment. The
  // recommended array is a permutation of the standard array, so each pool
  // index (STANDARD_ARRAY = 15/14/13/12/10/8) is consumed exactly once.
  const useRecommendedArray = () => {
    const recommended = recommendedArray(classId || undefined);
    if (!recommended) return;
    setAbilityMethod('standard-array');
    const assignment: Partial<Record<Ability, number>> = {};
    const takenIdx = new Set<number>();
    for (const ability of ABILITIES) {
      const target = recommended[ability];
      const idx = STANDARD_ARRAY.findIndex((v, i) => v === target && !takenIdx.has(i));
      if (idx !== -1) {
        assignment[ability] = idx;
        takenIdx.add(idx);
      }
    }
    setArrayAssignment(assignment);
  };

  // ─── Step 4 handlers (per-field flavor generators) ─────────────────────────

  const rng = useMemo(() => createDefaultRng(), []);

  const genName = () => {
    if (!speciesId) return;
    setName(generateName(speciesId, gender, rng));
  };
  const genAppearance = () => {
    if (!speciesId) return;
    const a = generateAppearance(speciesId, gender, rng);
    setDetails((prev) => ({
      ...prev,
      eyes: a.eyes,
      hair: a.hair,
      skin: a.skin,
      height: a.height,
      weight: a.weight,
    }));
  };
  const genPersonality = () => setDetails((prev) => ({ ...prev, personality: generatePersonality(rng) }));
  const genAlignment = () => setAlignment(ALIGNMENTS[Math.floor(rng() * ALIGNMENTS.length)]);
  const genFaith = () => setDetails((prev) => ({ ...prev, faith: generateDeity(rng) }));

  // ─── Completion ─────────────────────────────────────────────────────────

  const buildCharacter = (): Character => {
    let character = createCharacter(name.trim());

    // Class (single-class at level 1).
    character = {
      ...character,
      level: 1,
      classes: [{ id: classId as ClassId, level: 1, skillChoices: [...skillChoices] }],
    };

    // Species + required sub-choices.
    const speciesSelection: NonNullable<Character['species']> = { id: speciesId as SpeciesId };
    for (const [field, value] of Object.entries(speciesChoices)) {
      if (value) (speciesSelection as unknown as Record<string, unknown>)[field] = value;
    }
    character = { ...character, species: speciesSelection };

    // Base ability scores from the chosen method.
    character = { ...character, abilities: { ...resolvedScores }, abilityGenMethod: abilityMethod };

    // Gender + alignment + appearance + personality.
    character = {
      ...character,
      gender,
      ...(alignment ? { alignment: alignment as Character['alignment'] } : {}),
      ...(details.age ? { age: details.age } : {}),
      ...(details.height ? { height: details.height } : {}),
      ...(details.weight ? { weight: details.weight } : {}),
      ...(details.eyes ? { eyes: details.eyes } : {}),
      ...(details.hair ? { hair: details.hair } : {}),
      ...(details.skin ? { skin: details.skin } : {}),
      ...(details.faith ? { faith: details.faith } : {}),
      ...(details.personality ? { personality: details.personality } : {}),
    };

    // Languages (Common is implicit; store only the chosen extras). Feature
    // "choose N" picks (Rogue L1 Thieves' Cant +1, Ranger L2 Deft Explorer +2 —
    // PHB 2024) are stored separately in `granted`; the fixed auto-grant is
    // derived from the class and never persisted here.
    if (chosenLanguages.length > 0 || grantedLanguages.length > 0) {
      character = {
        ...character,
        languages: {
          chosen: [...chosenLanguages],
          ...(grantedLanguages.length > 0 ? { granted: [...grantedLanguages] } : {}),
        },
      };
    }

    // Background via the audited A6b path. For a category tool the player's
    // chosen tool id (if any) is passed; equipment resolves with the default
    // resolver (option A drops unresolved choices, as FEAT-001 documents).
    character = applyBackground(
      character,
      backgroundId as BackgroundId,
      {
        abilityAllocation: allocationList,
        toolProficiency: toolProficiency || background?.tool.id,
        equipmentChoice,
      },
      character.createdAt,
    );

    // Class starting equipment (the lettered option), plus anything bought with
    // the starting gold. PHB 2024 "Choose Starting Equipment".
    const classEquip = classEquipmentOptions(classId).find((o) => o.id === classOption);
    if (classEquip) {
      const granted = resolveOptionItems(classEquip, classPicks);
      const bought = cartItems(cart, newItemId);
      character = grantStartingEquipment(character, {
        items: [...granted.items, ...bought],
        goldGp: classEquip.goldGp,
        spentCopper: cartCopper(cart),
      });
    }

    // The free trinket (PHB 2024 "Trinkets"): a Tiny keepsake with no price.
    const trinket = trinketItem(trinketRoll);
    if (trinket) character = { ...character, inventory: [...(character.inventory ?? []), trinket] };

    // Starting spells, stored exactly as the Spells page stores them
    // (byClass[classId] = { cantrips, prepared, spellbook }); nothing else in
    // spellcasting is touched. Always-prepared feature spells are derived, never
    // stored; required cantrips are locked in and counted.
    if (hasSpellsStep) {
      const pools = startingSpellPools(classId);
      const always = pools?.alwaysPrepared ?? [];
      const required = pools?.required ?? [];
      // Whatever was picked, keep only spells the class can cast: its cantrip list
      // and level 1 list, and for a spellbook caster only prepared spells that are
      // in the book (picks are reset on a class change, this is the last guard).
      const cantripIds = new Set(pools?.cantrips.map((s) => s.id) ?? []);
      const leveledIds = new Set(pools?.leveled.map((s) => s.id) ?? []);
      const stored = (spellPicks.cantrips ?? []).filter((id) => cantripIds.has(id));
      const cantrips = [...required.filter((id) => !stored.includes(id)), ...stored];
      const spellbook = (spellPicks.spellbook ?? []).filter((id) => leveledIds.has(id));
      const prepared = (spellPicks.prepared ?? []).filter(
        (id) =>
          !always.includes(id) &&
          leveledIds.has(id) &&
          (startingChoicesFor(classId)?.spells?.spellbook == null || spellbook.includes(id)),
      );
      const picks: ClassSpellcasting = {
        ...(cantrips.length > 0 ? { cantrips } : {}),
        ...(spellbook.length > 0 ? { spellbook } : {}),
        ...(prepared.length > 0 ? { prepared } : {}),
      };
      if (Object.keys(picks).length > 0) {
        character = { ...character, spellcasting: { byClass: { [classId]: picks } } };
      }
    }

    return character;
  };

  const goNext = () => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      onComplete(buildCharacter());
    }
  };
  const goBack = () => {
    if (step === 0) onCancel();
    else setStep((s) => s - 1);
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderClassStep = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step {stepNumber('class')}: Class</h2>
      <label className={styles.fieldLabel} htmlFor="wiz-name">
        Character Name
      </label>
      <input
        id="wiz-name"
        className={styles.textInput}
        type="text"
        value={name}
        placeholder="Enter a name…"
        onChange={(e) => setName(e.target.value)}
      />
      <label className={styles.fieldLabel} htmlFor="wiz-class">
        Class
      </label>
      <select
        id="wiz-class"
        className={styles.select}
        value={classId}
        aria-label="Class"
        onChange={(e) => {
          setClassId(e.target.value as ClassId | '');
          // Feature-language picks belong to the chosen class; reset them when
          // the class changes so stale/over-cap picks cannot leak across.
          setGrantedLanguages([]);
          // Class skill picks belong to the class list; reset on change.
          setSkillChoices([]);
          // Spell picks belong to the class list; reset on change.
          setSpellPicks({});
          // Starting equipment belongs to the class too.
          setClassOption('A');
          setClassPicks({});
          setCart({});
        }}
      >
        <option value="">— Select a Class —</option>
        {CLASS_LIST.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Read-only class overview (DETERMINISTIC advisor; suggest, never apply).
          All facts are read from class data (PHB 2024 Core <Class> Traits) +
          SPELLCASTING_DESCRIPTORS; the blurb is a brief paraphrase. Appears only
          once a class is selected. */}
      {guidance && (
        <div className={styles.guidancePanel} role="note" aria-label="Class overview">
          <h3 className={styles.guidanceTitle}>
            About {CLASS_LIST.find((c) => c.id === classId)?.name}
          </h3>
          {guidance.blurb && <p className={styles.guidanceBlurb}>{guidance.blurb}</p>}
          <ul className={styles.guidanceFacts}>
            <li>
              Primary ability:{' '}
              {guidance.primaryAbilities
                .map((a) => ABILITY_NAMES[a])
                .join(guidance.primaryIsOr ? ' or ' : ' & ')}
            </li>
            <li>
              Saving throws: {guidance.savingThrows.map((a) => ABILITY_NAMES[a]).join(' & ')}
            </li>
            <li>Hit die: d{guidance.hitDie}</li>
            {guidance.spellcastingAbility && (
              <li>Spellcasting: {ABILITY_NAMES[guidance.spellcastingAbility]}</li>
            )}
          </ul>
          <p className={styles.guidanceCite}>Source: PHB 2024 Core Class Traits.</p>
        </div>
      )}
    </div>
  );

  const renderOriginStep = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step {stepNumber('origin')}: Origin</h2>

      <label className={styles.fieldLabel} htmlFor="wiz-background">
        Background
      </label>
      <select
        id="wiz-background"
        className={styles.select}
        value={backgroundId}
        aria-label="Background"
        onChange={(e) => selectBackground(e.target.value as BackgroundId)}
      >
        <option value="">— Select a Background —</option>
        {BACKGROUND_LIST.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <BackgroundDetails selected={background} onChoose={selectBackground} />

      {/* Background-fit hint (DETERMINISTIC advisor; a nudge only — does NOT
          restrict the pick). Lists the backgrounds that boost the chosen class's
          primary ability, from the PHB 2024 "Ability Scores and Backgrounds"
          table (class-guidance.ts). Any background remains selectable. */}
      {suggestedBgIds.length > 0 && (
        <p className={styles.hint} role="note" aria-label="Backgrounds that suit this class">
          Backgrounds that suit a{' '}
          {CLASS_LIST.find((c) => c.id === classId)?.name ?? 'this'}:{' '}
          {suggestedBgIds
            .map((id) => getBackground(id)?.name ?? id)
            .join(', ')}
          . Any background works — this is just a suggestion (PHB 2024 "Ability
          Scores and Backgrounds").
        </p>
      )}

      {background && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.fieldLabel}>
            Ability Scores — increase one by 2 and another by 1, or all three by 1
          </legend>
          {background.abilities.map((ability) => (
            <div key={ability} className={styles.allocRow}>
              <span className={styles.allocName}>{ABILITY_NAMES[ability]}</span>
              <select
                className={styles.selectSmall}
                value={allocation[ability] ?? 0}
                aria-label={`${ABILITY_NAMES[ability]} background increase`}
                onChange={(e) => setAllocationAmount(ability, Number(e.target.value))}
              >
                <option value={0}>+0</option>
                <option value={1}>+1</option>
                <option value={2}>+2</option>
              </select>
            </div>
          ))}
          {!allocationValid && (
            <p className={styles.hint} role="status">
              Choose +2/+1 on two abilities, or +1 on all three.
            </p>
          )}

          <label className={styles.fieldLabel} htmlFor="wiz-tool">
            Tool Proficiency: {background.tool.label}
          </label>
          {background.tool.category ? (
            <input
              id="wiz-tool"
              className={styles.textInput}
              type="text"
              value={toolProficiency}
              placeholder="Name your chosen tool…"
              aria-label="Tool proficiency choice"
              onChange={(e) => setToolProficiency(e.target.value)}
            />
          ) : (
            <p className={styles.hint}>{background.tool.label}</p>
          )}
        </fieldset>
      )}

      <label className={styles.fieldLabel} htmlFor="wiz-species">
        Species
      </label>
      <select
        id="wiz-species"
        className={styles.select}
        value={speciesId}
        aria-label="Species"
        onChange={(e) => selectSpecies(e.target.value as SpeciesId)}
      >
        <option value="">— Select a Species —</option>
        {SPECIES_LIST.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {species?.choices?.map((spec: SpeciesChoiceSpec) => (
        <div key={spec.field} className={styles.allocRow}>
          <label className={styles.allocName} htmlFor={`wiz-species-${spec.field}`}>
            {spec.label}
          </label>
          <select
            id={`wiz-species-${spec.field}`}
            className={styles.selectSmall}
            value={speciesChoices[spec.field] ?? ''}
            aria-label={spec.label}
            onChange={(e) =>
              setSpeciesChoices((prev) => ({ ...prev, [spec.field]: e.target.value }))
            }
          >
            <option value="">choose…</option>
            {choiceOptions(spec).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
                {o.note ? ` (${o.note})` : ''}
              </option>
            ))}
          </select>
        </div>
      ))}

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldLabel}>
          Languages (Common + choose {CREATION_LANGUAGE_CHOICES})
        </legend>
        <p className={styles.hint}>
          Known:{' '}
          {knownLanguages({
            classes: classId === '' ? undefined : [{ id: classId as ClassId, level: 1 }],
            level: 1,
            languages: { chosen: chosenLanguages, granted: grantedLanguages },
          } as Character)
            .map(formatLanguage)
            .join(', ')}
          {' — '}
          {chosenLanguages.length} of {CREATION_LANGUAGE_CHOICES} chosen
        </p>
        <div className={styles.langGrid}>
          {LANGUAGES.map((lang) => {
            const selected = chosenLanguages.includes(lang);
            // PHB 2024 "Choose Languages" (L1627): Common + exactly two chosen.
            // Once the cap is reached, the remaining options are disabled so the
            // player cannot pick a third (the toggle handler enforces this too).
            const atCap = chosenLanguages.length >= CREATION_LANGUAGE_CHOICES;
            return (
              <label key={lang} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={!selected && atCap}
                  aria-label={formatLanguage(lang)}
                  onChange={() => toggleLanguage(lang)}
                />
                {formatLanguage(lang)}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Base-class feature languages (PHB 2024): Rogue L1 "Thieves' Cant"
          auto-grants Thieves' Cant + 1 choice; Ranger L2 "Deft Explorer" grants
          2 choices. Surfaced once a class is chosen. The fixed auto-grant is
          read-only; the "choose N" picks write into languages.granted. */}
      {classId !== '' && (featureGrant.fixed.length > 0 || featureGrant.chooseCount > 0) && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.fieldLabel}>
            {CLASS_LIST.find((c) => c.id === classId)?.name ?? 'Class'} feature languages
            {featureGrant.chooseCount > 0 && <> — choose {featureGrant.chooseCount}</>}
          </legend>
          {featureGrant.fixed.length > 0 && (
            <p className={styles.hint}>
              Known automatically: {featureGrant.fixed.map(formatLanguage).join(', ')}
            </p>
          )}
          {featureGrant.chooseCount > 0 && (
            <>
              <p className={styles.hint}>
                {grantedLanguages.length} of {featureGrant.chooseCount} chosen
              </p>
              <div className={styles.langGrid}>
                {LANGUAGES.filter(
                  (lang) => !featureGrant.fixed.includes(lang),
                ).map((lang) => {
                  const selected = grantedLanguages.includes(lang);
                  const atCap = grantedLanguages.length >= featureGrant.chooseCount;
                  return (
                    <label key={lang} className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={!selected && atCap}
                        aria-label={`${formatLanguage(lang)} (feature)`}
                        onChange={() => toggleGrantedLanguage(lang)}
                      />
                      {formatLanguage(lang)}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </fieldset>
      )}
    </div>
  );

  const renderAbilityAssignRows = (pool: number[], isRoll: boolean) => {
    const assignment = isRoll ? rolledAssignment : arrayAssignment;
    return ABILITIES.map((ability) => {
      const idx = assignment[ability];
      const score = idx !== undefined ? pool[idx] : undefined;
      // Breakdown: the assigned pool value IS the base score (no addends at creation).
      const breakdown: Breakdown = {
        total: score ?? 10,
        components: [{ label: `${ABILITY_ABBR[ability]} (assigned)`, value: score ?? 10 }],
      };
      const mod = abilityModifier(score ?? 10);
      const modBreakdown: Breakdown = {
        total: mod,
        components: [{ label: 'From score', value: mod }],
        note: `Score ${score ?? 10}`,
      };
      // Per-ability guidance tags + recommended value (DETERMINISTIC advisor;
      // read-only). From abilityHints/recommendedArray (class-guidance.ts), the
      // PHB "Standard Array by Class" placement + the class saves.
      const isPrimary = hints?.primaryPlacement === ability;
      const isDump = hints?.dumpPlacement === ability;
      const isSave = hints?.saveAbilities.includes(ability) ?? false;
      const recommendedScore = hints?.recommended[ability];
      return (
        <div key={ability} className={styles.allocRow}>
          <span className={styles.allocName}>
            {ABILITY_NAMES[ability]}
            {hints && (
              <span className={styles.abilityTags}>
                {' '}
                {isPrimary && (
                  <span
                    className={`${styles.tag} ${styles.tagPrimary}`}
                    title="Your primary ability — put your highest score here"
                  >
                    Primary
                  </span>
                )}
                {isSave && <span className={`${styles.tag} ${styles.tagSave}`}>Save</span>}
                {isDump && !isPrimary && (
                  <span
                    className={`${styles.tag} ${styles.tagDump}`}
                    title="Safe to dump — least important for this class"
                  >
                    Dump
                  </span>
                )}
              </span>
            )}
          </span>
          {recommendedScore !== undefined && (
            <CalculatedValue
              label={`${ABILITY_NAMES[ability]} — Recommended`}
              className={styles.recommendedNote}
              breakdown={{
                total: recommendedScore,
                components: [{ label: 'PHB Standard Array by Class', value: recommendedScore }],
                note: 'A flat PHB suggestion — not an additive total.',
              }}
            >
              Rec: {recommendedScore}
            </CalculatedValue>
          )}
          <select
            className={styles.selectSmall}
            value={idx ?? -1}
            aria-label={`${ABILITY_NAMES[ability]} score assignment`}
            onChange={(e) => assignScore(ability, Number(e.target.value), isRoll)}
          >
            <option value={-1}>—</option>
            {pool.map((v, i) => {
              const takenBy = ABILITIES.find((a) => assignment[a] === i && a !== ability);
              return (
                <option key={i} value={i} disabled={takenBy !== undefined}>
                  {v}
                </option>
              );
            })}
          </select>
          {score !== undefined && (
            <span className={styles.totalCell}>
              <CalculatedValue label={`${ABILITY_NAMES[ability]} Score`} breakdown={breakdown}>
                {score}
              </CalculatedValue>
              <CalculatedValue
                label={`${ABILITY_NAMES[ability]} Modifier`}
                breakdown={modBreakdown}
                className={styles.modValue}
              >
                {formatSigned(mod)}
              </CalculatedValue>
            </span>
          )}
        </div>
      );
    });
  };

  const renderAbilitiesStep = () => {
    const spent = pointBuyTotalCost(pointBuyScores);
    const remaining = POINT_BUY_BUDGET - spent;
    const spentBreakdown: Breakdown = {
      total: spent,
      components: ABILITIES.map((a) => ({
        label: ABILITY_ABBR[a],
        value: pointBuyCost(pointBuyScores[a]) ?? 0,
      })),
    };
    const remainingBreakdown: Breakdown = {
      total: remaining,
      components: [
        { label: 'Budget', value: POINT_BUY_BUDGET },
        { label: 'Spent', value: -spent },
      ],
    };

    return (
      <div className={styles.stepBody}>
        <h2 className={styles.stepTitle}>Step {stepNumber('abilities')}: Ability Scores</h2>
        <SegmentedControl
          ariaLabel="Ability score method"
          options={[
            { value: 'standard-array', label: 'Standard Array' },
            { value: 'point-buy', label: 'Point Buy' },
            { value: 'roll', label: 'Roll 4d6' },
          ]}
          value={abilityMethod}
          onChange={(v) => setAbilityMethod(v as AbilityMethod)}
        />

        {/* Optional one-tap recommended-array fill (SUGGEST-DON'T-AUTO-APPLY:
            the only state change this feature makes, on an explicit tap). Fills
            the Standard-Array slots from the PHB "Standard Array by Class"
            placement; fully editable afterward. Shown only when a class is
            selected. */}
        {classId !== '' && (
          <div className={styles.methodBody}>
            <button type="button" className={styles.recommendBtn} onClick={useRecommendedArray}>
              Use recommended array
            </button>
            <p className={styles.hint}>
              Fills the standard array with the PHB suggested placement for a{' '}
              {CLASS_LIST.find((c) => c.id === classId)?.name}. It is only a
              suggestion — every score stays editable.
            </p>
          </div>
        )}

        {abilityMethod === 'standard-array' && (
          <div className={styles.methodBody}>
            <p className={styles.hint}>
              Assign each of {STANDARD_ARRAY.join(', ')} to one ability.
            </p>
            {renderAbilityAssignRows(STANDARD_ARRAY, false)}
          </div>
        )}

        {abilityMethod === 'point-buy' && (
          <div className={styles.methodBody}>
            <div className={styles.budgetRow}>
              <span>
                Spent:{' '}
                <CalculatedValue label="Point Buy Spent" breakdown={spentBreakdown}>
                  {spent}
                </CalculatedValue>
              </span>
              <span>
                Remaining:{' '}
                <CalculatedValue label="Point Buy Remaining" breakdown={remainingBreakdown}>
                  {remaining}
                </CalculatedValue>{' '}
                / {POINT_BUY_BUDGET}
              </span>
            </div>
            {!isPointBuyValid(pointBuyScores) && (
              <p className={styles.hint} role="status">
                Scores must be {POINT_BUY_MIN_SCORE}–{POINT_BUY_MAX_SCORE} and cost at most{' '}
                {POINT_BUY_BUDGET} points.
              </p>
            )}
            {ABILITIES.map((ability) => {
              const value = pointBuyScores[ability];
              const mod = abilityModifier(value);
              const modBreakdown: Breakdown = {
                total: mod,
                components: [{ label: 'From score', value: mod }],
                note: `Score ${value}`,
              };
              return (
                <div key={ability} className={styles.allocRow}>
                  <span className={styles.allocName}>{ABILITY_NAMES[ability]}</span>
                  <div className={styles.stepper}>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      aria-label={`Decrease ${ABILITY_NAMES[ability]}`}
                      onClick={() => setPointBuy(ability, value - 1)}
                    >
                      −
                    </button>
                    <span className={styles.stepperValue}>{value}</span>
                    <button
                      type="button"
                      className={styles.stepBtn}
                      aria-label={`Increase ${ABILITY_NAMES[ability]}`}
                      onClick={() => setPointBuy(ability, value + 1)}
                    >
                      +
                    </button>
                  </div>
                  <span className={styles.totalCell}>
                    <CalculatedValue
                      label={`${ABILITY_NAMES[ability]} Modifier`}
                      breakdown={modBreakdown}
                      className={styles.modValue}
                    >
                      {formatSigned(mod)}
                    </CalculatedValue>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {abilityMethod === 'roll' && (
          <div className={styles.methodBody}>
            <button type="button" className={styles.rollBtn} onClick={rollScores}>
              🎲 Roll 4d6 (drop lowest) × 6
            </button>
            {rolledPool ? (
              <>
                <p className={styles.hint}>
                  Rolled: {rolledPool.join(', ')}. Assign each to an ability.
                </p>
                {renderAbilityAssignRows(rolledPool, true)}
              </>
            ) : (
              <p className={styles.hint}>Roll to generate six scores.</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderDetailsStep = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step {stepNumber('details')}: Alignment &amp; Details</h2>
      <label className={styles.fieldLabel} htmlFor="wiz-gender">
        Gender (drives name/appearance generation)
      </label>
      <select
        id="wiz-gender"
        className={styles.select}
        value={gender}
        aria-label="Gender"
        onChange={(e) => setGender(e.target.value as NameGender)}
      >
        {GENDERS.map((g) => (
          <option key={g.value} value={g.value}>
            {g.label}
          </option>
        ))}
      </select>

      <div className={styles.genRow}>
        <label className={styles.fieldLabel} htmlFor="wiz-alignment">
          Alignment
        </label>
        <select
          id="wiz-alignment"
          className={styles.select}
          value={alignment}
          aria-label="Alignment"
          onChange={(e) => setAlignment(e.target.value)}
        >
          <option value="">— None —</option>
          {ALIGNMENTS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button type="button" className={styles.genBtn} onClick={genAlignment} aria-label="Generate alignment">
          🎲
        </button>
      </div>

      {/* Faith / Deity: a <datalist> of the 27 Gods of Greyhawk suggestions
          plus free text (homebrew / other-setting deities stay allowed). The
          🎲 picks a random catalog deity. */}
      <div className={styles.genRow}>
        <label className={styles.fieldLabel} htmlFor="wiz-faith">
          Faith / Deity (optional)
        </label>
        <input
          id="wiz-faith"
          className={styles.textInput}
          type="text"
          list="wiz-faith-list"
          value={details.faith}
          aria-label="Faith / Deity"
          placeholder="Deity name or homebrew"
          onChange={(e) => setDetails((prev) => ({ ...prev, faith: e.target.value }))}
        />
        <datalist id="wiz-faith-list">
          {DEITY_LIST.map((d) => (
            <option key={d.id} value={d.name}>
              {d.epithet}
            </option>
          ))}
        </datalist>
        <button type="button" className={styles.genBtn} onClick={genFaith} aria-label="Generate deity">
          🎲
        </button>
      </div>

      <div className={styles.genRow}>
        <span className={styles.fieldLabel}>Name</span>
        <input
          className={styles.textInput}
          type="text"
          value={name}
          aria-label="Name"
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          className={styles.genBtn}
          onClick={genName}
          disabled={!speciesId}
          aria-label="Generate name"
        >
          🎲
        </button>
      </div>

      <div className={styles.genRow}>
        <span className={styles.fieldLabel}>Appearance</span>
        <span className={styles.hint}>
          {details.eyes || details.hair || details.height
            ? `Eyes: ${details.eyes || '—'}, Hair: ${details.hair || '—'}, Skin: ${
                details.skin || '—'
              }, ${details.height || '—'} / ${details.weight || '—'}`
            : 'Not set'}
        </span>
        <button
          type="button"
          className={styles.genBtn}
          onClick={genAppearance}
          disabled={!speciesId}
          aria-label="Generate appearance"
        >
          🎲
        </button>
      </div>

      <div className={styles.genRow}>
        <label className={styles.fieldLabel} htmlFor="wiz-personality">
          Personality
        </label>
        <textarea
          id="wiz-personality"
          className={styles.textarea}
          value={details.personality}
          rows={3}
          onChange={(e) => setDetails((prev) => ({ ...prev, personality: e.target.value }))}
        />
        <button type="button" className={styles.genBtn} onClick={genPersonality} aria-label="Generate personality">
          🎲
        </button>
      </div>
    </div>
  );

  const renderEquipmentStep = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step {stepNumber('equipment')}: Equipment</h2>
      <EquipmentStep
        classId={classId}
        background={background}
        classOption={classOption}
        onClassOption={chooseClassOption}
        classPicks={classPicks}
        onClassPick={(entry, name) => setClassPicks((p) => ({ ...p, [entry]: name }))}
        backgroundChoice={equipmentChoice}
        onBackgroundChoice={chooseBackgroundEquipment}
        cart={cart}
        onCartChange={changeCart}
        trinketRoll={trinketRoll}
        onTrinketRoll={setTrinketRoll}
        scores={effectiveScores}
      />
    </div>
  );  const renderSkillsStep = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step {stepNumber('skills')}: Skills</h2>
      <SkillsStep
        classId={classId}
        backgroundId={backgroundId}
        speciesId={speciesId}
        speciesChoices={speciesChoices}
        chosen={skillChoices}
        onChange={setSkillChoices}
      />
    </div>
  );

  const renderSpellsStep = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step {stepNumber('spells')}: Spells</h2>
      <SpellsStep classId={classId} value={spellPicks} onChange={setSpellPicks} />
    </div>
  );

  const renderReviewStep = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step {stepNumber('review')}: Review</h2>
      <ReviewStep character={buildCharacter()} />
    </div>
  );

  const stepRenderers: Record<StepId, () => ReactElement> = {
    class: renderClassStep,
    origin: renderOriginStep,
    skills: renderSkillsStep,
    abilities: renderAbilitiesStep,
    details: renderDetailsStep,
    equipment: renderEquipmentStep,
    spells: renderSpellsStep,
    review: renderReviewStep,
  };

  return (
    <div className={styles.wizard} role="region" aria-label="Character creation wizard">
      <StepIndicator steps={stepLabels} currentStep={step} />
      {stepRenderers[currentStepId]()}
      <div className={styles.footer}>
        <button type="button" className={styles.secondaryBtn} onClick={goBack}>
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={goNext}
          disabled={!canProceed()}
        >
          {step === steps.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  );
}
