import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { Navigation } from '../Navigation';
import { CommandPaletteProvider } from '../../command-palette/CommandPaletteContext';
import { AssistantProvider } from '../../assistant/AssistantContext';

afterEach(() => {
  cleanup();
});

/**
 * Stage B6: Navigation reads the command-palette context for its palette/
 * shortcuts affordances. Stage B8: it also reads the assistant context for the
 * Character Assistant trigger, so it must render inside both providers.
 */
function renderNav(ui: React.ReactElement) {
  return render(
    <CommandPaletteProvider navigate={vi.fn()} runAction={vi.fn()}>
      <AssistantProvider>{ui}</AssistantProvider>
    </CommandPaletteProvider>,
  );
}

describe('Navigation subTabHint affordance (desktop expanded)', () => {
  it('renders the Character sub-tab hint as its own hint line', () => {
    renderNav(<Navigation activePage="character" onPageChange={vi.fn()} />);
    const character = screen.getByRole('button', { name: 'Character' });
    expect(
      within(character).getByText('Overview · Abilities & Skills · Class & Features'),
    ).toBeInTheDocument();
  });

  it('renders a caret icon (aria-hidden) for the hinted item', () => {
    const { container } = renderNav(
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
    renderNav(<Navigation activePage="character" onPageChange={vi.fn()} />);
    const combat = screen.getByRole('button', { name: 'Combat' });
    const settings = screen.getByRole('button', { name: 'Settings' });
    expect(within(combat).queryByText(/·/)).toBeNull();
    expect(within(settings).queryByText(/·/)).toBeNull();
  });
});
