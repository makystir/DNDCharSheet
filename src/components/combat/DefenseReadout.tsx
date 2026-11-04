import { Shield } from 'lucide-react';
import type { Character } from '../../types/character';
import { armorClassBreakdown, unarmoredDefenseFor } from '../../logic/armor-class';
import { effectiveAbilityScores } from '../../logic/feats';
import { getArmor } from '../../data/armor';
import { speedBreakdown } from '../../logic/species';
import {
  movementAllowanceBreakdown,
  remainingMovementBreakdown,
  turnContextOf,
} from '../../logic/turn-economy';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './DefenseReadout.module.css';

export interface DefenseReadoutProps {
  character: Character;
}

/**
 * The Defend-mode readout (Stage A5e): Armor Class and Speed shown side by
 * side as CalculatedValues, plus the current turn's movement used / remaining
 * (A5c), and read-only Dodge / Opportunity Attack notes.
 *
 * Every number comes from a Part 1 / A5a–A5d logic function — no rule is
 * computed here:
 *  - AC: `armorClassBreakdown(...)` with the class-derived Unarmored Defense
 *    (`unarmoredDefenseFor`) passed in, so a Barbarian with no armour shows the
 *    Con-based AC and a Monk loses it with a Shield (PHB 2024 Barbarian L2446 /
 *    Monk L4534).
 *  - Speed: `speedBreakdown(character)`, which now carries the worn-armour
 *    Strength-requirement -10 and the Exhaustion penalty (A5e).
 *  - Movement used / remaining: the A5c turn-economy breakdowns.
 */
export function DefenseReadout({ character }: DefenseReadoutProps) {
  // Resolve equipped armour/shield (A1 equipped → inventory item → ArmorData),
  // matching the CombatPage Core Stats resolution so the number is identical.
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

  const acBreakdown = armorClassBreakdown(effectiveAbilityScores(character), character.acOverride, {
    armor: equippedArmor,
    shield: equippedShield,
    wornArmorIgnoredName,
    unarmoredDefense: unarmoredDefenseFor(character),
  });

  const speed = speedBreakdown(character);
  const combat = character.combat;
  const turn = combat?.turn;
  const context = turnContextOf(character);
  const allowance = movementAllowanceBreakdown(context.speed, turn?.dashes ?? 0);
  const remaining = turn
    ? remainingMovementBreakdown(context.speed, turn)
    : undefined;

  return (
    <Card>
      <div className={styles.stack}>
        <SectionHeader icon={Shield} title="Defenses & Movement" />
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
