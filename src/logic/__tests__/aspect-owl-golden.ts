/**
 * GOLDEN (data only): Wild Heart "Aspect of the Wilds" Owl option, authored from the
 * PHB 2024 (Docs/PlayersHandbook.md) and NOT derived from the code.
 *
 * L2591-2596 "LEVEL 6: ASPECT OF THE WILDS": Owl: "You have Darkvision with a range of
 * 60 feet. If you already have Darkvision, its range increases by 60 feet." Panther
 * (Climb Speed) and Salmon (Swim Speed) add no Darkvision. Whenever you finish a Long
 * Rest you can change the choice.
 * Species Darkvision: Dwarf 120 (L8082), Elf 60 (L8014-ish; Drow lineage 120, L8274),
 * Human none.
 */

export interface OwlRow {
  name: string;
  species?: { id: string; elvenLineage?: string };
  barbarianLevel: number;
  subclassId: string;
  pick?: string;
  /** Expected Darkvision range in feet. */
  feet: number;
  /** Expected size of the Aspect of the Wilds component (0 = none shown). */
  owlComponent: number;
}

export const OWL_ROWS: readonly OwlRow[] = [
  { name: 'Human (none) + Owl => 60', species: { id: 'human' }, barbarianLevel: 6, subclassId: 'wildHeart', pick: 'owl', feet: 60, owlComponent: 60 },
  { name: 'Dwarf (120) + Owl => 180', species: { id: 'dwarf' }, barbarianLevel: 6, subclassId: 'wildHeart', pick: 'owl', feet: 180, owlComponent: 60 },
  { name: 'Elf (60) + Owl => 120', species: { id: 'elf' }, barbarianLevel: 10, subclassId: 'wildHeart', pick: 'owl', feet: 120, owlComponent: 60 },
  { name: 'Drow (120) + Owl => 180', species: { id: 'elf', elvenLineage: 'drow' }, barbarianLevel: 6, subclassId: 'wildHeart', pick: 'owl', feet: 180, owlComponent: 60 },
  { name: 'No species + Owl => 60', barbarianLevel: 6, subclassId: 'wildHeart', pick: 'owl', feet: 60, owlComponent: 60 },
  { name: 'Level 5 (Aspect not reached) => unchanged', species: { id: 'dwarf' }, barbarianLevel: 5, subclassId: 'wildHeart', pick: 'owl', feet: 120, owlComponent: 0 },
  { name: 'Panther adds no Darkvision', species: { id: 'dwarf' }, barbarianLevel: 9, subclassId: 'wildHeart', pick: 'panther', feet: 120, owlComponent: 0 },
  { name: 'Salmon adds no Darkvision', species: { id: 'human' }, barbarianLevel: 9, subclassId: 'wildHeart', pick: 'salmon', feet: 0, owlComponent: 0 },
  { name: 'No pick => unchanged', species: { id: 'dwarf' }, barbarianLevel: 9, subclassId: 'wildHeart', feet: 120, owlComponent: 0 },
  { name: 'Owl stored on another subclass (Berserker) => unchanged', species: { id: 'dwarf' }, barbarianLevel: 9, subclassId: 'berserker', pick: 'owl', feet: 120, owlComponent: 0 },
];
