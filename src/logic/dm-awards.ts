/**
 * DM award codes (Stage 8: Party XP and milestones).
 *
 * The DM builds one award (an XP amount per character, or a target level) and
 * copies a code. A player pastes it on the Advancement page, previews the change
 * and applies it with the existing `awardXp` / `setLevel` functions. Nothing
 * flows from the DM app into a sheet. The code is a small JSON payload inside
 * the share-codec envelope, prefixed `AWARD-`. Applied IDs are stored on the
 * character so a repeat paste is refused.
 *
 * RULES (Docs/DungeonMastersGuide.md L1938-1995, "Awarding XP", "Noncombat
 * Challenges", "Milestones", "Level Advancement Without XP"):
 *  - The characters divide XP evenly; division rounds down (PHB 2024 "Round Down").
 *  - A noncombat challenge is awarded as a combat encounter of the same difficulty.
 *  - A major milestone counts as a high-difficulty encounter and a minor milestone
 *    as a low-difficulty one (DMG L1956).
 *  - XP thresholds are PHB 2024 "Character Advancement" in advancement.ts; not copied here.
 *
 * INTERPRETATION (flagged): one code serves a whole party, so for a party of mixed
 * levels the milestone amount is the even split of the summed budget, not each
 * member's own budget. For an equal-level party the two are identical.
 */
import type { Character } from '../types/character';
import type { DmCombatant, DmPartyMember } from '../types/dm';
import type { Breakdown } from './breakdown';
import type { EncounterDifficulty } from '../data/xp-tables';
import { clampLevel } from './abilities';
import { applyHealingToCharacter, hitPointMaxOf } from './hit-points-state';
import { appendLogEntry, awardXp, levelingMode, setLevel, xpForLevel, xpToLevel } from './advancement';
import { xpAward, xpBudget, type BudgetMember, type XpAward } from './dm-balance';
import { isGzipSupported } from './gzip';
import { decodeSharePayload, encodeSharePayload } from './share-codec';

// ---------------------------------------------------------------- constants

/** App cap on an XP award: the level 20 threshold (PHB 2024 "Character Advancement"). */
export const MAX_AWARD_XP = xpForLevel(20);
export const MAX_LABEL = 40;
/** DM award history cap per campaign. */
export const MAX_AWARDS = 200;
export const AWARD_PREFIX = 'AWARD-';
export const ID_PATTERN = /^[a-z0-9]{8,32}$/;
/** Input guard: longer pasted text is rejected before any decoding. */
export const MAX_CODE_CHARS = 400;
const MAX_JSON_LENGTH = 1000;

// -------------------------------------------------------------------- types

export interface AwardPayload {
  kind: 'xp' | 'level';
  /** XP per character, or the target level. */
  amount: number;
  id: string;
  label: string;
}

export type AwardErrorCode =
  | 'empty'
  | 'not-award'
  | 'looks-like-character'
  | 'too-large'
  | 'bad-code'
  | 'bad-version'
  | 'bad-json'
  | 'unknown-kind'
  | 'invalid';

export type ValidateResult =
  | { ok: true; award: AwardPayload }
  | { ok: false; error: string; code: 'unknown-kind' | 'invalid' };

export type ApplyOutcome =
  | 'applied'
  | 'already-applied'
  | 'no-change'
  | 'multiclass-unsupported'
  | 'milestone-blocked'
  | 'xp-baseline-missing'
  | 'class-required'
  | 'hp-unsupported';

/** Outcomes that stop an award from being applied (the sheet is unchanged). */
export type BlockedOutcome = Exclude<ApplyOutcome, 'applied' | 'already-applied' | 'no-change'>;

export function isBlockedOutcome(x: ApplyOutcome | null): x is BlockedOutcome {
  return x !== null && x !== 'applied' && x !== 'already-applied' && x !== 'no-change';
}

// ---------------------------------------------------------------------- ids

