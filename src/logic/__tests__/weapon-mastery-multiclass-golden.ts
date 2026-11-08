/**
 * Golden fixture for multiclass Weapon Mastery. Data only; authored from the PHB
 * class tables (Weapon Mastery column) BEFORE the implementation. Do not edit to
 * make code pass.
 *
 * Per-class counts (PHB 2024 Weapon Mastery column, Docs/PlayersHandbook.md):
 *   Barbarian 2 (L1), 3 (L4), 4 (L10)        [table L2452]
 *   Fighter   3 (L1), 4 (L4), 5 (L10), 6 (L16) [table L4160]
 *   Paladin 2, Ranger 2, Rogue 2 (from L1)    [tables L4875, L5383, Rogue]
 * Ambiguity (flagged in the code): the PHB does not say multiclass counts add; the
 * implementation sums each class's count at that class's own level.
 */
export interface MulticlassCapCase {
  classes: ReadonlyArray<{ id: string; level: number }>;
  /** Expected total cap. */
  cap: number;
  why: string;
}

export const MULTICLASS_CAP_CASES: readonly MulticlassCapCase[] = [
  { classes: [{ id: 'fighter', level: 1 }], cap: 3, why: 'single class unchanged: Fighter 1' },
  { classes: [{ id: 'fighter', level: 20 }], cap: 6, why: 'single class unchanged: Fighter 20' },
  { classes: [{ id: 'wizard', level: 5 }], cap: 0, why: 'no Weapon Mastery class' },
  { classes: [{ id: 'fighter', level: 3 }, { id: 'rogue', level: 2 }], cap: 5, why: 'Fighter 3 (3) + Rogue 2 (2)' },
  { classes: [{ id: 'barbarian', level: 4 }, { id: 'fighter', level: 1 }], cap: 6, why: 'Barbarian 4 (3) + Fighter 1 (3)' },
  { classes: [{ id: 'fighter', level: 10 }, { id: 'barbarian', level: 10 }], cap: 9, why: 'Fighter 10 (5) + Barbarian 10 (4)' },
  { classes: [{ id: 'wizard', level: 5 }, { id: 'fighter', level: 1 }], cap: 3, why: 'a caster adds nothing; the primary class need not be the mastery class' },
  { classes: [{ id: 'paladin', level: 1 }, { id: 'ranger', level: 1 }, { id: 'rogue', level: 1 }], cap: 6, why: 'three classes at 2 each' },
  { classes: [{ id: 'fighter', level: 3 }, { id: 'barbarian', level: 3 }], cap: 5, why: 'each class uses its OWN level (Barbarian 3 is still 2)' },
];

export interface MulticlassEligibilityCase {
  classes: ReadonlyArray<{ id: string; level: number }>;
  weaponId: string;
  eligible: boolean;
  why: string;
}

export const MULTICLASS_ELIGIBILITY_CASES: readonly MulticlassEligibilityCase[] = [
  { classes: [{ id: 'barbarian', level: 1 }, { id: 'rogue', level: 1 }], weaponId: 'longbow', eligible: true, why: 'Barbarian is melee only, but the Rogue entry masters any weapon the CHARACTER is proficient with (PHB L5902) and the initial Barbarian grants Martial proficiency' },
  { classes: [{ id: 'wizard', level: 1 }, { id: 'rogue', level: 1 }], weaponId: 'longbow', eligible: false, why: 'Wizard initial + Rogue multiclass: no Martial proficiency, so no Longbow mastery (Rogue multiclass grants no weapons)' },
  { classes: [{ id: 'barbarian', level: 1 }, { id: 'fighter', level: 1 }], weaponId: 'longbow', eligible: true, why: 'the Fighter share allows any weapon' },
  { classes: [{ id: 'wizard', level: 5 }, { id: 'barbarian', level: 1 }], weaponId: 'greataxe', eligible: true, why: 'a melee weapon via the Barbarian entry' },
  { classes: [{ id: 'wizard', level: 5 }], weaponId: 'greataxe', eligible: false, why: 'no Weapon Mastery class at all' },
  { classes: [{ id: 'fighter', level: 1 }, { id: 'wizard', level: 5 }], weaponId: 'dagger', eligible: true, why: 'Fighter allows it; a non-mastery class must not block it' },
];
