/**
 * Feats & Ability Score Improvements — the effective-ability-score layer and
 * feat selection rules (Stage A6b, D&D 5.5e / 2024).
 *
 * In 2024 the Ability Score Improvement IS a feat: at an asi-marker slot level
 * you take the ASI feat or any feat you qualify for (PHB 2024 "Ability Score
 * Improvement" L8558, "Gaining a Level" L2011). Feats that grant an ability
 * increase do so as TRACKED INCREASES recorded on advancement.feats[]; this
 * module sums them over the BASE abilities to produce the EFFECTIVE scores that
 * feed every derived total (modifiers, DCs, AC, HP, spellcasting). The base
 * `Character.abilities` is NEVER mutated — the creation value stays auditable,
 * a feat can be removed cleanly, and the existing no-ASI guard holds.
 *
 * CAPS (PHB 2024): General/ASI feats cannot raise a score above 20 (L8558);
 * Epic Boon feats cap at 30 (L9124+). Caps are applied PER INCREASE, in the
 * order feats were taken, to the running value under THAT increase's cap — so a
 * later epic-boon increase can carry a total above 20 (golden EFFECTIVE_SCORE_CASES).
 *
 * All functions are pure and never mutate their input. Totals shown in the UI
 * return a Breakdown (calculated-totals steering).
 */

import type { Ability, AbilityScores, Character, FeatSelection, SkillId } from '../types/character';
import { ABILITIES, ABILITY_NAMES, SKILLS } from '../types/character';
import { FEAT_CATALOG, allFeats, getFeat, type FeatArmorTraining, type FeatData } from '../data/feats';
import { getClass } from '../data/classes';
import type { Breakdown, BreakdownComponent } from './breakdown';
import { clampLevel } from './abilities';
import { allClasses, classProficiencies, entrySubclass } from './classes';
import { anySpellcaster, spellcastingClasses } from './spellcasting';

// ─── The feat increases recorded on a character ─────────────────────────────

/** The feats/ASIs taken, in the order chosen (absent = none). */
export function characterFeats(character: Character): FeatSelection[] {
  return character.advancement?.feats ?? [];
}

/** A per-increase cap for a feat: 30 for Epic Boon, otherwise 20 (General/ASI). */
function capForFeat(feat: FeatData | undefined): number {
  // PHB 2024: Epic Boon Feats cap at 30 (L9124+); all other increases cap at 20
  // ("Ability Score Improvement" L8558; General feats' "Ability Score Increase").
  return feat?.abilityIncrease?.kind === 'epic-boon' ? 30 : 20;
}

// ─── Effective ability scores (base + recorded increases, capped in order) ───

/**
 * The EFFECTIVE ability scores: the base `abilities` plus the summed
 * advancement.feats[].abilityIncreases, each increase clamped to the running
 * value under its feat's cap (20 General/ASI, 30 Epic Boon), applied in the
 * order the feats were taken. The base scores are never mutated.
 *
 * This is the seam every derived engine reads so feat/Epic-Boon increases
 * propagate to modifiers, saves, skills, AC, HP, Initiative, and spellcasting.
 */
export function effectiveAbilityScores(character: Character): AbilityScores {
  const result: AbilityScores = { ...character.abilities };
  for (const selection of characterFeats(character)) {
    const increases = selection.abilityIncreases;
    if (!increases) continue;
    const cap = capForFeat(getFeat(selection.featId));
    for (const ability of ABILITIES) {
      const amount = increases[ability];
      if (amount === undefined || !Number.isFinite(amount)) continue;
      // Clamp to the running value under THIS increase's cap. A later epic-boon
      // increase (cap 30) can carry the total above 20 even if an earlier
      // general increase was clamped to 20 (golden EFFECTIVE_SCORE_CASES).
      const next = result[ability] + amount;
      result[ability] = next > cap ? Math.max(result[ability], cap) : next;
    }
  }
  return result;
}

