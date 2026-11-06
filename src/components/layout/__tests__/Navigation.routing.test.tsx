import { useState } from 'react';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import App from '../../../App';
import {
  _resetDbForTests,
  createCharacter,
  listCharacters,
  saveCharacter,
} from '../../../storage/character-store';
import { indexedDB } from 'fake-indexeddb';
import type { Character } from '../../../types/character';
import { useConditionalRouteGuard } from '../../../hooks/useConditionalRouteGuard';
import type { PageSection } from '../navItems';

/** Clears the IndexedDB so each test starts from a fresh, class-less character. */
async function resetCharacterDb() {
  _resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('dnd-char-sheet');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

beforeEach(() => {
  // Start every test at the default (empty) hash.
  history.replaceState(null, '', '#');
});

afterEach(() => {
  cleanup();
  history.replaceState(null, '', '#');
});

/**
 * Waits for the async character load to settle on the Character tab.
 *
 * Stage A7 changed the empty-DB behaviour: App now shows the WelcomeScreen
 * rather than silently creating a blank character. These routing tests exercise
 * the returning-user path, so we ensure a single class-less character exists
 * (seeding one if a prior resetCharacterDb() emptied the store) before
 * rendering, which lands App straight on the sheet.
 */
async function renderApp() {
  const existing = await listCharacters();
  if (existing.length === 0) {
    await saveCharacter(createCharacter('Router'));
  }
  render(<App />);
  // The Character tab renders the Ability Scores heading once loaded.
  await screen.findByText('Ability Scores');
}

function navButton(label: string) {
  return screen.getByRole('button', { name: label });
}

describe('Navigation routing (shell)', () => {
  it('defaults to the Character tab with aria-current on its nav item', async () => {
    await renderApp();
    expect(navButton('Character')).toHaveAttribute('aria-current', 'page');
    expect(navButton('Combat')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
  });

  it('routes to Combat on click, moving aria-current and the hash', async () => {
    await renderApp();
    fireEvent.click(navButton('Combat'));
    await screen.findAllByRole('button', { name: /Armor Class/ });
    expect(navButton('Combat')).toHaveAttribute('aria-current', 'page');
    expect(navButton('Character')).not.toHaveAttribute('aria-current');
    expect(window.location.hash).toBe('#combat');
  });

  it('switches tabs via number-key shortcuts', async () => {
    await renderApp();
    fireEvent.keyDown(document.body, { key: '2' });
    await screen.findAllByRole('button', { name: /Armor Class/ });
    expect(navButton('Combat')).toHaveAttribute('aria-current', 'page');

    fireEvent.keyDown(document.body, { key: '3' });
    await screen.findByRole('button', { name: /Switch to/ });
    expect(navButton('Settings')).toHaveAttribute('aria-current', 'page');
  });

  it('ignores number-key shortcuts while a form field is focused', async () => {
    await renderApp();
    const dexInput = screen.getByLabelText('Dexterity score');
    dexInput.focus();
    // '2' would normally switch to Combat; from within an input it must not.
    fireEvent.keyDown(dexInput, { key: '2' });
    expect(navButton('Character')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
  });

  it('responds to an external hash change (deep link / back-forward)', async () => {
    await renderApp();
    history.replaceState(null, '', '#settings');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await screen.findByRole('button', { name: /Switch to/ });
    expect(navButton('Settings')).toHaveAttribute('aria-current', 'page');
  });

  it('falls back to the Character tab for an unknown hash', async () => {
    history.replaceState(null, '', '#nonsense');
    await renderApp();
    expect(navButton('Character')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
  });

  it('moves focus to the main content region on route change', async () => {
    await renderApp();
    fireEvent.click(navButton('Combat'));
    await screen.findAllByRole('button', { name: /Armor Class/ });
    await waitFor(() => {
      const main = document.getElementById('main-content');
      expect(document.activeElement).toBe(main);
    });
  });
});

describe('Character sub-tab routing', () => {
  beforeEach(() => {
    // Clean resolve chain so a stored last-used tab does not override deep links.
    localStorage.removeItem('lastSubTab:character');
    localStorage.removeItem('tabOrder:character');
  });

  afterEach(() => {
    localStorage.removeItem('lastSubTab:character');
    localStorage.removeItem('tabOrder:character');
  });

  it('deep-links #character/species land on the Species sub-tab', async () => {
    history.replaceState(null, '', '#character/species');
    render(<App />);
    await screen.findByRole('combobox', { name: 'Species' });
    expect(window.location.hash).toBe('#character/species');
  });

  it('#character with no sub-tab lands on overview (Ability Scores)', async () => {
    history.replaceState(null, '', '#character');
    render(<App />);
    expect(await screen.findByText('Ability Scores')).toBeInTheDocument();
  });

  it('#character/bogus falls back to overview when no last-used is stored', async () => {
    localStorage.removeItem('lastSubTab:character');
    history.replaceState(null, '', '#character/bogus');
    render(<App />);
    expect(await screen.findByText('Ability Scores')).toBeInTheDocument();
  });

  it('clicking a sub-tab updates the hash and persists last-used', async () => {
    history.replaceState(null, '', '#character');
    render(<App />);
    await screen.findByText('Ability Scores');
    fireEvent.click(screen.getByRole('tab', { name: 'Class & Features' }));
    await screen.findByRole('combobox', { name: 'Class' });
    expect(window.location.hash).toBe('#character/class');
    expect(localStorage.getItem('lastSubTab:character')).toBe('class');
  });
});

describe('Conditional, level-gated Spells tab', () => {
  beforeEach(async () => {
    // Fresh DB so each test starts from a class-less (non-caster) character;
    // otherwise a caster persisted by a previous test would leak in.
    await resetCharacterDb();
    // selectClass() clicks the Class & Features sub-tab, which persists
    // lastSubTab:character='class'; clear it so renderApp() resolves to the
    // Overview sub-tab (Ability Scores) on a fresh render.
    localStorage.removeItem('lastSubTab:character');
    localStorage.removeItem('lastSubTab:spells');
    localStorage.removeItem('tabOrder:character');
    localStorage.removeItem('tabOrder:spells');
  });

  afterEach(() => {
    localStorage.removeItem('lastSubTab:character');
    localStorage.removeItem('lastSubTab:spells');
    localStorage.removeItem('tabOrder:character');
    localStorage.removeItem('tabOrder:spells');
  });

  /** Picks a class via the Character page's Class & Features sub-tab. */
  async function selectClass(classId: string) {
    fireEvent.click(screen.getByRole('tab', { name: 'Class & Features' }));
    const select = await screen.findByRole('combobox', { name: 'Class' });
    fireEvent.change(select, { target: { value: classId } });
  }

  /**
   * Sets the character level via the authoritative Advancement-page control
   * (P4 removed the duplicate Level editor from Character → Overview). Leaves
   * the app on the Advancement tab; callers navigate on from there.
   */
  async function setLevelOnAdvancement(level: number) {
    fireEvent.click(navButton('Advancement'));
    const input = (await screen.findByLabelText('Level')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: String(level) } });
  }

  it('hides the Spells tab for a non-caster (default class-less character)', async () => {
    await renderApp();
    expect(screen.queryByRole('button', { name: 'Spells' })).not.toBeInTheDocument();
  });

  it('shows the Spells tab once a full caster is chosen', async () => {
    await renderApp();
    await selectClass('wizard');
    expect(await screen.findByRole('button', { name: 'Spells' })).toBeInTheDocument();
  });

  it('keeps the Spells tab hidden for a Fighter until Eldritch Knight at level 3', async () => {
    await renderApp();
    // Level 1 Fighter: no casting.
    await selectClass('fighter');
    expect(screen.queryByRole('button', { name: 'Spells' })).not.toBeInTheDocument();
    // Raise to level 3 via the Advancement page (the authoritative Level editor).
    await setLevelOnAdvancement(3);
    // Still no subclass chosen → still hidden.
    expect(screen.queryByRole('button', { name: 'Spells' })).not.toBeInTheDocument();
    // Choose Eldritch Knight (the subclass select appears at level 3).
    fireEvent.click(navButton('Character'));
    fireEvent.click(screen.getByRole('tab', { name: 'Class & Features' }));
    const subclass = await screen.findByRole('combobox', { name: 'Subclass' });
    fireEvent.change(subclass, { target: { value: 'eldritchKnight' } });
    expect(await screen.findByRole('button', { name: 'Spells' })).toBeInTheDocument();
  });

  it('deep link to #spells as a non-caster falls back to Character', async () => {
    history.replaceState(null, '', '#spells');
    await renderApp();
    expect(navButton('Character')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe('#character'));
  });

  it('switching class off casting while on #spells hides the tab and redirects', async () => {
    // Make a Wizard first, then deep-link to #spells so the route guard runs
    // with #spells as the ACTIVE route (not after navigating away). The Class
    // combobox is only on the Character page, so we select the class there,
    // then re-assert #spells via a hashchange before switching to a
    // non-caster — exercising the guard while #spells is active.
    await renderApp();
    await selectClass('wizard');
    await screen.findByRole('button', { name: 'Spells' });

    // Drive to #spells via an external hash change (deep link / back-forward).
    history.replaceState(null, '', '#spells');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await screen.findByText('Spell Save DC');
    expect(window.location.hash).toBe('#spells');

    // Switch to a non-caster class. The Class combobox lives on the Character
    // page; selecting it there changes the stored character. Because the guard
    // keys on the character + page, the change invalidates the (previously
    // active) #spells route and the hash is rewritten to #character.
    fireEvent.click(navButton('Character'));
    const classSelect = await screen.findByRole('combobox', { name: 'Class' });
    fireEvent.change(classSelect, { target: { value: 'barbarian' } });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Spells' })).not.toBeInTheDocument();
    });
    await waitFor(() => expect(window.location.hash).toBe('#character'));
  });

  it('redirects off #spells when a non-caster character loads at that hash', async () => {
    // Directly exercises the route guard with #spells as the active route and a
    // non-caster character: the guard must rewrite the hash to #character
    // (replaceState, no back-history entry) without the user navigating away.
    await resetCharacterDb();
    history.replaceState(null, '', '#spells');
    await renderApp();
    expect(navButton('Character')).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(window.location.hash).toBe('#character'));
    // And the Spells tab is not rendered for a non-caster.
    expect(screen.queryByRole('button', { name: 'Spells' })).not.toBeInTheDocument();
  });

  it('switching an Eldritch Knight subclass to Champion hides Spells and redirects', async () => {
    await renderApp();
    // Build a level-3 Eldritch Knight (a caster), then open the Spells tab.
    await selectClass('fighter');
    await setLevelOnAdvancement(3);
    fireEvent.click(navButton('Character'));
    fireEvent.click(screen.getByRole('tab', { name: 'Class & Features' }));
    const subclass = await screen.findByRole('combobox', { name: 'Subclass' });
    fireEvent.change(subclass, { target: { value: 'eldritchKnight' } });
    const spellsTab = await screen.findByRole('button', { name: 'Spells' });

    // Go to #spells, then change the subclass to the non-casting Champion.
    fireEvent.click(spellsTab);
    await screen.findByText('Spell Save DC');
    expect(window.location.hash).toBe('#spells');

    fireEvent.click(navButton('Character'));
    const subclass2 = await screen.findByRole('combobox', { name: 'Subclass' });
    fireEvent.change(subclass2, { target: { value: 'champion' } });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Spells' })).not.toBeInTheDocument();
    });
    await waitFor(() => expect(window.location.hash).toBe('#character'));
  });

  it('the Spells number-key shortcut is inert while the tab is hidden', async () => {
    await renderApp();
    // '4' is the Spells shortcut; with no caster class it must do nothing.
    fireEvent.keyDown(document.body, { key: '4' });
    expect(navButton('Character')).toHaveAttribute('aria-current', 'page');
    expect(window.location.hash).not.toBe('#spells');
  });

  it('the Spells number-key shortcut works once the tab is visible', async () => {
    await renderApp();
    await selectClass('cleric');
    await screen.findByRole('button', { name: 'Spells' });
    fireEvent.keyDown(document.body, { key: '4' });
    await screen.findByText('Spell Save DC');
    expect(navButton('Spells')).toHaveAttribute('aria-current', 'page');
  });
});

