import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { Navigation } from '../Navigation';

afterEach(() => {
  cleanup();
});

describe('Navigation subTabHint affordance (desktop expanded)', () => {
  it('renders the Character sub-tab hint as its own hint line', () => {
    render(<Navigation activePage="character" onPageChange={vi.fn()} />);
    const character = screen.getByRole('button', { name: 'Character' });
    expect(
      within(character).getByText('Overview · Skills & Saves · Species · Class & Features'),
    ).toBeInTheDocument();
  });

  it('renders a caret icon (aria-hidden) for the hinted item', () => {
    const { container } = render(
      <Navigation activePage="character" onPageChange={vi.fn()} />,
    );
    const character = screen.getByRole('button', { name: 'Character' });
    // The hinted item carries an aria-hidden caret svg.
    const caret = character.querySelector('svg[aria-hidden="true"]');
    expect(caret).not.toBeNull();
    // Sanity: the component mounted a sidebar, not the mobile row.
    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  it('does not render a hint for Combat or Settings', () => {
    render(<Navigation activePage="character" onPageChange={vi.fn()} />);
    const combat = screen.getByRole('button', { name: 'Combat' });
    const settings = screen.getByRole('button', { name: 'Settings' });
    expect(within(combat).queryByText(/·/)).toBeNull();
    expect(within(settings).queryByText(/·/)).toBeNull();
  });
});
