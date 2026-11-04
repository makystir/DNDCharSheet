import { useRef, useState } from 'react';
import { Footprints } from 'lucide-react';
import type { Character } from '../../types/character';
import { getSpell } from '../../data/spells';
import { speedBreakdown } from '../../logic/species';
import { isCharacterTurn } from '../../logic/initiative-order';
import {
  applyCharacterTurnEvent,
  movementAllowanceBreakdown,
  remainingMovementBreakdown,
  shouldPromptDeathSaveFor,
  turnContextOf,
  type TurnEvent,
  type TurnWarning,
} from '../../logic/turn-economy';
import { resolveTurnRuleTooltip } from '../../logic/tooltip-content';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import styles from './Initiative.module.css';

export interface TurnPanelProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Starts the existing Death Saves roll flow (A5a); the panel never rolls itself. */
  onRollDeathSave: () => void;
}

/** Advisory wording for each warning. Formatting only: the logic raised the warning. */
const WARNING_TEXT: Record<TurnWarning, string> = {
  'action-already-used':
    'You have already used your action this turn. A feature may grant another, so this is only a reminder.',
  'bonus-already-used':
    'You have already used your Bonus Action this turn. You can take only one unless a feature says otherwise.',
  'reaction-already-used':
    'You have already used your Reaction. It returns at the start of your next turn.',
  'interaction-needs-utilize':
    'You have already interacted with an object for free this turn. A second object needs the Utilize action.',
  'over-speed': 'That move is more than your movement allowance this turn. Take the Dash action for more.',
  incapacitated:
    'You are Incapacitated: you cannot take actions, Bonus Actions or Reactions. Moving is still allowed.',
};

interface ChipSpec {
  event: TurnEvent;
  label: string;
  tipKey: string | null;
  used: boolean;
}

/**
 * The character's own turn (Stage A5c): Action, Bonus Action, Reaction and free
 * object interaction chips, a movement readout with Dash and a "Move N ft"
 * input, advisory warnings, the start-of-turn Death Save banner and a gentle
 * Concentration reminder. Renders only while in combat.
 *
 * Presentation parity: the PWA's GuidedTurnPanel is not ported yet (phased), so
 * this panel has no PWA twin; its chips follow the HP card's chip look and the
 * card/tooltip components are the shared ones. Warnings are advisory and never
 * block. Every rule lives in logic/turn-economy.ts (applyCharacterTurnEvent,
 * movement Breakdowns, shouldPromptDeathSaveFor).
 */
