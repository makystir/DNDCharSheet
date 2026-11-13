/*
 * AI portrait prompt for a Companions page record (a creature companion,
 * hireling, NPC party member or sidekick). Flavor only, no rules: it builds a
 * copy-pasteable prompt string from fields that are actually set, like the
 * character prompt in portrait-prompt.ts (whose style, framing and mood
 * options it shares). Pure and deterministic; no network, no AI call.
 */

import { COMPANION_PORTRAIT_MAX_SIDE, PORTRAIT_MAX_SIZE_LABEL } from './portrait';
import {
  DEFAULT_PORTRAIT_FRAMING,
  DEFAULT_PORTRAIT_MOOD,
  DEFAULT_PORTRAIT_STYLE,
  PORTRAIT_MOODS,
  PORTRAIT_STYLES,
} from './portrait-prompt';
import type { PortraitPromptOptions } from './portrait-prompt';

/** What the prompt knows about the subject. Every field is optional except the kind of subject. */
export interface RecordPortraitSubject {
  /** A creature companion or sidekick creature, or a person (hireling, NPC). */
  subject: 'creature' | 'person';
  /** The tracked name (nickname, or the given name). */
  name?: string;
  /** The stat block name, e.g. "Riding Horse" or "Beast of the Land". */
  creatureName?: string;
  /** Size, e.g. "Large". */
  size?: string;
  /** Creature type, e.g. "Beast" or "Fey". */
  creatureType?: string;
  /** Role or kind, e.g. "Skilled hireling", "Healer", "Warrior sidekick". */
  role?: string;
  /** The player's own words about what it looks like. */
  appearance?: string;
  /** Extra fixed flavor lines (e.g. the Primal Companion's primal markings). */
  flavor?: string[];
}

function clean(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** Build the prompt. Options are the same as the character prompt's. */
export function buildRecordPortraitPrompt(subject: RecordPortraitSubject, options: PortraitPromptOptions = {}): string {
  const framing = options.framing ?? DEFAULT_PORTRAIT_FRAMING;
  const style = PORTRAIT_STYLES.find((s) => s.id === (options.style ?? DEFAULT_PORTRAIT_STYLE)) ?? PORTRAIT_STYLES[0];
  const mood = options.mood ?? DEFAULT_PORTRAIT_MOOD;
  const sections: string[] = [];

  sections.push(
    subject.subject === 'creature'
      ? 'Create a portrait of a creature companion from a high-fantasy tabletop role-playing game.'
      : 'Create a character portrait of a non-player character from a high-fantasy tabletop role-playing game.',
  );
  sections.push(`Art style: ${style.sentence}`);

  const who: string[] = [];
  const name = clean(subject.name);
  if (name) who.push(`Name: ${name}.`);
  const kind = [clean(subject.size), clean(subject.creatureType)].filter(Boolean).join(' ');
  const creature = clean(subject.creatureName);
  if (creature && kind) who.push(`It is ${article(kind)} ${kind}: ${article(creature)} ${creature}.`);
  else if (creature) who.push(`It is ${article(creature)} ${creature}.`);
  else if (kind) who.push(`A ${kind.toLowerCase()}.`);
  const role = clean(subject.role);
  if (role) who.push(`Role: ${role}.`);
  for (const line of subject.flavor ?? []) who.push(line);
  const appearance = clean(subject.appearance)?.replace(/\s+/g, ' ');
  if (appearance) who.push(`Appearance: ${appearance.length > 300 ? `${appearance.slice(0, 300).trim()}...` : appearance}`);
  sections.push(who.join(' ') || 'A fantasy companion.');

  const moodSentence = PORTRAIT_MOODS.find((m) => m.id === mood)?.sentence;
  if (moodSentence) sections.push(moodSentence);

  const extra = clean(options.extraDetails);
  if (extra) sections.push(`Additional details: ${extra}`);

  const framingText =
    framing === 'fullBody'
      ? subject.subject === 'creature'
        ? 'Show the whole creature, centered.'
        : 'Show the full figure from head to toe, standing, centered.'
      : 'Frame the head and shoulders, centered.';
  sections.push(
    `Technical requirements: square, approximately ${COMPANION_PORTRAIT_MAX_SIDE}x${COMPANION_PORTRAIT_MAX_SIDE} pixels, ` +
      `exported as JPEG, PNG, or WebP, no larger than ${PORTRAIT_MAX_SIZE_LABEL}. ${framingText} ` +
      'Do not include any text, lettering, words, captions, watermarks, or the prompt itself in the image.',
  );
  sections.push('Avoid: text, watermarks, signatures, extra limbs, distorted anatomy, and modern objects.');
  return sections.join('\n\n');
}
