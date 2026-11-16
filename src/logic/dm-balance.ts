/**
 * Encounter balance and XP rewards for the Dungeon Master.
 *
 * RULES (Dungeon Master's Guide 2024, chapter 4 "Combat Encounter Difficulty",
 * Docs/DungeonMastersGuide.md L4640-4700):
 *  - Pick a difficulty, then multiply the "XP Budget per Character" for the
 *    party's level by the number of characters. Spend the budget with the XP
 *    values of the creatures, as much as you can without going over.
 *  - There is no encounter multiplier in the 2024 rules: the encounter's XP is
 *    the plain sum of its creatures' XP.
 *  - The "Troubleshooting" notes are advice, so they are shown as notes here.
 *
 * INTERPRETATIONS (the book does not spell these out):
 *  - A party of mixed levels: each character's own budget is added up, which
 *    equals the book's "level x number of characters" when everyone has the same
 *    level.
 *  - Naming where an encounter sits: it "fits" the lowest difficulty whose
 *    budget covers its XP, or is "over" the High budget. The book defines the
 *    three budgets, not labels for an existing encounter.
 *
 * Awarding XP (DMG 2024 "Awarding XP", L1940): the characters divide the total
 * XP of the monsters they overcame evenly. Division rounds down (PHB 2024
 * "Round Down", L255).
 */
import type { DmCombatant } from '../types/dm';
import type { Breakdown } from './breakdown';
import {
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  XP_BUDGET_PER_CHARACTER,
  XP_BY_CR,
  type EncounterDifficulty,
} from '../data/xp-tables';

/** XP for a Challenge Rating as printed ("1/4", "5"), or null when the CR is not in the table. */
export function xpForCr(cr: string | null | undefined): number | null {
  if (cr === null || cr === undefined) return null;
  const key = cr.trim();
  return Object.prototype.hasOwnProperty.call(XP_BY_CR, key) ? XP_BY_CR[key] : null;
}

export interface BudgetMember {
  name: string;
  level: number;
}

function clampLevel(level: number): number {
  return Math.min(20, Math.max(1, Math.trunc(Number.isFinite(level) ? level : 1)));
}

/** The XP budget for a difficulty: one component per character. */
export function xpBudget(members: BudgetMember[], difficulty: EncounterDifficulty): Breakdown {
  const components = members.map((m) => {
    const level = clampLevel(m.level);
    return { label: `${m.name} (level ${level})`, value: XP_BUDGET_PER_CHARACTER[level - 1][difficulty] };
  });
  return {
    total: components.reduce((s, c) => s + c.value, 0),
    components,
    note: `${DIFFICULTY_LABELS[difficulty]} difficulty: the XP Budget per Character for each level, added up.`,
  };
}

export interface EncounterXp {
  /** Sum of the XP of every creature that has a value. */
  total: Breakdown;
  /** Creatures with no XP value yet (not counted). */
  unknown: string[];
}

/** The XP of the monsters in an encounter (player characters are not creatures to spend budget on). */
export function encounterXp(combatants: DmCombatant[]): EncounterXp {
  const monsters = combatants.filter((c) => c.kind === 'monster');
  const known = monsters.filter((c) => typeof c.xp === 'number');
  return {
    total: {
      total: known.reduce((s, c) => s + (c.xp as number), 0),
      components: known.map((c) => ({ label: c.name, value: c.xp as number })),
    },
    unknown: monsters.filter((c) => typeof c.xp !== 'number').map((c) => c.name),
  };
}

export type Fit = EncounterDifficulty | 'over' | 'none';

/** Which budget an encounter's XP fits: the lowest one that covers it. 'none' for no party. */
export function difficultyFit(xp: number, budgets: Record<EncounterDifficulty, number>): Fit {
  if (budgets.high <= 0) return 'none';
  for (const d of DIFFICULTIES) if (xp <= budgets[d]) return d;
  return 'over';
}

export function fitLabel(fit: Fit): string {
  if (fit === 'none') return 'No party to compare with';
  if (fit === 'over') return 'Over the High budget';
  return `Fits the ${DIFFICULTY_LABELS[fit]} budget`;
}

/** Advice from the DMG "Troubleshooting" list that applies to this encounter. */
export function balanceNotes(members: BudgetMember[], combatants: DmCombatant[], crOf: (c: DmCombatant) => number | null): string[] {
  const notes: string[] = [];
  const monsters = combatants.filter((c) => c.kind === 'monster');
  if (members.length > 0 && monsters.length > members.length * 2) {
    const early = members.some((m) => clampLevel(m.level) <= 2);
    notes.push(
      `More than two creatures per character: include fragile creatures that fall quickly${early ? ', especially for level 1 or 2 characters' : ''} (DMG, Many Creatures).`,
    );
  }
  if (members.length > 0) {
    const lowest = Math.min(...members.map((m) => clampLevel(m.level)));
    const strong = monsters.filter((c) => {
      const cr = crOf(c);
      return cr !== null && cr > lowest;
    });
    if (strong.length > 0) {
      notes.push(
        `${[...new Set(strong.map((c) => c.name.replace(/ \d+$/, '')))].join(', ')} ${strong.length === 1 ? 'has' : 'have'} a Challenge Rating above the party's lowest level, so a single action could take out a character (DMG, Powerful Creatures).`,
      );
    }
  }
  if (monsters.some((c) => c.xp === 0)) {
    notes.push('Creatures worth 0 XP should be used sparingly; for many small critters use swarms instead (DMG, CR 0 Creatures).');
  }
  const kinds = new Set(monsters.map((c) => c.sourceLabel));
  if (kinds.size > 3) {
    notes.push(`${kinds.size} different stat blocks: more than two or three can be hard to run, especially complex ones (DMG, Number of Stat Blocks).`);
  }
  return notes;
}

/** Whether a creature's XP counts as overcome: the DM's choice, else when it is dead. */
export function countsForXp(c: DmCombatant): boolean {
  return c.xpCounts ?? c.hp.dead;
}

export interface XpAward {
  /** Total XP of the creatures counted. */
  total: Breakdown;
  /** Each character's equal share, rounded down. */
  share: Breakdown;
}

/**
 * XP for overcoming monsters, divided evenly among the characters (DMG 2024
 * "Awarding XP", L1940), rounded down. NPCs who helped substantially count as
 * party members: include them in `partySize`.
 */
export function xpAward(counted: DmCombatant[], partySize: number): XpAward {
  const withXp = counted.filter((c) => typeof c.xp === 'number');
  const sum = withXp.reduce((s, c) => s + (c.xp as number), 0);
  const size = Math.max(1, Math.trunc(partySize));
  const share = Math.floor(sum / size);
  return {
    total: { total: sum, components: withXp.map((c) => ({ label: c.name, value: c.xp as number })) },
    share: {
      total: share,
      components: [{ label: `${sum} XP divided by ${size} ${size === 1 ? 'character' : 'characters'}, rounded down`, value: share }],
    },
  };
}
