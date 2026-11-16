import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DmCombatCondition, DmCombatant, DmEncounter } from '../../types/dm';
import { CONDITIONS, getCondition } from '../../data/conditions';
import { DAMAGE_TYPES } from '../../data/damage-types';
import {
  addCondition,
  canTakeLegendary,
  resetLegendary,
  spendLegendaryAction,
  dealDamage,
  duplicateCombatant,
  giveTempHp,
  healCombatant,
  isDown,
  isOut,
  moveCombatant,
  parseDamageTypes,
  recordDeathSave,
  removeCombatant,
  removeCondition,
  renameCombatant,
  resolveConcentration,
  reviveCombatant,
  rollConcentrationSave,
  setConcentration,
  setInitiative,
  setLegendaryInLair,
  stabilizeCombatant,
  updateCombatant,
} from '../../logic/dm-encounter';
import { createDefaultRng } from '../../logic/random';
import type { Breakdown } from '../../logic/breakdown';
import { resolveConditionTooltip } from '../../logic/tooltip-content';
import { Card } from '../shared/Card';
import { ContentTooltip } from '../shared/ContentTooltip';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './dm.module.css';
import enc from './encounter.module.css';

interface CombatantCardProps {
  encounter: DmEncounter;
  combatant: DmCombatant;
  isActive: boolean;
  onCommit: (next: DmEncounter) => void;
  onNotify: (text: string) => void;
}

/** Why a concentration DC is what it is (PHB 2024 "Concentration"). */
function dcBreakdown(dc: number): Breakdown {
  return {
    total: dc,
    components: [
      { label: 'Base DC', value: 10 },
      { label: 'Half the damage above 10 (round down)', value: Math.max(0, dc - 10) },
    ],
    note: 'The DC is 10 or half the damage taken (round down), whichever is higher, up to 30.',
  };
}

const TRACKABLE = CONDITIONS.filter((c) => c.id !== 'exhaustion');

