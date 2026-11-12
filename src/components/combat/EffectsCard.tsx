import { useState } from 'react';
import { Timer, Plus } from 'lucide-react';
import type { Character } from '../../types/character';
import {
  MAX_EFFECTS,
  MAX_EFFECT_NAME,
  addEffect,
  extendEffect,
  removeEffect,
  tickEffect,
  trackedEffects,
} from '../../logic/combat-effects';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { EmptyState } from '../shared/EmptyState';
import styles from './EffectsCard.module.css';

export interface EffectsCardProps {
  character: Character;
  onChange: (next: Character) => void;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `effect-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Effects the player is tracking in a fight (Bless, Rage, a spell's duration...).
 * Name them, give a number of rounds if they have one, and "Next round" on the
 * round card counts them down. Bookkeeping only: the app never applies what an
 * effect does. A round is about 6 seconds, so 1 minute is 10 rounds.
 */
export function EffectsCard({ character, onChange }: EffectsCardProps) {
  const [name, setName] = useState('');
  const [rounds, setRounds] = useState('');
  const [status, setStatus] = useState('');
  const effects = trackedEffects(character);

  const parsedRounds = rounds.trim() === '' ? undefined : Number(rounds);
  const roundsValid =
    parsedRounds === undefined || (Number.isInteger(parsedRounds) && parsedRounds >= 1);
  const canAdd = name.trim() !== '' && roundsValid && effects.length < MAX_EFFECTS;

  const add = () => {
    if (!canAdd) return;
    onChange(addEffect(character, { name, rounds: parsedRounds }, newId()));
    setStatus(`Added ${name.trim()}.`);
    setName('');
    setRounds('');
  };

  return (
    <Card>
      <SectionHeader icon={Timer} title="Effects" />
      <p className={styles.hint}>
        Track spells and features that last a number of rounds (1 minute is 10 rounds). Next
        round counts them down.
      </p>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>Effect</span>
          <input
            className={styles.input}
            type="text"
            value={name}
            maxLength={MAX_EFFECT_NAME}
            placeholder="Bless, Rage, Haste..."
            aria-label="Effect name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className={styles.fieldSmall}>
          <span className={styles.label}>Rounds</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            inputMode="numeric"
            value={rounds}
            placeholder="none"
            aria-label="Effect rounds"
            onChange={(e) => setRounds(e.target.value)}
          />
        </label>
        <button type="submit" className={styles.addBtn} disabled={!canAdd} aria-label="Add effect">
          <Plus size={16} aria-hidden="true" /> Add
        </button>
      </form>
      {!roundsValid && (
        <p className={styles.error} role="note">
          Rounds must be a whole number of 1 or more, or left empty for no timer.
        </p>
      )}

      <div role="status" aria-live="polite" className={styles.srOnly}>
        {status}
      </div>

      {effects.length === 0 ? (
        <EmptyState compact icon={Timer} heading="No effects" description="Nothing is being tracked." />
      ) : (
        <ul className={styles.list} aria-label="Tracked effects">
          {effects.map((e) => (
            <li key={e.id} className={styles.item}>
              <div className={styles.info}>
                <strong>{e.name}</strong>
                <span className={styles.muted}>
                  {e.rounds === undefined
                    ? 'No timer'
                    : `${e.rounds} ${e.rounds === 1 ? 'round' : 'rounds'} left`}
                </span>
              </div>
              <div className={styles.actions}>
                {e.rounds !== undefined && (
                  <>
                    <button
                      type="button"
                      className={styles.btn}
                      aria-label={`Take a round off ${e.name}`}
                      onClick={() => {
                        const r = tickEffect(character, e.id);
                        onChange(r.character);
                        setStatus(
                          r.expired.length > 0 ? `${e.name} ended.` : `${e.name}: one round used.`,
                        );
                      }}
                    >
                      −1
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      aria-label={`Add a round to ${e.name}`}
                      onClick={() => onChange(extendEffect(character, e.id))}
                    >
                      +1
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={styles.btn}
                  aria-label={`End ${e.name}`}
                  onClick={() => {
                    onChange(removeEffect(character, e.id));
                    setStatus(`${e.name} ended.`);
                  }}
                >
                  End
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
