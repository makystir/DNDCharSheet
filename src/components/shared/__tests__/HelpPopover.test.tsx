import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HelpPopover } from '../HelpPopover';
import { isSuppressed } from '../helpPopoverStorage';

const CONCEPT = 'command-palette';
const STORAGE_KEY = `dnd-hint-dismissed-${CONCEPT}`;

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

afterEach(() => {
  cleanup();
  localStorage.removeItem(STORAGE_KEY);
});

describe('HelpPopover', () => {
  it('auto-shows the help text on first render (not yet suppressed)', () => {
    render(<HelpPopover concept={CONCEPT}>Press Ctrl/⌘+K to open the palette.</HelpPopover>);
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Ctrl\/⌘\+K/);
  });

  it('dismissing closes the popover and records a dismiss', () => {
    render(<HelpPopover concept={CONCEPT}>Help text here.</HelpPopover>);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    // Toggle the trigger to dismiss (increments the persisted count).
    fireEvent.click(screen.getByRole('button', { name: /Help:/ }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1');
  });

  it('stays hidden on mount once dismissed at least 3 times (suppressed)', () => {
    localStorage.setItem(STORAGE_KEY, '3');
    expect(isSuppressed(CONCEPT)).toBe(true);
    render(<HelpPopover concept={CONCEPT}>Help text here.</HelpPopover>);
    // Auto-show is suppressed; no tooltip until the user opens it manually.
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('the trigger can re-open a suppressed popover on demand', () => {
    localStorage.setItem(STORAGE_KEY, '3');
    render(<HelpPopover concept={CONCEPT}>Help text here.</HelpPopover>);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Help:/ }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });
});

describe('HelpPopover autoShow={false}', () => {
  it('stays closed on first render and opens only when the ? button is clicked', () => {
    render(
      <HelpPopover concept={CONCEPT} autoShow={false}>
        Manual help text.
      </HelpPopover>,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Help:/ }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Manual help text.');
    // Opening by hand does not count as a dismissal; closing it does.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Help:/ }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
