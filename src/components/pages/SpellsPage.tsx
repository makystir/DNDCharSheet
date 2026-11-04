import { useEffect, useMemo, useState } from 'react';
import { Sparkles, BookOpen } from 'lucide-react';
import type { Character, SpellcastingState } from '../../types/character';
import { formatSigned } from '../../logic/breakdown';
import { resolveClass } from '../../logic/classes';
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
} from '../../logic/spellcasting';
import { SPELLCASTING_DESCRIPTORS } from '../../data/spell-progression';
import { getSpell, spellsForClass } from '../../data/spells';
import type { CatalogSpell, SpellId, SpellSchool } from '../../data/spells';
import { ABILITY_NAMES } from '../../types/character';
import { endConcentration, startConcentration } from '../../logic/concentration';
import { CalculatedValue } from '../shared/CalculatedValue';
import { Card } from '../shared/Card';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { EmptyState } from '../shared/EmptyState';
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

const SCHOOL_LABELS: Record<SpellSchool, string> = {
  abjuration: 'Abjuration',
  conjuration: 'Conjuration',
  divination: 'Divination',
  enchantment: 'Enchantment',
  evocation: 'Evocation',
  illusion: 'Illusion',
  necromancy: 'Necromancy',
  transmutation: 'Transmutation',
};