export function TurnPanel({ character, onChange, onRollDeathSave }: TurnPanelProps) {
  const [warnings, setWarnings] = useState<TurnWarning[]>([]);
  const [moveInput, setMoveInput] = useState('');
  const [moveError, setMoveError] = useState('');
  // Turn + Death Save record when the prompt was requested. The banner stays mounted
  // (so focus returns to its button) until the record changes, i.e. the save resolved.
  const [requested, setRequested] = useState<{ turnKey: string; record: string } | null>(null);
  const moveRef = useRef<HTMLInputElement>(null);

  const combat = character.combat;
  if (!combat) return null;

  const turn = combat.turn;
  const ownTurn = isCharacterTurn(combat);
  const turnKey = `${combat.round}:${combat.activeIndex}`;
  const deathRecord = JSON.stringify(character.deathSaves ?? null);
  const resolvedThisTurn = requested !== null && requested.turnKey === turnKey && requested.record !== deathRecord;
  const promptDeathSave = shouldPromptDeathSaveFor(character) && !resolvedThisTurn;
  const spellId = character.concentration?.spellId;
  const speed = speedBreakdown(character);
  const context = turnContextOf(character);
  const allowance = movementAllowanceBreakdown(context.speed, turn.dashes);
  const remaining = remainingMovementBreakdown(context.speed, turn);
  const dashTip = resolveTurnRuleTooltip('dash');

  const apply = (event: TurnEvent) => {
    const out = applyCharacterTurnEvent(character, event);
    onChange(out.character);
    setWarnings(out.warnings);
  };

  const handleMove = () => {
    const feet = Number(moveInput);
    if (moveInput.trim() === '' || !Number.isInteger(feet) || feet < 1) {
      setMoveError('Enter a whole number of feet, 1 or more.');
      return;
    }
    setMoveError('');
    apply(`move:${feet}`);
    setMoveInput('');
    moveRef.current?.focus();
  };

  const handleDeathSave = () => {
    setRequested({ turnKey, record: deathRecord });
    onRollDeathSave();
  };

  const chips: ChipSpec[] = [
    { event: 'action', label: 'Action', tipKey: 'action', used: turn.actionUsed },
    { event: 'bonus', label: 'Bonus Action', tipKey: 'bonus-action', used: turn.bonusUsed },
    { event: 'reaction', label: 'Reaction', tipKey: 'reaction', used: turn.reactionUsed },
    { event: 'interact', label: 'Free object interaction', tipKey: null, used: turn.objectInteractionUsed },
  ];

  return (
    <Card>
      <div className={styles.stack}>
        <SectionHeader icon={Footprints} title="My Turn" />

        {promptDeathSave && (
          <div className={styles.banner} role="alert" data-testid="death-save-banner">
            <p className={styles.bannerText}>
              Your turn has started at 0 Hit Points. Make a Death Saving Throw.
            </p>
            <button type="button" className={styles.primaryBtn} onClick={handleDeathSave}>
              Make Death Saving Throw
            </button>
          </div>
        )}

        {ownTurn && spellId && (
          <p className={styles.reminder} data-testid="concentration-reminder">
            You are concentrating on {getSpell(spellId)?.name ?? spellId}.
          </p>
        )}

        <p className={styles.hint}>
          {ownTurn
            ? 'It is your turn.'
            : 'It is not your turn. You can still record a Reaction.'}{' '}
          Your turn starts automatically when the tracker reaches your entry.
        </p>

        <div className={styles.chipGrid}>
          {chips.map((chip) => {
            const tip = chip.tipKey ? resolveTurnRuleTooltip(chip.tipKey) : null;
            return (
              <div key={chip.event} className={chip.used ? styles.chipUsed : styles.chip}>
                {tip ? <ContentTooltip content={tip}>{chip.label}</ContentTooltip> : <span>{chip.label}</span>}
                <button
                  type="button"
                  className={styles.chipBtn}
                  aria-pressed={chip.used}
                  aria-label={`${chip.label}: ${chip.used ? 'used' : 'available'}`}
                  onClick={() => apply(chip.event)}
                >
                  {chip.used ? 'Used' : 'Use'}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.movement}>
          <span className={styles.stat}>
            <span className={styles.label}>Speed</span>
            <span className={styles.statValue}>
              <CalculatedValue label="Speed" breakdown={speed}>
                {speed.total} ft
              </CalculatedValue>
            </span>
          </span>
          <span className={styles.stat}>
            <span className={styles.label}>Used</span>
            <span className={styles.statValue} data-testid="movement-used">
              <CalculatedValue
                label="Movement used"
                breakdown={{
                  total: turn.movementUsed,
                  components: [{ label: 'Move entries since your turn started', value: turn.movementUsed }],
                  note: 'Only the running total is stored. Start my turn resets it to 0.',
                }}
              >
                {turn.movementUsed} ft
              </CalculatedValue>
            </span>
          </span>
          <span className={styles.stat}>
            <span className={styles.label}>Allowance</span>
            <span className={styles.statValue}>
              <CalculatedValue label="Movement allowance" breakdown={allowance}>
                {allowance.total} ft
              </CalculatedValue>
            </span>
          </span>
          <span className={styles.stat}>
            <span className={styles.label}>Remaining</span>
            <span className={styles.statValue}>
              <CalculatedValue label="Movement remaining" breakdown={remaining}>
                {remaining.total} ft
              </CalculatedValue>
            </span>
          </span>
        </div>

        <div className={styles.addForm}>
          <div className={`${styles.field} ${styles.fieldInit}`}>
            <label className={styles.label} htmlFor="turn-move-feet">
              Move (ft)
            </label>
            <input
              id="turn-move-feet"
              ref={moveRef}
              type="number"
              min={1}
              className={styles.input}
              placeholder="ft"
              value={moveInput}
              onChange={(e) => setMoveInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleMove();
              }}
            />
          </div>
          <button type="button" className={styles.actionBtn} onClick={handleMove}>
            Move
          </button>
          <button type="button" className={styles.actionBtn} onClick={() => apply('dash')}>
            Dash
          </button>
          {dashTip && <ContentTooltip content={dashTip}>About Dash</ContentTooltip>}
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => apply('start-turn')}
            disabled={!ownTurn}
          >
            Start my turn
          </button>
        </div>
        {moveError && (
          <p className={styles.note} role="alert">
            {moveError}
          </p>
        )}
        <p className={styles.hint}>
          Start my turn clears this turn&apos;s Action, Bonus Action, Reaction and movement. It also happens on
          its own when the tracker reaches you.
        </p>

        <div className={styles.warningBox} role="status" aria-live="polite" data-testid="turn-warnings">
          {warnings.length > 0 && (
            <ul className={styles.warningList}>
              {warnings.map((w) => (
                <li key={w} className={styles.warningItem}>
                  {WARNING_TEXT[w]}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
