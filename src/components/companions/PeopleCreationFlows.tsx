import { useState } from 'react';
import type { Character, CustomStatBlock, HirelingRecord, NpcPartyMemberRecord, SidekickRecord } from '../../types/character';
import { CREATURE_LIST } from '../../data/creatures';
import { SIDEKICK_CLASSES, SIDEKICK_CLASS_IDS, SIDEKICK_MAX_LEVEL, SIDEKICK_MIN_LEVEL } from '../../data/sidekicks';
import type { SidekickClassId } from '../../data/sidekicks';
import {
  clampHirelingUnits,
  HIRELING_RATES,
  HIRELING_UNITS_MAX,
  hirelingUnitName,
  npcChallengeRatingCheck,
  npcMaxChallengeRating,
  sidekickDefaultStartLevel,
} from '../../logic/companions';
import type { HirelingKind } from '../../logic/companions';
import { HIRELING_KIND_LABELS } from '../../logic/companion-model';
import type { NpcTemplate } from '../../logic/companion-model';
import { parseChallengeRating, sidekickEligibility } from '../../logic/sidekick';
import { generateUUID } from '../../logic/uuid';
import { AddDialog } from './AddDialog';
import { EDITION_MARK } from './SidekickCard';
import dialogStyles from './CompanionCreationFlow.module.css';
import styles from './CompanionsShared.module.css';

