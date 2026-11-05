import { useMemo, useState } from 'react';
import type { Ability, Character } from '../../types/character';
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
import { BACKGROUND_LIST, getBackground } from '../../data/backgrounds';
import type { BackgroundId } from '../../data/backgrounds';
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
} from '../../logic/personal-details-generation';
import type { NameGender } from '../../data/name-tables';
import { createDefaultRng } from '../../logic/random';
import { formatSigned, type Breakdown } from '../../logic/breakdown';
import { CalculatedValue } from '../shared/CalculatedValue';
import { SegmentedControl } from '../shared/SegmentedControl';
import { StepIndicator } from '../combat/StepIndicator';
import { choiceOptions, formatLanguage } from '../pages/sheet-helpers';
import styles from './CreationWizard.module.css';

export interface CreationWizardProps {
  /** Called with the finished, valid character when the player completes the flow. */
  onComplete: (character: Character) => void;
  /** Called when the player cancels/aborts the wizard. */
  onCancel: () => void;
}

/** The five guided steps, in PHB creation order. */
const STEP_LABELS = ['Class', 'Origin', 'Ability Scores', 'Details', 'Equipment'];

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

  // Step 3: Ability scores.
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
    sex: string;
    age: string;
    height: string;
    weight: string;
    eyes: string;
    hair: string;
    skin: string;
    personality: string;
  }>({ sex: '', age: '', height: '', weight: '', eyes: '', hair: '', skin: '', personality: '' });

  // Step 5: Equipment.
  const [equipmentChoice, setEquipmentChoice] = useState<EquipmentChoice>('A');

  const background = getBackground(backgroundId || undefined);
  const species = getSpecies(speciesId || undefined);

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

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return name.trim().length > 0 && classId !== '';
      case 1:
        return backgroundId !== '' && allocationValid && speciesId !== '';
      case 2:
        return abilityStepValid();
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  // ─── Step 1 handlers ─────────────────────────────────────────────────────

  const selectBackground = (id: BackgroundId) => {
    setBackgroundId(id);
    setAllocation({});
    setToolProficiency('');
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
            class: { id: classId as ClassId, level: 1 },
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

  // ─── Completion ─────────────────────────────────────────────────────────

  const buildCharacter = (): Character => {
    let character = createCharacter(name.trim());

    // Class (single-class at level 1).
    character = {
      ...character,
      level: 1,
      class: { id: classId as ClassId, level: 1, skillChoices: [] },
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
      ...(details.sex ? { sex: details.sex } : {}),
      ...(details.age ? { age: details.age } : {}),
      ...(details.height ? { height: details.height } : {}),
      ...(details.weight ? { weight: details.weight } : {}),
      ...(details.eyes ? { eyes: details.eyes } : {}),
      ...(details.hair ? { hair: details.hair } : {}),
      ...(details.skin ? { skin: details.skin } : {}),
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

    return character;
  };

  const goNext = () => {
    if (step < STEP_LABELS.length - 1) {
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

  const renderStep1 = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step 1: Class</h2>
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
        }}
      >
        <option value="">— Select a Class —</option>
        {CLASS_LIST.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );

  const renderStep2 = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step 2: Origin</h2>

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
            class: classId === '' ? undefined : { id: classId as ClassId, level: 1 },
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
      return (
        <div key={ability} className={styles.allocRow}>
          <span className={styles.allocName}>{ABILITY_NAMES[ability]}</span>
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

  const renderStep3 = () => {
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
        <h2 className={styles.stepTitle}>Step 3: Ability Scores</h2>
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

  const renderStep4 = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step 4: Alignment &amp; Details</h2>
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

  const renderStep5 = () => (
    <div className={styles.stepBody}>
      <h2 className={styles.stepTitle}>Step 5: Equipment</h2>
      {background ? (
        <>
          <p className={styles.hint}>Choose your starting equipment (PHB 2024 "Parts of a Background").</p>
          <SegmentedControl
            ariaLabel="Equipment choice"
            options={[
              { value: 'A', label: 'Equipment Package' },
              { value: 'B', label: '50 GP' },
            ]}
            value={equipmentChoice}
            onChange={(v) => setEquipmentChoice(v as EquipmentChoice)}
          />
          {equipmentChoice === 'A' ? (
            <ul className={styles.pkgList}>
              {background.equipment.packageItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
              <li>{background.equipment.packageGold} GP</li>
            </ul>
          ) : (
            <p className={styles.hint}>Take 50 GP instead of the package.</p>
          )}
        </>
      ) : (
        <p className={styles.hint}>Select a background first.</p>
      )}
    </div>
  );

  const stepRenderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5];

  return (
    <div className={styles.wizard} role="region" aria-label="Character creation wizard">
      <StepIndicator steps={STEP_LABELS} currentStep={step} />
      {stepRenderers[step]()}
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
          {step === STEP_LABELS.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  );
}
