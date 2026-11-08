/**
 * GOLDEN FIXTURE for D1 per-use resource tracking (D&D 5.5e / 2024 PHB).
 *
 * Authored ONLY from the PHB 2024 (Docs/PlayersHandbook.md) BEFORE the implementation, and independent of
 * src/data and src/logic: only TYPES may be imported from the app (never values), so a drift in the
 * catalog or the tracker logic fails the oracle (resources-golden.test.ts, FEAT-003) instead of silently
 * updating this file. The vocabulary here (`MaxSpec`, ids, recharge kinds) is the golden's own; the test
 * maps it onto the app's `UsesCount` / `FeatureRecharge`.
 *
 * LINE NUMBERS are 1-based lines of Docs/PlayersHandbook.md as counted by PowerShell `Get-Content`
 * (the grep tool can differ by about 1). The markdown is OCR-damaged ('l' for 1, 'S'/'s' for 5 in
 * tables); every number below was cross-checked against the prose, not only the table.
 *
 * TRACKER IDS: `<classId>.<pool>` for class AND subclass features (the class id is what keeps a
 * Cleric/Paladin multiclass from merging Channel Divinity), `feat:<featId>.<pool>`, and
 * `warlock.invocation-<id>`. Variants (N independent single uses) append `#<n>`.
 * DIVERGENCE FROM plan.md section 5: the plan table spells subclass ids `class.subclass.feature`;
 * plan section 3 (and its multiclass text, `fighter.psionic-energy-dice`) fixes the format above, so the
 * golden follows section 3. The subclass is carried in `subclassId`, not in the id.
 *
 * FINDINGS THAT DIVERGE FROM plan.md (golden follows the PHB):
 *  - Zealot "Warrior of the Gods" (L2649, L2653) is NOT a constant 4: four d12s, +1 die at Barbarian
 *    levels 6, 12 and 17 (5, 6, 7 dice).
 *  - Magic Initiate is three feats in the app (magic-initiate-cleric/-druid/-wizard), so the golden has
 *    three rows (one tracker per feat id, plus `@n` for a repeated occurrence).
 *
 * `ResourceRecovery.before/after` in RECHARGE_CASES are REMAINING uses (not spent), the value the rest
 * dialogs print as `before -> after of max`. FLAG: plan.md section 3 declares the fields without saying
 * which; remaining is the reading consistent with its section 4 dialog text.
 */
import type { Ability } from '../../types/character';

// ═════════════════════════════ vocabulary ═══════════════════════════════════

export type GoldenOwnerKind = 'class' | 'subclass' | 'feat' | 'invocation';

export type GoldenRechargeKind =
  | 'short-rest'
  | 'long-rest'
  | 'short-or-long-rest'
  /** Short Rest regains ONE expended use, Long Rest regains all. */
  | 'short-one-long-all'
  /** Manual only: no PHB class/subclass/feat feature uses it. */
  | 'dawn'
  /** Manual only. */
  | 'other';

/** [owner class level, value from that level on]. */
export type GoldenSteps = ReadonlyArray<readonly [level: number, value: number]>;

/** Maximum uses; a literal spec, never the app's `UsesCount`. */
export type MaxSpec =
  | { kind: 'fixed'; value: number }
  /** Value of the last row whose level <= the OWNER CLASS level (0 before the first row). */
  | { kind: 'table'; rows: GoldenSteps }
  /** factor * ownerClassLevel + offset. */
  | { kind: 'multiple'; factor: number; offset?: number }
  /** max(min, modifier of the EFFECTIVE ability score). */
  | { kind: 'ability'; ability: Ability; min: 1 }
  /** Proficiency Bonus from TOTAL character level (PHB L2092). */
  | { kind: 'proficiency' };

export interface GoldenTrackerRow {
  id: string;
  ownerKind: GoldenOwnerKind;
  /** Class id for class / subclass / invocation rows. */
  classId?: string;
  subclassId?: string;
  featId?: string;
  invocationId?: string;
  /** Display name of the highest-level feature of the pool. */
  name: string;
  /** Names of every feature that shares the pool (pool merge), highest level last. */
  features: string[];
  /** Owner class level at which the tracker appears (for feats: the character level the feat needs, 0 = any). */
  fromLevel: number;
  /** PHB lines (heading, rule text, table rows) the row was verified against. */
  phbLines: number[];
  max: MaxSpec;
  /** Recharge in force at `fromLevel`. */
  recharge: GoldenRechargeKind;
  /** Later recharge changes by owner class level (Bardic Inspiration L5, Improved Warding Flare L6). */
  rechargeFrom?: ReadonlyArray<readonly [level: number, recharge: GoldenRechargeKind]>;
  /** Display noun [singular, plural]; default ['use', 'uses']. */
  unit?: readonly [string, string];
  /** Die size for dice pools: fixed or by owner class level. */
  dieSize?: number | GoldenSteps;
  /** N independent single-use instances (ids get `#0`, `#1` ...). */
  variants?: string[];
  /** Another way the PHB lets you restore a use. Display text only in D1. */
  alsoRestoredBy?: string;
}

// ═════════════════════════ row builders (data only) ═════════════════════════

const ONE: MaxSpec = { kind: 'fixed', value: 1 };
const fixed = (value: number): MaxSpec => ({ kind: 'fixed', value });
const table = (...rows: Array<[number, number]>): MaxSpec => ({ kind: 'table', rows });
const abil = (ability: Ability): MaxSpec => ({ kind: 'ability', ability, min: 1 });

type Extra = Partial<
  Pick<GoldenTrackerRow, 'rechargeFrom' | 'unit' | 'dieSize' | 'variants' | 'alsoRestoredBy' | 'features'>
>;

function cls(
  classId: string,
  pool: string,
  name: string,
  fromLevel: number,
  phbLines: number[],
  max: MaxSpec,
  recharge: GoldenRechargeKind,
  extra: Extra = {},
): GoldenTrackerRow {
  return { id: `${classId}.${pool}`, ownerKind: 'class', classId, name, features: [name], fromLevel, phbLines, max, recharge, ...extra };
}

function sub(
  classId: string,
  subclassId: string,
  pool: string,
  name: string,
  fromLevel: number,
  phbLines: number[],
  max: MaxSpec,
  recharge: GoldenRechargeKind,
  extra: Extra = {},
): GoldenTrackerRow {
  return { id: `${classId}.${pool}`, ownerKind: 'subclass', classId, subclassId, name, features: [name], fromLevel, phbLines, max, recharge, ...extra };
}

function feat(
  featId: string,
  pool: string,
  name: string,
  phbLines: number[],
  max: MaxSpec,
  recharge: GoldenRechargeKind,
  extra: Extra = {},
): GoldenTrackerRow {
  return { id: `feat:${featId}.${pool}`, ownerKind: 'feat', featId, name, features: [name], fromLevel: 0, phbLines, max, recharge, ...extra };
}

function inv(invocationId: string, name: string, phbLines: number[], recharge: GoldenRechargeKind): GoldenTrackerRow {
  return {
    id: `warlock.invocation-${invocationId}`,
    ownerKind: 'invocation',
    classId: 'warlock',
    invocationId,
    name,
    features: [name],
    fromLevel: 0,
    phbLines,
    max: ONE,
    recharge,
  };
}

// Psionic Energy Dice (Psi Warrior L4426-4437, Soulknife L6116-6127). Die size by Fighter / Rogue level.
const PED_COUNT = table([3, 4], [5, 6], [9, 8], [11, 8], [13, 10], [17, 12]);
const PED_DIE: GoldenSteps = [[3, 6], [5, 8], [11, 10], [17, 12]];
const PED_UNIT = ['Psionic Energy Die', 'Psionic Energy Dice'] as const;
const DIE_UNIT = ['die', 'dice'] as const;
const RAGE_ALSO = 'expend a use of Rage (no action)';
const SLOT5_ALSO = 'expend a level 5 spell slot (no action)';
const PED_ALSO = 'expend a Psionic Energy Die (no action)';

// ═════════════════════════════ TRACKER_ROWS ═════════════════════════════════
// One row per tracker (plan.md section 5). 28 class + 56 subclass + 12 feat + 2 invocation rows.

