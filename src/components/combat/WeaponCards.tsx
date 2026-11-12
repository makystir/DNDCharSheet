import { useState } from 'react';
import { Lock, Swords, Target } from 'lucide-react';
import type { Character } from '../../types/character';
import type { MasteryProperty } from '../../data/weapons';
import { proficiencyBonus } from '../../logic/abilities';
import { formatSigned } from '../../logic/breakdown';
import { exhaustionLevelOf, withExhaustion } from '../../logic/conditions';
import {
  equippedWeapons,
  fireAmmo,
  matchingAmmunition,
  weaponAttackProfile,
  type EquippedWeapon,
} from '../../logic/attacks';
import { getEquipment } from '../../data/equipment';
import { grazeDamage, itemMasteryStatus, toppleDc } from '../../logic/weapon-mastery';
import {
  resolveMasteryLockedTooltip,
  resolveWeaponMasteryTooltip,
  resolveWeaponPropertyChips,
} from '../../logic/tooltip-content';
import { useViewMode } from '../../hooks/useViewMode';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import { EmptyState } from '../shared/EmptyState';
import { ViewModeToggle } from '../shared/ViewModeToggle';
import { AttackRollControls } from './AttackRollControls';
import styles from './WeaponCards.module.css';

export interface WeaponCardsProps {
  character: Character;
  /** Needed to use ammunition when an Ammunition weapon's attack is rolled. */
  onChange?: (next: Character) => void;
  /** Told which ammunition stack lost a piece (feeds the Ammunition card's 'fired' count). */
  onAmmoFired?: (ammoItemId: string) => void;
}

const titleCase = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Damage as text: dice plus the signed flat part, e.g. "1d8+3". */
const damageText = (dice: string, flat: number) => `${dice}${formatSigned(flat)}`;

/**
 * Weapons panel for the Combat tab (Stage A5d). Ported from PWACharSheet's
 * WeaponCards: a Card with a ViewModeToggle (cards / compact list), and two-line
 * weapon cards. Line 1 is the full weapon name (never truncated); line 2 holds
 * the stats and the Attack button. Every number is a CalculatedValue whose
 * Breakdown comes from logic/attacks.ts and logic/weapon-mastery.ts. No rule is
 * computed here.
 *
 * Deviations from the PWA: the weapons are the character's EQUIPPED inventory
 * weapons (equipped.weaponItemIds), so there are no add/edit/delete buttons (the
 * Inventory page owns equipping), no rune manager, and no drag reorder. The
 * mobile long-press context menu is phased.
 */
