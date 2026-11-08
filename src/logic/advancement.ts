/**
 * Advancement — the LEVEL-UP FLOW (Stage A6a, D&D 5.5e / 2024).
 *
 * Fresh D&D content (NOT a port of the WFRP cost engine): the pure rules for
 * changing a character's level and recording the choices a level-up forces.
 *
 * SCOPE (A6a only): the XP-threshold table, canLevelUp (milestone vs XP), the
 * per-class feat/ASI slot map (read from the class data, never hard-coded), the
 * per-level HP choice (fixed vs rolled) + its record, a next-level preview, and
 * a minimal append-only audit log. Feat SELECTION, ASI allocation, and the
 * effective-ability-score rewire are A6b; the advisor/planner panels are A6c.
 *
 * RULES (PHB 2024, Docs/PlayersHandbook.md), verified before implementing:
 *  - Character Advancement table (L1982-2003): total XP and Proficiency Bonus
 *    per level 1-20. (Source renders levels 15/16 PB as "+S"; the value is +5.)
 *  - Gaining a Level (L2011-2026): gain a Hit Die, roll it + Con (minimum 1) OR
 *    take the fixed value; record new features and choices; adjust PB; adjust
 *    ability modifiers if a feat raised a score (Con rider: +1 HP per level
 *    when the Con modifier rises).
 *  - Fixed Hit Points by Class (L2016): the per-level fixed value = Hit Die/2+1.
 *  - Experience Points (optional rule): crossing a threshold PERMITS a level-up;
 *    it never auto-levels. Milestone is the no-table alternative (app default).
 *  - Subclass at level 3 (every 2024 class; `subclassLevel: 3` in data/classes).
 *
 * All functions are pure and never mutate their input. Totals shown in the UI
 * return a Breakdown (calculated-totals steering).
 */

import type { Character, ClassEntry } from '../types/character';
import type { ClassFeature, HitDie } from '../data/classes';
import { getClass } from '../data/classes';
import type { Breakdown } from './breakdown';
import { abilityModifier, clampLevel, proficiencyBonus, MAX_LEVEL, MIN_LEVEL } from './abilities';
import { classFeaturesByLevel, resolveClass, resolveClasses } from './classes';
import { effectiveAbilityScores } from './feats';
import { characterHitPointMaxBreakdown } from './hit-points-state';
import { reconcileSpellcastingForLevel } from './spellcasting';
import { bonusFeatSlotLevels } from './bonus-feats';
import { clampResourcesSpent } from './resources';

// ─── XP thresholds (Character Advancement table, PHB 2024 L1982-2003) ────────

/**
 * Total XP required to BE each level 1..20 (PHB 2024 "Character Advancement"
 * table, L1982-2003). Indexed by level; XP_THRESHOLD_BY_LEVEL[1] = 0. This is
 * the only new table — Proficiency Bonus is already computed by
 * proficiencyBonus(level) and matches the table's PB column exactly.
 */
const XP_THRESHOLD_BY_LEVEL: Record<number, number> = {
  1: 0,
  2: 300,
  3: 900,
  4: 2700,
  5: 6500,
  6: 14000,
  7: 23000,
  8: 34000,
  9: 48000,
  10: 64000,
  11: 85000,
  12: 100000,
  13: 120000,
  14: 140000,
  15: 165000,
  16: 195000,
  17: 225000,
  18: 265000,
  19: 305000,
  20: 355000,
};

/**
 * The total XP needed to BE `level` (PHB 2024 "Character Advancement" table).
 * Level is clamped to 1..20 before lookup.
 */
export function xpForLevel(level: number): number {
  return XP_THRESHOLD_BY_LEVEL[clampLevel(level)];
}

/**
 * The HIGHEST level whose XP threshold the total has reached (clamped 1..20).
 * Crossing a threshold permits that level; it never auto-applies the level
 * (PHB 2024: XP is the DM-awarded optional rule). Negative/NaN XP is level 1.
 */