export const CLASS_ROWS: GoldenTrackerRow[] = [
  // BARBARIAN. Rages column L2452-2473; "regain one expended use on a Short Rest, all on a Long Rest" L2428.
  cls('barbarian', 'rage', 'Rage', 1, [2424, 2428, 2452], table([1, 2], [3, 3], [6, 4], [12, 5], [17, 6]), 'short-one-long-all', { unit: ['Rage', 'Rages'] }),
  // Persistent Rage: regain all Rage uses on Initiative, once until a Long Rest (L2533). The gate is the tracker.
  cls('barbarian', 'persistent-rage', 'Persistent Rage', 15, [2533], ONE, 'long-rest'),
  // BARD. Cha mod (min 1) L2737; Font of Inspiration L5 -> Short or Long Rest and a spell slot regains one (L2820-2822).
  cls('bard', 'bardic-inspiration', 'Bardic Inspiration', 1, [2729, 2737, 2818, 2820, 2822], abil('cha'), 'long-rest', {
    features: ['Bardic Inspiration', 'Font of Inspiration'],
    rechargeFrom: [[5, 'short-or-long-rest']],
    alsoRestoredBy: 'expend a spell slot (no action) to regain one expended use (Font of Inspiration, from level 5)',
  }),
  // CLERIC. Channel Divinity column L3207-3226 (L1 blank); this class's own pool L3238-3242.
  cls('cleric', 'channel-divinity', 'Channel Divinity', 2, [3236, 3238, 3240, 3242, 3208, 3212, 3224], table([2, 2], [6, 3], [18, 4]), 'short-one-long-all'),
  cls('cleric', 'divine-intervention', 'Divine Intervention', 10, [3268, 3270], ONE, 'long-rest'),
  // DRUID. Wild Shape column L3637-3656; L3674 / L3678.
  cls('druid', 'wild-shape', 'Wild Shape', 2, [3672, 3674, 3678, 3638, 3642, 3653], table([2, 2], [6, 3], [17, 4]), 'short-one-long-all'),
  // Wild Resurgence / Nature Magician: the once-per-Long-Rest limit is on the Wild Shape -> spell slot direction only.
  cls('druid', 'wild-resurgence', 'Wild Resurgence', 5, [3716, 3720], ONE, 'long-rest'),
  cls('druid', 'nature-magician', 'Archdruid: Nature Magician', 20, [3746, 3754], ONE, 'long-rest'),
  // FIGHTER. Second Wind column L4158-4179; L4118-4120.
  cls('fighter', 'second-wind', 'Second Wind', 1, [4114, 4118, 4120, 4160, 4163, 4169], table([1, 2], [4, 3], [10, 4]), 'short-one-long-all'),
  // Action Surge (one use) L4161, (two uses) L4176. Short or Long Rest.
  cls('fighter', 'action-surge', 'Action Surge', 2, [4142, 4146, 4161, 4176], table([2, 1], [17, 2]), 'short-or-long-rest'),
  // Indomitable (one use) L4168, (two uses) L4172, (three uses) L4176; Long Rest L4199.
  cls('fighter', 'indomitable', 'Indomitable', 9, [4195, 4197, 4199, 4168, 4172, 4176], table([9, 1], [13, 2], [17, 3]), 'long-rest'),
  // MONK. Focus Points = Monk level (table L4549-4550...), regain all on Short or Long Rest (L4571).
  cls('monk', 'focus-points', "Monk's Focus", 2, [4538, 4569, 4571, 4549], { kind: 'multiple', factor: 1 }, 'short-or-long-rest', { unit: ['Focus Point', 'Focus Points'] }),
  cls('monk', 'uncanny-metabolism', 'Uncanny Metabolism', 2, [4585, 4587, 4589], ONE, 'long-rest'),
  // PALADIN. Lay On Hands pool = 5 x Paladin level, Long Rest (L4853).
  cls('paladin', 'lay-on-hands', 'Lay On Hands', 1, [4851, 4853, 4855, 4857], { kind: 'multiple', factor: 5 }, 'long-rest', { unit: ['Hit Point', 'Hit Points'] }),
  // Paladin's own Channel Divinity, 2 at L3 and +1 at L11 (L4877, L4885, L4922).
  cls('paladin', 'channel-divinity', 'Channel Divinity', 3, [4918, 4920, 4922, 4924, 4877, 4885], table([3, 2], [11, 3]), 'short-one-long-all'),
  // Paladin's Smite: free Divine Smite cast once per Long Rest (L4916); Faithful Steed: free Find Steed (L4942).
  cls('paladin', 'divine-smite-free', "Paladin's Smite (free Divine Smite)", 2, [4914, 4916], ONE, 'long-rest'),
  cls('paladin', 'faithful-steed', 'Faithful Steed (free Find Steed)', 5, [4938, 4942], ONE, 'long-rest'),
  // RANGER. Favored Enemy column L5383-5402 read against the prose "twice" at L1 (L5375).
  cls('ranger', 'favored-enemy', 'Favored Enemy (free Hunter\'s Mark)', 1, [5373, 5375, 5383, 5387, 5391, 5395, 5399], table([1, 2], [5, 3], [9, 4], [13, 5], [17, 6]), 'long-rest'),
  cls('ranger', 'tireless', 'Tireless', 10, [5442, 5446], abil('wis'), 'long-rest'),
  cls('ranger', 'natures-veil', "Nature's Veil", 14, [5454, 5458], abil('wis'), 'long-rest'),
  // ROGUE.
  cls('rogue', 'stroke-of-luck', 'Stroke of Luck', 20, [5991, 5993], ONE, 'short-or-long-rest'),
  // SORCERER. Innate Sorcery twice, Long Rest (L6315); Sorcery Points = Sorcerer level (column L6277-6296), Long Rest (L6321).
  cls('sorcerer', 'innate-sorcery', 'Innate Sorcery', 1, [6308, 6315, 6361], fixed(2), 'long-rest'),
  cls('sorcerer', 'sorcery-points', 'Font of Magic (Sorcery Points)', 2, [6317, 6321, 6277, 6278, 6281, 6296], { kind: 'multiple', factor: 1 }, 'long-rest', { unit: ['Sorcery Point', 'Sorcery Points'] }),
  // Only the once-per-Long-Rest GATE is tracked; the points regained (half Sorcerer level) are manual.
  cls('sorcerer', 'sorcerous-restoration', 'Sorcerous Restoration', 5, [6355, 6357], ONE, 'long-rest'),
  // WARLOCK. Mystic Arcanum (L6886-6892) is tracked on the Spells page already (see EXCLUSIONS).
  cls('warlock', 'magical-cunning', 'Magical Cunning', 2, [6870, 6872], ONE, 'long-rest'),
  cls('warlock', 'contact-patron', 'Contact Patron', 9, [6880, 6884], ONE, 'long-rest'),
  // WIZARD.
  cls('wizard', 'arcane-recovery', 'Arcane Recovery', 1, [7459, 7463], ONE, 'long-rest'),
  cls('wizard', 'signature-spells', 'Signature Spells', 20, [7489, 7491], ONE, 'short-or-long-rest', { variants: ['Signature Spell 1', 'Signature Spell 2'] }),
];