/** Pure. UUID in, 12-character award ID out. */
export function awardIdFromUuid(uuid: string): string {
  return uuid.replace(/-/g, '').toLowerCase().slice(0, 12);
}

// --------------------------------------------------------------- validation

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Clean a label the way validation does: strip control characters, trim. */
export function cleanLabel(label: string): string {
  return label.replace(CONTROL_CHARS, '').trim();
}

/**
 * Validate the wire form `{ t: 'award', k, n, i, l? }`. Unknown extra fields are
 * ignored and not copied.
 */
export function validateAward(raw: unknown): ValidateResult {
  const fail = (error: string, code: 'invalid' | 'unknown-kind' = 'invalid'): ValidateResult => ({ ok: false, error, code });
  if (!isRecord(raw)) return fail('This award code is not valid.');
  if (raw.t !== 'award') return fail('This award code is not valid.');
  if (raw.k !== 'xp' && raw.k !== 'level') return fail('This award code is for a newer version of the app.', 'unknown-kind');
  const n = raw.n;
  if (typeof n !== 'number' || !Number.isInteger(n)) return fail('The award amount must be a whole number.');
  if (raw.k === 'xp' && (n < 1 || n > MAX_AWARD_XP)) return fail(`The XP amount must be from 1 to ${MAX_AWARD_XP.toLocaleString()}.`);
  if (raw.k === 'level' && (n < 1 || n > 20)) return fail('The target level must be from 1 to 20.');
  if (typeof raw.i !== 'string' || !ID_PATTERN.test(raw.i)) return fail('The award ID is not valid.');
  let label = '';
  if (raw.l !== undefined) {
    if (typeof raw.l !== 'string') return fail('The award label is not valid.');
    label = cleanLabel(raw.l);
    if (label.length > MAX_LABEL) return fail(`The award label is longer than ${MAX_LABEL} characters.`);
  }
  return { ok: true, award: { kind: raw.k, amount: n, id: raw.i, label } };
}

function toWire(p: AwardPayload): Record<string, unknown> {
  const wire: Record<string, unknown> = { t: 'award', k: p.kind, n: p.amount, i: p.id };
  if (p.label !== '') wire.l = p.label;
  return wire;
}

/** Validate an award in its in-app form. */
export function validatePayload(p: AwardPayload): ValidateResult {
  return validateAward(toWire(p));
}

// ------------------------------------------------------------ encode/decode

export async function encodeAward(
  p: AwardPayload,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  try {
    if (!isGzipSupported()) {
      return { ok: false, error: 'This browser cannot create award codes (compression is unavailable).' };
    }
    const checked = validatePayload(p);
    if (!checked.ok) return { ok: false, error: checked.error };
    const encoded = await encodeSharePayload(JSON.stringify(toWire(checked.award)));
    return { ok: true, code: AWARD_PREFIX + encoded };
  } catch {
    return { ok: false, error: 'Could not create the award code.' };
  }
}

export async function decodeAward(
  text: string,
): Promise<{ ok: true; award: AwardPayload } | { ok: false; error: string; code: AwardErrorCode }> {
  const fail = (error: string, code: AwardErrorCode) => ({ ok: false as const, error, code });
  try {
    const trimmed = text.trim();
    if (trimmed === '') return fail('Paste an award code.', 'empty');
    if (trimmed.startsWith(AWARD_PREFIX) && !isGzipSupported()) {
      return fail('This browser cannot read award codes (compression is unavailable).', 'bad-code');
    }
    if (!trimmed.startsWith(AWARD_PREFIX)) {
      if (trimmed.includes('#view/') || trimmed.startsWith('{')) {
        return fail(
          'That looks like a character share link or file, not an award code. Award codes start with AWARD-.',
          'looks-like-character',
        );
      }
      return fail('This is not an award code. Award codes start with AWARD-.', 'not-award');
    }
    if (trimmed.length > MAX_CODE_CHARS) return fail('This award code is too long.', 'too-large');
    const decoded = await decodeSharePayload(trimmed.slice(AWARD_PREFIX.length));
    if (!decoded.ok) {
      if (decoded.code === 'bad-version') return fail('This award code is for a different version of the app.', 'bad-version');
      if (decoded.code === 'too-large') return fail('This award code is too long.', 'too-large');
      if (decoded.code === 'bad-gzip') {
        return fail(
          'This award code is damaged, or it was created on a device that cannot make award codes. Ask the DM to send it again.',
          'bad-code',
        );
      }
      return fail('This award code is not valid.', 'bad-code');
    }
    if (decoded.json.length > MAX_JSON_LENGTH) return fail('This award code is too long.', 'too-large');
    let raw: unknown;
    try {
      raw = JSON.parse(decoded.json);
    } catch {
      return fail('This award code is not valid.', 'bad-json');
    }
    const checked = validateAward(raw);
    if (!checked.ok) return fail(checked.error, checked.code);
    return { ok: true, award: checked.award };
  } catch {
    return fail('This award code is not valid.', 'bad-code');
  }
}

