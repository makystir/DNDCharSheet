/**
 * GOLDEN TABLE for Stage B7: the dice-roll LOG layer (roll → summary + payload),
 * the unified EVENT LOG (append / rotate / filter / clear), and the UNDO stack.
 *
 * AUTHORSHIP RULE: written by the ORCHESTRATOR directly from the PHB 2024 d20
 * Test rules + the WFRP source's event-log/undo contracts BEFORE the B7 logic
 * is implemented. The implementer must make the real functions reproduce every
 * row and MUST NOT edit this file. If a row looks wrong, STOP and flag it in the
 * summary instead of changing it.
 *
 * DATA ONLY (no imports) so it compiles before the logic exists. A harness in
 * the implementer's tests maps each row onto the real API.
 *
 * SCOPE NOTE: the d20 RESOLUTION math (advantage keeps higher, disadvantage
 * keeps lower, natural judged on the raw kept die, modifiers, exhaustion) is
 * ALREADY implemented and golden-gated by Stage A5 in src/logic/dice.ts
 * (rollD20 / d20FromFaces / combineD20Mode / d20TestBreakdown). This golden does
 * NOT re-litigate that — it pins the LAYER ABOVE the dice engine: how a resolved
 * d20 roll becomes a log summary + payload, how the event log is maintained, and
 * how undo behaves.
 *
 * Sources:
 *  - PHB 2024 "D20 Tests" (Docs/PlayersHandbook.md L472-492): a d20 Test
 *    succeeds when the total (die + modifiers) EQUALS OR EXCEEDS the DC; an
 *    attack hits when the total equals or exceeds the target's AC. A natural 20
 *    on the kept die is a critical hit; a natural 1 on an attack roll always
 *    misses. Nat-20/nat-1 are judged on the RAW KEPT die, never on the total.
 *  - The unified event-log contract (WFRP src/logic/event-log.ts): per-character,
 *    append-only, stored oldest-first; a cap with front-trim rotation; filter by
 *    category; clear empties only the event log. Ported near-verbatim (the
 *    stream is system-agnostic; only the category/type values are D&D).
 *  - The undo-stack contract (WFRP src/logic/undo.ts / useUndoStack): a bounded
 *    LIFO of reversible entries; undo returns the most-recent entry and pops it;
 *    redo re-applies; the stack is capped (oldest dropped past the cap).
 */

export type D20Mode = 'normal' | 'advantage' | 'disadvantage';

// ─── Roll-log summary + payload (rollSummary / toRollPayload) ────────────────
//
// A RESOLVED d20 roll (the dice engine already picked the kept die + computed
// the total) becomes a concise human-readable summary and a structured payload.
// Inputs per row: a label (what was rolled), the natural kept die, the total
// (die + modifiers), the mode, and an OPTIONAL dc (the DC for a check/save, or
// the target AC for an attack). Expected:
//   - total: echoed
//   - natural: the raw kept die
//   - isCrit: natural === 20 (critical — only meaningful vs a dc/AC, but the
//     flag is set whenever the natural die is 20)
//   - isFumble: natural === 1 (natural-1; an attack auto-misses on a 1)
//   - passed: when dc is given, total >= dc (equals-or-exceeds); undefined when
//     no dc (a flat roll with nothing to beat)
//   - summary: `${label}: ${total}${mode-suffix}${dc-suffix}` where
//       mode-suffix = ' (adv)' | ' (dis)' | '' for normal,
//       dc-suffix   = ' vs DC N — hit/miss' when dc given, else '';
//       a natural 20 appends ' — crit!', a natural 1 appends ' — fumble!'.
// The exact summary string is pinned so the format cannot drift.
export interface RollSummaryCase {
  name: string;
  cite: string;
  label: string;
  natural: number;
  total: number;
  mode: D20Mode;
  dc?: number;
  expect: {
    total: number;
    natural: number;
    isCrit: boolean;
    isFumble: boolean;
    passed: boolean | undefined;
    summary: string;
  };
}

