import { useCallback, useEffect, useState } from 'react';
import { ROLLING_HOUSE_RULE_IDS } from '../logic/house-rule-rolling';
import type { RollingHouseRuleId } from '../logic/house-rule-rolling';

/**
 * Which optional house-rule ability-score rolling methods are enabled.
 *
 * These are offered in the character creation wizard, which runs BEFORE a
 * character exists, so they cannot live on `Character.houseRules`. Like the
 * dice-entry preference (useDiceEntryMode) they are stored app-wide in
 * localStorage. Every method is OFF by default (rules-as-written: only the
 * PHB 2024 methods are offered). See src/logic/house-rule-rolling.ts.
 */
export const ROLLING_HOUSE_RULES_KEY = 'dnd-rolling-house-rules';
export const ROLLING_HOUSE_RULES_EVENT = 'dnd-rolling-house-rules-change';

/** Synchronously read the enabled methods; unknown or malformed data reads as none. */
export function getEnabledRollingHouseRules(): RollingHouseRuleId[] {
  try {
    const raw = localStorage.getItem(ROLLING_HOUSE_RULES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return ROLLING_HOUSE_RULE_IDS.filter((id) => parsed.includes(id));
  } catch {
    return [];
  }
}

/** Persist the enabled methods. Safe in private-browsing / quota states. */
export function setEnabledRollingHouseRules(ids: RollingHouseRuleId[]): void {
  try {
    localStorage.setItem(ROLLING_HOUSE_RULES_KEY, JSON.stringify(ids));
  } catch {
    // Ignore: the preference simply will not persist.
  }
}

/** React hook: the enabled methods and a per-method setter, synced across consumers and tabs. */
export function useRollingHouseRules(): {
  enabled: RollingHouseRuleId[];
  setEnabled: (id: RollingHouseRuleId, on: boolean) => void;
} {
  const [enabled, setState] = useState<RollingHouseRuleId[]>(() => getEnabledRollingHouseRules());
  useEffect(() => {
    const sync = () => setState(getEnabledRollingHouseRules());
    window.addEventListener('storage', sync);
    window.addEventListener(ROLLING_HOUSE_RULES_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(ROLLING_HOUSE_RULES_EVENT, sync);
    };
  }, []);
  const setEnabled = useCallback((id: RollingHouseRuleId, on: boolean) => {
    const current = getEnabledRollingHouseRules().filter((x) => x !== id);
    const next = ROLLING_HOUSE_RULE_IDS.filter((x) => x === id ? on : current.includes(x));
    setEnabledRollingHouseRules(next);
    setState(next);
    window.dispatchEvent(new Event(ROLLING_HOUSE_RULES_EVENT));
  }, []);
  return { enabled, setEnabled };
}
