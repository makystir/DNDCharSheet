/**
 * Minimal dice seam (Stage A5a).
 *
 * Pure dice rolling over an injected RNG (a function returning a float in
 * [0, 1); see random.ts). A d(n) face is floor(r * n) + 1. Nothing here calls
 * Math.random; production code passes `createDefaultRng()` from random.ts.
 *
 * Every rules function in the app takes the d20 RESULT as a parameter, so
 * rolling (auto or typed in by the player) stays separate from resolution.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md):
 *  - Advantage / Disadvantage: roll two d20s and use the higher / lower
 *    ("D20 Tests", L472-492).
 *  - A natural 1 / natural 20 is judged on the RAW die kept, never on the total.
 *  - Exhaustion reduces the roll of a D20 Test by 2 x level (Exhaustion
 *    condition, L21024). It appears as its own visible Breakdown component.
 */
import type { Breakdown, BreakdownComponent } from './breakdown';
import { exhaustionEffects } from './conditions';
import type { RNG } from './random';

/** How a d20 is rolled (PHB 2024 "Advantage and Disadvantage"). */
export type D20Mode = 'normal' | 'advantage' | 'disadvantage';

/** Result of rolling a d20. `natural` is the raw kept face (equals `used`). */
export interface D20Roll {
  /** Faces in the order drawn (one die, or two for Advantage / Disadvantage). */
  rolls: number[];
  /** The die that counts after Advantage / Disadvantage. */
  used: number;
  /** The raw kept face; natural 1 / 20 are judged on this, never on a total. */
  natural: number;
}

/** Result of rolling a dice expression. */
export interface DiceRoll {
  rolls: number[];
  total: number;
}

/**
 * Combine Advantage / Disadvantage sources into one roll mode. They never stack,
 * and any Advantage together with any Disadvantage cancels to a normal roll,
 * whatever the number of sources of each. PHB 2024 "Advantage and Disadvantage"
 * and "They Don't Stack" (Docs/PlayersHandbook.md L472-487).
 */
export function combineD20Mode(hasAdvantage: boolean, hasDisadvantage: boolean): D20Mode {
  if (hasAdvantage && !hasDisadvantage) return 'advantage';
  if (hasDisadvantage && !hasAdvantage) return 'disadvantage';
  return 'normal';
}

/** Roll one die with `sides` faces from the injected RNG (face = floor(r*n)+1). */
export function rollDie(rng: RNG, sides: number): number {
  const face = Math.floor(rng() * sides) + 1;
  // Guard a misbehaving RNG (out of [0, 1)) so a face is always on the die.
  return Math.min(sides, Math.max(1, face));
}

/** Roll a d20 normally, with Advantage (keep higher) or Disadvantage (keep lower). */
export function rollD20(rng: RNG, mode: D20Mode = 'normal'): D20Roll {
  const first = rollDie(rng, 20);
  if (mode === 'normal') return { rolls: [first], used: first, natural: first };
  const second = rollDie(rng, 20);
  const used = mode === 'advantage' ? Math.max(first, second) : Math.min(first, second);
  return { rolls: [first, second], used, natural: used };
}

/**
 * Resolve d20 faces that were rolled elsewhere (typed in from physical dice) the
 * same way rollD20 does: one face for a normal roll, two for Advantage (keep the
 * higher) or Disadvantage (keep the lower). Throws if the number of faces does
 * not match the mode or a face is not an integer 1..20.
 */
export function d20FromFaces(faces: number[], mode: D20Mode = 'normal'): D20Roll {
  const expected = mode === 'normal' ? 1 : 2;
  if (faces.length !== expected) {
    throw new RangeError(`d20FromFaces(): ${mode} needs ${expected} die face(s), got ${faces.length}`);
  }
  for (const face of faces) {
    if (!Number.isInteger(face) || face < 1 || face > 20) {
      throw new RangeError(`d20FromFaces(): each face must be an integer 1..20, got ${face}`);
    }
  }
  if (mode === 'normal') return { rolls: [...faces], used: faces[0], natural: faces[0] };
  const used = mode === 'advantage' ? Math.max(...faces) : Math.min(...faces);
  return { rolls: [...faces], used, natural: used };
}

const DICE_EXPRESSION = /^(\d+)d(\d+)$/i;
const FLAT_EXPRESSION = /^\d+$/;

/**
 * Roll 'NdM' (e.g. '2d6') or a flat integer (e.g. '1', a fixed amount that rolls
 * no dice). Throws on any other expression (a programming-error guard).
 */
export function rollDice(expr: string, rng: RNG): DiceRoll {
  const text = expr.trim();
  if (FLAT_EXPRESSION.test(text)) return { rolls: [], total: Number(text) };
  const match = DICE_EXPRESSION.exec(text);
  if (!match) throw new Error(`rollDice(): unsupported dice expression "${expr}"`);
  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (count < 1 || sides < 1) {
    throw new RangeError(`rollDice(): "${expr}" needs at least one die with at least one side`);
  }
  const rolls: number[] = [];
  for (let i = 0; i < count; i += 1) rolls.push(rollDie(rng, sides));
  return { rolls, total: rolls.reduce((sum, face) => sum + face, 0) };
}

/**
 * Breakdown of a D20 Test roll: the raw die, any caller-supplied modifier
 * components, and an explicit Exhaustion component (-2 x level, always listed,
 * even at 0, so every factor is visible). Components sum to the total.
 *
 * Natural 1 / 20 must still be judged on `natural`, not on `total`.
 */
export function d20TestBreakdown(
  natural: number,
  exhaustionLevel: number,
  modifiers: BreakdownComponent[] = [],
): Breakdown {
  const exhaustion = exhaustionEffects(exhaustionLevel);
  const components: BreakdownComponent[] = [
    { label: 'd20 roll', value: natural },
    ...modifiers,
    {
      label: exhaustion.level === 0 ? 'Exhaustion (none)' : `Exhaustion ${exhaustion.d20Test.total}`,
      value: exhaustion.d20Test.total,
    },
  ];
  return { total: components.reduce((sum, c) => sum + c.value, 0), components };
}
