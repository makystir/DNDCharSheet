import type { Character } from '../types/character';
import {
  PORTRAIT_RECOMMENDED_WIDTH,
  PORTRAIT_RECOMMENDED_HEIGHT,
  PORTRAIT_MAX_SIZE_LABEL,
} from './portrait';
import { getSpecies } from '../data/species';
import { getClass } from '../data/classes';
import { getBackground } from '../data/backgrounds';
import { DEITY_LIST } from '../data/deities';
import { getWeapon } from '../data/weapons';
import { getArmor } from '../data/armor';

/*
 * AI character-portrait prompt builder (D&D 5.5e app).
 *
 * Ported from the WFRP app's portrait-prompt.ts. Flavor only: it contains no
 * rules mechanics. Pure and deterministic - no RNG, no I/O, no network and no AI
 * call; the app only BUILDS a copy-pasteable prompt string. The prompt is
 * assembled only from fields that are actually set, so it never contains empty
 * placeholders. No background is ever described.
 */

/** How much of the character to show in the image. */
export type PortraitFraming = 'portrait' | 'fullBody';

/** Art-style presets. Each changes only the style sentence of the prompt. */
export type PortraitStyle =
  | 'oilPainting'
  | 'inkWatercolor'
  | 'comic'
  | 'darkFantasy'
  | 'storybook';

/** Expression / mood selector. 'auto' adds nothing beyond personality-derived demeanor. */
export type PortraitMood = 'auto' | 'stern' | 'cheerful' | 'mysterious' | 'weary';

export const PORTRAIT_STYLES: ReadonlyArray<{ id: PortraitStyle; label: string; sentence: string }> = [
  {
    id: 'oilPainting',
    label: 'Fantasy oil painting',
    sentence:
      'Classic fantasy oil painting, painterly brushwork, rich detail, dramatic lighting.',
  },
  {
    id: 'inkWatercolor',
    label: 'Ink & watercolor',
    sentence: 'Ink linework with soft watercolor washes, loose and expressive, on textured paper.',
  },
  {
    id: 'comic',
    label: 'Comic / graphic novel',
    sentence: 'Graphic novel illustration, bold inked outlines, dynamic shading, vivid flat colors.',
  },
  {
    id: 'darkFantasy',
    label: 'Dark-fantasy concept art',
    sentence: 'Dark-fantasy concept art, moody lighting, gritty textures, muted palette.',
  },
  {
    id: 'storybook',
    label: 'Storybook illustration',
    sentence: 'Warm storybook illustration, gentle colors, soft shapes, whimsical charm.',
  },
];

export const PORTRAIT_MOODS: ReadonlyArray<{ id: PortraitMood; label: string; sentence?: string }> = [
  { id: 'auto', label: 'Auto (from personality)' },
  { id: 'stern', label: 'Stern', sentence: 'Expression: stern and resolute.' },
  { id: 'cheerful', label: 'Cheerful', sentence: 'Expression: cheerful, with a warm smile.' },
  { id: 'mysterious', label: 'Mysterious', sentence: 'Expression: mysterious and enigmatic.' },
  { id: 'weary', label: 'Weary', sentence: 'Expression: weary, road-worn, tired eyes.' },
];

export const DEFAULT_PORTRAIT_STYLE: PortraitStyle = 'oilPainting';
export const DEFAULT_PORTRAIT_FRAMING: PortraitFraming = 'portrait';
export const DEFAULT_PORTRAIT_MOOD: PortraitMood = 'auto';

/** Options controlling what the generated portrait prompt includes. */
export interface PortraitPromptOptions {
  /** 'portrait' = head/chest-up bust; 'fullBody' = full-length figure. Default 'portrait'. */
  framing?: PortraitFraming;
  /** Art-style preset. Default 'oilPainting'. */
  style?: PortraitStyle;
  /** Expression selector. Default 'auto'. */
  mood?: PortraitMood;
  /** Optional free text appended verbatim (trimmed). Omitted when empty. */
  extraDetails?: string;
}

/** Trim a value to a clean display string, or return undefined when empty. */
function clean(value: string | undefined | null): string | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Join non-empty parts with a separator, dropping blanks. */
function joinParts(parts: Array<string | undefined>, sep = ', '): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(sep);
}

