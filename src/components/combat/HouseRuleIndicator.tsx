import { AlertTriangle } from 'lucide-react';
import type { HouseRules } from '../../types/character';
import styles from './HouseRuleIndicator.module.css';

/**
 * A compact, READ-ONLY indicator listing the opt-in house rules currently in
 * effect, ported in spirit from PWACharSheet's HouseRuleIndicator. Parity note:
 * the PWA lists WFRP combat variants (ranged SB, min-1-wound, etc.); the D&D
 * sheet has exactly two documented optional/variant rules — rolled HP and
 * variant encumbrance — so this reports those.
 *
 * rules-compliance: this component computes no mechanics. It only reports which
 * optional rules (PHB 2024 "Optional Rule" sidebars — see HouseRules in
 * types/character.ts) diverge from rules-as-written. It renders nothing when
 * both rules are at their default (off).
 */

export interface HouseRuleIndicatorProps {
  houseRules?: HouseRules;
}

interface ActiveRule {
  label: string;
  detail: string;
}

function collectActiveRules(hr: HouseRules | undefined): ActiveRule[] {
  const active: ActiveRule[] = [];
  if (hr?.rolledHp) {
    active.push({
      label: 'Rolled HP',
      detail: 'HP gained per level is rolled instead of the fixed value',
    });
  }
  if (hr?.variantEncumbrance) {
    active.push({
      label: 'Variant Encumbrance',
      detail: 'Encumbered / Heavily Encumbered Speed penalties apply',
    });
  }
  return active;
}

export function HouseRuleIndicator({ houseRules }: HouseRuleIndicatorProps) {
  const activeRules = collectActiveRules(houseRules);
  if (activeRules.length === 0) return null;

  return (
    <div className={styles.indicator} role="note" aria-label="Active house rules">
      <div className={styles.header}>
        <AlertTriangle size={16} className={styles.icon} aria-hidden="true" />
        <span className={styles.title}>Active House Rules</span>
      </div>
      <ul className={styles.list}>
        {activeRules.map((rule) => (
          <li key={rule.label} className={styles.item}>
            <span className={styles.ruleName}>{rule.label}</span>
            <span className={styles.ruleDetail}>{rule.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