// ------------------------------------------------------------------- shares

export type MilestoneKind = 'major' | 'minor' | EncounterDifficulty;

export interface MilestoneShare {
  /** The summed XP budget for the difficulty. */
  total: Breakdown;
  /** Each character's even share, rounded down. */
  share: Breakdown;
  note?: string;
}

/** Milestone or noncombat XP: the budget for the difficulty, split evenly (DMG L1942-1956). */
export function milestoneShare(members: BudgetMember[], kind: MilestoneKind, sharers = members.length): MilestoneShare {
  const difficulty: EncounterDifficulty = kind === 'major' ? 'high' : kind === 'minor' ? 'low' : kind;
  const total = xpBudget(members, difficulty);
  const size = Math.max(1, Math.trunc(sharers));
  const share = Math.floor(total.total / size);
  return {
    total,
    share: {
      total: share,
      components: [{ label: `${total.total} XP divided by ${size} ${size === 1 ? 'character' : 'characters'}, rounded down`, value: share }],
    },
    note: members.length === 0 ? 'There are no party members, so there is nothing to share.' : undefined,
  };
}

/**
 * A per-character share with both stages visible: every source component (zeros
 * included), then the rounded-down division as a negative component. The
 * components sum to the share, as the Breakdown invariant requires.
 */
export function shareBreakdown(total: Breakdown, sharers: number): Breakdown {
  const size = Math.max(1, Math.trunc(sharers));
  const share = Math.floor(total.total / size);
  return {
    total: share,
    components: [
      ...total.components,
      {
        label: `Divided among ${size} ${size === 1 ? 'character' : 'characters'} (${total.total.toLocaleString()} / ${size}, rounded down)`,
        value: share - total.total,
      },
    ],
    note: total.note,
  };
}

/** XP for overcoming creatures in a fight, shared evenly (DMG L1938-1940). */
export function fightShare(counted: DmCombatant[], sharers: number): XpAward {
  return xpAward(counted, sharers);
}

// ------------------------------------------------------------ apply / block

/**
 * The replay list as a clean string array. Imported or shared characters can carry
 * any value here, so every read goes through this: non-arrays give [], items that
 * are not valid award IDs are dropped. The list is never trimmed: dropping an old ID
 * would let that award be applied twice (an ID never double-applies).
 */
export function appliedAwardIds(character: Character): string[] {
  const raw: unknown = character.advancement?.appliedAwards;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && ID_PATTERN.test(x));
}

function recordId(character: Character, id: string): Character {
  const existing = appliedAwardIds(character);
  return {
    ...character,
    advancement: { ...character.advancement, appliedAwards: [...existing, id] },
  };
}

/**
 * Why an award may not be applied to this sheet, or null when it may (or when the
 * result is a plain outcome: a repeat or a no-change). Check order: repeat ID,
 * no change, multiclass, milestone.
 */
