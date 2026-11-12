/**
 * Effects the player tracks during a fight (Bless, Rage, a spell's duration...).
 *
 * BOOKKEEPING ONLY, like the condition durations (logic/condition-duration.ts):
 * the PHB gives every effect its own duration, so the player types the name and
 * the number of rounds, and this module only counts those rounds down and removes
 * the effect when they run out. It never applies what an effect does. A round is
 * about 6 seconds (PHB "The Order of Combat"), so 1 minute is 10 rounds.
 *
 * Every function is pure and returns the input object when nothing changes.
 * Expiry appends a 'effect-expired' event-log entry (category 'combat').
 */

import type { Character, TrackedEffect } from '../types/character';
import { appendEvent } from './event-log';

/** App limits that keep imported / typed values sane (not rules values). */
export const MAX_EFFECTS = 20;
export const MAX_EFFECT_NAME = 60;
export const MAX_EFFECT_NOTE = 200;
export const MAX_EFFECT_ROUNDS = 14400; // 24 hours of rounds

function isRounds(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_EFFECT_ROUNDS;
}

/** The tracked effects of a character (always an array). */
export function trackedEffects(character: Character): TrackedEffect[] {
  return character.effects ?? [];
}

function withEffects(character: Character, effects: TrackedEffect[]): Character {
  if (effects.length === 0) {
    const { effects: _removed, ...rest } = character;
    void _removed;
    return rest;
  }
  return { ...character, effects };
}

export interface NewEffect {
  name: string;
  /** Remaining rounds (>= 1), or undefined for an effect with no timer. */
  rounds?: number;
  note?: string;
}

/**
 * Add an effect. Returns the character unchanged for a blank name, an invalid
 * round count, or when the list is full.
 */
export function addEffect(character: Character, input: NewEffect, id: string): Character {
  const name = input.name.trim().slice(0, MAX_EFFECT_NAME);
  if (name === '') return character;
  if (input.rounds !== undefined && !isRounds(input.rounds)) return character;
  const list = trackedEffects(character);
  if (list.length >= MAX_EFFECTS) return character;
  const effect: TrackedEffect = { id, name };
  if (input.rounds !== undefined) effect.rounds = input.rounds;
  const note = input.note?.trim().slice(0, MAX_EFFECT_NOTE);
  if (note) effect.note = note;
  return withEffects(character, [...list, effect]);
}

/** Remove an effect by id. */
export function removeEffect(character: Character, id: string): Character {
  const list = trackedEffects(character);
  if (!list.some((e) => e.id === id)) return character;
  return withEffects(
    character,
    list.filter((e) => e.id !== id),
  );
}

export interface EffectTickResult {
  character: Character;
  /** Names of the effects that ran out. */
  expired: string[];
}

function expire(character: Character, gone: TrackedEffect[]): Character {
  let next = character;
  for (const e of gone) {
    next = appendEvent(next, {
      category: 'combat',
      type: 'effect-expired',
      summary: `${e.name} ended: its duration ran out.`,
      payload: { effectId: e.id },
    });
  }
  return next;
}

/** Take `rounds` off every effect that has a timer; remove those that reach 0. */
export function advanceEffects(character: Character, rounds = 1): EffectTickResult {
  if (!Number.isInteger(rounds) || rounds < 1) return { character, expired: [] };
  const list = trackedEffects(character);
  if (!list.some((e) => e.rounds !== undefined)) return { character, expired: [] };
  const ticked = list.map((e) =>
    e.rounds === undefined ? e : { ...e, rounds: Math.max(0, e.rounds - rounds) },
  );
  const gone = ticked.filter((e) => e.rounds === 0);
  const kept = ticked.filter((e) => e.rounds !== 0);
  return {
    character: expire(withEffects(character, kept), gone),
    expired: gone.map((e) => e.name),
  };
}

/** Take one round off a single effect (a manual correction); removes it at 0. */
export function tickEffect(character: Character, id: string): EffectTickResult {
  const list = trackedEffects(character);
  const target = list.find((e) => e.id === id);
  if (!target || target.rounds === undefined) return { character, expired: [] };
  if (target.rounds - 1 <= 0) {
    return {
      character: expire(
        withEffects(
          character,
          list.filter((e) => e.id !== id),
        ),
        [target],
      ),
      expired: [target.name],
    };
  }
  return {
    character: withEffects(
      character,
      list.map((e) => (e.id === id ? { ...e, rounds: target.rounds! - 1 } : e)),
    ),
    expired: [],
  };
}

/** Add one round back to a single effect (undo a mistaken tick). */
export function extendEffect(character: Character, id: string): Character {
  const list = trackedEffects(character);
  const target = list.find((e) => e.id === id);
  if (!target || target.rounds === undefined || target.rounds + 1 > MAX_EFFECT_ROUNDS) return character;
  return withEffects(
    character,
    list.map((e) => (e.id === id ? { ...e, rounds: target.rounds! + 1 } : e)),
  );
}

/**
 * A clean copy of an untrusted `effects` value: at most MAX_EFFECTS entries, each
 * with a string id and name (trimmed, bounded), a valid optional `rounds`, and a
 * bounded optional `note`. Anything else is dropped. Returns undefined when
 * nothing valid is left (the caller deletes the field).
 */
export function sanitizeEffects(value: unknown): TrackedEffect[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const out: TrackedEffect[] = [];
  for (const raw of value) {
    if (out.length >= MAX_EFFECTS) break;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || r.id === '' || r.id.length > 80 || seen.has(r.id)) continue;
    if (typeof r.name !== 'string') continue;
    const name = r.name.trim().slice(0, MAX_EFFECT_NAME);
    if (name === '') continue;
    const effect: TrackedEffect = { id: r.id, name };
    if (isRounds(r.rounds)) effect.rounds = r.rounds;
    if (typeof r.note === 'string' && r.note.trim() !== '') {
      effect.note = r.note.trim().slice(0, MAX_EFFECT_NOTE);
    }
    seen.add(r.id);
    out.push(effect);
  }
  return out.length > 0 ? out : undefined;
}
