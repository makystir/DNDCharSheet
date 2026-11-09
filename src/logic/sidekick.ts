/**
 * Sidekick rules (pure). Data lives in src/data/sidekicks.ts.
 *
 * Tasha's 2020 (5e, 2014 rules): Docs/TashasCauldronOfEverything.md, "Sidekicks"
 * (L6917-7275). Sidekicks are an OPTIONAL DM rule; callers must gate them behind
 * the opt-in house-rule toggle (Stage 2). Open 2014-vs-2024 interpretations are
 * listed in .agents/tasks/sidekicks-stage1b/findings.md.
 *
 * Creature data is never duplicated: functions take a creature stat block
 * (src/data/creatures.ts) as input.
 */
import {
  SIDEKICK_CLASSES,
  SIDEKICK_MAX_CHALLENGE_RATING,
  SIDEKICK_MAX_LEVEL,
  SIDEKICK_MIN_LEVEL,
  SIDEKICK_SPELLCASTING_ROLES,
  type SidekickClassId,
  type SidekickFeature,
  type SidekickLevelRow,
  type SidekickSpellcasterRow,
  type SidekickSpellcastingRole,
} from '../data/sidekicks';
import type { CreatureStatBlock } from '../data/creatures';

/** The parts of a creature stat block the sidekick rules read. */
export type SidekickCreatureInput = Pick<CreatureStatBlock, 'challenge' | 'languages'> &
  Partial<Pick<CreatureStatBlock, 'hp' | 'traits' | 'actions' | 'bonusActions' | 'reactions'>>;

// --- Validation -------------------------------------------------------------

function assertLevel(level: number): void {
  if (!Number.isInteger(level) || level < SIDEKICK_MIN_LEVEL || level > SIDEKICK_MAX_LEVEL) {
    throw new RangeError(`Sidekick level must be an integer from ${SIDEKICK_MIN_LEVEL} to ${SIDEKICK_MAX_LEVEL}, got ${level}`);
  }
}

// --- Eligibility --------------------------------------------------------------

/**
 * Parses a printed challenge rating ("0", "1/8", "1/4", "1/2", "1", "4"). Returns
 * null for "None", null or anything unreadable (a null CR is never eligible).
 */
export function parseChallengeRating(cr: string | null | undefined): number | null {
  if (cr === null || cr === undefined) return null;
  const t = cr.trim();
  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? null : Number(frac[1]) / d;
  }
  return /^\d+$/.test(t) ? Number(t) : null;
}

/**
 * Whether the stat block lists a language the creature can speak (required for the
 * Expert and Spellcaster classes, L6976 / L7077). The catalog's `languages` field
 * is prose: "None" and "Understands X but can't speak" are not speakable; Telepathy
 * alone is treated as not a spoken language (an interpretation, see findings.md).
 */
