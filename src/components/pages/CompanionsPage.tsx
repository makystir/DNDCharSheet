import { useEffect, useState } from 'react';
import type { Character } from '../../types/character';
import { sidekicksEnabled } from '../../logic/companions-actions';
import { loadLastSubTab, saveLastSubTab } from '../../logic/sub-tab-store';
import { useTabOrder } from '../../hooks/useTabOrder';
import { useUndoToast } from '../../hooks/useUndoToast';
import { SubTabBar } from '../shared/SubTabBar';
import { Toast } from '../shared/Toast';
import { CompanionsTab } from '../companions/CompanionsTab';
import { HirelingsTab } from '../companions/HirelingsTab';
import { MountsTab } from '../companions/MountsTab';
import { NpcPartyTab } from '../companions/NpcPartyTab';
import { SidekicksTab } from '../companions/SidekicksTab';
import styles from './CompanionsPage.module.css';

export interface CompanionsPageProps {
  character: Character;
  onChange: (next: Character) => void;
  /** The sub-tab from the URL hash (or null); the page owns final resolution. */
  subTab?: string | null;
  /** Called when the user selects a sub-tab, to sync the hash. */
  onSubTabChange?: (tab: string) => void;
}

type CompanionsSubTab = 'companions' | 'mounts' | 'hirelings' | 'npc-party' | 'sidekicks';

// Stable identities (module scope) so they stay out of effect dependency arrays.
const VALID_SUBTABS: CompanionsSubTab[] = ['companions', 'mounts', 'hirelings', 'npc-party', 'sidekicks'];

/**
 * All five tabs are the default order so a stored order stays stable when the
 * Sidekicks house rule is switched on and off; the Sidekicks tab is filtered out
 * at render while the rule is off.
 */
const DEFAULT_SUBTABS: { id: CompanionsSubTab; label: string }[] = [
  { id: 'companions', label: 'Companions' },
  { id: 'mounts', label: 'Mounts & Animals' },
  { id: 'hirelings', label: 'Hirelings' },
  { id: 'npc-party', label: 'NPC Party Members' },
  { id: 'sidekicks', label: 'Sidekicks' },
];

function isValidSubTab(value: string | null | undefined): value is CompanionsSubTab {
  return value != null && VALID_SUBTABS.includes(value as CompanionsSubTab);
}

/**
 * The Companions page. Modelled on the WFRP app's Retinue page (RetinuePage):
 * a SubTabBar with reorderable tabs (URL hash > last used > first ordered), one
 * Card + SectionHeader per tab, an undo Toast after deletes and a Toast when the
 * tab order cannot be saved. Deviations (documented): five D&D tabs instead of
 * two, in the user's order (Companions first); the Sidekicks tab only shows when
 * the Tasha's Sidekicks house rule is on; no loading skeleton (Retinue has none).
 *
 * Companion HP and conditions are edited on this page only (one editor).
 */
export function CompanionsPage({ character, onChange, subTab, onSubTabChange }: CompanionsPageProps) {
  const { orderedTabs, isEditMode, toggleEditMode, moveLeft, moveRight, resetOrder, isDefaultOrder, saveError } = useTabOrder({
    pageKey: 'companions',
    defaultTabs: DEFAULT_SUBTABS,
  });
  const undoToast = useUndoToast();
  const sidekicksOn = sidekicksEnabled(character);

  const resolveInitialTab = (): CompanionsSubTab => {
    if (isValidSubTab(subTab)) return subTab;
    const lastUsed = loadLastSubTab('companions');
    if (isValidSubTab(lastUsed)) return lastUsed;
    const firstOrdered = orderedTabs[0]?.id;
    if (isValidSubTab(firstOrdered)) return firstOrdered;
    return 'companions';
  };

  const [activeSubTab, setActiveSubTabInternal] = useState<CompanionsSubTab>(resolveInitialTab);

  // Mirror a valid external hash sub-tab into local state (deep link / paste).
  // Intentional setState-in-effect: reacts to the external routing input.
  useEffect(() => {
    if (isValidSubTab(subTab)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSubTabInternal(subTab);
    }
  }, [subTab]);

  const setActiveSubTab = (tab: CompanionsSubTab) => {
    setActiveSubTabInternal(tab);
    saveLastSubTab('companions', tab);
    onSubTabChange?.(tab);
  };

  const visibleTabs = orderedTabs.filter((t) => t.id !== 'sidekicks' || sidekicksOn);
  // A hidden Sidekicks tab (rule off) falls back to Companions instead of erroring.
  const shownTab: CompanionsSubTab = activeSubTab === 'sidekicks' && !sidekicksOn ? 'companions' : activeSubTab;

  return (
    <div className={styles.page}>
      <SubTabBar
        tabs={visibleTabs}
        activeTab={shownTab}
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

      {shownTab === 'companions' && <CompanionsTab character={character} onChange={onChange} undo={undoToast} />}

      {shownTab === 'mounts' && <MountsTab character={character} onChange={onChange} undo={undoToast} />}

      {shownTab === 'hirelings' && <HirelingsTab character={character} onChange={onChange} undo={undoToast} />}

      {shownTab === 'npc-party' && <NpcPartyTab character={character} onChange={onChange} undo={undoToast} />}

      {shownTab === 'sidekicks' && <SidekicksTab character={character} onChange={onChange} undo={undoToast} />}
      <Toast
        message={undoToast.pending?.message ?? null}
        duration={5000}
        action={undoToast.pending ? { label: 'Undo', onAction: undoToast.undo } : undefined}
      />
      <Toast message={saveError ? 'Tab order could not be saved' : null} duration={5000} />
    </div>
  );
}
