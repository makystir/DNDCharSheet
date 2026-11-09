import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { Character, SidekickRecord } from '../../types/character';
import { ABILITY_NAMES } from '../../types/character';
import { CREATURE_CATALOG } from '../../data/creatures';
import { SIDEKICK_CLASSES, SIDEKICK_MAX_LEVEL } from '../../data/sidekicks';
import {
  creatureHitDie,
  martialRoleAttackBonus,
  sidekickAbilityScoreImprovements,
  sidekickAttacksPerAttackAction,
  sidekickFeatureDice,
  sidekickFeaturesAtLevel,
  sidekickFeatureUses,
  sidekickRow,
  sidekickSecondWindHealing,
  sidekickSpellcastingAtLevel,
  sidekickSpellcastingRole,
  sidekickStatAdjustment,
} from '../../logic/sidekick';
import { sidekickLevelUp, sidekickMaxHp } from '../../logic/companions';
import { trackedHpOf } from '../../logic/companions-actions';
import { rollDie } from '../../logic/dice';
import { createDefaultRng } from '../../logic/random';
import type { RNG } from '../../logic/random';
import { formatSigned } from '../../logic/breakdown';
import type { Breakdown } from '../../logic/breakdown';
import { catalogStatBlockModel } from '../../logic/stat-block-model';
import type { StatBlockModel, StatFeature } from '../../logic/stat-block-model';
import { resolveCompanionRuleTooltip, resolveSidekickFeatureTooltip } from '../../logic/tooltip-content';
import { CalculatedValue } from '../shared/CalculatedValue';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import { BlurInput } from './BlurInput';
import { SidekickDeathSaves } from './SidekickDeathSaves';
import { StatBlockView } from './StatBlockView';
import { TrackedVitals } from './TrackedVitals';
import styles from './CompanionsShared.module.css';

export const EDITION_MARK = "Tasha's 2020 (5e, 2014 rules)";

export interface SidekickCardProps {
  record: SidekickRecord;
  character: Character;
  onPatch: (id: string, patch: Partial<SidekickRecord>) => void;
  onDelete: (id: string) => void;
  rng?: RNG;
}

/** Add `delta` (the proficiency bonus rise) and a martial-role bonus to the printed attack bonuses and save DCs. */
function adjustFeatures(features: StatFeature[], delta: number, attackExtra: number): StatFeature[] {
  return features.map((f) => ({
    ...f,
    derived: f.derived.map((d) => {
      const isAttack = d.label === 'Attack bonus';
      const isSave = d.label === 'Save DC';
      if ((!isAttack && !isSave) || d.value.breakdown) return d;
      const printed = Number.parseInt(d.value.text, 10);
      if (!Number.isFinite(printed)) return d;
      const extra = isAttack ? attackExtra : 0;
      const total = printed + delta + extra;
      const components = [
        { label: 'Printed in the stat block', value: printed },
        { label: 'Sidekick proficiency bonus rise', value: delta },
        ...(isAttack ? [{ label: 'Martial Role (Attacker)', value: extra }] : []),
      ];
      const breakdown: Breakdown = { total, components, note: `${EDITION_MARK}: +1 per step the proficiency bonus has risen above the printed one.` };
      return {
        ...d,
        value: { text: isAttack ? formatSigned(total) : String(total), breakdown, breakdownLabel: `${f.name} ${d.label}` },
      };
    }),
  }));
}

/**
 * One sidekick (Tasha's 2020, 5e / 2014 rules). Same card pattern as the other
 * tabs. Shows the class table row, features by level with tooltips, the
 * Spellcaster numbers, the stat block with attack bonuses and DCs adjusted for
 * the sidekick's proficiency bonus, hit points, level-ups and death saves.
 * Ability score improvements are counted but not allocated (follow-up).
 */