/**
 * The breakdown behind one effective ability score: Base + each feat source =
 * total, with the APPLIED increase per source (so components always sum to the
 * total even when a cap clamps), and the clamp noted. Matches the golden
 * ABILITY_BREAKDOWN_CASES and the calculated-totals steering rule.
 */
export function abilityScoreBreakdown(character: Character, ability: Ability): Breakdown {
  const base = character.abilities[ability];
  const components: BreakdownComponent[] = [{ label: 'Base', value: base }];
  const clampNotes: string[] = [];

  let running = base;
  for (const selection of characterFeats(character)) {
    const amount = selection.abilityIncreases?.[ability];
    if (amount === undefined || !Number.isFinite(amount) || amount === 0) continue;
    const feat = getFeat(selection.featId);
    const cap = capForFeat(feat);
    const before = running;
    const raw = running + amount;
    running = raw > cap ? Math.max(running, cap) : raw;
    const applied = running - before; // the amount that actually took effect
    const name = feat?.name ?? selection.featId;
    const clamped = applied < amount;
    components.push({
      label: clamped ? `${name} (capped at ${cap})` : name,
      value: applied,
    });
    if (clamped) {
      clampNotes.push(
        `${name}: +${amount} requested, +${applied} applied (capped at ${cap}).`,
      );
    }
  }

  const breakdown: Breakdown = { total: running, components };
  if (clampNotes.length > 0) breakdown.note = clampNotes.join(' ');
  return breakdown;
}

// ─── Ability Score Improvement allocation validity ──────────────────────────

/** Why an ASI allocation is invalid (the picker surfaces the reason). */
export type AsiInvalidReason = 'incomplete' | 'too-many' | 'over-cap';

export interface AsiAllocationResult {
  valid: boolean;
  reason?: AsiInvalidReason;
}

/**
 * Whether an Ability Score Improvement allocation is legal (PHB 2024 "Ability
 * Score Improvement" L8558): increase ONE ability by 2, OR TWO abilities by 1;
 * no increase may raise a score above 20. `before` is the EFFECTIVE score of
 * each ability prior to this allocation (used for the max-20 cap check).
 *
 * Reasons: 'incomplete' (nothing, or only a single +1 — not a complete choice);
 * 'too-many' (more than the +2 budget, or +1 to three abilities, or a mixed
 * +2/+1); 'over-cap' (an increase would exceed 20).
 */
export function isAsiAllocationValid(
  alloc: Partial<Record<Ability, number>>,
  before: Partial<Record<Ability, number>>,
): AsiAllocationResult {
  // The non-zero entries the player allocated.
  const entries = ABILITIES
    .map((a) => [a, alloc[a] ?? 0] as const)
    .filter(([, v]) => v !== 0);

  const total = entries.reduce((s, [, v]) => s + v, 0);
  const count = entries.length;

  // Any individual amount outside {1,2} is not a legal ASI step.
  if (entries.some(([, v]) => v < 1 || v > 2 || !Number.isInteger(v))) {
    return { valid: false, reason: 'too-many' };
  }

  // Shape: exactly +2 to one ability, OR +1 to each of two abilities.
  const isPlusTwoOne = count === 1 && total === 2;
  const isPlusOneTwo = count === 2 && total === 2 && entries.every(([, v]) => v === 1);

  if (count === 0) return { valid: false, reason: 'incomplete' };
  // A single +1 is an incomplete +1+1 choice (the other +1 is missing).
  if (count === 1 && total === 1) return { valid: false, reason: 'incomplete' };
  if (!isPlusTwoOne && !isPlusOneTwo) return { valid: false, reason: 'too-many' };

  // PHB 2024 L8558: cannot raise a score above 20.
  for (const [ability, amount] of entries) {
    const start = before[ability] ?? 0;
    if (start + amount > 20) return { valid: false, reason: 'over-cap' };
  }

  return { valid: true };
}

