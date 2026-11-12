/**
 * RNG seam and pure selection helper.
 *
 * Isolates randomness behind an injectable `RNG` so consumers (e.g. the
 * equipment resolver's " or " choice) are deterministic and unit-testable when
 * seeded. Production passes `Math.random`; tests pass a deterministic seeded
 * RNG. Ported verbatim in structure from PWACharSheet's
 * src/logic/random-character-generator.ts (`RNG` type + `pick`), minus the
 * WFRP-specific dice/character helpers that are out of scope here.
 */

/** Random-number source: a function returning a float in [0, 1), like Math.random. */
export type RNG = () => number;

/**
 * The default production RNG factory. This is the ONLY place in src/logic that
 * may reference Math.random; every rules function receives an RNG (or the die
 * result) as a parameter so it stays deterministic and testable.
 */
export function createDefaultRng(): RNG {
  return () => Math.random();
}

/**
 * Pick one element from a non-empty array using the injected RNG.
 * Throws on an empty array (a programming-error guard, not a game rule) — this
 * matches the source helper's contract.
 */
export function pick<T>(rng: RNG, items: T[]): T {
  if (items.length === 0) {
    throw new Error('pick(): cannot choose from an empty array');
  }
  return items[Math.floor(rng() * items.length)];
}

/**
 * A deterministic RNG from a 32-bit seed (mulberry32). Lets a caller spend a
 * single draw from its own RNG on a seed and hand the derived RNG to a helper
 * that needs several draws, so the caller's later draws are unchanged.
 */
export function createSeededRng(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
