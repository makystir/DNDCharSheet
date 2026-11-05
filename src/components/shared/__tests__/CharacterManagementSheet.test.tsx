import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CharacterManagementSheet } from '../CharacterManagementSheet';
import type { CharacterSummary } from '../../../storage/character-manager';

const CHARS: CharacterSummary[] = [
  { id: 'a', name: 'Alpha', className: 'Fighter', level: 3, updatedAt: 200 },
  { id: 'b', name: 'Beta', className: '', level: 1, updatedAt: 300 },
  { id: 'c', name: 'Gamma', className: 'Wizard', level: 5, updatedAt: 100 },
];

interface Handlers {
  onClose: () => void;
  onSwitchCharacter: (id: string) => void;
  onCreateCharacter: () => void;
  onRenameCharacter: (id: string, name: string) => void;
  onDuplicateCharacter: (id: string) => void;
  onDeleteCharacter: (id: string) => void;
}

function renderSheet(
  props: Partial<React.ComponentProps<typeof CharacterManagementSheet>> = {},
): Handlers {
  const handlers: Handlers = {
    onClose: vi.fn(),
    onSwitchCharacter: vi.fn(),
    onCreateCharacter: vi.fn(),
    onRenameCharacter: vi.fn(),
    onDuplicateCharacter: vi.fn(),
    onDeleteCharacter: vi.fn(),
  };
  render(
    <CharacterManagementSheet
      isOpen
      characters={CHARS}
      activeId="a"
      triggerRef={createRef<HTMLButtonElement>()}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CharacterManagementSheet', () => {
  it('renders one card per character, newest-updated first', () => {
    renderSheet();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    // Beta (300) > Alpha (200) > Gamma (100).
    expect(within(items[0]).getByText('Beta')).toBeInTheDocument();
    expect(within(items[1]).getByText('Alpha')).toBeInTheDocument();
    expect(within(items[2]).getByText('Gamma')).toBeInTheDocument();
  });

  it('shows a class/level meta line, degrading when no class is chosen', () => {
    renderSheet();
    expect(screen.getByText('Level 3 Fighter')).toBeInTheDocument();
    expect(screen.getByText('Level 5 Wizard')).toBeInTheDocument();
    // Beta has no class.
    expect(screen.getByText('Level 1')).toBeInTheDocument();
  });

  it('is a modal dialog with an accessible name', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Manage Characters');
  });

  it('switches to a non-active character and closes', () => {
    const h = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Beta' }));
    expect(h.onSwitchCharacter).toHaveBeenCalledWith('b');
    expect(h.onClose).toHaveBeenCalled();
  });

  it('tapping the active character closes without switching', () => {
    const h = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Alpha (active)' }));
    expect(h.onSwitchCharacter).not.toHaveBeenCalled();
    expect(h.onClose).toHaveBeenCalled();
  });

  it('duplicates a character', () => {
    const h = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Alpha' }));
    expect(h.onDuplicateCharacter).toHaveBeenCalledWith('a');
  });

  it('renames a character via the inline input (Enter confirms)', () => {
    const h = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Rename Alpha' }));
    const input = screen.getByRole('textbox', { name: 'Rename character' });
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.onRenameCharacter).toHaveBeenCalledWith('a', 'Renamed');
  });

  it('rename confirm fires once even if Enter is followed by blur', () => {
    const h = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Rename Alpha' }));
    const input = screen.getByRole('textbox', { name: 'Rename character' });
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Simulate the blur that follows the input unmounting after Enter.
    fireEvent.blur(input);
    expect(h.onRenameCharacter).toHaveBeenCalledTimes(1);
    expect(h.onRenameCharacter).toHaveBeenCalledWith('a', 'Renamed');
  });

  it('does not rename when the input is blanked (cancels)', () => {
    const h = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Rename Alpha' }));
    const input = screen.getByRole('textbox', { name: 'Rename character' });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(h.onRenameCharacter).not.toHaveBeenCalled();
  });

  it('Escape in rename mode cancels the rename but keeps the sheet open', () => {
    const h = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Rename Alpha' }));
    const input = screen.getByRole('textbox', { name: 'Rename character' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(h.onClose).not.toHaveBeenCalled();
    // Back to the switch button for Alpha.
    expect(screen.getByRole('button', { name: 'Alpha (active)' })).toBeInTheDocument();
  });

  it('delete requires confirmation, then calls onDeleteCharacter', () => {
    const h = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Gamma' }));
    // Confirmation dialog appears; nothing deleted yet.
    expect(h.onDeleteCharacter).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirm);
    expect(h.onDeleteCharacter).toHaveBeenCalledWith('c');
  });

  it('cancelling the delete confirmation does not delete', () => {
    const h = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Gamma' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(h.onDeleteCharacter).not.toHaveBeenCalled();
  });

  it('the New Character button routes to the creation flow', () => {
    const h = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'New Character' }));
    expect(h.onCreateCharacter).toHaveBeenCalled();
  });

  it('Escape closes the sheet when not renaming', () => {
    const h = renderSheet();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(h.onClose).toHaveBeenCalled();
  });

  it('shows an empty message when there are no characters', () => {
    renderSheet({ characters: [], activeId: '' });
    expect(screen.getByText('No characters saved')).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <CharacterManagementSheet
        isOpen={false}
        onClose={vi.fn()}
        characters={CHARS}
        activeId="a"
        onSwitchCharacter={vi.fn()}
        onCreateCharacter={vi.fn()}
        onRenameCharacter={vi.fn()}
        onDuplicateCharacter={vi.fn()}
        onDeleteCharacter={vi.fn()}
        triggerRef={createRef<HTMLButtonElement>()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
