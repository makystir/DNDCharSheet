/**
 * Bonus feats past level 20 (OPT-IN house rule, off by default).
 *
 * PHB 2024 "Bonus Feats at Level 20" (Docs/PlayersHandbook.md L2029-2031): a DM can
 * use feats as advancement after level 20; each character gains one feat of their
 * choice for every 30,000 XP earned above 355,000 XP. Any feat a level 20
 * character qualifies for is allowed (Epic Boon feats are especially suitable).
 *
 * AMBIGUITY (flagged): the PHB gives no rounding rule; this reads "for every 30,000
 * XP" as whole blocks, floor((xp - 355,000) / 30,000). XP exists only in XP leveling
 * mode, so a milestone character has no bonus feats.
 *
 * Kept free of imports from advancement.ts (which calls this) to avoid a cycle; the
 * 355,000 base equals xpForLevel(20) and is pinned by a test.
 */
import type { Character } from '../types/character';

/** XP needed to be level 20 (PHB 2024 "Character Advancement" table, L2005). */
export const BONUS_FEAT_XP_BASE = 355_000;
/** XP per bonus feat above the base (L2031). */
export const BONUS_FEAT_XP_STEP = 30_000;
/** The first synthetic slot level; level 20 is the last real class level. */
export const BONUS_FEAT_FIRST_SLOT_LEVEL = 21;

/** Whether the opt-in house rule is on. */
export function bonusFeatsEnabled(character: Character): boolean {
  return character.houseRules?.bonusFeatsAfter20 === true;
}

/** How many bonus feat slots the character has earned (0 unless the rule is on, level 20 and XP mode). */
export function bonusFeatSlotCount(character: Character): number {
  if (!bonusFeatsEnabled(character)) return 0;
  if (character.level < 20) return 0;
  const leveling = character.advancement?.leveling;
  if (leveling?.mode !== 'xp') return 0;
  const xp = leveling.xp;
  if (xp === undefined || !Number.isFinite(xp)) return 0;
  return Math.max(0, Math.floor((xp - BONUS_FEAT_XP_BASE) / BONUS_FEAT_XP_STEP));
}

/** Synthetic slot levels for the earned bonus feats: 21, 22, ... (empty by default). */
export function bonusFeatSlotLevels(character: Character): number[] {
  const count = bonusFeatSlotCount(character);
  return Array.from({ length: count }, (_, i) => BONUS_FEAT_FIRST_SLOT_LEVEL + i);
}
