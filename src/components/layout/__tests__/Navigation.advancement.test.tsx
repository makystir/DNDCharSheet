import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import App from '../../../App';
import { _resetDbForTests, createCharacter, saveCharacter } from '../../../storage/character-store';
import { indexedDB } from 'fake-indexeddb';

/**
 * The Advancement tab (Stage A6a) is an UNCONDITIONAL top-level tab keyed '6'.
 * These exercise that it appears for every character, routes on click, and
 * responds to its number-key shortcut.
 */

/**
 * Seed a single blank character so App loads straight into the sheet (the
 * returning-user path). Stage A7 changed the empty-DB behaviour to show the
 * WelcomeScreen rather than silently creating a blank character, so these
 * routing tests must provide a character to land on the sheet.
 */
async function seedCharacter() {
  _resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('dnd-char-sheet');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
  await saveCharacter(createCharacter('Router'));
}

beforeEach(() => {
  history.replaceState(null, '', '#');
});

afterEach(() => {
  cleanup();
  history.replaceState(null, '', '#');
});

async function renderApp() {
  await seedCharacter();
  render(<App />);
  // P3: the Character tab defaults to the Identity sub-tab (Personal Details);
  // Ability Scores moved to the Abilities & Skills sub-tab.
  await screen.findByRole('heading', { name: 'Personal Details' });
}

describe('Advancement tab routing', () => {
  it('shows the Advancement nav item unconditionally (even class-less)', async () => {
    await renderApp();
    expect(screen.getByRole('button', { name: 'Advancement' })).toBeInTheDocument();
  });

  it('routes to Advancement on click, moving aria-current and the hash', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Advancement' }));
    await screen.findByRole('heading', { name: /Level & Experience/ });
    expect(screen.getByRole('button', { name: 'Advancement' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(window.location.hash).toBe('#advancement');
  });

  it('switches to Advancement via its number-key shortcut (6)', async () => {
    await renderApp();
    fireEvent.keyDown(document.body, { key: '6' });
    await screen.findByRole('heading', { name: /Level & Experience/ });
    expect(screen.getByRole('button', { name: 'Advancement' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('deep-links #advancement directly', async () => {
    await seedCharacter();
    history.replaceState(null, '', '#advancement');
    render(<App />);
    await screen.findByRole('heading', { name: /Level & Experience/ });
    expect(window.location.hash).toBe('#advancement');
  });
});
