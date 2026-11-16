import { useRef, useState } from 'react';
import type { Character } from '../../types/character';
import { applyAward, decodeAward, type ApplyOutcome, type AwardPayload } from '../../logic/dm-awards';

/**
 * The "paste an award code" workflow on the Advancement page (Stage 8).
 * Check decodes the code and shows a preview; Apply hands the updated character
 * to `onChange` once; Cancel clears the preview without changing anything.
 */
export interface UseAwardRedeemResult {
  text: string;
  setText: (v: string) => void;
  /** The decoded award being previewed, if any. */
  award: AwardPayload | null;
  /** Why the last Check failed. */
  error: string | null;
  /** What the last Apply did. */
  result: string | null;
  check: () => Promise<void>;
  apply: () => void;
  cancel: () => void;
}

export const OUTCOME_TEXT: Record<ApplyOutcome, string> = {
  applied: 'Award applied.',
  'already-applied': 'You already applied this award.',
  'no-change': 'Nothing to change: your level is already at or above that level.',
  'multiclass-unsupported': 'This sheet has more than one class. Use the Advancement page to level each class.',
  'milestone-blocked':
    'This sheet levels by milestone. Switch to XP leveling and enter your current XP on the Advancement page first, then apply this code.',
  'xp-baseline-missing':
    'This sheet uses XP leveling but has no XP recorded. Enter your current XP on the Advancement page first, then apply this code.',
};

export function useAwardRedeem(
  character: Character,
  onChange: (next: Character) => void,
  now: () => number,
): UseAwardRedeemResult {
  const [text, setTextRaw] = useState('');
  const [award, setAward] = useState<AwardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  // Editing the text invalidates any earlier Check, so Apply can never use a stale award.
  const latestText = useRef('');
  const setText = (v: string) => {
    latestText.current = v;
    setTextRaw(v);
    setAward(null);
    setError(null);
    setResult(null);
  };

  const check = async () => {
    setResult(null);
    const checkedText = text;
    const decoded = await decodeAward(checkedText);
    if (latestText.current !== checkedText) return; // edited while decoding
    if (!decoded.ok) {
      setAward(null);
      setError(decoded.error);
      return;
    }
    setError(null);
    setAward(decoded.award);
  };

  const apply = () => {
    if (!award) return;
    const outcome = applyAward(character, award, now());
    if (outcome.outcome === 'applied' || outcome.outcome === 'no-change') onChange(outcome.character);
    setResult(OUTCOME_TEXT[outcome.outcome]);
    if (outcome.outcome === 'applied' || outcome.outcome === 'no-change' || outcome.outcome === 'already-applied') {
      setAward(null);
      latestText.current = '';
      setTextRaw('');
    }
  };

  const cancel = () => {
    setAward(null);
    setError(null);
    setResult(null);
  };

  return { text, setText, award, error, result, check, apply, cancel };
}