export function xpToLevel(xp: number): number {
  const total = Number.isFinite(xp) ? xp : 0;
  let result = MIN_LEVEL;
  for (let level = MIN_LEVEL; level <= MAX_LEVEL; level += 1) {
    if (total >= XP_THRESHOLD_BY_LEVEL[level]) result = level;
    else break;
  }
  return result;
}

// ─── Leveling mode + canLevelUp ──────────────────────────────────────────────

/** The leveling model (PHB 2024: milestone is the no-table default; XP is optional). */
export type LevelingMode = 'milestone' | 'xp';

/** The character's leveling mode (absent = milestone, the RAW-neutral default). */
export function levelingMode(character: Character): LevelingMode {
  return character.advancement?.leveling?.mode ?? 'milestone';
}

/** The XP recorded for the character (absent/non-finite = 0). XP is DM-entered. */
export function characterXp(character: Character): number {
  const xp = character.advancement?.leveling?.xp;
  return xp !== undefined && Number.isFinite(xp) ? xp : 0;
}

/**
 * Whether the character may advance to the next level RIGHT NOW. Levels cap at
 * 20. In milestone mode any level below 20 may advance (the DM grants it). In
 * XP mode advancement is permitted only when the XP total has reached the NEXT
 * level's threshold — and even then only ONE level at a time (PHB 2024:
 * applying a new level is a deliberate step, never an auto-level of several
 * levels at once).
 */
export function canLevelUp(character: Character): boolean {
  const level = clampLevel(character.level);
  if (level >= MAX_LEVEL) return false;
  if (levelingMode(character) === 'milestone') return true;
  return characterXp(character) >= xpForLevel(level + 1);
}

// ─── Feat / ASI slots (read from the asi-marker rows, never hard-coded) ──────

/**
 * One feat/ASI slot a character has, by the level it was gained at. In A6a each
 * slot is reported as PENDING (feat selection is A6b), so `pending` is always
 * true; the shape leaves room for a `filled` FeatSelection in A6b without a
 * migration.
 */
export interface FeatSlot {
  /** The asi-marker level this slot was gained at (the CLASS level, not total). */
  level: number;
  /**
   * The class whose asi-marker row granted this slot (PHB 2024 "Multiclassing":
   * ASI markers are per class). Lets M4 bind a feat to the right class. Optional
   * for backward compatibility; always set by {@link featSlots}.
   */
  classId?: string;
  /** A6a: no feat is selected yet, so every slot is pending. */
  pending: true;
}

/**
 * The feat/ASI-marker levels the character's classes grant AT OR BELOW each
 * class's OWN level, ascending (PHB 2024 "Multiclassing: Class Features" —
 * ASI markers are PER CLASS, so the slots are the UNION of each class's
 * asi-marker rows evaluated at that class's own level, NOT the single-class
 * count at the total level). Standard classes 4/8/12/16/19; Fighter also 6 and
 * 14; Rogue also 10 — the level-19 row is the Epic Boon slot.
 *
 * The result is the flattened (NON-deduplicated) list of marker levels across
 * all classes, so its LENGTH is the true number of feat/ASI slots: e.g.
 * Fighter 6 / Rogue 4 → [4, 4, 6] (3 slots). A single-class character gives
 * exactly that class's marker levels (unchanged from before). No class = [].
 */
export function featSlotLevels(character: Character): number[] {
  const levels: number[] = [];
  for (const { entry, data } of resolveClasses(character)) {
    const classLevel = clampLevel(entry.level);
    for (const feature of data.features) {
      if (feature.kind === 'asi-marker' && feature.level <= classLevel) {
        levels.push(feature.level);
      }
    }
  }
  // Opt-in house rule (PHB 2024 "Bonus Feats at Level 20"): synthetic levels 21+.
  // Empty unless the rule is on, so default output is unchanged.
  levels.push(...bonusFeatSlotLevels(character));
  return levels.sort((a, b) => a - b);
}