export const SUBCLASS_ROWS: GoldenTrackerRow[] = [
  // ── Barbarian ──
  sub('barbarian', 'berserker', 'intimidating-presence', 'Intimidating Presence', 14, [2571, 2573], ONE, 'long-rest', { alsoRestoredBy: RAGE_ALSO }),
  // Warrior of the Gods: FOUR d12s at L3, +1 at L6 / L12 / L17 (L2649, L2653). plan.md said a constant 4: wrong.
  sub('barbarian', 'zealot', 'warrior-of-the-gods', 'Warrior of the Gods', 3, [2647, 2649, 2651, 2653], table([3, 4], [6, 5], [12, 6], [17, 7]), 'long-rest', { unit: DIE_UNIT, dieSize: 12 }),
  sub('barbarian', 'zealot', 'zealous-presence', 'Zealous Presence', 10, [2659, 2663], ONE, 'long-rest', { alsoRestoredBy: RAGE_ALSO }),
  sub('barbarian', 'zealot', 'rage-of-the-gods', 'Rage of the Gods', 14, [2665, 2667], ONE, 'long-rest'),
  // ── Bard ──
  sub('bard', 'glamour', 'beguiling-magic', 'Beguiling Magic', 3, [3021, 3027], ONE, 'long-rest', { alsoRestoredBy: 'expend one use of Bardic Inspiration (no action)' }),
  sub('bard', 'glamour', 'mantle-of-majesty', 'Mantle of Majesty', 6, [3033, 3043], ONE, 'long-rest', { alsoRestoredBy: 'expend a level 3+ spell slot (no action)' }),
  sub('bard', 'glamour', 'unbreakable-majesty', 'Unbreakable Majesty', 14, [3047, 3049], ONE, 'short-or-long-rest'),
  // ── Cleric ──
  // Warding Flare L3 and Improved Warding Flare L6 are ONE pool; the L6 feature changes the recharge (L3477).
  sub('cleric', 'light', 'warding-flare', 'Improved Warding Flare', 3, [3471, 3475, 3477], abil('wis'), 'long-rest', {
    features: ['Warding Flare', 'Improved Warding Flare'],
    rechargeFrom: [[6, 'short-or-long-rest']],
  }),
  sub('cleric', 'light', 'corona-of-light', 'Corona of Light', 17, [3481, 3485], abil('wis'), 'long-rest'),
  sub('cleric', 'war', 'war-priest', 'War Priest', 3, [3557, 3559], abil('wis'), 'short-or-long-rest'),
  // ── Druid ──
  sub('druid', 'land', 'natural-recovery', 'Natural Recovery', 6, [3902, 3904, 3906], ONE, 'long-rest'),
  sub('druid', 'moon', 'moonlight-step', 'Moonlight Step', 10, [3968, 3972], abil('wis'), 'long-rest', { alsoRestoredBy: 'expend a level 2+ spell slot per use (no action)' }),
  sub('druid', 'stars', 'star-map', 'Star Map', 3, [4031, 4035], abil('wis'), 'long-rest'),
  sub('druid', 'stars', 'cosmic-omen', 'Cosmic Omen', 6, [4064, 4066, 4072], abil('wis'), 'long-rest'),
  // ── Fighter ──
  // Superiority Dice: 4 (L4239), 5 at L7, 6 at L15 (L4241); d8 -> d10 at L10 (L4257) -> d12 at L18 (L4263).
  sub('fighter', 'battleMaster', 'superiority-dice', 'Combat Superiority (Superiority Dice)', 3, [4229, 4239, 4241, 4257, 4263], table([3, 4], [7, 5], [15, 6]), 'short-or-long-rest', {
    unit: ['Superiority Die', 'Superiority Dice'],
    dieSize: [[3, 8], [10, 10], [18, 12]],
  }),
  sub('fighter', 'battleMaster', 'know-your-enemy', 'Know Your Enemy', 7, [4251, 4255], ONE, 'long-rest', { alsoRestoredBy: 'expend one Superiority Die (no action)' }),
  sub('fighter', 'psiWarrior', 'psionic-energy-dice', 'Psionic Power (Psionic Energy Dice)', 3, [4420, 4426, 4428, 4429, 4430, 4431, 4432, 4433, 4435, 4437], PED_COUNT, 'short-one-long-all', { unit: PED_UNIT, dieSize: PED_DIE }),
  // Psi-Powered Leap sits under Telekinetic Adept (L7); the OCR heading is damaged, so the existing golden line 4447 is used.
  sub('fighter', 'psiWarrior', 'psi-powered-leap', 'Telekinetic Adept (Psi-Powered Leap)', 7, [4447, 4451], ONE, 'short-or-long-rest', { alsoRestoredBy: PED_ALSO }),
  sub('fighter', 'psiWarrior', 'bulwark-of-force', 'Bulwark of Force', 15, [4459, 4463], ONE, 'long-rest', { alsoRestoredBy: PED_ALSO }),
  sub('fighter', 'psiWarrior', 'telekinetic-master', 'Telekinetic Master', 18, [4465, 4469], ONE, 'long-rest', { alsoRestoredBy: PED_ALSO }),
  // ── Monk ──
  sub('monk', 'mercy', 'flurry-of-healing-and-harm', 'Flurry of Healing and Harm', 11, [4701, 4705], abil('wis'), 'long-rest'),
  sub('monk', 'mercy', 'hand-of-ultimate-mercy', 'Hand of Ultimate Mercy', 17, [4707, 4709], ONE, 'long-rest'),
  sub('monk', 'openHand', 'wholeness-of-body', 'Wholeness of Body', 6, [4793, 4797], abil('wis'), 'long-rest'),
  // ── Paladin ──
  sub('paladin', 'devotion', 'holy-nimbus', 'Holy Nimbus', 20, [5143, 5145], ONE, 'long-rest', { alsoRestoredBy: SLOT5_ALSO }),
  sub('paladin', 'glory', 'glorious-defense', 'Glorious Defense', 15, [5193, 5197], abil('cha'), 'long-rest'),
  sub('paladin', 'glory', 'living-legend', 'Living Legend', 20, [5199, 5201], ONE, 'long-rest', { alsoRestoredBy: SLOT5_ALSO }),
  sub('paladin', 'ancients', 'undying-sentinel', 'Undying Sentinel', 15, [5245, 5249], ONE, 'long-rest'),
  sub('paladin', 'ancients', 'elder-champion', 'Elder Champion', 20, [5251, 5253], ONE, 'long-rest', { alsoRestoredBy: SLOT5_ALSO }),
  sub('paladin', 'vengeance', 'avenging-angel', 'Avenging Angel', 20, [5301, 5303], ONE, 'long-rest', { alsoRestoredBy: SLOT5_ALSO }),
  // ── Ranger ──
  sub('ranger', 'feyWanderer', 'fey-reinforcements', 'Fey Reinforcements', 11, [5753], ONE, 'long-rest'),
  sub('ranger', 'feyWanderer', 'misty-wanderer', 'Misty Wanderer', 15, [5757, 5759], abil('wis'), 'long-rest'),
  sub('ranger', 'gloomStalker', 'dread-ambusher', 'Dread Ambusher (Dreadful Strike)', 3, [5769, 5775], abil('wis'), 'long-rest'),
  // ── Rogue ──
  sub('rogue', 'arcaneTrickster', 'spell-thief', 'Spell Thief', 17, [6058, 6064], ONE, 'long-rest'),
  sub('rogue', 'soulknife', 'psionic-energy-dice', 'Psionic Power (Psionic Energy Dice)', 3, [6110, 6116, 6118, 6119, 6120, 6121, 6122, 6123, 6125, 6127], PED_COUNT, 'short-one-long-all', { unit: PED_UNIT, dieSize: PED_DIE }),
  sub('rogue', 'soulknife', 'psychic-veil', 'Psychic Veil', 13, [6161, 6163], ONE, 'long-rest', { alsoRestoredBy: PED_ALSO }),
  sub('rogue', 'soulknife', 'rend-mind', 'Rend Mind', 17, [6167, 6171], ONE, 'long-rest', { alsoRestoredBy: 'expend three Psionic Energy Dice (no action)' }),
  // ── Sorcerer ──
  sub('sorcerer', 'aberrant', 'warping-implosion', 'Warping Implosion', 18, [6581, 6585], ONE, 'long-rest', { alsoRestoredBy: 'spend 5 Sorcery Points (no action)' }),
  sub('sorcerer', 'clockwork', 'restore-balance', 'Restore Balance', 3, [6620, 6624], abil('cha'), 'long-rest'),
  sub('sorcerer', 'clockwork', 'trance-of-order', 'Trance of Order', 14, [6632, 6636], ONE, 'long-rest', { alsoRestoredBy: 'spend 5 Sorcery Points (no action)' }),
  sub('sorcerer', 'clockwork', 'clockwork-cavalcade', 'Clockwork Cavalcade', 18, [6638, 6640], ONE, 'long-rest', { alsoRestoredBy: 'spend 7 Sorcery Points (no action)' }),
  sub('sorcerer', 'draconic', 'dragon-wings', 'Dragon Wings', 14, [6683, 6687], ONE, 'long-rest', { alsoRestoredBy: 'spend 3 Sorcery Points (no action)' }),
  sub('sorcerer', 'draconic', 'dragon-companion', 'Dragon Companion', 18, [6689], ONE, 'long-rest'),
  // Tides of Chaos: regained on a Long Rest OR by casting a Sorcerer spell with a slot (L6707-6709). Modelled long-rest + hint (flag 10).
  sub('sorcerer', 'wildMagic', 'tides-of-chaos', 'Tides of Chaos', 3, [6705, 6707, 6709], ONE, 'long-rest', { alsoRestoredBy: 'cast a Sorcerer spell with a spell slot (triggers a Wild Magic Surge)' }),
  sub('sorcerer', 'wildMagic', 'tamed-surge', 'Tamed Surge', 18, [6721, 6727], ONE, 'long-rest'),
  // ── Warlock ──
  sub('warlock', 'archfey', 'steps-of-the-fey', 'Steps of the Fey', 3, [7200, 7202], abil('cha'), 'long-rest'),
  sub('warlock', 'archfey', 'beguiling-defenses', 'Beguiling Defenses', 10, [7220, 7224], ONE, 'long-rest', { alsoRestoredBy: 'expend a Pact Magic spell slot (no action)' }),
  // Healing Light: a pool of d6s equal to 1 + Warlock level (L7254).
  sub('warlock', 'celestial', 'healing-light', 'Healing Light', 3, [7252, 7254, 7256], { kind: 'multiple', factor: 1, offset: 1 }, 'long-rest', { unit: DIE_UNIT, dieSize: 6 }),
  sub('warlock', 'celestial', 'searing-vengeance', 'Searing Vengeance', 14, [7264, 7266], ONE, 'long-rest'),
  sub('warlock', 'fiend', 'dark-ones-own-luck', "Dark One's Own Luck", 6, [7293, 7297], abil('cha'), 'long-rest'),
  sub('warlock', 'fiend', 'hurl-through-hell', 'Hurl Through Hell', 14, [7303, 7307], ONE, 'long-rest', { alsoRestoredBy: 'expend a Pact Magic spell slot (no action)' }),
  sub('warlock', 'greatOldOne', 'clairvoyant-combatant', 'Clairvoyant Combatant', 6, [7340, 7344], ONE, 'short-or-long-rest', { alsoRestoredBy: 'expend a Pact Magic spell slot (no action)' }),
  // ── Wizard ──
  // Only the once-per-Long-Rest creation is tracked; the ward's Hit Point maximum is not a D1 tracker (flag 11).
  sub('wizard', 'abjurer', 'arcane-ward', 'Arcane Ward', 3, [7664, 7666, 7668, 7670], ONE, 'long-rest'),
  // Portent: 2 foretelling rolls, 3 with Greater Portent (L14). Rolled values are not recorded (flag 12).
  sub('wizard', 'diviner', 'portent', 'Portent', 3, [7698, 7700, 7702, 7718, 7720], table([3, 2], [14, 3]), 'long-rest', {
    features: ['Portent', 'Greater Portent'],
    unit: ['foretelling roll', 'foretelling rolls'],
  }),
  sub('wizard', 'diviner', 'third-eye', 'The Third Eye', 10, [7708, 7712], ONE, 'short-or-long-rest'),
  sub('wizard', 'illusionist', 'phantasmal-creatures', 'Phantasmal Creatures', 6, [7772, 7774], ONE, 'long-rest', { variants: ['Summon Beast', 'Summon Fey'] }),
  sub('wizard', 'illusionist', 'illusory-self', 'Illusory Self', 10, [7776, 7778, 7780], ONE, 'short-or-long-rest', { alsoRestoredBy: 'expend a level 2+ spell slot (no action)' }),
];

