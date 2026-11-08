import { useState } from 'react';
import type { Character, ClassChoiceKey, SkillId } from '../../../types/character';
import { SKILLS } from '../../../types/character';
import {
  choiceOwedBreakdown,
  choiceStatus,
  formatInvocationEntry,
  invocationEligibility,
  parseInvocationEntry,
  removeClassChoice,
  setClassChoice,
  toggleClassChoice,
  CLASS_CHOICE_GRANTS,
} from '../../../logic/class-choices';
import type { ChoiceStatus } from '../../../logic/class-choices';
import { choiceOptionViews } from '../../../logic/class-choice-options';
import type { ChoiceOptionView } from '../../../logic/class-choice-options';
import { multiclassPickStatus } from '../../../logic/multiclass-picks';
import type { MulticlassPick } from '../../../logic/multiclass-picks';
import { INVOCATION_CATALOG } from '../../../data/invocations';
import { getClass } from '../../../data/classes';
import { CalculatedValue } from '../../shared/CalculatedValue';
import { ContentTooltip } from '../../shared/ContentTooltip';
import styles from './ClassChoicesPending.module.css';

interface PickerProps {
  character: Character;
  onChange: (next: Character) => void;
  status: ChoiceStatus;
}

const grantOf = (key: ClassChoiceKey) => CLASS_CHOICE_GRANTS.find((g) => g.key === key);

function OptionName({ option }: { option: ChoiceOptionView }) {
  return (
    <ContentTooltip
      content={{
        title: option.name,
        sections: [
          { label: 'Description', text: option.summary },
          { label: 'Source', text: option.source },
        ],
      }}
    >
      {option.name}
    </ContentTooltip>
  );
}

/** Display name of a stored entry ("agonizing-blast#fire-bolt" becomes "Agonizing Blast (fire-bolt)"). */
function entryName(options: ChoiceOptionView[], key: ClassChoiceKey, entry: string): string {
  if (key === 'warlock.invocations') {
    const { id, param } = parseInvocationEntry(entry);
    const name = options.find((o) => o.id === id)?.name ?? id;
    return param ? `${name} (${param})` : name;
  }
  return options.find((o) => o.id === entry)?.name ?? entry;
}

/** Repeatable invocations: add the invocation again with a different cantrip / Origin feat. */
function RepeatInvocation({ character, onChange, id, name }: { character: Character; onChange: (c: Character) => void; id: string; name: string }) {
  const [param, setParam] = useState('');
  const label = INVOCATION_CATALOG[id]?.param === 'origin-feat' ? 'Origin feat' : 'Cantrip';
  const add = () => {
    const value = param.trim();
    if (value.length === 0 || value.length > 40 || value.includes('#')) return;
    const entry = formatInvocationEntry(id, value);
    if ((character.classChoices?.['warlock.invocations'] ?? []).includes(entry)) return;
    onChange(toggleClassChoice(character, 'warlock.invocations', entry));
    setParam('');
  };
  return (
    <span className={styles.addRow}>
      <input
        className={styles.addInput}
        value={param}
        maxLength={40}
        aria-label={`${name}: ${label}`}
        placeholder={`${label} for another ${name}`}
        onChange={(e) => setParam(e.target.value)}
      />
      <button type="button" onClick={add} aria-label={`Add ${name} with ${label.toLowerCase()}`}>
        Add
      </button>
    </span>
  );
}

