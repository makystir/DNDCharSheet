import { useState } from 'react';
import { Coins, Scale, Shield as ShieldIcon, Sword, Package } from 'lucide-react';
import type { Character, InventoryItem } from '../../types/character';
import type { CurrencyAmount, CurrencyDelta } from '../../logic/currency';
import { applyCurrencyDelta, ZERO_CURRENCY } from '../../logic/currency';
import {
  carriedWeightBreakdown,
  carryingCapacityBreakdown,
  characterCoins,
  formatEncumbrance,
  getEncumbranceLevel,
} from '../../logic/encumbrance';
import { resolveWeapon } from '../../logic/weapons';
import { effectiveAbilityScores } from '../../logic/feats';
import {
  resolveWeaponTooltip,
  resolveWeaponPropertyChips,
  resolveArmorTooltip,
  resolveItemTooltip,
} from '../../logic/tooltip-content';
import { WEAPON_LIST, getWeapon, type WeaponData } from '../../data/weapons';
import { ARMOR_LIST, getArmor } from '../../data/armor';
import { EQUIPMENT_LIST, getEquipment, type EquipmentData } from '../../data/equipment';
import { newCharacterId } from '../../storage/character-store';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import { EditableField } from '../shared/EditableField';
import { AddButton } from '../shared/AddButton';
import { ProgressBar } from '../shared/ProgressBar';
import { ViewModeToggle } from '../shared/ViewModeToggle';
import { useViewMode } from '../../hooks/useViewMode';
import { Picker } from '../shared/Picker';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import { ConsumablesPanel } from '../shared/ConsumablesPanel';
import { CurrencyInput } from '../shared/CurrencyInput';
import { CoinWeightValue } from '../shared/CoinWeightValue';
import styles from './InventoryPage.module.css';

export interface InventoryPageProps {
  character: Character;
  onChange: (next: Character) => void;
}

const COIN_FIELDS: { key: keyof CurrencyAmount; label: string }[] = [
  { key: 'pp', label: 'Platinum (PP)' },
  { key: 'gp', label: 'Gold (GP)' },
  { key: 'ep', label: 'Electrum (EP)' },
  { key: 'sp', label: 'Silver (SP)' },
  { key: 'cp', label: 'Copper (CP)' },
];

/** Display name for an inventory item (instance override, else catalog, else fallback). */
function itemName(item: InventoryItem): string {
  if (item.name) return item.name;
  if (item.kind === 'weapon' && item.catalogId) return getWeapon(item.catalogId)?.name ?? 'Weapon';
  if (item.kind === 'armor' && item.catalogId) return getArmor(item.catalogId)?.name ?? 'Armor';
  if (item.kind === 'equipment' && item.catalogId)
    return getEquipment(item.catalogId)?.name ?? 'Item';
  return 'Custom item';
}

/** Static damage string for a resolved weapon (no attack rolling — A5). */
function weaponDamage(w: WeaponData): string {
  return w.properties.includes('versatile') && w.versatileDice
    ? `${w.damageDice} ${w.damageType} (${w.versatileDice})`
    : `${w.damageDice} ${w.damageType}`;
}

/**
 * The Inventory tab (Stage A3).
 *
 * DELIBERATE ui-parity deviation (blueprint decision 7.6): PWACharSheet renders
 * Gear as a SUB-tab of Character. The D&D app surfaces Inventory as a TOP-LEVEL
 * tab, because navigation was built to anticipate it (navItems comment) and AC
 * lives on the Combat tab, so an Inventory top tab sits naturally beside it.
 * Inside the tab, GearTab's section ORDER and card/grid PRESENTATION are
 * mirrored (encumbrance bar → weapons → armor → other gear → consumables →
 * coins + encumbrance breakdown). The WFRP TransferControl/Treasury column and
 * the WFRP ArmourMap/hit-location section are dropped (no D&D analogue).
 *
 * Phased (blueprint decision 7.7): drag-reorder and the mobile long-press
 * ContextualMenu are NOT built this stage; the cards/list ViewModeToggle,
 * AddButton, ConsumablesPanel, and Picker ARE shipped. Weapon cards show STATIC
 * stats only (attack/damage rolling is A5).
 */