export const FEAT_ROWS: GoldenTrackerRow[] = [
  // Lucky: Luck Points = Proficiency Bonus (TOTAL level), Long Rest (L8500).
  feat('lucky', 'luck-points', 'Luck Points', [8496, 8500], { kind: 'proficiency' }, 'long-rest', { unit: ['Luck Point', 'Luck Points'] }),
  // Magic Initiate: the level 1 spell once without a slot per Long Rest (L8512). Three feat ids in the app (flag 13).
  feat('magic-initiate-cleric', 'free-cast', 'Magic Initiate (Cleric): level 1 spell', [8506, 8512], ONE, 'long-rest'),
  feat('magic-initiate-druid', 'free-cast', 'Magic Initiate (Druid): level 1 spell', [8506, 8512], ONE, 'long-rest'),
  feat('magic-initiate-wizard', 'free-cast', 'Magic Initiate (Wizard): level 1 spell', [8506, 8512], ONE, 'long-rest'),
  feat('fey-touched', 'free-cast', 'Fey-Touched: Fey Magic', [8690, 8698], ONE, 'long-rest', { variants: ['Chosen spell', 'Misty Step'] }),
  feat('shadow-touched', 'free-cast', 'Shadow-Touched: Shadow Magic', [8914, 8922], ONE, 'long-rest', { variants: ['Chosen spell', 'Invisibility'] }),
  feat('telepathic', 'detect-thoughts', 'Telepathic: Detect Thoughts', [9028, 9040], ONE, 'long-rest'),
  feat('ritual-caster', 'quick-ritual', 'Ritual Caster: Quick Ritual', [8884, 8900], ONE, 'long-rest'),
  feat('mage-slayer', 'guarded-mind', 'Mage Slayer: Guarded Mind', [8776, 8784], ONE, 'short-or-long-rest'),
  // Boon of Fate: Initiative, Short Rest or Long Rest (L9170). Rests automate, Initiative is manual (flag 14).
  feat('boon-of-fate', 'improve-fate', 'Boon of Fate: Improve Fate', [9164, 9170], ONE, 'short-or-long-rest', { alsoRestoredBy: 'roll Initiative' }),
  feat('boon-of-recovery', 'last-stand', 'Boon of Recovery: Last Stand', [9190, 9196], ONE, 'long-rest'),
  // Recover Vitality: a pool of ten d10s (L9198; the OCR prints "d1Os").
  feat('boon-of-recovery', 'recover-vitality', 'Boon of Recovery: Recover Vitality', [9190, 9198], fixed(10), 'long-rest', { unit: DIE_UNIT, dieSize: 10 }),
];

export const INVOCATION_ROWS: GoldenTrackerRow[] = [
  inv('gift-of-the-depths', 'Gift of the Depths: Water Breathing free cast', [6968, 6972], 'long-rest'),
  // "no creature can benefit from it until you finish a Long Rest" (L6980) modelled as one use (flag 15).
  inv('gift-of-the-protectors', 'Gift of the Protectors: drop to 1 HP trigger', [6974, 6980], 'long-rest'),
];

export const TRACKER_ROWS: GoldenTrackerRow[] = [...CLASS_ROWS, ...SUBCLASS_ROWS, ...FEAT_ROWS, ...INVOCATION_ROWS];

// ═════════════════════════════ MAX_CASES ════════════════════════════════════

/**
 * Expected maximum uses by OWNER CLASS level 1..20 (index 0 = level 1), authored from the PHB tables
 * separately from the MaxSpec rows above so a typo in either side fails the oracle. 0 = the feature is
 * not yet gained. Table pools are pinned at EVERY level (a superset of every step and one level either side).
 */