export function hasSpokenLanguage(languages: string | null | undefined): boolean {
  if (!languages) return false;
  const t = languages.trim();
  if (t === '' || /^none\b/i.test(t)) return false;
  if (/^understands\b/i.test(t) && /can'?t speak/i.test(t)) return false;
  if (/^telepathy\b/i.test(t)) return false;
  return true;
}

export interface SidekickEligibility {
  eligible: boolean;
  /** Human-readable reasons the creature is not eligible (empty when eligible). */
  reasons: string[];
}

/**
 * Tasha's 2020 (5e, 2014 rules), L6929: the stat block's challenge rating must be 1/2
 * or lower. With `classId`, also checks the spoken-language requirement of the
 * Expert (L6976) and Spellcaster (L7077); the Warrior has none (L7174-7178).
 * "Friend of at least one character" (L6931) is a DM judgement, not checked here.
 */
export function sidekickEligibility(creature: SidekickCreatureInput, classId?: SidekickClassId): SidekickEligibility {
  const reasons: string[] = [];
  const cr = parseChallengeRating(creature.challenge.cr);
  if (cr === null) reasons.push(`Challenge rating "${creature.challenge.cr ?? 'unreadable'}" is not a number`);
  else if (cr > SIDEKICK_MAX_CHALLENGE_RATING) reasons.push(`Challenge rating ${creature.challenge.cr} is above 1/2`);
  if (classId && SIDEKICK_CLASSES[classId].requiresSpokenLanguage && !hasSpokenLanguage(creature.languages)) {
    reasons.push(`${SIDEKICK_CLASSES[classId].name} needs a language in the stat block that the creature can speak`);
  }
  return { eligible: reasons.length === 0, reasons };
}

// --- Levels -------------------------------------------------------------------

/** Exact average of the party's character levels. */
export function partyAverageLevel(partyLevels: readonly number[]): number {
  if (partyLevels.length === 0) throw new RangeError('A party needs at least one character level');
  return partyLevels.reduce((a, b) => a + b, 0) / partyLevels.length;
}

/**
 * Sidekick level for a party: "the same as the average level of the group"
 * (L6948); the sidekick gains a level whenever that average goes up (L6952). The
 * text does NOT say how to round a fractional average. This uses the book's own
 * general "Round Down" rule (Tasha's L255-257; PHB 2024 L255-257), so the sidekick
 * level is floor(average), clamped to 1-20. FLAGGED in findings.md.
 */
export function sidekickLevelForParty(partyLevels: readonly number[]): number {
  const avg = partyAverageLevel(partyLevels);
  return Math.min(SIDEKICK_MAX_LEVEL, Math.max(SIDEKICK_MIN_LEVEL, Math.floor(avg)));
}

/** The class table row for a level (1-20). */
export function sidekickRow(classId: 'spellcaster', level: number): SidekickSpellcasterRow;
export function sidekickRow(classId: SidekickClassId, level: number): SidekickLevelRow;
export function sidekickRow(classId: SidekickClassId, level: number): SidekickLevelRow {
  assertLevel(level);
  return SIDEKICK_CLASSES[classId].rows[level - 1];
}

/** Proficiency bonus by sidekick level (class table, L6962). */
export function sidekickProficiencyBonus(classId: SidekickClassId, level: number): number {
  return sidekickRow(classId, level).proficiencyBonus;
}

// --- Hit points ----------------------------------------------------------------

/**
 * Die size of the creature's Hit Dice, read from the stat block's printed dice
 * ("1d8+1" -> 8). The class does not fix a die: "the type of die appears in the
 * sidekick's stat block" (L6956). Null for formula-scaled creatures.
 */
export function creatureHitDie(creature: Pick<CreatureStatBlock, 'hp'>): number | null {
  const hp = creature.hp;
  if (!hp || !('dice' in hp) || !hp.dice) return null;
  const m = /d(\d+)/.exec(hp.dice);
  return m ? Number(m[1]) : null;
}

/**
 * Hit points gained when the sidekick gains a level (L6956): the rolled Hit Die plus
 * the Constitution modifier, minimum 1. `roll` is the die result (1..hitDie).
 */
export function sidekickHitPointsGained(roll: number, conMod: number, hitDie?: number): number {
  if (!Number.isInteger(roll) || roll < 1 || (hitDie !== undefined && roll > hitDie)) {
    throw new RangeError(`Hit Die roll ${roll} is out of range${hitDie ? ` for a d${hitDie}` : ''}`);
  }
  return Math.max(1, roll + conMod);
}

// --- Proficiency bonus rise: stat block adjustment ----------------------------

export interface SidekickStatAdjustment {
  /** The PB printed on the base stat block (+2 for CR 0 to 1/2 in the 2024 Monster Manual). */
  basePb: number;
  sidekickPb: number;
  /**
   * Total to add to the to-hit modifier of every attack AND to every DC in the stat
   * block relative to the printed values: +1 per step the bonus has risen (L6964).
   */
  delta: number;
}

/**
 * Tasha's 2020 (5e, 2014 rules), L6964: each time the sidekick's proficiency bonus
 * rises by 1, add 1 to the to-hit of all attacks and 1 to all DCs. Computed as the
 * total relative to the stat block's printed PB. OPEN INTERPRETATION (findings.md):
 * the 2024 stat block's saves and skills are PB-based and the rule does not mention
 * them; they are NOT adjusted here. Returns null when the stat block's PB is not
 * printed (Primal Companion / Otherworldly Steed).
 */
export function sidekickStatAdjustment(
  creature: Pick<CreatureStatBlock, 'challenge'>,
  classId: SidekickClassId,
  level: number,
): SidekickStatAdjustment | null {
  const basePb = creature.challenge.proficiencyBonus;
  if (basePb === null) return null;
  const sidekickPb = sidekickProficiencyBonus(classId, level);
  return { basePb, sidekickPb, delta: sidekickPb - basePb };
}

export interface AdjustedStatBlockEntry {
  name: string;
  kind: 'attack' | 'save';
  printed: number;
  adjusted: number;
}

/** Lists every attack bonus and printed save DC of the stat block with the adjustment applied. */
export function adjustStatBlockNumbers(creature: SidekickCreatureInput, delta: number): AdjustedStatBlockEntry[] {
  const out: AdjustedStatBlockEntry[] = [];
  for (const f of [
    ...(creature.traits ?? []),
    ...(creature.actions ?? []),
    ...(creature.bonusActions ?? []),
    ...(creature.reactions ?? []),
  ]) {
    if (f.attack && f.attack.bonus !== null) {
      out.push({ name: f.name, kind: 'attack', printed: f.attack.bonus, adjusted: f.attack.bonus + delta });
    }
    if (f.save && f.save.dc !== null) {
      out.push({ name: f.name, kind: 'save', printed: f.save.dc, adjusted: f.save.dc + delta });
    }
  }
  return out;
}

// --- Features -------------------------------------------------------------------

/** Features gained exactly at `level` (the table row's Features cell). */
export function sidekickFeaturesGainedAt(classId: SidekickClassId, level: number): SidekickFeature[] {
  const row = sidekickRow(classId, level);
  return row.featureIds.map((id) => {
    const f = SIDEKICK_CLASSES[classId].features.find((x) => x.id === id);
    if (!f) throw new Error(`Sidekick ${classId} level ${level}: feature "${id}" is missing from the catalog`);
    return f;
  });
}

/** Every distinct feature the sidekick has at `level` (gained at that level or earlier). */
export function sidekickFeaturesAtLevel(classId: SidekickClassId, level: number): SidekickFeature[] {
  assertLevel(level);
  return SIDEKICK_CLASSES[classId].features.filter((f) => f.level <= level);
}

/** Number of Ability Score Improvements the sidekick has received by `level`. */
export function sidekickAbilityScoreImprovements(classId: SidekickClassId, level: number): number {
  assertLevel(level);
  return SIDEKICK_CLASSES[classId].abilityScoreImprovementLevels.filter((l) => l <= level).length;
}

/** Uses between rests of a feature at `level` (Second Wind, Indomitable); null when it has no use count or is not yet gained. */
export function sidekickFeatureUses(feature: SidekickFeature, level: number): number | null {
  assertLevel(level);
  let uses: number | null = null;
  for (const u of feature.usesByLevel ?? []) if (level >= u.level) uses = u.uses;
  return uses;
}

/** Dice of a feature at `level` (Inspiring Help 1d6 / 2d6); null when it has none or is not yet gained. */
export function sidekickFeatureDice(feature: SidekickFeature, level: number): string | null {
  assertLevel(level);
  if (feature.diceByLevel) {
    let dice: string | null = null;
    for (const d of feature.diceByLevel) if (level >= d.level) dice = d.dice;
    return dice;
  }
  return level >= feature.level ? feature.dice ?? null : null;
}

/** Attacks per Attack action for a Warrior of `level` (1 before Extra Attack). */
export function sidekickAttacksPerAttackAction(level: number): number {
  assertLevel(level);
  const f = SIDEKICK_CLASSES.warrior.features.find((x) => x.id === 'warrior.extra-attack');
  let attacks = 1;
  for (const a of f?.attacksPerAttackAction ?? []) if (level >= a.level) attacks = a.attacks;
  return attacks;
}

/** Second Wind healing: 1d10 + the sidekick's level in the class (L7204). */
export function sidekickSecondWindHealing(level: number): { dice: string; flat: number } {
  assertLevel(level);
  return { dice: '1d10', flat: level };
}

/** Martial Role: Attacker adds +2 to all attack rolls (L7196); Defender adds no attack bonus. */
export function martialRoleAttackBonus(role: 'Attacker' | 'Defender' | null | undefined): number {
  return role === 'Attacker' ? 2 : 0;
}

// --- Spellcaster ----------------------------------------------------------------

export interface SidekickSpellcastingAtLevel {
  cantripsKnown: number;
  spellsKnown: number;
  /** True at level 1 where the printed cell is blank (see data file). */
  spellsKnownInferred: boolean;
  /** Slots for spell levels 1..5. */
  slots: readonly [number, number, number, number, number];
  /** Highest spell level with at least one slot. */
  highestSpellLevel: number;
}

/** Spellcaster table values at `level` (cantrips, spells known, slots). */
export function sidekickSpellcastingAtLevel(level: number): SidekickSpellcastingAtLevel {
  const row = sidekickRow('spellcaster', level);
  const highest = row.slots.reduce((h, n, i) => (n > 0 ? i + 1 : h), 0);
  return {
    cantripsKnown: row.cantripsKnown,
    spellsKnown: row.spellsKnown,
    spellsKnownInferred: row.spellsKnownInferred,
    slots: row.slots,
    highestSpellLevel: highest,
  };
}

export function sidekickSpellcastingRole(role: SidekickSpellcastingRole['role']): SidekickSpellcastingRole {
  const r = SIDEKICK_SPELLCASTING_ROLES.find((x) => x.role === role);
  if (!r) throw new Error(`Unknown sidekick spellcasting role "${role}"`);
  return r;
}

/** Spell save DC = 8 + sidekick's proficiency bonus + spellcasting ability modifier (L7146). */
export function sidekickSpellSaveDc(level: number, spellcastingMod: number): number {
  return 8 + sidekickProficiencyBonus('spellcaster', level) + spellcastingMod;
}

/** Spell attack modifier = sidekick's proficiency bonus + spellcasting ability modifier (L7146). */
export function sidekickSpellAttackModifier(level: number, spellcastingMod: number): number {
  return sidekickProficiencyBonus('spellcaster', level) + spellcastingMod;
}
