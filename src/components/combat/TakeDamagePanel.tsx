import { useEffect, useRef, useState } from 'react';
import type { Character } from '../../types/character';
import { DAMAGE_TYPES } from '../../data/damage-types';
import {
  applyDamageToCharacter,
  damagePreviewBreakdowns,
  effectiveHp,
  hpStateOf,
  hitPointMaxOf,
  knockOut,
  lifeStatus,
  type DamageRequest,
} from '../../logic/hit-points-state';
import { resolveHitPointRuleTooltip } from '../../logic/tooltip-content';
import { concentrationCheck, shouldEndConcentration } from '../../logic/concentration';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { parseNumberInput } from '../pages/sheet-helpers';
import { ConcentrationCheckPrompt } from './ConcentrationCheckPrompt';
import styles from './HitPoints.module.css';

export interface TakeDamagePanelProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Optional app-level Toast sink (Concentration results). */
  onNotify?: (message: string) => void;
}

/**
 * Take Damage section of the Combat page's Hit Points card (Stage A5a; folded
 * into the HP card in the Combat declutter). The amount and Apply button are
 * always in view; the damage type, flat adjustment and this-hit-only modifiers
 * sit under a "Damage options" disclosure that names what is switched on.
 *
 * Presentation parity: PWACharSheet components/combat/TakeDamagePanel.tsx: a
 * collapsible Card with a defence-tinted body, labelled number inputs, a
 * computed result row (Net Wounds there; the preview here) with a breakdown
 * tooltip, a "would drop to 0" warning, and one Apply button that resets the
 * inputs. Deviations: the WFRP hit-location, Armour Points, Toughness Bonus,
 * Critical Wound and shield flows do not exist in D&D, so the inputs are the
 * 2024 damage pipeline (amount, type label, flat adjustment, per-instance
 * Resistance / Vulnerability / Immunity, Critical Hit) and the preview shows
 * Temp HP absorbed / HP lost / remainder vs HP maximum / death-save failures.
 *
 * No rule is computed here: the preview and the applied change both come from
 * applyDamageToCharacter (logic/hit-points-state.ts).
 */