/** "a"/"an" for the given word. */
function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** The species name, with the lineage appended where one is set (e.g. "High Elf"). */
function speciesLabel(character: Character): string | undefined {
  const sel = character.species;
  if (!sel) return undefined;
  const data = getSpecies(sel.id);
  if (!data) return undefined;
  if (sel.id === 'elf' && sel.elvenLineage) {
    const labels: Record<string, string> = { drow: 'Drow', highElf: 'High Elf', woodElf: 'Wood Elf' };
    return labels[sel.elvenLineage] ?? data.name;
  }
  if (sel.id === 'gnome' && sel.gnomishLineage) {
    return sel.gnomishLineage === 'forest' ? 'Forest Gnome' : 'Rock Gnome';
  }
  return data.name;
}

/** Visible physical cues for a species, written conservatively from set species data only. */
function speciesCues(character: Character): string | undefined {
  const sel = character.species;
  if (!sel || !getSpecies(sel.id)) return undefined;
  const skinSet = !!clean(character.skin);
  switch (sel.id) {
    case 'dragonborn': {
      const colours: Record<string, string> = {
        black: 'black', blue: 'blue', brass: 'brass', bronze: 'bronze', copper: 'copper',
        gold: 'gold', green: 'green', red: 'red', silver: 'silver', white: 'white',
      };
      const colour = sel.draconicAncestry ? colours[sel.draconicAncestry] : undefined;
      return colour && !skinSet
        ? `Draconic features: ${colour} scales, a reptilian snout, and a crest of small horns.`
        : 'Draconic features: scaled skin, a reptilian snout, and a crest of small horns.';
    }
    case 'tiefling': {
      const tints: Record<string, string> = {
        abyssal: 'with greenish undertones',
        chthonic: 'with an ashen pallor',
        infernal: 'with ruddy undertones',
      };
      const tint = !skinSet && sel.fiendishLegacy ? tints[sel.fiendishLegacy] : undefined;
      return joinParts(['Fiendish features: curved horns and a slender pointed tail', tint], ' ') + '.';
    }
    case 'elf':
      return 'Elven features: pointed ears and graceful, fine-boned features.';
    case 'goliath': {
      const marks: Record<string, string> = {
        cloud: 'airy, sky-toned markings',
        fire: 'ember-warm markings',
        frost: 'pale, frosty markings',
        hill: 'earthy, ruddy tones',
        stone: 'grey, stone-like mottling',
        storm: 'faint storm-grey markings',
      };
      const mark = sel.giantAncestry ? marks[sel.giantAncestry] : undefined;
      return joinParts(['Goliath features: towering, powerfully built', mark ? `with ${mark}` : undefined], ' ') + '.';
    }
    case 'dwarf':
      return 'Dwarven features: stocky, broad-shouldered build.';
    case 'halfling':
      return 'Halfling features: small, slight build and round, friendly features.';
    case 'gnome':
      return 'Gnomish features: small stature and bright, curious features.';
    case 'orc':
      return 'Orc features: prominent lower tusks, heavy brow, and a powerful build.';
    case 'aasimar':
      return 'Celestial features: a faint, soft radiance in the eyes.';
    default:
      return undefined;
  }
}

/** Coarse, purely flavor experience tiers derived from character level. */
function experienceTier(level: number): string | undefined {
  if (!Number.isFinite(level) || level < 1) return undefined;
  if (level <= 4) return 'a fresh-faced novice, new to adventuring';
  if (level <= 10) return 'a seasoned adventurer';
  if (level <= 16) return 'a hardened veteran';
  return 'a legendary hero of great renown';
}

/** The "A portrait of ..." sentence plus species cues and the distinctive details. */
function describeAppearance(character: Character): string {
  const gender =
    character.gender === 'male'
      ? 'male'
      : character.gender === 'female'
        ? 'female'
        : character.gender === 'neutral'
          ? 'androgynous'
          : undefined;
  const species = speciesLabel(character);
  const lead = joinParts([gender, species], ' ') || 'fantasy adventurer';

  const age = clean(character.age);
  const height = clean(character.height);
  const weight = clean(character.weight);
  const hair = clean(character.hair);
  const eyes = clean(character.eyes);
  const skin = clean(character.skin);

  const descriptors: string[] = [];
  if (age) descriptors.push(`around ${age} years old`);
  if (height) descriptors.push(`standing ${height}`);
  if (weight) descriptors.push(`weighing about ${weight}`);
  if (hair) descriptors.push(`${hair.toLowerCase()} hair`);
  if (eyes) descriptors.push(`${eyes.toLowerCase()} eyes`);
  if (skin) descriptors.push(`${skin.toLowerCase()} skin`);

  let sentence = `A portrait of ${article(lead)} ${lead}`;
  if (descriptors.length > 0) sentence += `, ${joinParts(descriptors)}`;
  sentence += '.';
  const cues = speciesCues(character);
  if (cues) sentence += ` ${cues}`;
  return sentence;
}

