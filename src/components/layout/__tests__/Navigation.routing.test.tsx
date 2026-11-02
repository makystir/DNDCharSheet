import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import App from '../../../App';

beforeEach(() => {
  // Start every test at the default (empty) hash.
  history.replaceState(null, '', '#');
});

afterEach(() => {
  cleanup();
  history.replaceState(null, '', '#');
});

/** Waits for the async character load to settle on the Character tab. */
async function renderApp() {
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
    await screen.findByRole('button', { name: /Armor Class/ });
    expect(navButton('Combat')).toHaveAttribute('aria-current', 'page');
    expect(navButton('Character')).not.toHaveAttribute('aria-current');
    expect(window.location.hash).toBe('#combat');
  });

  it('switches tabs via number-key shortcuts', async () => {
    await renderApp();
    fireEvent.keyDown(document.body, { key: '2' });
    await screen.findByRole('button', { name: /Armor Class/ });
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
    await screen.findByRole('button', { name: /Armor Class/ });
    await waitFor(() => {
      const main = document.getElementById('main-content');
      expect(document.activeElement).toBe(main);
    });
  });
});