/** The option list of one choice group: checkboxes (radios for single picks), invocations show prerequisites. */
export function ChoiceGroupPicker({ character, onChange, status }: PickerProps) {
  const options = choiceOptionViews(character, status.key);
  const grant = grantOf(status.key);
  const held = status.entries;
  const heldBases = held.map((e) => parseInvocationEntry(e).id);
  const single = status.owed === 1 && status.key !== 'warlock.invocations';

  if (options.length === 0) {
    return (
      <span className={styles.hint}>
        {grant?.kind === 'spells'
          ? 'No eligible spells in your Wizard spellbook yet. Add spells on the Spells page.'
          : 'No options available.'}
      </span>
    );
  }
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{status.label}</legend>
      {options.map((option) => {
        const checked = held.includes(option.id);
        const isInvocation = status.key === 'warlock.invocations';
        const eligibility = isInvocation ? invocationEligibility(character, option.id, heldBases) : { ok: true, reasons: [] };
        const disabled = !checked && !eligibility.ok;
        const onToggle = () =>
          onChange(single ? setClassChoice(character, status.key, [option.id]) : toggleClassChoice(character, status.key, option.id));
        return (
          <span key={option.id} className={`${styles.option}${disabled ? ` ${styles.optionDisabled}` : ''}`}>
            <input
              type={single ? 'radio' : 'checkbox'}
              name={`choice-${status.key}`}
              aria-label={option.name}
              checked={checked}
              disabled={disabled}
              onChange={onToggle}
            />
            <OptionName option={option} />
            {disabled && <span className={styles.reason}>({eligibility.reasons.join('; ')})</span>}
            {isInvocation && INVOCATION_CATALOG[option.id]?.repeatable && (
              <RepeatInvocation character={character} onChange={onChange} id={option.id} name={option.name} />
            )}
          </span>
        );
      })}
    </fieldset>
  );
}

