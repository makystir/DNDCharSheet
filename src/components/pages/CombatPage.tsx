import { useState } from 'react';
import type { Character } from '../../types/character';
import { resolveClass, hitDiceTotal } from '../../logic/classes';
import { CalculatedValue } from '../shared/CalculatedValue';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { ActiveConditions } from '../combat/ActiveConditions';
import { HitPointsCard } from '../combat/HitPointsCard';
import { TakeDamagePanel } from '../combat/TakeDamagePanel';
import { DeathSavesCard } from '../combat/DeathSavesCard';
import { ConcentrationCard } from '../combat/ConcentrationCard';
import { WeaponCards } from '../combat/WeaponCards';
import { UnarmedStrikeCard } from '../combat/UnarmedStrikeCard';
import { AmmoTracker } from '../combat/AmmoTracker';
import { WeaponMasteryChooser } from '../combat/WeaponMasteryChooser';
import { RestControls } from '../combat/RestControls';
import { DefenseReadout } from '../combat/DefenseReadout';
import { SpellcastingQuickCard } from '../combat/SpellcastingQuickCard';
import { TurnOptionsCard } from '../combat/TurnOptionsCard';
import { QuickRulesCard } from '../combat/QuickRulesCard';
import { ResourcesCard } from '../combat/ResourcesCard';
import { HouseRuleIndicator } from '../combat/HouseRuleIndicator';
import { CombatStatusStrip } from '../combat/CombatStatusStrip';
import { CombatRoundCard } from '../combat/CombatRoundCard';
import { SavesPanel } from '../combat/SavesPanel';
import { EffectsCard } from '../combat/EffectsCard';
import { Swords } from 'lucide-react';
import { parseNumberInput } from './sheet-helpers';
import styles from './CombatPage.module.css';

export interface CombatPageProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Optional app-level Toast sink (Concentration and rest results). */
  onNotify?: (message: string) => void;
}

/**
 * The Combat page: a reference for the player to use while the DM runs the fight.
 * The player resolves combat at the table, so the page does not run turns. It
 * puts what a player looks up and updates during a fight in one scroll, top to
 * bottom:
 *  - a sticky strip with HP, AC, Speed, the round and Initiative, and what the
 *    character is concentrating on;
 *  - the Fight card (round counter, Next round, Initiative roll);
 *  - Status: hit points and damage, death saves, saving throws, conditions,
 *    tracked effects and concentration, and the defenses;
 *  - Attacks: weapons, ammunition and weapon mastery;
 *  - Resources: spell slots, class resources, hit dice and rests.
 *
 * No rule is computed in this component: every number comes from the logic layer.
 */
export function CombatPage({ character, onChange, onNotify }: CombatPageProps) {
  // Ammunition fired this fight, by inventory item id (UI state). Shared by the weapon
  // cards (an Ammunition attack uses a piece) and the Ammunition card (recover half).
  const [ammoUsed, setAmmoUsed] = useState<Record<string, number>>({});

  const setHitDiceSpent = (raw: string, total: number) => {
    const parsed = parseNumberInput(raw, true);
    const clamped = parsed === undefined ? undefined : Math.min(parsed, total);
    onChange({ ...character, hitDiceSpent: clamped });
  };

  const selectedClass = resolveClass(character);
  // Hit Dice total equals the character level (PHB 2024 "Hit Points"); shown as
  // a CalculatedValue with a single summing component so the total is explained.
  const hitDiceTotalValue = hitDiceTotal(character);
  const hitDiceBreakdown = {
    total: hitDiceTotalValue,
    components: [{ label: 'Character level', value: hitDiceTotalValue }],
  };
  const hitDiceSpent = character.hitDiceSpent ?? 0;

  const hitDiceCard = (
    <Card>
      <SectionHeader icon={Swords} title="Hit Dice" />
      <div className={styles.hitDiceRow}>
        <span className={styles.fieldLabel}>Hit Die</span>
        <span className={styles.statValue}>{selectedClass ? `d${selectedClass.hitDie}` : '-'}</span>
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
      {/* Short Rest and Long Rest, beside the Hit Dice they spend. */}
      <RestControls character={character} onChange={onChange} onNotify={onNotify} />
    </Card>
  );

  return (
    <div className={styles.page}>
      {/* Read-only indicator of any opt-in house rules in effect. */}
      <HouseRuleIndicator houseRules={character.houseRules} />

      <CombatStatusStrip character={character} />

      <CombatRoundCard character={character} onChange={onChange} />

      <section className={styles.group} aria-labelledby="combat-status-heading">
        <h2 id="combat-status-heading" className={styles.groupHeading}>
          Status
        </h2>
        <HitPointsCard character={character} onChange={onChange} />
        <TakeDamagePanel character={character} onChange={onChange} onNotify={onNotify} />
        <DeathSavesCard character={character} onChange={onChange} />
        <SavesPanel character={character} />
        <ActiveConditions character={character} onChange={onChange} />
        <EffectsCard character={character} onChange={onChange} />
        <ConcentrationCard character={character} onChange={onChange} onNotify={onNotify} />
        <DefenseReadout character={character} onChange={onChange} />
      </section>

      <section className={styles.group} aria-labelledby="combat-attacks-heading">
        <h2 id="combat-attacks-heading" className={styles.groupHeading}>
          Attacks
        </h2>
        <WeaponCards
          character={character}
          onChange={onChange}
          onAmmoFired={(id) => setAmmoUsed((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))}
        />
        <UnarmedStrikeCard character={character} />
        <AmmoTracker
          character={character}
          onChange={onChange}
          usedByItem={ammoUsed}
          onUsedChange={setAmmoUsed}
        />
        <WeaponMasteryChooser character={character} onChange={onChange} />
      </section>

      <section className={styles.group} aria-labelledby="combat-spells-heading">
        <h2 id="combat-spells-heading" className={styles.groupHeading}>
          Spells and turn options
        </h2>
        <SpellcastingQuickCard character={character} onChange={onChange} />
        <TurnOptionsCard character={character} />
      </section>

      <section className={styles.group} aria-labelledby="combat-resources-heading">
        <h2 id="combat-resources-heading" className={styles.groupHeading}>
          Resources and rests
        </h2>
        <ResourcesCard character={character} onChange={onChange} />
        {hitDiceCard}
      </section>

      <QuickRulesCard />

    </div>
  );
}
