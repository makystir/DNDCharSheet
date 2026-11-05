import type { Character } from '../../types/character';
import type { PageSection } from '../../components/layout/navItems';
import type { Breakdown } from '../breakdown';
import type { D20Mode } from '../dice';

/**
 * The pure, deterministic, React-free Character Assistant engine
 * (Stage B8). It emits plain, JSON-serializable Suggestion objects whose
 * `action` is a serializable DESCRIPTOR — never a closure — so an optional
 * async (e.g. LLM-backed) source could later feed the same panel with no UI
 * rewrite. No AI/LLM, no backend, no network, no side effects.
 *
 * FRAMEWORK PORT: the Suggestion / SuggestionAction / SuggestionContext /
 * SuggestionSource boundary and the SuggestionCategory / SuggestionUrgency /
 * SuggestionTotal shapes are ported near-verbatim from PWACharSheet's
 * src/logic/assistant/types.ts. The D&D adaptation swaps the categories to D&D
 * topics, the `navigate` target to the D&D PageSection, the `roll` descriptor
 * to the B7 RollDialog seed shape, and `SuggestionTotal` to carry a plain
 * Breakdown (rendered by the shared CalculatedValue) instead of string lines.
 */

/** Grouping key for a suggestion. Extend by adding a member. */
export type SuggestionCategory =
  | 'combat' // at-risk combat state: 0-HP death saves, broken Concentration
  | 'health' // HP / rest review: low HP with Hit Dice, Exhaustion present
  | 'encumbrance' // carried weight over carrying capacity
  | 'advancement' // ready-to-level, open feat slot, unchosen subclass
  | 'resource'; // spendable / reliability nudges (file backup)

/**
 * Ordering/grouping signal. Lower sorts first within a context.
 * `critical` = act now (making death saves, overburdened);
 * `recommended` = opinionated nudge (ready to level up);
 * `info` = soft reminder (back up your characters).
 */
export type SuggestionUrgency = 'critical' | 'recommended' | 'info';

/**
 * A serializable descriptor the UI interprets to invoke an EXISTING,
 * player-confirmed handler. It is a discriminated union and MUST remain
 * JSON-serializable: no functions, DOM nodes, or class instances. The engine
 * never performs the action — it only describes it.
 */
export type SuggestionAction =
  // Calls the existing navigate(page, subTab) threaded through App.tsx.
  // `page` is a real PageSection; `subTab` is a sub-tab key for that page.
  | { kind: 'navigate'; page: PageSection; subTab?: string | null }
  // Opens the shared B7 RollDialog seeded with a d20 test. The fields mirror
  // RollDialogProps exactly (label / dc / initialMode); the Exhaustion level
  // is read by the shell from the active character (the dialog always takes
  // it), so it is NOT part of the serializable descriptor. No new roll logic
  // is introduced — the dialog resolves through dice.ts / roll-log.ts as today.
  | { kind: 'roll'; label: string; dc?: number; initialMode?: D20Mode }
  // Triggers the EXISTING bulk file export (assembleBackup -> downloadBackup),
  // a user-gesture-initiated download. The engine only DESCRIBES it; the UI
  // dispatcher performs it (B3 backup).
  | { kind: 'backup-file' };

/** A single recommendation. Plain data, JSON-serializable. */
export interface Suggestion {
  /** Stable key for React lists, dedupe, and dismiss/snooze. */
  id: string;
  /** Short human-readable label. */
  title: string;
  /** Brief "why" string; rulebook-cited where it encodes a rule. */
  rationale: string;
  category: SuggestionCategory;
  urgency: SuggestionUrgency;
  action: SuggestionAction;
  /**
   * Optional **secondary** action (e.g. death-saves primary is a seeded save
   * roll, secondary is "view Combat"). Same descriptor union; serializable.
   */
  secondaryAction?: SuggestionAction;
  /**
   * Rulebook citation carried as DATA across the serializable boundary. Each
   * rule module sets the same string as its `// PHB 2024 ...` code comment. The
   * panel renders this source-agnostically.
   */
  citation?: string;
  /**
   * Optional calculated totals this suggestion displays, each with the
   * Breakdown the panel renders through the shared CalculatedValue /Tooltip
   * (calculated-totals steering). Plain data only — the breakdown comes from an
   * existing logic function (e.g. carriedWeightBreakdown), never recomputed in
   * the UI.
   */
  totals?: SuggestionTotal[];
}

export interface SuggestionTotal {
  /** e.g. "Carried weight". */
  label: string;
  /** Rendered value, e.g. "212 / 210 lb". */
  display: string;
  /**
   * The breakdown behind the number — the SAME Breakdown the owning rules
   * function already produced (components sum to total; `note` carries any
   * non-additive fact). Plain, JSON-serializable data.
   */
  breakdown: Breakdown;
}

/**
 * Everything the engine needs beyond the character. Extensible WITHOUT a
 * breaking change: new optional fields only.
 */
export interface SuggestionContext {
  /**
   * Single source of truth: character.combat?.inCombat — the exact signal the
   * Combat tracker owns. The engine reads it from context (not from the
   * character) so the caller owns the one read.
   */
  inCombat: boolean;
  /**
   * Last FILE backup timestamp (ms epoch) or null. Read ONCE by the shell (not
   * the engine) and threaded in so the engine stays pure — the file-backup
   * nudge module reads this instead of calling `getLastBackupAt()` at eval
   * time. Optional ⇒ non-breaking.
   */
  lastBackupAt?: number | null;
  /**
   * Clock snapshot the shell already holds, threaded in so the nudge module
   * performs no `Date.now()` at engine-eval time. Optional ⇒ non-breaking.
   */
  now?: number;
}

/**
 * The boundary the panel consumes. The panel knows nothing about how
 * suggestions are produced.
 *
 * FUTURE-PROOFING: the return type is `Suggestion[] | Promise<Suggestion[]>` so
 * an async source (e.g. LLM-backed) is a NON-BREAKING extension — the
 * deterministic default returns the sync branch and remains the permanent
 * offline fallback. Sync callers narrow with an `Array.isArray` guard; the
 * deterministic default is ALWAYS synchronous, so the guard's sync branch is
 * the only path taken today.
 */
export interface SuggestionSource {
  getSuggestions(
    character: Character | undefined,
    context: SuggestionContext,
  ): Suggestion[] | Promise<Suggestion[]>;
}
