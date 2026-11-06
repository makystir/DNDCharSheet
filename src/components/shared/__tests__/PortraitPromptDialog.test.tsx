import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { PortraitPromptDialog } from '../PortraitPromptDialog';
import { createCharacter } from '../../../storage/character-store';
import { PORTRAIT_PROMPT_PREFS_KEY } from '../../../logic/portrait-prompt-prefs';

const character = { ...createCharacter('Tester'), gender: 'female' as const };

function promptText(): string {
  return (screen.getByLabelText('Generated portrait prompt') as HTMLTextAreaElement).value;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PortraitPromptDialog', () => {
  it('renders a read-only textarea with the prompt', () => {
    render(<PortraitPromptDialog character={character} onClose={vi.fn()} />);
    const ta = screen.getByLabelText('Generated portrait prompt') as HTMLTextAreaElement;
    expect(ta.readOnly).toBe(true);
    expect(ta.value).toContain('Name: Tester.');
    expect(ta.value).toMatch(/waist or chest up/);
  });

  it('has no retinue toggle (the D&D model has no companions)', () => {
    render(<PortraitPromptDialog character={character} onClose={vi.fn()} />);
    expect(screen.queryByText(/retinue/i)).toBeNull();
  });

  it('copies the prompt and shows the copied state with a live-region message', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<PortraitPromptDialog character={character} onClose={vi.fn()} />);
    const expected = promptText();
    fireEvent.click(screen.getByRole('button', { name: /copy prompt/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /copied!/i })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(expected);
    expect(screen.getByRole('status')).toHaveTextContent('Prompt copied to clipboard');
  });

  it('framing, style, mood and extra-details controls update the prompt', () => {
    render(<PortraitPromptDialog character={character} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Full body' }));
    expect(promptText()).toMatch(/head to toe/);
    fireEvent.change(screen.getByLabelText('Art style'), { target: { value: 'comic' } });
    expect(promptText()).toContain('Graphic novel illustration');
    fireEvent.change(screen.getByLabelText('Expression'), { target: { value: 'stern' } });
    expect(promptText()).toContain('Expression: stern');
    fireEvent.change(screen.getByLabelText('Extra details (optional)'), {
      target: { value: 'wears a red scarf' },
    });
    expect(promptText()).toContain('Additional details: wears a red scarf');
  });

  it('Escape and Close call onClose', () => {
    const onClose = vi.fn();
    render(<PortraitPromptDialog character={character} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('persists the chosen prefs and restores them on the next open', () => {
    const { unmount } = render(<PortraitPromptDialog character={character} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Full body' }));
    fireEvent.change(screen.getByLabelText('Art style'), { target: { value: 'storybook' } });
    expect(JSON.parse(localStorage.getItem(PORTRAIT_PROMPT_PREFS_KEY)!)).toMatchObject({
      framing: 'fullBody',
      style: 'storybook',
    });
    unmount();
    render(<PortraitPromptDialog character={character} onClose={vi.fn()} />);
    expect((screen.getByLabelText('Art style') as HTMLSelectElement).value).toBe('storybook');
    expect(screen.getByRole('radio', { name: 'Full body' })).toHaveAttribute('aria-checked', 'true');
  });

  it('ignores invalid stored prefs and does not throw when storage fails', () => {
    localStorage.setItem(PORTRAIT_PROMPT_PREFS_KEY, '{not json');
    render(<PortraitPromptDialog character={character} onClose={vi.fn()} />);
    expect((screen.getByLabelText('Art style') as HTMLSelectElement).value).toBe('oilPainting');
    cleanup();

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => {
      render(<PortraitPromptDialog character={character} onClose={vi.fn()} />);
      fireEvent.change(screen.getByLabelText('Expression'), { target: { value: 'weary' } });
    }).not.toThrow();
    expect(promptText()).toContain('Expression: weary');
  });

  it('does not change the character', () => {
    const snapshot = JSON.stringify(character);
    render(<PortraitPromptDialog character={character} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Art style'), { target: { value: 'comic' } });
    expect(JSON.stringify(character)).toBe(snapshot);
  });
});
