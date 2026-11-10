/**
 * Deity lookup and character-creation suggestions.
 *
 * Two data sources feed this (neither is a game rule):
 *  - `data/deities.ts`: the 2024 DMG "Gods of Greyhawk" table (27 gods). It wins
 *    for the names, epithets, home planes, worshipers and symbols it prints.
 *  - `data/deity-reference.ts`: the user-supplied deities reference (2014-era
 *    titles, alignments, cleric domains, descriptions) for the Forgotten Realms,
 *    Greyhawk, racial and dragon gods, and Dragonlance.
 *
 * Suggestions are DETERMINISTIC and advisory only: they never set the character's
 * faith, and any god (or a homebrew one) can still be typed in. The 2024 rules let
 * any cleric follow any domain, so the class-to-domain pairings below are a
 * flavor nudge, not a restriction (rules-compliance: no invented mechanics).
 */

import { getClass } from '../data/classes';
import type { TooltipContent } from './tooltip-content';
import { DEITY_LIST, getDeity } from '../data/deities';
import type { DeityData } from '../data/deities';
import {
  ALIGNMENT_CODE_LABEL,
  DEITY_REFERENCE,
  PANTHEON_LABELS,
  getDeityReference,
} from '../data/deity-reference';
import type {
  DeityAlignmentCode,
  DeityDomain,
  DeityPantheon,
  DeityReference,
} from '../data/deity-reference';

// ─── Lookup ──────────────────────────────────────────────────────────────────

/** The reference id for a Greyhawk god the DMG prints under a shorter name. */
const DMG_TO_REFERENCE_ID: Record<string, string> = { cuthbert: 'st-cuthbert' };

/** Everything the app knows about one deity, merged from both sources. */
export interface DeityInfo {
  /** The name to store and show (the DMG's spelling for Greyhawk gods). */
  name: string;
  /** DMG epithet, e.g. "the Radiant Sun". */
  epithet?: string;
  /** Reference title and portfolio. */
  portfolio?: string;
  pantheon: DeityPantheon;
  alignment?: DeityAlignmentCode;
  domains: DeityDomain[];
  homePlane?: string;
  worshippers: string;
  symbol: string;
  description?: string;
}

function mergeInfo(dmg: DeityData | undefined, ref: DeityReference | undefined): DeityInfo | undefined {
  if (!dmg && !ref) return undefined;
  return {
    name: dmg?.name ?? ref!.name,
    epithet: dmg?.epithet,
    portfolio: ref?.title,
    pantheon: ref?.pantheon ?? 'greyhawk',
    alignment: ref?.alignment,
    domains: ref?.domains ?? [],
    homePlane: dmg?.homePlane,
    worshippers: dmg?.worshipers ?? ref!.worshippers,
    symbol: dmg?.symbol ?? ref!.symbol,
    description: ref?.description,
  };
}

/** The DMG catalog id for a reference entry, when the DMG lists that god. */
function dmgIdForReference(refId: string): string {
  return Object.keys(DMG_TO_REFERENCE_ID).find((k) => DMG_TO_REFERENCE_ID[k] === refId) ?? refId;
}

/** Finds a deity by the name typed in the Faith field (case-insensitive). */
export function findDeityInfo(text: string | undefined): DeityInfo | undefined {
  const key = (text ?? '').trim().toLowerCase();
  if (!key) return undefined;
  const dmgByName = DEITY_LIST.find((d) => d.name.toLowerCase() === key);
  const ref = getDeityReference(dmgByName ? (DMG_TO_REFERENCE_ID[dmgByName.id] ?? dmgByName.id) : key);
  const dmg = dmgByName ?? (ref ? getDeity(dmgIdForReference(ref.id)) : undefined);
  return mergeInfo(dmg, ref);
}

