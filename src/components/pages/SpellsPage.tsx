import { extraCantripLabel, extraCantrips } from '../../logic/class-choice-effects';
import { useEffect, useMemo, useState } from 'react';
import { Sparkles, BookOpen } from 'lucide-react';
import type {
  Character,
  ClassEntry,
  ClassSpellcasting,
  SpellcastingState,
} from '../../types/character';
import { formatSigned } from '../../logic/breakdown';
import { primaryClass, allClasses, resolveClass } from '../../logic/classes';
import {
  alwaysPreparedSpells,
  casterKind,
  cantripListClassIds,
  cantripsKnown,
  cantripsKnownBreakdown,
  maxSpellLevel,
  mysticArcanumLevels,
  pactMagicSlots,
  preparedCount,
  preparedCountBreakdown,
  requiredCantrips,
  spellAttackBreakdown,
  spellcastingAbility,
  spellcastingFocusOptions,
  spellListClassIds,
  spellSaveDcBreakdown,
  spellSlotAvailableBreakdown,
  spellSlotMaxBreakdown,
  spellSlots,
  spellcastingClasses,
  perClassSpellcasting,
  effectiveSpellSlots,
  pactMagicSlotsForClass,
  combinedCasterLevel,
  highestCastableSpellLevel,
  canCastPreparedSpell,
  entryIsSpellcaster,
  classAlwaysPreparedSpells,
  classRequiredCantrips,
  classCantripsKnown,
  classCantripsKnownBreakdown,
  classPreparedCount,
  classPreparedCountBreakdown,
  classMaxPreparedLevel,
  classSpellListClassIds,
  classCantripListClassIds,
  classUsesSpellbook,
  illegalSpellSelections,
  isSpellLegalForEntry,
  removeIllegalSpellSelections,
} from '../../logic/spellcasting';
import { wizardSpellbookSize } from '../../logic/starting-choices';
import type { IllegalSpellSelection } from '../../logic/spellcasting';
import { getClass } from '../../data/classes';
import { SPELLCASTING_DESCRIPTORS } from '../../data/spell-progression';
import { getSpell, spellsForClass } from '../../data/spells';
import type { CatalogSpell, SpellId, SpellSchool } from '../../data/spells';
import { ABILITY_NAMES } from '../../types/character';
import { endConcentration, startConcentration } from '../../logic/concentration';
import { CalculatedValue } from '../shared/CalculatedValue';
import { Card } from '../shared/Card';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { EmptyState } from '../shared/EmptyState';
import { SpellPickList } from '../shared/SpellPickList';
import { SpellName, SpellNameList } from '../shared/SpellName';
import { SCHOOL_LABELS } from '../shared/spellSchoolLabels';
import { SubTabBar } from '../shared/SubTabBar';
import { useTabOrder } from '../../hooks/useTabOrder';
import { loadLastSubTab, saveLastSubTab } from '../../logic/sub-tab-store';
import styles from './SpellsPage.module.css';

export interface SpellsPageProps {
  character: Character;
  onChange: (next: Character) => void;
  /** The sub-tab from the URL hash (or null); the page owns final resolution. */
  subTab?: string | null;
  /** Called when the user selects a sub-tab, to sync the hash. */
  onSubTabChange?: (tab: string) => void;
  /** Optional app-level Toast sink (Concentration changes, Stage A5b). */
  onNotify?: (message: string) => void;
}

type SpellSubTab = 'summary' | 'slots' | 'prepared' | 'browse';

// Stable identity (module scope) so it stays out of effect dependency arrays.
const VALID_SUBTABS: SpellSubTab[] = ['summary', 'slots', 'prepared', 'browse'];

const DEFAULT_SUBTABS: { id: SpellSubTab; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'slots', label: 'Slots' },
  { id: 'prepared', label: 'Prepared' },
  { id: 'browse', label: 'Browse' },
];


const CASTER_KIND_LABELS = {
  full: 'Full caster',
  half: 'Half caster',
  third: 'Third caster',
  pact: 'Pact Magic',
} as const;

/**
 * Warns when the sheet holds spell picks that are not on the class's spell list
 * (an import, an older save, or a class/subclass change can leave them). They are
 * ignored in the counts and can be removed in one click.
 */
function IllegalSpellsNotice({
  selections,
  onRemove,
}: {
  selections: readonly IllegalSpellSelection[];
  onRemove: () => void;
}) {
  const ids = [...new Set(selections.map((s) => s.id))];
  return (
    <Card>
      <p className={styles.capLabel} role="alert" data-testid="illegal-spells-notice">
        {selections.length} selected {selections.length === 1 ? 'spell is' : 'spells are'} not on your
        class&apos;s spell list and {selections.length === 1 ? "doesn't" : "don't"} count toward your picks:{' '}
        <SpellNameList ids={ids} />.{' '}
        <button type="button" className={styles.removeBtn} onClick={onRemove}>
          Remove {selections.length === 1 ? 'it' : 'them'}
        </button>
      </p>
    </Card>
  );
}
function spellLevelLabel(level: number): string {
  return level === 0 ? 'Cantrips' : `Level ${level}`;
}

/**
 * A breakdown for a "chosen N of cap" selection count, so the displayed count
 * carries a tooltip (calculated-totals steering). The single component is the
 * chosen total; the cap is named in the label for context (chosen ≤ cap).
 */
function selectionBreakdown(label: string, chosen: number, cap: number) {
  return {
    total: chosen,
    components: [{ label: `${label} of ${cap} allowed`, value: chosen }],
  };
}

/** A breakdown for a plain count total, so it carries an explanatory tooltip. */
/**
 * Spellbook size next to the free allowance. PHB 2024 Wizard "Spellbook": the book
 * starts with six level 1 spells and gains two Wizard spells with each Wizard
 * level after 1, so 6 + 2 x (level - 1) are free. The rules set no hard maximum
 * (spells can be copied in play), so going over only shows a note and never blocks.
 */
function SpellbookAllowance({ level, count }: { level: number; count: number }) {
  const free = wizardSpellbookSize(level);
  const over = count - free;
  const breakdown = {
    total: free,
    components: [
      { label: 'Starting spells (level 1)', value: 6 },
      { label: `Level-up spells (2 x ${Math.max(0, level - 1)} levels after 1)`, value: free - 6 },
    ],
  };
  return (
    <>
      <p className={styles.capLabel}>
        Scribed spells (
        <CalculatedValue
          label="Spellbook size"
          breakdown={countBreakdown('Scribed spells', count)}
        >
          {count}
        </CalculatedValue>{' '}
        in book). Free spells for your level (
        <CalculatedValue label="Free spellbook spells" breakdown={breakdown}>
          {free}
        </CalculatedValue>
        ). You prepare from your spellbook.
      </p>
      {over > 0 && (
        <p className={styles.capLabel} role="note" data-testid="spellbook-over-allowance">
          {over === 1 ? '1 spell is' : `${over} spells are`} beyond your free allowance. Extra
          spells have to be copied into the book from scrolls or other spellbooks, so check with
          your DM. You can still keep them here.
        </p>
      )}
    </>
  );
}
function countBreakdown(label: string, count: number) {
  return { total: count, components: [{ label, value: count }] };
}

