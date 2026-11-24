import type { DmCampaign, DmCombatant, DmEncounter } from '../types/dm';
import { memberStats } from './dm-campaign';
import { difficultyFit, encounterXp, fitLabel, xpBudget, type BudgetMember } from './dm-balance';
import { DIFFICULTIES } from '../data/xp-tables';

/** Budget for the characters in a fight, or the whole party until some are added. */
export function budgetMembersFor(campaign: DmCampaign, combatants: DmCombatant[]): BudgetMember[] {
  const inFight: BudgetMember[] = combatants.flatMap((c) => {
    const m = c.kind === 'pc' && c.memberId ? campaign.party.find((p) => p.id === c.memberId) : undefined;
    const s = m ? memberStats(m) : undefined;
    return s ? [{ name: c.name, level: s.level }] : [];
  });
  if (inFight.length > 0) return inFight;
  return campaign.party.flatMap((m) => {
    const s = memberStats(m);
    return s ? [{ name: m.name, level: s.level }] : [];
  });
}

/** Encounter XP and where it sits against the DMG 2024 budgets (same math as the balance card). */
export function encounterSummary(campaign: DmCampaign, e: DmEncounter) {
  const xpBreakdown = encounterXp(e.combatants).total;
  const xp = xpBreakdown.total;
  const [low, moderate, high] = DIFFICULTIES.map((d) => xpBudget(budgetMembersFor(campaign, e.combatants), d).total);
  return { xp, xpBreakdown, fit: fitLabel(difficultyFit(xp, { low, moderate, high })) };
}