// ─── Feat ability-increase validity (allowed abilities and amounts) ──────────

/** Why a feat's recorded ability increase is not legal. */
export type FeatIncreaseInvalidReason =
  | 'unknown-feat'
  | 'no-increase'
  | 'wrong-ability'
  | 'wrong-amount'
  | 'save-proficient';

export interface FeatIncreaseResult {
  valid: boolean;
  reason?: FeatIncreaseInvalidReason;
}

/**
 * Whether `increases` is a legal ability increase for `featId`, by the feat's
 * printed shape: 'fixed' = exactly +1 to its one ability (e.g. Actor Cha, PHB
 * L8584 Athlete lists Str or Dex); 'choose-one' / 'epic-boon' = exactly +1 to
 * ONE of the listed abilities (Epic Boon L9124+); 'asi' = the Ability Score
 * Improvement shapes (+2 / +1 +1, L8558); a feat with no increase takes none.
 * Resilient (L8874-8880) may only raise an ability in which the character lacks
 * saving throw proficiency: pass `hasSaveProficiency` to enforce that (kept as
 * a callback because saving-throws.ts already imports this module).
 */
export function validateFeatIncrease(
  featId: string,
  increases: Partial<Record<Ability, number>> | undefined,
  hasSaveProficiency?: (ability: Ability) => boolean,
): FeatIncreaseResult {
  const feat = getFeat(featId);
  if (!feat) return { valid: false, reason: 'unknown-feat' };
  const entries = ABILITIES.map((a) => [a, increases?.[a] ?? 0] as const).filter(([, v]) => v !== 0);
  const inc = feat.abilityIncrease;

  if (!inc) {
    return entries.length === 0 ? { valid: true } : { valid: false, reason: 'no-increase' };
  }
  if (inc.kind === 'asi') {
    const r = isAsiAllocationValid(increases ?? {}, {});
    return r.valid ? { valid: true } : { valid: false, reason: 'wrong-amount' };
  }

  const allowed: Ability[] = inc.kind === 'fixed' ? [inc.ability] : inc.abilities;
  if (entries.some(([a]) => !allowed.includes(a))) return { valid: false, reason: 'wrong-ability' };
  if (entries.length !== 1 || entries[0][1] !== inc.amount) {
    return { valid: false, reason: 'wrong-amount' };
  }
  if (feat.mechanics.grants.saveProficiencyChoice && hasSaveProficiency?.(entries[0][0])) {
    return { valid: false, reason: 'save-proficient' };
  }
  return { valid: true };
}

// ─── Feat prerequisites ──────────────────────────────────────────────────────

/** Why a feat cannot be taken (the picker surfaces the reason). */
export type FeatBlockReason =
  | 'level'
  | 'ability'
  | 'armor-training'
  | 'spellcasting'
  | 'fighting-style'
  | 'already-taken';

export interface CanTakeFeatResult {
  ok: boolean;
  reason?: FeatBlockReason;
}

/**
 * The armor training the character has: class training (initial class in full,
 * later classes only their multiclass subset — classProficiencies) plus training
 * granted by feats already taken (Lightly/Moderately/Heavily Armored list it in
 * `mechanics.fixed` as 'armor-training:<kind>'). PHB 2024 "Lightly Armored",
 * "Moderately Armored", "Heavily Armored" (L8768, L8806, L8728).
 */
