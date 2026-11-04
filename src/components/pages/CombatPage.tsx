import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Character } from '../../types/character';
import { formatSigned } from '../../logic/breakdown';
import { armorClassBreakdown, unarmoredDefenseFor } from '../../logic/armor-class';
import { getArmor } from '../../data/armor';
import { hitPointMaxBreakdown } from '../../logic/hit-points';
import { resolveSpecies } from '../../logic/species';
import { resolveClass, hitDiceTotal } from '../../logic/classes';
import { initiativeBreakdown } from '../../logic/initiative';
import { passivePerceptionBreakdown } from '../../logic/passive-checks';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { CalculatedValue } from '../shared/CalculatedValue';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { SegmentedControl } from '../shared/SegmentedControl';
import { ActiveConditions } from '../combat/ActiveConditions';
import { HitPointsCard } from '../combat/HitPointsCard';
import { TakeDamagePanel } from '../combat/TakeDamagePanel';
import { DeathSavesCard } from '../combat/DeathSavesCard';
import { ConcentrationCard } from '../combat/ConcentrationCard';
import { InitiativeTracker } from '../combat/InitiativeTracker';
import { TurnPanel } from '../combat/TurnPanel';
import { WeaponCards } from '../combat/WeaponCards';
import { UnarmedStrikeCard } from '../combat/UnarmedStrikeCard';
import { AmmoTracker } from '../combat/AmmoTracker';
import { AttackFlow } from '../combat/AttackFlow';
import { WeaponMasteryChooser } from '../combat/WeaponMasteryChooser';
import { RestControls } from '../combat/RestControls';
import { DefenseReadout } from '../combat/DefenseReadout';
import { SpellSlotSummary } from '../combat/SpellSlotSummary';
import { HouseRuleIndicator } from '../combat/HouseRuleIndicator';
import { CombatCompactBar } from '../combat/CombatCompactBar';
import { Swords } from 'lucide-react';
import { DEFAULT_ATTACK_TARGET, type AttackTarget } from '../../logic/attack-flow';
import { parseNumberInput } from './sheet-helpers';
import styles from './CombatPage.module.css';

export interface CombatPageProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Optional app-level Toast sink (Concentration and rest results, Stage A5b). */
  onNotify?: (message: string) => void;
  /**
   * Stage A5d: called with an equipped weapon's inventory item id (or
   * `UNARMED_ATTACK_ID` for an Unarmed Strike) when its Attack button is pressed.
   * The Attack Flow dialog hooks in here; the buttons are disabled without it.
   */
  onAttack?: (weaponItemId: string) => void;
}

/** The three combat modes of the segmented control (blueprint 5.3 / D10). */
type CombatMode = 'attack' | 'defend' | 'status';

const MODE_OPTIONS = [
  { value: 'attack' as const, label: 'Attack' },
  { value: 'defend' as const, label: 'Defend' },
  { value: 'status' as const, label: 'Status' },
];

const MODE_ID_BASE = 'combat-mode';

/**
 * The Combat tab (Stage A5e: layout assembly).
 *
 * Mirrors PWACharSheet's CombatPage (blueprint 5.3 / user decision D10): while
 * `combat.inCombat` is true, an Attack / Defend / Status segmented control
 * (`role="tablist"`, sticky) groups the panels into three tabpanels; out of
 * combat the page is a flat, ordered stack of the existing collapsible panels.
 * The Initiative tracker (which starts combat) and the Turn panel stay reachable
 * at the top in both states.
 *
 * Panel → mode mapping (blueprint 5.3):
 *  - Attack: Weapon cards, Attack Flow trigger, Unarmed Strike, Ammunition,
 *    Weapon Mastery chooser.
 *  - Defend: HP card (damage/heal/temp HP via TakeDamagePanel), Armor Class +
 *    Speed + movement (DefenseReadout), Dodge / Opportunity notes.
 *  - Status: Active Conditions (incl. Exhaustion), Death Saves, Concentration,
 *    Rests, read-only Spell-slot summary, Core Stats and Hit Dice.
 *
 * No rule is computed in this component: AC, Speed, HP, initiative, passive
 * perception and the slot counts all come from the logic layer. The AC display
 * passes the class-derived Unarmored Defense (`unarmoredDefenseFor`) so a
 * Barbarian with no armour shows the Con-based AC and a Monk loses it with a
 * Shield.
 */
