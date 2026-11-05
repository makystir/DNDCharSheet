import type { Character } from '../../types/character';
import { NAV_ITEMS, visibleNavItems } from '../../components/layout/navItems';
import type { PageSection } from '../../components/layout/navItems';
import { CONDITIONS } from '../../data/conditions';
import { fuzzyMatch } from './fuzzyMatch';

// ─── Search Index (D&D 5.5e / 2024) ───────────────────────────────────────────
//
// FRAMEWORK ported from PWACharSheet's command-palette/searchIndex.ts (the
// SearchableEntity / scoring / grouping machinery is system-agnostic); the
// ENTRIES are D&D-specific:
//   - a "Go to <page>" navigation command per visible PageSection (Spells is
//     gated on isSpellcaster via visibleNavItems — the same filter the nav
//     uses, so no dead 'spells' command is offered to a non-caster), and
//   - a small set of app actions, and
//   - D&D condition reference entries (paraphrased content already in the repo;
//     no verbatim rulebook transcription — this is app-level search).

// ─── Entity Types ────────────────────────────────────────────────────────────

export type EntityType = 'page' | 'action' | 'condition';

// ─── Display Data Interfaces ─────────────────────────────────────────────────

export interface PageDisplayData {
  type: 'page';
  /** The page this command navigates to. */
  page: PageSection;
  hint?: string;
}

export interface ActionDisplayData {
  type: 'action';
  /** A stable action key the palette consumer dispatches. */
  action: string;
  description: string;
}

export interface ConditionDisplayData {
  type: 'condition';
  description: string;
  effects: string;
  endsWhen: string;
}

export type EntityDisplayData =
  | PageDisplayData
  | ActionDisplayData
  | ConditionDisplayData;

// ─── Searchable Entity ───────────────────────────────────────────────────────

export interface SearchableEntity {
  id: string;
  name: string;
  type: EntityType;
  searchText: string; // pre-computed: name + description concatenated, lowercased
  displayData: EntityDisplayData;
}

// ─── Mapper Helpers ────────────────────────────────────────────────────────

function safe(value: string | undefined | null): string {
  return value ?? '';
}

// ─── Page navigation commands ────────────────────────────────────────────────

/**
 * The "Go to <page>" commands for the character currently loaded. Built from
 * the SAME visibleNavItems filter the Navigation uses, so a non-caster is never
 * offered a dead 'spells' command (integration point 1). When no character is
 * loaded, every unconditional page is still offered.
 */
function buildPageEntries(character: Character | undefined): SearchableEntity[] {
  const items = visibleNavItems(character);
  return items.map((item) => ({
    id: `page-${item.id}`,
    name: `Go to ${item.label}`,
    type: 'page' as const,
    searchText: `go to ${item.label} ${safe(item.subTabHint)}`.toLowerCase(),
    displayData: {
      type: 'page',
      page: item.id,
      hint: item.subTabHint,
    },
  }));
}

// ─── App action commands ──────────────────────────────────────────────────────

interface ActionDef {
  action: string;
  name: string;
  description: string;
}

/**
 * App-level actions the palette can run. Kept small and app-appropriate (no
 * rules math). The palette consumer maps `action` to the real handler.
 */
const ACTION_DEFS: ActionDef[] = [
  {
    action: 'toggle-theme',
    name: 'Toggle theme',
    description: 'Switch between the dark and light colour themes.',
  },
  {
    action: 'manage-characters',
    name: 'Manage characters',
    description: 'Open the character manager to switch, rename, duplicate, or create a character.',
  },
  {
    action: 'open-settings',
    name: 'Open settings',
    description: 'Go to the Settings page for theme, backups, import, and export.',
  },
];

function buildActionEntries(): SearchableEntity[] {
  return ACTION_DEFS.map((def) => ({
    id: `action-${def.action}`,
    name: def.name,
    type: 'action' as const,
    searchText: `${def.name} ${def.description}`.toLowerCase(),
    displayData: {
      type: 'action',
      action: def.action,
      description: def.description,
    },
  }));
}

// ─── Condition reference entries ──────────────────────────────────────────────

function buildConditionEntries(): SearchableEntity[] {
  return CONDITIONS.map((condition) => {
    const name = safe(condition.name);
    const description = safe(condition.description);
    const effects = condition.effects.join(' ');
    return {
      id: `condition-${condition.id}`,
      name,
      type: 'condition' as const,
      searchText: `${name} ${description} ${effects}`.toLowerCase(),
      displayData: {
        type: 'condition',
        description,
        effects,
        endsWhen: safe(condition.endsWhen),
      },
    };
  });
}

// ─── Search Result Types ─────────────────────────────────────────────────────

export interface SearchResultEntry {
  entity: SearchableEntity;
  score: number;
  nameMatchRanges: [number, number][];
}

export interface GroupedResults {
  groups: ResultGroup[];
  totalCount: number;
}

export interface ResultGroup {
  type: EntityType;
  label: string;
  entries: SearchResultEntry[];
}

// ─── Build Search Index ──────────────────────────────────────────────────────

/**
 * Build the full searchable index. The page commands depend on the active
 * character (Spells is gated on isSpellcaster), so the character is threaded in;
 * actions and conditions are character-independent.
 */
export function buildSearchIndex(character?: Character): SearchableEntity[] {
  return [
    ...buildPageEntries(character),
    ...buildActionEntries(),
    ...buildConditionEntries(),
  ];
}

// ─── Search Execution ────────────────────────────────────────────────────────

const GROUP_ORDER: { type: EntityType; label: string }[] = [
  { type: 'page', label: 'Pages' },
  { type: 'action', label: 'Actions' },
  { type: 'condition', label: 'Conditions' },
];

export function searchEntities(
  index: SearchableEntity[],
  query: string,
  maxResults = 50,
): GroupedResults {
  const normalizedQuery = query.toLowerCase().trim();

  if (normalizedQuery.length === 0) {
    return { groups: [], totalCount: 0 };
  }

  // Score all entries against the query
  const scored: SearchResultEntry[] = [];

  for (const entity of index) {
    // Match against name with 2x score multiplier
    const nameMatch = fuzzyMatch(normalizedQuery, entity.name.toLowerCase());
    // Match against searchText (which already includes name + description, lowercased)
    const textMatch = fuzzyMatch(normalizedQuery, entity.searchText);

    // Take the higher score
    let bestScore: number | null = null;
    let nameMatchRanges: [number, number][] = [];

    if (nameMatch && textMatch) {
      const nameScore = nameMatch.score * 2;
      if (nameScore >= textMatch.score) {
        bestScore = nameScore;
        nameMatchRanges = nameMatch.ranges;
      } else {
        bestScore = textMatch.score;
        // If text match is better, still try to get name ranges for highlighting
        nameMatchRanges = nameMatch.ranges;
      }
    } else if (nameMatch) {
      bestScore = nameMatch.score * 2;
      nameMatchRanges = nameMatch.ranges;
    } else if (textMatch) {
      bestScore = textMatch.score;
      nameMatchRanges = [];
    }

    if (bestScore !== null) {
      scored.push({ entity, score: bestScore, nameMatchRanges });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Cap at maxResults
  const capped = scored.slice(0, maxResults);

  // Group by entity type in fixed order
  const groups: ResultGroup[] = [];

  for (const { type, label } of GROUP_ORDER) {
    const entries = capped.filter((entry) => entry.entity.type === type);
    if (entries.length > 0) {
      groups.push({ type, label, entries });
    }
  }

  return { groups, totalCount: capped.length };
}

// Re-export NAV_ITEMS consumers may want alongside the index.
export { NAV_ITEMS };