/** One combatant: the quick numbers up front, the detail panel behind "More". */
export function CombatantCard({ encounter, combatant: c, isActive, onCommit, onNotify }: CombatantCardProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('');
  const [resist, setResist] = useState(false);
  const [vuln, setVuln] = useState(false);
  const [immune, setImmune] = useState(false);
  const [crit, setCrit] = useState(false);
  const [temp, setTemp] = useState('');
  const [condId, setCondId] = useState<string>(TRACKABLE[0].id);
  const [condRounds, setCondRounds] = useState('');
  const [saveD20, setSaveD20] = useState('');
  const [concLabel, setConcLabel] = useState(c.concentration.label);
  const cardRef = useRef<HTMLDivElement>(null);

  // Keep the active combatant's card on screen when the turn passes to it.
  useEffect(() => {
    const el = cardRef.current;
    if (isActive && el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [isActive]);

  const setup = encounter.status === 'setup';
  const ended = encounter.status === 'ended';
  const out = isOut(c);
  const down = isDown(c);
  const pct = c.hp.max > 0 ? Math.max(0, Math.min(100, Math.round((c.hp.hp / c.hp.max) * 100))) : 0;
  const amountNum = Math.max(0, Math.trunc(Number(amount)) || 0);

  const pickType = (value: string) => {
    setType(value);
    const t = value.toLowerCase();
    const has = (text: string) => value !== '' && parseDamageTypes(text).some((x) => x.toLowerCase() === t);
    setResist(has(c.resistances));
    setVuln(has(c.vulnerabilities));
    setImmune(has(c.immunities));
  };

  const applyDamage = () => {
    if (amountNum <= 0) return;
    const outcome = dealDamage(encounter, c.id, {
      amount: amountNum,
      resistance: resist,
      vulnerability: vuln,
      immune,
      crit,
    });
    if (!outcome) return;
    onCommit(outcome.encounter);
    setAmount('');
  };

  const heal = () => {
    if (amountNum <= 0) return;
    onCommit(healCombatant(encounter, c.id, amountNum));
    setAmount('');
  };

  const rollSave = () => {
    const roll = rollConcentrationSave(c, createDefaultRng());
    if (!roll) return;
    const dc = c.concentrationDcs[0];
    onNotify(
      `${c.name} rolled ${roll.d20} + ${c.conSaveMod ?? 0} = ${roll.total} against DC ${dc}: ${roll.success ? 'keeps' : 'loses'} Concentration.`,
    );
    onCommit(resolveConcentration(encounter, c.id, roll.success));
  };

  const duplicate = () => onCommit(duplicateCombatant(encounter, c.id, () => crypto.randomUUID()));

  const dc = c.concentrationDcs[0];
  const defences = [
    c.resistances && `Resists ${c.resistances}`,
    c.vulnerabilities && `Vulnerable to ${c.vulnerabilities}`,
    c.immunities && `Immune to ${c.immunities}`,
  ].filter(Boolean);

  return (
    <Card>
      <div
        className={`${enc.card} ${isActive ? enc.cardActive : ''} ${out ? enc.cardOut : ''}`}
        data-testid="combatant-card"
        data-active={isActive ? 'true' : 'false'}
      >
        <div className={enc.head}>
          {setup ? (
            <label className={enc.init}>
              <span className={styles.fieldLabel}>Initiative</span>
              <input
                className={styles.input}
                type="number"
                aria-label={`Initiative for ${c.name}`}
                value={c.initiative ?? ''}
                onChange={(e) =>
                  onCommit(setInitiative(encounter, c.id, e.target.value === '' ? null : Number(e.target.value)))
                }
              />
            </label>
          ) : (
            <span className={enc.initBadge} title="Initiative">
              {c.initiative ?? '-'}
            </span>
          )}
          <div className={enc.name}>
            {c.name}
            <div className={styles.muted}>
              {c.cr && <strong>CR {c.cr} · </strong>}
              {c.sourceLabel}
            </div>
            {c.notes.trim() !== '' && (
              <div className={enc.notesPreview} title={c.notes} data-testid="notes-preview">
                {c.notes}
              </div>
            )}
          </div>
          {isActive && <span className={enc.turnTag}>Turn</span>}
          {out && <span className={enc.outTag}>{c.kind === 'pc' ? 'Dead' : 'Defeated'}</span>}
          {down && !out && <span className={enc.outTag}>{c.hp.stable ? 'Stable' : '0 HP'}</span>}
        </div>

        <div className={enc.vitals}>
          <div className={enc.vital}>
            <span className={styles.statLabel}>AC</span>
            <span className={enc.vitalValue}>{c.ac}</span>
          </div>
          <div className={enc.vital}>
            <span className={styles.statLabel}>Hit Points</span>
            <span className={enc.vitalValue}>
              {c.hp.hp} / {c.hp.max}
              {c.hp.temp > 0 && <span className={styles.muted}> +{c.hp.temp} temp</span>}
            </span>
          </div>
          <div
            className={enc.bar}
            role="progressbar"
            aria-label={`${c.name} hit points`}
            aria-valuemin={0}
            aria-valuemax={c.hp.max}
            aria-valuenow={c.hp.hp}
          >
            <div className={pct <= 25 ? enc.barFillLow : enc.barFill} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {(c.conditions.length > 0 || c.concentration.active) && (
          <div className={styles.chips}>
            {c.conditions.map((x) => {
              const name = getCondition(x.id)?.name ?? x.id;
              const tip = resolveConditionTooltip(x.id);
              const label = `${name}${x.rounds !== undefined ? ` (${x.rounds})` : ''}`;
              return (
                <span key={x.id} className={enc.chipGroup}>
                  {tip ? (
                    <ContentTooltip content={tip} className={enc.chipName} ariaLabel={`${label}: rules for ${name}`}>
                      {label}
                    </ContentTooltip>
                  ) : (
                    <span className={enc.chipName}>{label}</span>
                  )}
                  <button
                    type="button"
                    className={enc.chipRemove}
                    onClick={() => onCommit(removeCondition(encounter, c.id, x.id))}
                    aria-label={`Remove ${name} from ${c.name}`}
                    title="Remove"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
            {c.concentration.active && (
              <span className={styles.chip}>
                Concentrating{c.concentration.label ? `: ${c.concentration.label}` : ''}
              </span>
            )}
          </div>
        )}

        {dc !== undefined && (
          <div className={enc.alert} role="alert">
            <span>
              {c.name} must save to keep Concentration. Constitution save, DC{' '}
              <CalculatedValue label="Concentration save DC" breakdown={dcBreakdown(dc)}>
                {dc}
              </CalculatedValue>
              {c.concentrationDcs.length > 1 && <span className={styles.muted}> ({c.concentrationDcs.length - 1} more after this)</span>}
            </span>
            <span className={styles.row}>
              {c.conSaveMod !== undefined && (
                <button type="button" className={styles.btnPrimary} onClick={rollSave}>
                  Roll ({c.conSaveMod >= 0 ? '+' : ''}
                  {c.conSaveMod})
                </button>
              )}
              <button type="button" className={styles.btn} onClick={() => onCommit(resolveConcentration(encounter, c.id, true))}>
                Kept it
              </button>
              <button type="button" className={styles.btn} onClick={() => onCommit(resolveConcentration(encounter, c.id, false))}>
                Lost it
              </button>
            </span>
          </div>
        )}

        {c.legendary && encounter.status === 'running' && !out && (
          <div className={enc.alert}>
            <span>
              Legendary actions: {c.legendary.max - c.legendary.used} of {c.legendary.max} left.{' '}
              <span className={styles.muted}>Taken after another creature's turn; all return at the start of this creature's turn.</span>
            </span>
            <span className={styles.row}>
              {c.legendaryLair && (
                <label className={enc.checkRow}>
                  <input
                    type="checkbox"
                    checked={c.legendaryLair.active}
                    aria-label={`In Lair for ${c.name}`}
                    onChange={(e) => onCommit(setLegendaryInLair(encounter, c.id, e.target.checked))}
                  />{' '}
                  In Lair ({c.legendaryLair.inLair} uses)
                </label>
              )}
              <button
                type="button"
                className={styles.btn}
                disabled={!canTakeLegendary(c)}
                onClick={() => onCommit(spendLegendaryAction(encounter, c.id))}
                aria-label={`Use a legendary action for ${c.name}`}
              >
                Use one
              </button>
              <button type="button" className={styles.btn} onClick={() => onCommit(resetLegendary(encounter, c.id))}>
                Refill
              </button>
            </span>
          </div>
        )}

        {!ended && !out && (
          <div className={enc.quick}>
            {!setup && (
              <>
            <label className={styles.field} style={{ flex: '0 0 auto' }}>
              <span className={styles.fieldLabel}>Amount</span>
              <input
                className={`${styles.input} ${enc.amount}`}
                type="number"
                min={0}
                inputMode="numeric"
                aria-label={`Amount for ${c.name}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyDamage();
                }}
              />
            </label>
            <button type="button" className={styles.btnPrimary} onClick={applyDamage} aria-label={`Damage ${c.name}`}>
              Damage
            </button>
            <button type="button" className={styles.btn} onClick={heal} aria-label={`Heal ${c.name}`}>
              Heal
            </button>
              </>
            )}
            <span className={enc.spacer} />
            {c.kind === 'monster' && (
              <button type="button" className={styles.btn} onClick={duplicate} aria-label={`Duplicate ${c.name}`}>
                Duplicate
              </button>
            )}
            <button
              type="button"
              className={styles.btn}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={`${open ? 'Hide' : 'Show'} more for ${c.name}`}
            >
              {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />} More
            </button>
          </div>
        )}

        {out && !ended && (
          <div className={styles.row}>
            <button type="button" className={styles.btn} onClick={() => onCommit(reviveCombatant(encounter, c.id, 1))}>
              Revive at 1 HP
            </button>
            <button type="button" className={styles.btnDanger} onClick={() => onCommit(removeCombatant(encounter, c.id))}>
              Remove from encounter
            </button>
          </div>
        )}

        {down && !out && !ended && (
          <div className={enc.alert}>
            <span>
              {c.hp.stable
                ? 'Stable at 0 HP.'
                : `Death Saving Throws: ${c.hp.deathSaves.successes} successes, ${c.hp.deathSaves.failures} failures.`}
            </span>
            {!c.hp.stable && (
              <span className={styles.row}>
                <label className={styles.row}>
                  <span className={styles.fieldLabel}>d20</span>
                  <input
                    className={`${styles.input} ${enc.amount}`}
                    type="number"
                    min={1}
                    max={20}
                    aria-label={`Death save d20 for ${c.name}`}
                    value={saveD20}
                    onChange={(e) => setSaveD20(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    onCommit(recordDeathSave(encounter, c.id, Number(saveD20)));
                    setSaveD20('');
                  }}
                  disabled={!(Number(saveD20) >= 1 && Number(saveD20) <= 20)}
                >
                  Record save
                </button>
                <button type="button" className={styles.btn} onClick={() => onCommit(stabilizeCombatant(encounter, c.id))}>
                  Stabilize
                </button>
              </span>
            )}
          </div>
        )}

        {open && !ended && !out && (
          <div className={enc.more}>
            <div className={enc.group}>
              <span className={enc.groupTitle}>Damage details</span>
              {defences.length > 0 && <span className={styles.muted}>{defences.join(' · ')}</span>}
              <div className={styles.row}>
                <label className={styles.field} style={{ flex: '0 1 180px' }}>
                  <span className={styles.fieldLabel}>Damage type</span>
                  <select
                    className={styles.input}
                    aria-label={`Damage type for ${c.name}`}
                    value={type}
                    onChange={(e) => pickType(e.target.value)}
                  >
                    <option value="">No type</option>
                    {DAMAGE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={enc.checkRow}>
                  <input type="checkbox" checked={resist} onChange={(e) => setResist(e.target.checked)} /> Resistance (half)
                </label>
                <label className={enc.checkRow}>
                  <input type="checkbox" checked={vuln} onChange={(e) => setVuln(e.target.checked)} /> Vulnerability (double)
                </label>
                <label className={enc.checkRow}>
                  <input type="checkbox" checked={immune} onChange={(e) => setImmune(e.target.checked)} /> Immune
                </label>
                <label className={enc.checkRow}>
                  <input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} /> Critical hit
                </label>
              </div>
              <span className={styles.muted}>
                Resistance halves (round down) before Vulnerability doubles. Tick the boxes for this hit; they apply to the
                next Damage press.
              </span>
            </div>

            <div className={enc.group}>
              <span className={enc.groupTitle}>Temporary Hit Points</span>
              <div className={styles.row}>
                <input
                  className={`${styles.input} ${enc.amount}`}
                  type="number"
                  min={0}
                  aria-label={`Temp HP for ${c.name}`}
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    onCommit(giveTempHp(encounter, c.id, Number(temp) || 0));
                    setTemp('');
                  }}
                >
                  Give Temp HP
                </button>
                <span className={styles.muted}>Temp HP never stack: the larger amount is kept.</span>
              </div>
            </div>

            <div className={enc.group}>
              <span className={enc.groupTitle}>Conditions</span>
              <div className={styles.row}>
                <select
                  className={styles.input}
                  style={{ flex: '0 1 200px' }}
                  aria-label={`Condition for ${c.name}`}
                  value={condId}
                  onChange={(e) => setCondId(e.target.value)}
                >
                  {TRACKABLE.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                <input
                  className={`${styles.input} ${enc.amount}`}
                  type="number"
                  min={1}
                  placeholder="Rounds"
                  aria-label={`Condition rounds for ${c.name}`}
                  value={condRounds}
                  onChange={(e) => setCondRounds(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    onCommit(
                      addCondition(
                        encounter,
                        c.id,
                        condId as DmCombatCondition['id'],
                        condRounds.trim() === '' ? undefined : Number(condRounds),
                      ),
                    );
                    setCondRounds('');
                  }}
                >
                  Add condition
                </button>
              </div>
              <span className={styles.muted}>
                Leave Rounds empty for no countdown. A timed condition loses one round when each new round begins; the book
                sets no standard duration, so this is a reminder only.
              </span>
            </div>

            <div className={enc.group}>
              <span className={enc.groupTitle}>Concentration</span>
              <div className={styles.row}>
                <label className={enc.checkRow}>
                  <input
                    type="checkbox"
                    checked={c.concentration.active}
                    onChange={(e) => onCommit(setConcentration(encounter, c.id, e.target.checked, concLabel))}
                  />{' '}
                  Concentrating
                </label>
                <input
                  className={styles.input}
                  style={{ flex: '1 1 180px' }}
                  placeholder="On which spell (optional)"
                  aria-label={`Concentration spell for ${c.name}`}
                  value={concLabel}
                  onChange={(e) => setConcLabel(e.target.value)}
                  onBlur={() => {
                    if (c.concentration.active) onCommit(setConcentration(encounter, c.id, true, concLabel));
                  }}
                />
              </div>
            </div>

            <div className={enc.group}>
              <span className={enc.groupTitle}>Details</span>
              <div className={styles.row}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Name</span>
                  <input
                    key={`name-${c.id}-${c.name}`}
                    className={styles.input}
                    defaultValue={c.name}
                    onBlur={(e) => onCommit(renameCombatant(encounter, c.id, e.currentTarget.value))}
                  />
                </label>
                <label className={styles.field} style={{ flex: '0 1 120px' }}>
                  <span className={styles.fieldLabel}>Armor Class</span>
                  <input
                    className={styles.input}
                    type="number"
                    aria-label={`Armor Class for ${c.name}`}
                    value={c.ac}
                    onChange={(e) => onCommit(updateCombatant(encounter, c.id, { ac: Math.max(0, Math.trunc(Number(e.target.value)) || 0) }))}
                  />
                </label>
                {!setup && (
                  <label className={styles.field} style={{ flex: '0 1 120px' }}>
                    <span className={styles.fieldLabel}>Initiative</span>
                    <input
                      className={styles.input}
                      type="number"
                      aria-label={`Initiative for ${c.name}`}
                      value={c.initiative ?? ''}
                      onChange={(e) => onCommit(setInitiative(encounter, c.id, e.target.value === '' ? null : Number(e.target.value)))}
                    />
                  </label>
                )}
              </div>
              {(['resistances', 'vulnerabilities', 'immunities'] as const).map((key) => (
                <label key={key} className={styles.field}>
                  <span className={styles.fieldLabel}>
                    {key === 'resistances' ? 'Resistances' : key === 'vulnerabilities' ? 'Vulnerabilities' : 'Immunities'}
                  </span>
                  <input
                    key={`${key}-${c.id}`}
                    className={styles.input}
                    defaultValue={c[key]}
                    onBlur={(e) => onCommit(updateCombatant(encounter, c.id, { [key]: e.currentTarget.value.slice(0, 200) }))}
                  />
                </label>
              ))}
              <label className={enc.checkRow}>
                <input
                  type="checkbox"
                  checked={c.surprised}
                  onChange={(e) => onCommit(updateCombatant(encounter, c.id, { surprised: e.target.checked }))}
                />{' '}
                Surprised (Disadvantage on the Initiative roll)
              </label>
              {c.kind === 'monster' && (
                <label className={styles.field} style={{ flex: '0 1 220px' }}>
                  <span className={styles.fieldLabel}>XP value{c.cr ? ` (CR ${c.cr})` : ''}</span>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    aria-label={`XP value for ${c.name}`}
                    value={c.xp ?? ''}
                    placeholder="Not set"
                    onChange={(e) =>
                      onCommit(
                        updateCombatant(encounter, c.id, {
                          xp: e.target.value === '' ? undefined : Math.max(0, Math.trunc(Number(e.target.value)) || 0),
                        }),
                      )
                    }
                  />
                </label>
              )}
              {c.kind === 'monster' && (
                <label className={enc.checkRow}>
                  <input
                    type="checkbox"
                    checked={c.diesLikeCharacter}
                    onChange={(e) => onCommit(updateCombatant(encounter, c.id, { diesLikeCharacter: e.target.checked }))}
                  />{' '}
                  Make Death Saving Throws at 0 HP (instead of dying at once)
                </label>
              )}
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Notes</span>
                <textarea
                  key={`notes-${c.id}`}
                  className={styles.textarea}
                  style={{ minHeight: 70 }}
                  defaultValue={c.notes}
                  onBlur={(e) => onCommit(updateCombatant(encounter, c.id, { notes: e.currentTarget.value.slice(0, 1000) }))}
                />
              </label>
            </div>

            <div className={styles.row}>
              <button type="button" className={styles.btn} onClick={() => onCommit(moveCombatant(encounter, c.id, -1))}>
                Move earlier in the order
              </button>
              <button type="button" className={styles.btn} onClick={() => onCommit(moveCombatant(encounter, c.id, 1))}>
                Move later in the order
              </button>
              <button type="button" className={styles.btnDanger} onClick={() => onCommit(removeCombatant(encounter, c.id))}>
                Remove from encounter
              </button>
            </div>
          </div>
        )}

        {setup && !out && (
          <div className={styles.row}>
            <label className={enc.checkRow}>
              <input
                type="checkbox"
                checked={c.surprised}
                onChange={(e) => onCommit(updateCombatant(encounter, c.id, { surprised: e.target.checked }))}
              />{' '}
              Surprised
            </label>
            <button type="button" className={styles.btn} onClick={() => onCommit(moveCombatant(encounter, c.id, -1))} aria-label={`Move ${c.name} earlier`}>
              ↑
            </button>
            <button type="button" className={styles.btn} onClick={() => onCommit(moveCombatant(encounter, c.id, 1))} aria-label={`Move ${c.name} later`}>
              ↓
            </button>
            <button type="button" className={styles.btnDanger} onClick={() => onCommit(removeCombatant(encounter, c.id))} aria-label={`Remove ${c.name}`}>
              Remove
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
