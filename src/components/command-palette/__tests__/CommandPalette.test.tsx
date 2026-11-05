import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { useEffect } from 'react';
import { CommandPaletteProvider } from '../CommandPaletteContext';
import { useCommandPaletteContext } from '../commandPaletteContextValue';
import { CommandPalette } from '../CommandPalette';
import { createCharacter } from '../../../storage/character-store';
import type { Character } from '../../../types/character';
import type { PageSection } from '../../../components/layout/navItems';

afterEach(() => {
  cleanup();
});

/** Opens the palette once on mount so the modal renders under test. */
function AutoOpen() {
  const { open } = useCommandPaletteContext();
  useEffect(() => {
    open();
  }, [open]);
  return null;
}

function caster(): Character {
  return { ...createCharacter(), level: 3, class: { id: 'wizard', level: 3 } };
}

function renderPalette(opts?: {
  navigate?: (p: PageSection) => void;
  runAction?: (a: string) => void;
  character?: Character;
}) {
  const navigate = opts?.navigate ?? vi.fn();
  const runAction = opts?.runAction ?? vi.fn();
  render(
    <CommandPaletteProvider
      navigate={navigate}
      runAction={runAction}
      character={opts?.character ?? caster()}
    >
      <AutoOpen />
      <CommandPalette />
    </CommandPaletteProvider>,
  );
  return { navigate, runAction };
}

describe('CommandPalette', () => {
  it('renders as an aria-modal dialog with the search input', () => {
    renderPalette();
    const dialog = screen.getByRole('dialog', { name: 'Command palette' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('command-palette-input')).toBeInTheDocument();
  });

  it('renders matching results as the query is typed', () => {
    renderPalette();
    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'combat' } });
    expect(screen.getByText('Go to Combat')).toBeInTheDocument();
  });

  it('selecting a "go to page" result navigates and closes', () => {
    const { navigate } = renderPalette();
    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'combat' } });
    fireEvent.click(screen.getByText('Go to Combat'));
    expect(navigate).toHaveBeenCalledWith('combat');
    // Palette closes after dispatch.
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
  });

  it('Enter on the selected page result navigates', () => {
    const { navigate } = renderPalette();
    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'inventory' } });
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Command palette' }), {
      key: 'Enter',
    });
    expect(navigate).toHaveBeenCalledWith('inventory');
  });

  it('selecting an action result runs the action and closes', () => {
    const { runAction } = renderPalette();
    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'toggle theme' } });
    fireEvent.click(screen.getByText('Toggle theme'));
    expect(runAction).toHaveBeenCalledWith('toggle-theme');
  });

  it('opens a read-only detail view for a condition result', () => {
    renderPalette();
    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'prone' } });
    fireEvent.click(screen.getByText('Prone'));
    expect(screen.getByTestId('command-palette-detail')).toBeInTheDocument();
  });

  it('Escape closes the palette (a11y)', () => {
    renderPalette();
    const dialog = screen.getByRole('dialog', { name: 'Command palette' });
    act(() => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
  });

  it('clicking the backdrop closes the palette', () => {
    renderPalette();
    fireEvent.click(screen.getByTestId('command-palette-backdrop'));
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
  });

  it('does not offer a Spells page command for a non-caster', () => {
    renderPalette({ character: createCharacter() });
    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'spells' } });
    expect(screen.queryByText('Go to Spells')).not.toBeInTheDocument();
  });

  it('traps Tab focus within the modal (a11y)', () => {
    renderPalette();
    const dialog = screen.getByRole('dialog', { name: 'Command palette' });
    const focusables = dialog.querySelectorAll<HTMLElement>('button, input');
    const last = focusables[focusables.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);
    // Tab from the last focusable wraps back to the first.
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(focusables[0]);
  });
});
