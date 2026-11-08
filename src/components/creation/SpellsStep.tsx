import { useMemo } from 'react';
import type { ClassSpellcasting } from '../../types/character';
import type { SpellId } from '../../data/spells';
import { getSpell } from '../../data/spells';
import { getClass } from '../../data/classes';
import { startingChoicesFor } from '../../logic/starting-choices';
import { startingSpellPools } from '../../logic/starting-spells';
import { SpellPickList } from '../shared/SpellPickList';
import styles from './CreationWizard.module.css';

export interface SpellsStepProps {
  classId: string;
  /** The picks so far, in the shape stored at character.spellcasting.byClass[classId]. */
  value: ClassSpellcasting;
  onChange: (next: ClassSpellcasting) => void;
}

/**
 * Wizard "Spells" step (casters only). Level-1 picks per startingChoicesFor:
 * cantrips, then for a Wizard a six-spell spellbook (PHB 2024 Wizard
 * "Spellbook", L7404-7408) and four prepared FROM it (L7412), or for every
 * other caster N prepared level 1 spells from the class list. 2024 has no
 * separate "memorize" step: every caster prepares its list. Nothing here blocks
 * Next: a short group is reminded about on the Overview.
 *
 * Always-prepared feature spells are shown locked and never count against the
 * prepared cap (same handling as the Spells page).
 */
export function SpellsStep({ classId, value, onChange }: SpellsStepProps) {
  const choices = startingChoicesFor(classId)?.spells ?? null;
  const pools = useMemo(() => startingSpellPools(classId), [classId]);
  const className = getClass(classId)?.name ?? 'class';
  if (!choices || !pools) return <p className={styles.hint}>This class has no level 1 spells.</p>;

  const usesBook = choices.spellbook !== null;
  const required = pools.required;
  const always = pools.alwaysPrepared;
  const storedCantrips = value.cantrips ?? [];
  const cantrips = [...required.filter((id) => !storedCantrips.includes(id)), ...storedCantrips];
  const book = value.spellbook ?? [];
  const prepared = (value.prepared ?? []).filter((id) => !always.includes(id));

  const toggleCantrip = (id: SpellId, checked: boolean) => {
    if (checked) {
      if (!pools.cantrips.some((s) => s.id === id)) return; // only the class cantrip list
      if (cantrips.includes(id) || cantrips.length >= choices.cantrips) return;
      onChange({ ...value, cantrips: [...cantrips, id] });
    } else {
      if (required.includes(id)) return;
      onChange({ ...value, cantrips: cantrips.filter((c) => c !== id) });
    }
  };

  const toggleBook = (id: SpellId, checked: boolean) => {
    const cap = choices.spellbook ?? 0;
    if (checked) {
      if (!pools.leveled.some((s) => s.id === id)) return; // only the class spell list
      if (book.includes(id) || book.length >= cap) return;
      onChange({ ...value, spellbook: [...book, id] });
    } else {
      // A spell that leaves the spellbook can no longer be prepared.
      onChange({
        ...value,
        spellbook: book.filter((b) => b !== id),
        prepared: prepared.filter((p) => p !== id),
      });
    }
  };

  const togglePrepared = (id: SpellId, checked: boolean) => {
    if (always.includes(id)) return;
    if (checked) {
      // Only the class spell list; a spellbook caster prepares only from its book.
      if (!pools.leveled.some((s) => s.id === id) || (usesBook && !book.includes(id))) return;
      if (prepared.includes(id) || prepared.length >= choices.prepared) return;
      onChange({ ...value, prepared: [...prepared, id] });
    } else {
      onChange({ ...value, prepared: prepared.filter((p) => p !== id) });
    }
  };

  // A Wizard prepares only from its spellbook; others from the whole level 1 list
  // (plus any always-prepared feature spells, shown locked).
  const bookIds = new Set(book);
  const preparable = usesBook ? pools.leveled.filter((s) => bookIds.has(s.id)) : pools.leveled;
  const preparedList = [...preparable];
  for (const id of always) {
    const spell = getSpell(id);
    if (spell && !preparedList.some((s) => s.id === id)) preparedList.push(spell);
  }
  preparedList.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  const counter = (testId: string, have: number, need: number) => (
    <>
      <p className={styles.hint} role="status" data-testid={testId}>
        {have} of {need} chosen
      </p>
      {have < need && (
        <p className={styles.hint} role="note">
          You can finish this later: the Overview will remind you.
        </p>
      )}
    </>
  );

  return (
    <>
      <p className={styles.hint}>
        Casters prepare a list of spells.{' '}
        {usesBook ? 'You prepare from your spellbook. ' : ''}
        You can change your prepared spells after a Long Rest on the Spells page.
      </p>

      {choices.cantrips > 0 && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.fieldLabel}>
            {className} cantrips: choose {choices.cantrips}
          </legend>
          {counter('spells-cantrips-counter', cantrips.length, choices.cantrips)}
          <SpellPickList
            spells={pools.cantrips}
            selectedIds={cantrips}
            atCap={cantrips.length >= choices.cantrips}
            lockedIds={required}
            onToggle={toggleCantrip}
            showDetails
          />
        </fieldset>
      )}

      {usesBook && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.fieldLabel}>Spellbook: choose {choices.spellbook}</legend>
          {counter('spells-spellbook-counter', book.length, choices.spellbook ?? 0)}
          <SpellPickList
            spells={pools.leveled}
            selectedIds={book}
            atCap={book.length >= (choices.spellbook ?? 0)}
            onToggle={toggleBook}
            showDetails
          />
        </fieldset>
      )}

      {choices.prepared > 0 && (
        <fieldset className={styles.fieldset}>
          <legend className={styles.fieldLabel}>
            Prepared spells: choose {choices.prepared}
            {usesBook ? ' from your spellbook' : ''}
          </legend>
          {counter('spells-prepared-counter', prepared.length, choices.prepared)}
          {always.length > 0 && (
            <p className={styles.hint}>
              Always prepared (from class features, not counted):{' '}
              {always.map((id) => getSpell(id)?.name ?? id).join(', ')}.
            </p>
          )}
          {usesBook && book.length === 0 ? (
            <p className={styles.hint}>Choose your spellbook spells first, then prepare from them.</p>
          ) : (
            <SpellPickList
              spells={preparedList}
              selectedIds={[...prepared, ...always]}
              atCap={prepared.length >= choices.prepared}
              lockedIds={always}
              lockedLabel="always prepared"
              onToggle={togglePrepared}
              showDetails
            />
          )}
        </fieldset>
      )}
    </>
  );
}
