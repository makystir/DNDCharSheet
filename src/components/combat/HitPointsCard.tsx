import { useEffect, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import type { Character } from '../../types/character';
import {
  applyHealingToCharacter,
  currentHpBreakdown,
  effectiveTempHp,
  grantTempHpToCharacter,
  hitPointMaxOf,
  isBloodied,
  lifeStatus,
  characterHitPointMaxBreakdown,
  effectiveHp,
  type TempHpChoice,
} from '../../logic/hit-points-state';
import { resolveHitPointRuleTooltip } from '../../logic/tooltip-content';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import { ProgressBar, type ProgressBarLevel } from '../shared/ProgressBar';
import { parseNumberInput } from '../pages/sheet-helpers';
import { DeathSavesCard } from './DeathSavesCard';
import { TakeDamagePanel } from './TakeDamagePanel';
import styles from './HitPoints.module.css';

export interface HitPointsCardProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Optional app-level Toast sink (Concentration results after damage). */
  onNotify?: (message: string) => void;
}

/** Severity of the HP bar, from the logic-derived life status. */
function barLevel(status: ReturnType<typeof lifeStatus>, bloodied: boolean): ProgressBarLevel {
  if (status === 'dead' || status === 'making-death-saves' || status === 'stable') return 'down';
  return bloodied ? 'bloodied' : 'healthy';
}

/**
 * HP card for the Combat tab (Stage A5a): bar, current / max as
 * CalculatedValues, Bloodied / Stable / Dead chips with rule tooltips, the Temp
 * HP readout, and the Heal and Temp HP grant controls.
 *
 * Presentation parity: PWACharSheet CombatDashboard's wounds section (wound
 * count over a coloured progress bar) and CombatDashboardCompact (heart +
 * current / max). Deviations: the PWA tracks Wounds; D&D tracks Hit Points with
 * Temp HP, so the card also hosts Heal and Temp HP (the PWA has no healing
 * control on the dashboard). Every rule lives in logic/hit-points-state.ts.
 *
 * Combat declutter: everything about this character's Hit Points is in this one
 * card. Death Saves appear in it only at 0 HP (healing and damage still apply
 * there, so they stay available), then Take damage, then Heal and Temp HP.
 */