/** Add a hireling (PHB 2024 services table, L10523-10533). */
export function HirelingCreationFlow({ onConfirm, onCancel }: { onConfirm: (record: HirelingRecord) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<HirelingKind>('skilled');
  const [name, setName] = useState('');
  const [units, setUnits] = useState('1');
  const unit = hirelingUnitName(kind);

  const confirm = () => {
    const n = name.trim().slice(0, 80);
    if (!n) return;
    const parsed = Number.parseInt(units, 10);
    onConfirm({ id: generateUUID(), name: n, kind, units: Number.isFinite(parsed) ? clampHirelingUnits(parsed) : 0 });
  };

  return (
    <AddDialog title="Add hireling" confirmLabel="Add hireling" confirmDisabled={name.trim() === ''} onConfirm={confirm} onCancel={onCancel}>
      <label className={dialogStyles.field}>
        Kind
        <select className={dialogStyles.control} value={kind} onChange={(e) => setKind(e.target.value as HirelingKind)}>
          {(Object.keys(HIRELING_KIND_LABELS) as HirelingKind[]).map((k) => (
            <option key={k} value={k}>
              {`${HIRELING_KIND_LABELS[k]} (${HIRELING_RATES[k].printed})`}
            </option>
          ))}
        </select>
      </label>
      <label className={dialogStyles.field}>
        Name
        <input type="text" className={dialogStyles.control} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={dialogStyles.field}>
        {unit === 'day' ? 'Days hired' : 'Miles'}
        <input
          type="number"
          className={dialogStyles.control}
          min={0}
          max={HIRELING_UNITS_MAX}
          value={units}
          onChange={(e) => setUnits(e.target.value)}
        />
      </label>
    </AddDialog>
  );
}

/** "1/2" for 0.5, "1.5" for level 3, "10" for level 20 (the exact half-level limit). */
function formatCrLimit(maxCr: number): string {
  return maxCr === 0.5 ? '1/2' : String(maxCr);
}

/** Add an NPC party member (DMG 2024 L833, L3553-3557). */
export function NpcCreationFlow({
  templates,
  partyLevel,
  onConfirm,
  onCancel,
}: {
  templates: readonly NpcTemplate[];
  /** The character's level: the party level for the DMG Challenge Rating guideline. */
  partyLevel: number;
  onConfirm: (record: NpcPartyMemberRecord) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [templateId, setTemplateId] = useState('');
  // MM 2024 humanoid NPCs are "Medium or Small"; the user picks one.
  const [size, setSize] = useState<'Medium' | 'Small'>('Medium');

  const template = templates.find((t) => t.id === templateId);
  const maxCr = npcMaxChallengeRating(partyLevel);
  const byCr = [...templates].sort(
    (a, b) => (parseChallengeRating(a.stats.cr) ?? 0) - (parseChallengeRating(b.stats.cr) ?? 0) || a.name.localeCompare(b.name),
  );
  const within = byCr.filter((t) => npcChallengeRatingCheck(t.stats.cr, partyLevel).status !== 'exceeds');
  const above = byCr.filter((t) => npcChallengeRatingCheck(t.stats.cr, partyLevel).status === 'exceeds');
  const templateCheck = template ? npcChallengeRatingCheck(template.stats.cr, partyLevel) : null;

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t && name.trim() === '') setName(t.name);
  };

  const confirm = () => {
    const n = name.trim().slice(0, 80);
    if (!n) return;
    const record: NpcPartyMemberRecord = { id: generateUUID(), name: n };
    const r = role.trim().slice(0, 80);
    if (r) record.role = r;
    // A deep copy, so later edits never touch the shared template data.
    if (template) record.stats = { ...(JSON.parse(JSON.stringify(template.stats)) as CustomStatBlock), size };
    onConfirm(record);
  };

  const option = (t: NpcTemplate) => (
    <option key={t.id} value={t.id}>
      {`${t.name} (CR ${t.stats.cr ?? '?'})`}
    </option>
  );

  return (
    <AddDialog title="Add NPC party member" confirmLabel="Add member" confirmDisabled={name.trim() === ''} onConfirm={confirm} onCancel={onCancel}>
      <label className={dialogStyles.field}>
        Name
        <input type="text" className={dialogStyles.control} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className={dialogStyles.field}>
        Role (optional)
        <input type="text" className={dialogStyles.control} value={role} maxLength={80} onChange={(e) => setRole(e.target.value)} />
      </label>
      {templates.length > 0 && (
        <>
          <label className={dialogStyles.field}>
            Start from template
            <select className={dialogStyles.control} value={templateId} onChange={(e) => chooseTemplate(e.target.value)}>
              <option value="">Blank stat block</option>
              {within.length > 0 && <optgroup label={`Within the guideline (CR ${formatCrLimit(maxCr)} or lower)`}>{within.map(option)}</optgroup>}
              {above.length > 0 && <optgroup label="Above half your level">{above.map(option)}</optgroup>}
            </select>
          </label>
          <p className={styles.hint}>
            Monster Manual NPC stat blocks. DMG guideline: pick one whose Challenge Rating is no higher than half the
            characters&apos; level (CR {formatCrLimit(maxCr)} at level {partyLevel}) so the NPC doesn&apos;t overshadow the
            party. Everything stays editable afterwards.
          </p>
          {template && (
            <>
              <p className={styles.hint} data-testid="npc-template-summary">
                {`${template.name}: CR ${template.stats.cr}, AC ${template.stats.ac}, HP ${template.stats.hpMax} (${template.hpDice}), Monster Manual p.${template.page}.`}
              </p>
              {templateCheck?.status === 'exceeds' && (
                <p className={styles.hint} role="note">
                  {templateCheck.message}
                </p>
              )}
              <label className={dialogStyles.field}>
                Size (the Monster Manual gives Medium or Small)
                <select className={dialogStyles.control} value={size} onChange={(e) => setSize(e.target.value === 'Small' ? 'Small' : 'Medium')}>
                  <option value="Medium">Medium</option>
                  <option value="Small">Small</option>
                </select>
              </label>
            </>
          )}
        </>
      )}
    </AddDialog>
  );
}