export function armorTrainings(character: Character): Set<FeatArmorTraining> {
  const have = new Set<FeatArmorTraining>();
  for (const label of classProficiencies(character).armor) {
    const lower = label.toLowerCase();
    if (lower.includes('light')) have.add('light');
    if (lower.includes('medium')) have.add('medium');
    if (lower.includes('heavy')) have.add('heavy');
    if (lower.includes('shield')) have.add('shield');
  }
  // PHB 2024 Bard "College of Valor" level 3 Martial Training (L3091): training
  // with Medium armor and Shields. (Cleric Protector / Druid Warden training is
  // an unrecorded level-1 choice, so it cannot be derived here.)
  for (const entry of allClasses(character)) {
    if (entry.id === 'bard' && entry.subclassId === 'valor' && entry.level >= 3) {
      have.add('medium');
      have.add('shield');
    }
  }
  for (const selection of characterFeats(character)) {
    for (const tag of getFeat(selection.featId)?.mechanics.fixed ?? []) {
      if (tag.startsWith('armor-training:')) {
        have.add(tag.slice('armor-training:'.length) as FeatArmorTraining);
      }
    }
  }
  return have;
}

// ─── Fighting Style feature (Fighter 1, Paladin 2, Ranger 2) ─────────────────

/** One class that grants a Fighting Style feat, and the pick made for it (if any). */
export interface FightingStyleSlot {
  classId: string;
  className: string;
  /**
   * Unique slot key, stored as `grantedBy` on the pick: the class id for the
   * class's own Fighting Style feature, `<classId>:subclass` for a subclass
   * feature that grants an additional Fighting Style (e.g. Champion).
   */
  key: string;
  /** Present for a subclass-granted slot: the subclass feature's name. */
  subclassFeature?: string;
  /** The class level at which the Fighting Style feature is gained. */
  featureLevel: number;
  /** The Fighting Style selection recorded for this class, or undefined. */
  filled?: FeatSelection;
}

/**
 * The classes whose Fighting Style feature the character has reached, read from
 * the class data (feature named "Fighting Style": Fighter 1, Paladin 2, Ranger
 * 2 — PHB 2024 class feature tables). Multiclass-aware: each class level counts
 * at its own class level. A chosen subclass feature flagged
 * `grantsFightingStyle` (the Champion's "Additional Fighting Style") adds a
 * second slot for that class once its class level is reached.
 */
export function fightingStyleSlots(character: Character): FightingStyleSlot[] {
  const slots: FightingStyleSlot[] = [];
  const feats = characterFeats(character);
  for (const entry of allClasses(character)) {
    const data = getClass(entry.id);
    const feature = data?.features.find((f) => f.name === 'Fighting Style' && f.level <= entry.level);
    if (data && feature) {
      slots.push({
        classId: entry.id,
        className: data.name,
        key: entry.id,
        featureLevel: feature.level,
        filled: feats.find((f) => f.grantedBy === entry.id),
      });
    }
    const extra = data
      ? entrySubclass(entry)?.features.find((f) => f.grantsFightingStyle && f.level <= entry.level)
      : undefined;
    if (data && extra) {
      const key = `${entry.id}:subclass`;
      slots.push({
        classId: entry.id,
        className: data.name,
        key,
        subclassFeature: extra.name,
        featureLevel: extra.level,
        filled: feats.find((f) => f.grantedBy === key),
      });
    }
  }
  return slots;
}

/** Display label for a Fighting Style pick's `grantedBy` key (class or subclass slot). */
function grantedByLabel(grantedBy: string): string {
  const [classId, suffix] = grantedBy.split(':');
  const name = getClass(classId)?.name ?? grantedBy;
  return suffix === 'subclass' ? `${name} subclass` : name;
}

/** Whether any class the character has grants the Fighting Style feature. */
export function hasFightingStyleFeature(character: Character): boolean {
  return fightingStyleSlots(character).length > 0;
}

/**
 * The Fighting Style feats the character may pick through the class feature:
 * all Fighting Style feats not yet taken, or [] without the feature.
 */
export function fightingStyleOptions(character: Character): FeatData[] {
  if (!hasFightingStyleFeature(character)) return [];
  return allFeats().filter(
    (f) => f.category === 'fighting-style' && canTakeFeat(character, f.id).ok,
  );
}

