import { Activity } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Character } from '../../../types/character';
import { proficiencyBonusBreakdown } from '../../../logic/abilities';
import { characterArmorClassBreakdown } from '../../../logic/armor-class';
import { formatSigned } from '../../../logic/breakdown';
import type { Breakdown } from '../../../logic/breakdown';
import { effectiveAbilityScores } from '../../../logic/feats';
import {
  characterHitPointMaxBreakdown,
  currentHpBreakdown,
  effectiveHp,
  effectiveTempHp,
  hitPointMaxOf,
  isBloodied,
} from '../../../logic/hit-points-state';
import { hitDiceByDieType, hitDiceTotal } from '../../../logic/classes';
import { initiativeBreakdown } from '../../../logic/initiative';
import { passivePerceptionBreakdown } from '../../../logic/passive-checks';
import { darkvisionBreakdown, speedBreakdown } from '../../../logic/species';
import { Card } from '../../shared/Card';
import { CalculatedValue } from '../../shared/CalculatedValue';
import { SectionHeader } from '../../shared/SectionHeader';
import styles from './OverviewVitals.module.css';

export interface OverviewVitalsProps {
  character: Character;
}

interface TileProps {
  label: string;
  children: ReactNode;
  /** Where the value is edited (a hash route) and the link text. */
  manage?: { href: string; text: string };
  /** Extra line under the value. */
  sub?: ReactNode;
  testId?: string;
}

function Tile({ label, children, manage, sub, testId }: TileProps) {
  return (
    <div className={styles.tile} data-testid={testId}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {children}
      </span>
      {sub}
      {manage && (
        <a className={styles.manage} href={manage.href}>
          {manage.text}
        </a>
      )}
    </div>
  );
}

/**
 * The Overview "vitals" strip: read-only mirrors of the numbers a player
 * reaches for during a session. Every number comes from the logic layer
 * (no rule is computed here) and carries its breakdown tooltip. Each tile links
 * to the page that owns the editor, keeping one editor per field.
 */
export function OverviewVitals({ character }: OverviewVitalsProps) {
  const scores = effectiveAbilityScores(character);
  const ac = characterArmorClassBreakdown(character);
  const hpMax = characterHitPointMaxBreakdown(character);
  const hasHpMax = hitPointMaxOf(character) !== undefined;
  const currentBd = currentHpBreakdown(character);
  const currentHp = effectiveHp(character);
  const tempHp = effectiveTempHp(character);
  const initiative = initiativeBreakdown(scores, character.initiativeBonus);
  const speed = speedBreakdown(character);
  const passivePerception = passivePerceptionBreakdown(character);
  const proficiency = proficiencyBonusBreakdown(character.level);
  const darkvision = darkvisionBreakdown(character);

  // Hit Dice: total equals character level (PHB 2024 "Hit Points"); the pool by
  // die type is multiclass-aware (PHB 2024 "Multiclassing: Hit Points").
  const hdTotal = hitDiceTotal(character);
  const hdSpent = Math.min(character.hitDiceSpent ?? 0, hdTotal);
  const hdRemaining = hdTotal - hdSpent;
  const hdBreakdown: Breakdown = {
    total: hdRemaining,
    components: [
      { label: 'Hit Dice total (character level)', value: hdTotal },
      { label: 'Spent', value: -hdSpent },
    ],
  };
  const dieTypes = Object.entries(hitDiceByDieType(character))
    .map(([die, count]) => ({ die: Number(die), count: count ?? 0 }))
    .sort((a, b) => b.die - a.die);

  const combatLink = { href: '#combat', text: 'manage on Combat' };

  return (
    <Card>
      <SectionHeader icon={Activity} title="Vitals" />
      <div className={styles.grid} role="group" aria-label="Vitals">
        <Tile
          label="Level"
          testId="vital-level"
          manage={{ href: '#advancement', text: 'Level up on Advancement' }}
        >
          {character.level}
        </Tile>
        <Tile label="Armor Class" manage={combatLink}>
          <CalculatedValue label="Armor Class" breakdown={ac} />
        </Tile>
        <Tile
          label="Hit Points"
          manage={combatLink}
          testId="vital-hp"
          sub={
            <>
              {tempHp > 0 && (
                <span className={styles.sub}>
                  Temp HP{' '}
                  <CalculatedValue
                    label="Temporary Hit Points"
                    breakdown={{
                      total: tempHp,
                      components: [{ label: 'Temporary Hit Points', value: tempHp }],
                    }}
                  />
                </span>
              )}
              {isBloodied(character) && <span className={styles.bloodied}>Bloodied</span>}
              <span className={styles.sub}>
                Max set on <a className={styles.manage} href="#advancement">Advancement</a>
              </span>
            </>
          }
        >
          {hasHpMax ? (
            <>
              {currentBd && currentHp !== undefined ? (
                <CalculatedValue label="Current Hit Points" breakdown={currentBd} />
              ) : (
                currentHp
              )}
              {' / '}
              <CalculatedValue label="Hit Point Maximum" breakdown={hpMax} />
            </>
          ) : (
            '—'
          )}
        </Tile>
        <Tile label="Initiative" manage={combatLink}>
          <CalculatedValue label="Initiative" breakdown={initiative}>
            {formatSigned(initiative.total)}
          </CalculatedValue>
        </Tile>
        <Tile label="Speed">
          <CalculatedValue label="Speed" breakdown={speed}>
            {speed.total} ft
          </CalculatedValue>
        </Tile>
        <Tile label="Passive Perception">
          <CalculatedValue label="Passive Perception" breakdown={passivePerception} />
        </Tile>
        <Tile label="Proficiency Bonus">
          <CalculatedValue label="Proficiency Bonus" breakdown={proficiency}>
            {formatSigned(proficiency.total)}
          </CalculatedValue>
        </Tile>
        <Tile label="Darkvision">
          <CalculatedValue label="Darkvision" breakdown={darkvision}>
            {darkvision.total > 0 ? `${darkvision.total} ft` : 'None'}
          </CalculatedValue>
        </Tile>
        <Tile
          label="Hit Dice"
          manage={combatLink}
          testId="vital-hit-dice"
          sub={
            dieTypes.length > 0 ? (
              <span className={styles.sub}>
                {dieTypes.map(({ die, count }) => `${count}d${die}`).join(' + ')}
              </span>
            ) : undefined
          }
        >
          <CalculatedValue label="Hit Dice remaining" breakdown={hdBreakdown}>
            {hdRemaining} / {hdTotal}
          </CalculatedValue>
        </Tile>
      </div>
    </Card>
  );
}
