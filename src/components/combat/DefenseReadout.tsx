import { Shield } from 'lucide-react';
import type { Character } from '../../types/character';
import { armorClassBreakdown, unarmoredDefenseFor } from '../../logic/armor-class';
import { effectiveAbilityScores } from '../../logic/feats';
import { getArmor } from '../../data/armor';
import { speedBreakdown } from '../../logic/species';
import { hitPointMaxBreakdown } from '../../logic/hit-points';
import { resolveClass } from '../../logic/classes';
import { resolveSpecies } from '../../logic/species';
import { initiativeBreakdown } from '../../logic/initiative';
import { passivePerceptionBreakdown } from '../../logic/passive-checks';
import { formatSigned } from '../../logic/breakdown';
import {
  movementAllowanceBreakdown,
  remainingMovementBreakdown,
  turnContextOf,
} from '../../logic/turn-economy';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import { CalculatedValue } from '../shared/CalculatedValue';
import { parseNumberInput } from '../pages/sheet-helpers';
import styles from './DefenseReadout.module.css';

export interface DefenseReadoutProps {
  character: Character;
  /**
   * P2: the consolidated panel owns the single-source setup editors (AC
   * override, Initiative bonus), which live behind a collapsible "Adjust"
   * affordance. When omitted the panel is purely read-only (the Adjust
   * affordance is hidden), so it can still be rendered where no editor is
   * wanted.
   */
  onChange?: (next: Character) => void;
}

/**
 * The consolidated Defend-mode / combat-stats panel (P2: merges the former
 * "Combat Stats" card and the "Defenses & Movement" readout into ONE panel so a
 * defending player sees Armor Class, Speed, HP maximum, Initiative, and Passive
 * Perception together, with the current turn's movement used / remaining and
 * the read-only Dodge / Opportunity Attack notes. Armor Class is shown exactly
 * once (the old duplication across the two cards is gone).
 *
 * Every number comes from a Part 1 / A5a–A5d logic function — no rule is
 * computed here:
 *  - AC: `armorClassBreakdown(...)` with the class-derived Unarmored Defense
 *    (`unarmoredDefenseFor`) passed in, so a Barbarian with no armour shows the
 *    Con-based AC and a Monk loses it with a Shield (PHB 2024 Barbarian L2446 /
 *    Monk L4534).
 *  - Speed: `speedBreakdown(character)`, which carries the worn-armour
 *    Strength-requirement -10 and the Exhaustion penalty.
 *  - HP maximum: `hitPointMaxBreakdown(...)` — READ-ONLY here; HP max is
 *    authoritative on the Advancement tab (P1).
 *  - Initiative: `initiativeBreakdown(...)`; Passive Perception:
 *    `passivePerceptionBreakdown(...)`.
 *  - Movement used / remaining: the A5c turn-economy breakdowns.
 *
 * The single-source setup editors (AC override, Initiative bonus) stay editable
 * behind the "Adjust" collapsible (P2/P6), so the glance stays read-only.
 */
