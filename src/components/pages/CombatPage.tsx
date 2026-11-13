import { useState } from 'react';
import type { Character } from '../../types/character';
import { AffectingYouCard } from '../combat/AffectingYouCard';
import { AlliesCard } from '../combat/AlliesCard';
import { HitPointsCard } from '../combat/HitPointsCard';
import { ConcentrationCard } from '../combat/ConcentrationCard';
import { WeaponCards } from '../combat/WeaponCards';
import { AmmoTracker } from '../combat/AmmoTracker';
import { SpellcastingQuickCard } from '../combat/SpellcastingQuickCard';
import { TurnOptionsCard } from '../combat/TurnOptionsCard';
import { QuickRulesCard } from '../combat/QuickRulesCard';
import { ResourcesCard } from '../combat/ResourcesCard';
import { HouseRuleIndicator } from '../combat/HouseRuleIndicator';
import { CombatStatusStrip } from '../combat/CombatStatusStrip';
import { CombatRoundCard } from '../combat/CombatRoundCard';
import { SavesPanel } from '../combat/SavesPanel';
import { characterResources } from '../../logic/resources';
import { anySpellcaster } from '../../logic/spellcasting';
import { ScrollLink } from '../shared/ScrollLink';
import styles from './CombatPage.module.css';

export interface CombatPageProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Optional app-level Toast sink (Concentration and damage results). */
  onNotify?: (message: string) => void;
}

/**
 * The Combat page: a reference for the player to use while the DM runs the fight.
 * The player resolves combat at the table, so the page does not run turns. Every
 * card must earn its place by being needed DURING a fight, and cards that do not
 * apply to this character right now hide themselves (Death Saves above 0 HP,
 * Concentration when not concentrating, Ammunition without an Ammunition weapon,
 * Spellcasting for a non-caster, Resources with none). Top to bottom:
 *  - a sticky strip with HP, AC, Speed, Passive Perception, the round and
 *    Initiative, and what the character is concentrating on;
 *  - the Fight card (round counter, Next round, Initiative roll);
 *  - Status: one Hit Points card (damage, healing, Temp HP and, at 0 HP, death
 *    saves), the six saving throws as a row of chips, "Affecting you"
 *    (conditions and tracked effects, one line when empty), concentration,
 *    and Allies (companions and people from the Companions page, read-only);
 *  - Attacks: one card with a row per weapon plus Unarmed Strike, and ammunition;
 *  - Spells and turn options;
 *  - Resources: limited-use features and spell slots spent in a fight.
 *
 * Out-of-fight content lives elsewhere: Hit Dice and Short/Long Rest on the
 * Character Overview (rolling Initiative interrupts a rest, PHB 2024 L21256 /
 * L21485), the AC override and Initiative bonus in the Overview Vitals "Adjust"
 * section, and the Weapon Mastery chooser on Character > Class & Features (it
 * changes only on a Long Rest).
 *
 * Layout: the strip (with jump links on a narrow page) and the Fight card span
 * the page; below them, a wide page splits into two columns, Status on the left
 * and Attacks / Spells and turn options / Resources on the right, so the main
 * things a player looks up are on screen together.
 *
 * No rule is computed in this component: every number comes from the logic layer.
 */
export function CombatPage({ character, onChange, onNotify }: CombatPageProps) {
  // Ammunition fired this fight, by inventory item id (UI state). Shared by the weapon
  // cards (an Ammunition attack uses a piece) and the Ammunition card (recover half).
  const [ammoUsed, setAmmoUsed] = useState<Record<string, number>>({});

  const isCaster = anySpellcaster(character);
  const hasResources = characterResources(character).length > 0;
  // Jump links (shown on narrow screens, where the page is one long column).
  const sections = [
    { id: 'combat-status-heading', label: 'Status' },
    { id: 'combat-attacks-heading', label: 'Attacks' },
    { id: 'combat-spells-heading', label: isCaster ? 'Spells' : 'Turn options' },
    ...(hasResources ? [{ id: 'combat-resources-heading', label: 'Resources' }] : []),
  ];

  return (
    <div className={styles.page}>
      {/* Read-only indicator of any opt-in house rules in effect. */}
      <HouseRuleIndicator houseRules={character.houseRules} />

      {/* Stays at the top while scrolling: the glance, plus jump links when the
          page is a single column. */}
      <div className={styles.stickyTop}>
        <CombatStatusStrip character={character} />
        <nav className={styles.jump} aria-label="Combat sections">
          {sections.map((s) => (
            <ScrollLink key={s.id} targetId={s.id} fallbackHref="#combat" className={styles.jumpLink}>
              {s.label}
            </ScrollLink>
          ))}
        </nav>
      </div>

      <CombatRoundCard character={character} onChange={onChange} />

      {/* Two columns on a wide page: how you are doing (left) and what you can
          do (right). One column, in this order, on a narrow one. */}
      <div className={styles.columns}>
        <div className={styles.column} data-testid="combat-column-status">
          <section className={styles.group} aria-labelledby="combat-status-heading">
            <h2 id="combat-status-heading" className={styles.groupHeading} tabIndex={-1}>
              Status
            </h2>
            <HitPointsCard character={character} onChange={onChange} onNotify={onNotify} />
            <SavesPanel character={character} />
            <AffectingYouCard character={character} onChange={onChange} />
            <ConcentrationCard character={character} onChange={onChange} onNotify={onNotify} />
            <AlliesCard character={character} />
          </section>
        </div>

        <div className={styles.column} data-testid="combat-column-actions">
          <section className={styles.group} aria-labelledby="combat-attacks-heading">
            <h2 id="combat-attacks-heading" className={styles.groupHeading} tabIndex={-1}>
              Attacks
            </h2>
            <WeaponCards
              character={character}
              onChange={onChange}
              onAmmoFired={(id) => setAmmoUsed((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))}
            />
            <AmmoTracker
              character={character}
              onChange={onChange}
              usedByItem={ammoUsed}
              onUsedChange={setAmmoUsed}
            />
          </section>

          <section className={styles.group} aria-labelledby="combat-spells-heading">
            <h2 id="combat-spells-heading" className={styles.groupHeading} tabIndex={-1}>
              {isCaster ? 'Spells and turn options' : 'Turn options'}
            </h2>
            <SpellcastingQuickCard character={character} onChange={onChange} />
            <TurnOptionsCard character={character} />
          </section>

          {/* The whole group hides (heading included) when the character has no
              limited-use features to track. */}
          {hasResources && (
            <section className={styles.group} aria-labelledby="combat-resources-heading">
              <h2 id="combat-resources-heading" className={styles.groupHeading} tabIndex={-1}>
                Resources
              </h2>
              <ResourcesCard character={character} onChange={onChange} />
            </section>
          )}
        </div>
      </div>

      <QuickRulesCard />
    </div>
  );
}
