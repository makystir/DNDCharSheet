import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp, Dices, Timer, X } from 'lucide-react';
import type { Character } from '../../types/character';
import { exhaustionLevelOf } from '../../logic/conditions';
import {
  activeCombatant,
  addCombatant,
  advanceTurn,
  canMoveWithinTie,
  endCombat,
  moveCombatant,
  removeCombatant,
  startCombat,
} from '../../logic/initiative-order';
import {
  characterInitiativeModifier,
  initiativeRoll,
  initiativeRollMode,
  type InitiativeModeResult,
  type InitiativeRoll,
  type InitiativeSource,
} from '../../logic/initiative-roll';
import { resolveTurnRuleTooltip } from '../../logic/tooltip-content';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { RollPrompt, type RollPromptResult } from '../shared/RollPrompt';
import styles from './Initiative.module.css';

export interface InitiativeTrackerProps {
  character: Character;
  onChange: (next: Character) => void;
}

type ManualMode = 'none' | 'advantage' | 'disadvantage';

const SOURCE_LABEL: Record<InitiativeSource, string> = {
  surprised: 'Surprised',
  incapacitated: 'Incapacitated',
  invisible: 'Invisible',
  manual: 'Manual selection',
};

const MODE_LABEL = { normal: 'Normal', advantage: 'Advantage', disadvantage: 'Disadvantage' } as const;

/** Focus an element inside `root` on the next frame (after React has committed). */
function focusSoon(root: HTMLElement | null, selector: string): void {
  requestAnimationFrame(() => root?.querySelector<HTMLElement>(selector)?.focus());
}

/** Names the sources of Advantage / Disadvantage. Formatting only: the logic decided the mode. */
function ModeSources({ result }: { result: InitiativeModeResult }) {
  const both = result.advantageFrom.length > 0 && result.disadvantageFrom.length > 0;
  const names = (list: InitiativeSource[]) => list.map((s) => SOURCE_LABEL[s]).join(', ');
  return (
    <p className={styles.sources} data-testid="initiative-sources">
      <span>
        Initiative roll: <strong>{MODE_LABEL[result.mode]}</strong>
        {both ? ' (Advantage and Disadvantage cancel out)' : ''}
      </span>
      <span>Advantage from: {result.advantageFrom.length > 0 ? names(result.advantageFrom) : 'none'}</span>
      <span>Disadvantage from: {result.disadvantageFrom.length > 0 ? names(result.disadvantageFrom) : 'none'}</span>
    </p>
  );
}

/**
 * Initiative tracker for the Combat tab (Stage A5c). Mirrors PWACharSheet's
 * InitiativeTracker: Start / End Combat, an add-combatant row (name +
 * Initiative count), a roll button whose result is placed in the form for the
 * user to confirm before it is committed, a roster in Initiative order with the
 * active combatant highlighted, Next / Previous turn and per-row remove.
 * Deviations from the PWA: a vertical roster (it also carries tie arrows and a
 * "you" mark), a round counter, Previous turn, a Surprised toggle and manual
 * Advantage / Disadvantage selector with the sources named, and no event log
 * (B7). The roll opens the shared RollPrompt (d20 Dexterity check, D1 Exhaustion
 * line) instead of the PWA's immediate d100 formula roll.
 *
 * Every rule (sorting, ties, turn and round advance, roster edits, roll mode
 * and total) lives in logic/initiative-order.ts and logic/initiative-roll.ts.
 */
