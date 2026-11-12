import type { Character } from '../../../types/character';
import { hpStateOf, isBloodied, lifeStatus } from '../../hit-points-state';
import { hitDiceAvailable } from '../../rests';
import { exhaustionLevelOf } from '../../conditions';
import type { Suggestion } from '../types';

/**
 * Rest / recovery reminders.
 *
 * REUSES the A5 derived state — `isBloodied` / `lifeStatus` / `hpStateOf`
 * (hit-points-state.ts), `hitDiceAvailable` (rests.ts) and `exhaustionLevelOf`
 * (conditions.ts) — so it never recomputes HP, the Bloodied threshold, Hit
 * Dice, or Exhaustion. It emits soft reminders only; both actions NAVIGATE to
 * the Character Overview (where the Rest card lives) and nothing mutates the
 * character.
 *
 * The 0-HP / death-save state is owned by the combat module (a critical nudge),
 * so this module stays silent while making death saves or dead to avoid a
 * duplicate prompt.
 *
 * PHB 2024 "Hit Points" (Docs/PlayersHandbook.md L1073-1079, Bloodied = half or
 * fewer), "Short Rest" (L21475-21490, spend Hit Dice to regain HP) and
 * "Exhaustion" (L21018-21028, a Long Rest removes 1 level).
 */
export function restSuggestions(character: Character): Suggestion[] {
  const status = lifeStatus(character);
  if (status === 'dead' || status === 'making-death-saves' || status === 'stable') {
    return []; // the combat module owns the at-risk prompts
  }

  const out: Suggestion[] = [];

  // Low HP with Hit Dice to spend ⇒ a Short Rest can heal. PHB L1079 / L21481.
  const state = hpStateOf(character);
  if (state && isBloodied(character) && hitDiceAvailable(character) > 0) {
    out.push({
      id: 'rest:short-rest-hp',
      title: 'Low on Hit Points',
      rationale:
        'You are Bloodied (half your Hit Point maximum or fewer) and have Hit Dice to spend — a Short Rest can restore Hit Points.',
      category: 'health',
      urgency: 'recommended',
      action: { kind: 'navigate', page: 'character', subTab: 'identity' },
      citation: 'PHB 2024 "Short Rest"',
    });
  }

  // Exhaustion present ⇒ a Long Rest removes 1 level. PHB L21028.
  const exhaustion = exhaustionLevelOf(character);
  if (exhaustion > 0) {
    out.push({
      id: 'rest:exhaustion',
      title:
        exhaustion >= 5
          ? `Exhaustion level ${exhaustion} — dangerously high`
          : `Exhaustion level ${exhaustion}`,
      rationale:
        'You have the Exhaustion condition (−2 × level on D20 Tests, −5 ft × level Speed). A Long Rest removes 1 level.',
      category: 'health',
      urgency: exhaustion >= 5 ? 'critical' : 'info',
      action: { kind: 'navigate', page: 'character', subTab: 'identity' },
      citation: 'PHB 2024 "Exhaustion"',
    });
  }

  return out;
}