/**
 * Directly exercises the reactive route guard (blueprint §6.4): the character
 * becomes invalid for the ACTIVE route (#spells) WITHOUT navigating away first.
 * App threads its loaded character + active page into useConditionalRouteGuard;
 * this harness drives that same hook with the page pinned to 'spells' while the
 * character flips from caster to non-caster, so the redirect must fire while
 * the route is still 'spells' (the gap the App integration tests cannot reach,
 * because the only class control lives on the Character page).
 */
describe('Reactive route guard (character invalidated while #spells active)', () => {
  function Harness({ initial }: { initial: Character }) {
    const [character, setCharacter] = useState<Character>(initial);
    const [page, setPage] = useState<PageSection>('spells');
    // The guard calls navigate('character') when the active page is no longer
    // visible for the character; record that by updating local page state.
    useConditionalRouteGuard(character, page, (next) => setPage(next));
    return (
      <div>
        <span data-testid="page">{page}</span>
        <button
          type="button"
          onClick={() =>
            setCharacter((c) => ({ ...c, classes: [{ id: 'barbarian', level: c.level }] }))
          }
        >
          make-noncaster
        </button>
      </div>
    );
  }

  it('redirects #spells to #character when the class changes to a non-caster', async () => {
    const wizard: Character = {
      ...createCharacter(),
      level: 3,
      classes: [{ id: 'wizard', level: 3 }],
    };
    render(<Harness initial={wizard} />);
    // A Wizard is a caster, so the guard leaves the active #spells route intact.
    expect(screen.getByTestId('page')).toHaveTextContent('spells');

    // Flip to a non-caster WHILE page is still 'spells'; the guard must redirect.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'make-noncaster' }));
    });
    await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent('character'));
  });

  it('redirects when an Eldritch Knight drops below the subclass casting level', async () => {
    const ek: Character = {
      ...createCharacter(),
      level: 3,
      classes: [{ id: 'fighter', level: 3, subclassId: 'eldritchKnight' }],
    };
    function LevelHarness() {
      const [character, setCharacter] = useState<Character>(ek);
      const [page, setPage] = useState<PageSection>('spells');
      useConditionalRouteGuard(character, page, (next) => setPage(next));
      return (
        <div>
          <span data-testid="page">{page}</span>
          <button
            type="button"
            onClick={() =>
              setCharacter((c) => ({ ...c, level: 2, classes: [{ ...c.classes![0], level: 2 }] }))
            }
          >
            drop-level
          </button>
        </div>
      );
    }
    render(<LevelHarness />);
    expect(screen.getByTestId('page')).toHaveTextContent('spells');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'drop-level' }));
    });
    // Below level 3, the Eldritch Knight has no casting → tab hidden → redirect.
    await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent('character'));
  });

  it('redirects when ONLY the subclass changes Eldritch Knight -> Champion', async () => {
    // Blueprint §6.4 (review finding): mutate nothing but subclassId while the
    // active page stays 'spells'; the level and class id are unchanged, so the
    // redirect must be driven purely by the subclass losing casting.
    const ek: Character = {
      ...createCharacter(),
      level: 3,
      classes: [{ id: 'fighter', level: 3, subclassId: 'eldritchKnight' }],
    };
    function SubclassHarness() {
      const [character, setCharacter] = useState<Character>(ek);
      const [page, setPage] = useState<PageSection>('spells');
      useConditionalRouteGuard(character, page, (next) => setPage(next));
      return (
        <div>
          <span data-testid="page">{page}</span>
          <button
            type="button"
            onClick={() =>
              // Only subclassId changes; level 3 and class id 'fighter' persist.
              setCharacter((c) => ({ ...c, classes: [{ ...c.classes![0], subclassId: 'champion' }] }))
            }
          >
            swap-subclass
          </button>
        </div>
      );
    }
    render(<SubclassHarness />);
    // An Eldritch Knight at level 3 is a caster, so #spells stays active.
    expect(screen.getByTestId('page')).toHaveTextContent('spells');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'swap-subclass' }));
    });
    // Champion grants no casting → the Spells route is invalid → redirect.
    await waitFor(() => expect(screen.getByTestId('page')).toHaveTextContent('character'));
  });
});