export function CombatPage({ character, onChange, onNotify, onAttack }: CombatPageProps) {
  // Stage A5d: Ammunition fired this fight, by inventory item id (UI state). Lives
  // here so the Attack Flow can record shots too.
  const [ammoUsed, setAmmoUsed] = useState<Record<string, number>>({});
  // Stage A5d: the Attack Flow (open weapon id) and the last-used ad-hoc target, kept here so
  // the target Armor Class and cover survive closing and reopening the flow.
  const [attackWeaponId, setAttackWeaponId] = useState<string | null>(null);
  const [attackTarget, setAttackTarget] = useState<AttackTarget>(DEFAULT_ATTACK_TARGET);
  const openAttack = (weaponItemId: string) => {
    onAttack?.(weaponItemId);
    setAttackWeaponId(weaponItemId);
  };
  // Stage A5c: the turn banner asks the Death Saves card to open its roll prompt.
  const [deathSaveRequest, setDeathSaveRequest] = useState(0);
  // Stage A5e: the active segmented-control mode (only meaningful while in combat).
  const [mode, setMode] = useState<CombatMode>('attack');

  const isCompact = useMediaQuery('(max-width: 1024px)');
  const inCombat = character.combat?.inCombat ?? false;

  const setAcOverride = (raw: string) =>
    onChange({ ...character, acOverride: parseNumberInput(raw, true) });

  const setHpMax = (raw: string) =>
    onChange({ ...character, hpMax: parseNumberInput(raw, true) });

  const setInitiativeBonus = (raw: string) =>
    onChange({ ...character, initiativeBonus: parseNumberInput(raw, false) });

  const setHitDiceSpent = (raw: string, total: number) => {
    const parsed = parseNumberInput(raw, true);
    const clamped = parsed === undefined ? undefined : Math.min(parsed, total);
    onChange({ ...character, hitDiceSpent: clamped });
  };

  const setRolledHpTotal = (raw: string) =>
    onChange({ ...character, rolledHpTotal: parseNumberInput(raw, true) });

  // Toggles the rolled-HP house rule; leaves rolledHpTotal untouched so a
  // previously-entered total is preserved if the rule is re-enabled.
  const setRolledHpRule = (on: boolean) =>
    onChange({
      ...character,
      houseRules: { ...character.houseRules, rolledHp: on },
    });

  const selectedSpecies = resolveSpecies(character);
  const hpPerLevel = selectedSpecies?.traits.find((t) => t.mechanics?.hpPerLevel)
    ?.mechanics?.hpPerLevel;

  // Resolve the equipped armor/shield (A1 equipped state → inventory item →
  // ArmorData catalog) so the EXISTING AC display reflects worn armour. A
  // custom armor with no catalogId has no catalog stats, so it does not change
  // the computed AC (unarmored); that is surfaced as no armor contribution.
  const inventory = character.inventory ?? [];
  const equipped = character.equipped;
  const resolveEquippedArmor = (id: string | undefined) => {
    if (!id) return undefined;
    const item = inventory.find((i) => i.id === id);
    return item?.catalogId ? getArmor(item.catalogId) : undefined;
  };
  const equippedArmor = resolveEquippedArmor(equipped?.armorItemId);
  const equippedShield = resolveEquippedArmor(equipped?.shieldItemId);

  // A worn armour item whose catalog lookup fails (a custom, catalog-less suit)
  // cannot set a base AC — surface its name so the AC breakdown explains why the
  // ticked "Worn" box left AC unchanged (finding #3). Only names a worn item
  // that actually resolved to no ArmorData.
  const wornArmorItem = equipped?.armorItemId
    ? inventory.find((i) => i.id === equipped.armorItemId)
    : undefined;
  const wornArmorIgnoredName =
    wornArmorItem && equippedArmor === undefined
      ? (wornArmorItem.name ?? 'Custom armor')
      : undefined;

  // A5e: the AC display now passes the class-derived Unarmored Defense so the
  // number reflects it (Barbarian → Con-based AC; Monk loses it with a Shield).
  const acBreakdown = armorClassBreakdown(character.abilities, character.acOverride, {
    armor: equippedArmor,
    shield: equippedShield,
    wornArmorIgnoredName,
    unarmoredDefense: unarmoredDefenseFor(character),
  });
  const initBreakdown = initiativeBreakdown(
    character.abilities,
    character.initiativeBonus,
  );
  const ppBreakdown = passivePerceptionBreakdown(character);
  const hpBreakdown = hitPointMaxBreakdown({
    scores: character.abilities,
    level: character.level,
    hitDie: resolveClass(character)?.hitDie,
    hpMax: character.hpMax,
    hpPerLevel,
    rolledHp: character.houseRules?.rolledHp,
    rolledHpTotal: character.rolledHpTotal,
  });

  const selectedClass = resolveClass(character);
  // Hit Dice total equals the character level (PHB 2024 "Hit Points"); shown as
  // a CalculatedValue with a single summing component so the total is explained.
  const hitDiceTotalValue = hitDiceTotal(character);
  const hitDiceBreakdown = {
    total: hitDiceTotalValue,
    components: [{ label: 'Character level', value: hitDiceTotalValue }],
  };
  const hitDiceSpent = character.hitDiceSpent ?? 0;
  const rolledHpOn = character.houseRules?.rolledHp ?? false;

  // ── Panel groups (rendered as functions so they can be placed in either the
  // flat out-of-combat stack or the in-combat tabpanels without duplication). ──

  const coreStatsCard = (
    <Card>
      <SectionHeader icon={Swords} title="Core Stats" />
      <div className={styles.derivedGrid}>
        <div className={styles.derivedCard}>
          <span className={styles.fieldLabel}>Armor Class</span>
          <span className={styles.derivedValue}>
            <CalculatedValue label="Armor Class" breakdown={acBreakdown} />
          </span>
          <label className={styles.derivedInputLabel} htmlFor="ac-override">
            Override
          </label>
          <input
            id="ac-override"
            className={styles.derivedInput}
            type="number"
            min={0}
            value={character.acOverride ?? ''}
            placeholder="auto"
            aria-label="Armor Class override"
            onChange={(e) => setAcOverride(e.target.value)}
          />
        </div>

        <div className={styles.derivedCard}>
          <span className={styles.fieldLabel}>Initiative</span>
          <span className={styles.derivedValue}>
            <CalculatedValue label="Initiative" breakdown={initBreakdown}>
              {formatSigned(initBreakdown.total)}
            </CalculatedValue>
          </span>
          <label className={styles.derivedInputLabel} htmlFor="init-bonus">
            Bonus
          </label>
          <input
            id="init-bonus"
            className={styles.derivedInput}
            type="number"
            value={character.initiativeBonus ?? ''}
            placeholder="0"
            aria-label="Initiative bonus"
            onChange={(e) => setInitiativeBonus(e.target.value)}
          />
        </div>

        <div className={styles.derivedCard}>
          <span className={styles.fieldLabel}>Passive Perception</span>
          <span className={styles.derivedValue}>
            <CalculatedValue label="Passive Perception" breakdown={ppBreakdown} />
          </span>
        </div>

        <div className={styles.derivedCard}>
          <span className={styles.fieldLabel}>Hit Point Maximum</span>
          <span className={styles.derivedValue}>
            <CalculatedValue label="Hit Point Maximum" breakdown={hpBreakdown} />
          </span>
          <label className={styles.derivedInputLabel} htmlFor="hp-max">
            HP max
          </label>
          <input
            id="hp-max"
            className={styles.derivedInput}
            type="number"
            min={0}
            value={character.hpMax ?? ''}
            placeholder="set"
            aria-label="Hit Point maximum"
            onChange={(e) => setHpMax(e.target.value)}
          />
          <label className={styles.checkboxCell}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={rolledHpOn}
              aria-label="Use rolled HP (house rule)"
              onChange={(e) => setRolledHpRule(e.target.checked)}
            />
            <span className={styles.checkboxText}>Use rolled HP (house rule)</span>
          </label>
          {rolledHpOn && (
            <>
              <label className={styles.derivedInputLabel} htmlFor="rolled-hp-total">
                Rolled HP total
              </label>
              <input
                id="rolled-hp-total"
                className={styles.derivedInput}
                type="number"
                min={0}
                value={character.rolledHpTotal ?? ''}
                placeholder="0"
                aria-label="Rolled HP total"
                onChange={(e) => setRolledHpTotal(e.target.value)}
              />
            </>
          )}
        </div>
      </div>
    </Card>
  );

  const hitDiceCard = (
    <Card>
      <SectionHeader icon={Swords} title="Hit Dice" />
      <div className={styles.hitDiceRow}>
        <span className={styles.fieldLabel}>Hit Die</span>
        <span className={styles.statValue}>
          {selectedClass ? `d${selectedClass.hitDie}` : '—'}
        </span>
        <span className={styles.fieldLabel}>Total</span>
        <span className={styles.statValue}>
          <CalculatedValue label="Hit Dice total" breakdown={hitDiceBreakdown}>
            {hitDiceTotalValue}
          </CalculatedValue>
        </span>
        <label className={styles.derivedInputLabel} htmlFor="hit-dice-spent">
          Spent
        </label>
        <input
          id="hit-dice-spent"
          className={styles.derivedInput}
          type="number"
          min={0}
          max={hitDiceTotalValue}
          value={character.hitDiceSpent ?? ''}
          placeholder="0"
          aria-label="Hit Dice spent"
          onChange={(e) => setHitDiceSpent(e.target.value, hitDiceTotalValue)}
        />
        <span className={styles.speciesNote}>
          {hitDiceSpent} / {hitDiceTotalValue}
        </span>
      </div>
      {/* Stage A5b: Short Rest and Long Rest, beside the Hit Dice they spend. */}
      <RestControls character={character} onChange={onChange} onNotify={onNotify} />
    </Card>
  );

  // Attack-mode panels: weapon cards, Unarmed Strike, Ammunition, Weapon Mastery.
  const attackPanels = (
    <>
      <WeaponCards character={character} onAttack={openAttack} />
      <UnarmedStrikeCard character={character} onAttack={openAttack} />
      <AmmoTracker
        character={character}
        onChange={onChange}
        usedByItem={ammoUsed}
        onUsedChange={setAmmoUsed}
      />
      <WeaponMasteryChooser character={character} onChange={onChange} />
    </>
  );

  // Defend-mode panels: HP card, Take Damage, Armor Class + Speed + movement.
  const defendPanels = (
    <>
      <HitPointsCard character={character} onChange={onChange} />
      <TakeDamagePanel character={character} onChange={onChange} onNotify={onNotify} />
      <DefenseReadout character={character} />
    </>
  );

  // Status-mode panels: Active Conditions (incl. Exhaustion), Death Saves,
  // Concentration, Core Stats, Hit Dice + Rests, read-only Spell slots.
  const statusPanels = (
    <>
      <ActiveConditions character={character} onChange={onChange} />
      <DeathSavesCard character={character} onChange={onChange} rollRequest={deathSaveRequest} />
      <ConcentrationCard character={character} onChange={onChange} onNotify={onNotify} />
      <SpellSlotSummary character={character} />
      {coreStatsCard}
      {hitDiceCard}
    </>
  );

  // The start-of-turn Death Saving Throw is triggered from the always-visible
  // Turn panel banner, but the Death Saves card (and its roll dialog) lives in
  // Status mode while in combat. Switching to Status when the save is requested
  // keeps the dialog reachable instead of trapped in a hidden tabpanel.
  const requestDeathSave = () => {
    setDeathSaveRequest((n) => n + 1);
    if (inCombat) setMode('status');
  };

  // The Initiative tracker (starts combat) and the Turn panel stay at the top in
  // both states (blueprint: "keep it reachable in both states, e.g. at the top").
  const topControls = (
    <>
      <InitiativeTracker character={character} onChange={onChange} />
      <TurnPanel character={character} onChange={onChange} onRollDeathSave={requestDeathSave} />
    </>
  );

  const attackFlowDialog =
    attackWeaponId !== null ? (
      <AttackFlow
        character={character}
        onChange={onChange}
        weaponId={attackWeaponId}
        onClose={() => setAttackWeaponId(null)}
        target={attackTarget}
        onTargetChange={setAttackTarget}
        ammoUsed={ammoUsed}
        onAmmoUsedChange={setAmmoUsed}
      />
    ) : null;

  /**
   * A tabpanel wrapper (role="tabpanel" + aria-labelledby). While in combat the
   * three panels stay MOUNTED and are toggled with CSS (not conditionally
   * rendered) so each panel's internal state — AttackFlow step, TakeDamagePanel
   * inputs — survives a mode switch, mirroring the PWA (ux-audit Req 9.3).
   */
  const tabPanel = (panelMode: CombatMode, children: ReactNode) => (
    <div
      role="tabpanel"
      id={`${MODE_ID_BASE}-panel-${panelMode}`}
      aria-labelledby={`${MODE_ID_BASE}-tab-${panelMode}`}
      aria-hidden={mode !== panelMode}
      hidden={mode !== panelMode}
      className={styles.modePanel}
    >
      {children}
    </div>
  );

  return (
    <div className={styles.page}>
      {/* Read-only indicator of any opt-in house rules in effect (cheap). */}
      <HouseRuleIndicator houseRules={character.houseRules} />

      {/* The Initiative tracker (start combat) and the Turn panel: always at the
          top, reachable in and out of combat. */}
      {topControls}

      {inCombat ? (
        <>
          {/* Segmented control: sticky at the top of the scroll area, shown only
              while in combat (blueprint 5.3 / D10). */}
          <div className={styles.segmentedControlSticky}>
            <SegmentedControl
              ariaLabel="Combat mode"
              options={MODE_OPTIONS}
              value={mode}
              onChange={(next) => setMode(next)}
              idBase={MODE_ID_BASE}
            />
            {/* Compact sticky HP / AC strip on mobile and tablet (ported from the
                PWA CombatDashboardCompact). Hidden in Status mode to match the
                PWA, which shows the compact strip only outside Status. */}
            {isCompact && mode !== 'status' && (
              <CombatCompactBar character={character} acBreakdown={acBreakdown} />
            )}
          </div>

          {tabPanel('attack', attackPanels)}
          {tabPanel('defend', defendPanels)}
          {tabPanel('status', statusPanels)}
        </>
      ) : (
        /* Out of combat: a flat, ordered collapsible stack of every panel
           (blueprint 5.3 out-of-combat order: HP first, then Active Conditions,
           Core Stats, Hit Dice + Rests, Weapons, Ammunition). No A5a–A5d panel
           is lost; the layout is only reorganised. */
        <>
          <HitPointsCard character={character} onChange={onChange} />
          <TakeDamagePanel character={character} onChange={onChange} onNotify={onNotify} />
          <DefenseReadout character={character} />
          <DeathSavesCard character={character} onChange={onChange} rollRequest={deathSaveRequest} />
          <ConcentrationCard character={character} onChange={onChange} onNotify={onNotify} />
          <ActiveConditions character={character} onChange={onChange} />
          {coreStatsCard}
          {hitDiceCard}
          <SpellSlotSummary character={character} />
          <WeaponCards character={character} onAttack={openAttack} />
          <UnarmedStrikeCard character={character} onAttack={openAttack} />
          <AmmoTracker
            character={character}
            onChange={onChange}
            usedByItem={ammoUsed}
            onUsedChange={setAmmoUsed}
          />
          <WeaponMasteryChooser character={character} onChange={onChange} />
        </>
      )}

      {attackFlowDialog}
    </div>
  );
}