export const MAX_BY_LEVEL: Record<string, readonly number[]> = {
  // Rages column (L2454-2473): 2 / 3 at L3 / 4 at L6 / 5 at L12 / 6 at L17.
  'barbarian.rage': [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6],
  // Channel Divinity column (L3207-3226): 2 at L2 / 3 at L6 / 4 at L18.
  'cleric.channel-divinity': [0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4],
  // Paladin Channel Divinity (L4875-4894): 2 at L3 / 3 at L11.
  'paladin.channel-divinity': [0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  // Wild Shape column (L3637-3656): 2 at L2 / 3 at L6 / 4 at L17.
  'druid.wild-shape': [0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4],
  // Second Wind column (L4160-4179): 2 / 3 at L4 / 4 at L10.
  'fighter.second-wind': [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  // Action Surge: one use at L2 (L4161), two at L17 (L4176).
  'fighter.action-surge': [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2],
  // Indomitable: one use L9 (L4168), two L13 (L4172), three L17 (L4176).
  'fighter.indomitable': [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3],
  // Favored Enemy column (L5383-5402): 2 / 3 at L5 / 4 at L9 / 5 at L13 / 6 at L17.
  'ranger.favored-enemy': [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6],
  // Superiority Dice (Fighter level): 4 / 5 at L7 / 6 at L15 (L4239-4241).
  'fighter.superiority-dice': [0, 0, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6],
  // Psionic Energy Dice count by Fighter / Rogue level (L4426-4433, L6116-6123).
  'fighter.psionic-energy-dice': [0, 0, 4, 4, 6, 6, 6, 6, 8, 8, 8, 8, 10, 10, 10, 10, 12, 12, 12, 12],
  'rogue.psionic-energy-dice': [0, 0, 4, 4, 6, 6, 6, 6, 8, 8, 8, 8, 10, 10, 10, 10, 12, 12, 12, 12],
  // Portent: two foretelling rolls, three at L14 (L7700, L7720).
  'wizard.portent': [0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3],
  // Warrior of the Gods: four d12s, +1 at L6, L12, L17 (L2649, L2653).
  'barbarian.warrior-of-the-gods': [0, 0, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 7],
  // Lay On Hands: 5 x Paladin level (L4853).
  'paladin.lay-on-hands': [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
  // Monk's Focus Points: none at L1, then = Monk level (L4549-4550).
  'monk.focus-points': [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  // Sorcery Points: none at L1 (Font of Magic is L2), then = Sorcerer level (L6277-6296).
  'sorcerer.sorcery-points': [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  // Healing Light: 1 + Warlock level d6s, gained at L3 (L7254).
  'warlock.healing-light': [0, 0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
};

/** Die size by owner class level 1..20 (0 = none yet) for pools that have one. */
export const DIE_SIZE_BY_LEVEL: Record<string, readonly number[]> = {
  // Superiority Die: d8, d10 at L10 (L4257), d12 at L18 (L4263).
  'fighter.superiority-dice': [0, 0, 8, 8, 8, 8, 8, 8, 8, 10, 10, 10, 10, 10, 10, 10, 10, 12, 12, 12],
  // Psionic Energy Die (L4426-4433, L6116-6123): d6, d8 at L5, d10 at L11, d12 at L17.
  'fighter.psionic-energy-dice': [0, 0, 6, 6, 8, 8, 8, 8, 8, 8, 10, 10, 10, 10, 10, 10, 12, 12, 12, 12],
  'rogue.psionic-energy-dice': [0, 0, 6, 6, 8, 8, 8, 8, 8, 8, 10, 10, 10, 10, 10, 10, 12, 12, 12, 12],
};

export interface GoldenMaxCase {
  id: string;
  /** Level of the OWNER class (or of the single class). */
  classLevel: number;
  /** Total character level (== classLevel for a single-class character). */
  totalLevel: number;
  expectedMax: number;
}

/** Table / multiple pools: every owner level 1..20 from MAX_BY_LEVEL. */
export const LEVEL_MAX_CASES: GoldenMaxCase[] = Object.entries(MAX_BY_LEVEL).flatMap(([id, values]) =>
  values.map((expectedMax, i) => ({ id, classLevel: i + 1, totalLevel: i + 1, expectedMax })),
);

/** Ability-modifier pools: scores 1,8,9,10,12,14,18,20,30 -> max(1, mod). Score 30 = +10 (Epic Boon cap). */
export const ABILITY_SCORES_CASES: ReadonlyArray<{ score: number; mod: number; expectedMax: number }> = [
  { score: 1, mod: -5, expectedMax: 1 },
  { score: 8, mod: -1, expectedMax: 1 },
  { score: 9, mod: -1, expectedMax: 1 },
  { score: 10, mod: 0, expectedMax: 1 },
  { score: 12, mod: 1, expectedMax: 1 },
  { score: 14, mod: 2, expectedMax: 2 },
  { score: 18, mod: 4, expectedMax: 4 },
  { score: 20, mod: 5, expectedMax: 5 },
  { score: 30, mod: 10, expectedMax: 10 },
];

/** Lucky (Luck Points = Proficiency Bonus from TOTAL level): L1-4 +2, L5-8 +3, L9-12 +4, L13-16 +5, L17-20 +6 (L2092). */
export const LUCKY_CASES: ReadonlyArray<{ totalLevel: number; expectedMax: number }> = [
  { totalLevel: 1, expectedMax: 2 },
  { totalLevel: 4, expectedMax: 2 },
  { totalLevel: 5, expectedMax: 3 },
  { totalLevel: 8, expectedMax: 3 },
  { totalLevel: 9, expectedMax: 4 },
  { totalLevel: 12, expectedMax: 4 },
  { totalLevel: 13, expectedMax: 5 },
  { totalLevel: 16, expectedMax: 5 },
  { totalLevel: 17, expectedMax: 6 },
  { totalLevel: 20, expectedMax: 6 },
];

// ═══════════════════════════ RECHARGE_CASES ═════════════════════════════════

export interface GoldenRechargeCase {
  name: string;
  recharge: GoldenRechargeKind;
  max: number;
  spentBefore: number;
  /** Remaining uses (max - spent) after a completed Short Rest / Long Rest. */
  remainingAfterShort: number;
  remainingAfterLong: number;
  /** Recovery entry rule the rest result must report (null = no entry because nothing recovered). */
  shortRule: 'all' | 'one' | null;
  longRule: 'all' | 'one' | null;
}

/**
 * 'short-rest' (all on Short Rest only) has no PHB class/subclass/feat feature and plan.md contradicts itself on
 * whether a Long Rest also restores it, so it is deliberately NOT pinned here (flag in the FEAT findings).
 */
export const RECHARGE_CASES: GoldenRechargeCase[] = [
  // Short Rest regains ONE expended use, Long Rest all (Rage L2428, Channel Divinity L3240, Psionic dice L4437).
  { name: 'short-one-long-all, 3 of 6 spent', recharge: 'short-one-long-all', max: 6, spentBefore: 3, remainingAfterShort: 4, remainingAfterLong: 6, shortRule: 'one', longRule: 'all' },
  { name: 'short-one-long-all, 1 of 6 spent', recharge: 'short-one-long-all', max: 6, spentBefore: 1, remainingAfterShort: 6, remainingAfterLong: 6, shortRule: 'one', longRule: 'all' },
  { name: 'short-one-long-all, nothing spent', recharge: 'short-one-long-all', max: 6, spentBefore: 0, remainingAfterShort: 6, remainingAfterLong: 6, shortRule: null, longRule: null },
  // Short or Long Rest regains ALL (Monk L4571, Action Surge, Superiority Dice L4239).
  { name: 'short-or-long-rest, 3 of 5 spent', recharge: 'short-or-long-rest', max: 5, spentBefore: 3, remainingAfterShort: 5, remainingAfterLong: 5, shortRule: 'all', longRule: 'all' },
  { name: 'short-or-long-rest, nothing spent', recharge: 'short-or-long-rest', max: 5, spentBefore: 0, remainingAfterShort: 5, remainingAfterLong: 5, shortRule: null, longRule: null },
  // Long Rest only.
  { name: 'long-rest, 3 of 5 spent', recharge: 'long-rest', max: 5, spentBefore: 3, remainingAfterShort: 2, remainingAfterLong: 5, shortRule: null, longRule: 'all' },
  { name: 'long-rest, all spent', recharge: 'long-rest', max: 1, spentBefore: 1, remainingAfterShort: 0, remainingAfterLong: 1, shortRule: null, longRule: 'all' },
  // Manual only: never automatic.
  { name: 'other, 2 of 3 spent', recharge: 'other', max: 3, spentBefore: 2, remainingAfterShort: 1, remainingAfterLong: 1, shortRule: null, longRule: null },
  { name: 'dawn, 2 of 3 spent', recharge: 'dawn', max: 3, spentBefore: 2, remainingAfterShort: 1, remainingAfterLong: 1, shortRule: null, longRule: null },
];

/**
 * An INTERRUPTED Short Rest (rests.ts `shortRest` returns before recharge) recovers nothing, for every kind
 * (unchanged behaviour: PHB "Short Rest" is a full hour of uninterrupted rest).
 */
export const INTERRUPTED_SHORT_REST_CASES: ReadonlyArray<{ recharge: GoldenRechargeKind; max: number; spentBefore: number }> = [
  { recharge: 'short-one-long-all', max: 6, spentBefore: 3 },
  { recharge: 'short-or-long-rest', max: 5, spentBefore: 3 },
  { recharge: 'long-rest', max: 5, spentBefore: 3 },
];

// ═══════════════════════════ MULTICLASS_CASES ═══════════════════════════════

export interface GoldenClassEntry {
  classId: string;
  level: number;
  subclassId?: string;
}

export interface GoldenMulticlassCase {
  name: string;
  classes: GoldenClassEntry[];
  /** Feat ids taken (any source). */
  feats?: string[];
  abilityScores?: Partial<Record<Ability, number>>;
  /** Exact `max` per tracker id that must be present. */
  expectMax: Record<string, number>;
  /** Tracker ids that must NOT exist. */
  expectAbsent?: string[];
  /** Why (PHB reading), for failure messages. */
  rule: string;
}

/**
 * FLAG (INTERPRETATION, plan.md section 6 flag 1): the PHB "Multiclassing: Class Features" text (L2104-2106) gives
 * special rules only for Extra Attack, Spellcasting and alternative AC. It says nothing about resource pools.
 * Same-name pools are scoped by the class text itself ("this class's Channel Divinity", L3238-3242, L4920-4924;
 * "use only the dice from this subclass", L4435, L6125). So every class pool scales by THAT class's level, and
 * same-name pools of two classes stay separate trackers.
 */
export const MULTICLASS_CASES: GoldenMulticlassCase[] = [
  {
    name: 'Fighter 5 / Barbarian 3 (class pools use their own class level; Lucky PB uses total level 8)',
    classes: [{ classId: 'fighter', level: 5 }, { classId: 'barbarian', level: 3 }],
    feats: ['lucky'],
    expectMax: { 'fighter.second-wind': 3, 'fighter.action-surge': 1, 'barbarian.rage': 3, 'feat:lucky.luck-points': 3 },
    expectAbsent: ['fighter.indomitable', 'barbarian.persistent-rage'],
    rule: 'Second Wind L4163 (Fighter 4+), Rage L2456 (Barbarian 3), PB +3 at total level 8 (L2092)',
  },
  {
    name: 'Cleric 6 / Paladin 3 (two separate Channel Divinity pools, never merged)',
    classes: [{ classId: 'cleric', level: 6 }, { classId: 'paladin', level: 3 }],
    expectMax: { 'cleric.channel-divinity': 3, 'paladin.channel-divinity': 2, 'paladin.lay-on-hands': 15, 'paladin.divine-smite-free': 1 },
    expectAbsent: ['cleric.divine-intervention', 'paladin.faithful-steed'],
    rule: "this class's Channel Divinity (L3238-3242, L4920-4924); Cleric 6 = 3 (L3212), Paladin 3 = 2 (L4877)",
  },
  {
    name: 'Psi Warrior 5 / Soulknife 5 (two independent Psionic Energy Dice pools of 6)',
    classes: [{ classId: 'fighter', level: 5, subclassId: 'psiWarrior' }, { classId: 'rogue', level: 5, subclassId: 'soulknife' }],
    expectMax: { 'fighter.psionic-energy-dice': 6, 'rogue.psionic-energy-dice': 6, 'fighter.second-wind': 3 },
    expectAbsent: ['fighter.psi-powered-leap', 'rogue.psychic-veil'],
    rule: 'Features that use a Psionic Energy Die use only the dice from this subclass (L4435, L6125); 6 dice at level 5 (L4429, L6119)',
  },
  {
    name: 'Cleric 6 / Fighter 1 (Cleric levels never scale Fighter pools)',
    classes: [{ classId: 'cleric', level: 6 }, { classId: 'fighter', level: 1 }],
    expectMax: { 'cleric.channel-divinity': 3, 'fighter.second-wind': 2 },
    expectAbsent: ['fighter.action-surge'],
    rule: 'Second Wind 2 at Fighter 1 (L4160); Action Surge needs Fighter 2 (L4161)',
  },
  {
    name: 'Bard 4 / Sorcerer 2 (Bardic Inspiration from Cha mod, Sorcery Points from Sorcerer level)',
    classes: [{ classId: 'bard', level: 4 }, { classId: 'sorcerer', level: 2 }],
    abilityScores: { cha: 16 },
    expectMax: { 'bard.bardic-inspiration': 3, 'sorcerer.sorcery-points': 2, 'sorcerer.innate-sorcery': 2 },
    expectAbsent: ['sorcerer.sorcerous-restoration'],
    rule: 'Cha 16 = +3 (L2737); Sorcery Points = Sorcerer level 2 (L6278, L6321); Innate Sorcery twice (L6315)',
  },
  {
    name: 'Fighter 10 / Rogue 10 (PB from total level 20; class pools from their own class level)',
    classes: [{ classId: 'fighter', level: 10 }, { classId: 'rogue', level: 10 }],
    feats: ['lucky'],
    expectMax: { 'fighter.second-wind': 4, 'fighter.action-surge': 1, 'fighter.indomitable': 1, 'feat:lucky.luck-points': 6 },
    expectAbsent: ['rogue.stroke-of-luck'],
    rule: 'PB is based on total character level, not class level (L2092): +6 at 20, not +4 at 10; Second Wind 4 at Fighter 10 (L4169)',
  },
];

// ═══════════════════════════ ADVERSARIAL_CASES ══════════════════════════════

export type GoldenOp =
  | { op: 'spend'; id: string; amount?: number }
  | { op: 'regain'; id: string; amount?: number }
  | { op: 'setRemaining'; id: string; remaining: number }
  /** Change one class's level through the app's level logic (setLevel / level-up), de-level included. */
  | { op: 'setClassLevel'; classId: string; level: number };

export interface GoldenCheckpoint {
  /** Expected SPENT after the step (absent entry = 0). */
  spent?: Record<string, number>;
  remaining?: Record<string, number>;
  max?: Record<string, number>;
  /** The step must return the identical Character object (no-op). */
  sameObject?: true;
  /** Only assert 0 <= remaining <= max and integer-ness (the API may reject OR truncate the input). */
  invariantOnly?: true;
}

export interface GoldenAdversarialCase {
  name: string;
  classes: GoldenClassEntry[];
  /** `resourcesSpent` before any op. */
  spentBefore?: Record<string, number>;
  steps: Array<{ do: GoldenOp; expect: GoldenCheckpoint }>;
}

export const ADVERSARIAL_CASES: GoldenAdversarialCase[] = [
  {
    name: 'spend with 0 remaining returns the same object',
    classes: [{ classId: 'fighter', level: 1 }],
    spentBefore: { 'fighter.second-wind': 2 },
    steps: [{ do: { op: 'spend', id: 'fighter.second-wind' }, expect: { sameObject: true, remaining: { 'fighter.second-wind': 0 }, spent: { 'fighter.second-wind': 2 } } }],
  },
  {
    name: 'spend amount 5 with remaining 2 clamps at max (spent = max)',
    classes: [{ classId: 'fighter', level: 1 }],
    steps: [{ do: { op: 'spend', id: 'fighter.second-wind', amount: 5 }, expect: { spent: { 'fighter.second-wind': 2 }, remaining: { 'fighter.second-wind': 0 } } }],
  },
  {
    name: 'regain above max caps spent at 0',
    classes: [{ classId: 'fighter', level: 1 }],
    spentBefore: { 'fighter.second-wind': 1 },
    steps: [{ do: { op: 'regain', id: 'fighter.second-wind', amount: 5 }, expect: { spent: { 'fighter.second-wind': 0 }, remaining: { 'fighter.second-wind': 2 } } }],
  },
  {
    // FLAG: plan.md says negative / NaN / fractional amounts are "rejected or truncated per the API" (not pinned);
    // the invariant is the contract: the remaining count always stays an integer in 0..max.
    name: 'negative, NaN, fractional and infinite amounts keep remaining in range',
    classes: [{ classId: 'fighter', level: 1 }],
    steps: [
      { do: { op: 'spend', id: 'fighter.second-wind', amount: -1 }, expect: { invariantOnly: true } },
      { do: { op: 'spend', id: 'fighter.second-wind', amount: Number.NaN }, expect: { invariantOnly: true } },
      { do: { op: 'spend', id: 'fighter.second-wind', amount: 0.5 }, expect: { invariantOnly: true } },
      { do: { op: 'regain', id: 'fighter.second-wind', amount: -3 }, expect: { invariantOnly: true } },
      { do: { op: 'regain', id: 'fighter.second-wind', amount: Number.POSITIVE_INFINITY }, expect: { invariantOnly: true } },
    ],
  },
  {
    name: 'unknown id returns the input object',
    classes: [{ classId: 'fighter', level: 1 }],
    steps: [
      { do: { op: 'spend', id: 'fighter.no-such-pool' }, expect: { sameObject: true } },
      { do: { op: 'regain', id: 'wizard.arcane-recovery' }, expect: { sameObject: true } },
    ],
  },
  {
    name: 'setRemaining clamps 99 to max, -4 to 0 and truncates 2.7 to 2',
    classes: [{ classId: 'barbarian', level: 6 }],
    spentBefore: { 'barbarian.rage': 3 },
    steps: [
      { do: { op: 'setRemaining', id: 'barbarian.rage', remaining: 99 }, expect: { remaining: { 'barbarian.rage': 4 }, spent: { 'barbarian.rage': 0 } } },
      { do: { op: 'setRemaining', id: 'barbarian.rage', remaining: -4 }, expect: { remaining: { 'barbarian.rage': 0 }, spent: { 'barbarian.rage': 4 } } },
      { do: { op: 'setRemaining', id: 'barbarian.rage', remaining: 2.7 }, expect: { remaining: { 'barbarian.rage': 2 }, spent: { 'barbarian.rage': 2 } } },
    ],
  },
  {
    // Rages: Barbarian 6 = 4, 5 = 3, 2 = 2 (L2454-2459). De-leveling clamps spent to the new max; a later level-up
    // raises max and so remaining while spent is unchanged (a bigger table value is simply more uses).
    name: 'max drops after de-leveling then level-up: remaining never negative',
    classes: [{ classId: 'barbarian', level: 6 }],
    spentBefore: { 'barbarian.rage': 3 },
    steps: [
      { do: { op: 'setClassLevel', classId: 'barbarian', level: 5 }, expect: { max: { 'barbarian.rage': 3 }, spent: { 'barbarian.rage': 3 }, remaining: { 'barbarian.rage': 0 } } },
      { do: { op: 'setClassLevel', classId: 'barbarian', level: 2 }, expect: { max: { 'barbarian.rage': 2 }, spent: { 'barbarian.rage': 2 }, remaining: { 'barbarian.rage': 0 } } },
      { do: { op: 'setClassLevel', classId: 'barbarian', level: 6 }, expect: { max: { 'barbarian.rage': 4 }, spent: { 'barbarian.rage': 2 }, remaining: { 'barbarian.rage': 2 } } },
    ],
  },
  {
    name: 'stale id (feature gone) is ignored at read, kept in storage and returns with the class',
    classes: [{ classId: 'fighter', level: 1 }],
    spentBefore: { 'wizard.arcane-recovery': 1 },
    steps: [
      { do: { op: 'spend', id: 'wizard.arcane-recovery' }, expect: { sameObject: true, spent: { 'wizard.arcane-recovery': 1 } } },
    ],
  },
];

/** Stale-id case that needs a class re-pick: the stored value for a gone feature comes back with the class. */
export const STALE_ID_RESTORE_CASE = {
  name: 'stale wizard.arcane-recovery spent 1 shows again after adding Wizard 1',
  baseClasses: [{ classId: 'fighter', level: 1 }] as GoldenClassEntry[],
  resourcesSpent: { 'wizard.arcane-recovery': 1 } as Record<string, number>,
  withWizard: [{ classId: 'fighter', level: 1 }, { classId: 'wizard', level: 1 }] as GoldenClassEntry[],
  expectHiddenWithoutWizard: 'wizard.arcane-recovery',
  expectedWithWizard: { max: 1, spent: 1, remaining: 0 },
};

// ─── sanitizeResourcesSpent (plan.md section 2): object only, keys 1..80 chars, values integers 0..9999,
//     at most 200 entries, zero entries dropped, undefined when empty.

export interface GoldenSanitizeCase {
  name: string;
  /** Parsed value passed to the sanitizer. Use `inputJson` when the case needs JSON.parse semantics. */
  input?: unknown;
  inputJson?: string;
  /** Expected result; `undefined` = the sanitizer returns undefined. */
  expected: Record<string, number> | undefined;
}

export const SANITIZE_MAX_ENTRIES = 200;
export const SANITIZE_MAX_KEY_LENGTH = 80;
export const SANITIZE_MAX_VALUE = 9999;

export const SANITIZE_CASES: GoldenSanitizeCase[] = [
  { name: 'valid pair is kept', input: { 'barbarian.rage': 2 }, expected: { 'barbarian.rage': 2 } },
  { name: 'null', input: null, expected: undefined },
  { name: 'string', input: 'barbarian.rage', expected: undefined },
  { name: 'number', input: 5, expected: undefined },
  { name: 'array', input: [1, 2], expected: undefined },
  { name: 'empty object', input: {}, expected: undefined },
  { name: 'zero entries dropped (and result undefined when only zeros)', input: { 'barbarian.rage': 0 }, expected: undefined },
  { name: 'zero dropped, valid kept', input: { 'barbarian.rage': 0, 'fighter.second-wind': 1 }, expected: { 'fighter.second-wind': 1 } },
  { name: 'negative value dropped', input: { a: -1, b: 2 }, expected: { b: 2 } },
  { name: 'fractional value dropped', input: { a: 1.5, b: 2 }, expected: { b: 2 } },
  { name: 'NaN value dropped', input: { a: Number.NaN, b: 2 }, expected: { b: 2 } },
  { name: 'Infinity value dropped', input: { a: Number.POSITIVE_INFINITY, b: 2 }, expected: { b: 2 } },
  { name: 'string value dropped', input: { a: '3', b: 2 }, expected: { b: 2 } },
  { name: 'boolean / null / object values dropped', input: { a: true, b: null, c: {}, d: [1], e: 2 }, expected: { e: 2 } },
  { name: '9999 kept', input: { a: 9999 }, expected: { a: 9999 } },
  { name: '10000 dropped', input: { a: 10000, b: 1 }, expected: { b: 1 } },
  { name: 'empty key dropped', input: { '': 3, b: 1 }, expected: { b: 1 } },
  { name: '80-char key kept', input: { ['k'.repeat(80)]: 1 }, expected: { ['k'.repeat(80)]: 1 } },
  { name: '81-char key dropped', input: { ['k'.repeat(81)]: 1, b: 1 }, expected: { b: 1 } },
  // Prototype-pollution guard: a JSON `__proto__` key must never become a stored key or touch Object.prototype.
  { name: '__proto__ key (JSON.parse own property) is not stored', inputJson: '{"__proto__": 3, "barbarian.rage": 1}', expected: { 'barbarian.rage': 1 } },
];

/** More than SANITIZE_MAX_ENTRIES valid entries: the result has exactly SANITIZE_MAX_ENTRIES entries (the first 200 in key order). */
export const SANITIZE_OVERSIZE_COUNT = 201;

// ═════════════════════════════ CARDINALITY ══════════════════════════════════

/**
 * Tracker ids ADDED at each class level (cumulative set at level L = union of every key <= L), no subclass chosen.
 * Authored per class from the PHB class chapters, separately from TRACKER_ROWS.fromLevel.
 */
export const CLASS_IDS_ADDED_AT: Record<string, Record<number, string[]>> = {
  barbarian: { 1: ['barbarian.rage'], 15: ['barbarian.persistent-rage'] },
  bard: { 1: ['bard.bardic-inspiration'] },
  cleric: { 2: ['cleric.channel-divinity'], 10: ['cleric.divine-intervention'] },
  druid: { 2: ['druid.wild-shape'], 5: ['druid.wild-resurgence'], 20: ['druid.nature-magician'] },
  fighter: { 1: ['fighter.second-wind'], 2: ['fighter.action-surge'], 9: ['fighter.indomitable'] },
  monk: { 2: ['monk.focus-points', 'monk.uncanny-metabolism'] },
  paladin: { 1: ['paladin.lay-on-hands'], 2: ['paladin.divine-smite-free'], 3: ['paladin.channel-divinity'], 5: ['paladin.faithful-steed'] },
  ranger: { 1: ['ranger.favored-enemy'], 10: ['ranger.tireless'], 14: ['ranger.natures-veil'] },
  rogue: { 20: ['rogue.stroke-of-luck'] },
  sorcerer: { 1: ['sorcerer.innate-sorcery'], 2: ['sorcerer.sorcery-points'], 5: ['sorcerer.sorcerous-restoration'] },
  warlock: { 2: ['warlock.magical-cunning'], 9: ['warlock.contact-patron'] },
  wizard: { 1: ['wizard.arcane-recovery'], 20: ['wizard.signature-spells#0', 'wizard.signature-spells#1'] },
};

/** Literal tracker count per class at level 20 (no subclass), independent of CLASS_IDS_ADDED_AT. */
export const CLASS_COUNT_AT_20: Record<string, number> = {
  barbarian: 2,
  bard: 1,
  cleric: 2,
  druid: 3,
  fighter: 3,
  monk: 2,
  paladin: 4,
  ranger: 3,
  rogue: 1,
  sorcerer: 3,
  warlock: 2,
  wizard: 3,
};

export interface GoldenSubclassCardinality {
  classId: string;
  subclassId: string;
  /** ADDITIONAL tracker ids (over the class set) by class level once the subclass is chosen. */
  addedAt: Record<number, string[]>;
  /** Literal count of additional ids at level 20. */
  countAt20: number;
}

/** All 48 PHB subclasses. */
export const SUBCLASS_CARDINALITY: GoldenSubclassCardinality[] = [
  { classId: 'barbarian', subclassId: 'berserker', addedAt: { 14: ['barbarian.intimidating-presence'] }, countAt20: 1 },
  { classId: 'barbarian', subclassId: 'wildHeart', addedAt: {}, countAt20: 0 },
  { classId: 'barbarian', subclassId: 'worldTree', addedAt: {}, countAt20: 0 },
  { classId: 'barbarian', subclassId: 'zealot', addedAt: { 3: ['barbarian.warrior-of-the-gods'], 10: ['barbarian.zealous-presence'], 14: ['barbarian.rage-of-the-gods'] }, countAt20: 3 },
  { classId: 'bard', subclassId: 'dance', addedAt: {}, countAt20: 0 },
  { classId: 'bard', subclassId: 'glamour', addedAt: { 3: ['bard.beguiling-magic'], 6: ['bard.mantle-of-majesty'], 14: ['bard.unbreakable-majesty'] }, countAt20: 3 },
  { classId: 'bard', subclassId: 'lore', addedAt: {}, countAt20: 0 },
  { classId: 'bard', subclassId: 'valor', addedAt: {}, countAt20: 0 },
  { classId: 'cleric', subclassId: 'life', addedAt: {}, countAt20: 0 },
  { classId: 'cleric', subclassId: 'light', addedAt: { 3: ['cleric.warding-flare'], 17: ['cleric.corona-of-light'] }, countAt20: 2 },
  { classId: 'cleric', subclassId: 'trickery', addedAt: {}, countAt20: 0 },
  { classId: 'cleric', subclassId: 'war', addedAt: { 3: ['cleric.war-priest'] }, countAt20: 1 },
  { classId: 'druid', subclassId: 'land', addedAt: { 6: ['druid.natural-recovery'] }, countAt20: 1 },
  { classId: 'druid', subclassId: 'moon', addedAt: { 10: ['druid.moonlight-step'] }, countAt20: 1 },
  { classId: 'druid', subclassId: 'sea', addedAt: {}, countAt20: 0 },
  { classId: 'druid', subclassId: 'stars', addedAt: { 3: ['druid.star-map'], 6: ['druid.cosmic-omen'] }, countAt20: 2 },
  { classId: 'fighter', subclassId: 'battleMaster', addedAt: { 3: ['fighter.superiority-dice'], 7: ['fighter.know-your-enemy'] }, countAt20: 2 },
  { classId: 'fighter', subclassId: 'champion', addedAt: {}, countAt20: 0 },
  { classId: 'fighter', subclassId: 'eldritchKnight', addedAt: {}, countAt20: 0 },
  {
    classId: 'fighter',
    subclassId: 'psiWarrior',
    addedAt: { 3: ['fighter.psionic-energy-dice'], 7: ['fighter.psi-powered-leap'], 15: ['fighter.bulwark-of-force'], 18: ['fighter.telekinetic-master'] },
    countAt20: 4,
  },
  { classId: 'monk', subclassId: 'mercy', addedAt: { 11: ['monk.flurry-of-healing-and-harm'], 17: ['monk.hand-of-ultimate-mercy'] }, countAt20: 2 },
  { classId: 'monk', subclassId: 'shadow', addedAt: {}, countAt20: 0 },
  { classId: 'monk', subclassId: 'elements', addedAt: {}, countAt20: 0 },
  { classId: 'monk', subclassId: 'openHand', addedAt: { 6: ['monk.wholeness-of-body'] }, countAt20: 1 },
  { classId: 'paladin', subclassId: 'devotion', addedAt: { 20: ['paladin.holy-nimbus'] }, countAt20: 1 },
  { classId: 'paladin', subclassId: 'glory', addedAt: { 15: ['paladin.glorious-defense'], 20: ['paladin.living-legend'] }, countAt20: 2 },
  { classId: 'paladin', subclassId: 'ancients', addedAt: { 15: ['paladin.undying-sentinel'], 20: ['paladin.elder-champion'] }, countAt20: 2 },
  { classId: 'paladin', subclassId: 'vengeance', addedAt: { 20: ['paladin.avenging-angel'] }, countAt20: 1 },
  { classId: 'ranger', subclassId: 'beastMaster', addedAt: {}, countAt20: 0 },
  { classId: 'ranger', subclassId: 'feyWanderer', addedAt: { 11: ['ranger.fey-reinforcements'], 15: ['ranger.misty-wanderer'] }, countAt20: 2 },
  { classId: 'ranger', subclassId: 'gloomStalker', addedAt: { 3: ['ranger.dread-ambusher'] }, countAt20: 1 },
  { classId: 'ranger', subclassId: 'hunter', addedAt: {}, countAt20: 0 },
  { classId: 'rogue', subclassId: 'arcaneTrickster', addedAt: { 17: ['rogue.spell-thief'] }, countAt20: 1 },
  { classId: 'rogue', subclassId: 'assassin', addedAt: {}, countAt20: 0 },
  { classId: 'rogue', subclassId: 'soulknife', addedAt: { 3: ['rogue.psionic-energy-dice'], 13: ['rogue.psychic-veil'], 17: ['rogue.rend-mind'] }, countAt20: 3 },
  { classId: 'rogue', subclassId: 'thief', addedAt: {}, countAt20: 0 },
  { classId: 'sorcerer', subclassId: 'aberrant', addedAt: { 18: ['sorcerer.warping-implosion'] }, countAt20: 1 },
  { classId: 'sorcerer', subclassId: 'clockwork', addedAt: { 3: ['sorcerer.restore-balance'], 14: ['sorcerer.trance-of-order'], 18: ['sorcerer.clockwork-cavalcade'] }, countAt20: 3 },
  { classId: 'sorcerer', subclassId: 'draconic', addedAt: { 14: ['sorcerer.dragon-wings'], 18: ['sorcerer.dragon-companion'] }, countAt20: 2 },
  { classId: 'sorcerer', subclassId: 'wildMagic', addedAt: { 3: ['sorcerer.tides-of-chaos'], 18: ['sorcerer.tamed-surge'] }, countAt20: 2 },
  { classId: 'warlock', subclassId: 'archfey', addedAt: { 3: ['warlock.steps-of-the-fey'], 10: ['warlock.beguiling-defenses'] }, countAt20: 2 },
  { classId: 'warlock', subclassId: 'celestial', addedAt: { 3: ['warlock.healing-light'], 14: ['warlock.searing-vengeance'] }, countAt20: 2 },
  { classId: 'warlock', subclassId: 'fiend', addedAt: { 6: ['warlock.dark-ones-own-luck'], 14: ['warlock.hurl-through-hell'] }, countAt20: 2 },
  { classId: 'warlock', subclassId: 'greatOldOne', addedAt: { 6: ['warlock.clairvoyant-combatant'] }, countAt20: 1 },
  { classId: 'wizard', subclassId: 'abjurer', addedAt: { 3: ['wizard.arcane-ward'] }, countAt20: 1 },
  { classId: 'wizard', subclassId: 'diviner', addedAt: { 3: ['wizard.portent'], 10: ['wizard.third-eye'] }, countAt20: 2 },
  { classId: 'wizard', subclassId: 'evoker', addedAt: {}, countAt20: 0 },
  {
    classId: 'wizard',
    subclassId: 'illusionist',
    addedAt: { 6: ['wizard.phantasmal-creatures#0', 'wizard.phantasmal-creatures#1'], 10: ['wizard.illusory-self'] },
    countAt20: 3,
  },
];

/** Exact tracker ids per feat id (a feat adds nothing else). A repeated occurrence adds `@<n>` (n >= 1) to the feat part. */
export const FEAT_TRACKER_IDS: Record<string, string[]> = {
  lucky: ['feat:lucky.luck-points'],
  'magic-initiate-cleric': ['feat:magic-initiate-cleric.free-cast'],
  'magic-initiate-druid': ['feat:magic-initiate-druid.free-cast'],
  'magic-initiate-wizard': ['feat:magic-initiate-wizard.free-cast'],
  'fey-touched': ['feat:fey-touched.free-cast#0', 'feat:fey-touched.free-cast#1'],
  'shadow-touched': ['feat:shadow-touched.free-cast#0', 'feat:shadow-touched.free-cast#1'],
  telepathic: ['feat:telepathic.detect-thoughts'],
  'ritual-caster': ['feat:ritual-caster.quick-ritual'],
  'mage-slayer': ['feat:mage-slayer.guarded-mind'],
  'boon-of-fate': ['feat:boon-of-fate.improve-fate'],
  'boon-of-recovery': ['feat:boon-of-recovery.last-stand', 'feat:boon-of-recovery.recover-vitality'],
};

/** Exact tracker ids per chosen invocation id. */
export const INVOCATION_TRACKER_IDS: Record<string, string[]> = {
  'gift-of-the-depths': ['warlock.invocation-gift-of-the-depths'],
  'gift-of-the-protectors': ['warlock.invocation-gift-of-the-protectors'],
};

/** Literal totals (independent of the lists): 29 class ids (28 pools, Signature Spells has 2 variants), 57 subclass ids, 14 feat ids (Fey-Touched and Shadow-Touched have 2 variants each), 2 invocation ids. */
export const TOTALS = { classIds: 29, subclassIds: 57, featIds: 14, invocationIds: 2 } as const;

/** Features that merge into ONE tracker (pool merge) and must appear exactly once. */
export const POOL_MERGE_CASES: ReadonlyArray<{ id: string; classId: string; subclassId?: string; level: number; features: string[] }> = [
  { id: 'bard.bardic-inspiration', classId: 'bard', level: 5, features: ['Bardic Inspiration', 'Font of Inspiration'] },
  { id: 'cleric.warding-flare', classId: 'cleric', subclassId: 'light', level: 6, features: ['Warding Flare', 'Improved Warding Flare'] },
  { id: 'fighter.indomitable', classId: 'fighter', level: 17, features: ['Indomitable'] },
  { id: 'wizard.portent', classId: 'wizard', subclassId: 'diviner', level: 14, features: ['Portent', 'Greater Portent'] },
];

/**
 * Features that SPEND a use of another pool (`{ spends }`): they must never create a tracker of their own.
 * Pool = the parent pool id of the SAME class. PHB lines are of the feature heading.
 */
export const SPENDS_CASES: ReadonlyArray<{ classId: string; subclassId: string; feature: string; spends: string; phbLine: number }> = [
  { classId: 'bard', subclassId: 'dance', feature: 'Inspiring Movement', spends: 'bard.bardic-inspiration', phbLine: 2999 },
  { classId: 'bard', subclassId: 'dance', feature: 'Tandem Footwork', spends: 'bard.bardic-inspiration', phbLine: 3005 },
  { classId: 'bard', subclassId: 'glamour', feature: 'Mantle of Inspiration', spends: 'bard.bardic-inspiration', phbLine: 3029 },
  { classId: 'bard', subclassId: 'lore', feature: 'Cutting Words', spends: 'bard.bardic-inspiration', phbLine: 3061 },
  { classId: 'bard', subclassId: 'lore', feature: 'Peerless Skill', spends: 'bard.bardic-inspiration', phbLine: 3071 },
  { classId: 'cleric', subclassId: 'life', feature: 'Preserve Life', spends: 'cleric.channel-divinity', phbLine: 3432 },
  { classId: 'cleric', subclassId: 'light', feature: 'Radiance of the Dawn', spends: 'cleric.channel-divinity', phbLine: 3467 },
  { classId: 'cleric', subclassId: 'trickery', feature: 'Invoke Duplicity', spends: 'cleric.channel-divinity', phbLine: 3499 },
  { classId: 'cleric', subclassId: 'war', feature: 'Guided Strike', spends: 'cleric.channel-divinity', phbLine: 3540 },
  { classId: 'cleric', subclassId: 'war', feature: "War God's Blessing", spends: 'cleric.channel-divinity', phbLine: 3561 },
  { classId: 'paladin', subclassId: 'devotion', feature: 'Sacred Weapon', spends: 'paladin.channel-divinity', phbLine: 5123 },
  { classId: 'paladin', subclassId: 'glory', feature: 'Inspiring Smite', spends: 'paladin.channel-divinity', phbLine: 5165 },
  { classId: 'paladin', subclassId: 'glory', feature: 'Peerless Athlete', spends: 'paladin.channel-divinity', phbLine: 5183 },
  { classId: 'paladin', subclassId: 'ancients', feature: "Nature's Wrath", spends: 'paladin.channel-divinity', phbLine: 5221 },
  { classId: 'paladin', subclassId: 'vengeance', feature: 'Vow of Enmity', spends: 'paladin.channel-divinity', phbLine: 5287 },
  { classId: 'druid', subclassId: 'land', feature: "Land's Aid", spends: 'druid.wild-shape', phbLine: 3896 },
  { classId: 'druid', subclassId: 'land', feature: "Nature's Sanctuary", spends: 'druid.wild-shape', phbLine: 3923 },
  { classId: 'druid', subclassId: 'sea', feature: 'Wrath of the Sea', spends: 'druid.wild-shape', phbLine: 3999 },
  { classId: 'druid', subclassId: 'stars', feature: 'Starry Form', spends: 'druid.wild-shape', phbLine: 4050 },
];

// ═════════════════════════════ EXCLUSIONS ═══════════════════════════════════

export interface GoldenExclusion {
  /** Feature (or feat) name; `owner` names the class/subclass/feat. */
  feature: string;
  owner: string;
  phbLines: number[];
  reason: string;
}

/**
 * Limited-use-looking features that are deliberately NOT trackers. The oracle's "no uses mentioned in a feature
 * text without a tracker" scan skips exactly these (so a NEW limited-use feature cannot slip in unnoticed).
 * FLAG 16 (plan.md): confirm with the user whether any consumable / per-trigger feat should be included.
 */
export const EXCLUSIONS: GoldenExclusion[] = [
  // Class level
  { feature: 'Pact Magic', owner: 'warlock', phbLines: [6821, 6854], reason: 'Pact Magic slots are tracked by spellcasting.pactSlotsExpended on the Spells page (one-editor rule).' },
  { feature: 'Mystic Arcanum', owner: 'warlock', phbLines: [6886, 6892], reason: 'Already tracked by spellcasting.mysticArcanaExpended on the Spells page (one-editor rule).' },
  { feature: 'Relentless Rage', owner: 'barbarian', phbLines: [2517, 2519], reason: 'A rising DC counter that resets on a rest, not a count of uses.' },
  { feature: 'Perfect Focus', owner: 'monk', phbLines: [4655], reason: 'Restores the Focus Points pool on Initiative; no count of its own (manual regain covers it).' },
  { feature: 'Superior Inspiration', owner: 'bard', phbLines: [2832, 2834], reason: 'Restores Bardic Inspiration on Initiative; no count of its own.' },
  { feature: 'Evergreen Wild Shape', owner: 'druid', phbLines: [3753], reason: 'Restores a Wild Shape use on Initiative; no count of its own.' },
  { feature: 'Greater Divine Intervention', owner: 'cleric', phbLines: [3284], reason: 'A "2d4 Long Rests" lockout is a countdown, not a use count.' },
  // Subclass
  { feature: 'Travel Along the Tree', owner: 'barbarian/worldTree', phbLines: [2635, 2637], reason: 'Once per Rage: a per-activation limit, like per-turn.' },
  { feature: 'Fanatical Focus', owner: 'barbarian/zealot', phbLines: [2655, 2657], reason: 'Once per active Rage: a per-activation limit.' },
  { feature: 'Blessing of the Trickster', owner: 'cleric/trickery', phbLines: [3495], reason: 'Lasts until the next Long Rest or until used again: a duration, not a count of uses.' },
  { feature: 'Overchannel', owner: 'wizard/evoker', phbLines: [7748], reason: 'No defined number of uses in the PHB text.' },
  { feature: 'Mercy / Shadow / Elements features that spend Focus Points', owner: 'monk subclasses', phbLines: [4681, 4685, 4717, 4727], reason: 'They spend the Monk Focus Points pool, not a pool of their own.' },
  { feature: 'Psionic Energy Die spenders (Protective Field, Psionic Strike, Psychic Whispers ...)', owner: 'fighter/psiWarrior, rogue/soulknife', phbLines: [4420, 6110], reason: 'They spend the existing Psionic Energy Dice pool.' },
  { feature: 'Psionic Sorcery, Bend Luck, Bastion of Law', owner: 'sorcerer subclasses', phbLines: [6561, 6626, 6711], reason: 'They spend Sorcery Points.' },
  // Feats
  { feature: 'Peerless Aim', owner: 'feat:boon-of-combat-prowess', phbLines: [9138], reason: 'Per-turn / per-trigger limit.' },
  { feature: 'Boon of Fortitude', owner: 'feat:boon-of-fortitude', phbLines: [9178], reason: 'No use count.' },
  { feature: 'Savage Attacker', owner: 'feat:savage-attacker', phbLines: [8530], reason: 'Once per turn.' },
  { feature: 'Piercer', owner: 'feat:piercer', phbLines: [8848], reason: 'Once per turn.' },
  { feature: 'Slasher', owner: 'feat:slasher', phbLines: [8984], reason: 'Once per turn.' },
  { feature: 'Crusher', owner: 'feat:crusher', phbLines: [8640], reason: 'Once per turn.' },
  { feature: 'Bolstering Treats', owner: 'feat:chef', phbLines: [8616], reason: 'Consumable crafted items, not a rest-recharged use.' },
  { feature: 'Brew Poison', owner: 'feat:poisoner', phbLines: [8860], reason: 'Consumable crafted items, not a rest-recharged use.' },
  { feature: 'Inspiring Leader', owner: 'feat:inspiring-leader', phbLines: [8756], reason: 'One grant per rest, no count.' },
  { feature: 'Musician', owner: 'feat:musician', phbLines: [8526], reason: 'One grant per rest, no count.' },
  { feature: 'Healer / Durable', owner: 'feats', phbLines: [8494], reason: 'They spend or reroll Hit Dice, which are tracked by hitDiceSpent.' },
];
