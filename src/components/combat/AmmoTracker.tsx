import { useState } from 'react';
import { Target } from 'lucide-react';
import type { Character, InventoryItem } from '../../types/character';
import type { Breakdown } from '../../logic/breakdown';
import { getEquipment } from '../../data/equipment';
import { equippedWeapons, matchingAmmunition, recoverAmmo } from '../../logic/attacks';
import { resolveWeaponPropertyTooltip } from '../../logic/tooltip-content';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import { EmptyState } from '../shared/EmptyState';
import styles from './AmmoTracker.module.css';

export interface AmmoTrackerProps {
  character: Character;
  onChange: (next: Character) => void;
  /**
   * Pieces fired this fight, by ammunition inventory item id. Optional: without it
   * the tracker keeps the count itself. CombatPage owns it so the Attack Flow can
   * record shots made from the attack dialog.
   */
  usedByItem?: Record<string, number>;
  onUsedChange?: (next: Record<string, number>) => void;
  defaultCollapsed?: boolean;
}

const ammoName = (item: InventoryItem) =>
  item.name ?? (item.catalogId ? getEquipment(item.catalogId)?.name : undefined) ?? 'Ammunition';

/**
 * How much is recovered. The rule (half, rounded down) is `recoverAmmo`; the
 * components sum to the total: the pieces fired, minus the half that is lost.
 */
function recoveredBreakdown(used: number): Breakdown {
  const recovered = recoverAmmo(used);
  return {
    total: recovered,
    components: [
      { label: 'Fired this fight', value: used },
      { label: 'Not recoverable (half, rounded down)', value: recovered - used },
    ],
  };
}

/**
 * Ammunition tracker for the Combat tab (Stage A5d). Mirrors PWACharSheet's
 * AmmoTracker (collapsible Card, one tile per ammunition stack with a count and
 * buttons) but as a VIEW over the inventory: the stacks are the matching
 * ammunition items of the character's equipped Ammunition weapons
 * (logic/attacks.ts `matchingAmmunition`), and the quantity is the inventory
 * quantity. Deviations from the PWA: no add/remove/max editing (the Inventory
 * page owns the stacks), and "Recover half after the fight" replaces REFILL
 * (PHB 2024 "Ammunition" property). Pieces fired this fight are UI state.
 */
export function AmmoTracker({
  character,
  onChange,
  usedByItem,
  onUsedChange,
  defaultCollapsed = false,
}: AmmoTrackerProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [localUsed, setLocalUsed] = useState<Record<string, number>>({});
  const used = usedByItem ?? localUsed;
  const setUsed = onUsedChange ?? setLocalUsed;
  const [status, setStatus] = useState('');

  // Unique ammunition stacks across all equipped Ammunition weapons.
  const ammoWeapons = equippedWeapons(character).filter(({ weapon }) =>
    weapon.properties.includes('ammunition'),
  );
  const stacks: InventoryItem[] = [];
  for (const { weapon } of ammoWeapons) {
    for (const item of matchingAmmunition(character, weapon)) {
      if (!stacks.some((s) => s.id === item.id)) stacks.push(item);
    }
  }

  const setQuantity = (id: string, quantity: number) =>
    onChange({
      ...character,
      inventory: (character.inventory ?? []).map((item) => (item.id === id ? { ...item, quantity } : item)),
    });

  // Fire/Recover can disable the focused button; move focus to the stack name first.
  const focusStack = (el: HTMLElement) =>
    el.closest<HTMLElement>('[data-ammo-card]')?.querySelector<HTMLElement>('[data-ammo-name]')?.focus();
  const fire = (item: InventoryItem, el: HTMLElement) => {
    if (item.quantity <= 0) return;
    if (item.quantity - 1 <= 0) focusStack(el);
    setQuantity(item.id, item.quantity - 1);
    setUsed({ ...used, [item.id]: (used[item.id] ?? 0) + 1 });
    setStatus(`Fired one ${ammoName(item)}. ${item.quantity - 1} left.`);
  };

  const recover = (item: InventoryItem, el: HTMLElement) => {
    focusStack(el);
    const fired = used[item.id] ?? 0;
    const back = recoverAmmo(fired);
    if (back > 0) setQuantity(item.id, item.quantity + back);
    setUsed({ ...used, [item.id]: 0 });
    setStatus(`Recovered ${back} ${ammoName(item)}. ${item.quantity + back} on hand.`);
  };

  const tip = resolveWeaponPropertyTooltip('ammunition');

  // Nothing to track without an equipped Ammunition weapon: hide the card (the
  // Combat page shows only what applies to this character). With one but no
  // matching ammunition, the card stays and says so.
  if (ammoWeapons.length === 0) return null;

  return (
    <Card>
      <SectionHeader
        icon={Target}
        title="Ammunition"
        collapsible
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />
      {!collapsed && (
        <>
          <div role="status" aria-live="polite" className={styles.srOnly} data-testid="ammo-status">
            {status}
          </div>
          {stacks.length === 0 && (
            <EmptyState
              icon={Target}
              heading="No ammunition tracked"
              description="Equip a weapon with the Ammunition property and keep matching ammunition in your inventory."
              compact
            />
          )}
          <div className={styles.ammoGrid}>
            {stacks.map((item) => {
              const fired = used[item.id] ?? 0;
              const name = ammoName(item);
              const recovered = recoverAmmo(fired);
              return (
                <div key={item.id} className={styles.ammoCard} data-ammo-card data-testid={`ammo-${item.id}`}>
                  <div className={styles.ammoName} data-ammo-name tabIndex={-1}>{name}</div>
                  <div className={styles.ammoCount}>
                    <span className={item.quantity <= 3 ? styles.ammoCountLow : styles.ammoCountNormal}>
                      {item.quantity}
                    </span>
                    <span className={styles.label}>on hand</span>
                  </div>
                  <div className={styles.usedRow}>
                    <span className={styles.label}>Fired this fight</span>
                    <span data-testid={`ammo-used-${item.id}`}>{fired}</span>
                  </div>
                  <div className={styles.btnRow}>
                    <button
                      type="button"
                      className={styles.fireBtn}
                      disabled={item.quantity <= 0}
                      aria-label={`Fire one ${name}`}
                      onClick={(e) => fire(item, e.currentTarget)}
                    >
                      Fire
                    </button>
                    <button
                      type="button"
                      className={styles.recoverBtn}
                      disabled={fired === 0}
                      aria-label={`Recover half of the ${name} fired after the fight`}
                      onClick={(e) => recover(item, e.currentTarget)}
                    >
                      Recover half after the fight
                    </button>
                  </div>
                  {fired > 0 && (
                    <div className={styles.usedRow}>
                      <span className={styles.label}>Recovers</span>
                      <CalculatedValue
                        label={`${name} recovered`}
                        breakdown={recoveredBreakdown(fired)}
                        className={styles.valueBtn}
                      >
                        {recovered}
                      </CalculatedValue>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {tip && stacks.length > 0 && (
            <p className={styles.rule}>
              <ContentTooltip content={tip} className={styles.ruleTrigger}>
                Ammunition rule
              </ContentTooltip>
            </p>
          )}
        </>
      )}
    </Card>
  );
}