/** Class (+ subclass), experience tier and background for occupation flavor. */
function describeRole(character: Character): string | undefined {
  const classes = (character.classes ?? [])
    .map((entry) => {
      const data = getClass(entry.id);
      if (!data) return undefined;
      const sub = entry.subclassId
        ? data.subclasses.find((s) => s.id === entry.subclassId)?.name
        : undefined;
      return sub ? `${data.name} (${sub})` : data.name;
    })
    .filter((c): c is string => !!c);

  const parts: string[] = [];
  const tier = experienceTier(character.level);
  if (classes.length > 0) {
    parts.push(`${tier ? `${tier}, ` : ''}${joinParts(classes, ' / ')}`.replace(/^./, (c) => c.toUpperCase()));
  } else if (tier) {
    parts.push(tier.replace(/^./, (c) => c.toUpperCase()));
  }

  const bg = getBackground(character.backgroundSelection?.id)?.name;
  const freeBg = clean(character.background);
  const backgrounds = [bg, freeBg && freeBg.toLowerCase() !== bg?.toLowerCase() ? freeBg : undefined];
  const bgText = joinParts(backgrounds, ' / ');
  if (bgText) parts.push(`origin: ${bgText}`);

  return parts.length > 0 ? joinParts(parts) : undefined;
}

/** Resolve an inventory item's display name (custom name wins, then the catalog). */
function itemName(
  item: NonNullable<Character['inventory']>[number],
  lookup: (id: string) => { name: string } | undefined,
): string | undefined {
  return clean(item.name) ?? (item.catalogId ? clean(lookup(item.catalogId)?.name) : undefined);
}

/** Worn armor + shield (equipped slots only). */
function describeArmour(character: Character): string[] {
  const inventory = character.inventory ?? [];
  const out: string[] = [];
  for (const id of [character.equipped?.armorItemId, character.equipped?.shieldItemId]) {
    if (!id) continue;
    const item = inventory.find((i) => i.id === id && i.kind === 'armor');
    const name = item && itemName(item, getArmor);
    if (name) out.push(name);
  }
  return out;
}

/** Equipped weapons; when none are equipped, falls back to carried weapons (first few). */
function describeWeapons(character: Character): string[] {
  const inventory = character.inventory ?? [];
  const equippedIds = character.equipped?.weaponItemIds ?? [];
  const equipped = equippedIds
    .map((id) => inventory.find((i) => i.id === id && i.kind === 'weapon'))
    .filter((i): i is NonNullable<typeof i> => !!i);
  const chosen =
    equipped.length > 0 ? equipped : inventory.filter((i) => i.kind === 'weapon').slice(0, 4);
  return chosen.map((w) => itemName(w, getWeapon)).filter((n): n is string => !!n);
}

/** Spellcasting focus / holy symbol flavor per spellcasting class (cosmetic only). */
const CLASS_FOCUS: Record<string, string> = {
  bard: 'a musical instrument',
  cleric: 'a holy symbol',
  druid: 'a druidic focus of wood and leaves',
  paladin: 'a holy symbol',
  ranger: 'a druidic focus of wood and leaves',
  sorcerer: 'an arcane focus such as a crystal or wand',
  warlock: 'an arcane focus such as a strange trinket or wand',
  wizard: 'an arcane focus such as a staff or wand',
};

/** Faith-related and spellcasting-focus visuals (never requires rendering readable text). */
function describeFaithAndFocus(character: Character): string[] {
  const lines: string[] = [];
  const faith = clean(character.faith);
  const deity = faith
    ? DEITY_LIST.find((d) => d.name.toLowerCase() === faith.toLowerCase())
    : undefined;
  if (deity) {
    lines.push(
      `Wears a holy symbol or emblem depicting: ${deity.symbol.toLowerCase()} (purely pictorial, no lettering).`,
    );
  } else if (faith) {
    lines.push(`Devout follower of ${faith}.`);
  }

  const focuses = (character.classes ?? [])
    .map((c) => CLASS_FOCUS[c.id])
    .filter((f): f is string => !!f);
  const uniqueFocuses = focuses.filter((f, i) => focuses.indexOf(f) === i);
  if (uniqueFocuses.length > 0 && !(deity && uniqueFocuses.every((f) => f === 'a holy symbol'))) {
    lines.push(`Carries ${joinParts(uniqueFocuses, ' and ')}.`);
  }
  return lines;
}