/** Add a Tasha's sidekick (2020; 5e, 2014 rules; house rule). */
export function SidekickCreationFlow({
  character,
  onConfirm,
  onCancel,
}: {
  character: Character;
  onConfirm: (record: SidekickRecord) => void;
  onCancel: () => void;
}) {
  const [classId, setClassId] = useState<SidekickClassId>('warrior');
  const [creatureId, setCreatureId] = useState(() => CREATURE_LIST.find((c) => sidekickEligibility(c, 'warrior').eligible)?.id ?? CREATURE_LIST[0].id);
  const [level, setLevel] = useState(String(sidekickDefaultStartLevel(character.level)));
  const [hpInput, setHpInput] = useState<string | null>(null);

  const creature = CREATURE_LIST.find((c) => c.id === creatureId) ?? CREATURE_LIST[0];
  const eligibility = sidekickEligibility(creature, classId);
  const parsedLevel = Number.parseInt(level, 10);
  const levelOk = Number.isInteger(parsedLevel) && parsedLevel >= SIDEKICK_MIN_LEVEL && parsedLevel <= SIDEKICK_MAX_LEVEL;
  const average = 'average' in creature.hp ? creature.hp.average : null;
  // The book only defines hit points at level 1 (the stat block); above that the user enters them.
  const hpText = hpInput ?? (parsedLevel === 1 && average !== null ? String(average) : '');
  const hp = Number.parseInt(hpText, 10);
  const hpOk = Number.isInteger(hp) && hp >= 1 && hp <= 99999;

  const confirm = () => {
    if (!eligibility.eligible || !levelOk || !hpOk) return;
    onConfirm({ id: generateUUID(), creatureId, classId, level: parsedLevel, baseHpMax: hp, levelUps: [] });
  };

  return (
    <AddDialog title="Add sidekick" confirmLabel="Add sidekick" confirmDisabled={!eligibility.eligible || !levelOk || !hpOk} onConfirm={confirm} onCancel={onCancel}>
      <p className={styles.notice}>{EDITION_MARK}</p>
      <label className={dialogStyles.field}>
        Sidekick class
        <select
          className={dialogStyles.control}
          value={classId}
          onChange={(e) => {
            const next = e.target.value as SidekickClassId;
            setClassId(next);
            const current = CREATURE_LIST.find((c) => c.id === creatureId);
            if (!current || !sidekickEligibility(current, next).eligible) {
              setCreatureId(CREATURE_LIST.find((c) => sidekickEligibility(c, next).eligible)?.id ?? creatureId);
            }
          }}
        >
          {SIDEKICK_CLASS_IDS.map((id) => (
            <option key={id} value={id}>
              {SIDEKICK_CLASSES[id].name}
            </option>
          ))}
        </select>
      </label>
      <label className={dialogStyles.field}>
        Creature
        <select className={dialogStyles.control} value={creatureId} onChange={(e) => setCreatureId(e.target.value)}>
          {CREATURE_LIST.map((c) => {
            const ok = sidekickEligibility(c, classId).eligible;
            return (
              <option key={c.id} value={c.id} disabled={!ok}>
                {ok ? c.name : `${c.name} (not eligible)`}
              </option>
            );
          })}
        </select>
      </label>
      {!eligibility.eligible && (
        <p className={dialogStyles.warning} role="alert">
          {eligibility.reasons.join('. ')}
        </p>
      )}
      <label className={dialogStyles.field}>
        {`Starting level (defaults to your level, ${character.level})`}
        <input type="number" className={dialogStyles.control} min={SIDEKICK_MIN_LEVEL} max={SIDEKICK_MAX_LEVEL} value={level} onChange={(e) => setLevel(e.target.value)} />
      </label>
      <label className={dialogStyles.field}>
        {parsedLevel === 1 ? 'Hit Points maximum (from the stat block)' : 'Hit Points maximum (you enter it: the book does not define it above level 1)'}
        <input type="number" className={dialogStyles.control} min={1} max={99999} value={hpText} onChange={(e) => setHpInput(e.target.value)} />
      </label>
    </AddDialog>
  );
}