export const ROLL_SUMMARY_CASES: RollSummaryCase[] = [
  {
    name: 'Normal check, total meets DC → pass',
    cite: 'D20 Tests: total >= DC succeeds',
    label: 'Stealth',
    natural: 12,
    total: 15,
    mode: 'normal',
    dc: 15,
    expect: { total: 15, natural: 12, isCrit: false, isFumble: false, passed: true, summary: 'Stealth: 15 vs DC 15 — hit' },
  },
  {
    name: 'Normal check, total below DC → fail',
    cite: 'D20 Tests: below DC fails',
    label: 'Arcana',
    natural: 8,
    total: 11,
    mode: 'normal',
    dc: 15,
    expect: { total: 11, natural: 8, isCrit: false, isFumble: false, passed: false, summary: 'Arcana: 11 vs DC 15 — miss' },
  },
  {
    name: 'Advantage roll, no DC → mode suffix, no pass/fail',
    cite: 'Advantage; flat roll has nothing to beat',
    label: 'Initiative',
    natural: 17,
    total: 20,
    mode: 'advantage',
    expect: { total: 20, natural: 17, isCrit: false, isFumble: false, passed: undefined, summary: 'Initiative: 20 (adv)' },
  },
  {
    name: 'Disadvantage roll, no DC',
    cite: 'Disadvantage; flat roll',
    label: 'Perception',
    natural: 6,
    total: 9,
    mode: 'disadvantage',
    expect: { total: 9, natural: 6, isCrit: false, isFumble: false, passed: undefined, summary: 'Perception: 9 (dis)' },
  },
  {
    name: 'Natural 20 attack vs AC → crit, hit, crit suffix',
    cite: 'D20 Tests: natural 20 is a critical hit (judged on the kept die)',
    label: 'Longsword attack',
    natural: 20,
    total: 27,
    mode: 'normal',
    dc: 16,
    expect: { total: 27, natural: 20, isCrit: true, isFumble: false, passed: true, summary: 'Longsword attack: 27 vs DC 16 — hit — crit!' },
  },
  {
    name: 'Natural 1 attack vs AC → fumble, miss (auto-miss on 1)',
    cite: 'D20 Tests: natural 1 on an attack always misses (judged on the kept die)',
    label: 'Longbow attack',
    natural: 1,
    total: 9,
    mode: 'normal',
    dc: 13,
    expect: { total: 9, natural: 1, isCrit: false, isFumble: true, passed: false, summary: 'Longbow attack: 9 vs DC 13 — miss — fumble!' },
  },
  {
    name: 'Natural 20 flag set even without a DC (flat roll)',
    cite: 'Natural 20 flagged on the kept die regardless of DC',
    label: 'Wild Magic d20',
    natural: 20,
    total: 20,
    mode: 'normal',
    expect: { total: 20, natural: 20, isCrit: true, isFumble: false, passed: undefined, summary: 'Wild Magic d20: 20 — crit!' },
  },
  {
    name: 'Total exactly equals DC → pass (equals-or-exceeds)',
    cite: 'D20 Tests: EQUALS or exceeds',
    label: 'Athletics',
    natural: 10,
    total: 10,
    mode: 'normal',
    dc: 10,
    expect: { total: 10, natural: 10, isCrit: false, isFumble: false, passed: true, summary: 'Athletics: 10 vs DC 10 — hit' },
  },
];

// ─── Event log: append / rotate / filter / clear ─────────────────────────────
//
// The per-character event log is stored OLDEST-FIRST, append-only, bounded by a
// cap with FRONT-trim rotation (drop the oldest beyond the cap). These rows pin
// the pure invariants of rotate / filterByCategory; append + clear are asserted
// structurally in the harness (append adds one at the tail with an id+timestamp
// and never mutates the input; clear empties only the event log).

// rotate(events-of-length L, cap) → keeps the last min(L, cap), order preserved.
export interface RotateCase {
  name: string;
  cite: string;
  length: number;
  cap: number;
  expect: {
    resultLength: number;
    /** The value of the FIRST kept element, when the input is [0,1,2,...,L-1]. */
    firstKept: number;
    /** The value of the LAST kept element. */
    lastKept: number;
  };
}

export const ROTATE_CASES: RotateCase[] = [
  { name: 'Under cap: unchanged', cite: 'rotate keeps all when L <= cap', length: 5, cap: 200, expect: { resultLength: 5, firstKept: 0, lastKept: 4 } },
  { name: 'Exactly at cap: unchanged', cite: 'L === cap', length: 200, cap: 200, expect: { resultLength: 200, firstKept: 0, lastKept: 199 } },
  { name: 'Over cap: drop oldest from the front', cite: 'front-trim to the cap', length: 205, cap: 200, expect: { resultLength: 200, firstKept: 5, lastKept: 204 } },
  { name: 'Far over cap', cite: 'front-trim', length: 500, cap: 200, expect: { resultLength: 200, firstKept: 300, lastKept: 499 } },
  { name: 'Empty log', cite: 'rotate of [] is []', length: 0, cap: 200, expect: { resultLength: 0, firstKept: -1, lastKept: -1 } },
];

// filterByCategory: an empty/undefined category set means "no filter" (all);
// otherwise the subset whose category is selected, order preserved.
export interface FilterCase {
  name: string;
  cite: string;
  /** Categories of the events in order. */
  eventCategories: string[];
  /** The selected category set (empty array = no filter). */
  selected: string[];
  /** Indices (into eventCategories) expected to survive, in order. */
  expectIndices: number[];
}

