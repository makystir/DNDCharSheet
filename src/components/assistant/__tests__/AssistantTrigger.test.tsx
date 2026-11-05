import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AssistantTrigger } from '../AssistantTrigger';

afterEach(() => cleanup());

describe('AssistantTrigger', () => {
  it('shows a count badge and announces the count when there are suggestions', () => {
    render(<AssistantTrigger count={3} open={vi.fn()} variant="desktop" buttonClassName="btn" />);
    const btn = screen.getByRole('button', { name: 'Assistant, 3 suggestions' });
    expect(btn).toBeInTheDocument();
    // The visible number is present but aria-hidden (announced via the label).
    expect(btn.textContent).toContain('3');
  });

  it('omits the count and uses a plain label when there are no suggestions', () => {
    render(<AssistantTrigger count={0} open={vi.fn()} variant="desktop" buttonClassName="btn" />);
    const btn = screen.getByRole('button', { name: 'Assistant' });
    expect(btn).toBeInTheDocument();
  });

  it('opens the panel on click, never navigating', () => {
    const open = vi.fn();
    render(<AssistantTrigger count={1} open={open} variant="desktop" buttonClassName="btn" />);
    fireEvent.click(screen.getByRole('button', { name: 'Assistant, 1 suggestions' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('collapsed variant renders icon-only (no visible "Assistant" text label)', () => {
    render(<AssistantTrigger count={0} open={vi.fn()} variant="collapsed" buttonClassName="btn" />);
    const btn = screen.getByRole('button', { name: 'Assistant' });
    // Collapsed: the accessible name comes from aria-label, not a text child.
    expect(btn.textContent).toBe('');
  });
});
