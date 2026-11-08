/**
 * GOLDEN FIXTURE for the Sorcerer Metamagic option catalog (Stage 3).
 *
 * Authored ONLY from the PHB 2024 (Docs/PlayersHandbook.md, Sorcerer
 * "METAMAGIC OPTIONS", L6373-L6428). It is independent of src/data/metamagic.ts:
 * nothing is imported from the app, so drift in the catalog fails the oracle
 * instead of silently updating this file.
 *
 * LINE NUMBERS are 1-based lines of the option's `## NAME` heading as counted by
 * PowerShell `Get-Content` (the grep tool can number about 1 higher).
 *
 * Cardinality: exactly 10 options (Careful, Distant, Empowered, Extended,
 * Heightened, Quickened, Seeking, Subtle, Transmuted, Twinned).
 * Costs: Heightened Spell and Quickened Spell cost 2 Sorcery Points; every
 * other option costs 1.
 * `stacksWithOtherOption`: the PHB says you can use only ONE Metamagic option on
 * a spell "unless otherwise noted in one of those options" (L6345-6346).
 * Empowered Spell (L6391) and Seeking Spell (L6415) both say they can be used
 * even if a different Metamagic option was already used on the casting.
 */
export interface GoldenMetamagic {
  id: string;
  name: string;
  /** Sorcery Point cost. */
  cost: number;
  /** True when the PHB text lets this option be added on top of another option. */
  stacksWithOtherOption: boolean;
  /** PHB heading line (Get-Content numbering). */
  line: number;
}

export const GOLDEN_METAMAGIC_COUNT = 10;

/** Sorcerer levels at which options are gained (cumulative owed), PHB L6341-L6347. */
export const GOLDEN_METAMAGIC_OWED_STEPS: ReadonlyArray<readonly [level: number, owed: number]> = [
  [2, 2],
  [10, 4],
  [17, 6],
];

export const METAMAGIC_GOLDEN: readonly GoldenMetamagic[] = [
  { id: 'careful-spell', name: 'Careful Spell', cost: 1, stacksWithOtherOption: false, line: 6377 },
  { id: 'distant-spell', name: 'Distant Spell', cost: 1, stacksWithOtherOption: false, line: 6381 },
  { id: 'empowered-spell', name: 'Empowered Spell', cost: 1, stacksWithOtherOption: true, line: 6387 },
  { id: 'extended-spell', name: 'Extended Spell', cost: 1, stacksWithOtherOption: false, line: 6393 },
  { id: 'heightened-spell', name: 'Heightened Spell', cost: 2, stacksWithOtherOption: false, line: 6399 },
  { id: 'quickened-spell', name: 'Quickened Spell', cost: 2, stacksWithOtherOption: false, line: 6405 },
  { id: 'seeking-spell', name: 'Seeking Spell', cost: 1, stacksWithOtherOption: true, line: 6409 },
  { id: 'subtle-spell', name: 'Subtle Spell', cost: 1, stacksWithOtherOption: false, line: 6417 },
  { id: 'transmuted-spell', name: 'Transmuted Spell', cost: 1, stacksWithOtherOption: false, line: 6421 },
  { id: 'twinned-spell', name: 'Twinned Spell', cost: 1, stacksWithOtherOption: false, line: 6425 },
];