export function DefenseReadout({ character, onChange }: DefenseReadoutProps) {
  // Resolve equipped armour/shield (A1 equipped → inventory item → ArmorData),
  // matching the former CombatPage Core Stats resolution so the number is
  // identical.
  const inventory = character.inventory ?? [];
  const equipped = character.equipped;
  const resolveEquippedArmor = (id: string | undefined) => {
    if (!id) return undefined;
    const item = inventory.find((i) => i.id === id);
    return item?.catalogId ? getArmor(item.catalogId) : undefined;
  };
  const equippedArmor = resolveEquippedArmor(equipped?.armorItemId);
  const equippedShield = resolveEquippedArmor(equipped?.shieldItemId);
  const wornArmorItem = equipped?.armorItemId
    ? inventory.find((i) => i.id === equipped.armorItemId)
    : undefined;
  const wornArmorIgnoredName =
    wornArmorItem && equippedArmor === undefined
      ? (wornArmorItem.name ?? 'Custom armor')
      : undefined;

  const effectiveScores = effectiveAbilityScores(character);
  const acBreakdown = armorClassBreakdown(effectiveScores, character.acOverride, {
    armor: equippedArmor,
    shield: equippedShield,
    wornArmorIgnoredName,
    unarmoredDefense: unarmoredDefenseFor(character),
  });

  const speed = speedBreakdown(character);
  const initBreakdown = initiativeBreakdown(effectiveScores, character.initiativeBonus);
  const ppBreakdown = passivePerceptionBreakdown(character);

  // HP maximum breakdown (read-only mirror; authoritative on Advancement).
  const selectedSpecies = resolveSpecies(character);
  const hpPerLevel = selectedSpecies?.traits.find((t) => t.mechanics?.hpPerLevel)
    ?.mechanics?.hpPerLevel;
  const hpBreakdown = hitPointMaxBreakdown({
    scores: effectiveScores,
    level: character.level,
    hitDie: resolveClass(character)?.hitDie,
    hpMax: character.hpMax,
    hpPerLevel,
    rolledHp: character.houseRules?.rolledHp,
    rolledHpTotal: character.rolledHpTotal,
  });

  const combat = character.combat;
  const turn = combat?.turn;
  const context = turnContextOf(character);
  const allowance = movementAllowanceBreakdown(context.speed, turn?.dashes ?? 0);
  const remaining = turn
    ? remainingMovementBreakdown(context.speed, turn)
    : undefined;

  const setAcOverride = (raw: string) =>
    onChange?.({ ...character, acOverride: parseNumberInput(raw, true) });
  const setInitiativeBonus = (raw: string) =>
    onChange?.({ ...character, initiativeBonus: parseNumberInput(raw, false) });

  return (
    <Card>
      <div className={styles.stack}>
        <SectionHeader icon={Shield} title="Defenses & Combat Stats" />
        <div className={styles.grid}>
          <div className={styles.stat}>
            <span className={styles.label}>Armor Class</span>
            <span className={styles.value}>
              <CalculatedValue label="Armor Class" breakdown={acBreakdown} />
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Speed</span>
            <span className={styles.value}>
              <CalculatedValue label="Speed" breakdown={speed}>
                {speed.total} ft
              </CalculatedValue>
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Hit Point Maximum</span>
            <span className={styles.value}>
              <CalculatedValue label="Hit Point Maximum" breakdown={hpBreakdown} />
            </span>
            <span className={styles.note}>Set on the Advancement tab</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Initiative</span>
            <span className={styles.value}>
              <CalculatedValue label="Initiative" breakdown={initBreakdown}>
                {formatSigned(initBreakdown.total)}
              </CalculatedValue>
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Passive Perception</span>
            <span className={styles.value}>
              <CalculatedValue label="Passive Perception" breakdown={ppBreakdown} />
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Movement used</span>
            <span className={styles.value} data-testid="defend-movement-used">
              {turn ? (
                <CalculatedValue
                  label="Movement used"
                  breakdown={{
                    total: turn.movementUsed,
                    components: [
                      { label: 'Move entries since your turn started', value: turn.movementUsed },
                    ],
                    note: 'Only the running total is stored. Start my turn resets it to 0.',
                  }}
                >
                  {turn.movementUsed} ft
                </CalculatedValue>
              ) : (
                <span className={styles.muted}>—</span>
              )}
            </span>
          </div>
          <div className={styles.stat}>
            <span className={styles.label}>Movement remaining</span>
            <span className={styles.value} data-testid="defend-movement-remaining">
              {remaining ? (
                <CalculatedValue label="Movement remaining" breakdown={remaining}>
                  {remaining.total} ft
                </CalculatedValue>
              ) : (
                <CalculatedValue label="Movement allowance" breakdown={allowance}>
                  {allowance.total} ft
                </CalculatedValue>
              )}
            </span>
          </div>
        </div>

        {/* The single-source setup editors (AC override, Initiative bonus) sit
            behind a collapsible affordance so the combat glance stays read-only
            (P2/P6). Rendered only when the panel is given an onChange. */}
        {onChange && (
          <CollapsibleSection
            title="Adjust"
            storageKey="dnd-collapse-combat-adjust"
            defaultExpanded={false}
          >
            <div className={styles.adjustGrid}>
              <div className={styles.adjustField}>
                <label className={styles.adjustLabel} htmlFor="ac-override">
                  Armor Class override
                </label>
                <input
                  id="ac-override"
                  className={styles.adjustInput}
                  type="number"
                  min={0}
                  value={character.acOverride ?? ''}
                  placeholder="auto"
                  aria-label="Armor Class override"
                  onChange={(e) => setAcOverride(e.target.value)}
                />
              </div>

              <div className={styles.adjustField}>
                <label className={styles.adjustLabel} htmlFor="init-bonus">
                  Initiative bonus
                </label>
                <input
                  id="init-bonus"
                  className={styles.adjustInput}
                  type="number"
                  value={character.initiativeBonus ?? ''}
                  placeholder="0"
                  aria-label="Initiative bonus"
                  onChange={(e) => setInitiativeBonus(e.target.value)}
                />
              </div>
            </div>
          </CollapsibleSection>
        )}

        <div className={styles.notes}>
          {/* Text-only reminders (PHB 2024 "Dodge [Action]" / "Opportunity
              Attacks"). No rule is computed; these are advisory notes. */}
          <p className={styles.note}>
            <span className={styles.noteName}>Dodge</span>: take the Dodge action and
            attacks against you have Disadvantage until your next turn (and you make
            Dexterity saves with Advantage), as long as you can see the attacker.
          </p>
          <p className={styles.note}>
            <span className={styles.noteName}>Opportunity Attack</span>: a creature you
            can see provokes one when it leaves your reach; you can spend your Reaction
            to make one melee attack. Taking the Disengage action avoids provoking.
          </p>
        </div>
      </div>
    </Card>
  );
}
