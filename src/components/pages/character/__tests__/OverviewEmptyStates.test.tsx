import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { OverviewConditions } from '../OverviewConditions';
import { OverviewAttacks } from '../OverviewAttacks';
import { OverviewReactions } from '../OverviewReactions';
import { createCharacter } from '../../../../storage/character-store';
import type { Character } from '../../../../types/character';

// Every real character has the universal Opportunity Attack, so force an empty
// list to exercise the Reactions empty state.
vi.mock('../../../../logic/reactions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../logic/reactions')>();
  return { ...actual, availableReactions: () => [] };
});

afterEach(cleanup);

const character: Character = {
  ...createCharacter('Tester'),
  level: 1,
  classes: [{ id: 'fighter', level: 1 }],
};

const cases = [
  {
    name: 'Conditions',
    el: <OverviewConditions character={character} />,
    text: 'No active conditions',
    footer: 'Manage conditions on Combat',
  },
  {
    name: 'Attacks',
    el: <OverviewAttacks character={character} />,
    text: 'No weapons equipped',
    footer: 'Make attacks on Combat',
  },
  {
    name: 'Reactions',
    el: <OverviewReactions character={character} />,
    text: 'No reactions available',
    footer: 'Reaction used? Manage on Combat',
  },
];

describe('Overview empty states share one markup', () => {
  for (const c of cases) {
    it(`${c.name}: muted paragraph in the shared empty block, footer link on its own line`, () => {
      render(c.el);
      const empty = screen.getByTestId('overview-empty');
      const text = within(empty).getByText(c.text);
      expect(text.tagName).toBe('P');
      // Any link in the empty state is a sibling of the text, never inline in it.
      expect(within(text).queryByRole('link')).toBeNull();
      const footer = screen.getByTestId('overview-footer');
      expect(within(footer).getByRole('link', { name: c.footer })).toHaveAttribute('href', '#combat');
      expect(empty).not.toContainElement(footer);
    });
  }

  it('the Attacks empty state puts the Inventory link on its own line', () => {
    render(<OverviewAttacks character={character} />);
    const empty = screen.getByTestId('overview-empty');
    const link = within(empty).getByRole('link', { name: 'Equip weapons on Inventory' });
    expect(link).toHaveAttribute('href', '#inventory');
    expect(link.parentElement).toBe(empty);
  });

  it('all three use identical class names for the empty block and its text', () => {
    const signatures = cases.map((c) => {
      render(c.el);
      const empty = screen.getByTestId('overview-empty');
      const sig = `${empty.className}|${empty.querySelector('p')!.className}`;
      cleanup();
      return sig;
    });
    expect(new Set(signatures).size).toBe(1);
  });
});
