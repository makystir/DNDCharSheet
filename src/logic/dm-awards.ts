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
import { appendLogEntry, awardXp, characterXp, levelingMode, setLevel, xpForLevel, xpToLevel } from './advancement';
import { xpAward, xpBudget, type BudgetMember, type XpAward } from './dm-balance';
import { isGzipSupported } from './gzip';
import { decodeSharePayload, encodeSharePayload } from './share-codec';

// ---------------------------------------------------------------- constants

/** App cap on an XP award: the level 20 threshold (PHB 2024 "Character Advancement"). */
export const MAX_AWARD_XP = xpForLevel(20);
export const MAX_LABEL = 40;
/** DM award history cap per campaign. */
export const MAX_AWARDS = 200;
/** Replay list cap on a character. */
export const MAX_APPLIED = 500;
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
  | 'milestone-blocked';

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
export function milestoneShare(members: BudgetMember[], kind: MilestoneKind): MilestoneShare {
  const difficulty: EncounterDifficulty = kind === 'major' ? 'high' : kind === 'minor' ? 'low' : kind;
  const total = xpBudget(members, difficulty);
  const size = Math.max(1, members.length);
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

/** XP for overcoming creatures in a fight, shared evenly (DMG L1938-1940). */
export function fightShare(counted: DmCombatant[], sharers: number): XpAward {
  return xpAward(counted, sharers);
}

// ------------------------------------------------------------ apply / block

function recordId(character: Character, id: string): Character {
  const existing = character.advancement?.appliedAwards ?? [];
  return {
    ...character,
    advancement: { ...character.advancement, appliedAwards: [...existing, id].slice(-MAX_APPLIED) },
  };
}

/**
 * Why an award may not be applied to this sheet, or null when it may (or when the
 * result is a plain outcome: a repeat or a no-change). Check order: repeat ID,
 * no change, multiclass, milestone.
 */
export function awardBlocker(character: Character, award: AwardPayload): ApplyOutcome | null {
  if (character.advancement?.appliedAwards?.includes(award.id)) return null;
  if (award.kind === 'level' && clampLevel(character.level) >= award.amount) return null;
  if (award.kind === 'level' && (character.classes?.length ?? 0) > 1) return 'multiclass-unsupported';
  if (award.kind === 'xp' && levelingMode(character) !== 'xp' && clampLevel(character.level) > 1) {
    return 'milestone-blocked';
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
  if (character.advancement?.appliedAwards?.includes(award.id)) {
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
    next = appendLogEntry(setLevel(character, award.amount), {
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
  /** False for a manual member: XP is not tracked, so the XP cells are null. */
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
  if (!character) {
    return { ...base, currentLevel: clampLevel(member.manual?.level ?? 1), xpTracked: false };
  }
  const currentLevel = clampLevel(character.level);
  const blocked = awardBlocker(character, award);
  if (blocked !== null) return { ...base, currentLevel, xpTracked: true, blocked };

  const xp = characterXp(character);
  const added = award.kind === 'xp' ? award.amount : 0;
  const newXp = xp + added;
  const reach = award.kind === 'xp' ? Math.max(currentLevel, xpToLevel(newXp)) : Math.max(currentLevel, award.amount);
  const gained = reach - currentLevel;
  return {
    ...base,
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
          ? `${newXp.toLocaleString()} XP reaches level ${xpToLevel(newXp)} (PHB 2024 "Character Advancement").`
          : `Target level ${award.amount}.`,
    },
    levelsGained: gained,
    unchanged: award.kind === 'level' && currentLevel >= award.amount,
  };
}
