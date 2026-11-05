import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { Navigation } from '../../layout/Navigation';
import { CommandPaletteProvider } from '../CommandPaletteContext';
import { useCommandPaletteContext } from '../commandPaletteContextValue';
import { AssistantProvider } from '../../assistant/AssistantContext';

afterEach(() => {
  cleanup();
});

/** Exposes the palette open-state so we can assert Ctrl/⌘+K is independent. */
function OpenState() {
  const { isOpen } = useCommandPaletteContext();
  return <span data-testid="palette-open">{String(isOpen)}</span>;
}

/**
 * Integration point 2: EXACTLY one handler per key. Navigation owns the single
 * number-key handler; B6 adds only the NEW, non-conflicting Ctrl/⌘+K binding.
 * These tests assert a number key fires onPageChange exactly once (no double
 * navigation) and that Ctrl/⌘+K does not navigate.
 */
describe('single number-key handler (no double-bind)', () => {
  it('a number key calls onPageChange exactly once', () => {
    const onPageChange = vi.fn();
    render(
      <CommandPaletteProvider navigate={vi.fn()} runAction={vi.fn()}>
        <AssistantProvider>
          <Navigation activePage="character" onPageChange={onPageChange} />
        </AssistantProvider>
      </CommandPaletteProvider>,
    );
    fireEvent.keyDown(document.body, { key: '2' });
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith('combat');
  });

  it('the palette-open key (Ctrl+K) does not trigger navigation', () => {
    const onPageChange = vi.fn();
    render(
      <CommandPaletteProvider navigate={vi.fn()} runAction={vi.fn()}>
        <AssistantProvider>
          <Navigation activePage="character" onPageChange={onPageChange} />
        </AssistantProvider>
        <OpenState />
      </CommandPaletteProvider>,
    );
    // Navigation itself does not bind Ctrl+K; only the global hook does (not
    // mounted here), so this confirms the number-key handler ignores it.
    act(() => {
      fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    });
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('renders the palette-open and shortcuts affordances', () => {
    render(
      <CommandPaletteProvider navigate={vi.fn()} runAction={vi.fn()}>
        <AssistantProvider>
          <Navigation activePage="character" onPageChange={vi.fn()} />
        </AssistantProvider>
      </CommandPaletteProvider>,
    );
    expect(screen.getByRole('button', { name: 'Open command palette' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
  });
});
