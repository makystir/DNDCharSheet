import { useEffect, useState } from 'react';
import type { Character } from '../../types/character';
import { partyRoster } from '../../logic/party-roster';
import { loadLastSubTab, saveLastSubTab } from '../../logic/sub-tab-store';
import { useTabOrder } from '../../hooks/useTabOrder';
import { useUndoToast } from '../../hooks/useUndoToast';
import { SubTabBar } from '../shared/SubTabBar';
import { Toast } from '../shared/Toast';
import { CreaturesTab } from '../companions/CreaturesTab';
import { PeopleTab } from '../companions/PeopleTab';
import type { PeopleFilter } from '../companions/PeopleTab';
import styles from './CompanionsPage.module.css';

export interface CompanionsPageProps {
  character: Character;
  onChange: (next: Character) => void;
  /** The sub-tab from the URL hash (or null); the page owns final resolution. */
  subTab?: string | null;
  /** Called when the user selects a sub-tab, to sync the hash. */
  onSubTabChange?: (tab: string) => void;
}

type CompanionsSubTab = 'creatures' | 'people';

// Stable identities (module scope) so they stay out of effect dependency arrays.
const VALID_SUBTABS: CompanionsSubTab[] = ['creatures', 'people'];

const DEFAULT_SUBTABS: { id: CompanionsSubTab; label: string }[] = [
  { id: 'creatures', label: 'Creatures' },
  { id: 'people', label: 'People' },
];

/**
 * The page had five tabs before the redesign. Old deep links and stored
 * last-used ids still land somewhere sensible: Companions and Mounts & Animals
 * merged into Creatures; Hirelings, NPC Party Members and Sidekicks are People
 * with that filter selected.
 */
const LEGACY_SUBTABS: Record<string, { tab: CompanionsSubTab; filter?: PeopleFilter }> = {
  companions: { tab: 'creatures' },
  mounts: { tab: 'creatures' },
  hirelings: { tab: 'people', filter: 'hirelings' },
  'npc-party': { tab: 'people', filter: 'npc' },
  sidekicks: { tab: 'people', filter: 'sidekicks' },
};

function resolveId(value: string | null | undefined): { tab: CompanionsSubTab; filter?: PeopleFilter } | null {
  if (value == null) return null;
  if (VALID_SUBTABS.includes(value as CompanionsSubTab)) return { tab: value as CompanionsSubTab };
  return LEGACY_SUBTABS[value] ?? null;
}

/**
 * The Companions page. Modelled on the WFRP app's Retinue page (RetinuePage):
 * a SubTabBar with reorderable tabs (URL hash > last used > first ordered), one
 * Card + SectionHeader per tab, an undo Toast after deletes and a Toast when the
 * tab order cannot be saved. Two tabs: Creatures (companions, mounts, pets) and
 * People (hirelings, NPC party members, sidekicks). A roster strip above the
 * tabs shows who is tracked and who needs attention (0 HP, conditions).
 *
 * Companion HP and conditions are edited on this page only (one editor).
 */
export function CompanionsPage({ character, onChange, subTab, onSubTabChange }: CompanionsPageProps) {
  const { orderedTabs, isEditMode, toggleEditMode, moveLeft, moveRight, resetOrder, isDefaultOrder, saveError } = useTabOrder({
    pageKey: 'companions',
    defaultTabs: DEFAULT_SUBTABS,
  });
  const undoToast = useUndoToast();

  const resolveInitial = (): { tab: CompanionsSubTab; filter?: PeopleFilter } => {
    const fromHash = resolveId(subTab);
    if (fromHash) return fromHash;
    const lastUsed = resolveId(loadLastSubTab('companions'));
    if (lastUsed) return lastUsed;
    const firstOrdered = resolveId(orderedTabs[0]?.id);
    if (firstOrdered) return firstOrdered;
    return { tab: 'creatures' };
  };

  const [initial] = useState(resolveInitial);
  const [activeSubTab, setActiveSubTabInternal] = useState<CompanionsSubTab>(initial.tab);
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>(initial.filter ?? 'all');

  // Mirror a valid external hash sub-tab into local state (deep link / paste).
  // Intentional setState-in-effect: reacts to the external routing input.
  useEffect(() => {
    const resolved = resolveId(subTab);
    if (resolved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSubTabInternal(resolved.tab);
      if (resolved.filter) setPeopleFilter(resolved.filter);
    }
  }, [subTab]);

  const setActiveSubTab = (tab: CompanionsSubTab) => {
    setActiveSubTabInternal(tab);
    saveLastSubTab('companions', tab);
    onSubTabChange?.(tab);
  };

  return (
    <div className={styles.page}>
      <SubTabBar
        tabs={orderedTabs}
        activeTab={activeSubTab}
        onTabChange={(tab) => setActiveSubTab(tab as CompanionsSubTab)}
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

      <RosterStrip character={character} />

      {activeSubTab === 'creatures' && <CreaturesTab character={character} onChange={onChange} undo={undoToast} />}

      {activeSubTab === 'people' && (
        <PeopleTab character={character} onChange={onChange} undo={undoToast} filter={peopleFilter} onFilterChange={setPeopleFilter} />
      )}

      <Toast
        message={undoToast.pending?.message ?? null}
        duration={5000}
        action={undoToast.pending ? { label: 'Undo', onAction: undoToast.undo } : undefined}
      />
      <Toast message={saveError ? 'Tab order could not be saved' : null} duration={5000} />
    </div>
  );
}

/** Who is tracked, and who needs attention, across both tabs. Hidden while nobody is tracked. */
function RosterStrip({ character }: { character: Character }) {
  const roster = partyRoster(character);
  if (roster.length === 0) return null;
  const creatures = roster.filter((r) => r.group === 'creature' && !r.inactive).length;
  const dismissed = roster.filter((r) => r.group === 'creature' && r.inactive).length;
  const people = roster.filter((r) => r.group === 'person').length;
  const active = roster.filter((r) => !r.inactive);
  const down = active.filter((r) => r.hp?.current === 0);
  const affected = active.filter((r) => r.conditions.length > 0);
  return (
    <div className={styles.roster} data-testid="companions-roster" aria-label="Companions at a glance" role="group">
      <span className={styles.rosterItem}>{`${creatures} ${creatures === 1 ? 'creature' : 'creatures'}${dismissed > 0 ? ` (+${dismissed} dismissed)` : ''}`}</span>
      <span className={styles.rosterItem}>{`${people} ${people === 1 ? 'person' : 'people'}`}</span>
      {down.length > 0 && <span className={styles.rosterWarn}>{`At 0 HP: ${down.map((r) => r.name).join(', ')}`}</span>}
      {affected.map((r) => (
        <span key={r.id} className={styles.rosterItem}>{`${r.name}: ${r.conditions.join(', ')}`}</span>
      ))}
    </div>
  );
}
