/**
 * GOLDEN TABLE for the post-creation FEATURE-LANGUAGE PICKS (Advancement page
 * "Choices Pending"): how many "choose N" feature languages a character is owed,
 * how many are validly chosen, what remains, and what is over-allocated.
 *
 * AUTHORED FROM THE PHB 2024 TEXT FIRST (Docs/PlayersHandbook.md), BEFORE the
 * logic. Do not edit to fit the implementation.
 *
 * Sources:
 *  - Rogue L1 "Thieves' Cant" (PHB L5873-5898 region): "You know Thieves' Cant
 *    plus one other language of your choice." -> owed 1 (Thieves' Cant itself is
 *    automatic, never a pick).
 *  - Ranger L2 "Deft Explorer" (PHB L5411-5419): "...learn two languages of your
 *    choice." -> owed 2, only once Ranger level >= 2.
 *  - Counts are per CLASS level (multiclass sums each class's reached grants).
 *  - Counting rule: `chosen` = distinct, non-empty, non-Common, non-fixed picks.
 *    remaining = max(0, owed - chosen); over = max(0, chosen - owed).
 *  - Eligibility: standard languages (PHB L1631 table; Common is implicit and
 *    Thieves' Cant is automatic, so neither is offered); a language already
 *    taken at creation is not offered again unless it is already a feature pick.
 *
 * DATA ONLY (no imports).
 */

export interface PickEntry {
  classId: string;
  level: number;
}

export interface PickCase {
  name: string;
  cite: string;
  classes: PickEntry[];
  granted: string[];
  expect: { owed: number; chosen: number; remaining: number; over: number };
}

export const PICK_CASES: PickCase[] = [
  { name: 'Rogue 1, no picks → owed 1, remaining 1', cite: 'Rogue L1 Thieves\u2019 Cant', classes: [{ classId: 'rogue', level: 1 }], granted: [], expect: { owed: 1, chosen: 0, remaining: 1, over: 0 } },
  { name: 'Rogue 1, one pick → satisfied', cite: 'Rogue L1 Thieves\u2019 Cant', classes: [{ classId: 'rogue', level: 1 }], granted: ['goblin'], expect: { owed: 1, chosen: 1, remaining: 0, over: 0 } },
  { name: 'Rogue 5, no picks → still owed 1', cite: 'feature persists', classes: [{ classId: 'rogue', level: 5 }], granted: [], expect: { owed: 1, chosen: 0, remaining: 1, over: 0 } },
  { name: 'Rogue 1, two picks → over by 1', cite: 'over-allocation is a warning', classes: [{ classId: 'rogue', level: 1 }], granted: ['goblin', 'giant'], expect: { owed: 1, chosen: 2, remaining: 0, over: 1 } },
  { name: 'Rogue 1, thieves-cant "pick" does not count (automatic)', cite: 'fixed grant is not a pick', classes: [{ classId: 'rogue', level: 1 }], granted: ['thieves-cant'], expect: { owed: 1, chosen: 0, remaining: 1, over: 0 } },
  { name: 'Rogue 1, Common "pick" does not count', cite: 'Common implicit (L1627)', classes: [{ classId: 'rogue', level: 1 }], granted: ['common'], expect: { owed: 1, chosen: 0, remaining: 1, over: 0 } },
  { name: 'Rogue 1, duplicate picks count once', cite: 'no duplicates', classes: [{ classId: 'rogue', level: 1 }], granted: ['goblin', 'Goblin'], expect: { owed: 1, chosen: 1, remaining: 0, over: 0 } },
  { name: 'Ranger 1 → nothing owed (Deft Explorer is level 2)', cite: 'Ranger L2 Deft Explorer', classes: [{ classId: 'ranger', level: 1 }], granted: [], expect: { owed: 0, chosen: 0, remaining: 0, over: 0 } },
  { name: 'Ranger 2, no picks → owed 2', cite: 'Ranger L2 Deft Explorer', classes: [{ classId: 'ranger', level: 2 }], granted: [], expect: { owed: 2, chosen: 0, remaining: 2, over: 0 } },
  { name: 'Ranger 2, one pick → remaining 1', cite: 'Ranger L2 Deft Explorer', classes: [{ classId: 'ranger', level: 2 }], granted: ['giant'], expect: { owed: 2, chosen: 1, remaining: 1, over: 0 } },
  { name: 'Ranger 2, two picks → satisfied', cite: 'Ranger L2 Deft Explorer', classes: [{ classId: 'ranger', level: 2 }], granted: ['giant', 'orc'], expect: { owed: 2, chosen: 2, remaining: 0, over: 0 } },
  { name: 'Ranger 2, three picks → over by 1', cite: 'over-allocation is a warning', classes: [{ classId: 'ranger', level: 2 }], granted: ['giant', 'orc', 'goblin'], expect: { owed: 2, chosen: 3, remaining: 0, over: 1 } },
  { name: 'Ranger 11, no picks → still owed 2', cite: 'feature persists', classes: [{ classId: 'ranger', level: 11 }], granted: [], expect: { owed: 2, chosen: 0, remaining: 2, over: 0 } },
  { name: 'Fighter 20 → nothing owed', cite: 'no language feature', classes: [{ classId: 'fighter', level: 20 }], granted: [], expect: { owed: 0, chosen: 0, remaining: 0, over: 0 } },
  { name: 'Fighter 3 with a stray pick → over by 1', cite: 'nothing owed, so any pick is over', classes: [{ classId: 'fighter', level: 3 }], granted: ['giant'], expect: { owed: 0, chosen: 1, remaining: 0, over: 1 } },
  { name: 'Rogue 1 / Ranger 2 multiclass → owed 3', cite: 'each class grants at its own level', classes: [{ classId: 'rogue', level: 1 }, { classId: 'ranger', level: 2 }], granted: ['giant'], expect: { owed: 3, chosen: 1, remaining: 2, over: 0 } },
  { name: 'Rogue 1 / Ranger 1 multiclass → owed 1 (Deft Explorer not reached)', cite: 'gated per class level', classes: [{ classId: 'rogue', level: 1 }, { classId: 'ranger', level: 1 }], granted: [], expect: { owed: 1, chosen: 0, remaining: 1, over: 0 } },
];

export interface OptionCase {
  name: string;
  cite: string;
  classes: PickEntry[];
  /** Creation languages already chosen. */
  chosen: string[];
  /** Existing feature picks. */
  granted: string[];
  mustInclude: string[];
  mustExclude: string[];
}

export const OPTION_CASES: OptionCase[] = [
  { name: 'Rogue 1: never offers common or thieves-cant', cite: 'L1627 / Thieves\u2019 Cant automatic', classes: [{ classId: 'rogue', level: 1 }], chosen: [], granted: [], mustInclude: ['goblin', 'elvish', 'draconic', 'common-sign-language'], mustExclude: ['common', 'thieves-cant'] },
  { name: 'Ranger 2: creation languages are not offered again', cite: 'avoid duplicates with creation picks', classes: [{ classId: 'ranger', level: 2 }], chosen: ['elvish', 'dwarvish'], granted: [], mustInclude: ['giant', 'orc'], mustExclude: ['elvish', 'dwarvish', 'common'] },
  { name: 'Ranger 2: an existing feature pick stays offered (so it can be unticked)', cite: 'picker must show current picks', classes: [{ classId: 'ranger', level: 2 }], chosen: ['elvish'], granted: ['giant'], mustInclude: ['giant', 'orc'], mustExclude: ['elvish'] },
];
