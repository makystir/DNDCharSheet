import { SKILLS } from '../../types/character';
import type {
  SpeciesChoiceOption,
  SpeciesChoiceSpec,
} from '../../data/species';

/** Human-readable size labels. */
export const SIZE_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
};

/**
 * The options a sub-choice presents. Human's Skillful choice has empty data
 * options (any skill), so its list is filled from the SKILLS table here,
 * keeping the data module choice-spec free of the full skill list.
 */
export function choiceOptions(spec: SpeciesChoiceSpec): SpeciesChoiceOption[] {
  if (spec.kind === 'skillfulSkill') {
    return SKILLS.map((s) => ({ id: s.id as string, label: s.name }));
  }
  return spec.options;
}

/**
 * The SRD badge text + hover copy for a class/subclass/species srd flag. A
 * 'non-srd' entry reads 'non-SRD'; anything else ('uncertain') reads 'SRD
 * status unconfirmed'.
 */
/**
 * Title-cases a stored language id for display, e.g. `common-sign-language` ->
 * `Common Sign Language`, `elvish` -> `Elvish`. Stored language ids are
 * lowercase, hyphen-separated (src/logic/languages.ts).
 */
export function formatLanguage(id: string): string {
  return id
    .split('-')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

export function srdBadge(srd: string): { text: string; title: string } {
  return srd === 'non-srd'
    ? {
        text: 'non-SRD',
        title:
          'Not confirmed as SRD content — review licensing before redistributing.',
      }
    : {
        text: 'SRD status unconfirmed',
        title:
          'SRD status unconfirmed — review licensing before redistributing.',
      };
}

/**
 * Parses a numeric input's raw string into a stored value. Empty input and
 * non-finite values become `undefined` (unset) so the breakdown is never
 * poisoned with NaN; otherwise the integer is optionally clamped to >= 0.
 */
export function parseNumberInput(
  raw: string,
  clampNonNegative: boolean,
): number | undefined {
  if (raw.trim() === '') return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return clampNonNegative ? Math.max(0, parsed) : parsed;
}
