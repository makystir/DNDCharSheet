import { Heart, Shield, Footprints, Brain, Eye } from 'lucide-react';
import { passivePerceptionBreakdown } from '../../logic/passive-checks';
import type { Character } from '../../types/character';
import { characterArmorClassBreakdown } from '../../logic/armor-class';
import { speedBreakdown } from '../../logic/species';
import { getSpell } from '../../data/spells';
import {
  effectiveHp,
  hitPointMaxOf,
  effectiveTempHp,
  currentHpBreakdown,
  characterHitPointMaxBreakdown,
} from '../../logic/hit-points-state';
import { currentRound, initiativeResult, isInFight } from '../../logic/combat-round';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './CombatStatusStrip.module.css';

export interface CombatStatusStripProps {
  character: Character;
}

/**
 * The always-visible glance at the top of the Combat page: hit points (with
 * temporary hit points), Armor Class, Speed, Passive Perception, the round and the player's
 * Initiative result while a fight is on, and the spell being concentrated on.
 * Read-only: every figure comes from the logic layer and carries its breakdown
 * tooltip. Editing happens in the cards below.
 */
export function CombatStatusStrip({ character }: CombatStatusStripProps) {
  const hp = effectiveHp(character);
  const max = hitPointMaxOf(character);
  const temp = effectiveTempHp(character);
  const currentBreakdown = currentHpBreakdown(character);
  const ac = characterArmorClassBreakdown(character);
  const speed = speedBreakdown(character);
  const passivePerception = passivePerceptionBreakdown(character);
  const inFight = isInFight(character);
  const initiative = initiativeResult(character);
  const concentrating = character.concentration;
  const spellName = concentrating ? (getSpell(concentrating.spellId)?.name ?? concentrating.spellId) : null;

  return (
    <div className={styles.strip} role="group" aria-label="Combat summary">
      <span className={styles.stat}>
        <Heart size={16} aria-hidden="true" className={styles.icon} />
        <span className={styles.value} data-testid="strip-hp">
          {max === undefined || currentBreakdown === undefined ? (
            '-'
          ) : (
            <>
              <CalculatedValue label="Current HP" breakdown={currentBreakdown}>
                {hp ?? 0}
              </CalculatedValue>
              <span className={styles.slash} aria-hidden="true">
                {' / '}
              </span>
              <CalculatedValue label="Max HP" breakdown={characterHitPointMaxBreakdown(character)}>
                {max}
              </CalculatedValue>
            </>
          )}
        </span>
        {temp > 0 && <span className={styles.temp} data-testid="strip-temp">+{temp} temp</span>}
        <span className={styles.srOnly}>Hit Points</span>
      </span>
      <span className={styles.stat}>
        <Shield size={16} aria-hidden="true" className={styles.icon} />
        <span className={styles.value} data-testid="strip-ac">
          <CalculatedValue label="Armor Class" breakdown={ac}>
            {ac.total}
          </CalculatedValue>
        </span>
        <span className={styles.srOnly}>Armor Class</span>
      </span>
      <span className={styles.stat}>
        <Footprints size={16} aria-hidden="true" className={styles.icon} />
        <span className={styles.value} data-testid="strip-speed">
          <CalculatedValue label="Speed" breakdown={speed}>
            {speed.total} ft
          </CalculatedValue>
        </span>
        <span className={styles.srOnly}>Speed</span>
      </span>
      <span className={styles.stat}>
        <Eye size={16} aria-hidden="true" className={styles.icon} />
        <span className={styles.value} data-testid="strip-passive-perception">
          <CalculatedValue label="Passive Perception" breakdown={passivePerception} />
        </span>
        <span className={styles.srOnly}>Passive Perception</span>
      </span>
      {inFight && (
        <span className={styles.chip} data-testid="strip-round">
          Round {currentRound(character)}
          {initiative !== undefined ? ` · Init ${initiative}` : ''}
        </span>
      )}
      {spellName && (
        <span className={styles.chip} data-testid="strip-concentration">
          <Brain size={14} aria-hidden="true" /> Concentrating: {spellName}
        </span>
      )}
    </div>
  );
}
