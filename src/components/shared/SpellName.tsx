import { getSpell } from '../../data/spells';
import { resolveSpellTooltip } from '../../logic/tooltip-content';
import { MaybeContentTooltip } from './ContentTooltip';

/**
 * A spell's name with its spell tooltip (level, school, casting time, range,
 * components, duration, tags and a short description). Falls back to the plain id
 * for a spell that is not in the catalog. Use this wherever a spell is named so
 * every spell has a tooltip (content-tooltips steering).
 */
export function SpellName({ id }: { id: string }) {
  return (
    <MaybeContentTooltip content={resolveSpellTooltip(id)}>
      {getSpell(id)?.name ?? id}
    </MaybeContentTooltip>
  );
}

/** Comma-separated spell names, each with its spell tooltip. */
export function SpellNameList({ ids }: { ids: readonly string[] }) {
  return (
    <>
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && ', '}
          <SpellName id={id} />
        </span>
      ))}
    </>
  );
}
