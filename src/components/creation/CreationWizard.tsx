import { useEffect, useMemo, useRef, useState } from 'react';
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
import { ClassCompare } from './ClassCompare';
import { SpeciesDetails } from './SpeciesDetails';
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
  generateAge,
} from '../../logic/personal-details-generation';
import { allDeityOptions } from '../../logic/deity-recommendations';
import { DeitySuggestions } from './DeitySuggestions';
import type { NameGender } from '../../data/name-tables';
import { createDefaultRng } from '../../logic/random';
import { formatSigned, type Breakdown } from '../../logic/breakdown';
import {
  classGuidance,
  abilityHints,
  recommendedArray,
  suggestedBackgrounds,
} from '../../logic/class-guidance';
import {
  ABILITY_METHOD_INFO,
  ABILITY_METHOD_SOURCE,
  ALIGNMENT_INFO,
  CLASS_OVERVIEW,
  EVIL_ALIGNMENT_NOTE,
  PAST_PROMPTS,
  PAST_PROMPTS_SOURCE,
  isEvilAlignment,
  speciesLanguageSuggestions,
  suggestedBackgroundIncrease,
  suggestedSpeciesSpellAbility,
  toolChoicesFor,
} from '../../logic/creation-guidance';
import { resolveAbilityTooltip, resolveLanguageTooltip, resolveSkillTooltip } from '../../logic/tooltip-content';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import { SKILLS } from '../../types/character';
import type { SkillId as WizardSkillId } from '../../types/character';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { SegmentedControl } from '../shared/SegmentedControl';
import { StepIndicator } from '../combat/StepIndicator';
import { choiceOptions, formatLanguage } from '../pages/sheet-helpers';
import { SkillsStep } from './SkillsStep';
import { SpellsStep } from './SpellsStep';
import { ReviewStep } from './ReviewStep';
import type { ReviewEditTarget } from './ReviewStep';
import {
  clearWizardDraft,
  draftHasProgress,
  loadWizardDraft,
  saveWizardDraft,
  type WizardDraft,
} from '../../logic/wizard-draft';
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
  | 'background'
  | 'species'
  | 'skills'
  | 'abilities'
  | 'spells'
  | 'details'
  | 'equipment'
  | 'review';
