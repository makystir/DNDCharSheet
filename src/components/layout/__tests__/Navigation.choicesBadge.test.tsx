import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import App from '../../../App';
import { _resetDbForTests, createCharacter, saveCharacter } from '../../../storage/character-store';
import { indexedDB } from 'fake-indexeddb';
import { pendingChoices, pendingChoiceCount } from '../../../logic/pending-choices';
import type { Character } from '../../../types/character';

/**
 * The Advancement tab shows a count badge of the choices the character owes, from
 * the same source as the Advancement page's "Choices Pending (N)" heading.
 */
async function seed(overrides: Partial<Character>) {
  _resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('dnd-char-sheet');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
  await saveCharacter({ ...createCharacter('Badge'), ...overrides });
}

beforeEach(() => {
  history.replaceState(null, '', '#');
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  history.replaceState(null, '', '#');
});

describe('Advancement tab choices badge', () => {
  it('shows the owed-choice count, announced in the tab name', async () => {
    const owing: Partial<Character> = { level: 4, classes: [{ id: 'fighter', level: 4 }] };
    const expected = pendingChoiceCount({ ...createCharacter('x'), ...owing });
    expect(expected).toBeGreaterThan(0);
    await seed(owing);
    render(<App />);
    await screen.findByRole('heading', { name: 'Personal Details' });
    const tab = await screen.findByRole('button', {
      name: `Advancement, ${expected} ${expected === 1 ? 'choice' : 'choices'} to make`,
    });
    expect(within(tab).getByTestId('nav-badge')).toHaveTextContent(String(expected));
  });

  it('shows no badge when nothing is owed', async () => {
    await seed({ level: 1, classes: [{ id: 'barbarian', level: 1 }] });
    render(<App />);
    const tab = await screen.findByRole('button', { name: /^Advancement/ });
    expect(within(tab).queryByTestId('nav-badge')).toBeNull();
    expect(tab).not.toHaveAccessibleName(/choice/);
  });
});

describe('pendingChoices', () => {
  it('total equals the sum of its parts', () => {
    const c: Character = { ...createCharacter('x'), level: 5, classes: [{ id: 'wizard', level: 5 }] };
    const p = pendingChoices(c);
    const sum =
      p.unfilledFightingStyles.length +
      p.unfilledFeatLevels.length +
      (p.subclassDue ? 1 : 0) +
      p.unrecordedHpLevels.length +
      (p.expertise.remaining > 0 ? 1 : 0) +
      (p.languagePicks.remaining > 0 ? 1 : 0) +
      p.pendingClassChoiceCount +
      p.pendingMulticlassCount +
      p.spellPicks.length +
      (p.illegalSpells.length > 0 ? 1 : 0);
    expect(p.total).toBe(sum);
    expect(pendingChoiceCount(c)).toBe(sum);
  });
});