/**
 * Whether the character may take `featId` RIGHT NOW (PHB 2024 "Parts of a Feat"
 * L8356): the minimum-level prerequisite against the character level, the
 * ability-score minimum against the EFFECTIVE scores (so a feat that already
 * raised an ability can satisfy a later prereq), and the repeatable rule (a
 * non-repeatable feat already taken cannot be taken again).
 *
 * An unknown feat id is reported ok:false with no reason (nothing to validate).
 * Check order mirrors the golden PREREQ_CASES: level, then ability, then
 * already-taken.
 */
export function canTakeFeat(character: Character, featId: string): CanTakeFeatResult {
  const feat = getFeat(featId);
  if (!feat) return { ok: false };

  const level = clampLevel(character.level);
  const prereq = feat.prerequisite;

  // PHB 2024: a minimum-level prerequisite (General 4+, Epic Boon 19+).
  if (prereq?.minLevel !== undefined && level < prereq.minLevel) {
    return { ok: false, reason: 'level' };
  }

  // PHB 2024: an ability-score minimum, checked against EFFECTIVE scores.
  if (prereq?.abilityMin) {
    const scores = effectiveAbilityScores(character);
    for (const ability of ABILITIES) {
      const min = prereq.abilityMin[ability];
      if (min !== undefined && scores[ability] < min) {
        return { ok: false, reason: 'ability' };
      }
    }
  }

  // PHB 2024: "A or B 13+" — at least one listed ability must reach the minimum.
  if (prereq?.abilityAnyOf) {
    const scores = effectiveAbilityScores(character);
    const { abilities, min } = prereq.abilityAnyOf;
    if (!abilities.some((a) => scores[a] >= min)) return { ok: false, reason: 'ability' };
  }

  // PHB 2024: "<Light|Medium|Heavy> Armor Training" / "Shield Training".
  if (prereq?.armorTraining && !armorTrainings(character).has(prereq.armorTraining)) {
    return { ok: false, reason: 'armor-training' };
  }

  // PHB 2024: "Spellcasting or Pact Magic Feature" / "Spellcasting Feature".
  // The latter (Boon of Spell Recall) excludes Pact Magic as printed.
  if (prereq?.spellcasting === 'spellcasting-or-pact-magic' && !anySpellcaster(character)) {
    return { ok: false, reason: 'spellcasting' };
  }
  if (prereq?.spellcasting === 'spellcasting' && spellcastingClasses(character).length === 0) {
    return { ok: false, reason: 'spellcasting' };
  }

  // PHB 2024: "Fighting Style Feature" (Fighter 1, Paladin 2, Ranger 2).
  if (prereq?.fightingStyleFeature && !hasFightingStyleFeature(character)) {
    return { ok: false, reason: 'fighting-style' };
  }

  // PHB 2024 "Parts of a Feat": a feat can be taken only once unless repeatable.
  if (feat.repeatable !== true) {
    const alreadyTaken = characterFeats(character).some((f) => f.featId === featId);
    if (alreadyTaken) return { ok: false, reason: 'already-taken' };
  }

  return { ok: true };
}

// ─── Feat-slot assignments (pair each asi-marker slot with its chosen feat) ──

/** A feat/ASI slot paired with the feat that fills it, or empty. */
export interface FeatSlotAssignment {
  /** The asi-marker slot level. */
  level: number;
  /** The feat selection filling this slot, or undefined when the slot is empty. */
  filled?: FeatSelection;
}

/**
 * Pair each asi-marker slot level (from the class data, at or below the
 * character's level) with the feat selection tied to it, or leave it empty.
 * `slotLevels` are the slot levels (from advancement.featSlotLevels), kept as a
 * parameter so this module needs no dependency on advancement.ts. Each slot
 * level is matched to at most one feat; extra selections at an unknown level are
 * ignored here (the picker validates placement).
 */