export function HitPointsCard({ character, onChange, onNotify }: HitPointsCardProps) {
  const [healRaw, setHealRaw] = useState('');
  const [tempRaw, setTempRaw] = useState('');
  const [pendingTemp, setPendingTemp] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  // After Heal / Grant the buttons disable themselves, so focus returns to the
  // matching amount input once it has re-rendered.
  const [focusRequest, setFocusRequest] = useState<{ target: 'heal' | 'temp'; tick: number } | null>(null);
  const healRef = useRef<HTMLInputElement>(null);
  const tempRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusRequest) return;
    const input = focusRequest.target === 'heal' ? healRef.current : tempRef.current;
    (input && !input.disabled ? input : statusRef.current)?.focus();
  }, [focusRequest]);

  const requestFocus = (target: 'heal' | 'temp') =>
    setFocusRequest((prev) => ({ target, tick: (prev?.tick ?? 0) + 1 }));

  const max = hitPointMaxOf(character);
  const hp = effectiveHp(character);
  const temp = effectiveTempHp(character);
  const life = lifeStatus(character);
  const bloodied = isBloodied(character);
  const dead = life === 'dead';
  const noMax = max === undefined;
  // Healing and Temp HP need a maximum and a living character.
  const controlsDisabled = noMax || dead;

  const currentBreakdown = currentHpBreakdown(character);
  const bloodiedTip = resolveHitPointRuleTooltip('bloodied');
  const stableTip = resolveHitPointRuleTooltip('stable');
  const tempTip = resolveHitPointRuleTooltip('temp-hp');

  const healAmount = parseNumberInput(healRaw, true);
  const tempAmount = parseNumberInput(tempRaw, true);

  const handleHeal = () => {
    if (healAmount === undefined || healAmount <= 0) return;
    const out = applyHealingToCharacter(character, healAmount);
    if (!out) return;
    onChange(out.character);
    setHealRaw('');
    requestFocus('heal');
    const now = effectiveHp(out.character);
    setStatus(
      out.result.regained > 0
        ? `Healed ${out.result.regained} Hit Point${out.result.regained === 1 ? '' : 's'}. Hit Points are now ${now} of ${max}.`
        : `Already at maximum Hit Points; the ${healAmount} healing is lost.`,
    );
  };

  const applyTemp = (offered: number, choice?: TempHpChoice) => {
    const next = grantTempHpToCharacter(character, offered, choice);
    if (!next) return;
    onChange(next);
    setTempRaw('');
    setPendingTemp(null);
    requestFocus('temp');
    setStatus(`Temporary Hit Points are now ${effectiveTempHp(next)}.`);
  };

  const handleGrantTemp = () => {
    if (tempAmount === undefined) return;
    if (tempAmount <= 0 && temp === 0) return;
    // Temp HP never stack: when there are already some and the offer differs,
    // ask which to keep (PHB "Temporary Hit Points").
    if (temp > 0 && tempAmount !== temp) {
      setPendingTemp(tempAmount);
      return;
    }
    applyTemp(tempAmount);
  };

  return (
    <Card>
      <SectionHeader icon={Heart} title="Hit Points" />

      {noMax && !dead && (
        <p className={styles.notice} data-testid="hp-no-max">
          Set a class or an HP max to track Hit Points. Damage and healing stay off until then.
        </p>
      )}

      {/* Line 1: the readout and status chips. */}
      <div className={styles.topLine}>
        {currentBreakdown && max !== undefined && (
          <span className={styles.readout} data-testid="hp-readout">
            <span className={styles.current}>
              <CalculatedValue label="Current HP" breakdown={currentBreakdown} />
            </span>
            <span className={styles.slash} aria-hidden="true">
              /
            </span>
            <span className={styles.max}>
              <CalculatedValue label="Max HP" breakdown={characterHitPointMaxBreakdown(character)} />
            </span>
            <span className={styles.unit}>HP</span>
          </span>
        )}
        <span className={styles.chips}>
          {bloodied && bloodiedTip && (
            <span className={styles.chipBloodied} data-testid="chip-bloodied">
              <ContentTooltip content={bloodiedTip}>Bloodied</ContentTooltip>
            </span>
          )}
          {life === 'stable' && stableTip && (
            <span className={styles.chipStable} data-testid="chip-stable">
              <ContentTooltip content={stableTip}>Stable</ContentTooltip>
            </span>
          )}
          {dead && (
            <span className={styles.chipDead} data-testid="chip-dead">
              Dead
            </span>
          )}
        </span>
        <span className={styles.tempReadout} data-testid="temp-hp-readout">
          {tempTip ? <ContentTooltip content={tempTip}>Temp HP</ContentTooltip> : 'Temp HP'}
          <span className={styles.tempValue} data-testid="temp-hp-value">
            {temp}
          </span>
        </span>
      </div>

      {currentBreakdown && max !== undefined && (
        <ProgressBar
          current={hp ?? 0}
          max={Math.max(0, max)}
          level={barLevel(life, bloodied)}
          label={`Hit Points ${hp ?? 0} of ${max}`}
          ariaLabel="Hit Points"
        />
      )}

      <DeathSavesCard character={character} onChange={onChange} />

      <TakeDamagePanel character={character} onChange={onChange} onNotify={onNotify} />

      {/* Heal and Temp HP. */}
      <section className={styles.subsection} aria-labelledby="heal-heading">
      <h4 id="heal-heading" className={styles.subheading}>
        Heal
      </h4>
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel} htmlFor="hp-heal-amount">
            Heal
          </label>
          <input
            id="hp-heal-amount"
            ref={healRef}
            className={styles.numberInput}
            type="number"
            min={0}
            inputMode="numeric"
            value={healRaw}
            placeholder="0"
            disabled={controlsDisabled}
            aria-label="Healing amount"
            onChange={(e) => setHealRaw(e.target.value)}
          />
          <button
            type="button"
            className={styles.actionBtn}
            disabled={controlsDisabled || healAmount === undefined || healAmount <= 0}
            onClick={handleHeal}
          >
            Heal
          </button>
        </div>

        <div className={styles.controlGroup}>
          <label className={styles.controlLabel} htmlFor="hp-temp-amount">
            Temp HP
          </label>
          <input
            id="hp-temp-amount"
            ref={tempRef}
            className={styles.numberInput}
            type="number"
            min={0}
            inputMode="numeric"
            value={tempRaw}
            placeholder="0"
            disabled={controlsDisabled}
            aria-label="Temporary Hit Points amount"
            onChange={(e) => {
              setTempRaw(e.target.value);
              setPendingTemp(null);
            }}
          />
          <button
            type="button"
            className={styles.actionBtn}
            disabled={controlsDisabled || tempAmount === undefined || (tempAmount <= 0 && temp === 0)}
            onClick={handleGrantTemp}
          >
            Grant Temp HP
          </button>
        </div>
      </div>

      {pendingTemp !== null && (
        <div className={styles.prompt} role="group" aria-label="Keep or replace Temporary Hit Points">
          <span className={styles.promptText}>
            You have {temp} Temp HP and are offered {pendingTemp}. Temp HP do not stack: keep what you
            have or replace it.
          </span>
          <div className={styles.promptActions}>
            <button type="button" className={styles.actionBtn} onClick={() => applyTemp(pendingTemp, 'keep')}>
              Keep {temp}
            </button>
            <button type="button" className={styles.actionBtn} onClick={() => applyTemp(pendingTemp, 'replace')}>
              Replace with {pendingTemp}
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => setPendingTemp(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className={styles.liveRegion}
        data-testid="hp-status"
      >
        {status}
      </div>
      </section>
    </Card>
  );
}
