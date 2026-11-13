import { describe, it, expect, afterEach, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import App from '../../../App';
import { _resetDbForTests, createCharacter, saveCharacter } from '../../../storage/character-store';
import { indexedDB } from 'fake-indexeddb';

/**
 * The Companions tab is an UNCONDITIONAL top-level tab keyed '7'. These check
 * that it appears for every character, routes on click, responds to its number
 * key and deep-links, including a sub-tab.
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
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  history.replaceState(null, '', '#');
});

/**
 * App loads the Companions page with React.lazy. Preload it so the first visit
 * in a worker does not transform the page module graph inside a findBy wait,
 * which overruns under full-suite load.
 */
beforeAll(async () => {
  await import('../../pages/CompanionsPage');
}, 60_000);

async function renderApp() {
  await seedCharacter();
  render(<App />);
  await screen.findByRole('heading', { name: 'Personal Details' });
}

describe('Companions tab routing', () => {
  it('shows the Companions nav item unconditionally (even class-less)', async () => {
    await renderApp();
    expect(screen.getByRole('button', { name: /^Companions/ })).toBeInTheDocument();
  });

  it('routes to Companions on click, moving aria-current and the hash', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /^Companions/ }));
    await screen.findByRole('heading', { name: 'No companions yet' });
    expect(screen.getByRole('button', { name: /^Companions/ })).toHaveAttribute('aria-current', 'page');
    expect(window.location.hash).toMatch(/^#companions/);
  });

  it('switches to Companions via its number-key shortcut (7)', async () => {
    await renderApp();
    fireEvent.keyDown(document.body, { key: '7' });
    await screen.findByRole('heading', { name: 'No companions yet' });
    expect(screen.getByRole('button', { name: /^Companions/ })).toHaveAttribute('aria-current', 'page');
  });

  it('deep-links #companions directly', async () => {
    await seedCharacter();
    history.replaceState(null, '', '#companions');
    render(<App />);
    await screen.findByRole('heading', { name: 'No companions yet' });
    expect(window.location.hash).toMatch(/^#companions/);
  });

  it('deep-links a sub-tab (#companions/hirelings)', async () => {
    await seedCharacter();
    history.replaceState(null, '', '#companions/hirelings');
    render(<App />);
    await screen.findByRole('tab', { name: 'Hirelings', selected: true });
  });
});
