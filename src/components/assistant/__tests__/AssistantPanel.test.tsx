import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import type { Suggestion } from '../../../logic/assistant/types';
import { AssistantProvider } from '../AssistantContext';
import { useAssistantContext } from '../assistantContextValue';
import { AssistantPanel } from '../AssistantPanel';
import type { AssistantPanelProps } from '../AssistantPanel';

afterEach(() => cleanup());

/** Opens the panel on mount so the portal content is present. */
function AutoOpen() {
  const { open } = useAssistantContext();
  return (
    <button type="button" data-testid="open-trigger" onClick={open}>
      open
    </button>
  );
}

function renderPanel(props: Partial<AssistantPanelProps> = {}) {
  const onAction = props.onAction ?? vi.fn();
  const onDismiss = props.onDismiss ?? vi.fn();
  const onSnooze = props.onSnooze ?? vi.fn();
  const utils = render(
    <AssistantProvider>
      <AutoOpen />
      <AssistantPanel
        suggestions={props.suggestions ?? []}
        onAction={onAction}
        onDismiss={onDismiss}
        onSnooze={onSnooze}
      />
    </AssistantProvider>,
  );
  // Open the drawer.
  act(() => {
    fireEvent.click(screen.getByTestId('open-trigger'));
  });
  return { ...utils, onAction, onDismiss, onSnooze };
}

const SUGGESTIONS: Suggestion[] = [
  {
    id: 'advancement:ready',
    title: 'You can level up',
    rationale: 'Milestone mode.',
    category: 'advancement',
    urgency: 'recommended',
    action: { kind: 'navigate', page: 'advancement' },
    citation: 'PHB 2024 "Character Advancement"',
  },
  {
    id: 'encumbrance:over',
    title: 'You are over your carrying capacity',
    rationale: 'Too heavy.',
    category: 'encumbrance',
    urgency: 'critical',
    action: { kind: 'navigate', page: 'inventory' },
    totals: [
      {
        label: 'Carried weight',
        display: '500 / 120 lb',
        breakdown: { total: 500, components: [{ label: 'Other gear', value: 500 }] },
      },
    ],
  },
];

describe('AssistantPanel', () => {
  it('renders closed (nothing) until opened', () => {
    render(
      <AssistantProvider>
        <AssistantPanel suggestions={SUGGESTIONS} onAction={vi.fn()} onDismiss={vi.fn()} onSnooze={vi.fn()} />
      </AssistantProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens as a modal dialog with the suggestions grouped by category', () => {
    renderPanel({ suggestions: SUGGESTIONS });
    const dialog = screen.getByRole('dialog', { name: 'Character Assistant' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('You can level up')).toBeInTheDocument();
    expect(screen.getByText('You are over your carrying capacity')).toBeInTheDocument();
    // Group headings.
    expect(screen.getByText('Advancement')).toBeInTheDocument();
    expect(screen.getByText('Encumbrance')).toBeInTheDocument();
  });

  it('shows an empty state when there are no suggestions', () => {
    renderPanel({ suggestions: [] });
    expect(screen.getByText('No suggestions right now.')).toBeInTheDocument();
  });

  it('a one-tap primary action invokes onAction with the serializable descriptor', () => {
    const { onAction } = renderPanel({ suggestions: SUGGESTIONS });
    fireEvent.click(screen.getByRole('button', { name: 'Open Advancement' }));
    expect(onAction).toHaveBeenCalledWith({ kind: 'navigate', page: 'advancement' });
  });

  it('dismiss and snooze invoke their callbacks with the suggestion id', () => {
    const { onDismiss, onSnooze } = renderPanel({ suggestions: [SUGGESTIONS[0]] });
    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissButtons[0]);
    expect(onDismiss).toHaveBeenCalledWith('advancement:ready');
    fireEvent.click(screen.getAllByRole('button', { name: 'Snooze' })[0]);
    expect(onSnooze).toHaveBeenCalledWith('advancement:ready');
  });

  it('closes on Escape and on backdrop click', () => {
    renderPanel({ suggestions: SUGGESTIONS });
    const dialog = screen.getByRole('dialog');
    act(() => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();

    // Reopen and close via backdrop.
    act(() => {
      fireEvent.click(screen.getByTestId('open-trigger'));
    });
    const backdrop = screen.getByTestId('assistant-panel-backdrop');
    act(() => {
      fireEvent.click(backdrop);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('locks body scroll while open and releases it on close (dialog convention)', () => {
    renderPanel({ suggestions: SUGGESTIONS });
    // While the drawer is open the body scroll is locked.
    expect(document.body.style.overflow).toBe('hidden');
    // Closing the drawer restores the previous overflow value.
    const dialog = screen.getByRole('dialog');
    act(() => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    });
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('renders a calculated total as an explainable value (CalculatedValue)', () => {
    renderPanel({ suggestions: [SUGGESTIONS[1]] });
    // The CalculatedValue trigger exposes the breakdown via its aria-label.
    const total = screen.getByRole('button', { name: /Carried weight/ });
    expect(total.textContent).toContain('500 / 120 lb');
  });
});