/** Every deity name for the Faith suggestion list, with a short label. */
export function allDeityOptions(): { name: string; label: string }[] {
  const options = DEITY_LIST.map((d) => ({ name: d.name, label: `${d.epithet} (Greyhawk)` }));
  for (const r of DEITY_REFERENCE) {
    if (getDeity(dmgIdForReference(r.id))) continue; // already listed from the DMG
    options.push({ name: r.name, label: `${r.title} (${PANTHEON_LABELS[r.pantheon]})` });
  }
  return options;
}
/** Tooltip content for a deity (used by the Faith hint and the suggestions). */
export function deityTooltip(info: DeityInfo): TooltipContent {
  return {
    title: `${info.name}${info.epithet ? `, ${info.epithet}` : ''}`,
    sections: [
      ...(info.portfolio ? [{ label: 'Portfolio', text: info.portfolio }] : []),
      ...(info.alignment ? [{ label: 'Alignment', text: ALIGNMENT_CODE_LABEL[info.alignment] }] : []),
      ...(info.homePlane ? [{ label: 'Home Plane', text: info.homePlane }] : []),
      { label: 'Typical Worshipers', text: info.worshippers },
      ...(info.symbol ? [{ label: 'Symbol', text: info.symbol }] : []),
      ...(info.domains.length > 0 ? [{ label: 'Domains (flavor)', text: info.domains.join(', ') }] : []),
      { label: 'Pantheon', text: PANTHEON_LABELS[info.pantheon] },
      ...(info.description ? [{ label: 'About', text: info.description }] : []),
    ],
  };
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

/**
 * Cleric domains that fit each class, a flavor pairing for suggestions only.
 * Clerics have none listed: in the 2024 rules a Cleric can follow any god, so
 * their suggestions come from alignment and species.
 */
export const CLASS_DOMAIN_AFFINITY: Record<string, DeityDomain[]> = {
  barbarian: ['War', 'Tempest', 'Nature'],
  bard: ['Knowledge', 'Trickery', 'Light'],
  cleric: [],
  druid: ['Nature', 'Tempest', 'Life'],
  fighter: ['War'],
  monk: ['Knowledge', 'Life'],
  paladin: ['War', 'Life', 'Light'],
  ranger: ['Nature', 'War'],
  rogue: ['Trickery'],
  sorcerer: ['Tempest', 'Light'],
  warlock: ['Death', 'Trickery', 'Knowledge'],
  wizard: ['Knowledge'],
};

const SPECIES_PATTERNS: Record<string, { pattern: RegExp; plural: string }> = {
  dwarf: { pattern: /\bdwarves\b|\bdwarf\b/, plural: 'dwarves' },
  elf: { pattern: /\belves\b|\belf\b/, plural: 'elves' },
  gnome: { pattern: /\bgnomes?\b/, plural: 'gnomes' },
  halfling: { pattern: /\bhalflings?\b/, plural: 'halflings' },
  orc: { pattern: /\borcs?\b/, plural: 'orcs' },
  dragonborn: { pattern: /\bdragonborn\b/, plural: 'dragonborn' },
};

const METALLIC = new Set(['brass', 'bronze', 'copper', 'gold', 'silver']);
const CHROMATIC = new Set(['black', 'blue', 'green', 'red', 'white']);

type Axis = 'L' | 'N' | 'C';
type Morals = 'G' | 'N' | 'E';

function axes(code: DeityAlignmentCode): { order: Axis; morals: Morals } {
  if (code === 'N') return { order: 'N', morals: 'N' };
  return { order: code[0] as Axis, morals: code[1] as Morals };
}

const NAME_TO_CODE: Record<string, DeityAlignmentCode> = {
  'Lawful Good': 'LG',
  'Neutral Good': 'NG',
  'Chaotic Good': 'CG',
  'Lawful Neutral': 'LN',
  'True Neutral': 'N',
  'Chaotic Neutral': 'CN',
  'Lawful Evil': 'LE',
  'Neutral Evil': 'NE',
  'Chaotic Evil': 'CE',
};

export interface DeitySuggestionInput {
  classId: string;
  speciesId: string;
  /** Species sub-choices (elven lineage, draconic ancestry). */
  speciesChoices?: Record<string, string>;
  /** Alignment as shown in the app, e.g. "Lawful Good"; '' or "Unaligned" for none. */
  alignment?: string;
  /** Limit the suggestions to one pantheon (a setting), or 'all'. */
  pantheon?: DeityPantheon | 'all';
  limit?: number;
}

export interface DeitySuggestion {
  name: string;
  pantheon: DeityPantheon;
  alignment: DeityAlignmentCode;
  portfolio: string;
  symbol: string;
  /** Plain-language reasons, strongest first. */
  reasons: string[];
  score: number;
}

/**
 * Ranks the reference gods for a character. Scoring:
 *  - alignment: +4 for an exact match, +1 when one axis matches. A god whose
 *    morals oppose the character's (good vs evil), and every evil god for a
 *    character who is not evil, are left out.
 *  - class: +2 for each of the god's domains that suits the class (max +4).
 *  - species: +4 for a racial god of the character's people, +2 when the god's
 *    worshippers include them (+2 more for a matching dragon ancestry).
 * Ties break alphabetically so the order is stable.
 */
export function suggestDeities(input: DeitySuggestionInput): DeitySuggestion[] {
  const cls = getClass(input.classId);
  const code = input.alignment ? NAME_TO_CODE[input.alignment] : undefined;
  const mine = code ? axes(code) : undefined;
  const affinity = CLASS_DOMAIN_AFFINITY[input.classId] ?? [];
  const lineage = input.speciesChoices?.elvenLineage;
  const ancestry = input.speciesChoices?.draconicAncestry;
  const speciesRule = SPECIES_PATTERNS[input.speciesId];
  const out: DeitySuggestion[] = [];

  for (const ref of DEITY_REFERENCE) {
    if (input.pantheon && input.pantheon !== 'all' && ref.pantheon !== input.pantheon) continue;
    const god = axes(ref.alignment);
    // Evil gods are only suggested to evil characters; opposed morals never are.
    if (god.morals === 'E' && mine?.morals !== 'E') continue;
    if (mine && ((mine.morals === 'E' && god.morals === 'G') || (mine.morals === 'G' && god.morals === 'E'))) continue;

    let score = 0;
    const reasons: string[] = [];

    if (mine && code) {
      if (mine.order === god.order && mine.morals === god.morals) {
        score += 4;
        reasons.push(`${ALIGNMENT_CODE_LABEL[ref.alignment]} matches your alignment`);
      } else if (mine.order === god.order || mine.morals === god.morals) {
        score += 1;
        reasons.push(`${ALIGNMENT_CODE_LABEL[ref.alignment]} is close to your alignment`);
      }
    }

    const matched = ref.domains.filter((dm) => affinity.includes(dm));
    if (matched.length > 0 && cls) {
      score += Math.min(4, matched.length * 2);
      reasons.push(`${matched.join(' and ')} suits a ${cls.name}`);
    }

    const workers = ref.worshippers.toLowerCase();
    if (speciesRule) {
      const text = workers.replace(/\bdrow\b/g, '');
      if (speciesRule.pattern.test(text)) {
        score += ref.pantheon === 'racial' ? 4 : 2;
        reasons.push(`Worshipped mainly by ${speciesRule.plural}`);
        if (input.speciesId === 'dragonborn' && ancestry) {
          if ((ref.id === 'bahamut' && METALLIC.has(ancestry)) || (ref.id === 'tiamat' && CHROMATIC.has(ancestry))) {
            score += 2;
            reasons.push(`Fits your ${ancestry} draconic ancestry`);
          }
        }
      }
    }
    if (input.speciesId === 'elf' && lineage === 'drow' && /\bdrow\b/.test(workers)) {
      score += 4;
      reasons.push('Worshipped mainly by drow');
    }

    if (score > 0) {
      out.push({
        name: findDeityInfo(ref.name)?.name ?? ref.name,
        pantheon: ref.pantheon,
        alignment: ref.alignment,
        portfolio: ref.title,
        symbol: ref.symbol,
        reasons,
        score,
      });
    }
  }

  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return out.slice(0, input.limit ?? 6);
}