/**
 * The feat/ASI slots a character has so far, one per asi-marker level at or
 * below each class's level, tagged with the class that granted it (PHB 2024
 * "Multiclassing": the slot belongs to the class whose asi-marker row it is, so
 * M4 can bind a feat to the right {classId, level}). A6a/M2 surface each as a
 * pending placeholder; the actual feat picker is A6b. For a single-class
 * character this is one slot per that class's marker level (unchanged count).
 */
export function featSlots(character: Character): FeatSlot[] {
  const slots: FeatSlot[] = [];
  for (const { entry, data } of resolveClasses(character)) {
    const classLevel = clampLevel(entry.level);
    for (const feature of data.features) {
      if (feature.kind === 'asi-marker' && feature.level <= classLevel) {
        slots.push({ level: feature.level, classId: data.id, pending: true });
      }
    }
  }
  return slots.sort((a, b) => a.level - b.level);
}

// ─── Per-level HP choice ─────────────────────────────────────────────────────

/** The player's HP choice at a level-up: the fixed value or a rolled Hit Die. */
export type HpChoiceMode = 'fixed' | 'rolled';

/** A per-level HP choice (fixed = no face; rolled = the Hit Die face rolled). */
export interface HpChoice {
  mode: HpChoiceMode;
  /** The rolled Hit Die face (1..hitDie); used only for mode 'rolled'. */
  face?: number;
}

/**
 * The HP gained for ONE level after the first from an HP choice (PHB 2024
 * "Gaining a Level", L2013-2014). Fixed = (Hit Die/2 + 1) + Con modifier;
 * rolled = the Hit Die face + Con modifier. Either way the per-level gain is
 * floored at a minimum of 1. Not the level-1 contribution, which is always the
 * full Hit Die + Con (no choice).
 */
export function hpChoiceValue(
  hitDie: HitDie,
  conMod: number,
  mode: HpChoiceMode,
  face?: number,
): number {
  // PHB 2024 "Fixed Hit Points by Class" (L2016): fixed = Hit Die / 2 + 1.
  const base = mode === 'rolled' ? (face ?? 0) : hitDie / 2 + 1;
  // PHB 2024 "Gaining a Level" (L2014): add Con modifier, minimum of 1.
  return Math.max(1, base + conMod);
}

// ─── Next-level preview ──────────────────────────────────────────────────────

/** What a character gains advancing from their current level to the next. */
export interface NextLevelPreview {
  /** The level after advancing (current + 1), clamped to 20. */
  nextLevel: number;
  /** A feat/ASI slot opens at the next level (an asi-marker row). */
  featSlotOpens: boolean;
  /** The subclass choice happens at the next level (the subclass-choice row). */
  subclassChoice: boolean;
  /** The Proficiency Bonus AFTER leveling, present only when it changes. */
  proficiencyBonusChangesTo?: number;
  /** The feature names gained at the next level (text from the class data). */
  features: string[];
}

/**
 * What the character gains going from `level` to `level`+1 (PHB 2024 "Gaining a
 * Level" + the class features table). Returns null only when already at the
 * level cap (nothing to preview). Feature text comes from classFeaturesByLevel;
 * the structural flags (feat slot / subclass choice) read the feature `kind`.
 */
export function nextLevelPreview(character: Character): NextLevelPreview | null {
  const level = clampLevel(character.level);
  if (level >= MAX_LEVEL) return null;
  const nextLevel = level + 1;

  const byLevel = classFeaturesByLevel(character);
  const atNext: ClassFeature[] = byLevel.get(nextLevel) ?? [];

  const featSlotOpens = atNext.some((f) => f.kind === 'asi-marker');
  const subclassChoice = atNext.some((f) => f.kind === 'subclass-choice');

  const currentPb = proficiencyBonus(level);
  const nextPb = proficiencyBonus(nextLevel);

  const preview: NextLevelPreview = {
    nextLevel,
    featSlotOpens,
    subclassChoice,
    features: atNext.map((f) => f.name),
  };
  // PHB 2024 "Character Advancement" table: PB only at certain levels.
  if (nextPb !== currentPb) preview.proficiencyBonusChangesTo = nextPb;
  return preview;
}

