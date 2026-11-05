import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { CommandPaletteProvider } from '../CommandPaletteContext';
import { useCommandPaletteContext } from '../commandPaletteContextValue';
import { useCommandPalette } from '../useCommandPalette';

afterEach(() => {
  cleanup();
});

/** Probe component exposing the context state + the global Ctrl/⌘+K hook. */
function Probe() {
  useCommandPalette();
  const { isOpen, open, close, shortcutsOpen, openShortcuts } = useCommandPaletteContext();
  return (
    <div>
      <span data-testid="open">{String(isOpen)}</span>
      <span data-testid="shortcuts">{String(shortcutsOpen)}</span>
      <button type="button" onClick={open}>
        open
      </button>
      <button type="button" onClick={close}>
        close
      </button>
      <button type="button" onClick={openShortcuts}>
        open-shortcuts
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <CommandPaletteProvider navigate={vi.fn()} runAction={vi.fn()}>
      <Probe />
    </CommandPaletteProvider>,
  );
}

describe('useCommandPalette + context', () => {
  it('open() and close() toggle isOpen', () => {
    renderProbe();
    expect(screen.getByTestId('open')).toHaveTextContent('false');
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(screen.getByTestId('open')).toHaveTextContent('true');
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(screen.getByTestId('open')).toHaveTextContent('false');
  });

  it('Ctrl+K toggles the palette open and closed', () => {
    renderProbe();
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });
    expect(screen.getByTestId('open')).toHaveTextContent('true');
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });
    expect(screen.getByTestId('open')).toHaveTextContent('false');
  });

  it('Cmd+K (metaKey) toggles the palette', () => {
    renderProbe();
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    expect(screen.getByTestId('open')).toHaveTextContent('true');
  });

  it('opening the shortcuts overlay closes the palette', () => {
    renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(screen.getByTestId('open')).toHaveTextContent('true');
    fireEvent.click(screen.getByRole('button', { name: 'open-shortcuts' }));
    expect(screen.getByTestId('shortcuts')).toHaveTextContent('true');
    expect(screen.getByTestId('open')).toHaveTextContent('false');
  });

  it('useCommandPaletteContext throws outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/CommandPaletteProvider/);
    spy.mockRestore();
  });
});