export function SidekickCard({ record, character, onPatch, onDelete, rng }: SidekickCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [roll, setRoll] = useState('');
  const creature = CREATURE_CATALOG[record.creatureId];
  if (!creature) return null;

  const patch = (p: Partial<SidekickRecord>) => onPatch(record.id, p);
  const cls = SIDEKICK_CLASSES[record.classId];
  const name = record.nickname?.trim() || creature.name;
  const level = Math.min(SIDEKICK_MAX_LEVEL, Math.max(1, record.level));
  const row = sidekickRow(record.classId, level);
  const hpMax = sidekickMaxHp(record);
  const cur = trackedHpOf(record, hpMax);
  const hitDie = creatureHitDie(creature);
  const conMod = creature.abilities.con.mod ?? 0;
  const bodyId = `sidekick-body-${record.id}`;

  const adjustment = sidekickStatAdjustment(creature, record.classId, level);
  const attackExtra = record.classId === 'warrior' ? martialRoleAttackBonus(record.martialRole) : 0;
  const baseModel = catalogStatBlockModel(creature);
  const delta = adjustment?.delta ?? 0;
  const model: StatBlockModel = {
    ...baseModel,
    name,
    hp: { text: String(hpMax) },
    hpMax,
    traits: adjustFeatures(baseModel.traits, delta, attackExtra),
    actions: adjustFeatures(baseModel.actions, delta, attackExtra),
    bonusActions: adjustFeatures(baseModel.bonusActions, delta, attackExtra),
    reactions: adjustFeatures(baseModel.reactions, delta, attackExtra),
  };

  const features = sidekickFeaturesAtLevel(record.classId, level);
  const spell = record.classId === 'spellcaster' ? sidekickSpellcastingAtLevel(level) : null;
  const role = record.spellcastingRole ? sidekickSpellcastingRole(record.spellcastingRole) : null;
  const castMod = role ? creature.abilities[role.ability].mod : null;

  const levelUpRoll = Number.parseInt(roll, 10);
  const canLevelUp = level < SIDEKICK_MAX_LEVEL && Number.isInteger(levelUpRoll) && levelUpRoll >= 1 && (hitDie === null || levelUpRoll <= hitDie);
  const doLevelUp = () => {
    if (!canLevelUp) return;
    const next = sidekickLevelUp({ level, baseHpMax: record.baseHpMax, levelUps: record.levelUps }, levelUpRoll, conMod, hitDie ?? 20);
    if (!next) return;
    patch({ level: next.level, levelUps: next.levelUps });
    setRoll('');
  };

  return (
    <div className={styles.card} data-testid={`sidekick-${record.id}`}>
      <button type="button" className={styles.header} aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded((v) => !v)}>
        <span className={styles.nameLine}>{name}</span>
        <span className={styles.metaLine}>
          <span className={styles.badge}>{`${cls.name} ${level}`}</span>
          {record.nickname?.trim() && <span className={styles.badge}>{creature.name}</span>}
          <span className={styles.chip}>{`HP ${cur}/${hpMax}`}</span>
          {record.dead && <span className={styles.badgeWarn}>Dead</span>}
          <ChevronDown size={16} aria-hidden="true" className={expanded ? styles.chevronOpen : styles.chevron} />
        </span>
      </button>

      {expanded && (
        <div className={styles.body} id={bodyId}>
          <p className={styles.notice}>{EDITION_MARK}</p>
          {character.level > level && (
            <p className={styles.hint} role="status">
              {`Your level is ${character.level}; this sidekick is level ${level}. The book says it gains a level when the group's average level rises. Record it with Level up below.`}
            </p>
          )}

          <div className={styles.row}>
            <label className={styles.field}>
              Nickname
              <BlurInput className={styles.control} value={record.nickname} maxLength={80} ariaLabel={`${name} nickname`} onCommit={(v) => patch({ nickname: typeof v === 'string' ? v : undefined })} />
            </label>
            {record.classId === 'warrior' && (
              <label className={styles.field}>
                Martial Role
                <select className={styles.control} value={record.martialRole ?? ''} aria-label={`${name} Martial Role`} onChange={(e) => patch({ martialRole: (e.target.value || undefined) as SidekickRecord['martialRole'] })}>
                  <option value="">Not chosen</option>
                  <option value="Attacker">Attacker (+2 to attack rolls)</option>
                  <option value="Defender">Defender</option>
                </select>
              </label>
            )}
            {record.classId === 'spellcaster' && (
              <label className={styles.field}>
                Spellcasting Role
                <select className={styles.control} value={record.spellcastingRole ?? ''} aria-label={`${name} Spellcasting Role`} onChange={(e) => patch({ spellcastingRole: (e.target.value || undefined) as SidekickRecord['spellcastingRole'] })}>
                  <option value="">Not chosen</option>
                  <option value="Mage">Mage</option>
                  <option value="Healer">Healer</option>
                  <option value="Prodigy">Prodigy</option>
                </select>
              </label>
            )}
          </div>

          <div className={styles.figure}>
            <span className={styles.figureLabel}>Proficiency Bonus:</span>
            <CalculatedValue
              label={`${name} Proficiency Bonus`}
              breakdown={{ total: row.proficiencyBonus, components: [{ label: `${cls.name} table, level ${level}`, value: row.proficiencyBonus }] }}
            >
              {formatSigned(row.proficiencyBonus)}
            </CalculatedValue>
            {adjustment && (
              <MaybeContentTooltip content={resolveCompanionRuleTooltip('sidekick-stat-adjustment')} className={styles.chip} ariaLabel="About the attack and DC adjustment">
                {`Attacks and DCs ${formatSigned(adjustment.delta)} vs stat block`}
              </MaybeContentTooltip>
            )}
          </div>

          <h4 className={styles.sectionTitle}>{`${cls.name} table, level ${level}`}</h4>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Level</th>
                  <th scope="col">Proficiency Bonus</th>
                  <th scope="col">Features</th>
                  {spell && (
                    <>
                      <th scope="col">Cantrips</th>
                      <th scope="col">Spells Known</th>
                      <th scope="col">Slots (1st-5th)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{row.level}</td>
                  <td>{formatSigned(row.proficiencyBonus)}</td>
                  <td>{row.features.join(', ') || '-'}</td>
                  {spell && (
                    <>
                      <td>{spell.cantripsKnown}</td>
                      <td>{spell.spellsKnownInferred ? `${spell.spellsKnown} (inferred)` : spell.spellsKnown}</td>
                      <td>{spell.slots.join(' / ')}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
          <p className={styles.figure}>
            {`Ability Score Improvements so far: ${sidekickAbilityScoreImprovements(record.classId, level)} (record which abilities you raised in the notes)`}
          </p>

          {spell && (
            <div className={styles.figure}>
              {role && castMod !== null ? (
                <>
                  <span className={styles.figureLabel}>{`Spellcasting ability: ${ABILITY_NAMES[role.ability]}.`}</span>
                  <span className={styles.figureLabel}>Spell save DC:</span>
                  <CalculatedValue
                    label={`${name} spell save DC`}
                    breakdown={{
                      total: 8 + row.proficiencyBonus + castMod,
                      components: [
                        { label: 'Base', value: 8 },
                        { label: 'Proficiency Bonus', value: row.proficiencyBonus },
                        { label: `${ABILITY_NAMES[role.ability]} modifier`, value: castMod },
                      ],
                    }}
                  >
                    {8 + row.proficiencyBonus + castMod}
                  </CalculatedValue>
                  <span className={styles.figureLabel}>Spell attack:</span>
                  <CalculatedValue
                    label={`${name} spell attack modifier`}
                    breakdown={{
                      total: row.proficiencyBonus + castMod,
                      components: [
                        { label: 'Proficiency Bonus', value: row.proficiencyBonus },
                        { label: `${ABILITY_NAMES[role.ability]} modifier`, value: castMod },
                      ],
                    }}
                  >
                    {formatSigned(row.proficiencyBonus + castMod)}
                  </CalculatedValue>
                </>
              ) : (
                <span className={styles.figureLabel}>Choose a Spellcasting Role to see the spell save DC and attack.</span>
              )}
            </div>
          )}

          <h4 className={styles.sectionTitle}>Features</h4>
          <ul className={styles.featureList}>
            {features.map((f) => {
              const uses = sidekickFeatureUses(f, level);
              const dice = sidekickFeatureDice(f, level);
              return (
                <li key={f.id}>
                  <span className={styles.featureLevel}>{`Lv ${f.level}`}</span>
                  <MaybeContentTooltip content={resolveSidekickFeatureTooltip(record.classId, f.id, level)}>{f.name}</MaybeContentTooltip>
                  {uses !== null && ` (${uses} use${uses === 1 ? '' : 's'})`}
                  {dice !== null && ` ${dice}`}
                  {f.id === 'warrior.extra-attack' && ` (${sidekickAttacksPerAttackAction(level)} attacks per Attack action)`}
                  {f.id === 'warrior.second-wind' && ` (heals ${sidekickSecondWindHealing(level).dice} + ${sidekickSecondWindHealing(level).flat})`}
                </li>
              );
            })}
          </ul>

          <h4 className={styles.sectionTitle}>Hit points and levels</h4>
          <TrackedVitals
            record={record}
            max={hpMax}
            maxBreakdown={{
              total: hpMax,
              components: [
                { label: `Entered at level ${record.levelUps.length === 0 ? level : level - record.levelUps.length}`, value: record.baseHpMax },
                ...record.levelUps.map((l) => ({ label: `Level ${l.level} (rolled ${l.roll} + Con, minimum 1)`, value: l.hpGained })),
              ],
            }}
            subject={name}
            zeroHpRule="monster-death"
            onPatch={(p) => patch(p)}
          />
          <div className={styles.row}>
            <label className={styles.field}>
              {`Hit Die roll${hitDie ? ` (d${hitDie})` : ''}`}
              <input
                type="number"
                className={`${styles.control} ${styles.controlNarrow}`}
                min={1}
                max={hitDie ?? undefined}
                value={roll}
                aria-label={`${name} level-up Hit Die roll`}
                onChange={(e) => setRoll(e.target.value)}
              />
            </label>
            {hitDie !== null && (
              <button type="button" className={styles.btn} onClick={() => setRoll(String(rollDie(rng ?? createDefaultRng(), hitDie)))}>
                Roll d{hitDie}
              </button>
            )}
            <button type="button" className={styles.btn} disabled={!canLevelUp} onClick={doLevelUp}>
              {`Level up to ${Math.min(SIDEKICK_MAX_LEVEL, level + 1)}`}
            </button>
          </div>
          <p className={styles.figure}>{`Hit points gained on a level up: the Hit Die roll plus Constitution modifier (${formatSigned(conMod)}), minimum 1.`}</p>

          {cur === 0 && <SidekickDeathSaves record={record} subject={name} onPatch={patch} />}

          <StatBlockView model={model} hideName />

          <label className={styles.field}>
            Notes
            <textarea className={styles.textarea} value={record.notes ?? ''} maxLength={2000} placeholder="Notes..." aria-label={`${name} notes`} onChange={(e) => patch({ notes: e.target.value || undefined })} />
          </label>

          <div className={styles.footer}>
            <button type="button" className={styles.deleteBtn} onClick={() => onDelete(record.id)}>
              <Trash2 size={14} aria-hidden="true" /> {`Remove ${name}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
