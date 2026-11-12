import { useState } from 'react';
import { Swords } from 'lucide-react';
import type { Character } from '../../types/character';
import { characterInitiativeModifier, initiativeRollMode } from '../../logic/initiative-roll';
import { exhaustionLevelOf } from '../../logic/conditions';
import { initiativeBreakdown } from '../../logic/initiative';
import { effectiveAbilityScores } from '../../logic/feats';
import { formatSigned } from '../../logic/breakdown';
import { CalculatedValue } from '../shared/CalculatedValue';
import {
  beginFight,
  currentRound,
  endFight,
  initiativeResult,
  isInFight,
  nextRound,
  recordInitiative,
} from '../../logic/combat-round';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { RollPrompt, type RollPromptResult } from '../shared/RollPrompt';
import styles from './CombatRoundCard.module.css';

export interface CombatRoundCardProps {
  character: Character;
  onChange: (next: Character) => void;
}

const SOURCE_LABEL = {
  surprised: 'Surprised',
  incapacitated: 'Incapacitated',
  invisible: 'Invisible',
  manual: 'Manual',
} as const;

/**
 * The fight controls for the Combat page. The player resolves the fight at the
 * table, so this tracks only a round counter and the player's own Initiative:
 * "Next round" adds 1 to the round and counts down every timed condition and
 * effect; "Roll initiative" rolls through the shared RollPrompt (manual dice are
 * supported) and keeps the result. It never runs turns or an initiative order.
 */
export function CombatRoundCard({ character, onChange }: CombatRoundCardProps) {
  const [rolling, setRolling] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [status, setStatus] = useState('');

  const inFight = isInFight(character);
  const round = currentRound(character);
  const initiative = initiativeResult(character);
  const initMod = characterInitiativeModifier(character);
  const modeInfo = initiativeRollMode(character);
  const initDisplay = initiativeBreakdown(
    effectiveAbilityScores(character),
    character.initiativeBonus,
    exhaustionLevelOf(character),
  );

  const handleNextRound = () => {
    const r = nextRound(character);
    onChange(r.character);
    setStatus(
      r.expired.length > 0
        ? `Round ${r.round}. Ended: ${r.expired.join(', ')}.`
        : `Round ${r.round}.`,
    );
  };

  const handleInitiative = (result: RollPromptResult) => {
    setRolling(false);
    onChange(recordInitiative(character, result.total));
    setStatus(`Initiative ${result.total}.`);
  };

  const sources = [
    ...modeInfo.advantageFrom.map((s) => `Advantage: ${SOURCE_LABEL[s]}`),
    ...modeInfo.disadvantageFrom.map((s) => `Disadvantage: ${SOURCE_LABEL[s]}`),
  ];

  return (
    <Card>
      <SectionHeader icon={Swords} title="Fight" />
      <div className={styles.row}>
        <div className={styles.block}>
          <span className={styles.label}>Round</span>
          <span className={styles.big} data-testid="round-number">
            {inFight ? round : '-'}
          </span>
        </div>
        <div className={styles.block}>
          <span className={styles.label}>Initiative</span>
          <span className={styles.big} data-testid="initiative-result">
            {initiative !== undefined ? initiative : '-'}
          </span>
          {/* The modifier to add when rolling physical dice. Exhaustion is a D20
              Test penalty (PHB 2024 L21024), so it shows here too. */}
          <span className={styles.label} data-testid="initiative-modifier">
            Mod{' '}
            <CalculatedValue label="Initiative" breakdown={initDisplay}>
              {formatSigned(initDisplay.total)}
            </CalculatedValue>
          </span>
        </div>
        <div className={styles.buttons}>
          {!inFight && (
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                onChange(beginFight(character));
                setStatus('Fight started. Round 1.');
              }}
            >
              Start fight
            </button>
          )}
          {inFight && (
            <button type="button" className={styles.primary} onClick={handleNextRound}>
              Next round
            </button>
          )}
          <button type="button" className={styles.secondary} onClick={() => setRolling(true)}>
            Roll initiative
          </button>
          {inFight && (
            <button type="button" className={styles.secondary} onClick={() => setConfirmEnd(true)}>
              End fight
            </button>
          )}
        </div>
      </div>
      <p className={styles.hint}>
        {inFight
          ? 'Next round counts down every timed condition and effect.'
          : 'Start a fight to count rounds. Rolling initiative starts one too.'}
      </p>
      <p className={styles.status} role="status" aria-live="polite" data-testid="round-status">
        {status}
      </p>

      {rolling && (
        <RollPrompt
          title="Initiative"
          exhaustionLevel={exhaustionLevelOf(character)}
          modifiers={initMod.components}
          initialMode={modeInfo.mode}
          hint="Dexterity check to decide the order of the fight."
          notice={sources.length > 0 ? sources.join('; ') : undefined}
          confirmLabel="Keep result"
          onResolve={handleInitiative}
          onClose={() => setRolling(false)}
        />
      )}
      {confirmEnd && (
        <ConfirmDialog
          message="End the fight? The round counter and your initiative result are cleared. Timers on conditions and effects keep their values."
          confirmLabel="End fight"
          onConfirm={() => {
            setConfirmEnd(false);
            onChange(endFight(character));
            setStatus('Fight ended.');
          }}
          onCancel={() => setConfirmEnd(false)}
        />
      )}
    </Card>
  );
}