// ─── Minimal audit log ───────────────────────────────────────────────────────

/**
 * One entry in the per-character advancement audit log (A6a). Oldest-first; the
 * UI reverses for display. Deliberately NOT coupled to the Phase B7 unified
 * event log (blueprint §7.1). Additive-optional; no CURRENT_VERSION bump.
 */
export interface AdvancementLogEntry {
  /** Epoch milliseconds from an injected clock (also used as the display key). */
  timestamp: number;
  kind: 'level-up' | 'hp' | 'subclass' | 'xp-award' | 'feat';
  /** The level the entry concerns, when relevant. */
  level?: number;
  /** Human-readable detail, e.g. 'Level 4: HP +8 (fixed)'. */
  detail: string;
  /** The XP awarded (xp-award entries only). */
  xpAmount?: number;
}

/** The character's advancement log, oldest-first (absent = empty). */
export function advancementLog(character: Character): AdvancementLogEntry[] {
  return character.advancement?.log ?? [];
}

/**
 * Append a log entry, returning a new Character (never mutates). The log stays
 * oldest-first. Keeps the rest of `advancement` intact.
 */
export function appendLogEntry(
  character: Character,
  entry: AdvancementLogEntry,
): Character {
  const existing = character.advancement?.log ?? [];
  return {
    ...character,
    advancement: {
      ...character.advancement,
      log: [...existing, entry],
    },
  };
}

// ─── Per-level HP record + log ───────────────────────────────────────────────

/**
 * Record the per-level HP choice for `level` on `advancement.levels[]` and
 * append an 'hp' log entry, returning a new Character (never mutates). The
 * stored HP value is the floored per-level gain from hpChoiceValue — so a Con
 * change still recomputes the Con rider through the existing HP math; only the
 * Hit-Dice portion (fixed vs rolled face) is pinned by the record. The HP
 * maximum and current HP are read through hitPointMaxWithAdvancement /
 * hit-points-state; this helper only records the choice, it writes no HP rule.
 */
export function setLevelHp(
  character: Character,
  level: number,
  choice: HpChoice,
  timestamp: number,
  /**
   * The Hit Die the HP gain is rolled/fixed against (PHB 2024 "Gaining a Level"
   * — the die is the LEVELED class's, which for a multiclass level is NOT the
   * primary class's). Defaults to the primary class's die, so single-class
   * behaviour is unchanged.
   */
  hitDieOverride?: HitDie,
  /**
   * The class the level was gained in, stored on the record so multiclass HP can
   * attribute it to that class's Hit Die. Absent = keep the existing record's
   * classId (a correction), else the record is read as the initial class.
   */
  classId?: string,
): Character {
  const targetLevel = clampLevel(level);
  const cls = resolveClass(character);
  const hitDie = hitDieOverride ?? cls?.hitDie;
  const conMod = abilityModifier(effectiveAbilityScores(character).con);

  // The per-level HP value recorded is the Hit-Dice portion ONLY (no Con rider),
  // so a later Con change recomputes the rider through hit-points.ts rather than
  // being frozen into the record. Fixed = Hit Die/2+1; rolled = the face.
  const hitDicePortion =
    hitDie === undefined
      ? 0
      : choice.mode === 'rolled'
        ? choice.face ?? 0
        : hitDie / 2 + 1;

  const existingLevels = character.advancement?.levels ?? [];
  const recordClassId = classId ?? existingLevels.find((l) => l.level === targetLevel)?.classId;
  const record = {
    level: targetLevel,
    ...(recordClassId !== undefined ? { classId: recordClassId } : {}),
    hp: { mode: choice.mode, value: hitDicePortion },
  };

  const levels = existingLevels.filter((l) => l.level !== targetLevel);
  levels.push(record);
  levels.sort((a, b) => a.level - b.level);

  const withRecord: Character = {
    ...character,
    advancement: { ...character.advancement, levels },
  };

  // The total per-level gain for the log (with Con rider + minimum-1 floor).
  const gain =
    hitDie === undefined
      ? 0
      : hpChoiceValue(hitDie, conMod, choice.mode, choice.face);
  const detail =
    choice.mode === 'rolled'
      ? `Level ${targetLevel}: HP +${gain} (rolled ${choice.face ?? 0} + Con ${formatSignedLocal(conMod)})`
      : `Level ${targetLevel}: HP +${gain} (fixed)`;

  return appendLogEntry(withRecord, {
    timestamp,
    kind: 'hp',
    level: targetLevel,
    detail,
  });
}