export function featSlotAssignments(
  character: Character,
  slotLevels: number[],
): FeatSlotAssignment[] {
  const feats = characterFeats(character);
  const used = new Set<number>();
  return [...slotLevels]
    .sort((a, b) => a - b)
    .map((level) => {
      const idx = feats.findIndex((f, i) => f.level === level && !used.has(i));
      if (idx === -1) return { level };
      used.add(idx);
      return { level, filled: feats[idx] };
    });
}

// ─── applyFeat / removeFeat (pure, append to the log) ────────────────────────

/**
 * Add a feat selection to the character, returning a new Character (never
 * mutates). Appends the selection to advancement.feats[] (preserving order) and
 * an advancement.log entry. Does NOT re-validate prerequisites — callers gate
 * with canTakeFeat first (the picker). The base `abilities` is untouched; the
 * increases take effect only through effectiveAbilityScores.
 */
export function applyFeat(
  character: Character,
  selection: FeatSelection,
  timestamp: number,
): Character {
  const existing = characterFeats(character);
  const feats = [...existing, selection];
  const feat = getFeat(selection.featId);
  const name = feat?.name ?? selection.featId;
  const increaseText = formatIncreases(selection.abilityIncreases);
  // A class-feature feat (Fighting Style) fills no asi-marker slot (level 0), so
  // it is logged at the character's level under the granting class.
  const grantedBy = selection.grantedBy;
  const logLevel = grantedBy ? character.level : selection.level;
  const prefix = grantedBy
    ? `Level ${logLevel}: ${grantedByLabel(grantedBy)} Fighting Style`
    : `Level ${selection.level}`;
  const detail =
    increaseText.length > 0
      ? `${prefix}: took ${name} (${increaseText})`
      : `${prefix}: took ${name}`;

  const log = character.advancement?.log ?? [];
  return {
    ...character,
    advancement: {
      ...character.advancement,
      feats,
      log: [
        ...log,
        { timestamp, kind: 'feat', level: logLevel, detail },
      ],
    },
  };
}

/**
 * Take a Fighting Style feat through a class's Fighting Style feature (Fighter
 * 1, Paladin 2, Ranger 2). Replaces any earlier pick for the same class (PHB
 * 2024 lets a Fighter swap it on gaining a Fighter level) and returns a new
 * Character. The selection is stored at the sentinel `level: 0` with
 * `grantedBy` set, so it never binds to an ASI slot. Callers gate with
 * canTakeFeat / fightingStyleOptions first; an unknown class, a class without
 * the feature, or a non-Fighting-Style feat returns the character unchanged.
 */
export function applyFightingStyle(
  character: Character,
  slotKey: string,
  featId: string,
  timestamp: number,
): Character {
  const slot = fightingStyleSlots(character).find((s) => s.key === slotKey);
  const feat = getFeat(featId);
  if (!slot || feat?.category !== 'fighting-style') return character;
  const base = slot.filled ? removeFeat(character, 0, timestamp, slot.filled.featId) : character;
  return applyFeat(base, { featId, level: 0, grantedBy: slot.key }, timestamp);
}

/**
 * Remove the feat tied to `slotLevel` (and matching `featId` when given),
 * returning a new Character (never mutates). Reverts the increase everywhere by
 * dropping the selection, so effectiveAbilityScores stops summing it. Appends a
 * 'feat' log entry recording the removal. A no-op (returns the same reference)
 * when no matching selection exists.
 */
export function removeFeat(
  character: Character,
  slotLevel: number,
  timestamp: number,
  featId?: string,
): Character {
  const existing = characterFeats(character);
  const idx = existing.findIndex(
    (f) => f.level === slotLevel && (featId === undefined || f.featId === featId),
  );
  if (idx === -1) return character;

  const removed = existing[idx];
  const feats = existing.filter((_, i) => i !== idx);
  const feat = getFeat(removed.featId);
  const name = feat?.name ?? removed.featId;

  const log = character.advancement?.log ?? [];
  const nextAdvancement = {
    ...character.advancement,
    feats,
    log: [
      ...log,
      {
        timestamp,
        kind: 'feat' as const,
        level: removed.grantedBy ? character.level : slotLevel,
        detail: removed.grantedBy
          ? `Level ${character.level}: removed ${grantedByLabel(removed.grantedBy)} Fighting Style ${name}`
          : `Level ${slotLevel}: removed ${name}`,
      },
    ],
  };
  return { ...character, advancement: nextAdvancement };
}