/** The chosen entries of a group with a Remove button each (the manual edit / swap affordance). */
function ChosenList({ character, onChange, status }: PickerProps) {
  const options = choiceOptionViews(character, status.key);
  if (status.entries.length === 0) return null;
  return (
    <ul className={styles.chosen} aria-label={`${status.label} chosen`}>
      {status.entries.map((entry) => {
        const name = entryName(options, status.key, entry);
        const bad = status.invalid.includes(entry);
        return (
          <li key={entry} className={styles.chip}>
            <span>{name}</span>
            {bad && <span className={styles.reason}>(prerequisite not met)</span>}
            <button
              type="button"
              className={styles.removeBtn}
              aria-label={`Remove ${name}`}
              onClick={() => onChange(removeClassChoice(character, status.key, entry))}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Class-feature choices owed but not yet made, as items for the Advancement
 * "Choices Pending" list (one per group). Same pattern as ExpertisePending.
 */
export function ClassChoicesPending({
  character,
  onChange,
  statuses,
}: {
  character: Character;
  onChange: (next: Character) => void;
  statuses?: ChoiceStatus[];
}) {
  const pending = (statuses ?? choiceStatus(character)).filter((s) => s.remaining > 0);
  return (
    <>
      {pending.map((status) => (
        <li key={status.key} className={styles.item} data-testid={`pending-choice-${status.key}`}>
          <span>
            Choose {status.remaining} more {status.label} ({status.chosen} of {status.owed} chosen)
          </span>
          <ChoiceGroupPicker character={character} onChange={onChange} status={status} />
        </li>
      ))}
    </>
  );
}

/** Non-blocking warning when more is picked than the class grants, or a held pick fails a prerequisite. */
export function ClassChoicesOverNote({ statuses }: { statuses: ChoiceStatus[] }) {
  const over = statuses.filter((s) => s.over > 0);
  const invalid = statuses.filter((s) => s.invalid.length > 0);
  if (over.length === 0 && invalid.length === 0) return null;
  return (
    <>
      {over.map((s) => (
        <p key={`over-${s.key}`} className={styles.warning} role="note" data-testid={`choice-over-note-${s.key}`}>
          {s.label}: {s.chosen} chosen, but your class grants {s.owed}. Feats, subclass features or house
          rules can account for the difference; otherwise remove the extras.
        </p>
      ))}
      {invalid.map((s) => (
        <p key={`invalid-${s.key}`} className={styles.warning} role="note" data-testid={`choice-invalid-note-${s.key}`}>
          {s.label}: {s.invalid.length} pick{s.invalid.length === 1 ? '' : 's'} no longer valid (unknown or
          prerequisite not met). They are kept until you remove them.
        </p>
      ))}
    </>
  );
}

/**
 * The persistent "Class Choices" list: every group with its chosen values, the
 * owed count (with its derivation) and a picker for manual edits or swaps. The
 * PHB lets some choices be replaced on level-up or rest; this is a plain
 * editable list, no swap budget is tracked.
 */
export function ClassChoicesSection({
  character,
  onChange,
  statuses,
}: {
  character: Character;
  onChange: (next: Character) => void;
  statuses?: ChoiceStatus[];
}) {
  const all = statuses ?? choiceStatus(character);
  if (all.length === 0) return null;
  return (
    <ul className={styles.sectionList} aria-label="Class choices">
      {all.map((status) => {
        const grant = grantOf(status.key);
        return (
          <li key={status.key} className={styles.sectionItem} data-testid={`class-choice-${status.key}`}>
            <div className={styles.sectionHead}>
              <span>{status.label}</span>
              <span className={styles.count}>
                <CalculatedValue label={`${status.label} owed`} breakdown={choiceOwedBreakdown(character, status.key)}>
                  {status.chosen} of {status.owed} chosen
                </CalculatedValue>
              </span>
              {grant?.swappable && (
                <span className={styles.count}>You can replace these when the rules allow; edit the list below.</span>
              )}
            </div>
            <ChosenList character={character} onChange={onChange} status={status} />
            <details>
              <summary>Edit {status.label}</summary>
              <ChoiceGroupPicker character={character} onChange={onChange} status={status} />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

// ── Multiclass skill / instrument picks ──────────────────────────────────────

function setEntrySkills(character: Character, classId: string, skills: SkillId[]): Character {
  return {
    ...character,
    classes: (character.classes ?? []).map((e) =>
      e.id === classId ? { ...e, skillChoices: skills.length > 0 ? skills : undefined } : e,
    ),
  };
}

function MulticlassSkillPicker({ character, onChange, pick }: { character: Character; onChange: (c: Character) => void; pick: MulticlassPick }) {
  const entry = (character.classes ?? []).find((e) => e.id === pick.classId);
  const current: SkillId[] = entry?.skillChoices ?? [];
  const className = getClass(pick.classId)?.name ?? pick.classId;
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{className} multiclass skill</legend>
      {SKILLS.filter((s) => pick.from?.includes(s.id)).map((skill) => (
        <label key={skill.id} className={styles.option}>
          <input
            type="checkbox"
            checked={current.includes(skill.id)}
            onChange={() =>
              onChange(
                setEntrySkills(
                  character,
                  pick.classId,
                  current.includes(skill.id) ? current.filter((s) => s !== skill.id) : [...current, skill.id],
                ),
              )
            }
          />
          {skill.name}
        </label>
      ))}
    </fieldset>
  );
}

/** Multiclass proficiency picks (Bard, Ranger, Rogue taken as a non-initial class) in Choices Pending. */
export function MulticlassPicksPending({
  character,
  onChange,
}: {
  character: Character;
  onChange: (next: Character) => void;
}) {
  const pending = multiclassPickStatus(character).filter((p) => p.remaining > 0);
  return (
    <>
      {pending.map((pick) => {
        const className = getClass(pick.classId)?.name ?? pick.classId;
        const noun = pick.kind === 'skill' ? 'skill' : 'Musical Instrument';
        const status: ChoiceStatus = {
          key: 'bard.multiclassInstrument',
          label: `${className} multiclass ${noun}`,
          owed: pick.owed,
          chosen: pick.chosen,
          remaining: pick.remaining,
          over: pick.over,
          invalid: [],
          duplicates: [],
          entries: character.classChoices?.['bard.multiclassInstrument'] ?? [],
        };
        return (
          <li key={`${pick.classId}-${pick.kind}`} className={styles.item} data-testid={`pending-multiclass-${pick.classId}-${pick.kind}`}>
            <span>
              Choose {pick.remaining} more {className} multiclass {noun} ({pick.chosen} of {pick.owed} chosen)
            </span>
            {pick.kind === 'skill' ? (
              <MulticlassSkillPicker character={character} onChange={onChange} pick={pick} />
            ) : (
              <ChoiceGroupPicker character={character} onChange={onChange} status={status} />
            )}
          </li>
        );
      })}
    </>
  );
}

/** Warning for multiclass picks beyond what the class grants (non-blocking). */
export function MulticlassPicksOverNote({ character }: { character: Character }) {
  const over = multiclassPickStatus(character).filter((p) => p.over > 0);
  if (over.length === 0) return null;
  return (
    <>
      {over.map((p) => (
        <p key={`${p.classId}-${p.kind}`} className={styles.warning} role="note" data-testid={`multiclass-over-${p.classId}-${p.kind}`}>
          {getClass(p.classId)?.name ?? p.classId} multiclass {p.kind}: {p.chosen} chosen, but the class grants{' '}
          {p.owed}. Remove the extras unless a feat or house rule gives more.
        </p>
      ))}
    </>
  );
}
