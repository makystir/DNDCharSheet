import { useMemo, useState } from 'react';
import { QUICK_RULE_GROUPS, quickRules, searchQuickRules } from '../../logic/quick-rules';
import { Card } from '../shared/Card';
import { CollapsibleSection } from '../shared/CollapsibleSection';
import styles from './QuickRulesCard.module.css';

/**
 * Quick rules for the Combat page: a searchable, grouped list of the rules a
 * player looks up mid-fight (actions, cover, critical hits, conditions, death
 * saves, difficult terrain, falling, weapon properties...). Each rule opens in
 * place. Collapsed by default so it stays out of the way.
 */
export function QuickRulesCard() {
  const [query, setQuery] = useState('');
  const all = useMemo(() => quickRules(), []);
  const matches = useMemo(() => searchQuickRules(query, all), [query, all]);

  return (
    <Card>
      <CollapsibleSection title="Quick rules" storageKey="dnd-collapse-quick-rules" defaultExpanded={false}>
        <input
          className={styles.search}
          type="search"
          value={query}
          placeholder="Search rules (cover, grapple, prone...)"
          aria-label="Search quick rules"
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className={styles.count} role="status" aria-live="polite">
          {query.trim() === '' ? `${all.length} rules` : `${matches.length} of ${all.length} rules match`}
        </p>
        {matches.length === 0 ? (
          <p className={styles.empty}>No rules match that search.</p>
        ) : (
          QUICK_RULE_GROUPS.map((group) => {
            const rules = matches.filter((r) => r.group === group);
            if (rules.length === 0) return null;
            return (
              <section key={group} className={styles.group} aria-label={`${group} rules`}>
                <h4 className={styles.groupHeading}>{group}</h4>
                <ul className={styles.list}>
                  {rules.map((r) => (
                    <li key={r.id}>
                      <details className={styles.rule}>
                        <summary className={styles.summary}>{r.content.title}</summary>
                        <dl className={styles.sections}>
                          {r.content.sections.map((s, i) => (
                            <div key={i} className={styles.section}>
                              <dt>{s.label}</dt>
                              <dd>{s.text}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </CollapsibleSection>
    </Card>
  );
}
