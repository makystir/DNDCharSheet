/**
 * GOLDEN (data only): owed-pick COUNTS for class-feature choices, per class and
 * class level 1..20, transcribed independently from the PHB 2024 class tables
 * and feature text (Docs/PlayersHandbook.md). Do NOT edit to match the code.
 * Each array is indexed by class level - 1.
 *
 * Sources (PHB lines):
 *  - Metamagic: two at 2, two more at 10, two more at 17 (L6341-6347; prose only)
 *  - Eldritch Invocations: Warlock Features table (L6831-6853; OCR-damaged,
 *    cross-checked with L6811-6817): 1,3,3,3,5,5,6,6,7,7,7,8,8,8,9,9,9,10,10,10
 *  - Maneuvers (Battle Master): 3 at 3, 5 at 7, 7 at 10, 9 at 15 (L4235-4237)
 *  - Divine Order / Primal Order: level 1 (L3228, L3664); Blessed Strikes /
 *    Elemental Fury: level 7 (L3260, L3722)
 *  - Primal Knowledge: level 3 (L2493); Aspect of the Wilds: Wild Heart 6 (L2593)
 *  - Student of War: Battle Master 3 (L4249); Lore Bonus Proficiencies: 3 skills
 *    at 3 (L3057); Otherworldly Glamour: Fey Wanderer 3 (L5745)
 *  - Hunter's Prey 3 / Defensive Tactics 7 (L5825/L5833); Primal Companion 3 (L5583);
 *    Elemental Affinity: Draconic 6 (L6679)
 *  - Spell Mastery: two spells at 18 (L7479); Signature Spells: two at 20 (L7489)
 */

export interface GoldenOwedRow {
  key: string;
  classId: string;
  /** Subclass the grant is gated on (the test chooses it for the character). */
  subclassId?: string;
  /** Owed picks at class level 1..20. */
  owedByLevel: readonly number[];
}

const Z = 0;

