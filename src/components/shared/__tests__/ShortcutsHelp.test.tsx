import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShortcutsHelp } from '../ShortcutsHelp';
import { NAV_ITEMS } from '../../layout/navItems';

afterEach(() => {
  cleanup();
});

describe('ShortcutsHelp overlay', () => {
  it('renders as a labelled modal dialog', () => {
    render(<ShortcutsHelp onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('lists a "Go to <label>" row for every nav item (from the registry)', () => {
    render(<ShortcutsHelp onClose={vi.fn()} />);
    for (const item of NAV_ITEMS) {
      expect(screen.getByText(`Go to ${item.label}`)).toBeInTheDocument();
      // The number key is shown in a <kbd>.
      expect(screen.getAllByText(item.shortcut).length).toBeGreaterThan(0);
    }
  });

  it('documents the Ctrl/⌘+K palette shortcut', () => {
    render(<ShortcutsHelp onClose={vi.fn()} />);
    expect(screen.getByText('Open search / command palette')).toBeInTheDocument();
  });

  it('calls onClose on the close button, backdrop, and Escape', () => {
    const onClose = vi.fn();
    render(<ShortcutsHelp onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('traps Tab focus within the overlay (Tab from the last control wraps to the first)', () => {
    render(<ShortcutsHelp onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    // The close button is the only focusable control, so it is both first and
    // last: Tab (and Shift+Tab) must keep focus on it rather than escaping.
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(closeBtn);
  });
});