const ALL_STEPS: { id: StepId; label: string }[] = [
  { id: 'class', label: 'Class' },
  // PHB 2024 "Determine Origin" is background + species + languages; it is two
  // steps here so each screen stays short.
  { id: 'background', label: 'Background' },
  { id: 'species', label: 'Species' },
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

  /**
   * What still has to be done before Next (or Finish) works on this step, in
   * plain words, so a disabled button always says why. The name is only needed
   * to Finish: by then the species is known, so the Details step's name
   * generator can suggest one.
   */
  const missingForStep = (id: StepId = currentStepId): string[] => {
    const missing: string[] = [];
    switch (id) {
      case 'class':
        if (classId === '') missing.push('choose a class');
        break;
      case 'background':
        if (backgroundId === '') missing.push('choose a background');
        else if (!allocationValid) missing.push('set your background ability increases (+2 and +1, or +1 to all three)');
        break;
      case 'species':
        if (speciesId === '') missing.push('choose a species');
        break;
      case 'abilities':
        if (!abilityStepValid()) {
          if (abilityMethod === 'point-buy') missing.push('keep every score between 8 and 15 within the 27 points');
          else if (abilityMethod === 'roll' && rolledPool === null) missing.push('roll your scores');
          else missing.push('give each ability one of the scores');
        }
        break;
      case 'review':
        if (name.trim().length === 0) missing.push('give your character a name (the Details step can roll one)');
        break;
      // Skills, Spells, Details and Equipment never block: unfinished picks
      // surface on the Overview later.
      default:
        break;
    }
    return missing;
  };
  const missing = missingForStep();
  const canProceed = (): boolean => missing.length === 0;

  // The furthest step reached, so the step bar can jump back and forward to any
  // step already visited, as long as every step before it is complete.
  const [furthest, setFurthest] = useState(0);
  const canJumpTo = (index: number): boolean =>
    index <= Math.min(furthest, steps.length - 1) &&
    steps.slice(0, index).every((s) => s.id === 'review' || missingForStep(s.id).length === 0);
  const jumpTo = (index: number) => {
    if (canJumpTo(index)) setStep(index);
  };
  /** Review's Edit links: back to the step that owns a section. */
  const editStep = (target: ReviewEditTarget) => {
    const index = steps.findIndex((s) => s.id === target);
    if (index >= 0) setStep(index);
  };

  // ─── Step 1 handlers ─────────────────────────────────────────────────────

  // A pending change that would clear picks the player has made, awaiting OK.
  const [pendingChange, setPendingChange] = useState<
    { kind: 'class'; id: ClassId | ''; message: string } | { kind: 'background'; id: BackgroundId; message: string } | null
  >(null);

  /** What a class change would clear, in words (empty when nothing is set). */
  const classDependents = (): string[] => {
    const out: string[] = [];
    if (skillChoices.length > 0) out.push('your class skill picks');
    if (Object.values(spellPicks).some((v) => (v ?? []).length > 0)) out.push('your spell picks');
    if (classOption !== 'A' || Object.keys(classPicks).length > 0 || Object.keys(cart).length > 0)
      out.push('your class equipment choices and purchases');
    if (grantedLanguages.length > 0) out.push('your class feature languages');
    return out;
  };
  const listText = (items: string[]) =>
    items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

  const requestClass = (id: ClassId | '') => {
    if (id === classId) return;
    const lost = classDependents();
    if (lost.length === 0) {
      selectClass(id);
      return;
    }
    const nextName = CLASS_LIST.find((c) => c.id === id)?.name ?? 'no class';
    setPendingChange({ kind: 'class', id, message: `Change class to ${nextName}? This clears ${listText(lost)}.` });
  };
  const requestBackground = (id: BackgroundId) => {
    if (id === backgroundId) return;
    const lost: string[] = [];
    if (Object.keys(allocation).length > 0) lost.push('your background ability increases');
    if (toolProficiency) lost.push('your tool choice');
    if (lost.length === 0) {
      selectBackground(id);
      return;
    }
    const nextName = getBackground(id)?.name ?? 'that background';
    setPendingChange({ kind: 'background', id, message: `Change background to ${nextName}? This clears ${listText(lost)}.` });
  };

  const selectClass = (id: ClassId | '') => {
    setClassId(id);
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
  };

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

  // SUGGEST-DON'T-AUTO-APPLY: on an explicit tap, place the ROLLED scores the way
  // the PHB "Standard Array by Class" table ranks the class's abilities: highest
  // roll to the ability the class ranks highest, and so on. PHB 2024 L1691: the
  // table can guide where you put your highest and lowest scores whichever method
  // you used. Every slot stays editable.
  const placeRolledByClass = () => {
    const ranks = recommendedArray(classId || undefined);
    if (!ranks || !rolledPool) return;
    const abilityOrder = [...ABILITIES].sort((a, b) => ranks[b] - ranks[a]);
    const poolOrder = rolledPool.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const assignment: Partial<Record<Ability, number>> = {};
    abilityOrder.forEach((ability, n) => {
      assignment[ability] = poolOrder[n].i;
    });
    setRolledAssignment(assignment);
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
  const genAge = () => {
    if (!speciesId) return;
    setDetails((prev) => ({ ...prev, age: generateAge(speciesId, rng) }));
  };
  const setDetail = (field: keyof typeof details, value: string) =>
    setDetails((prev) => ({ ...prev, [field]: value }));
  const genPersonality = () => setDetails((prev) => ({ ...prev, personality: generatePersonality(rng, alignment || undefined) }));
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

  // ─── Draft: keep an unfinished build across a reload or closed tab ────────
  const [savedDraft, setSavedDraft] = useState<WizardDraft | null>(() => {
    const d = loadWizardDraft();
    return d && draftHasProgress(d) ? d : null;
  });
  const resumeDraft = (d: WizardDraft) => {
    setName(d.name);
    setClassId(d.classId as ClassId | '');
    setBackgroundId(d.backgroundId as BackgroundId | '');
    setAllocation(d.allocation as Partial<Record<Ability, number>>);
    setSpeciesId(d.speciesId as SpeciesId | '');
    setSpeciesChoices(d.speciesChoices);
    setChosenLanguages(d.chosenLanguages);
    setGrantedLanguages(d.grantedLanguages);
    setToolProficiency(d.toolProficiency);
    setSkillChoices(d.skillChoices as SkillId[]);
    setSpellPicks(d.spellPicks as ClassSpellcasting);
    setAbilityMethod(d.abilityMethod);
    setArrayAssignment(d.arrayAssignment as Partial<Record<Ability, number>>);
    setPointBuyScores({ ...EMPTY_SCORES, ...(d.pointBuyScores as Partial<Record<Ability, number>>) });
    setRolledPool(d.rolledPool);
    setRolledAssignment(d.rolledAssignment as Partial<Record<Ability, number>>);
    setGender(d.gender);
    setAlignment(d.alignment);
    setDetails((prev) => ({ ...prev, ...d.details }));
    setEquipmentChoice(d.equipmentChoice);
    setClassOption(d.classOption as ClassOptionId);
    setClassPicks(d.classPicks);
    setCart(d.cart);
    setTrinketRoll(d.trinketRoll);
    setFurthest(d.furthest);
    setStep(d.step);
    setSavedDraft(null);
  };
  const discardDraft = () => {
    clearWizardDraft();
    setSavedDraft(null);
  };
  // Save as the player goes (not while a saved draft is still on offer, so
  // starting fresh by accident can't overwrite it before they choose).
  useEffect(() => {
    if (savedDraft !== null) return;
    if (classId === '' && name.trim() === '') return;
    saveWizardDraft({
      v: 1,
      savedAt: Date.now(),
      step,
      furthest,
      name,
      classId,
      backgroundId,
      allocation: allocation as Record<string, number>,
      speciesId,
      speciesChoices,
      chosenLanguages,
      grantedLanguages,
      toolProficiency,
      skillChoices,
      spellPicks: spellPicks as WizardDraft['spellPicks'],
      abilityMethod,
      arrayAssignment: arrayAssignment as Record<string, number>,
      pointBuyScores,
      rolledPool,
      rolledAssignment: rolledAssignment as Record<string, number>,
      gender,
      alignment,
      details,
      equipmentChoice,
      classOption,
      classPicks,
      cart,
      trinketRoll,
    });
  }, [
    savedDraft, step, furthest, name, classId, backgroundId, allocation, speciesId, speciesChoices,
    chosenLanguages, grantedLanguages, toolProficiency, skillChoices, spellPicks, abilityMethod,
    arrayAssignment, pointBuyScores, rolledPool, rolledAssignment, gender, alignment, details,
    equipmentChoice, classOption, classPicks, cart, trinketRoll,
  ]);

  // On a step change, scroll the new step's heading into view and move focus to
  // it, so a long step never opens part-way down and screen readers announce it.
  const stepRef = useRef<HTMLDivElement>(null);
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    const heading = stepRef.current?.querySelector<HTMLElement>('h2');
    if (!heading) return;
    heading.tabIndex = -1;
    heading.scrollIntoView?.({ block: 'start' });
    heading.focus({ preventScroll: true });
  }, [step]);

  const goNext = () => {
    if (step < steps.length - 1) {
      setFurthest((f) => Math.max(f, step + 1));
      setStep((s) => s + 1);
    } else {
      clearWizardDraft();
      onComplete(buildCharacter());
    }
  };
  const goBack = () => {
    if (step === 0) onCancel();
    else setStep((s) => s - 1);
  };

  // ─── Derived: origin suggestions (shown only; the player still chooses) ────

  const allocationSuggestion =
    background && classId !== '' ? suggestedBackgroundIncrease(classId, background.abilities) : null;
  const applyAllocationSuggestion = () => {
    if (!allocationSuggestion) return;
    setAllocation({ [allocationSuggestion.plusTwo]: 2, [allocationSuggestion.plusOne]: 1 });
  };
  const languageSuggestions = speciesLanguageSuggestions(speciesId || undefined).filter((l) =>
    (LANGUAGES as readonly string[]).includes(l),
  );
  const skillName = (id: string) => SKILLS.find((s) => s.id === id)?.name ?? id;

  /** A short hint under a species sub-choice, so the player knows what to pick. */
  const speciesChoiceHint = (spec: SpeciesChoiceSpec) => {
    if (spec.kind === 'spellcastingAbility') {
      const s = suggestedSpeciesSpellAbility(classId || undefined, spec.options.map((o) => o.id));
      if (!s) return <p className={styles.hint}>The ability your species&apos; spells use. Pick a class first for a suggestion.</p>;
      return (
        <p className={styles.hint} data-testid="wiz-species-ability-hint">
          Suggested: {ABILITY_NAMES[s.ability]},{' '}
          {s.reason === 'class-spellcasting'
            ? `the ability your ${CLASS_LIST.find((c) => c.id === classId)?.name} casts spells with, so one high score powers both.`
            : `your highest of these for a ${CLASS_LIST.find((c) => c.id === classId)?.name}.`}
        </p>
      );
    }
    if (spec.kind === 'keenSensesSkill' || spec.kind === 'skillfulSkill') {
      const held = background?.skills ?? [];
      return (
        <p className={styles.hint}>
          {held.length > 0
            ? `Pick one your background doesn't already give (${held.map(skillName).join(', ')}).`
            : 'Pick a skill you want to be good at.'}{' '}
          {speciesChoices[spec.field] ? (
            <MaybeContentTooltip
              content={resolveSkillTooltip(speciesChoices[spec.field] as WizardSkillId)}
              ariaLabel={`About ${skillName(speciesChoices[spec.field])}`}
            >
              What {skillName(speciesChoices[spec.field])} is for
            </MaybeContentTooltip>
          ) : null}
        </p>
      );
    }
    if (spec.kind === 'size') {
      return <p className={styles.hint}>Pick whichever fits how you picture your character. A few rules care about size, such as which creatures you can grapple.</p>;
    }
    return null;
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
        placeholder="Enter a name, or leave it for later"
        aria-describedby="wiz-name-hint"
        onChange={(e) => setName(e.target.value)}
      />
      <p id="wiz-name-hint" className={styles.hint}>
        No name yet? Leave it blank. Once you pick a species, the Details step can roll one that suits it.
      </p>
      <label className={styles.fieldLabel} htmlFor="wiz-class">
        Class
      </label>
      <select
        id="wiz-class"
        className={styles.select}
        value={classId}
        aria-label="Class"
        onChange={(e) => requestClass(e.target.value as ClassId | '')}
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
            {CLASS_OVERVIEW[classId] && (
              <>
                <li>Likes: {CLASS_OVERVIEW[classId].likes}</li>
                <li>Complexity: {CLASS_OVERVIEW[classId].complexity}</li>
              </>
            )}
            <li>Hit die: d{guidance.hitDie}</li>
            {guidance.spellcastingAbility && (
              <li>Spellcasting: {ABILITY_NAMES[guidance.spellcastingAbility]}</li>
            )}
          </ul>
          <p className={styles.guidanceCite}>Source: PHB 2024 Core Class Traits; "Class Overview" table.</p>
        </div>
      )}

      <ClassCompare selected={classId} onChoose={requestClass} />
    </div>
  );

  const renderBackgroundStep = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step {stepNumber('background')}: Background</h2>

      <label className={styles.fieldLabel} htmlFor="wiz-background">
        Background
      </label>
      <select
        id="wiz-background"
        className={styles.select}
        value={backgroundId}
        aria-label="Background"
        onChange={(e) => requestBackground(e.target.value as BackgroundId)}
      >
        <option value="">— Select a Background —</option>
        {BACKGROUND_LIST.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <BackgroundDetails selected={background} onChoose={requestBackground} />

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
          {/* SUGGEST-DON'T-AUTO-APPLY: fills the +2/+1 only on an explicit tap,
              ranked by the class's PHB Standard Array by Class placement. */}
          {allocationSuggestion && (
            <div className={styles.methodBody}>
              <button type="button" className={styles.recommendBtn} onClick={applyAllocationSuggestion}>
                Suggest for my class
              </button>
              <p className={styles.hint}>
                +2 {ABILITY_NAMES[allocationSuggestion.plusTwo]} and +1{' '}
                {ABILITY_NAMES[allocationSuggestion.plusOne]}: the abilities a{' '}
                {CLASS_LIST.find((c) => c.id === classId)?.name} relies on most. Raising your best score
                makes you better at what your class does.
              </p>
            </div>
          )}

          <label className={styles.fieldLabel} htmlFor="wiz-tool">
            Tool Proficiency: {background.tool.label}
          </label>
          {background.tool.category ? (
            <>
              <select
                id="wiz-tool"
                className={styles.select}
                value={toolProficiency}
                aria-label="Tool proficiency choice"
                onChange={(e) => setToolProficiency(e.target.value)}
              >
                <option value="">— Choose a tool —</option>
                {toolChoicesFor(background.tool.category).map((tool) => (
                  <option key={tool.name} value={tool.name}>
                    {tool.name}
                  </option>
                ))}
              </select>
              {(() => {
                const chosenTool = toolChoicesFor(background.tool.category).find((x) => x.name === toolProficiency);
                return chosenTool?.description ? (
                  <p className={styles.hint} data-testid="wiz-tool-description">
                    {chosenTool.description}
                  </p>
                ) : (
                  <p className={styles.hint}>
                    You&apos;re proficient with the kind you pick, so you add your Proficiency Bonus when you use it.
                  </p>
                );
              })()}
            </>
          ) : (
            <p className={styles.hint}>{background.tool.label}</p>
          )}
        </fieldset>
      )}

    </div>
  );

  const renderSpeciesStep = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step {stepNumber('species')}: Species &amp; Languages</h2>

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

      <SpeciesDetails selected={species} onChoose={selectSpecies} />

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
          {speciesChoiceHint(spec)}
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
        {languageSuggestions.length > 0 && (
          <p className={styles.hint} role="note" data-testid="wiz-language-suggestion">
            Spoken by {species?.name ?? 'your'} folk: {languageSuggestions.map(formatLanguage).join(', ')}. A
            natural pick if your character grew up among them.
          </p>
        )}
        <p className={styles.hint}>Hover or tap a language to see who speaks it.</p>
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
                <MaybeContentTooltip content={resolveLanguageTooltip(lang)} ariaLabel={`About ${formatLanguage(lang)}`}>
                  {formatLanguage(lang)}
                </MaybeContentTooltip>
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

  /**
   * The score the character will actually have: the base score plus the
   * background increase chosen on the Background step (PHB 2024 L1720: "adjust them
   * according to your background"). Shown here so the player sees 17, not 15.
   */
  const finalScoreBreakdown = (ability: Ability, base: number): Breakdown => ({
    total: base + (allocation[ability] ?? 0),
    components: [
      { label: `${ABILITY_ABBR[ability]} base score`, value: base },
      { label: `${background?.name ?? 'Background'} increase`, value: allocation[ability] ?? 0 },
    ],
  });
  const finalModBreakdown = (finalScore: number): Breakdown => {
    const mod = abilityModifier(finalScore);
    return { total: mod, components: [{ label: 'From final score', value: mod }], note: `Score ${finalScore}` };
  };
  const bonusTag = (ability: Ability) =>
    (allocation[ability] ?? 0) > 0 ? (
      <span className={styles.bonusTag} data-testid={`bonus-${ability}`}>
        +{allocation[ability]} background
      </span>
    ) : null;

  const renderAbilityAssignRows = (pool: number[], isRoll: boolean) => {
    const assignment = isRoll ? rolledAssignment : arrayAssignment;
    return ABILITIES.map((ability) => {
      const idx = assignment[ability];
      const score = idx !== undefined ? pool[idx] : undefined;
      const breakdown = finalScoreBreakdown(ability, score ?? 10);
      const modBreakdown = finalModBreakdown(breakdown.total);
      const mod = modBreakdown.total;
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
            <MaybeContentTooltip content={resolveAbilityTooltip(ability)} ariaLabel={`About ${ABILITY_NAMES[ability]}`}>
              {ABILITY_NAMES[ability]}
            </MaybeContentTooltip>
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
          {bonusTag(ability)}
          {score !== undefined && (
            <span className={styles.totalCell}>
              <CalculatedValue label={`${ABILITY_NAMES[ability]} Score`} breakdown={breakdown}>
                {breakdown.total}
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
        <p className={styles.hint} data-testid="ability-method-info">
          {ABILITY_METHOD_INFO[abilityMethod]}
        </p>
        <p className={styles.guidanceCite}>Source: {ABILITY_METHOD_SOURCE}</p>
        {allocationList.length > 0 && (
          <p className={styles.hint} data-testid="ability-background-note">
            Your {background?.name} background adds{' '}
            {allocationList.map((a) => `+${a.amount} ${ABILITY_NAMES[a.ability]}`).join(' and ')}. The scores below
            include it.
          </p>
        )}

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
              const finalBreakdown = finalScoreBreakdown(ability, value);
              const modBreakdown = finalModBreakdown(finalBreakdown.total);
              const mod = modBreakdown.total;
              return (
                <div key={ability} className={styles.allocRow}>
                  <span className={styles.allocName}>
                    <MaybeContentTooltip content={resolveAbilityTooltip(ability)} ariaLabel={`About ${ABILITY_NAMES[ability]}`}>
                      {ABILITY_NAMES[ability]}
                    </MaybeContentTooltip>
                  </span>
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
                  {bonusTag(ability)}
                  <span className={styles.totalCell}>
                    <CalculatedValue label={`${ABILITY_NAMES[ability]} Score`} breakdown={finalBreakdown}>
                      {finalBreakdown.total}
                    </CalculatedValue>
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
                {classId !== '' && (
                  <div className={styles.methodBody}>
                    <button type="button" className={styles.recommendBtn} onClick={placeRolledByClass}>
                      Place my rolls for my class
                    </button>
                    <p className={styles.hint}>
                      Puts your highest roll where a {CLASS_LIST.find((c) => c.id === classId)?.name} needs it most,
                      following the PHB&apos;s suggested order. You can still move any of them.
                    </p>
                  </div>
                )}
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
      {alignment && ALIGNMENT_INFO[alignment] && (
        <p className={styles.hint} data-testid="wiz-alignment-info">
          {ALIGNMENT_INFO[alignment].summary}
          {isEvilAlignment(alignment) ? ` ${EVIL_ALIGNMENT_NOTE}` : ''}
        </p>
      )}
      <details className={styles.bgCompare}>
        <summary className={styles.bgCompareSummary}>What do the alignments mean?</summary>
        <p className={styles.hint}>
          Alignment is a shorthand for your character&apos;s moral compass: good, evil, or neutral, and lawful,
          chaotic, or neutral about order. It has no effect on your numbers; it&apos;s a guide to how you play.
        </p>
        <dl className={styles.bgFacts}>
          {ALIGNMENTS.map((a) => (
            <div key={a} className={styles.alignmentRow}>
              <dt>{a}</dt>
              <dd>{ALIGNMENT_INFO[a]?.summary}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.guidanceCite}>Source: PHB 2024 "Choose an Alignment" (L1295, L1850-1878).</p>
      </details>

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
          {allDeityOptions().map((d) => (<option key={d.name} value={d.name}>{d.label}</option>))}
        </datalist>
        <button type="button" className={styles.genBtn} onClick={genFaith} aria-label="Generate deity">
          🎲
        </button>
      </div>
      <DeitySuggestions
        classId={classId}
        speciesId={speciesId}
        speciesChoices={speciesChoices}
        alignment={alignment}
        faith={details.faith}
        onChoose={(faithName) => setDetails((prev) => ({ ...prev, faith: faithName }))}
      />

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
        <label className={styles.fieldLabel} htmlFor="wiz-age">
          Age
        </label>
        <input
          id="wiz-age"
          className={styles.textInput}
          type="text"
          inputMode="numeric"
          value={details.age}
          placeholder="Years"
          onChange={(e) => setDetail('age', e.target.value)}
        />
        <button
          type="button"
          className={styles.genBtn}
          onClick={genAge}
          disabled={!speciesId}
          aria-label="Generate age"
        >
          🎲
        </button>
      </div>

      <fieldset className={styles.fieldset}>
        <legend className={styles.fieldLabel}>Appearance</legend>
        <div className={styles.genRow}>
          <span className={styles.hint}>Type your own, or roll a look that suits your species.</span>
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
        <div className={styles.appearanceGrid}>
          {(
            [
              ['height', 'Height'],
              ['weight', 'Weight'],
              ['eyes', 'Eyes'],
              ['hair', 'Hair'],
              ['skin', 'Skin'],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className={styles.appearanceField}>
              <span className={styles.fieldLabel}>{label}</span>
              <input
                className={styles.textInput}
                type="text"
                value={details[field]}
                aria-label={label}
                onChange={(e) => setDetail(field, e.target.value)}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.genRow}>
        <label className={styles.fieldLabel} htmlFor="wiz-personality">
          Personality
        </label>
        <textarea
          id="wiz-personality"
          className={styles.textarea}
          value={details.personality}
          rows={5}
          onChange={(e) => setDetails((prev) => ({ ...prev, personality: e.target.value }))}
        />
        <button type="button" className={styles.genBtn} onClick={genPersonality} aria-label="Generate personality">
          🎲
        </button>
      </div>
      <details className={styles.bgCompare}>
        <summary className={styles.bgCompareSummary}>Stuck? Questions to imagine your past</summary>
        <ul className={styles.promptList}>
          {PAST_PROMPTS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <p className={styles.guidanceCite}>Source: {PAST_PROMPTS_SOURCE}.</p>
      </details>
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
      <ReviewStep character={buildCharacter()} onEdit={editStep} />
    </div>
  );

  const stepRenderers: Record<StepId, () => ReactElement> = {
    class: renderClassStep,
    background: renderBackgroundStep,
    species: renderSpeciesStep,
    skills: renderSkillsStep,
    abilities: renderAbilitiesStep,
    details: renderDetailsStep,
    equipment: renderEquipmentStep,
    spells: renderSpellsStep,
    review: renderReviewStep,
  };

  return (
    <div className={styles.wizard} role="region" aria-label="Character creation wizard">
      {savedDraft && (
        <div className={styles.resumeBanner} role="region" aria-label="Unfinished character">
          <p className={styles.hint}>
            You have an unfinished character
            {savedDraft.name.trim() ? `, ${savedDraft.name.trim()}` : ''}
            {savedDraft.classId ? ` (${CLASS_LIST.find((c) => c.id === savedDraft.classId)?.name})` : ''}, saved{' '}
            {new Date(savedDraft.savedAt).toLocaleString()}. Pick up where you left off?
          </p>
          <div className={styles.resumeButtons}>
            <button type="button" className={styles.primaryBtn} onClick={() => resumeDraft(savedDraft)}>
              Resume
            </button>
            <button type="button" className={styles.secondaryBtn} onClick={discardDraft}>
              Start over
            </button>
          </div>
        </div>
      )}
      <StepIndicator steps={stepLabels} currentStep={step} canJumpTo={canJumpTo} onStepClick={jumpTo} />
      <div ref={stepRef}>{stepRenderers[currentStepId]()}</div>
      {missing.length > 0 && (
        <p className={styles.blockedNote} role="status" data-testid="wizard-missing">
          To {step === steps.length - 1 ? 'finish' : 'continue'}: {listText(missing)}.
        </p>
      )}
      {pendingChange && (
        <ConfirmDialog
          message={pendingChange.message}
          confirmLabel="Change"
          cancelLabel="Keep"
          onConfirm={() => {
            if (pendingChange.kind === 'class') selectClass(pendingChange.id);
            else selectBackground(pendingChange.id);
            setPendingChange(null);
          }}
          onCancel={() => setPendingChange(null)}
        />
      )}
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