export function awardBlocker(character: Character, award: AwardPayload): ApplyOutcome | null {
  if (appliedAwardIds(character).includes(award.id)) return null;
  if (award.kind === 'level' && clampLevel(character.level) >= award.amount) return null;
  if (award.kind === 'level' && (character.classes?.length ?? 0) > 1) return 'multiclass-unsupported';
  if (award.kind === 'level') {
    // setLevel writes the new level into classes[0]; without exactly one class there is nothing to raise.
    if ((character.classes?.length ?? 0) !== 1) return 'class-required';
    // A stored HP maximum (manual override) or a legacy rolled-HP total does not grow when the level
    // rises, and no fixed per-level gain can be recorded on top of them. Block rather than skip the HP.
    const manualMax = typeof character.hpMax === 'number' && Number.isFinite(character.hpMax);
    const legacyRolled =
      character.houseRules?.rolledHp === true &&
      typeof character.rolledHpTotal === 'number' &&
      Number.isFinite(character.rolledHpTotal);
    if (manualMax || legacyRolled) return 'hp-unsupported';
  }
  if (award.kind === 'xp' && levelingMode(character) !== 'xp' && clampLevel(character.level) > 1) {
    return 'milestone-blocked';
  }
  // An XP-mode sheet above level 1 with no stored XP has no baseline: adding the award to an implied 0
  // would leave the total below the next threshold, so the player must enter their XP first.
  if (award.kind === 'xp' && levelingMode(character) === 'xp' && clampLevel(character.level) > 1) {
    const stored: unknown = character.advancement?.leveling?.xp;
    if (typeof stored !== 'number' || !Number.isFinite(stored)) return 'xp-baseline-missing';
  }
  return null;
}

function awardReason(award: AwardPayload): string {
  return award.label === '' ? 'DM award' : `DM award: ${award.label}`;
}

export function applyAward(
  character: Character,
  award: AwardPayload,
  now: number,
): { character: Character; outcome: ApplyOutcome } {
  if (appliedAwardIds(character).includes(award.id)) {
    return { character, outcome: 'already-applied' };
  }
  if (award.kind === 'level' && clampLevel(character.level) >= award.amount) {
    return { character: recordId(character, award.id), outcome: 'no-change' };
  }
  const blocker = awardBlocker(character, award);
  if (blocker !== null) return { character, outcome: blocker };

  let next: Character;
  if (award.kind === 'xp') {
    next = awardXp(character, award.amount, awardReason(award), now);
    // Level 1 exception: recorded XP only counts in XP mode, and at level 1 the threshold is 0.
    if (next.advancement?.leveling && next.advancement.leveling.mode !== 'xp') {
      next = {
        ...next,
        advancement: { ...next.advancement, leveling: { ...next.advancement.leveling, mode: 'xp' } },
      };
    }
  } else {
    const maxBefore = hitPointMaxOf(character);
    next = setLevel(character, award.amount);
    // DMG 2024 "Leveling Up": current and maximum HP rise together outside a Long Rest, so
    // a stored current HP gains the same amount as the maximum (never above the new maximum).
    // The gain goes through the healing writer so a character at 0 HP clears death saves and
    // Stable like any other healing. A dead character (explicit flag) gets no HP change: the
    // rulebooks do not say a level award revives, so the level rises and the life state stays.
    const maxAfter = hitPointMaxOf(next);
    if (maxBefore !== undefined && maxAfter !== undefined && maxAfter > maxBefore && next.currentHp !== undefined && Number.isFinite(next.currentHp)) {
      const healed = applyHealingToCharacter(next, maxAfter - maxBefore);
      if (healed) next = healed.character;
    }
    next = appendLogEntry(next, {
      timestamp: now,
      kind: 'level-up',
      level: award.amount,
      detail: `Level ${award.amount}: ${awardReason(award)}`,
    });
  }

  return { character: recordId(next, award.id), outcome: 'applied' };
}

// ------------------------------------------------------------------ preview

