import type { Character } from '../../types/character';
import { formatSigned } from '../../logic/breakdown';
import { armorClassBreakdown } from '../../logic/armor-class';
import { getArmor } from '../../data/armor';
import { hitPointMaxBreakdown } from '../../logic/hit-points';
import { resolveSpecies } from '../../logic/species';
import { resolveClass, hitDiceTotal } from '../../logic/classes';
import { initiativeBreakdown } from '../../logic/initiative';
import { passivePerceptionBreakdown } from '../../logic/passive-checks';
import { CalculatedValue } from '../shared/CalculatedValue';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { Swords } from 'lucide-react';
import { parseNumberInput } from './sheet-helpers';
import styles from './CombatPage.module.css';

export interface CombatPageProps {
  character: Character;
  onChange: (next: Character) => void;
}

/**
 * The Combat tab: the derived combat stats lifted verbatim from the former
 * single-page "Core Stats" section — Armor Class, Initiative, Passive
 * Perception, Hit Point Maximum (incl. the rolled-HP house-rule toggle, kept
 * adjacent to the HP value it affects), and Hit Dice.
 */
export function CombatPage({ character, onChange }: CombatPageProps) {
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

  const acBreakdown = armorClassBreakdown(character.abilities, character.acOverride, {
    armor: equippedArmor,
    shield: equippedShield,
    wornArmorIgnoredName,
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

  return (
    <div className={styles.page}>
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
      </Card>
    </div>
  );
}