export function InventoryPage({ character, onChange }: InventoryPageProps) {
  const { mode: gearView, setMode: setGearView } = useViewMode('viewmode-inventory-gear', 'cards');
  const [showWeaponPicker, setShowWeaponPicker] = useState(false);
  const [showArmorPicker, setShowArmorPicker] = useState(false);
  const [showGearPicker, setShowGearPicker] = useState(false);
  // The id of the custom (catalog-less) item currently open for editing, so its
  // name/weight/notes can be set (finding #2). Null = no item open.
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const inventory = character.inventory ?? [];
  const equipped = character.equipped ?? {};
  const weapons = inventory.filter((i) => i.kind === 'weapon');
  const armors = inventory.filter((i) => i.kind === 'armor');
  // Other gear excludes dose-tracked consumables (those live in ConsumablesPanel).
  const gear = inventory.filter((i) => i.kind === 'equipment' && i.maxDoses === undefined);

  const coins = characterCoins(character);

  // ── Derived totals (calculated-totals) ──
  const capacityBd = carryingCapacityBreakdown(character);
  const carriedBd = carriedWeightBreakdown(character);
  const encLevel = getEncumbranceLevel(
    carriedBd.total,
    capacityBd.total,
    effectiveAbilityScores(character).str,
    character.houseRules?.variantEncumbrance,
  );

  // ── Inventory mutation helpers ──
  const setInventory = (next: InventoryItem[]) => onChange({ ...character, inventory: next });

  const addItem = (item: InventoryItem) => setInventory([...inventory, item]);

  const removeItem = (id: string) => {
    const nextEquipped = { ...equipped };
    if (nextEquipped.armorItemId === id) delete nextEquipped.armorItemId;
    if (nextEquipped.shieldItemId === id) delete nextEquipped.shieldItemId;
    if (nextEquipped.weaponItemIds?.includes(id)) {
      nextEquipped.weaponItemIds = nextEquipped.weaponItemIds.filter((w) => w !== id);
    }
    onChange({
      ...character,
      inventory: inventory.filter((i) => i.id !== id),
      equipped: nextEquipped,
    });
  };

  const setQuantity = (id: string, qty: number) =>
    setInventory(inventory.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, qty) } : i)));

  // ── Equip toggles ──
  const toggleWeaponEquipped = (id: string) => {
    const current = equipped.weaponItemIds ?? [];
    const next = current.includes(id) ? current.filter((w) => w !== id) : [...current, id];
    onChange({ ...character, equipped: { ...equipped, weaponItemIds: next } });
  };

  // PHB 2024 "Armor: One at a Time" — a single worn suit. Equipping one armor
  // replaces any other; toggling the equipped one unequips it.
  const toggleArmorEquipped = (id: string) =>
    onChange({
      ...character,
      equipped: { ...equipped, armorItemId: equipped.armorItemId === id ? undefined : id },
    });

  // PHB 2024 "Armor: One at a Time" — a single wielded Shield.
  const toggleShieldEquipped = (id: string) =>
    onChange({
      ...character,
      equipped: { ...equipped, shieldItemId: equipped.shieldItemId === id ? undefined : id },
    });

  // ── Coin editing ──
  const setCoin = (key: keyof CurrencyAmount, value: number) =>
    onChange({ ...character, coins: { ...(character.coins ?? ZERO_CURRENCY), [key]: Math.max(0, value) } });

  const applyCoinDelta = (delta: CurrencyDelta) =>
    onChange({ ...character, coins: applyCurrencyDelta(character.coins ?? ZERO_CURRENCY, delta) });

  // ── Catalog add handlers ──
  const addWeaponFromCatalog = (w: WeaponData) =>
    addItem({ id: newCharacterId(), kind: 'weapon', catalogId: w.id, quantity: 1 });
  const addArmorFromCatalog = (a: (typeof ARMOR_LIST)[number]) =>
    addItem({ id: newCharacterId(), kind: 'armor', catalogId: a.id, quantity: 1 });
  const addGearFromCatalog = (e: EquipmentData) =>
    addItem({ id: newCharacterId(), kind: 'equipment', catalogId: e.id, quantity: 1 });

  // ── Custom item field editing (finding #2) ──
  // Update one supported field on a custom item instance.
  const setItemField = <K extends keyof InventoryItem>(
    id: string,
    key: K,
    value: InventoryItem[K],
  ) => setInventory(inventory.map((i) => (i.id === id ? { ...i, [key]: value } : i)));

  // Add a blank custom item (name empty so the edit form is required), then open
  // it for editing immediately — mirroring GearTab's "Add Custom" → inline edit.
  const addCustom = (kind: InventoryItem['kind']) => {
    const id = newCharacterId();
    addItem({ id, kind, name: '', quantity: 1 });
    setEditingItemId(id);
  };

  /** A custom item is one with no catalog entry (editable name/weight/notes). */
  const isCustom = (item: InventoryItem) => item.catalogId === undefined;

  /**
   * Inline edit form for a custom item (finding #2): name, weight (lb), and
   * notes. Ported from GearTab's inline custom-trapping editor. Persists onto
   * the supported InventoryItem fields (name/weightLb/notes) so encumbrance can
   * read the weight. The weight unit label differs for custom armour vs other
   * kinds only in copy.
   */
  const renderCustomEditForm = (item: InventoryItem) => (
    <div className={styles.customEditForm}>
      <input
        type="text"
        className={styles.customEditInput}
        placeholder="Name"
        value={item.name ?? ''}
        onChange={(e) => setItemField(item.id, 'name', e.target.value)}
        aria-label="Custom item name"
      />
      <div className={styles.customEditRow}>
        <label className={styles.customEditLabel}>
          Weight (lb)
          <input
            type="number"
            className={styles.customEditNumber}
            min={0}
            step="0.1"
            value={item.weightLb ?? ''}
            placeholder="0"
            onChange={(e) =>
              setItemField(
                item.id,
                'weightLb',
                e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0),
              )
            }
            aria-label="Custom item weight in pounds"
          />
        </label>
      </div>
      <input
        type="text"
        className={styles.customEditInput}
        placeholder="Notes"
        value={item.notes ?? ''}
        onChange={(e) =>
          setItemField(item.id, 'notes', e.target.value === '' ? undefined : e.target.value)
        }
        aria-label="Custom item notes"
      />
      <button
        type="button"
        className={styles.customEditDoneBtn}
        onClick={() => setEditingItemId(null)}
      >
        Done
      </button>
    </div>
  );

  return (
    <div className={styles.page}>
      {/* ── Encumbrance summary ──
          GearTab renders the top-of-tab ProgressBar bare (not inside a Card),
          so to keep card-parity this block is NOT wrapped in a Card (finding
          #5). The SectionHeader + Carried/Capacity totals line are a deliberate
          D&D addition the review accepted; only the Card nesting was the defect. */}
      <div className={styles.encSummary}>
        <SectionHeader icon={Scale} title="Encumbrance" />
        <ProgressBar
          current={carriedBd.total}
          max={capacityBd.total}
          level={encLevel}
          label={formatEncumbrance(carriedBd.total, capacityBd.total)}
          ariaLabel="Encumbrance progress"
        />
        <div className={styles.encTotalLine}>
          <span className={styles.fieldLabel}>Carried</span>
          <CalculatedValue label="Carried weight" breakdown={carriedBd}>
            {carriedBd.total} lb
          </CalculatedValue>
          <span className={styles.fieldLabel}>Capacity</span>
          <CalculatedValue label="Carrying capacity" breakdown={capacityBd}>
            {capacityBd.total} lb
          </CalculatedValue>
        </div>
      </div>

      {/* ── Weapons (two-line cards, static stats) ── */}
      <Card>
        <SectionHeader
          icon={Sword}
          title="Weapons"
          action={
            <div className={styles.actionRow}>
              <AddButton label="Add Weapon" onClick={() => setShowWeaponPicker(true)} />
              <AddButton label="Add Custom Weapon" onClick={() => addCustom('weapon')} />
            </div>
          }
        />
        {weapons.length === 0 ? (
          <EmptyState
            icon={Sword}
            heading="No weapons"
            description="Add a weapon from the catalog or create a custom one."
            compact
          />
        ) : (
          <div className={styles.weaponList}>
            {weapons.map((item) => {
              const resolved = resolveWeapon(item);
              const tip = resolveWeaponTooltip(item);
              const isEquipped = equipped.weaponItemIds?.includes(item.id) ?? false;
              if (isCustom(item) && editingItemId === item.id) {
                return (
                  <div key={item.id} className={styles.weaponCard}>
                    {renderCustomEditForm(item)}
                  </div>
                );
              }
              return (
                <div key={item.id} className={styles.weaponCard}>
                  <div className={styles.weaponNameRow}>
                    {tip ? (
                      <ContentTooltip content={tip} className={styles.weaponName}>
                        {itemName(item)}
                      </ContentTooltip>
                    ) : (
                      <span className={styles.weaponName}>{itemName(item)}</span>
                    )}
                  </div>
                  <div className={styles.weaponStatsRow}>
                    <span className={styles.statChip}>
                      {resolved ? weaponDamage(resolved) : 'Custom'}
                    </span>
                    {resolved &&
                      resolveWeaponPropertyChips(resolved).map((chip) =>
                        chip.tooltip ? (
                          <ContentTooltip
                            key={chip.label}
                            content={chip.tooltip}
                            className={styles.propChip}
                          >
                            {chip.label}
                          </ContentTooltip>
                        ) : (
                          <span key={chip.label} className={styles.propChip}>
                            {chip.label}
                          </span>
                        ),
                      )}
                    <label className={styles.equipToggle}>
                      <input
                        type="checkbox"
                        checked={isEquipped}
                        onChange={() => toggleWeaponEquipped(item.id)}
                        aria-label={`Equip ${itemName(item)}`}
                      />
                      <span>Equipped</span>
                    </label>
                    {isCustom(item) && (
                      <button
                        type="button"
                        className={styles.editBtn}
                        onClick={() => setEditingItemId(item.id)}
                        aria-label={`Edit ${itemName(item)}`}
                      >
                        ✎
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${itemName(item)}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Armor & Shields (single-select suit + single shield) ── */}
      <Card>
        <SectionHeader
          icon={ShieldIcon}
          title="Armor & Shields"
          action={
            <div className={styles.actionRow}>
              <AddButton label="Add Armor" onClick={() => setShowArmorPicker(true)} />
              <AddButton label="Add Custom Armor" onClick={() => addCustom('armor')} />
            </div>
          }
        />
        {armors.length === 0 ? (
          <EmptyState
            icon={ShieldIcon}
            heading="No armor"
            description="Add armor or a shield from the catalog. Equipping drives your Armor Class."
            compact
          />
        ) : (
          <div className={styles.armorList}>
            {armors.map((item) => {
              const data = item.catalogId ? getArmor(item.catalogId) : undefined;
              const tip = resolveArmorTooltip(item);
              const isShield = data?.category === 'shield';
              const isEquipped = isShield
                ? equipped.shieldItemId === item.id
                : equipped.armorItemId === item.id;
              const toggle = isShield
                ? () => toggleShieldEquipped(item.id)
                : () => toggleArmorEquipped(item.id);
              if (isCustom(item) && editingItemId === item.id) {
                return (
                  <div key={item.id} className={styles.armorRow}>
                    {renderCustomEditForm(item)}
                  </div>
                );
              }
              return (
                <div key={item.id} className={styles.armorRow}>
                  {tip ? (
                    <ContentTooltip content={tip} className={styles.armorName}>
                      {itemName(item)}
                    </ContentTooltip>
                  ) : (
                    <span className={styles.armorName}>{itemName(item)}</span>
                  )}
                  <span className={styles.armorMeta}>
                    {data
                      ? isShield
                        ? `+${data.baseAc} AC`
                        : `AC ${data.baseAc}${data.addsDex ? (data.dexCap !== undefined ? ` + Dex (max +${data.dexCap})` : ' + Dex') : ''}`
                      : 'Custom'}
                  </span>
                  <label className={styles.equipToggle}>
                    <input
                      type="checkbox"
                      checked={isEquipped}
                      onChange={toggle}
                      aria-label={`Wear ${itemName(item)}`}
                    />
                    <span>Worn</span>
                  </label>
                  {isCustom(item) && (
                    <button
                      type="button"
                      className={styles.editBtn}
                      onClick={() => setEditingItemId(item.id)}
                      aria-label={`Edit ${itemName(item)}`}
                    >
                      ✎
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove ${itemName(item)}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Other gear (cards/list toggle, qty, add) ── */}
      <Card>
        <SectionHeader
          icon={Package}
          title="Other Gear"
          action={
            <div className={styles.actionRow}>
              {gear.length > 0 && (
                <ViewModeToggle mode={gearView} onChange={setGearView} label="Gear view" />
              )}
              <AddButton label="Add Gear" onClick={() => setShowGearPicker(true)} />
              <AddButton label="Add Custom Gear" onClick={() => addCustom('equipment')} />
            </div>
          }
        />
        {gear.length === 0 ? (
          <EmptyState icon={Package} heading="No gear yet" compact />
        ) : (
          <div className={gearView === 'list' ? styles.gearList : styles.gearGrid}>
            {gear.map((item) => {
              const tip = resolveItemTooltip(item);
              if (isCustom(item) && editingItemId === item.id) {
                return (
                  <div
                    key={item.id}
                    className={gearView === 'list' ? styles.gearRow : styles.gearCard}
                  >
                    {renderCustomEditForm(item)}
                  </div>
                );
              }
              return (
                <div
                  key={item.id}
                  className={gearView === 'list' ? styles.gearRow : styles.gearCard}
                >
                  {tip ? (
                    <ContentTooltip content={tip} className={styles.gearName}>
                      {itemName(item)}
                    </ContentTooltip>
                  ) : (
                    <span className={styles.gearName}>{itemName(item)}</span>
                  )}
                  <div className={styles.gearControls}>
                    <input
                      type="number"
                      className={styles.qtyInput}
                      min={1}
                      value={item.quantity}
                      onChange={(e) => setQuantity(item.id, Number(e.target.value) || 1)}
                      aria-label={`Quantity of ${itemName(item)}`}
                    />
                    {isCustom(item) && (
                      <button
                        type="button"
                        className={styles.editBtn}
                        onClick={() => setEditingItemId(item.id)}
                        aria-label={`Edit ${itemName(item)}`}
                      >
                        ✎
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${itemName(item)}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Consumables ──
          ConsumablesPanel owns its own Card (ported verbatim from GearTab's
          direct <ConsumablesPanel/> usage), so it is rendered directly here —
          NOT nested inside a second Card (finding #5: no card-in-card). */}
      <ConsumablesPanel character={character} onChange={onChange} />

      {/* ── Coin Purse + Encumbrance breakdown (two-column) ── */}
      <Card>
        <div className={styles.wealthGrid}>
          <div>
            <SectionHeader icon={Coins} title="Coin Purse" />
            <div className={styles.coinGroup}>
              {COIN_FIELDS.map((c) => (
                <EditableField
                  key={c.key}
                  label={c.label}
                  value={coins[c.key]}
                  type="number"
                  mode="always-editable"
                  onSave={(v) => setCoin(c.key, Number(v) || 0)}
                />
              ))}
            </div>
            <div className={styles.coinGroup}>
              <div className={styles.coinGroupLabel}>Quick Adjust</div>
              <CurrencyInput onSubmit={applyCoinDelta} />
            </div>
          </div>
          <div>
            <SectionHeader icon={Scale} title="Weight by Category" />
            <div className={styles.encBreakdown}>
              {/* P7: a per-category DRILLDOWN of carried weight (Weapons / Armor
                  / Other gear / Coins). The encumbrance TOTAL and capacity live
                  once in the top progress bar, so this section is purely the
                  category breakdown and no longer repeats the Total / Capacity
                  summary. The Coins row's weight opens the per-denomination
                  coin-weight tooltip (finding #1). */}
              {carriedBd.components.map((c) =>
                c.label === 'Coins' ? (
                  <div key={c.label} className={styles.encRow}>
                    <span className={styles.encLabel}>Coins</span>
                    <CoinWeightValue coins={coins}>{c.value} lb</CoinWeightValue>
                  </div>
                ) : (
                  <div key={c.label} className={styles.encRow}>
                    <span className={styles.encLabel}>{c.label}</span>
                    <span>{c.value} lb</span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Pickers ── */}
      {showWeaponPicker && (
        <Picker
          title="Add Weapon"
          items={WEAPON_LIST}
          getLabel={(w) => w.name}
          getGroup={(w) => `${w.category === 'simple' ? 'Simple' : 'Martial'} ${w.range === 'melee' ? 'Melee' : 'Ranged'}`}
          onSelect={(w) => {
            addWeaponFromCatalog(w);
            setShowWeaponPicker(false);
          }}
          onClose={() => setShowWeaponPicker(false)}
        />
      )}
      {showArmorPicker && (
        <Picker
          title="Add Armor"
          items={ARMOR_LIST}
          getLabel={(a) => a.name}
          getGroup={(a) => a.category.charAt(0).toUpperCase() + a.category.slice(1)}
          onSelect={(a) => {
            addArmorFromCatalog(a);
            setShowArmorPicker(false);
          }}
          onClose={() => setShowArmorPicker(false)}
        />
      )}
      {showGearPicker && (
        <Picker
          title="Add Gear"
          items={EQUIPMENT_LIST}
          getLabel={(e) => e.name}
          getGroup={(e) => e.kind.charAt(0).toUpperCase() + e.kind.slice(1)}
          onSelect={(e) => {
            addGearFromCatalog(e);
            setShowGearPicker(false);
          }}
          onClose={() => setShowGearPicker(false)}
        />
      )}
    </div>
  );
}
