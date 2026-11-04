import { useState } from 'react';
import type { Character } from '../../types/character';
import { awardXp } from '../../logic/advancement';

/**
 * Manages the "award XP" workflow on the Advancement page (Stage A6a).
 *
 * Ported in SHAPE from PWACharSheet's src/components/pages/useXpAward.ts (the
 * amount/reason inputs + an award handler), but adapted to the D&D advancement
 * API and scope:
 *  - D&D `awardXp(character, amount, reason, timestamp)` is a logged, additive
 *    award that also flips the leveling mode to 'xp' and appends an audit-log
 *    entry (never mutates). It only PERMITS a level-up by crossing a threshold;
 *    it never auto-levels (canLevelUp gates that).
 *  - No over-spend "shake/toast" feedback and no per-award removal: XP is never
 *    SPENT in D&D (A6a has no XP cost engine — that was the WFRP model), and the
 *    audit log is cleared wholesale via the log drawer's ConfirmDialog.
 *  - The timestamp comes from an injected clock so the award + its log entry are
 *    deterministic in tests, mirroring the rest of the advancement logic.
 */
export interface UseXpAwardResult {
  xpAwardAmount: string;
  setXpAwardAmount: (v: string) => void;
  xpAwardReason: string;
  setXpAwardReason: (v: string) => void;
  /** Whether the entered amount is a valid positive number (enables Award). */
  canAward: boolean;
  /** Grant the entered XP amount as a logged/audited award. */
  handleAwardXp: () => void;
}

export function useXpAward(
  updateCharacter: (mutator: (char: Character) => Character) => void,
  now: () => number,
): UseXpAwardResult {
  const [xpAwardAmount, setXpAwardAmount] = useState('');
  const [xpAwardReason, setXpAwardReason] = useState('');

  const amount = Number(xpAwardAmount);
  const canAward = Number.isFinite(amount) && amount > 0;

  const handleAwardXp = () => {
    if (!canAward) return;
    const reason = xpAwardReason;
    const timestamp = now();
    updateCharacter((c) => awardXp(c, amount, reason, timestamp));
    setXpAwardAmount('');
    setXpAwardReason('');
  };

  return {
    xpAwardAmount,
    setXpAwardAmount,
    xpAwardReason,
    setXpAwardReason,
    canAward,
    handleAwardXp,
  };
}
