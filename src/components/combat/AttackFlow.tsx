import { useEffect, useId, useRef, useState } from 'react';
import { Swords, X } from 'lucide-react';
import type { Character } from '../../types/character';
import { formatSigned } from '../../logic/breakdown';
import {
  doubleDice,
  equippedWeapons,
  fireAmmo,
  resolveAttack,
  rollWeaponDamage,
  type AttackKind,
  type AttackResolution,
  type AttackResult,
} from '../../logic/attacks';
import {
  UNARMED_ATTACK_ID,
  attackSourceList,
  buildAttackPlan,
  damageOutcome,
  diceRange,
  lightExtraOptions,
  parseTargetAc,
  recordAttackEvent,
  resolveSelectedMode,
  targetCover,
  type AttackSource,
  type AttackTarget,
  type CoverChoice,
  type DamageOutcome,
} from '../../logic/attack-flow';
import { grazeDamage, isInformationalMastery, itemMasteryStatus, toppleDc } from '../../logic/weapon-mastery';
import { proficiencyBonus } from '../../logic/abilities';
import { TURN_WARNING_TEXT, type TurnWarning } from '../../logic/turn-economy';
import { resolveAttackRuleTooltip, resolveWeaponMasteryTooltip } from '../../logic/tooltip-content';
import { createDefaultRng, type RNG } from '../../logic/random';
import { getDiceEntryMode, type DiceEntryMode } from '../../hooks/useDiceEntryMode';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import { RollPrompt, type RollPromptResult } from '../shared/RollPrompt';
import { StepIndicator } from './StepIndicator';
import styles from './AttackFlow.module.css';

export interface AttackFlowProps {
  character: Character;
  onChange: (next: Character) => void;
  /** The weapon the Attack button was pressed on: an inventory item id or `UNARMED_ATTACK_ID`. */
  weaponId: string;
  onClose: () => void;
  /** The last-used ad-hoc target. The host keeps it so it survives closing the flow. */
  target: AttackTarget;
  onTargetChange: (next: AttackTarget) => void;
  /** Ammunition fired this fight, by inventory item id (shared with the Ammunition tracker). */
  ammoUsed: Record<string, number>;
  onAmmoUsedChange: (next: Record<string, number>) => void;
  /** Override the persisted dice-entry preference (mainly for tests). */
  diceEntryMode?: DiceEntryMode;
  /** Override the random source (mainly for tests). */
  rng?: RNG;
}

const STEPS = ['Weapon', 'Roll', 'Damage', 'Result'];
const STEP_WEAPON = 0;
const STEP_ROLL = 1;
const STEP_DAMAGE = 2;
const STEP_RESULT = 3;

const COVER_OPTIONS: { value: CoverChoice; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'half', label: 'Half (+2 AC)' },
  { value: 'three-quarters', label: 'Three-Quarters (+5 AC)' },
  { value: 'total', label: 'Total (cannot be targeted)' },
];

const OUTCOME_LABEL: Record<AttackResult, string> = {
  'critical-hit': 'Critical Hit',
  hit: 'Hit',
  miss: 'Miss',
};

const KIND_LABEL: Record<AttackKind, string> = {
  normal: 'Attack',
  'light-extra': 'Light extra attack (Bonus Action)',
  cleave: 'Cleave attack',
};

const parseDistance = (raw: string): number | undefined => {
  if (!/^\s*\d+\s*$/.test(raw)) return undefined;
  return Number.parseInt(raw, 10);
};