export const OWED_GOLDEN: readonly GoldenOwedRow[] = [
  { key: 'sorcerer.metamagic', classId: 'sorcerer', owedByLevel: [Z, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 6, 6, 6, 6] },
  { key: 'warlock.invocations', classId: 'warlock', owedByLevel: [1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10] },
  { key: 'fighter.maneuvers', classId: 'fighter', subclassId: 'battleMaster', owedByLevel: [Z, Z, 3, 3, 3, 3, 5, 5, 5, 7, 7, 7, 7, 7, 9, 9, 9, 9, 9, 9] },
  { key: 'cleric.divineOrder', classId: 'cleric', owedByLevel: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'cleric.blessedStrikes', classId: 'cleric', owedByLevel: [Z, Z, Z, Z, Z, Z, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'druid.primalOrder', classId: 'druid', owedByLevel: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'druid.elementalFury', classId: 'druid', owedByLevel: [Z, Z, Z, Z, Z, Z, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'barbarian.primalKnowledge', classId: 'barbarian', owedByLevel: [Z, Z, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'barbarian.aspectOfTheWilds', classId: 'barbarian', subclassId: 'wildHeart', owedByLevel: [Z, Z, Z, Z, Z, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'fighter.studentOfWarSkill', classId: 'fighter', subclassId: 'battleMaster', owedByLevel: [Z, Z, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'fighter.studentOfWarTool', classId: 'fighter', subclassId: 'battleMaster', owedByLevel: [Z, Z, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'bard.loreSkills', classId: 'bard', subclassId: 'lore', owedByLevel: [Z, Z, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3] },
  { key: 'ranger.glamourSkill', classId: 'ranger', subclassId: 'feyWanderer', owedByLevel: [Z, Z, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'ranger.huntersPrey', classId: 'ranger', subclassId: 'hunter', owedByLevel: [Z, Z, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'ranger.defensiveTactics', classId: 'ranger', subclassId: 'hunter', owedByLevel: [Z, Z, Z, Z, Z, Z, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'ranger.primalCompanion', classId: 'ranger', subclassId: 'beastMaster', owedByLevel: [Z, Z, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'sorcerer.elementalAffinity', classId: 'sorcerer', subclassId: 'draconic', owedByLevel: [Z, Z, Z, Z, Z, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { key: 'wizard.spellMastery', classId: 'wizard', owedByLevel: [Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, 2, 2, 2] },
  { key: 'wizard.signatureSpells', classId: 'wizard', owedByLevel: [Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, Z, 2] },
];

/** Cardinality pin: the number of choice groups with a class-table owed count. */
export const GOLDEN_OWED_GROUP_COUNT = 19;

/** Subclass-gated groups owe nothing for a different subclass (or none). */
export const GOLDEN_SUBCLASS_GATE_ROWS: ReadonlyArray<{ key: string; classId: string; wrongSubclassId: string; level: number }> = [
  { key: 'fighter.maneuvers', classId: 'fighter', wrongSubclassId: 'champion', level: 15 },
  { key: 'barbarian.aspectOfTheWilds', classId: 'barbarian', wrongSubclassId: 'berserker', level: 10 },
  { key: 'bard.loreSkills', classId: 'bard', wrongSubclassId: 'valor', level: 10 },
  { key: 'ranger.huntersPrey', classId: 'ranger', wrongSubclassId: 'beastMaster', level: 10 },
  { key: 'ranger.primalCompanion', classId: 'ranger', wrongSubclassId: 'hunter', level: 10 },
  { key: 'sorcerer.elementalAffinity', classId: 'sorcerer', wrongSubclassId: 'wildMagic', level: 10 },
];

/** Multiclass rows: each class uses its OWN class level. */
export const GOLDEN_MULTICLASS_ROWS: ReadonlyArray<{
  classes: ReadonlyArray<{ id: string; level: number; subclassId?: string }>;
  owed: Readonly<Record<string, number>>;
}> = [
  { classes: [{ id: 'sorcerer', level: 3 }, { id: 'warlock', level: 5 }], owed: { 'sorcerer.metamagic': 2, 'warlock.invocations': 5 } },
  { classes: [{ id: 'sorcerer', level: 9 }, { id: 'warlock', level: 1 }], owed: { 'sorcerer.metamagic': 2, 'warlock.invocations': 1 } },
  { classes: [{ id: 'warlock', level: 2 }, { id: 'sorcerer', level: 10 }], owed: { 'sorcerer.metamagic': 4, 'warlock.invocations': 3 } },
  { classes: [{ id: 'fighter', level: 7, subclassId: 'battleMaster' }, { id: 'wizard', level: 18 }], owed: { 'fighter.maneuvers': 5, 'wizard.spellMastery': 2, 'fighter.studentOfWarSkill': 1 } },
  { classes: [{ id: 'cleric', level: 1 }, { id: 'druid', level: 1 }], owed: { 'cleric.divineOrder': 1, 'druid.primalOrder': 1, 'cleric.blessedStrikes': 0 } },
  { classes: [{ id: 'cleric', level: 6 }, { id: 'druid', level: 7 }], owed: { 'cleric.blessedStrikes': 0, 'druid.elementalFury': 1 } },
  { classes: [{ id: 'fighter', level: 2 }, { id: 'warlock', level: 20 }], owed: { 'fighter.maneuvers': 0, 'warlock.invocations': 10 } },
];

/**
 * Wizard spell-pick validity (PHB 2024). Spell Mastery L7481: one level 1 and one level 2 spell
 * from the spellbook with a casting time of an action. Signature Spells L7491: two level 3
 * spells from the spellbook. Spell levels / casting times authored from the PHB spell entries.
 */
export const GOLDEN_SPELL_PICK_ROWS: ReadonlyArray<{
  name: string;
  key: 'wizard.spellMastery' | 'wizard.signatureSpells';
  level: number;
  spellbook: readonly string[];
  picks: readonly string[];
  chosen: number;
  invalid: readonly string[];
}> = [
  { name: 'Mastery: one L1 Action + one L2 Action is complete', key: 'wizard.spellMastery', level: 18, spellbook: ['magic-missile', 'web', 'shield', 'misty-step'], picks: ['magic-missile', 'web'], chosen: 2, invalid: [] },
  { name: 'Mastery: two level 1 spells -> second is invalid', key: 'wizard.spellMastery', level: 18, spellbook: ['magic-missile', 'mage-armor', 'web'], picks: ['magic-missile', 'mage-armor'], chosen: 1, invalid: ['mage-armor'] },
  { name: 'Mastery: two level 2 Action spells -> second is invalid', key: 'wizard.spellMastery', level: 18, spellbook: ['magic-missile', 'web', 'hold-person'], picks: ['web', 'hold-person'], chosen: 1, invalid: ['hold-person'] },
  { name: 'Mastery: Reaction spell (Shield) is not an action', key: 'wizard.spellMastery', level: 18, spellbook: ['shield', 'web'], picks: ['shield', 'web'], chosen: 1, invalid: ['shield'] },
  { name: 'Mastery: Bonus Action spell (Misty Step) is not an action', key: 'wizard.spellMastery', level: 18, spellbook: ['magic-missile', 'misty-step'], picks: ['magic-missile', 'misty-step'], chosen: 1, invalid: ['misty-step'] },
  { name: 'Mastery: spell not in the spellbook is invalid', key: 'wizard.spellMastery', level: 18, spellbook: ['web'], picks: ['magic-missile', 'web'], chosen: 1, invalid: ['magic-missile'] },
  { name: 'Mastery: level 3 spell is invalid', key: 'wizard.spellMastery', level: 18, spellbook: ['fireball', 'web'], picks: ['fireball', 'web'], chosen: 1, invalid: ['fireball'] },
  { name: 'Signature: two level 3 spells is complete', key: 'wizard.signatureSpells', level: 20, spellbook: ['fireball', 'fly', 'counterspell'], picks: ['fireball', 'fly'], chosen: 2, invalid: [] },
  { name: 'Signature: level 5-ish / wrong-level spell is invalid', key: 'wizard.signatureSpells', level: 20, spellbook: ['fireball', 'web'], picks: ['fireball', 'web'], chosen: 1, invalid: ['web'] },
  { name: 'Signature: spell not in the spellbook is invalid', key: 'wizard.signatureSpells', level: 20, spellbook: ['fireball'], picks: ['fireball', 'fly'], chosen: 1, invalid: ['fly'] },
  { name: 'Signature: unknown spell id is invalid', key: 'wizard.signatureSpells', level: 20, spellbook: ['fireball'], picks: ['fireball', 'not-a-spell'], chosen: 1, invalid: ['not-a-spell'] },
];

/** Warlock invocation prerequisites (PHB L6904-7078): min Warlock level and required invocation. */
export interface GoldenInvocationPrereq {
  id: string;
  minLevel: number;
  requires?: string;
  repeatable: boolean;
}

export const GOLDEN_INVOCATION_COUNT = 28;

export const INVOCATION_PREREQ_GOLDEN: readonly GoldenInvocationPrereq[] = [
  { id: 'agonizing-blast', minLevel: 2, repeatable: true },
  { id: 'armor-of-shadows', minLevel: 1, repeatable: false },
  { id: 'ascendant-step', minLevel: 5, repeatable: false },
  { id: 'devils-sight', minLevel: 2, repeatable: false },
  { id: 'devouring-blade', minLevel: 12, requires: 'thirsting-blade', repeatable: false },
  { id: 'eldritch-mind', minLevel: 1, repeatable: false },
  { id: 'eldritch-smite', minLevel: 5, requires: 'pact-of-the-blade', repeatable: false },
  { id: 'eldritch-spear', minLevel: 2, repeatable: true },
  { id: 'fiendish-vigor', minLevel: 2, repeatable: false },
  { id: 'gaze-of-two-minds', minLevel: 5, repeatable: false },
  { id: 'gift-of-the-depths', minLevel: 5, repeatable: false },
  { id: 'gift-of-the-protectors', minLevel: 9, requires: 'pact-of-the-tome', repeatable: false },
  { id: 'investment-of-the-chain-master', minLevel: 5, requires: 'pact-of-the-chain', repeatable: false },
  { id: 'lessons-of-the-first-ones', minLevel: 2, repeatable: true },
  { id: 'lifedrinker', minLevel: 9, requires: 'pact-of-the-blade', repeatable: false },
  { id: 'mask-of-many-faces', minLevel: 2, repeatable: false },
  { id: 'master-of-myriad-forms', minLevel: 5, repeatable: false },
  { id: 'misty-visions', minLevel: 2, repeatable: false },
  { id: 'one-with-shadows', minLevel: 5, repeatable: false },
  { id: 'otherworldly-leap', minLevel: 2, repeatable: false },
  { id: 'pact-of-the-blade', minLevel: 1, repeatable: false },
  { id: 'pact-of-the-chain', minLevel: 1, repeatable: false },
  { id: 'pact-of-the-tome', minLevel: 1, repeatable: false },
  { id: 'repelling-blast', minLevel: 2, repeatable: true },
  { id: 'thirsting-blade', minLevel: 5, requires: 'pact-of-the-blade', repeatable: false },
  { id: 'visions-of-distant-realms', minLevel: 9, repeatable: false },
  { id: 'whispers-of-the-grave', minLevel: 7, repeatable: false },
  { id: 'witch-sight', minLevel: 15, repeatable: false },
];

/** Multiclass skill / instrument picks owed by a NON-INITIAL class (PHB L2716, L5364, L5875). */
export const GOLDEN_MULTICLASS_PICK_ROWS: ReadonlyArray<{
  initial: string;
  added: string;
  /** Expected [kind, owed] picks for the added class. */
  picks: ReadonlyArray<readonly ['skill' | 'instrument', number]>;
}> = [
  { initial: 'fighter', added: 'bard', picks: [['skill', 1], ['instrument', 1]] },
  { initial: 'fighter', added: 'ranger', picks: [['skill', 1]] },
  { initial: 'fighter', added: 'rogue', picks: [['skill', 1]] },
  { initial: 'fighter', added: 'barbarian', picks: [] },
  { initial: 'wizard', added: 'cleric', picks: [] },
  { initial: 'wizard', added: 'druid', picks: [] },
  { initial: 'wizard', added: 'monk', picks: [] },
  { initial: 'wizard', added: 'paladin', picks: [] },
  { initial: 'wizard', added: 'sorcerer', picks: [] },
  { initial: 'wizard', added: 'warlock', picks: [] },
  { initial: 'wizard', added: 'fighter', picks: [] },
  // The initial class never owes a multiclass pick.
  { initial: 'bard', added: 'wizard', picks: [] },
];