/**
 * The highest spell level (1-9) with a non-zero MAX slot count in a slot vector
 * (1-indexed, index 0 unused), or 0 when empty. Used to size the combined
 * Spell Slots tracker by max capacity, not by unexpended availability.
 */
function highestSlotLevel(slots: readonly number[]): number {
  let max = 0;
  for (let level = 1; level < slots.length; level++) {
    if ((slots[level] ?? 0) > 0) max = level;
  }
  return max;
}

/** Merge the catalog spells of a set of class lists (deduped, level-sorted). */
function mergeSpellLists(ids: string[]): CatalogSpell[] {
  const seen = new Set<SpellId>();
  const merged: CatalogSpell[] = [];
  for (const id of ids) {
    for (const s of spellsForClass(id)) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        merged.push(s);
      }
    }
  }
  merged.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
  return merged;
}

/**
 * The Spells tab: a spellcaster's Summary (DC/attack + read-only ability/kind/
 * focus), Slots tracker (including the separate Warlock Pact Magic row),
 * Prepared/cantrip management with the prepared-count cap, and a filterable
 * Browse of the class's spell list. Modelled on CharacterPage.tsx; reuses the
 * shared primitives and the generic sub-tab machinery.
 *
 * This page only ever renders for a spellcaster (App gates it behind
 * isSpellcaster + a route guard), so the derived resolvers here always return a
 * value for the active character.
 */