const CASTER_KIND_LABELS = {
  full: 'Full caster',
  half: 'Half caster',
  third: 'Third caster',
  pact: 'Pact Magic',
} as const;

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
function countBreakdown(label: string, count: number) {
  return { total: count, components: [{ label, value: count }] };
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

  const sc: SpellcastingState = character.spellcasting ?? {};

  // Leveled spells a class/subclass feature makes ALWAYS prepared (Ranger's
  // Hunter's Mark, Paladin's Divine Smite/Find Steed, Druid's Speak with
  // Animals, Warlock's Contact Other Plane, Bard's Words of Creation). PHB 2024
  // excludes these from the Prepared Spells cap, so they are rendered locked and
  // never counted against the discretionary cap (reviewer finding).
  const alwaysPrepared = useMemo(() => alwaysPreparedSpells(character), [character]);
  // The player's discretionary prepared spells: stored prepared minus any that
  // are always-prepared (so a feature spell previously picked by hand no longer
  // eats a slot of the cap).
  const chosenPrepared = useMemo(
    () => (sc.prepared ?? []).filter((id) => !alwaysPrepared.includes(id)),
    [sc.prepared, alwaysPrepared],
  );

  // Cantrips the character must know and cannot replace (Arcane Trickster's
  // Mage Hand, PHB 2024 ~p.123). They are always treated as chosen: locked in
  // the picker (cannot be unchecked) and counted against the cantrip cap, even
  // before the user makes any selection — without forcing a write on mount.
  const required = useMemo(() => requiredCantrips(character), [character]);
  const chosenCantrips = useMemo(() => {
    const stored = sc.cantrips ?? [];
    const missing = required.filter((id) => !stored.includes(id));
    return missing.length > 0 ? [...missing, ...stored] : stored;
  }, [sc.cantrips, required]);

  // Merge the catalog spells of a set of class lists (deduped, level-sorted).
  const mergeLists = (ids: string[]): CatalogSpell[] => {
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
  };

  // The leveled spell list(s) the character prepares/browses from: the Wizard
  // list for EK/AT, and the Bard/Cleric/Druid/Wizard union for a level-10+ Bard
  // (Magical Secrets). Cantrips use the NARROWER cantrip list below — Magical
  // Secrets widens prepared spells only, not cantrips (PHB 2024 "Bard").
  const listKey = spellListClassIds(character).join(',');
  const classSpells = useMemo(
    () => mergeLists(listKey ? listKey.split(',') : []),
    // listKey captures the list-id union as a stable primitive dependency.
    [listKey],
  );

  // The cantrip pool is the primary class list only (never widened by Magical
  // Secrets), so a level-10 Bard cannot select non-Bard cantrips (review
  // finding: Magical Secrets incorrectly expanded Bard cantrips).
  const cantripListKey = cantripListClassIds(character).join(',');
  const cantripListSpells = useMemo(
    () => mergeLists(cantripListKey ? cantripListKey.split(',') : []),
    // cantripListKey is a stable primitive capturing the cantrip-list union.
    [cantripListKey],
  );

  // ── State mutation helpers ────────────────────────────────────────────────
  const patchSpellcasting = (patch: Partial<SpellcastingState>) => {
    onChange({ ...character, spellcasting: { ...sc, ...patch } });
  };

  const toggleCantrip = (id: SpellId, checked: boolean) => {
    if (checked) {
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
    const book = sc.spellbook ?? [];
    if (checked) {
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
    const max = slots?.[slotLevel] ?? 0;
    const clamped = Math.max(0, Math.min(max, next));
    patchSpellcasting({
      slotsExpended: { ...sc.slotsExpended, [slotLevel]: clamped },
    });
  };

  const setPactExpended = (next: number) => {
    const max = pact?.slots ?? 0;
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
    const book = new Set(sc.spellbook ?? []);
    return spellbookCandidates.filter((s) => book.has(s.id));
  }, [usesSpellbook, spellbookCandidates, sc.spellbook]);

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

      {activeSubTab === 'slots' && (
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

      {activeSubTab === 'prepared' && (
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
                  {alwaysPrepared
                    .map((id) => getSpell(id)?.name ?? id)
                    .join(', ')}
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
                <p className={styles.capLabel}>
                  Scribed spells (
                  <CalculatedValue
                    label="Spellbook size"
                    breakdown={countBreakdown('Scribed spells', (sc.spellbook ?? []).length)}
                  >
                    {(sc.spellbook ?? []).length}
                  </CalculatedValue>{' '}
                  in book). You prepare from your spellbook; full scribe/copy
                  mechanics arrive later.
                </p>
                <SpellPickList
                  spells={spellbookCandidates}
                  selectedIds={sc.spellbook ?? []}
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
                      <span className={styles.browseName}>{s.name}</span>
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

interface SpellPickListProps {
  spells: CatalogSpell[];
  selectedIds: SpellId[];
  atCap: boolean;
  onToggle: (id: SpellId, checked: boolean) => void;
  showLevel?: boolean;
  /** Ids that are always selected and cannot be unchecked (e.g. Mage Hand). */
  lockedIds?: SpellId[];
  /** Badge/aria text for locked rows (defaults to "required"). */
  lockedLabel?: string;
  /** The spell currently concentrated on (Stage A5b); enables the toggle column. */
  concentratingId?: SpellId;
  /** When given, each chosen concentration spell shows a "Concentrating" toggle. */
  onToggleConcentration?: (id: SpellId, on: boolean) => void;
}

/** A checkbox list of spells, disabling unchecked rows once the cap is reached. */
function SpellPickList({
  spells,
  selectedIds,
  atCap,
  onToggle,
  showLevel,
  lockedIds = [],
  lockedLabel = 'required',
  concentratingId,
  onToggleConcentration,
}: SpellPickListProps) {
  if (spells.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        heading="No spells available"
        description="There are no spells of this kind on your class list yet."
        compact
      />
    );
  }
  return (
    <ul className={styles.pickList} aria-label="Spell choices">
      {spells.map((s) => {
        const checked = selectedIds.includes(s.id);
        const locked = lockedIds.includes(s.id);
        return (
          <li key={s.id} className={styles.pickRow}>
            <label className={styles.pickLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={checked}
                // Locked (required) cantrips stay checked and cannot be toggled
                // off; otherwise unchecked rows disable once the cap is reached.
                disabled={locked || (!checked && atCap)}
                aria-label={`${s.name}${showLevel ? ` (level ${s.level})` : ''}${
                  locked ? ` (${lockedLabel})` : ''
                }`}
                onChange={(e) => onToggle(s.id, e.target.checked)}
              />
              <span className={styles.pickName}>
                {s.name}
                {locked && <span className={styles.pickLevel}> · {lockedLabel}</span>}
                {showLevel && <span className={styles.pickLevel}> · L{s.level}</span>}
              </span>
            </label>
            {onToggleConcentration && checked && s.concentration && (
              <label className={styles.concentrateLabel}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={concentratingId === s.id}
                  aria-label={`Concentrating on ${s.name}`}
                  onChange={(e) => onToggleConcentration(s.id, e.target.checked)}
                />
                <span>Concentrating</span>
              </label>
            )}
          </li>
        );
      })}
    </ul>
  );
}
