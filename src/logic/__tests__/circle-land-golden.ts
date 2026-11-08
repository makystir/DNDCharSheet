/**
 * GOLDEN (data only): Circle of the Land spells, authored from the PHB 2024
 * (Docs/PlayersHandbook.md) and NOT derived from src/data/classes.ts. Do NOT
 * edit to match the code.
 *
 * "LEVEL 3: CIRCLE OF THE LAND SPELLS" (L3860-3866): whenever you finish a Long
 * Rest, choose one land type (arid, polar, temperate, tropical); you have the
 * spells listed for your Druid level and lower prepared. Tables: Arid (OCR
 * scrambled; read as 3: Blur, Burning Hands, Fire Bolt; 5: Fireball; 7: Blight;
 * 9: Wall of Stone), Polar, Temperate (L3880s), Tropical.
 *
 * Druidic (L1, PHB ~L3660) always prepares Speak with Animals, independent of
 * the subclass; it is part of every expected set below.
 */

export type GoldenLand = 'arid' | 'polar' | 'temperate' | 'tropical';

/** [druidLevel, spell ids granted AT that level] per land type. */
export const LAND_TABLES: Readonly<Record<GoldenLand, ReadonlyArray<readonly [number, readonly string[]]>>> = {
  arid: [
    [3, ['blur', 'burning-hands', 'fire-bolt']],
    [5, ['fireball']],
    [7, ['blight']],
    [9, ['wall-of-stone']],
  ],
  polar: [
    [3, ['fog-cloud', 'hold-person', 'ray-of-frost']],
    [5, ['sleet-storm']],
    [7, ['ice-storm']],
    [9, ['cone-of-cold']],
  ],
  temperate: [
    [3, ['misty-step', 'shocking-grasp', 'sleep']],
    [5, ['lightning-bolt']],
    [7, ['freedom-of-movement']],
    [9, ['tree-stride']],
  ],
  tropical: [
    [3, ['acid-splash', 'ray-of-sickness', 'web']],
    [5, ['stinking-cloud']],
    [7, ['polymorph']],
    [9, ['insect-plague']],
  ],
};

export const LANDS: readonly GoldenLand[] = ['arid', 'polar', 'temperate', 'tropical'];
export const DRUIDIC_ALWAYS_PREPARED = 'speak-with-animals';

/** Land-granted spell ids for a Druid level (the golden oracle; Druidic excluded). */
export function expectedLandSpells(land: GoldenLand, druidLevel: number): string[] {
  return LAND_TABLES[land].filter(([lvl]) => lvl <= druidLevel).flatMap(([, ids]) => [...ids]);
}

/** Total land spells at the level-20 cap (3 + 1 + 1 + 1 per land). */
export const LAND_SPELLS_AT_LEVEL_20 = 6;

/** Hand-written spot rows (independent of the generator above). */
export const LAND_SPOT_ROWS: ReadonlyArray<{ name: string; land: GoldenLand; level: number; spells: readonly string[] }> = [
  { name: 'Arid L3 only the level-3 row', land: 'arid', level: 3, spells: ['blur', 'burning-hands', 'fire-bolt'] },
  { name: 'Arid L4 still only the level-3 row (L5 not reached)', land: 'arid', level: 4, spells: ['blur', 'burning-hands', 'fire-bolt'] },
  { name: 'Arid L5 adds Fireball', land: 'arid', level: 5, spells: ['blur', 'burning-hands', 'fire-bolt', 'fireball'] },
  { name: 'Polar L6 has levels 3 and 5 only', land: 'polar', level: 6, spells: ['fog-cloud', 'hold-person', 'ray-of-frost', 'sleet-storm'] },
  { name: 'Temperate L7 adds Freedom of Movement', land: 'temperate', level: 7, spells: ['misty-step', 'shocking-grasp', 'sleep', 'lightning-bolt', 'freedom-of-movement'] },
  { name: 'Tropical L8 has no level-9 spell yet', land: 'tropical', level: 8, spells: ['acid-splash', 'ray-of-sickness', 'web', 'stinking-cloud', 'polymorph'] },
  { name: 'Tropical L9 adds Insect Plague', land: 'tropical', level: 9, spells: ['acid-splash', 'ray-of-sickness', 'web', 'stinking-cloud', 'polymorph', 'insect-plague'] },
  { name: 'Polar L20 is the full table', land: 'polar', level: 20, spells: ['fog-cloud', 'hold-person', 'ray-of-frost', 'sleet-storm', 'ice-storm', 'cone-of-cold'] },
];

/** Swapping the land after a Long Rest replaces the whole granted set (no leftovers). */
export const LAND_SWAP_ROWS: ReadonlyArray<{ level: number; from: GoldenLand; to: GoldenLand; gone: readonly string[]; gained: readonly string[] }> = [
  { level: 5, from: 'arid', to: 'polar', gone: ['blur', 'burning-hands', 'fire-bolt', 'fireball'], gained: ['fog-cloud', 'hold-person', 'ray-of-frost', 'sleet-storm'] },
  { level: 3, from: 'temperate', to: 'tropical', gone: ['misty-step', 'shocking-grasp', 'sleep'], gained: ['acid-splash', 'ray-of-sickness', 'web'] },
  { level: 9, from: 'tropical', to: 'arid', gone: ['acid-splash', 'ray-of-sickness', 'web', 'stinking-cloud', 'polymorph', 'insect-plague'], gained: ['blur', 'burning-hands', 'fire-bolt', 'fireball', 'blight', 'wall-of-stone'] },
];
