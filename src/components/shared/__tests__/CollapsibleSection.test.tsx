import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CollapsibleSection } from '../CollapsibleSection';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('CollapsibleSection', () => {
  it('persists a collapse to localStorage and restores it on remount', () => {
    const key = 'test-collapse-key';
    const { unmount } = render(
      <CollapsibleSection title="Species" storageKey={key}>
        <p>Species body</p>
      </CollapsibleSection>,
    );

    // Default expanded.
    const header = screen.getByRole('button', { name: /Species/ });
    expect(header).toHaveAttribute('aria-expanded', 'true');

    // Collapse → writes 'false'.
    fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(localStorage.getItem(key)).toBe('false');

    // Remount under the same key → restores collapsed.
    unmount();
    render(
      <CollapsibleSection title="Species" storageKey={key}>
        <p>Species body</p>
      </CollapsibleSection>,
    );
    expect(screen.getByRole('button', { name: /Species/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('degrades to in-memory state without throwing when storage fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    render(
      <CollapsibleSection title="Class" storageKey="failing-key">
        <p>Class body</p>
      </CollapsibleSection>,
    );
    const header = screen.getByRole('button', { name: /Class/ });

    // Toggling must not throw even though setItem does.
    expect(() => fireEvent.click(header)).not.toThrow();
    // In-memory toggle still works.
    expect(header).toHaveAttribute('aria-expanded', 'false');
    spy.mockRestore();
  });

  it('exposes a labelled region pointing at the header id', () => {
    render(
      <CollapsibleSection title="Skills" storageKey="region-key">
        <p>Skills body</p>
      </CollapsibleSection>,
    );
    const region = screen.getByRole('region', { name: 'Skills' });
    expect(region).toBeInTheDocument();
    const heading = screen.getByRole('heading', { name: 'Skills' });
    expect(region.getAttribute('aria-labelledby')).toBe(heading.id);
  });
});
