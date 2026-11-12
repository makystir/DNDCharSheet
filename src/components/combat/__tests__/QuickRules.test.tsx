import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QUICK_RULE_GROUPS, quickRules, searchQuickRules } from '../../../logic/quick-rules';
import { QuickRulesCard } from '../QuickRulesCard';
import { CONDITIONS } from '../../../data/conditions';

beforeEach(() => localStorage.clear());

describe('quick rules data', () => {
  it('has unique ids, a known group, a title and at least one section with text for every rule', () => {
    const rules = quickRules();
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
    for (const r of rules) {
      expect(QUICK_RULE_GROUPS, r.id).toContain(r.group);
      expect(r.content.title.trim().length, r.id).toBeGreaterThan(0);
      expect(r.content.sections.length, r.id).toBeGreaterThan(0);
      for (const s of r.content.sections) expect(s.text.trim().length, r.id).toBeGreaterThan(0);
    }
  });

  it('includes every condition, the core combat rules and the PHB-cited additions', () => {
    const ids = new Set(quickRules().map((r) => r.id));
    for (const c of CONDITIONS) expect(ids.has(`condition:${c.id}`), c.id).toBe(true);
    for (const id of ['attack:cover', 'attack:critical-hit', 'hp:death-saves', 'rest:concentration', 'opportunity-attack', 'unarmed-strike', 'hide', 'falling', 'difficult-terrain']) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  it('every new rule written here cites the PHB with a line number', () => {
    for (const id of ['opportunity-attack', 'unseen', 'range', 'unarmed-strike', 'help', 'hide', 'difficult-terrain', 'break-up-move', 'falling']) {
      const rule = quickRules().find((r) => r.id === id)!;
      const source = rule.content.sections.find((s) => s.label === 'Source')?.text ?? '';
      expect(source, id).toMatch(/PHB 2024 .*L\d+/);
    }
  });

  it('keeps the printed numbers in the PHB-cited additions', () => {
    const text = (id: string) => quickRules().find((r) => r.id === id)!.content.sections.map((s) => s.text).join(' ');
    expect(text('falling')).toMatch(/1d6 .*10 feet .*20d6/);
    expect(text('falling')).toMatch(/DC 15/);
    expect(text('hide')).toMatch(/DC 15 Dexterity \(Stealth\)/);
    expect(text('unarmed-strike')).toMatch(/8 \+ your Strength modifier \+ Proficiency Bonus/);
    expect(text('difficult-terrain')).toMatch(/1 extra foot/);
  });

  it('searches titles and text by every word', () => {
    expect(searchQuickRules('').length).toBe(quickRules().length);
    const prone = searchQuickRules('prone');
    expect(prone.some((r) => r.id === 'condition:prone')).toBe(true);
    expect(prone.some((r) => r.id === 'falling')).toBe(true);
    expect(searchQuickRules('grapple shove').map((r) => r.id)).toContain('unarmed-strike');
    expect(searchQuickRules('zzzz-not-a-rule')).toEqual([]);
  });
});

describe('QuickRulesCard', () => {
  it('starts collapsed, then searches and opens a rule in place', () => {
    render(<QuickRulesCard />);
    const toggle = screen.getByRole('button', { name: /Quick rules/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    fireEvent.change(screen.getByLabelText('Search quick rules'), { target: { value: 'cover' } });
    expect(screen.getByRole('status')).toHaveTextContent(/\d+ of \d+ rules match/);
    const attacks = screen.getByRole('region', { name: 'Attacks rules' });
    const summary = within(attacks).getByText('Cover');
    fireEvent.click(summary);
    expect(within(attacks).getAllByText(/Three-Quarters|Half/).length).toBeGreaterThan(0);
  });

  it('says when nothing matches', () => {
    render(<QuickRulesCard />);
    fireEvent.click(screen.getByRole('button', { name: /Quick rules/ }));
    fireEvent.change(screen.getByLabelText('Search quick rules'), { target: { value: 'zzzz-not-a-rule' } });
    expect(screen.getByText('No rules match that search.')).toBeInTheDocument();
  });
});