export interface AwardPreview {
  memberId: string;
  name: string;
  currentLevel: number;
  /** False for a manual member: current and new XP are null, the delta and a direct level result are known. */
  xpTracked: boolean;
  blocked: ApplyOutcome | null;
  currentXp: Breakdown | null;
  addedXp: Breakdown | null;
  newXp: Breakdown | null;
  reachableLevel: Breakdown | null;
  levelsGained: number;
  unchanged: boolean;
}

/** What one party member would gain. Never throws. */
export function previewAward(member: DmPartyMember, award: AwardPayload): AwardPreview {
  const base = {
    memberId: member.id,
    name: member.name,
    blocked: null as ApplyOutcome | null,
    currentXp: null as Breakdown | null,
    addedXp: null as Breakdown | null,
    newXp: null as Breakdown | null,
    reachableLevel: null as Breakdown | null,
    levelsGained: 0,
    unchanged: false,
  };
  const character = member.source === 'imported' ? member.character : undefined;
  const storedXp: unknown = character?.advancement?.leveling?.xp;
  const hasXp = character !== undefined && typeof storedXp === 'number' && Number.isFinite(storedXp);
  const blocked = character ? awardBlocker(character, award) : null;
  if (!character || !hasXp) {
    // No XP to read (manual member, or a sheet that stores none): current and new XP are unknown,
    // but the intended delta and a direct level result are known.
    const level = clampLevel(character ? character.level : (member.manual?.level ?? 1));
    const added = award.kind === 'xp' ? award.amount : 0;
    const reach = award.kind === 'level' ? Math.max(level, award.amount) : level;
    return {
      ...base,
      blocked,
      currentLevel: level,
      xpTracked: false,
      addedXp: { total: added, components: [{ label: 'Award', value: added }] },
      reachableLevel:
        award.kind === 'level'
          ? {
              total: reach,
              components: [
                { label: 'Current level', value: level },
                { label: 'Levels to the target', value: reach - level },
              ],
              note: `Target level ${award.amount}.`,
            }
          : null,
      levelsGained: reach - level,
      unchanged: award.kind === 'level' && level >= award.amount,
    };
  }
  const currentLevel = clampLevel(character.level);
  // A blocked sheet keeps its values: they show what the award would do, and the blocker says why it will not.
  const xp = storedXp as number;
  const added = award.kind === 'xp' ? award.amount : 0;
  const newXp = xp + added;
  const reach = award.kind === 'xp' ? Math.max(currentLevel, xpToLevel(newXp)) : Math.max(currentLevel, award.amount);
  const gained = reach - currentLevel;
  return {
    ...base,
    blocked,
    currentLevel,
    xpTracked: true,
    currentXp: { total: xp, components: [{ label: 'Recorded XP', value: xp }] },
    addedXp: { total: added, components: [{ label: 'Award', value: added }] },
    newXp: {
      total: newXp,
      components: [
        { label: 'Current XP', value: xp },
        { label: 'Award', value: added },
        { label: 'Bonus', value: 0 },
      ],
    },
    reachableLevel: {
      total: reach,
      components: [
        { label: 'Current level', value: currentLevel },
        { label: award.kind === 'xp' ? 'Levels the new XP total reaches' : 'Levels to the target', value: gained },
      ],
      note:
        award.kind === 'xp'
          ? `${newXp.toLocaleString()} XP reaches level ${xpToLevel(newXp)}: the level ${xpToLevel(newXp)} threshold is ${xpForLevel(xpToLevel(newXp)).toLocaleString()} XP` +
            (xpToLevel(newXp) < 20 ? ` and the level ${xpToLevel(newXp) + 1} threshold is ${xpForLevel(xpToLevel(newXp) + 1).toLocaleString()} XP` : '') +
            ' (PHB 2024 "Character Advancement").'
          : `Target level ${award.amount}.`,
    },
    levelsGained: gained,
    unchanged: award.kind === 'level' && currentLevel >= award.amount,
  };
}