export function InitiativeTracker({ character, onChange }: InitiativeTrackerProps) {
  const combat = character.combat;
  const rootRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [initiative, setInitiative] = useState('');
  // The pending entry is the character's own (set by the roll button).
  const [mine, setMine] = useState(false);
  const [lastRoll, setLastRoll] = useState<InitiativeRoll | null>(null);
  const [rolling, setRolling] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [surprised, setSurprised] = useState(false);
  const [manual, setManual] = useState<ManualMode>('none');
  const [status, setStatus] = useState('');

  const initTip = resolveTurnRuleTooltip('initiative');
  const surpriseTip = resolveTurnRuleTooltip('surprise');

  const modeResult = initiativeRollMode(character, {
    surprised,
    manualAdvantage: manual === 'advantage',
    manualDisadvantage: manual === 'disadvantage',
  });

  const parsedInitiative = initiative.trim() === '' ? NaN : Number(initiative);
  const formValid = name.trim() !== '' && Number.isInteger(parsedInitiative);
  const hasOwnEntry = combat?.combatants.some((c) => c.isCharacter === true) ?? false;

  const commit = (next: Character, message: string) => {
    onChange(next);
    setStatus(message);
  };

  const resetForm = () => {
    setName('');
    setInitiative('');
    setMine(false);
    setLastRoll(null);
  };

  const handleStart = () => {
    commit(startCombat(character, []), 'Combat started. Round 1. Add combatants to the roster.');
    focusSoon(rootRef.current, '[data-focus="name"]');
  };

  const handleEnd = () => {
    setConfirmEnd(false);
    commit(endCombat(character), 'Combat ended.');
    resetForm();
    focusSoon(rootRef.current, '[data-focus="start"]');
  };

  const handleAdd = () => {
    if (!combat || !formValid) return;
    const entry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      initiative: parsedInitiative,
      ...(mine && !hasOwnEntry ? { isCharacter: true } : {}),
    };
    const next = addCombatant(combat, entry);
    if (next === combat) return;
    commit({ ...character, combat: next }, `Added ${entry.name} at Initiative ${entry.initiative}.`);
    resetForm();
    focusSoon(rootRef.current, '[data-focus="name"]');
  };

  const handleRolled = (result: RollPromptResult) => {
    setRolling(false);
    const roll = initiativeRoll(
      result.rolls,
      result.mode,
      characterInitiativeModifier(character),
      exhaustionLevelOf(character),
    );
    setInitiative(String(roll.total));
    if (name.trim() === '') setName(character.name);
    setMine(true);
    setLastRoll(roll);
    setStatus(`Rolled Initiative ${roll.total}. Review it, then choose Add to roster to confirm.`);
    focusSoon(rootRef.current, '[data-focus="add"]');
  };

  const handleAdvance = (direction: 'next' | 'previous') => {
    if (!combat) return;
    const next = advanceTurn(combat, direction);
    if (next === combat) return;
    const who = activeCombatant(next);
    commit(
      { ...character, combat: next },
      `Round ${next.round}. ${who ? `${who.name}'s turn.` : 'No combatants.'}`,
    );
  };

  const handleRemove = (id: string, label: string) => {
    if (!combat) return;
    const next = removeCombatant(combat, id);
    if (next === combat) return;
    commit({ ...character, combat: next }, `Removed ${label}.`);
    // The row's button unmounts, so hand focus to the roster's status region.
    requestAnimationFrame(() => statusRef.current?.focus());
  };

  const handleMove = (id: string, label: string, direction: 'up' | 'down') => {
    if (!combat) return;
    const next = moveCombatant(combat, id, direction);
    if (next === combat) return;
    commit(
      { ...character, combat: next },
      `Moved ${label} ${direction} within its tie.`,
    );
    // Keep focus on the same arrow if it can still be used, else the other one.
    const other = direction === 'up' ? 'down' : 'up';
    const moved = next.combatants.find((c) => c.id === id);
    const stillMovable = moved ? canMoveWithinTie(next.combatants, id, direction) : false;
    focusSoon(
      rootRef.current,
      `[data-move="${id}-${stillMovable ? direction : other}"]:not(:disabled)`,
    );
  };

  const previousBlocked = combat ? advanceTurn(combat, 'previous') === combat : true;
  const nextBlocked = combat ? advanceTurn(combat, 'next') === combat : true;

  const titleNode: ReactNode = initTip ? (
    <ContentTooltip content={initTip}>Turn order</ContentTooltip>
  ) : (
    'Turn order'
  );

  return (
    <Card>
      <div ref={rootRef} className={styles.stack}>
        <div
          ref={statusRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className={styles.srOnly}
          data-testid="initiative-status"
        >
          {status}
        </div>
        <SectionHeader icon={Timer} title={titleNode} />

        {!combat && (
          <>
            <p className={styles.hint}>
              Not in combat. Start combat, then add the combatants and roll your own Initiative.
            </p>
            <div className={styles.btnRow}>
              <button type="button" className={styles.primaryBtn} data-focus="start" onClick={handleStart}>
                Start Combat
              </button>
            </div>
          </>
        )}

        {combat && (
          <>
            <div className={styles.headerRow}>
              <span className={styles.round} data-testid="initiative-round">
                Round {combat.round}
              </span>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={() => handleAdvance('previous')}
                disabled={previousBlocked}
              >
                Previous Turn
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => handleAdvance('next')}
                disabled={nextBlocked}
              >
                Next Turn
              </button>
              <button type="button" className={styles.ghostBtn} onClick={() => setConfirmEnd(true)}>
                End Combat
              </button>
            </div>

            {combat.combatants.length === 0 ? (
              <p className={styles.hint}>The roster is empty. Add a combatant below.</p>
            ) : (
              <ol className={styles.rosterList} aria-label="Initiative order" tabIndex={-1}>
                {combat.combatants.map((c, index) => {
                  const active = index === combat.activeIndex;
                  const own = c.isCharacter === true;
                  return (
                    <li
                      key={c.id}
                      className={active ? styles.rowActive : styles.row}
                      aria-current={active ? 'true' : undefined}
                      data-testid={`combatant-${c.name}`}
                    >
                      <span className={styles.count} aria-label={`Initiative ${c.initiative}`}>
                        {c.initiative}
                      </span>
                      <span className={styles.name}>{c.name}</span>
                      {own && <span className={styles.tag}>You</span>}
                      {active && <span className={styles.tagActive}>Active turn</span>}
                      <span className={styles.rowControls}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          data-move={`${c.id}-up`}
                          aria-label={`Move ${c.name} up within its tie`}
                          disabled={!canMoveWithinTie(combat.combatants, c.id, 'up')}
                          onClick={() => handleMove(c.id, c.name, 'up')}
                        >
                          <ChevronUp size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          data-move={`${c.id}-down`}
                          aria-label={`Move ${c.name} down within its tie`}
                          disabled={!canMoveWithinTie(combat.combatants, c.id, 'down')}
                          onClick={() => handleMove(c.id, c.name, 'down')}
                        >
                          <ChevronDown size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.removeBtn}`}
                          aria-label={`Remove ${c.name}`}
                          onClick={() => handleRemove(c.id, c.name)}
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className={styles.hint}>
              Ties are never broken for you: the players decide ties between characters, and the DM decides ties
              between monsters or with a character. The up and down arrows are only enabled between combatants with
              the same Initiative.
            </p>

            <div className={styles.addForm}>
              <div className={`${styles.field} ${styles.fieldName}`}>
                <label className={styles.label} htmlFor="initiative-name">
                  Name
                </label>
                <input
                  id="initiative-name"
                  type="text"
                  className={styles.input}
                  data-focus="name"
                  placeholder="e.g. Goblin #1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                  }}
                />
              </div>
              <div className={`${styles.field} ${styles.fieldInit}`}>
                <label className={styles.label} htmlFor="initiative-count">
                  Init
                </label>
                <input
                  id="initiative-count"
                  type="number"
                  className={styles.input}
                  placeholder="Init"
                  value={initiative}
                  onChange={(e) => {
                    setInitiative(e.target.value);
                    // A manual edit invalidates the roll breakdown.
                    setLastRoll(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                  }}
                />
              </div>
              <button
                type="button"
                className={styles.primaryBtn}
                data-focus="add"
                onClick={handleAdd}
                disabled={!formValid}
              >
                Add to roster
              </button>
            </div>

            {lastRoll && (
              <div className={styles.rolledRow}>
                <span className={styles.label}>Rolled</span>
                <CalculatedValue label="Initiative roll" breakdown={lastRoll.breakdown} />
                <span>Edit it if needed, then add it to the roster.</span>
              </div>
            )}

            <fieldset className={styles.options}>
              <legend>Your Initiative roll</legend>
              <div className={styles.optionRow}>
                <label className={styles.optionLabel}>
                  <input type="checkbox" checked={surprised} onChange={(e) => setSurprised(e.target.checked)} />
                  Surprised
                </label>
                {surpriseTip && <ContentTooltip content={surpriseTip}>About Surprise</ContentTooltip>}
              </div>
              <div role="radiogroup" aria-label="Manual Advantage or Disadvantage" className={styles.optionRow}>
                {(['none', 'advantage', 'disadvantage'] as const).map((value) => (
                  <label key={value} className={styles.optionLabel}>
                    <input
                      type="radio"
                      name="initiative-manual"
                      value={value}
                      checked={manual === value}
                      onChange={() => setManual(value)}
                    />
                    {value === 'none' ? 'No manual effect' : MODE_LABEL[value]}
                  </label>
                ))}
              </div>
              <ModeSources result={modeResult} />
              <div className={styles.btnRow}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setRolling(true)}
                  disabled={hasOwnEntry}
                >
                  <Dices size={16} aria-hidden="true" /> Roll my Initiative
                </button>
              </div>
              {hasOwnEntry && (
                <p className={styles.hint}>You are already on the roster. Remove your entry to roll again.</p>
              )}
            </fieldset>
          </>
        )}

        {rolling && (
          <RollPrompt
            title="Initiative"
            hint="A Dexterity check. The total is your Initiative count."
            notice={<ModeSources result={modeResult} />}
            initialMode={modeResult.mode}
            exhaustionLevel={exhaustionLevelOf(character)}
            modifiers={characterInitiativeModifier(character).components}
            confirmLabel="Use this Initiative"
            onResolve={handleRolled}
            onClose={() => setRolling(false)}
          />
        )}

        {confirmEnd && (
          <ConfirmDialog
            message="End combat? The Initiative roster and turn tracking will be cleared."
            confirmLabel="End Combat"
            onConfirm={handleEnd}
            onCancel={() => setConfirmEnd(false)}
          />
        )}
      </div>
    </Card>
  );
}