export function SpellsPage({
  character,
  onChange,
  subTab,
  onSubTabChange,
  onNotify,
}: SpellsPageProps) {
  const {
    orderedTabs,
    isEditMode,
    toggleEditMode,
    moveLeft,
    moveRight,
    resetOrder,
    isDefaultOrder,
    saveError,
  } = useTabOrder({ pageKey: 'spells', defaultTabs: DEFAULT_SUBTABS });

  const isValidSubTab = (value: string | null | undefined): value is SpellSubTab =>
    value != null && VALID_SUBTABS.includes(value as SpellSubTab);

  const resolveInitialTab = (): SpellSubTab => {
    if (isValidSubTab(subTab)) return subTab;
    const lastUsed = loadLastSubTab('spells');
    if (isValidSubTab(lastUsed)) return lastUsed;
    const firstOrdered = orderedTabs[0]?.id;
    if (isValidSubTab(firstOrdered)) return firstOrdered;
    return 'summary';
  };

  const [activeSubTab, setActiveSubTabInternal] = useState<SpellSubTab>(resolveInitialTab);

  // Mirror a valid external hash sub-tab into local state (deep link / paste).
  useEffect(() => {
    if (subTab && isValidSubTab(subTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSubTabInternal(subTab);
    }
    // Only the external hash prop retriggers this; isValidSubTab reads only
    // module-scoped VALID_SUBTABS, so subTab is the sole dependency.
  }, [subTab]);

  const setActiveSubTab = (tab: SpellSubTab) => {
    setActiveSubTabInternal(tab);
    saveLastSubTab('spells', tab);
    onSubTabChange?.(tab);
  };

  const cls = resolveClass(character);
  const ability = spellcastingAbility(character);
  const kind = casterKind(character);
  const focusOptions = spellcastingFocusOptions(character);
  const dcBreakdown = spellSaveDcBreakdown(character);
  const attackBreakdown = spellAttackBreakdown(character);
  const slots = spellSlots(character);
  const pact = pactMagicSlots(character);
  const descriptor = cls
    ? SPELLCASTING_DESCRIPTORS[cls.id as keyof typeof SPELLCASTING_DESCRIPTORS]
    : undefined;
  const usesSpellbook = descriptor?.usesSpellbook ?? false;

  const cantripCap = cantripsKnown(character);
  const preparedCap = preparedCount(character);
  const cantripCapBreakdown = cantripsKnownBreakdown(character);
  const preparedCapBreakdown = preparedCountBreakdown(character);
  const topSpellLevel = maxSpellLevel(character);

  // Multiclass display (Stage M5). A character with 2+ classes shows one DC /
  // attack block per ACTIVE caster class (perClassSpellcasting, M3) and tracks
  // the COMBINED Spellcasting pool (effectiveSpellSlots) alongside the separate
  // Pact Magic pool (pactMagicSlotsForClass). For a single-class caster these
  // extra blocks are not rendered and the page is byte-identical to before
  // (the primary-class resolvers above still drive the whole single-class view).
  const isMulticlass = allClasses(character).length >= 2;
  const casterSummaries = isMulticlass ? perClassSpellcasting(character) : [];
  const combinedSlots = isMulticlass ? effectiveSpellSlots(character) : undefined;
  const combinedPact = isMulticlass ? pactMagicSlotsForClass(character) : undefined;
  const hasCombinedPool = isMulticlass && spellcastingClasses(character).length >= 1;
  // The combined caster level (PHB 2024 "Multiclassing: Spellcasting", L2156):
  // names the source in each combined slot-level breakdown.
  const combinedCasterLvl = isMulticlass ? combinedCasterLevel(character) : 0;
  // The combined Spell Slots tracker is sized by the MAX top level of the
  // combined pool (the highest spell level with a non-zero MAX slot count),
  // NOT by unexpended availability — spending or recovering slots must not add
  // or remove tracker rows (mirrors the single-class maxSpellLevel bound).
  const combinedTopLevel = combinedSlots ? highestSlotLevel(combinedSlots) : 0;
  // Cross-pool casting applies only when BOTH pools exist (PHB 2024 L2168). The
  // highest castable level then considers UNEXPENDED slots across both pools
  // (highestCastableSpellLevel), surfaced as an informational line.
  const hasBothPools = isMulticlass && hasCombinedPool && !!combinedPact && combinedPact.slots > 0;
  const crossPoolHighest = hasBothPools ? highestCastableSpellLevel(character) : 0;

  const sc: SpellcastingState = character.spellcasting ?? {};
  // Per-class selections (cantrips/prepared/spellbook) live under byClass[classId]
  // (PHB 2024 "Multiclassing"). The SINGLE-CLASS Prepared tab below reads the
  // PRIMARY class's bucket and routes edits back under it (byte-identical to the
  // pre-M5 flow); a MULTICLASS character uses PreparedClassSection instead, one
  // per caster class, each scoped to byClass[entry.id].
  const primaryEntry = primaryClass(character);
  const primaryId = primaryEntry?.id;
  const perClass: ClassSpellcasting = (primaryId ? sc.byClass?.[primaryId] : undefined) ?? {};

  // Leveled spells a class/subclass feature makes ALWAYS prepared (Ranger's
  // Hunter's Mark, Paladin's Divine Smite/Find Steed, Druid's Speak with
  // Animals, Warlock's Contact Other Plane, Bard's Words of Creation). PHB 2024
  // excludes these from the Prepared Spells cap, so they are rendered locked and
  // never counted against the discretionary cap (reviewer finding).
  const alwaysPrepared = useMemo(() => alwaysPreparedSpells(character), [character]);
  // The player's discretionary prepared spells: stored prepared minus any that
  // are always-prepared (so a feature spell previously picked by hand no longer
  // eats a slot of the cap).
  // Selections that are not legal for the class (see illegalSpellSelections) are
  // ignored here so they cannot silently eat the cap; the notice above offers to
  // remove them.
  const illegalSelections = useMemo(() => illegalSpellSelections(character), [character]);
  const illegalKeys = useMemo(
    () => new Set(illegalSelections.filter((i) => i.classId === primaryId).map((i) => `${i.kind}:${i.id}`)),
    [illegalSelections, primaryId],
  );
  const chosenPrepared = useMemo(
    () =>
      (perClass.prepared ?? []).filter(
        (id) => !alwaysPrepared.includes(id) && !illegalKeys.has(`prepared:${id}`),
      ),
    [perClass.prepared, alwaysPrepared, illegalKeys],
  );

  // Cantrips the character must know and cannot replace (Arcane Trickster's
  // Mage Hand, PHB 2024 ~p.123). They are always treated as chosen: locked in
  // the picker (cannot be unchecked) and counted against the cantrip cap, even
  // before the user makes any selection — without forcing a write on mount.
  const required = useMemo(() => requiredCantrips(character), [character]);
  const chosenCantrips = useMemo(() => {
    const stored = (perClass.cantrips ?? []).filter((id) => !illegalKeys.has(`cantrip:${id}`));
    const missing = required.filter((id) => !stored.includes(id));
    return missing.length > 0 ? [...missing, ...stored] : stored;
  }, [perClass.cantrips, required, illegalKeys]);

  // The leveled spell list(s) the character prepares/browses from: the Wizard
  // list for EK/AT, and the Bard/Cleric/Druid/Wizard union for a level-10+ Bard
  // (Magical Secrets). Cantrips use the NARROWER cantrip list below — Magical
  // Secrets widens prepared spells only, not cantrips (PHB 2024 "Bard").
  const listKey = spellListClassIds(character).join(',');
  const classSpells = useMemo(
    () => mergeSpellLists(listKey ? listKey.split(',') : []),
    // listKey captures the list-id union as a stable primitive dependency.
    [listKey],
  );

  // The cantrip pool is the primary class list only (never widened by Magical
  // Secrets), so a level-10 Bard cannot select non-Bard cantrips (review
  // finding: Magical Secrets incorrectly expanded Bard cantrips).
  const cantripListKey = cantripListClassIds(character).join(',');
  const cantripListSpells = useMemo(
    () => mergeSpellLists(cantripListKey ? cantripListKey.split(',') : []),
    // cantripListKey is a stable primitive capturing the cantrip-list union.
    [cantripListKey],
  );

  // ── State mutation helpers ────────────────────────────────────────────────
  // A patch may carry per-class keys (cantrips/prepared/spellbook) and/or pooled
  // keys (slotsExpended/pactSlotsExpended/mysticArcana*). Per-class keys are
  // written UNDER byClass[primaryId]; pooled keys stay top-level. Keeps single-
  // class behaviour identical to the pre-M1 flat shape (PHB 2024 "Multiclassing").
  const patchSpellcasting = (
    patch: Partial<ClassSpellcasting> & Omit<Partial<SpellcastingState>, 'byClass'>,
  ) => {
    const { cantrips, prepared, spellbook, ...pooled } = patch;
    const next: SpellcastingState = { ...sc, ...pooled };
    const hasPerClass = 'cantrips' in patch || 'prepared' in patch || 'spellbook' in patch;
    if (hasPerClass && primaryId) {
      const nextPerClass: ClassSpellcasting = { ...perClass };
      if ('cantrips' in patch) nextPerClass.cantrips = cantrips;
      if ('prepared' in patch) nextPerClass.prepared = prepared;
      if ('spellbook' in patch) nextPerClass.spellbook = spellbook;
      next.byClass = { ...sc.byClass, [primaryId]: nextPerClass };
    }
    onChange({ ...character, spellcasting: next });
  };

  const toggleCantrip = (id: SpellId, checked: boolean) => {
    if (checked) {
      if (!primaryEntry || !isSpellLegalForEntry(character, primaryEntry, 'cantrip', id)) return; // only the class cantrip list
      if (chosenCantrips.includes(id)) return;
      // Cap at the known-cantrips count (PHB 2024 "Cantrips" column).
      if (chosenCantrips.length >= cantripCap) return;
      patchSpellcasting({ cantrips: [...chosenCantrips, id] });
    } else {
      // Required cantrips (Arcane Trickster's Mage Hand) cannot be unchecked.
      if (required.includes(id)) return;
      patchSpellcasting({ cantrips: chosenCantrips.filter((c) => c !== id) });
    }
  };

  const togglePrepared = (id: SpellId, checked: boolean) => {
    // Always-prepared feature spells are locked: they can't be added or removed
    // and never occupy the cap (PHB 2024 per-class spellcasting text).
    if (alwaysPrepared.includes(id)) return;
    if (checked) {
      if (!primaryEntry || !isSpellLegalForEntry(character, primaryEntry, 'prepared', id)) return; // only the class spell list
      if (chosenPrepared.includes(id)) return;
      // Cap at the prepared-count (PHB 2024 "Prepared Spells" column).
      if (chosenPrepared.length >= preparedCap) return;
      patchSpellcasting({ prepared: [...chosenPrepared, id] });
    } else {
      patchSpellcasting({ prepared: chosenPrepared.filter((p) => p !== id) });
    }
  };

  // Stage A5b: the "Concentrating" toggle on a prepared concentration spell.
  // Starting one ends any other (PHB 2024 "Concentration"), announced by Toast;
  // the rule lives in logic/concentration.ts.
  const setConcentrating = (id: SpellId, on: boolean) => {
    if (!on) {
      onChange(endConcentration(character));
      onNotify?.(`Concentration on ${getSpell(id)?.name ?? id} ended.`);
      return;
    }
    const started = startConcentration(character, id, getSpell(id)?.concentration === true);
    onChange(started.character);
    const name = getSpell(id)?.name ?? id;
    onNotify?.(
      started.endedPrevious
        ? `Now concentrating on ${name}. Concentration on ${getSpell(started.endedPrevious)?.name ?? started.endedPrevious} ended.`
        : `Now concentrating on ${name}.`,
    );
  };

  const toggleSpellbook = (id: SpellId, checked: boolean) => {
    const book = perClass.spellbook ?? [];
    if (checked) {
      if (!primaryEntry || !isSpellLegalForEntry(character, primaryEntry, 'spellbook', id)) return; // only the class spell list
      if (book.includes(id)) return;
      patchSpellcasting({ spellbook: [...book, id] });
    } else {
      // Removing a spell from the spellbook also unprepares it: a Wizard
      // prepares only from the spellbook (PHB 2024 "Wizard: Spellcasting"), so a
      // prepared spell that leaves the book can no longer be prepared (review
      // finding: reconcile prepared when a spell leaves the book).
      patchSpellcasting({
        spellbook: book.filter((b) => b !== id),
        prepared: chosenPrepared.filter((p) => p !== id),
      });
    }
  };

  const setSlotExpended = (slotLevel: number, next: number) => {
    // Clamp against the EFFECTIVE pool: the combined Spellcasting pool for a
    // multiclass caster, else the single class's own slots (unchanged).
    const pool = isMulticlass ? combinedSlots : slots;
    const max = pool?.[slotLevel] ?? 0;
    const clamped = Math.max(0, Math.min(max, next));
    patchSpellcasting({
      slotsExpended: { ...sc.slotsExpended, [slotLevel]: clamped },
    });
  };

  const setPactExpended = (next: number) => {
    const max = (isMulticlass ? combinedPact : pact)?.slots ?? 0;
    patchSpellcasting({ pactSlotsExpended: Math.max(0, Math.min(max, next)) });
  };

  // ── Mystic Arcanum (Warlock) ──────────────────────────────────────────────
  // PHB 2024 "Warlock: Mystic Arcanum": one chosen Warlock spell per granted
  // arcanum level (6/7/8/9), cast once per Long Rest WITHOUT a slot. Tracked
  // separately from Pact Magic slots and the prepared cap (review finding).
  const arcanumLevels = mysticArcanumLevels(character);
  const chooseArcanum = (level: number, id: SpellId | '') => {
    const nextArcana = { ...(sc.mysticArcana ?? {}) };
    if (id === '') delete nextArcana[level];
    else nextArcana[level] = id;
    patchSpellcasting({ mysticArcana: nextArcana });
  };
  const toggleArcanumExpended = (level: number, expended: boolean) => {
    const nextExpended = { ...(sc.mysticArcanaExpended ?? {}) };
    if (expended) nextExpended[level] = true;
    else delete nextExpended[level];
    patchSpellcasting({ mysticArcanaExpended: nextExpended });
  };

  // ── Browse filter state ───────────────────────────────────────────────────
  const [filterLevel, setFilterLevel] = useState<'all' | number>('all');
  const [filterSchool, setFilterSchool] = useState<'all' | SpellSchool>('all');
  const [filterRitual, setFilterRitual] = useState(false);
  const [filterConcentration, setFilterConcentration] = useState(false);

  const browseSpells = useMemo(() => {
    return classSpells.filter((s) => {
      if (filterLevel !== 'all' && s.level !== filterLevel) return false;
      if (filterSchool !== 'all' && s.school !== filterSchool) return false;
      if (filterRitual && !s.ritual) return false;
      if (filterConcentration && !s.concentration) return false;
      return true;
    });
  }, [classSpells, filterLevel, filterSchool, filterRitual, filterConcentration]);

  const browseByLevel = useMemo(() => {
    const map = new Map<number, CatalogSpell[]>();
    for (const s of browseSpells) {
      const bucket = map.get(s.level);
      if (bucket) bucket.push(s);
      else map.set(s.level, [s]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [browseSpells]);

  // The leveled spells available to the spellbook picker (Wizard): any Wizard
  // spell of a castable level.
  const spellbookCandidates = useMemo(
    () => classSpells.filter((s) => s.level >= 1 && s.level <= topSpellLevel),
    [classSpells, topSpellLevel],
  );

  // The leveled spells the character can PREPARE. A Wizard prepares only from
  // the spells scribed in its spellbook (PHB 2024 "Wizard: Spellcasting");
  // every other prepared caster prepares from its whole class list (review
  // finding: Wizard preparation must not bypass the spellbook).
  const preparableSpells = useMemo(() => {
    if (!usesSpellbook) return spellbookCandidates;
    const book = new Set(perClass.spellbook ?? []);
    return spellbookCandidates.filter((s) => book.has(s.id));
  }, [usesSpellbook, spellbookCandidates, perClass.spellbook]);

  // The leveled spells shown in the prepared picker: the preparable pool plus
  // any always-prepared feature spells not already in it (so locked entries
  // always render, even if the preparable pool would otherwise omit them).
  const preparedPickSpells = useMemo(() => {
    const present = new Set(preparableSpells.map((s) => s.id));
    const extra = alwaysPrepared
      .filter((id) => !present.has(id))
      .map((id) => getSpell(id))
      .filter((s): s is CatalogSpell => s !== undefined);
    if (extra.length === 0) return preparableSpells;
    return [...preparableSpells, ...extra].sort(
      (a, b) => (a.level - b.level) || a.name.localeCompare(b.name),
    );
  }, [preparableSpells, alwaysPrepared]);
  const cantripSpells = useMemo(
    () => cantripListSpells.filter((s) => s.level === 0),
    [cantripListSpells],
  );

  return (
    <div className={styles.page}>
      <SubTabBar
        tabs={orderedTabs}
        activeTab={activeSubTab}
        onTabChange={(t) => setActiveSubTab(t as SpellSubTab)}
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

      {illegalSelections.length > 0 && (
        <IllegalSpellsNotice
          selections={illegalSelections}
          onRemove={() => onChange(removeIllegalSpellSelections(character))}
        />
      )}
      {activeSubTab === 'summary' && (
        <Card>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryStat}>
              <span className={styles.fieldLabel}>Spell Save DC</span>
              <span className={styles.summaryValue}>
                {dcBreakdown ? (
                  <CalculatedValue label="Spell Save DC" breakdown={dcBreakdown}>
                    {dcBreakdown.total}
                  </CalculatedValue>
                ) : (
                  '—'
                )}
              </span>
            </div>

            <div className={styles.summaryStat}>
              <span className={styles.fieldLabel}>Spell Attack Bonus</span>
              <span className={styles.summaryValue}>
                {attackBreakdown ? (
                  <CalculatedValue label="Spell Attack Bonus" breakdown={attackBreakdown}>
                    {formatSigned(attackBreakdown.total)}
                  </CalculatedValue>
                ) : (
                  '—'
                )}
              </span>
            </div>

            <div className={styles.summaryStat}>
              <span className={styles.fieldLabel}>Spellcasting Ability</span>
              <span className={styles.summaryText}>
                {ability ? ABILITY_NAMES[ability] : '—'}
              </span>
            </div>

            <div className={styles.summaryStat}>
              <span className={styles.fieldLabel}>Caster Type</span>
              <span className={styles.summaryText}>
                {kind ? CASTER_KIND_LABELS[kind] : '—'}
              </span>
            </div>

            <div className={styles.summaryStat}>
              <span className={styles.fieldLabel}>Spellcasting Focus</span>
              <span className={styles.summaryText}>
                {focusOptions.length > 0 ? focusOptions.join(' or ') : '—'}
              </span>
            </div>

            <div className={styles.summaryStat}>
              <span className={styles.fieldLabel}>Cantrips Known</span>
              <span className={styles.summaryText}>
                {cantripCapBreakdown ? (
                  <CalculatedValue label="Cantrips Known" breakdown={cantripCapBreakdown}>
                    {cantripCap}
                  </CalculatedValue>
                ) : (
                  cantripCap
                )}
              </span>
            </div>

            <div className={styles.summaryStat}>
              <span className={styles.fieldLabel}>Prepared Spells</span>
              <span className={styles.summaryText}>
                {preparedCapBreakdown ? (
                  <CalculatedValue label="Prepared Spells" breakdown={preparedCapBreakdown}>
                    {preparedCap}
                  </CalculatedValue>
                ) : (
                  preparedCap
                )}
              </span>
            </div>
          </div>
          <p className={styles.focusNote}>
            Focus is shown for reference from your class data; it is not tracked
            as an item this stage.
          </p>
        </Card>
      )}

      {/* Multiclass (Stage M5): one Spell Save DC / Spell Attack block per
          ACTIVE caster class (PHB 2024 "Multiclassing: Spellcasting"). Each DC /
          attack is a CalculatedValue breakdown naming that class's ability + PB.
          Only rendered for a 2+ class caster; single-class is unchanged. */}
      {activeSubTab === 'summary' && isMulticlass && casterSummaries.length > 0 && (
        <Card>
          <CollapsibleSection
            title="Spellcasting by Class"
            storageKey="dnd-collapse-spellcasting-by-class"
          >
            <p className={styles.capLabel}>
              Each class casts with its own ability; a prepared spell uses that
              class&rsquo;s Save DC and Spell Attack (PHB 2024 &ldquo;Multiclassing&rdquo;).
            </p>
            {casterSummaries.map((s) => (
              <div key={s.classId} className={styles.summaryGrid}>
                <div className={styles.summaryStat}>
                  <span className={styles.fieldLabel}>{s.className} — Save DC</span>
                  <span className={styles.summaryValue}>
                    <CalculatedValue label={`${s.className} Spell Save DC`} breakdown={s.saveDc}>
                      {s.saveDc.total}
                    </CalculatedValue>
                  </span>
                </div>
                <div className={styles.summaryStat}>
                  <span className={styles.fieldLabel}>{s.className} — Attack</span>
                  <span className={styles.summaryValue}>
                    <CalculatedValue label={`${s.className} Spell Attack Bonus`} breakdown={s.attack}>
                      {formatSigned(s.attack.total)}
                    </CalculatedValue>
                  </span>
                </div>
                <div className={styles.summaryStat}>
                  <span className={styles.fieldLabel}>{s.className} — Ability</span>
                  <span className={styles.summaryText}>{ABILITY_NAMES[s.ability]}</span>
                </div>
              </div>
            ))}
          </CollapsibleSection>
        </Card>
      )}

      {activeSubTab === 'slots' && isMulticlass && (
        <Card>
          <CollapsibleSection title="Spell Slots" storageKey="dnd-collapse-spell-slots">
            {/* Multiclass (Stage M5): the COMBINED Spellcasting pool (one shared
                pool across all Spellcasting classes, indexed by the combined
                caster level — PHB 2024 "Multiclassing: Spellcasting") plus the
                SEPARATE Pact Magic pool. A combined caster may have both. The
                combined pool's breakdown names the combined caster level. */}
            {hasBothPools && (
              // CROSS-POOL (PHB 2024 L2168): with both a Spellcasting pool and a
              // Pact Magic pool, either pool's slots can cast your prepared
              // spells, so the highest level you can currently cast is the max
              // available (unexpended) slot level ACROSS both pools.
              <p className={styles.capLabel}>
                Highest castable spell level (either pool, cross-pool):{' '}
                <strong>{crossPoolHighest > 0 ? crossPoolHighest : '—'}</strong>. Pact Magic
                and Spellcasting slots are interchangeable for casting prepared
                spells (PHB 2024 &ldquo;Multiclassing: Pact Magic&rdquo;).
              </p>
            )}
            {hasCombinedPool && combinedSlots && combinedTopLevel > 0 ? (
              Array.from({ length: combinedTopLevel }, (_, idx) => idx + 1).map((lvl) => {
                const max = combinedSlots[lvl] ?? 0;
                if (max <= 0) return null;
                return (
                  <SlotTracker
                    key={lvl}
                    label={`Level ${lvl}`}
                    breakdown={{
                      total: max,
                      components: [
                        {
                          label: `Combined caster level ${combinedCasterLvl}, level-${lvl} slots`,
                          value: max,
                        },
                      ],
                    }}
                    max={max}
                    expended={sc.slotsExpended?.[lvl] ?? 0}
                    onChange={(n) => setSlotExpended(lvl, n)}
                    note="Recovers on a Long Rest"
                  />
                );
              })
            ) : null}
            {combinedPact && combinedPact.slots > 0 && (
              <SlotTracker
                label={`Pact Magic (level ${combinedPact.slotLevel})`}
                breakdown={{
                  total: combinedPact.slots,
                  components: [
                    { label: 'Warlock Pact Magic', value: combinedPact.slots },
                  ],
                }}
                max={combinedPact.slots}
                expended={sc.pactSlotsExpended ?? 0}
                onChange={setPactExpended}
                note="Recovers on a Short or Long Rest"
              />
            )}
            {!combinedPact && !(hasCombinedPool && combinedSlots && combinedTopLevel > 0) && (
              <EmptyState
                icon={Sparkles}
                heading="No spell slots yet"
                description="This character has no leveled spell slots at the current level."
              />
            )}
          </CollapsibleSection>
        </Card>
      )}

      {activeSubTab === 'slots' && !isMulticlass && (
        <Card>
          <CollapsibleSection title="Spell Slots" storageKey="dnd-collapse-spell-slots">
            {pact ? (
              <SlotTracker
                label={`Pact Magic (level ${pact.slotLevel})`}
                breakdown={{
                  total: pact.slots,
                  components: [
                    {
                      label: `${cls?.name ?? 'Warlock'} level ${character.level} Pact Magic`,
                      value: pact.slots,
                    },
                  ],
                }}
                max={pact.slots}
                expended={sc.pactSlotsExpended ?? 0}
                onChange={setPactExpended}
                note="Recovers on a Short or Long Rest"
              />
            ) : slots && topSpellLevel > 0 ? (
              Array.from({ length: topSpellLevel }, (_, idx) => idx + 1).map((lvl) => {
                const max = slots[lvl] ?? 0;
                if (max <= 0) return null;
                const bd = spellSlotMaxBreakdown(character, lvl);
                return (
                  <SlotTracker
                    key={lvl}
                    label={`Level ${lvl}`}
                    breakdown={bd ?? { total: max, components: [{ label: 'Max', value: max }] }}
                    max={max}
                    expended={sc.slotsExpended?.[lvl] ?? 0}
                    onChange={(n) => setSlotExpended(lvl, n)}
                    note="Recovers on a Long Rest"
                  />
                );
              })
            ) : (
              <EmptyState
                icon={Sparkles}
                heading="No spell slots yet"
                description="This character has no leveled spell slots at the current level."
              />
            )}
          </CollapsibleSection>
        </Card>
      )}

      {activeSubTab === 'slots' && arcanumLevels.length > 0 && (
        <Card>
          <CollapsibleSection
            title="Mystic Arcanum"
            storageKey="dnd-collapse-mystic-arcanum"
          >
            <p className={styles.capLabel}>
              Choose one Warlock spell for each arcanum level. Each is cast once
              without a spell slot and recovers on a Long Rest.
            </p>
            {arcanumLevels.map((lvl) => {
              const options = classSpells.filter((s) => s.level === lvl);
              const chosen = sc.mysticArcana?.[lvl] ?? '';
              const expended = sc.mysticArcanaExpended?.[lvl] ?? false;
              return (
                <div key={lvl} className={styles.slotRow}>
                  <span className={styles.slotLabel}>Level {lvl} Arcanum</span>
                  <label className={styles.filterField}>
                    <span className={styles.fieldLabel}>Spell</span>
                    <select
                      className={styles.filterSelect}
                      value={chosen}
                      aria-label={`Level ${lvl} Mystic Arcanum spell`}
                      onChange={(e) => chooseArcanum(lvl, e.target.value as SpellId | '')}
                    >
                      <option value="">— choose —</option>
                      {options.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.filterCheck}>
                    <input
                      type="checkbox"
                      checked={expended}
                      disabled={chosen === ''}
                      aria-label={`Level ${lvl} arcanum expended`}
                      onChange={(e) => toggleArcanumExpended(lvl, e.target.checked)}
                    />
                    <span className={styles.checkboxText}>Expended</span>
                  </label>
                </div>
              );
            })}
          </CollapsibleSection>
        </Card>
      )}

      {/* Multiclass (Stage M5): one Prepared / Cantrips / Spellbook section per
          ACTIVE caster class, each scoped to THAT class's own list, caps, and
          selections under byClass[classId] (PHB 2024 "Multiclassing:
          Spellcasting", L2119 — each class prepares as a single-classed member
          of itself). Single-class uses the inline path below (byte-identical). */}
      {activeSubTab === 'prepared' && isMulticlass && (
        <>
          {allClasses(character)
            .filter(entryIsSpellcaster)
            .map((entry) => (
              <PreparedClassSection
                key={entry.id}
                character={character}
                entry={entry}
                onChange={onChange}
                onNotify={onNotify}
              />
            ))}
        </>
      )}

      {activeSubTab === 'prepared' && !isMulticlass && (
        <>
          {cantripCap > 0 && (
            <Card>
              <CollapsibleSection title="Cantrips" storageKey="dnd-collapse-cantrips">
                <p className={styles.capLabel}>
                  Known cantrips — choose{' '}
                  {cantripCapBreakdown ? (
                    <CalculatedValue label="Cantrips Known" breakdown={cantripCapBreakdown}>
                      {cantripCap}
                    </CalculatedValue>
                  ) : (
                    cantripCap
                  )}{' '}
                  (
                  <CalculatedValue
                    label="Cantrips chosen"
                    breakdown={selectionBreakdown('Cantrips chosen', chosenCantrips.length, cantripCap)}
                  >
                    {chosenCantrips.length}
                  </CalculatedValue>{' '}
                  chosen)
                </p>
                <SpellPickList
                  spells={cantripSpells}
                  selectedIds={chosenCantrips}
                  atCap={chosenCantrips.length >= cantripCap}
                  lockedIds={required}
                  onToggle={toggleCantrip}
                />
              </CollapsibleSection>
            </Card>
          )}

          <Card>
            <CollapsibleSection title="Prepared Spells" storageKey="dnd-collapse-prepared">
              <p className={styles.capLabel}>
                Prepared — choose{' '}
                {preparedCapBreakdown ? (
                  <CalculatedValue label="Prepared Spells" breakdown={preparedCapBreakdown}>
                    {preparedCap}
                  </CalculatedValue>
                ) : (
                  preparedCap
                )}{' '}
                (
                <CalculatedValue
                  label="Prepared chosen"
                  breakdown={selectionBreakdown('Prepared chosen', chosenPrepared.length, preparedCap)}
                >
                  {chosenPrepared.length}
                </CalculatedValue>{' '}
                prepared)
              </p>
              {alwaysPrepared.length > 0 && (
                <p className={styles.capLabel}>
                  Always prepared (from class features, not counted against the
                  cap):{' '}
                  <SpellNameList ids={alwaysPrepared} />
                  .
                </p>
              )}
              {preparableSpells.length > 0 || alwaysPrepared.length > 0 ? (
                <SpellPickList
                  spells={preparedPickSpells}
                  selectedIds={[...chosenPrepared, ...alwaysPrepared]}
                  atCap={chosenPrepared.length >= preparedCap}
                  onToggle={togglePrepared}
                  lockedIds={alwaysPrepared}
                  lockedLabel="always prepared"
                  showLevel
                  concentratingId={character.concentration?.spellId}
                  onToggleConcentration={setConcentrating}
                />
              ) : (
                <EmptyState
                  icon={Sparkles}
                  heading="No leveled spells yet"
                  description={
                    usesSpellbook
                      ? 'Scribe spells into your spellbook below, then prepare from them.'
                      : 'Gain a spell slot to prepare leveled spells.'
                  }
                />
              )}
            </CollapsibleSection>
          </Card>

          {usesSpellbook && (
            <Card>
              <CollapsibleSection title="Spellbook" storageKey="dnd-collapse-spellbook">
                <SpellbookAllowance level={primaryEntry?.level ?? 1} count={(perClass.spellbook ?? []).length} />
                <SpellPickList
                  spells={spellbookCandidates}
                  selectedIds={perClass.spellbook ?? []}
                  atCap={false}
                  onToggle={toggleSpellbook}
                  showLevel
                />
              </CollapsibleSection>
            </Card>
          )}
        </>
      )}

      {activeSubTab === 'browse' && (
        <Card>
          <div className={styles.filterRow}>
            <label className={styles.filterField}>
              <span className={styles.fieldLabel}>Level</span>
              <select
                className={styles.filterSelect}
                value={filterLevel === 'all' ? 'all' : String(filterLevel)}
                aria-label="Filter by spell level"
                onChange={(e) =>
                  setFilterLevel(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
              >
                <option value="all">All levels</option>
                {Array.from({ length: 10 }, (_, i) => i).map((l) => (
                  <option key={l} value={l}>
                    {spellLevelLabel(l)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.filterField}>
              <span className={styles.fieldLabel}>School</span>
              <select
                className={styles.filterSelect}
                value={filterSchool}
                aria-label="Filter by school"
                onChange={(e) => setFilterSchool(e.target.value as 'all' | SpellSchool)}
              >
                <option value="all">All schools</option>
                {(Object.keys(SCHOOL_LABELS) as SpellSchool[]).map((s) => (
                  <option key={s} value={s}>
                    {SCHOOL_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.filterCheck}>
              <input
                type="checkbox"
                checked={filterRitual}
                aria-label="Only rituals"
                onChange={(e) => setFilterRitual(e.target.checked)}
              />
              <span className={styles.checkboxText}>Ritual</span>
            </label>

            <label className={styles.filterCheck}>
              <input
                type="checkbox"
                checked={filterConcentration}
                aria-label="Only concentration spells"
                onChange={(e) => setFilterConcentration(e.target.checked)}
              />
              <span className={styles.checkboxText}>Concentration</span>
            </label>
          </div>

          {browseByLevel.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              heading="No spells match"
              description="Adjust the filters to see spells from your class list."
            />
          ) : (
            browseByLevel.map(([lvl, spells]) => (
              <CollapsibleSection
                key={lvl}
                title={spellLevelLabel(lvl)}
                storageKey={`dnd-collapse-browse-${lvl}`}
              >
                <ul className={styles.browseList} aria-label={`${spellLevelLabel(lvl)} spells`}>
                  {spells.map((s) => (
                    <li key={s.id} className={styles.browseRow}>
                      <span className={styles.browseName}>
                          <SpellName id={s.id} />
                        </span>
                      <span className={styles.browseMeta}>
                        {SCHOOL_LABELS[s.school]} · {s.castingTime} · {s.range}
                        {s.concentration ? ' · Concentration' : ''}
                        {s.ritual ? ' · Ritual' : ''}
                      </span>
                      <span className={styles.browseDescription}>{s.description}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            ))
          )}
        </Card>
      )}
    </div>
  );
}

// ── Local sub-components ─────────────────────────────────────────────────────

interface PreparedClassSectionProps {
  character: Character;
  /** The single caster class this section manages (its own list, caps, bucket). */
  entry: ClassEntry;
  onChange: (next: Character) => void;
  onNotify?: (message: string) => void;
}

/**
 * The Prepared / Cantrips / Spellbook pickers for ONE caster class in a
 * multiclass character. Every input (spell list, cantrip + prepared caps,
 * always-prepared / required spells, spellbook gating) resolves against THAT
 * class at its OWN class level (PHB 2024 "Multiclassing: Spellcasting", L2119 —
 * each class prepares as a single-classed member of itself), and all edits are
 * written under byClass[entry.id]. Mirrors the single-class Prepared tab, which
 * remains the code path for a single-class character (byte-identical).
 *
 * Castability (PHB 2024 L2168 cross-pool): each prepared leveled spell is marked
 * castable-now when some UNEXPENDED slot of level >= the spell's level exists in
 * EITHER pool (canCastPreparedSpell) — a pact slot may cast a prepared
 * Spellcasting spell and vice versa when both pools exist.
 */
function PreparedClassSection({
  character,
  entry,
  onChange,
  onNotify,
}: PreparedClassSectionProps) {
  const className = getClass(entry.id)?.name ?? entry.id;
  const sc: SpellcastingState = character.spellcasting ?? {};
  const perClass: ClassSpellcasting = sc.byClass?.[entry.id] ?? {};

  const orderCantrips = extraCantrips(character, entry.id);
  const cantripCap = classCantripsKnown(entry, orderCantrips);
  const preparedCap = classPreparedCount(entry);
  const cantripCapBreakdown = classCantripsKnownBreakdown(entry, {
    label: extraCantripLabel(character, entry.id) ?? 'Class feature choice',
    value: orderCantrips,
  });
  const preparedCapBreakdown = classPreparedCountBreakdown(entry);
  const topSpellLevel = classMaxPreparedLevel(entry);
  const usesSpellbook = classUsesSpellbook(entry);

  const alwaysPrepared = useMemo(() => classAlwaysPreparedSpells(entry, character), [entry, character]);
  const required = useMemo(() => classRequiredCantrips(entry), [entry]);

  // Selections that are not legal for the class (see illegalSpellSelections) are
  // ignored here so they cannot silently eat the cap; the notice above offers to
  // remove them.
  const illegalSelections = useMemo(() => illegalSpellSelections(character), [character]);
  const illegalKeys = useMemo(
    () => new Set(illegalSelections.filter((i) => i.classId === entry.id).map((i) => `${i.kind}:${i.id}`)),
    [illegalSelections, entry.id],
  );
  const chosenPrepared = useMemo(
    () =>
      (perClass.prepared ?? []).filter(
        (id) => !alwaysPrepared.includes(id) && !illegalKeys.has(`prepared:${id}`),
      ),
    [perClass.prepared, alwaysPrepared, illegalKeys],
  );
  const chosenCantrips = useMemo(() => {
    const stored = (perClass.cantrips ?? []).filter((id) => !illegalKeys.has(`cantrip:${id}`));
    const missing = required.filter((id) => !stored.includes(id));
    return missing.length > 0 ? [...missing, ...stored] : stored;
  }, [perClass.cantrips, required, illegalKeys]);

  const listKey = classSpellListClassIds(entry).join(',');
  const classSpells = useMemo(
    () => mergeSpellLists(listKey ? listKey.split(',') : []),
    [listKey],
  );
  const cantripListKey = classCantripListClassIds(entry).join(',');
  const cantripListSpells = useMemo(
    () => mergeSpellLists(cantripListKey ? cantripListKey.split(',') : []),
    [cantripListKey],
  );
  const cantripSpells = useMemo(
    () => cantripListSpells.filter((s) => s.level === 0),
    [cantripListSpells],
  );

  const spellbookCandidates = useMemo(
    () => classSpells.filter((s) => s.level >= 1 && s.level <= topSpellLevel),
    [classSpells, topSpellLevel],
  );
  const preparableSpells = useMemo(() => {
    if (!usesSpellbook) return spellbookCandidates;
    const book = new Set(perClass.spellbook ?? []);
    return spellbookCandidates.filter((s) => book.has(s.id));
  }, [usesSpellbook, spellbookCandidates, perClass.spellbook]);
  const preparedPickSpells = useMemo(() => {
    const present = new Set(preparableSpells.map((s) => s.id));
    const extra = alwaysPrepared
      .filter((id) => !present.has(id))
      .map((id) => getSpell(id))
      .filter((s): s is CatalogSpell => s !== undefined);
    if (extra.length === 0) return preparableSpells;
    return [...preparableSpells, ...extra].sort(
      (a, b) => (a.level - b.level) || a.name.localeCompare(b.name),
    );
  }, [preparableSpells, alwaysPrepared]);

  // ── State mutation (writes under byClass[entry.id]) ───────────────────────
  const patchPerClass = (patch: Partial<ClassSpellcasting>) => {
    const nextPerClass: ClassSpellcasting = { ...perClass, ...patch };
    const next: SpellcastingState = {
      ...sc,
      byClass: { ...sc.byClass, [entry.id]: nextPerClass },
    };
    onChange({ ...character, spellcasting: next });
  };

  const toggleCantrip = (id: SpellId, checked: boolean) => {
    if (checked) {
      if (!isSpellLegalForEntry(character, entry, 'cantrip', id)) return; // only this class's cantrip list
      if (chosenCantrips.includes(id)) return;
      if (chosenCantrips.length >= cantripCap) return;
      patchPerClass({ cantrips: [...chosenCantrips, id] });
    } else {
      if (required.includes(id)) return;
      patchPerClass({ cantrips: chosenCantrips.filter((c) => c !== id) });
    }
  };

  const togglePrepared = (id: SpellId, checked: boolean) => {
    if (alwaysPrepared.includes(id)) return;
    if (checked) {
      if (!isSpellLegalForEntry(character, entry, 'prepared', id)) return; // only this class's spell list
      if (chosenPrepared.includes(id)) return;
      if (chosenPrepared.length >= preparedCap) return;
      patchPerClass({ prepared: [...chosenPrepared, id] });
    } else {
      patchPerClass({ prepared: chosenPrepared.filter((p) => p !== id) });
    }
  };

  const toggleSpellbook = (id: SpellId, checked: boolean) => {
    const book = perClass.spellbook ?? [];
    if (checked) {
      if (!isSpellLegalForEntry(character, entry, 'spellbook', id)) return; // only this class's spell list
      if (book.includes(id)) return;
      patchPerClass({ spellbook: [...book, id] });
    } else {
      patchPerClass({
        spellbook: book.filter((b) => b !== id),
        prepared: chosenPrepared.filter((p) => p !== id),
      });
    }
  };

  const setConcentrating = (id: SpellId, on: boolean) => {
    if (!on) {
      onChange(endConcentration(character));
      onNotify?.(`Concentration on ${getSpell(id)?.name ?? id} ended.`);
      return;
    }
    const started = startConcentration(character, id, getSpell(id)?.concentration === true);
    onChange(started.character);
    const name = getSpell(id)?.name ?? id;
    onNotify?.(
      started.endedPrevious
        ? `Now concentrating on ${name}. Concentration on ${getSpell(started.endedPrevious)?.name ?? started.endedPrevious} ended.`
        : `Now concentrating on ${name}.`,
    );
  };

  // Castability per prepared spell (cross-pool, PHB 2024 L2168): true when some
  // unexpended slot of level >= the spell's level exists in either pool.
  const castableIds = useMemo(() => {
    const ids = new Set<SpellId>();
    for (const s of preparedPickSpells) {
      if (canCastPreparedSpell(character, s.level)) ids.add(s.id);
    }
    return ids;
  }, [preparedPickSpells, character]);

  return (
    <>
      {cantripCap > 0 && (
        <Card>
          <CollapsibleSection
            title={`${className} — Cantrips`}
            storageKey={`dnd-collapse-cantrips-${entry.id}`}
          >
            <p className={styles.capLabel}>
              Known cantrips — choose{' '}
              {cantripCapBreakdown ? (
                <CalculatedValue label={`${className} Cantrips Known`} breakdown={cantripCapBreakdown}>
                  {cantripCap}
                </CalculatedValue>
              ) : (
                cantripCap
              )}{' '}
              (
              <CalculatedValue
                label="Cantrips chosen"
                breakdown={selectionBreakdown('Cantrips chosen', chosenCantrips.length, cantripCap)}
              >
                {chosenCantrips.length}
              </CalculatedValue>{' '}
              chosen)
            </p>
            <SpellPickList
              spells={cantripSpells}
              selectedIds={chosenCantrips}
              atCap={chosenCantrips.length >= cantripCap}
              lockedIds={required}
              onToggle={toggleCantrip}
            />
          </CollapsibleSection>
        </Card>
      )}

      <Card>
        <CollapsibleSection
          title={`${className} — Prepared Spells`}
          storageKey={`dnd-collapse-prepared-${entry.id}`}
        >
          <p className={styles.capLabel}>
            Prepared — choose{' '}
            {preparedCapBreakdown ? (
              <CalculatedValue label={`${className} Prepared Spells`} breakdown={preparedCapBreakdown}>
                {preparedCap}
              </CalculatedValue>
            ) : (
              preparedCap
            )}{' '}
            (
            <CalculatedValue
              label="Prepared chosen"
              breakdown={selectionBreakdown('Prepared chosen', chosenPrepared.length, preparedCap)}
            >
              {chosenPrepared.length}
            </CalculatedValue>{' '}
            prepared)
          </p>
          {alwaysPrepared.length > 0 && (
            <p className={styles.capLabel}>
              Always prepared (from class features, not counted against the cap):{' '}
              <SpellNameList ids={alwaysPrepared} />.
            </p>
          )}
          {preparableSpells.length > 0 || alwaysPrepared.length > 0 ? (
            <SpellPickList
              spells={preparedPickSpells}
              selectedIds={[...chosenPrepared, ...alwaysPrepared]}
              atCap={chosenPrepared.length >= preparedCap}
              onToggle={togglePrepared}
              lockedIds={alwaysPrepared}
              lockedLabel="always prepared"
              showLevel
              castableIds={castableIds}
              concentratingId={character.concentration?.spellId}
              onToggleConcentration={setConcentrating}
            />
          ) : (
            <EmptyState
              icon={Sparkles}
              heading="No leveled spells yet"
              description={
                usesSpellbook
                  ? 'Scribe spells into your spellbook below, then prepare from them.'
                  : 'Gain a spell slot to prepare leveled spells.'
              }
            />
          )}
        </CollapsibleSection>
      </Card>

      {usesSpellbook && (
        <Card>
          <CollapsibleSection
            title={`${className} — Spellbook`}
            storageKey={`dnd-collapse-spellbook-${entry.id}`}
          >
            <SpellbookAllowance level={entry.level} count={(perClass.spellbook ?? []).length} />
            <SpellPickList
              spells={spellbookCandidates}
              selectedIds={perClass.spellbook ?? []}
              atCap={false}
              onToggle={toggleSpellbook}
              showLevel
            />
          </CollapsibleSection>
        </Card>
      )}
    </>
  );
}

interface SlotTrackerProps {
  label: string;
  breakdown: { total: number; components: { label: string; value: number }[] };
  max: number;
  expended: number;
  onChange: (next: number) => void;
  note?: string;
}

/** A single slot-level row: max (with CalculatedValue) + available/expended +/-. */
function SlotTracker({ label, breakdown, max, expended, onChange, note }: SlotTrackerProps) {
  const available = Math.max(0, max - expended);
  const availableBreakdown = spellSlotAvailableBreakdown(max, expended, label);
  return (
    <div className={styles.slotRow}>
      <span className={styles.slotLabel}>{label}</span>
      <span className={styles.slotMax}>
        <CalculatedValue label={`${label} slots`} breakdown={breakdown}>
          {max}
        </CalculatedValue>
        <span className={styles.slotMaxCaption}> max</span>
      </span>
      <div className={styles.slotControls}>
        <button
          type="button"
          className={styles.slotButton}
          aria-label={`Spend a ${label} slot`}
          disabled={available <= 0}
          onClick={() => onChange(expended + 1)}
        >
          −
        </button>
        <span className={styles.slotCount} aria-live="polite">
          <CalculatedValue label={`${label} available`} breakdown={availableBreakdown}>
            {available}
          </CalculatedValue>{' '}
          /{' '}
          <CalculatedValue label={`${label} max`} breakdown={breakdown}>
            {max}
          </CalculatedValue>
        </span>
        <button
          type="button"
          className={styles.slotButton}
          aria-label={`Recover a ${label} slot`}
          disabled={expended <= 0}
          onClick={() => onChange(expended - 1)}
        >
          +
        </button>
      </div>
      {note && <span className={styles.slotNote}>{note}</span>}
    </div>
  );
}