export function TakeDamagePanel({ character, onChange, onNotify }: TakeDamagePanelProps) {
  const [amountRaw, setAmountRaw] = useState('');
  const [flatRaw, setFlatRaw] = useState('');
  const [damageType, setDamageType] = useState('');
  const [resistance, setResistance] = useState(false);
  const [vulnerability, setVulnerability] = useState(false);
  const [immune, setImmune] = useState(false);
  const [crit, setCrit] = useState(false);
  // D4: default OFF, so damage absorbed by Temp HP still counts as damage taken.
  const [absorbedIsNoDamage, setAbsorbedIsNoDamage] = useState(false);
  const [status, setStatus] = useState('');
  const [confirmKnockOut, setConfirmKnockOut] = useState(false);
  // Stage A5b: damage that forces a Concentration check, awaiting the save.
  const [pendingCheck, setPendingCheck] = useState<number | null>(null);
  // Bumped after Apply so focus returns to the amount input once it re-renders.
  const [focusTick, setFocusTick] = useState(0);
  const amountRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusTick === 0) return;
    // Fall back to the status line when the input is now disabled (the hit killed the character).
    const input = amountRef.current;
    (input && !input.disabled ? input : statusRef.current)?.focus();
  }, [focusTick]);

  // A pending check is moot once Concentration has ended (End Concentration,
  // auto-end); drop it so it cannot reappear for a later spell.
  if (pendingCheck !== null && !character.concentration) setPendingCheck(null);

  const max = hitPointMaxOf(character);
  const hp = effectiveHp(character);
  const dead = lifeStatus(character) === 'dead';
  const disabled = max === undefined || dead;

  const amount = parseNumberInput(amountRaw, true) ?? 0;
  const flat = parseNumberInput(flatRaw, false) ?? 0;
  const request: DamageRequest = {
    amount,
    flat,
    resistance,
    vulnerability,
    immune,
    crit,
  };
  const outcome = applyDamageToCharacter(character, request, {
    absorbedCountsAsDamage: !absorbedIsNoDamage,
  });
  const result = outcome?.result ?? null;
  const showPreview = result !== null && amount > 0;
  const massiveTip = resolveHitPointRuleTooltip('massive-damage');
  const before = hpStateOf(character);
  const previewBreakdowns = showPreview && result && before ? damagePreviewBreakdowns(before, request, result) : null;

  const reset = () => {
    setAmountRaw('');
    setFlatRaw('');
    setDamageType('');
    setResistance(false);
    setVulnerability(false);
    setImmune(false);
    setCrit(false);
  };

  const handleApply = () => {
    if (!outcome || amount <= 0) return;
    const r = outcome.result;
    onChange(outcome.character);
    const typeText = damageType ? ` ${damageType}` : '';
    const parts = [`Took ${r.damageDealt}${typeText} damage.`];
    if (r.tempAbsorbed > 0) parts.push(`${r.tempAbsorbed} absorbed by Temp HP.`);
    if (r.instantDeath) parts.push('Massive Damage: the character dies.');
    else if (r.next.dead) parts.push('Third death-save failure: the character dies.');
    else if (r.atZero) parts.push('Dropped to 0 Hit Points.');
    else if (r.failuresAdded > 0) {
      parts.push(`${r.failuresAdded} death-save failure${r.failuresAdded === 1 ? '' : 's'}.`);
    }
    // Stage A5b, D4: a hit forces a Concentration check when it counts as damage
    // taken (tookDamage already honours the Temp-HP toggle) and the character
    // keeps concentrating. If the hit ends it (0 HP, Incapacitated, dead) there
    // is nothing to save for; App's auto-end announces that.
    const after = outcome.character;
    const checkNeeded = r.tookDamage && !!after.concentration && shouldEndConcentration(after) === null;
    if (checkNeeded) {
      const dc = concentrationCheck(r.damageDealt).dc;
      parts.push(`Concentration check required: Constitution save DC ${dc}.`);
      setPendingCheck(r.damageDealt);
    } else {
      setPendingCheck(null);
    }
    setStatus(parts.join(' '));
    reset();
    // With a check pending, the prompt takes focus instead of the amount input.
    if (!checkNeeded) setFocusTick((n) => n + 1);
  };
  // What is switched on under "Damage options", so a folded panel still says so.
  const activeOptions = [
    damageType || null,
    flat !== 0 ? `${flat > 0 ? '+' : ''}${flat} flat` : null,
    resistance ? 'Resistance' : null,
    vulnerability ? 'Vulnerability' : null,
    immune ? 'Immunity' : null,
    crit ? 'Critical Hit' : null,
    absorbedIsNoDamage ? 'Temp HP absorbs as no damage' : null,
  ].filter((x): x is string => x !== null);

  return (
    <section className={styles.subsection} aria-labelledby="take-damage-heading">
      <h4 id="take-damage-heading" className={styles.subheading}>
        Take damage
      </h4>
      {max === undefined && !dead && (
        <p className={styles.notice}>Set a class or an HP max to apply damage.</p>
      )}
      {dead && <p className={styles.notice}>This character is dead. Damage changes nothing.</p>}

      <div className={styles.quickDamage}>
        <label className={styles.formLabel} htmlFor="damage-amount">
          Damage
        </label>
        <input
          id="damage-amount"
          ref={amountRef}
          className={styles.numberInput}
          type="number"
          min={0}
          inputMode="numeric"
          value={amountRaw}
          placeholder="0"
          disabled={disabled}
          aria-label="Damage amount"
          onChange={(e) => setAmountRaw(e.target.value)}
        />
        <button
          type="button"
          className={showPreview ? styles.applyBtn : styles.applyBtnDisabled}
          disabled={!showPreview}
          onClick={handleApply}
        >
          {showPreview && result ? `Apply ${result.damageDealt} damage` : 'Apply damage'}
        </button>
      </div>

      <details className={styles.options}>
        <summary className={styles.optionsSummary}>
          Damage options{activeOptions.length > 0 ? `: ${activeOptions.join(', ')}` : ''}
        </summary>
        <div className={styles.formRow}>
          <label className={styles.formLabel} htmlFor="damage-type">
            Type
          </label>
          <select
            id="damage-type"
            className={styles.select}
            value={damageType}
            disabled={disabled}
            aria-label="Damage type"
            onChange={(e) => setDamageType(e.target.value)}
          >
            <option value="">Untyped</option>
            {DAMAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className={styles.formLabel} htmlFor="damage-flat">
            Flat adjustment
          </label>
          <input
            id="damage-flat"
            className={styles.numberInput}
            type="number"
            inputMode="numeric"
            value={flatRaw}
            placeholder="0"
            disabled={disabled}
            aria-label="Flat damage adjustment"
            onChange={(e) => setFlatRaw(e.target.value)}
          />
        </div>

        <div className={styles.toggleRow} role="group" aria-label="Damage modifiers (this hit only)">
          <label className={styles.toggleChip}>
            <input
              type="checkbox"
              checked={resistance}
              disabled={disabled}
              onChange={(e) => setResistance(e.target.checked)}
            />
            <span>Resistance</span>
          </label>
          <label className={styles.toggleChip}>
            <input
              type="checkbox"
              checked={vulnerability}
              disabled={disabled}
              onChange={(e) => setVulnerability(e.target.checked)}
            />
            <span>Vulnerability</span>
          </label>
          <label className={styles.toggleChip}>
            <input
              type="checkbox"
              checked={immune}
              disabled={disabled}
              onChange={(e) => setImmune(e.target.checked)}
            />
            <span>Immunity</span>
          </label>
          <label className={styles.toggleChip}>
            <input
              type="checkbox"
              checked={crit}
              disabled={disabled}
              onChange={(e) => setCrit(e.target.checked)}
            />
            <span>Critical Hit</span>
          </label>
        </div>

        <label className={styles.toggleChipWide}>
          <input
            type="checkbox"
            checked={absorbedIsNoDamage}
            disabled={disabled}
            onChange={(e) => setAbsorbedIsNoDamage(e.target.checked)}
          />
          <span>
            Treat damage absorbed by Temp HP as no damage
            <span className={styles.hint}>
              {' '}
              The PHB does not say. Off: absorbed damage still counts as damage taken, so a creature at
              0 HP gains a death-save failure.
            </span>
          </span>
        </label>

        {/* PHB 2024 "Knocking Out a Creature" (L1159-1162, L21277-21280): an
            attacker whose melee attack would drop a creature to 0 HP can leave it
            at 1 HP and Unconscious instead. */}
        <button
          type="button"
          className={styles.ghostBtn}
          disabled={knockOut(character) === null}
          title="A melee attack that would reduce a creature to 0 HP can leave it at 1 HP and Unconscious instead"
          onClick={() => setConfirmKnockOut(true)}
        >
          Knock out
        </button>
      </details>

      {showPreview && result && (
        <div className={styles.preview} data-testid="damage-preview">
          <div className={styles.previewRow}>
            <span className={styles.previewLabel}>Damage after modifiers</span>
            <span className={styles.previewValue} data-testid="preview-damage">
              <CalculatedValue label="Damage after modifiers" breakdown={result.breakdown} />
            </span>
          </div>
          <div className={styles.previewRow}>
            <span className={styles.previewLabel}>Temp HP absorbed</span>
            <span className={styles.previewValue} data-testid="preview-temp">
              {previewBreakdowns ? (
                <CalculatedValue label="Temp HP absorbed" breakdown={previewBreakdowns.tempAbsorbed} />
              ) : (
                result.tempAbsorbed
              )}
            </span>
          </div>
          <div className={styles.previewRow}>
            <span className={styles.previewLabel}>HP lost</span>
            <span className={styles.previewValue} data-testid="preview-hp-lost">
              {previewBreakdowns ? (
                <CalculatedValue label="HP lost" breakdown={previewBreakdowns.hpLost} />
              ) : (
                result.hpLost
              )}
            </span>
          </div>
          {(result.atZero || result.instantDeath) && hp !== 0 && (
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>
                {massiveTip ? <ContentTooltip content={massiveTip}>Remainder vs HP maximum</ContentTooltip> : 'Remainder vs HP maximum'}
              </span>
              <span className={styles.previewValue} data-testid="preview-remainder">
                {previewBreakdowns ? (
                  <CalculatedValue label="Remainder after dropping to 0 HP" breakdown={previewBreakdowns.remainder} />
                ) : (
                  result.remainder
                )}{' '}
                vs {max}
              </span>
            </div>
          )}
          {hp === 0 && (
            <div className={styles.previewRow}>
              <span className={styles.previewLabel}>Death-save failures added</span>
              <span className={styles.previewValue} data-testid="preview-failures">
                {previewBreakdowns ? (
                  <CalculatedValue label="Death-save failures added" breakdown={previewBreakdowns.failuresAdded} />
                ) : (
                  result.failuresAdded
                )}
              </span>
            </div>
          )}
          {result.instantDeath ? (
            <div className={styles.warning} role="status" data-testid="preview-warning">
              Massive Damage: this would kill the character outright.
            </div>
          ) : result.next.dead ? (
            <div className={styles.warning} role="status" data-testid="preview-warning">
              This would be a third death-save failure: the character would die.
            </div>
          ) : result.atZero && hp !== 0 ? (
            <div className={styles.warning} role="status" data-testid="preview-warning">
              Would drop to 0 HP.
            </div>
          ) : null}
        </div>
      )}

      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className={styles.liveRegion}
        data-testid="damage-status"
      >
        {status}
      </div>
      {confirmKnockOut && (
        <ConfirmDialog
          message="Knock out the character? Hit Points become 1 and the Unconscious condition is added (ends after a Short Rest)."
          confirmLabel="Knock out"
          onConfirm={() => {
            setConfirmKnockOut(false);
            const next = knockOut(character);
            if (next) onChange(next);
          }}
          onCancel={() => setConfirmKnockOut(false)}
        />
      )}
      {pendingCheck !== null && character.concentration && (
        <ConcentrationCheckPrompt
          character={character}
          damage={pendingCheck}
          onChange={onChange}
          onNotify={onNotify}
          onDone={(message) => {
            setPendingCheck(null);
            setStatus(message);
            setFocusTick((n) => n + 1);
          }}
        />
      )}
    </section>
  );
}