export function WeaponCards({ character, onChange, onAmmoFired }: WeaponCardsProps) {
  const { mode: viewMode, setMode: setViewMode } = useViewMode('viewmode-weapons', 'cards');
  // Per-item "wielded two-handed" choice for Versatile weapons (UI state only).
  const [twoHanded, setTwoHanded] = useState<Record<string, boolean>>({});
  const weapons = equippedWeapons(character);
  const pb = proficiencyBonus(character.level);
  const unresolved = (character.equipped?.weaponItemIds ?? []).length - weapons.length;

  const renderMastery = (entry: EquippedWeapon, abilityMod: number) => {
    const status = itemMasteryStatus(character, entry.item);
    const mastery: MasteryProperty = entry.weapon.mastery;
    const name = titleCase(mastery);
    if (!status.usable) {
      const tip = resolveMasteryLockedTooltip(status.reason ?? 'not-chosen');
      const chip = (
        <span className={styles.lockedChip}>
          <Lock size={12} aria-hidden="true" />
          {name} (locked)
        </span>
      );
      return tip ? (
        <ContentTooltip content={tip} className={styles.chipTrigger}>
          {chip}
        </ContentTooltip>
      ) : (
        chip
      );
    }
    const tip = resolveWeaponMasteryTooltip(mastery);
    const chip = <span className={styles.masteryChip}>{name} (mastery)</span>;
    return (
      <>
        {tip ? (
          <ContentTooltip content={tip} className={styles.chipTrigger}>
            {chip}
          </ContentTooltip>
        ) : (
          chip
        )}
        {mastery === 'graze' && (
          <span className={styles.stat}>
            <span className={styles.statLabel}>Graze</span>
            <CalculatedValue
              label={`${entry.weapon.name} Graze damage`}
              breakdown={grazeDamage(abilityMod)}
              className={styles.valueBtn}
            />
          </span>
        )}
        {mastery === 'topple' && (
          <span className={styles.stat}>
            <span className={styles.statLabel}>Topple DC</span>
            <CalculatedValue
              label={`${entry.weapon.name} Topple DC`}
              breakdown={toppleDc(abilityMod, pb)}
              className={styles.valueBtn}
            />
          </span>
        )}
      </>
    );
  };

  const renderCard = (entry: EquippedWeapon) => {
    const { item, weapon } = entry;
    const canTwoHand = weapon.properties.includes('versatile') && weapon.versatileDice !== undefined;
    const isTwoHanded = canTwoHand && twoHanded[item.id] === true;
    const profile = weaponAttackProfile(character, item, { twoHanded: isTwoHanded });
    if (!profile) return null;
    const { damage } = profile;
    // Static attack bonus is a D20 Test total: show the Exhaustion penalty (PHB 2024 L21024).
    const attackBreakdown = withExhaustion(profile.attack.breakdown, exhaustionLevelOf(character));
    const chips = resolveWeaponPropertyChips(weapon);

    // Ammunition weapons use one piece per attack (PHB 2024 "Ammunition", L9304).
    const usesAmmo = weapon.properties.includes('ammunition');
    const ammoStacks = usesAmmo ? matchingAmmunition(character, weapon) : [];
    const ammoLeft = ammoStacks.reduce((sum, s) => sum + Math.max(0, s.quantity), 0);
    const ammoName =
      ammoStacks[0]?.name ??
      (ammoStacks[0]?.catalogId ? getEquipment(ammoStacks[0].catalogId)?.name : undefined) ??
      weapon.ammunitionType ??
      'ammunition';
    const ammoLine = usesAmmo && (
      <span className={styles.stat} data-testid={`weapon-ammo-${item.id}`}>
        <Target size={14} aria-hidden="true" />
        <span className={styles.statLabel}>Ammo</span>
        {ammoStacks.length === 0 ? `No ${weapon.ammunitionType ?? 'ammunition'} in inventory` : `${ammoLeft} ${ammoName}`}
      </span>
    );
    const attackButton = (
      <AttackRollControls
        character={character}
        name={weapon.name}
        attackModifiers={profile.attack.breakdown.components}
        damage={damage}
        blockedReason={usesAmmo && ammoLeft === 0 ? `No ${weapon.ammunitionType ?? 'ammunition'} left. Add more on the Inventory page.` : null}
        onAttackRolled={() => {
          if (!usesAmmo) return;
          const fired = fireAmmo(character, weapon);
          if (fired.consumed) {
            onChange?.(fired.character);
            if (fired.ammoItemId) onAmmoFired?.(fired.ammoItemId);
          }
        }}
      />
    );

    const stats = (
      <>
        <span className={styles.stat}>
          <span className={styles.statLabel}>Attack</span>
          <CalculatedValue
            label={`${weapon.name} attack bonus`}
            breakdown={attackBreakdown}
            className={styles.valueBtn}
          >
            {formatSigned(attackBreakdown.total)}
          </CalculatedValue>
        </span>
        <span className={styles.stat}>
          <span className={styles.statLabel}>Damage</span>
          <CalculatedValue
            label={`${weapon.name} damage`}
            breakdown={damage.breakdown}
            className={styles.valueBtn}
          >
            {damageText(damage.dice, damage.flat)} {damage.damageType}
          </CalculatedValue>
        </span>
        {ammoLine}
        {canTwoHand && (
          <label className={styles.versatile}>
            <input
              type="checkbox"
              checked={isTwoHanded}
              aria-label={`${weapon.name} wielded two-handed`}
              onChange={(e) => setTwoHanded((prev) => ({ ...prev, [item.id]: e.target.checked }))}
            />
            Two-handed ({weapon.versatileDice})
          </label>
        )}
      </>
    );

    const proficiencyNote = !profile.proficiency.proficient && (
      <span className={styles.note}>Not proficient: {profile.proficiency.reason}</span>
    );

    if (viewMode === 'list') {
      return (
        <li key={item.id} className={styles.listRow} data-testid={`weapon-list-row-${item.id}`}>
          <span className={styles.name}>{weapon.name}</span>
          <div className={styles.statsLine}>
            {stats}
            {renderMastery(entry, profile.attack.abilityMod)}
            {attackButton}
          </div>
          {proficiencyNote}
        </li>
      );
    }

    return (
      <li key={item.id} className={styles.weaponCard} data-testid={`weapon-card-${item.id}`}>
        {/* Line 1: the full weapon name, never truncated. */}
        <div className={styles.name}>{weapon.name}</div>
        {/* Line 2: stats and the Attack button. */}
        <div className={styles.statsLine}>
          {stats}
          {attackButton}
        </div>
        <div className={styles.chipLine}>
          {chips.map((chip) =>
            chip.tooltip ? (
              <ContentTooltip key={chip.label} content={chip.tooltip} className={styles.chipTrigger}>
                <span className={styles.chip}>{chip.label}</span>
              </ContentTooltip>
            ) : (
              <span key={chip.label} className={styles.chip}>
                {chip.label}
              </span>
            ),
          )}
          {renderMastery(entry, profile.attack.abilityMod)}
        </div>
        {proficiencyNote}
      </li>
    );
  };

  return (
    <Card>
      <SectionHeader
        icon={Swords}
        title="Weapons"
        action={
          weapons.length > 0 ? (
            <ViewModeToggle mode={viewMode} onChange={setViewMode} label="Weapons view" />
          ) : undefined
        }
      />
      {weapons.length === 0 && (
        <EmptyState
          icon={Swords}
          heading="No weapons equipped"
          description="Equip a weapon on the Inventory page to see its attack and damage here."
          compact
        />
      )}
      {weapons.length > 0 && (
        <p className={styles.manageHint}>
          Add, remove, or equip weapons on the{' '}
          <a className={styles.manageLink} href="#inventory">
            Inventory page
          </a>
          .
        </p>
      )}
      {weapons.length > 0 && (
        <ul
          className={viewMode === 'list' ? styles.list : styles.cardGrid}
          aria-label="Equipped weapons"
        >
          {weapons.map(renderCard)}
        </ul>
      )}
      {unresolved > 0 && (
        <p className={styles.note}>
          {unresolved} equipped item{unresolved === 1 ? '' : 's'} could not be shown because{' '}
          {unresolved === 1 ? 'it is' : 'they are'} not a catalog weapon.
        </p>
      )}
    </Card>
  );
}