/** Subtle bearing hint from alignment; used only as a fallback when no personality is set. */
function alignmentBearing(character: Character): string | undefined {
  const a = character.alignment;
  if (!a || a === 'Unaligned') return undefined;
  const bits: string[] = [];
  if (a.startsWith('Lawful')) bits.push('a composed, disciplined bearing');
  else if (a.startsWith('Chaotic')) bits.push('a restless, free-spirited bearing');
  if (a.endsWith('Good')) bits.push('a kind gaze');
  else if (a.endsWith('Evil')) bits.push('a cold, guarded gaze');
  return bits.length > 0 ? joinParts(bits, ' and ') : undefined;
}

/** Expression / demeanor section: selected mood plus personality-derived demeanor. */
function describeDemeanor(character: Character, mood: PortraitMood): string | undefined {
  const lines: string[] = [];
  const moodSentence = PORTRAIT_MOODS.find((m) => m.id === mood)?.sentence;
  if (moodSentence) lines.push(moodSentence);
  const personality = clean(character.personality)?.replace(/\s+/g, ' ');
  if (personality) {
    const text = personality.length > 300 ? `${personality.slice(0, 300).trim()}...` : personality;
    lines.push(`Let the expression and demeanor suggest this temperament: ${text}`);
  } else if (mood === 'auto') {
    const bearing = alignmentBearing(character);
    if (bearing) lines.push(`Let the figure carry ${bearing}.`);
  }
  return lines.length > 0 ? lines.join(' ') : undefined;
}

/**
 * Build a copy-pasteable prompt for an AI image generator to produce a fantasy
 * character portrait. The prompt embeds the app's portrait size and file-size
 * requirements and is assembled only from fields that are actually set. Pure and
 * deterministic - no RNG, no I/O.
 */
export function buildPortraitPrompt(
  character: Character,
  options: PortraitPromptOptions = {},
): string {
  const framing = options.framing ?? DEFAULT_PORTRAIT_FRAMING;
  const style = PORTRAIT_STYLES.find((s) => s.id === (options.style ?? DEFAULT_PORTRAIT_STYLE))
    ?? PORTRAIT_STYLES[0];
  const mood = options.mood ?? DEFAULT_PORTRAIT_MOOD;
  const sections: string[] = [];

  sections.push('Create a character portrait of a high-fantasy tabletop role-playing adventurer.');
  sections.push(`Art style: ${style.sentence}`);

  const who: string[] = [];
  const name = clean(character.name);
  if (name) who.push(`Name: ${name}.`);
  who.push(describeAppearance(character));
  const role = describeRole(character);
  if (role) who.push(`${role}.`);
  sections.push(who.join(' '));

  const armour = describeArmour(character);
  const weapons = describeWeapons(character);
  const gearLines: string[] = [];
  if (armour.length > 0) gearLines.push(`Armor: ${joinParts(armour)}.`);
  if (weapons.length > 0) gearLines.push(`Weapons: ${joinParts(weapons)}.`);
  gearLines.push(...describeFaithAndFocus(character));
  if (gearLines.length > 0) {
    sections.push(`Equip the character as follows. ${gearLines.join(' ')}`);
  }

  const demeanor = describeDemeanor(character, mood);
  if (demeanor) sections.push(demeanor);

  const extra = clean(options.extraDetails);
  if (extra) sections.push(`Additional details: ${extra}`);

  // Framing instruction (no background is described - left to the artist/player).
  const framingText =
    framing === 'fullBody'
      ? 'Show the full figure from head to toe, standing, centered.'
      : 'Frame the subject from roughly the waist or chest up, centered.';

  sections.push(
    'Technical requirements: portrait orientation, approximately ' +
      `${PORTRAIT_RECOMMENDED_WIDTH}x${PORTRAIT_RECOMMENDED_HEIGHT} pixels ` +
      `(same aspect ratio is fine), exported as JPEG, PNG, or WebP, no larger than ` +
      `${PORTRAIT_MAX_SIZE_LABEL}. ${framingText} ` +
      'Do not include any text, lettering, words, captions, watermarks, or the prompt ' +
      'itself in the image - the artwork must contain no writing of any kind.',
  );

  sections.push(
    'Avoid: text, watermarks, signatures, extra limbs or fingers, distorted hands, and modern objects.',
  );

  return sections.join('\n\n');
}