/** Local signed formatter (avoids importing the UI breakdown formatter here). */
function formatSignedLocal(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

// ─── HP max threaded through the per-level records ───────────────────────────

/**
 * The Hit Point maximum breakdown with the per-level HP records threaded in.
 *
 * The HP MATH stays in hit-points.ts: when per-level rolled records exist, their
 * Hit-Dice portions for levels 2..L are summed into a rolled total and fed to
 * hitPointMaxBreakdown via the existing rolled-HP path (the Con rider and the
 * minimum-1 floor are applied there, not here). When no per-level records exist,
 * this is exactly characterHitPointMaxBreakdown (HP as today). Fixed-mode
 * records equal the fixed computation, so they need no special handling.
 */
export function hitPointMaxWithAdvancement(character: Character): Breakdown {
  const levels = character.advancement?.levels ?? [];
  const cls = resolveClass(character);
  // Only the rolled records diverge from the default fixed computation. If there
  // are none (or no class), the existing character breakdown already covers it.
  const rolledRecords = levels.filter(
    (l) => l.level >= 2 && l.hp?.mode === 'rolled' && Number.isFinite(l.hp.value),
  );
  // Multiclass: the per-class model in characterHitPointMaxBreakdown reads the
  // records itself (each rolled level uses the Hit Die of the class it was
  // gained in; unrecorded levels use that class's fixed value).
  if (cls === undefined || rolledRecords.length === 0 || resolveClasses(character).length >= 2) {
    return characterHitPointMaxBreakdown(character);
  }

  // Build a rolled levels-2..L total from the records, defaulting any unrecorded
  // level to the fixed value so the total always covers every level 2..L.
  const fixedPerLevel = cls.hitDie / 2 + 1;
  const level = clampLevel(character.level);
  const byLevel = new Map(levels.map((l) => [l.level, l] as const));
  let rolledTotal = 0;
  for (let l = 2; l <= level; l += 1) {
    const rec = byLevel.get(l);
    rolledTotal +=
      rec?.hp?.mode === 'rolled' && Number.isFinite(rec.hp.value)
        ? (rec.hp.value as number)
        : fixedPerLevel;
  }

  // Thread the rolled total through the existing rolled-HP path on hit-points.ts
  // by temporarily presenting the rolled house-rule inputs to the breakdown.
  return characterHitPointMaxBreakdown({
    ...character,
    houseRules: { ...character.houseRules, rolledHp: true },
    rolledHpTotal: rolledTotal,
  });
}

// ─── applyLevelUp (the authoritative level change) ───────────────────────────

/**
 * The result of a level-up attempt: the new Character, or null when it is not
 * permitted (already at 20, or XP mode without enough XP). Mirrors the nullable
 * pattern used by the hit-points-state character operations.
 */

/**
 * Advance the character ONE level (the authoritative level-up), recording the
 * per-level HP choice and appending a 'level-up' log entry. Returns null when a
 * level-up is not permitted right now (canLevelUp is false).
 *
 * Behaviour mirrors CharacterPage's setLevel: the level is clamped and spell
 * selections are reconciled to the new level (reconcileSpellcastingForLevel).
 * Expended spell slots are NOT cleared — a level-up is not a rest (PHB 2024:
 * slots recover on a rest), so slotsExpended / pactSlotsExpended are left as-is.
 */
export function applyLevelUp(
  character: Character,
  choice: HpChoice,
  timestamp: number,
): Character | null {
  if (!canLevelUp(character)) return null;
  const nextLevel = clampLevel(character.level + 1);

  // Mirror setLevel: set the stored TOTAL level, then keep the single class
  // entry's level in sync (single-class this stage — exactly one entry, whose
  // level tracks the total; multiclass level-up is M4). PHB 2024 "Multiclassing".
  let next: Character = { ...character, level: nextLevel };
  const primary = next.classes?.[0];
  if (primary) {
    next = { ...next, classes: [{ ...primary, level: nextLevel }, ...next.classes!.slice(1)] };
  }
  if (next.spellcasting) {
    const reconciled = reconcileSpellcastingForLevel(next);
    if (reconciled) next.spellcasting = reconciled;
    else delete next.spellcasting;
  }

  next = clampResourcesSpent(next);

  // Record the per-level HP choice (also appends an 'hp' log entry) …
  next = setLevelHp(next, nextLevel, choice, timestamp);
  // … then the level-up entry (ordered after the HP entry for this level).
  next = appendLogEntry(next, {
    timestamp,
    kind: 'level-up',
    level: nextLevel,
    detail: `Advanced to level ${nextLevel}`,
  });
  return next;
}

/**
 * Add ONE level in `targetClassId` — either an EXISTING class (increment its
 * entry) or a NEW class (append a `{ id, level: 1 }` entry) — the authoritative
 * MULTICLASS level-up (PHB 2024 "Multiclassing", Stage M4). Returns null when a
 * level-up is not permitted right now (canLevelUp is false).
 *
 * The per-class invariant is maintained: the targeted entry's level increments
 * by 1 (a new class starts at 1), and the stored TOTAL `character.level` becomes
 * the sum of the entry levels. The per-level HP choice is recorded against the
 * LEVELED class's Hit Die (PHB 2024 "Gaining a Level": the die is that class's),
 * NOT the primary class's. Spellcasting is reconciled (M3). An advancement-log
 * entry notes the class.
 *
 * This does NOT enforce the multiclass PREREQUISITE — the prereq / house-rule
 * gate is the UI's decision (logic/multiclass.ts mayMulticlass); this applies a
 * level the caller has already decided is permitted. Adding a level in the sole
 * existing class is equivalent to {@link applyLevelUp}.
 */
export function applyMulticlassLevel(
  character: Character,
  targetClassId: string,
  choice: HpChoice,
  timestamp: number,
): Character | null {
  if (!canLevelUp(character)) return null;

  const existing = character.classes ?? [];
  const index = existing.findIndex((entry) => entry.id === targetClassId);
  const isNewClass = index === -1;

  // Build the updated classes[] array (append a new entry, or increment one).
  let classes: ClassEntry[];
  if (isNewClass) {
    // PHB 2024 "Multiclassing": a new class is appended at level 1 (its reduced
    // multiclass proficiencies apply because it is non-initial — M2).
    classes = [...existing, { id: targetClassId as ClassEntry['id'], level: 1 }];
  } else {
    classes = existing.map((entry, i) =>
      i === index ? { ...entry, level: entry.level + 1 } : entry,
    );
  }

  // The stored TOTAL = Σ entry levels (invariant). Clamped to the level cap.
  const total = clampLevel(classes.reduce((sum, entry) => sum + entry.level, 0));

  let next: Character = { ...character, classes, level: total };

  if (next.spellcasting) {
    const reconciled = reconcileSpellcastingForLevel(next);
    if (reconciled) next.spellcasting = reconciled;
    else delete next.spellcasting;
  }

  next = clampResourcesSpent(next);

  // The HP gain uses the LEVELED class's Hit Die (PHB 2024 "Gaining a Level").
  const leveledDie = getClass(targetClassId)?.hitDie;
  next = setLevelHp(next, total, choice, timestamp, leveledDie, targetClassId);

  // The level-up log entry names the class that gained the level.
  const className = getClass(targetClassId)?.name ?? targetClassId;
  const detail = isNewClass
    ? `Multiclassed into ${className} (${className} 1); now level ${total}`
    : `Advanced ${className} to level ${classes[index].level}; now level ${total}`;
  next = appendLogEntry(next, { timestamp, kind: 'level-up', level: total, detail });
  return next;
}

/**
 * Set the character's level directly (a sheet correction / the authoritative
 * Advancement-page level control), clamping to 1..20 and reconciling spell
 * selections exactly as CharacterPage's setLevel does. Does NOT record a
 * per-level HP choice or clear expended spell slots. Returns a new Character.
 */
export function setLevel(character: Character, rawLevel: number): Character {
  const level = clampLevel(rawLevel);
  let next: Character = { ...character, level };
  const primary = next.classes?.[0];
  if (primary) {
    next = { ...next, classes: [{ ...primary, level }, ...next.classes!.slice(1)] };
  }
  if (next.spellcasting) {
    const reconciled = reconcileSpellcastingForLevel(next);
    if (reconciled) next.spellcasting = reconciled;
    else delete next.spellcasting;
  }
  // De-leveling can lower a maximum: keep stored spent within the new max.
  return clampResourcesSpent(next);
}

// ─── XP award (recorded + logged; XP mode only) ──────────────────────────────

/**
 * Record an XP award, returning a new Character with the XP total raised and an
 * 'xp-award' log entry appended (never mutates). The leveling mode is set to
 * 'xp' when it was absent, since recording XP implies the XP optional rule.
 * Crossing a threshold only PERMITS a level-up (see canLevelUp); it never
 * auto-levels. A non-positive/non-finite amount is a no-op.
 */
export function awardXp(
  character: Character,
  amount: number,
  reason: string,
  timestamp: number,
): Character {
  if (!Number.isFinite(amount) || amount <= 0) return character;
  const current = characterXp(character);
  const mode = character.advancement?.leveling?.mode ?? 'xp';
  const next: Character = {
    ...character,
    advancement: {
      ...character.advancement,
      leveling: { ...character.advancement?.leveling, mode, xp: current + amount },
    },
  };
  const detail = reason.trim().length > 0 ? `XP +${amount}: ${reason.trim()}` : `XP +${amount}`;
  return appendLogEntry(next, { timestamp, kind: 'xp-award', detail, xpAmount: amount });
}

// ─── Tooltip resolvers for the new rules content ─────────────────────────────

/**
 * Paraphrased, PHB-cited explanatory text for the per-level HP choice, or null
 * when the character has no class (no Hit Die, so no choice to explain). Short,
 * mechanical paraphrase only (content-tooltips / rules-compliance licensing).
 */
export function hpChoiceTooltip(character: Character): string | null {
  const cls = resolveClass(character);
  if (!cls) return null;
  const fixed = cls.hitDie / 2 + 1;
  // PHB 2024 "Gaining a Level" (L2013-2016): fixed value or roll the Hit Die.
  return (
    `Each level after the 1st adds either the fixed value (${fixed} for a d${cls.hitDie}) ` +
    `or a rolled d${cls.hitDie}, plus your Constitution modifier, to a minimum of 1 ` +
    `(PHB 2024 "Gaining a Level").`
  );
}

/**
 * Paraphrased, PHB-cited explanation of the leveling mode, or null when no
 * character is relevant. Milestone vs the XP optional rule.
 */
export function levelingModeTooltip(character: Character): string {
  // PHB 2024 "Character Advancement" table + the Experience Points optional rule.
  return levelingMode(character) === 'xp'
    ? 'XP mode: the DM awards Experience Points; reaching the next level\u2019s total ' +
        'on the Character Advancement table permits a level-up (it does not auto-level).'
    : 'Milestone mode: the DM grants a level at story milestones; no XP is tracked ' +
        '(PHB 2024 "Character Advancement").';
}
