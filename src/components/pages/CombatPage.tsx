import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Character } from '../../types/character';
import { characterArmorClassBreakdown } from '../../logic/armor-class';
import { resolveClass, hitDiceTotal } from '../../logic/classes';
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
import { ResourcesCard } from '../combat/ResourcesCard';
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
 *  - Defend: HP card (damage/heal/temp HP via TakeDamagePanel), the
 *    consolidated Defenses & Combat Stats panel (AC + Speed + HP + Initiative +
 *    Passive Perception + movement + Dodge / OA notes, with the Adjust editors)
 *    (DefenseReadout, P2).
 *  - Status: Active Conditions (incl. Exhaustion), Death Saves, Concentration,
 *    Rests, read-only Spell-slot summary, and Hit Dice.
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

  const setHitDiceSpent = (raw: string, total: number) => {
    const parsed = parseNumberInput(raw, true);
    const clamped = parsed === undefined ? undefined : Math.min(parsed, total);
    onChange({ ...character, hitDiceSpent: clamped });
  };

  // Shared AC assembly (effective scores, equipped armour/shield, Unarmored
  // Defense, override). Used by the mobile CombatCompactBar below.
  const acBreakdown = characterArmorClassBreakdown(character);

  const selectedClass = resolveClass(character);
  // Hit Dice total equals the character level (PHB 2024 "Hit Points"); shown as
  // a CalculatedValue with a single summing component so the total is explained.
  const hitDiceTotalValue = hitDiceTotal(character);
  const hitDiceBreakdown = {
    total: hitDiceTotalValue,
    components: [{ label: 'Character level', value: hitDiceTotalValue }],
  };
  const hitDiceSpent = character.hitDiceSpent ?? 0;

  // ── Panel groups (rendered as functions so they can be placed in either the
  // flat out-of-combat stack or the in-combat tabpanels without duplication). ──

  // P2: the former "Combat Stats" card and the "Defenses & Movement" readout are
  // merged into ONE panel (DefenseReadout). It now shows AC, Speed, HP maximum
  // (read-only), Initiative, and Passive Perception together, with movement and
  // the Dodge / OA notes, and it owns the "Adjust" collapsible (AC override,
  // Initiative bonus). Armor Class is therefore shown exactly once. Passing
  // `onChange` makes the Adjust editors available; every displayed total stays a
  // read-only CalculatedValue sourced from the logic layer.

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
      <DefenseReadout character={character} onChange={onChange} />
    </>
  );

  // Status-mode panels: Active Conditions (incl. Exhaustion), Death Saves,
  // Concentration, Rests, read-only Spell slots, Hit Dice. The consolidated
  // defense panel (AC / Speed / HP / Initiative / Passive Perception) lives in
  // Defend mode (P2), so it is NOT duplicated here.
  const statusPanels = (
    <>
      <ActiveConditions character={character} onChange={onChange} />
      <DeathSavesCard character={character} onChange={onChange} rollRequest={deathSaveRequest} />
      <ConcentrationCard character={character} onChange={onChange} onNotify={onNotify} />
      <ResourcesCard character={character} onChange={onChange} />
      <SpellSlotSummary character={character} />
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
          {/* P9: lead with the defense / combat-stats panel (HP / AC / Speed)
              before Conditions, matching the in-combat Defend emphasis. */}
          <HitPointsCard character={character} onChange={onChange} />
          <TakeDamagePanel character={character} onChange={onChange} onNotify={onNotify} />
          <DefenseReadout character={character} onChange={onChange} />
          <DeathSavesCard character={character} onChange={onChange} rollRequest={deathSaveRequest} />
          <ConcentrationCard character={character} onChange={onChange} onNotify={onNotify} />
          <ActiveConditions character={character} onChange={onChange} />
          {hitDiceCard}
          <ResourcesCard character={character} onChange={onChange} />
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