export const FILTER_CASES: FilterCase[] = [
  {
    name: 'No filter (empty set) → all pass',
    cite: 'empty/undefined set = no filter',
    eventCategories: ['roll', 'combat', 'advancement'],
    selected: [],
    expectIndices: [0, 1, 2],
  },
  {
    name: 'Single category selected',
    cite: 'subset whose category is selected',
    eventCategories: ['roll', 'combat', 'roll', 'advancement'],
    selected: ['roll'],
    expectIndices: [0, 2],
  },
  {
    name: 'Multiple categories selected, order preserved',
    cite: 'subset preserves order',
    eventCategories: ['roll', 'combat', 'advancement', 'roll'],
    selected: ['combat', 'advancement'],
    expectIndices: [1, 2],
  },
  {
    name: 'Selected category not present → empty',
    cite: 'no matches',
    eventCategories: ['roll', 'combat'],
    selected: ['advancement'],
    expectIndices: [],
  },
];

// ─── Undo stack (push / undo / redo / cap) ───────────────────────────────────
//
// A bounded LIFO of reversible entries. The golden drives the stack with a
// scripted sequence of operations and pins the resulting state. Operations:
//   { op: 'push', value: N }   push a new entry carrying N
//   { op: 'undo' }             pop the most-recent entry; records the popped N
//   { op: 'redo' }             re-apply the last undone entry; records the N
// After the sequence the harness asserts: the ordered list of values returned by
// each undo (newest-first LIFO) and each redo, the final undo-stack depth, and
// the final redo-stack depth. The cap drops the OLDEST pushed entry past the cap
// (so a push past the cap makes the earliest entry unreachable by undo).
export interface UndoOp {
  op: 'push' | 'undo' | 'redo';
  value?: number;
}

export interface UndoCase {
  name: string;
  cite: string;
  cap: number;
  ops: UndoOp[];
  expect: {
    /** Values returned by each 'undo' op in sequence (null when nothing to undo). */
    undoReturns: (number | null)[];
    /** Values returned by each 'redo' op in sequence (null when nothing to redo). */
    redoReturns: (number | null)[];
    /** Undo-stack depth after the whole sequence. */
    finalUndoDepth: number;
    /** Redo-stack depth after the whole sequence. */
    finalRedoDepth: number;
  };
}

export const UNDO_CASES: UndoCase[] = [
  {
    name: 'push a,b,c then undo twice → c,b (LIFO)',
    cite: 'LIFO undo returns most-recent first',
    cap: 50,
    ops: [{ op: 'push', value: 1 }, { op: 'push', value: 2 }, { op: 'push', value: 3 }, { op: 'undo' }, { op: 'undo' }],
    expect: { undoReturns: [3, 2], redoReturns: [], finalUndoDepth: 1, finalRedoDepth: 2 },
  },
  {
    name: 'undo on empty stack → null',
    cite: 'nothing to undo',
    cap: 50,
    ops: [{ op: 'undo' }],
    expect: { undoReturns: [null], redoReturns: [], finalUndoDepth: 0, finalRedoDepth: 0 },
  },
  {
    name: 'push, undo, redo → redo re-applies the undone entry',
    cite: 'redo re-applies',
    cap: 50,
    ops: [{ op: 'push', value: 7 }, { op: 'undo' }, { op: 'redo' }],
    expect: { undoReturns: [7], redoReturns: [7], finalUndoDepth: 1, finalRedoDepth: 0 },
  },
  {
    name: 'a new push clears the redo stack',
    cite: 'pushing after an undo discards the redo branch',
    cap: 50,
    ops: [{ op: 'push', value: 1 }, { op: 'push', value: 2 }, { op: 'undo' }, { op: 'push', value: 3 }, { op: 'redo' }],
    expect: { undoReturns: [2], redoReturns: [null], finalUndoDepth: 2, finalRedoDepth: 0 },
  },
  {
    name: 'cap drops the oldest: cap 2, push 1,2,3 then undo 3 times',
    cite: 'bounded stack drops the oldest past the cap',
    cap: 2,
    ops: [{ op: 'push', value: 1 }, { op: 'push', value: 2 }, { op: 'push', value: 3 }, { op: 'undo' }, { op: 'undo' }, { op: 'undo' }],
    // Only 2 entries retained (2 and 3; the 1 was dropped by the cap).
    expect: { undoReturns: [3, 2, null], redoReturns: [], finalUndoDepth: 0, finalRedoDepth: 2 },
  },
];