/**
 * The guided Attack Flow (Stage A5d), a modal dialog with four steps: Weapon, Roll,
 * Damage, Result. Structure ported from PWACharSheet's AttackFlow (a StepIndicator over
 * weapon pick, roll, damage and result) and its ad-hoc Combat_Target idea (an opponent
 * descriptor that is typed in and remembered, here an Armor Class and a degree of cover).
 * Deviations: no WFRP rules (no hit location, Success Levels, Advantage accumulation or
 * Toughness/Armour), it is a dialog rather than an inline panel, and the d20 goes through
 * the shared RollPrompt.
 *
 * No rule lives here. The attack numbers, cover, Advantage / Disadvantage sources, the
 * judgement of the roll, damage, Graze / Topple, the Light extra attack, ammunition and
 * the turn events all come from logic/attacks.ts, attack-flow.ts, weapon-mastery.ts and
 * turn-economy.ts. Suggestions for Advantage / Disadvantage are toggles the player ticks;
 * nothing is applied automatically.
 *
 * The turn events are advisory: the Attack action records one "action" event when the
 * first attack roll is made, and the Light extra attack records a "bonus" event (unless
 * made through Nick), only while a combat is running.
 */
export function AttackFlow({
  character,
  onChange,
  weaponId: initialWeaponId,
  onClose,
  target,
  onTargetChange,
  ammoUsed,
  onAmmoUsedChange,
  diceEntryMode,
  rng,
}: AttackFlowProps) {
  const [entryMode] = useState<DiceEntryMode>(() => diceEntryMode ?? getDiceEntryMode());
  const [source] = useState<RNG>(() => rng ?? createDefaultRng());
  const isManual = entryMode === 'manual';

  // Pass state: one pass is one attack (the first attack, a Cleave or Light extra attack,
  // or another attack in the same Attack action).
  const [weaponId, setWeaponId] = useState(initialWeaponId);
  const [kind, setKind] = useState<AttackKind>('normal');
  const [step, setStep] = useState(STEP_WEAPON);
  const [passKey, setPassKey] = useState(0);
  const [twoHanded, setTwoHanded] = useState(false);
  const [thrown, setThrown] = useState(false);
  const [abilityChoice, setAbilityChoice] = useState<'auto' | 'str' | 'dex'>('auto');
  const [distance, setDistance] = useState('');
  const [hostileAdjacent, setHostileAdjacent] = useState(false);
  const [targetUnseen, setTargetUnseen] = useState(false);
  const [attackerUnseen, setAttackerUnseen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [acText, setAcText] = useState(target.ac === undefined ? '' : String(target.ac));
  const [rolling, setRolling] = useState(false);
  const [attack, setAttack] = useState<AttackResolution | null>(null);
  const [damage, setDamage] = useState<DamageOutcome | null>(null);
  const [damageRolls, setDamageRolls] = useState<number[]>([]);
  const [manualDamage, setManualDamage] = useState('');
  const [damageError, setDamageError] = useState('');
  const [copied, setCopied] = useState('');

  // Session state: one dialog is one Attack action.
  const [actionRecorded, setActionRecorded] = useState(false);
  const [cleaveUsed, setCleaveUsed] = useState(false);
  const [nick, setNick] = useState(false);
  const [offHandId, setOffHandId] = useState('');
  const [warnings, setWarnings] = useState<TurnWarning[]>([]);
  const [announce, setAnnounce] = useState('');
  const [ammoNote, setAmmoNote] = useState('');
  const [mainId, setMainId] = useState(initialWeaponId);

  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useFocusTrap(dialogRef, true);
  useBodyScrollLock(true);

  useEffect(() => {
    if (rolling) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, rolling]);

  const hasAttack = attack !== null;
  const hasDamage = damage !== null;
  // Focus management: when the step or the pass changes, move focus to the step heading.
  // (The first render is left to the focus trap, which focuses the first control and
  // returns focus to the Attack button when the dialog closes.)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step, passKey, hasAttack, hasDamage]);

  const weapons = equippedWeapons(character);
  const isLocked = kind !== 'normal';
  const plan = buildAttackPlan(character, weaponId, {
    abilityChoice: abilityChoice === 'auto' ? undefined : abilityChoice,
    twoHanded,
    thrown: kind === 'cleave' ? false : thrown,
    kind,
  });

  if (!plan) {
    return (
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div ref={dialogRef} className={styles.dialog}>
          <h2 id={titleId} className={styles.title}>
            Attack
          </h2>
          <p className={styles.note}>That weapon is no longer equipped.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const weapon = plan.weapon;
  const canThrow = weapon?.properties.includes('thrown') === true && kind !== 'cleave';
  const isThrown = canThrow && thrown;
  const canTwoHand = weapon?.properties.includes('versatile') === true && weapon.versatileDice !== undefined;
  const isFinesse = weapon?.properties.includes('finesse') === true;
  const rangedAttack = weapon?.range === 'ranged' || isThrown;

  const cover = targetCover(target);
  const sourceList = attackSourceList(character, plan, {
    distanceFt: rangedAttack ? parseDistance(distance) : undefined,
    hostileAdjacentSeesYou: rangedAttack ? hostileAdjacent : undefined,
    targetUnseen,
    attackerUnseen,
    thrown: isThrown,
  });
  const selectedIds = selected.filter((id) => sourceList.sources.some((s) => s.id === id));
  const mode = resolveSelectedMode(sourceList.sources, selectedIds);
  const ammoPreview = weapon ? fireAmmo(character, weapon) : undefined;
  const ammoBlocked = ammoPreview?.blocked === true;

  // Why the attack cannot be rolled yet (the logic decides; this only words it).
  const blockers: string[] = [];
  if (target.ac === undefined) blockers.push("Enter the target's Armor Class to continue.");
  if (cover && !cover.targetable) {
    blockers.push('Total Cover: the target cannot be targeted directly, so this attack cannot be made. Choose a different target or cover.');
  }
  if (sourceList.blocked) {
    blockers.push("The target is beyond the weapon's long range, so this attack cannot be made.");
  }
  if (ammoBlocked && weapon) {
    blockers.push(`No ${weapon.ammunitionType ?? 'ammunition'} left in your inventory, so this weapon cannot be fired.`);
  }
  const canRoll = blockers.length === 0 && cover?.effectiveAc !== undefined;

  const critical = attack?.result === 'critical-hit';
  const diceExpr = critical ? doubleDice(plan.damage.dice) : plan.damage.dice;
  const range = diceRange(diceExpr);

  // ── Handlers ──

  const startPass = (id: string, nextKind: AttackKind) => {
    setWeaponId(id);
    setKind(nextKind);
    setStep(STEP_WEAPON);
    setPassKey((k) => k + 1);
    setAttack(null);
    setDamage(null);
    setDamageRolls([]);
    setManualDamage('');
    setDamageError('');
    setCopied('');
    setTwoHanded(false);
    setThrown(false);
    setAbilityChoice('auto');
    setSelected([]);
    setRolling(false);
  };

  const setCover = (cover: CoverChoice) => onTargetChange({ ...target, cover });
  const setAc = (raw: string) => {
    setAcText(raw);
    onTargetChange({ ...target, ac: parseTargetAc(raw) });
  };
  const toggleSource = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleRollResolved = (result: RollPromptResult) => {
    setRolling(false);
    if (cover?.effectiveAc === undefined) return;
    const resolution = resolveAttack(result.rolls, result.mode, plan.attackBonus, plan.exhaustion, cover.effectiveAc);
    setAttack(resolution);

    // One change: spend the ammunition, then record the turn event(s). Events only while a
    // combat is running, and only advisory.
    let next = character;
    const notes: TurnWarning[] = [];
    let spentNote = '';
    if (kind === 'normal') setMainId(plan.id);
    if (weapon) {
      const fired = fireAmmo(next, weapon);
      if (fired.consumed && fired.ammoItemId) {
        next = fired.character;
        onAmmoUsedChange({ ...ammoUsed, [fired.ammoItemId]: (ammoUsed[fired.ammoItemId] ?? 0) + 1 });
        spentNote = ` One ${weapon.ammunitionType ?? 'piece of ammunition'} used, ${fired.remaining ?? 0} left.`;
      }
    }
    if (kind === 'normal' && !actionRecorded) {
      const recorded = recordAttackEvent(next, 'action');
      next = recorded.character;
      notes.push(...recorded.warnings);
      setActionRecorded(true);
    } else if (kind === 'light-extra' && !nick) {
      const recorded = recordAttackEvent(next, 'bonus');
      next = recorded.character;
      notes.push(...recorded.warnings);
    }
    if (next !== character) onChange(next);
    setAmmoNote(spentNote.trim());
    setWarnings(notes);
    setAnnounce(
      `${OUTCOME_LABEL[resolution.result]}. ${plan.name} attack total ${resolution.total} against Armor Class ${cover.effectiveAc}.${spentNote}`,
    );
  };

  const finishDamage = (rolledDice: string, diceTotal: number, rolls: number[]) => {
    const outcome = damageOutcome(plan.damage, rolledDice, diceTotal, critical);
    setDamage(outcome);
    setDamageRolls(rolls);
    setDamageError('');
    setAnnounce(
      `${plan.name} damage ${outcome.total} ${outcome.damageType}${outcome.critical ? ', Critical Hit, dice doubled' : ''}.`,
    );
  };

  const handleRollDamage = () => {
    if (range.count === 0) {
      finishDamage(diceExpr, range.min, []);
      return;
    }
    const rolled = rollWeaponDamage(plan.damage, critical, source);
    finishDamage(rolled.dice, rolled.diceTotal, rolled.rolls);
  };

  const handleManualDamage = () => {
    const raw = manualDamage.trim();
    const value = /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isInteger(value) || value < range.min || value > range.max) {
      setDamageError(`Enter the total of the ${diceExpr} dice, a whole number from ${range.min} to ${range.max}.`);
      return;
    }
    finishDamage(diceExpr, value, []);
  };

  const handleCopy = async () => {
    if (!damage) return;
    const text = `${damage.total} ${damage.damageType} damage from ${plan.name}${damage.critical ? ' (Critical Hit)' : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copied to the clipboard.');
    } catch {
      setCopied(`Copy is not available here. Damage: ${text}.`);
    }
  };

  // ── Step panels ──

  const ruleTip = (key: string, label: string) => {
    const content = resolveAttackRuleTooltip(key);
    return content ? (
      <ContentTooltip content={content} className={styles.tipTrigger}>
        {label}
      </ContentTooltip>
    ) : null;
  };

  const renderSource = (s: AttackSource) => (
    <label key={s.id} className={styles.check}>
      <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSource(s.id)} />
      <span>
        <span className={s.side === 'advantage' ? styles.tagAdv : styles.tagDis}>
          {s.side === 'advantage' ? 'Advantage' : 'Disadvantage'}
        </span>{' '}
        {s.label}
        {s.situational && <span className={styles.situational}> {s.situational}</span>}
      </span>
    </label>
  );

  const ruleSources = sourceList.sources.filter((s) => s.origin === 'rule' || s.origin === 'attacker-condition');
  const targetSources = sourceList.sources.filter((s) => s.origin === 'target-condition');
  const manualSources = sourceList.sources.filter((s) => s.origin === 'manual');

  const weaponStep = (
    <div className={styles.panel}>
      {isLocked && <p className={styles.kindBanner}>{KIND_LABEL[kind]}: pick the target for this attack.</p>}

      <label className={styles.field}>
        <span className={styles.label}>Weapon</span>
        <select
          className={styles.select}
          value={plan.id}
          disabled={isLocked}
          onChange={(e) => {
            setWeaponId(e.target.value);
            setTwoHanded(false);
            setThrown(false);
            setAbilityChoice('auto');
            setSelected([]);
          }}
        >
          {weapons.map((entry) => (
            <option key={entry.item.id} value={entry.item.id}>
              {entry.weapon.name}
            </option>
          ))}
          <option value={UNARMED_ATTACK_ID}>Unarmed Strike</option>
        </select>
      </label>

      <div className={styles.statRow}>
        <span className={styles.stat}>
          <span className={styles.label}>Attack bonus</span>
          <CalculatedValue label={`${plan.name} attack bonus`} breakdown={plan.attackBonus} className={styles.value}>
            {formatSigned(plan.attackBonus.total)}
          </CalculatedValue>
        </span>
        <span className={styles.stat}>
          <span className={styles.label}>Damage</span>
          <CalculatedValue label={`${plan.name} damage modifier`} breakdown={plan.damage.breakdown} className={styles.value}>
            {plan.damage.dice}
            {formatSigned(plan.damage.flat)} {plan.damage.damageType}
          </CalculatedValue>
        </span>
      </div>
      {!plan.proficient && plan.proficiencyReason && (
        <p className={styles.note}>Not proficient: {plan.proficiencyReason}</p>
      )}

      {canTwoHand && weapon && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={twoHanded && !isThrown}
            disabled={isThrown}
            onChange={(e) => setTwoHanded(e.target.checked)}
          />
          <span>
            Wield two-handed ({weapon.versatileDice}){isThrown ? ' (not while thrown)' : ''}
          </span>
        </label>
      )}
      {canThrow && (
        <label className={styles.check}>
          <input type="checkbox" checked={thrown} onChange={(e) => setThrown(e.target.checked)} />
          <span>Throw the weapon</span>
        </label>
      )}
      {isFinesse && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.label}>Finesse ability</legend>
          <div className={styles.radioRow}>
            {(
              [
                ['auto', 'Higher modifier'],
                ['str', 'Strength'],
                ['dex', 'Dexterity'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className={styles.radio}>
                <input
                  type="radio"
                  name="attack-finesse"
                  checked={abilityChoice === value}
                  onChange={() => setAbilityChoice(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <h4 className={styles.subhead}>Target {ruleTip('cover', 'About cover')}</h4>
      <label className={styles.field}>
        <span className={styles.label}>Target Armor Class</span>
        <input
          className={styles.input}
          type="number"
          inputMode="numeric"
          min={0}
          value={acText}
          placeholder="AC"
          aria-label="Target Armor Class"
          onChange={(e) => setAc(e.target.value)}
        />
      </label>
      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>Cover</legend>
        <div className={styles.radioRow}>
          {COVER_OPTIONS.map((option) => (
            <label key={option.value} className={styles.radio}>
              <input
                type="radio"
                name="attack-cover"
                checked={target.cover === option.value}
                onChange={() => setCover(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {cover?.targetable && (
        <p className={styles.statLine}>
          Armor Class to hit:{' '}
          <CalculatedValue label="Armor Class to hit" breakdown={cover.breakdown} className={styles.value} />
        </p>
      )}

      {rangedAttack && (
        <>
          <label className={styles.field}>
            <span className={styles.label}>Distance to the target (ft, optional)</span>
            <input
              className={styles.input}
              type="number"
              inputMode="numeric"
              min={0}
              value={distance}
              aria-label="Distance to the target in feet"
              onChange={(e) => setDistance(e.target.value)}
            />
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={hostileAdjacent} onChange={(e) => setHostileAdjacent(e.target.checked)} />
            <span>An enemy within 5 feet can see me</span>
          </label>
        </>
      )}
      <label className={styles.check}>
        <input type="checkbox" checked={targetUnseen} onChange={(e) => setTargetUnseen(e.target.checked)} />
        <span>I cannot see the target</span>
      </label>
      <label className={styles.check}>
        <input type="checkbox" checked={attackerUnseen} onChange={(e) => setAttackerUnseen(e.target.checked)} />
        <span>The target cannot see me</span>
      </label>

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>Advantage and Disadvantage (tick what applies)</legend>
        {ruleSources.length === 0 && <p className={styles.note}>No rule suggestions for this situation.</p>}
        {ruleSources.map(renderSource)}
        <details className={styles.details}>
          <summary className={styles.summary}>Target conditions</summary>
          {targetSources.map(renderSource)}
        </details>
        {manualSources.map(renderSource)}
      </fieldset>
      <p className={styles.modeLine} aria-live="polite" data-testid="attack-mode">
        Roll mode: <strong>{mode.mode === 'normal' ? 'Normal' : mode.mode === 'advantage' ? 'Advantage' : 'Disadvantage'}</strong>
        {mode.cancelled && ' (Advantage and Disadvantage cancel, however many sources there are)'}
        {mode.advantageFrom.length > 0 && <span> Advantage from: {mode.advantageFrom.join('; ')}.</span>}
        {mode.disadvantageFrom.length > 0 && <span> Disadvantage from: {mode.disadvantageFrom.join('; ')}.</span>}
      </p>

      {blockers.length > 0 && (
        <ul className={styles.blockers} role="alert" data-testid="attack-blockers">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={styles.primaryBtn} disabled={!canRoll} onClick={() => setStep(STEP_ROLL)}>
          Continue to roll
        </button>
      </div>
    </div>
  );

  const nextAfterRoll = attack?.result === 'miss' ? STEP_RESULT : STEP_DAMAGE;
  const rollStep = (
    <div className={styles.panel}>
      <p className={styles.statLine}>
        Attack bonus{' '}
        <CalculatedValue label={`${plan.name} attack bonus`} breakdown={plan.attackBonus} className={styles.value}>
          {formatSigned(plan.attackBonus.total)}
        </CalculatedValue>{' '}
        against Armor Class{' '}
        {cover?.effectiveAc !== undefined && (
          <CalculatedValue label="Armor Class to hit" breakdown={cover.breakdown} className={styles.value} />
        )}{' '}
        {ruleTip('attack-roll', 'About attack rolls')}
      </p>
      {!attack && (
        <>
          <p className={styles.modeLine}>
            Roll mode: <strong>{mode.mode === 'normal' ? 'Normal' : mode.mode === 'advantage' ? 'Advantage' : 'Disadvantage'}</strong>
            {mode.cancelled && ' (Advantage and Disadvantage cancel)'}
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setStep(STEP_WEAPON)}>
              Back
            </button>
            <button type="button" className={styles.primaryBtn} disabled={!canRoll} onClick={() => setRolling(true)}>
              {isManual ? 'Enter attack roll' : 'Roll attack'}
            </button>
          </div>
        </>
      )}
      {attack && (
        <>
          <div
            className={attack.result === 'miss' ? styles.missBox : attack.result === 'critical-hit' ? styles.critBox : styles.hitBox}
            data-testid="attack-outcome"
          >
            <div className={styles.outcome}>{OUTCOME_LABEL[attack.result]}</div>
            <div>
              Attack total{' '}
              <CalculatedValue label="Attack roll total" breakdown={attack.breakdown} className={styles.value} /> against Armor Class{' '}
              {cover?.effectiveAc}
              {attack.natural === 20 && ' (natural 20 always hits)'}
              {attack.natural === 1 && ' (natural 1 always misses)'}
            </div>
          </div>
          {attack.result === 'critical-hit' && <p className={styles.note}>{ruleTip('critical-hit', 'About Critical Hits')}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={() => setStep(nextAfterRoll)}>
              {attack.result === 'miss' ? 'Continue to result' : 'Continue to damage'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const damageStep = (
    <div className={styles.panel}>
      <p className={styles.statLine}>
        {plan.name} damage: <strong>{diceExpr}</strong>
        {critical && ' (Critical Hit: dice doubled)'} {formatSigned(plan.damage.flat)} {plan.damage.damageType}
      </p>
      {!damage && (
        <>
          {range.count > 0 && isManual && (
            <label className={styles.field}>
              <span className={styles.label}>Total of the {diceExpr} dice</span>
              <input
                className={styles.input}
                type="number"
                inputMode="numeric"
                min={range.min}
                max={range.max}
                value={manualDamage}
                aria-label={`Total of the ${diceExpr} dice`}
                onChange={(e) => setManualDamage(e.target.value)}
              />
            </label>
          )}
          {damageError && (
            <p className={styles.error} role="alert">
              {damageError}
            </p>
          )}
          <div className={styles.actions}>
            {range.count > 0 && isManual ? (
              <button type="button" className={styles.primaryBtn} onClick={handleManualDamage}>
                Use damage dice total
              </button>
            ) : (
              <button type="button" className={styles.primaryBtn} onClick={handleRollDamage}>
                {range.count === 0 ? 'Work out damage' : 'Roll damage'}
              </button>
            )}
          </div>
        </>
      )}
      {damage && (
        <>
          <div className={damage.critical ? styles.critBox : styles.hitBox} data-testid="damage-outcome">
            <div className={styles.outcome}>
              <CalculatedValue label={`${plan.name} damage total`} breakdown={damage.breakdown} className={styles.value} />{' '}
              {damage.damageType} damage
            </div>
            {damage.critical && <div>Critical Hit: {damage.dice} rolled, dice doubled.</div>}
            {damageRolls.length > 0 && <div>Dice: {damageRolls.join(', ')}</div>}
          </div>
          <p className={styles.note}>
            Apply {damage.total} {damage.damageType} damage to the target yourself. The app does not track the target&apos;s Hit
            Points.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={handleCopy}>
              Copy damage
            </button>
            <button type="button" className={styles.primaryBtn} onClick={() => setStep(STEP_RESULT)}>
              Continue to result
            </button>
          </div>
          {copied && (
            <p className={styles.note} role="status">
              {copied}
            </p>
          )}
        </>
      )}
    </div>
  );

  // ── Result step ──
  const masteryStatus = plan.item ? itemMasteryStatus(character, plan.item) : undefined;
  const masteryUsable = masteryStatus?.usable === true && weapon !== undefined;
  const hit = attack !== null && attack.result !== 'miss';
  const missed = attack?.result === 'miss';
  const mastery = weapon?.mastery;
  const masteryText = mastery ? resolveWeaponMasteryTooltip(mastery)?.sections[0]?.text : undefined;
  const pb = proficiencyBonus(character.level);
  const canCleave =
    masteryUsable && mastery === 'cleave' && hit && weapon?.range === 'melee' && !isThrown && kind !== 'cleave' && !cleaveUsed;
  const lightOptions = kind === 'normal' && attack && plan.item ? lightExtraOptions(character, plan.item.id) : undefined;
  const lightId =
    lightOptions?.candidates.find((c) => c.item.id === offHandId)?.item.id ?? lightOptions?.candidates[0]?.item.id;
  const lightEntry = lightOptions?.candidates.find((c) => c.item.id === lightId);
  const nickUsable =
    lightEntry !== undefined && lightEntry.weapon.mastery === 'nick' && itemMasteryStatus(character, lightEntry.item).usable;
  const nickText = resolveWeaponMasteryTooltip('nick')?.sections[0]?.text;

  const resultStep = (
    <div className={styles.panel}>
      {attack && (
        <p className={styles.statLine} data-testid="attack-summary">
          {KIND_LABEL[kind]} with {plan.name}: <strong>{OUTCOME_LABEL[attack.result]}</strong> (total{' '}
          <CalculatedValue label="Attack roll total" breakdown={attack.breakdown} className={styles.value} /> against AC{' '}
          {cover?.effectiveAc}).
          {damage && (
            <>
              {' '}
              Damage{' '}
              <CalculatedValue label={`${plan.name} damage total`} breakdown={damage.breakdown} className={styles.value} />{' '}
              {damage.damageType}.
            </>
          )}
        </p>
      )}
      {ammoNote && <p className={styles.note}>Ammunition:{' '}{ammoNote}</p>}

      {masteryUsable && missed && mastery === 'graze' && (
        <p className={styles.rider} data-testid="rider-graze">
          Graze: the target takes{' '}
          <CalculatedValue label="Graze damage" breakdown={grazeDamage(plan.abilityMod)} className={styles.value} /> {plan.damage.damageType}{' '}
          damage even though you missed.
        </p>
      )}
      {masteryUsable && hit && mastery === 'topple' && (
        <p className={styles.rider} data-testid="rider-topple">
          Topple: the target makes a Constitution saving throw against DC{' '}
          <CalculatedValue label="Topple DC" breakdown={toppleDc(plan.abilityMod, pb)} className={styles.value} />; on a failure it has
          the Prone condition.
        </p>
      )}
      {masteryUsable && hit && mastery && isInformationalMastery(mastery) && mastery !== 'nick' && masteryText && (
        <p className={styles.rider} data-testid="rider-info">
          {mastery.charAt(0).toUpperCase() + mastery.slice(1)}: {masteryText}
        </p>
      )}
      {canCleave && (
        <div className={styles.rider}>
          <p className={styles.noteFlush}>
            Cleave: you can make one more melee attack with this weapon against a second creature within 5 feet of the first, once per
            turn. It adds no positive ability modifier to damage.
          </p>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => {
              setCleaveUsed(true);
              startPass(plan.id, 'cleave');
            }}
          >
            Cleave attack
          </button>
        </div>
      )}

      {lightOptions && (
        <div className={styles.rider} data-testid="light-extra">
          <p className={styles.noteFlush}>
            Light: after the Attack action with a Light weapon, you can make one extra attack with a different Light weapon as a Bonus
            Action. It adds no positive ability modifier to damage.
          </p>
          {lightOptions.candidates.length === 0 && <p className={styles.note}>{lightOptions.reason}</p>}
          {lightOptions.candidates.length > 1 && (
            <label className={styles.field}>
              <span className={styles.label}>Extra attack weapon</span>
              <select className={styles.select} value={lightId} onChange={(e) => setOffHandId(e.target.value)}>
                {lightOptions.candidates.map((c) => (
                  <option key={c.item.id} value={c.item.id}>
                    {c.weapon.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {nickUsable && (
            <>
              {nickText && <p className={styles.note}>Nick: {nickText}</p>}
              <label className={styles.check}>
                <input type="checkbox" checked={nick} onChange={(e) => setNick(e.target.checked)} />
                <span>Made as part of the Attack action (Nick), so it does not use my Bonus Action</span>
              </label>
            </>
          )}
          {lightId && (
            <button type="button" className={styles.cancelBtn} onClick={() => startPass(lightId, 'light-extra')}>
              Light extra attack
            </button>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <ul className={styles.warningList} data-testid="attack-warnings">
          {warnings.map((w) => (
            <li key={w}>{TURN_WARNING_TEXT[w]}</li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={() => startPass(kind === 'normal' ? plan.id : mainId, 'normal')}>
          Another attack in this Attack action
        </button>
        <button type="button" className={styles.primaryBtn} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="attack-flow">
      <div ref={dialogRef} className={styles.dialog}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            <Swords size={18} aria-hidden="true" /> {KIND_LABEL[kind]}: {plan.name}
          </h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close attack flow">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <StepIndicator steps={STEPS} currentStep={step} />
        <div className={styles.srOnly} role="status" aria-live="polite" data-testid="attack-announcer">
          {announce}
        </div>
        <h3 ref={headingRef} tabIndex={-1} className={styles.stepTitle}>
          Step {step + 1}: {STEPS[step]}
        </h3>
        {step === STEP_WEAPON && weaponStep}
        {step === STEP_ROLL && rollStep}
        {step === STEP_DAMAGE && damageStep}
        {step === STEP_RESULT && resultStep}
      </div>
      {rolling && cover?.effectiveAc !== undefined && (
        <RollPrompt
          title={`${plan.name} attack roll`}
          hint={`Armor Class ${cover.effectiveAc}.`}
          exhaustionLevel={plan.exhaustion}
          modifiers={plan.attackBonus.components}
          initialMode={mode.mode}
          confirmLabel="Use attack roll"
          notice={
            mode.cancelled ? (
              <span>Advantage and Disadvantage cancel, so this is a normal roll.</span>
            ) : mode.mode !== 'normal' ? (
              <span>
                {mode.mode === 'advantage' ? 'Advantage' : 'Disadvantage'} from{' '}
                {(mode.mode === 'advantage' ? mode.advantageFrom : mode.disadvantageFrom).join('; ')}.
              </span>
            ) : undefined
          }
          diceEntryMode={entryMode}
          rng={source}
          onResolve={handleRollResolved}
          onClose={() => setRolling(false)}
        />
      )}
    </div>
  );
}