/** Human-readable "+2 Str, +1 Dex" from an increases map (empty string = none). */
function formatIncreases(
  increases: Partial<Record<Ability, number>> | undefined,
): string {
  if (!increases) return '';
  const parts: string[] = [];
  for (const ability of ABILITIES) {
    const amount = increases[ability];
    if (amount !== undefined && Number.isFinite(amount) && amount !== 0) {
      parts.push(`+${amount} ${ABILITY_NAMES[ability]}`);
    }
  }
  return parts.join(', ');
}

// ─── Feat-granted skill, Expertise and save proficiencies (derived) ──────────

/**
 * Skill proficiencies granted by feats, keyed by SkillId with a source label.
 * DERIVED from advancement.feats[] (never stored on character.skills), so
 * removing a feat reverts it cleanly. Sources: the player's `choices.skills`
 * (Skilled, Skill Expert, Keen Mind, Observant) and Boon of Skill's proficiency
 * in all skills (PHB 2024 L8532, L8950, L8758, L8828, L9200). The level-0
 * background selection is skipped: background skills are already merged into
 * `character.skills` by applyBackground.
 */
export function featGrantedSkills(character: Character): Partial<Record<SkillId, string>> {
  const result: Partial<Record<SkillId, string>> = {};
  for (const selection of characterFeats(character)) {
    if (selection.level === 0) continue;
    const feat = getFeat(selection.featId);
    const label = `${feat?.name ?? selection.featId} (feat)`;
    if (feat?.mechanics.grants.allSkills) {
      for (const skill of SKILLS) if (result[skill.id] === undefined) result[skill.id] = label;
    }
    for (const id of selection.choices?.skills ?? []) {
      if (result[id] === undefined) result[id] = label;
    }
  }
  return result;
}

/**
 * Skills in which feats grant Expertise (Skill Expert, Keen Mind, Observant,
 * Boon of Skill — the player's `choices.expertise`). Derived like
 * featGrantedSkills; Expertise still counts only on an effectively proficient
 * skill (skills.ts), as the PHB 2024 glossary requires.
 */
export function featGrantedExpertise(character: Character): SkillId[] {
  const result: SkillId[] = [];
  for (const selection of characterFeats(character)) {
    if (selection.level === 0) continue;
    for (const id of selection.choices?.expertise ?? []) {
      if (!result.includes(id)) result.push(id);
    }
  }
  return result;
}

/**
 * Saving-throw proficiencies granted by feats: Resilient grants proficiency in
 * the ability it increased (PHB 2024 "Resilient" L8874). Keyed by Ability with
 * a source label; derived from the recorded ability increase.
 */
export function featGrantedSaves(character: Character): Partial<Record<Ability, string>> {
  const result: Partial<Record<Ability, string>> = {};
  for (const selection of characterFeats(character)) {
    const feat = getFeat(selection.featId);
    if (!feat?.mechanics.grants.saveProficiencyChoice) continue;
    for (const ability of ABILITIES) {
      if ((selection.abilityIncreases?.[ability] ?? 0) > 0 && result[ability] === undefined) {
        result[ability] = `${feat.name} (feat)`;
      }
    }
  }
  return result;
}

// Reference FEAT_CATALOG so a tree-shake never drops the catalog this module
// validates against (and so the import is never flagged unused).
export const FEAT_COUNT = Object.keys(FEAT_CATALOG).length;
