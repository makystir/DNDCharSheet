import { useRef, useState } from 'react';
import type { Character, CompanionOrigin, CompanionRecord, CompanionSpiritType } from '../../types/character';
import { creatureOptionsForOrigin, ORIGIN_LABELS } from '../../logic/companion-model';
import { primalCompanionOwner } from '../../logic/companion-view';
import {
  OTHERWORLDLY_STEED_MAX_SPELL_LEVEL,
  OTHERWORLDLY_STEED_MIN_SPELL_LEVEL,
  OTHERWORLDLY_STEED_TYPES,
} from '../../logic/primal-companion';
import { generateUUID } from '../../logic/uuid';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import styles from './CompanionCreationFlow.module.css';

export interface CompanionCreationFlowProps {
  character: Character;
  onConfirm: (record: CompanionRecord) => void;
  onCancel: () => void;
}

const ORIGINS: CompanionOrigin[] = [
  'primal-companion',
  'find-familiar',
  'pact-of-the-chain',
  'wild-companion',
  'find-steed',
  'animate-dead',
  'pet',
];

const SPELL_LEVELS = Array.from(
  { length: OTHERWORLDLY_STEED_MAX_SPELL_LEVEL - OTHERWORLDLY_STEED_MIN_SPELL_LEVEL + 1 },
  (_, i) => OTHERWORLDLY_STEED_MIN_SPELL_LEVEL + i,
);

/**
 * Modal for adding a companion. Deviation from the WFRP HirelingCreationFlow
 * wizard: a single form step, because the choices are few (origin, creature and
 * a couple of origin options). The Primal Companion warning is shown here and on
 * the card; it never blocks adding.
 */
export function CompanionCreationFlow({ character, onConfirm, onCancel }: CompanionCreationFlowProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);
  useBodyScrollLock(true);

  const [origin, setOrigin] = useState<CompanionOrigin>('primal-companion');
  const [creatureId, setCreatureId] = useState<string>(() => creatureOptionsForOrigin('primal-companion')[0]?.id ?? '');
  const [nickname, setNickname] = useState('');
  const [spellSlotLevel, setSpellSlotLevel] = useState(OTHERWORLDLY_STEED_MIN_SPELL_LEVEL);
  const [spiritType, setSpiritType] = useState<CompanionSpiritType | ''>('');

  const options = creatureOptionsForOrigin(origin);
  const ownerWarning = origin === 'primal-companion' ? primalCompanionOwner(character).warning : undefined;

  const changeOrigin = (next: CompanionOrigin) => {
    setOrigin(next);
    setCreatureId(creatureOptionsForOrigin(next)[0]?.id ?? '');
  };

  const confirm = () => {
    if (!creatureId) return;
    const record: CompanionRecord = { id: generateUUID(), creatureId, origin };
    const nick = nickname.trim().slice(0, 80);
    if (nick) record.nickname = nick;
    if (origin === 'find-steed') {
      record.spellSlotLevel = spellSlotLevel;
      if (spiritType) record.steedType = spiritType;
    }
    if ((origin === 'find-familiar' || origin === 'pact-of-the-chain') && spiritType) record.familiarType = spiritType;
    onConfirm(record);
  };

  return (
    <div className={styles.overlay} onClick={onCancel} role="dialog" aria-modal="true" aria-label="Add companion">
      <div
        ref={dialogRef}
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      >
        <h3 className={styles.title}>Add Companion</h3>

        <label className={styles.field}>
          Source
          <select className={styles.control} value={origin} onChange={(e) => changeOrigin(e.target.value as CompanionOrigin)}>
            {ORIGINS.map((o) => (
              <option key={o} value={o}>
                {ORIGIN_LABELS[o]}
              </option>
            ))}
          </select>
        </label>

        {origin !== 'find-steed' && (
          <label className={styles.field}>
            Creature
            <select className={styles.control} value={creatureId} onChange={(e) => setCreatureId(e.target.value)}>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {origin === 'find-steed' && (
          <label className={styles.field}>
            Spell slot level
            <select className={styles.control} value={spellSlotLevel} onChange={(e) => setSpellSlotLevel(Number(e.target.value))}>
              {SPELL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}

        {(origin === 'find-steed' || origin === 'find-familiar' || origin === 'pact-of-the-chain') && (
          <label className={styles.field}>
            {origin === 'find-steed' ? 'Steed type' : 'Familiar type'}
            <select className={styles.control} value={spiritType} onChange={(e) => setSpiritType(e.target.value as CompanionSpiritType | '')}>
              <option value="">Choose later</option>
              {OTHERWORLDLY_STEED_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={styles.field}>
          Nickname (optional)
          <input
            type="text"
            className={styles.control}
            value={nickname}
            maxLength={80}
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>

        {ownerWarning && (
          <p className={styles.warning} role="alert">
            {ownerWarning}
          </p>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.confirmBtn} disabled={!creatureId} onClick={confirm}>
            Add companion
          </button>
        </div>
      </div>
    </div>
  );
}
