/** Harness for aspect-owl-golden.ts (rows authored from the PHB first; never edited here). */
import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, ClassEntry } from '../../types/character';
import { setClassChoice } from '../class-choices';
import { darkvisionBreakdown } from '../species';
import { OWL_ROWS } from './aspect-owl-golden';

function build(row: (typeof OWL_ROWS)[number]): Character {
  const base = createCharacter('Owl');
  let c: Character = {
    ...base,
    level: row.barbarianLevel,
    classes: [{ id: 'barbarian', level: row.barbarianLevel, subclassId: row.subclassId }] as unknown as ClassEntry[],
    ...(row.species ? { species: row.species as unknown as Character['species'] } : {}),
  };
  if (row.pick) c = setClassChoice(c, 'barbarian.aspectOfTheWilds', [row.pick]);
  return c;
}

describe('Aspect of the Wilds: Owl darkvision', () => {
  it.each(OWL_ROWS.map((r) => [r.name, r] as const))('%s', (_name, row) => {
    const b = darkvisionBreakdown(build(row));
    expect(b.total).toBe(row.feet);
    const owl = b.components.filter((x) => x.label.includes('Aspect of the Wilds'));
    if (row.owlComponent === 0) expect(owl).toEqual([]);
    else expect(owl).toEqual([{ label: expect.stringContaining('Owl'), value: row.owlComponent }]);
    expect(b.components.reduce((n, x) => n + x.value, 0)).toBe(b.total);
  });
});
