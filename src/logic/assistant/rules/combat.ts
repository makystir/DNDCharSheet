import type { Character } from '../../../types/character';
import { lifeStatus } from '../../hit-points-state';
import { isBloodied } from '../../hit-points-state';
import type { Suggestion } from '../types';

/**
 * At-risk combat-state prompts.
 *
 * REUSES the A5 derived life/HP state — `lifeStatus` and `isBloodied`
 * (hit-points-state.ts) — and reads `character.concentration` (the A5b field) to
 * decide when to surface a prompt. It recomputes no rule: the death-save
 * resolution lives on the Combat page (resolveDeathSave) and the Concentration
 * save DC is computed by the Combat page's Concentration prompt from the damage
 * taken. Both actions NAVIGATE to the Combat surface (the existing,
 * player-confirmed flows); nothing mutates the character.
 *
 * WHY NO SEEDED death-save / Concentration ROLL HERE: the generic B7 RollDialog
 * is a flat d20 with an OPTIONAL DC and no save-specific counters. A Death
 * Saving Throw tallies successes/failures and a Concentration save's DC depends
 * on the damage just taken — both are resolved by dedicated Combat-page
 * controls that already seed their own rolls. Seeding a bare d20 would not match
 * that existing flow, so the prompt navigates to the real control instead of
 * inventing a parallel roll path (rules-compliance rule 1; Stage B8 is a
 * surfacing layer over existing logic).
 *
 * PHB 2024 "Death Saving Throws" (Docs/PlayersHandbook.md L1155-1177) and
 * "Concentration" (L20767-20777).
 */
export function combatSuggestions(character: Character): Suggestion[] {
  const out: Suggestion[] = [];
  const status = lifeStatus(character);

  // At 0 HP making Death Saving Throws — the most urgent prompt. PHB L1155.
  if (status === 'making-death-saves') {
    out.push({
      id: 'combat:death-saves',
      title: 'Making Death Saving Throws',
      rationale:
        'You are at 0 Hit Points and Unconscious. Roll a Death Saving Throw (10 or higher succeeds; three successes stabilize, three failures is death).',
      category: 'combat',
      urgency: 'critical',
      action: { kind: 'navigate', page: 'combat' },
      citation: 'PHB 2024 "Death Saving Throws"',
    });
  }

  // Concentrating while Bloodied — a hit may force a Concentration save. PHB
  // L20775. Only while alive and not already making death saves (that prompt
  // supersedes it).
  if (
    character.concentration !== undefined &&
    status !== 'dead' &&
    status !== 'making-death-saves' &&
    status !== 'stable' &&
    isBloodied(character)
  ) {
    out.push({
      id: 'combat:concentration-at-risk',
      title: 'Concentration at risk',
      rationale:
        'You are concentrating on a spell while Bloodied. Taking damage forces a Constitution saving throw (DC 10 or half the damage, whichever is higher) to maintain Concentration.',
      category: 'combat',
      urgency: 'recommended',
      action: { kind: 'navigate', page: 'combat' },
      citation: 'PHB 2024 "Concentration"',
    });
  }

  return out;
}
