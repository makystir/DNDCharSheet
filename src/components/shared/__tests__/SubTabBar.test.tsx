import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { SubTabBar } from '../SubTabBar';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'skills', label: 'Skills & Saves' },
  { id: 'species', label: 'Species' },
  { id: 'class', label: 'Class & Features' },
];

function editModeProps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    isActive: false,
    onToggle: vi.fn(),
    onMoveLeft: vi.fn(),
    onMoveRight: vi.fn(),
    onReset: vi.fn(),
    isDefaultOrder: true,
    saveError: false,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SubTabBar — plain (no editMode)', () => {
  it('renders a role=tablist with role=tab children', () => {
    render(<SubTabBar tabs={TABS} activeTab="overview" onTabChange={vi.fn()} />);
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('marks the active tab with aria-selected and fires onTabChange on click', () => {
    const onTabChange = vi.fn();
    render(<SubTabBar tabs={TABS} activeTab="overview" onTabChange={onTabChange} />);
    const skills = screen.getByRole('tab', { name: 'Skills & Saves' });
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(skills);
    expect(onTabChange).toHaveBeenCalledWith('skills');
  });
});

describe('SubTabBar — edit mode', () => {
  it('shows the edit toggle by default whenever reordering is available', () => {
    render(
      <SubTabBar
        tabs={TABS}
        activeTab="overview"
        onTabChange={vi.fn()}
        editMode={editModeProps()}
      />,
    );
    // Discoverable without any gesture: the pencil is present on first render.
    expect(screen.getByRole('button', { name: 'Edit tab order' })).toBeInTheDocument();
  });

  it('keeps the edit toggle visible after a long-press (no longer a reveal gate)', () => {
    vi.useFakeTimers();
    render(
      <SubTabBar
        tabs={TABS}
        activeTab="overview"
        onTabChange={vi.fn()}
        editMode={editModeProps()}
      />,
    );
    const tablist = screen.getByRole('tablist');
    fireEvent.pointerDown(tablist);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('button', { name: 'Edit tab order' })).toBeInTheDocument();
  });

  it('keeps the edit toggle visible after a context menu (no longer a reveal gate)', () => {
    render(
      <SubTabBar
        tabs={TABS}
        activeTab="overview"
        onTabChange={vi.fn()}
        editMode={editModeProps()}
      />,
    );
    fireEvent.contextMenu(screen.getByRole('tablist'));
    expect(screen.getByRole('button', { name: 'Edit tab order' })).toBeInTheDocument();
  });

  it('renders no edit toggle when reordering is unavailable (no editMode prop)', () => {
    render(<SubTabBar tabs={TABS} activeTab="overview" onTabChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Edit tab order' })).toBeNull();
  });

  it('shows chevron buttons in active edit mode and calls move handlers', () => {
    const onMoveRight = vi.fn();
    const onMoveLeft = vi.fn();
    render(
      <SubTabBar
        tabs={TABS}
        activeTab="overview"
        onTabChange={vi.fn()}
        editMode={editModeProps({ isActive: true, isDefaultOrder: false, onMoveRight, onMoveLeft })}
      />,
    );
    // Overview (index 0): left disabled, right enabled.
    fireEvent.click(screen.getByRole('button', { name: 'Move Overview tab right' }));
    expect(onMoveRight).toHaveBeenCalledWith(0);

    // Skills (index 1): left enabled.
    fireEvent.click(screen.getByRole('button', { name: 'Move Skills & Saves tab left' }));
    expect(onMoveLeft).toHaveBeenCalledWith(1);
  });

  it('announces the new position via the aria-live region on a move', () => {
    const { container } = render(
      <SubTabBar
        tabs={TABS}
        activeTab="overview"
        onTabChange={vi.fn()}
        editMode={editModeProps({ isActive: true, isDefaultOrder: false })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move Overview tab right' }));
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe('Overview tab, position 2 of 4');
  });

  it('reset calls onReset and is disabled when order is default', () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <SubTabBar
        tabs={TABS}
        activeTab="overview"
        onTabChange={vi.fn()}
        editMode={editModeProps({ isActive: true, isDefaultOrder: true, onReset })}
      />,
    );
    const resetBtn = screen.getByRole('button', { name: 'Reset tab order' });
    expect(resetBtn).toBeDisabled();

    rerender(
      <SubTabBar
        tabs={TABS}
        activeTab="overview"
        onTabChange={vi.fn()}
        editMode={editModeProps({ isActive: true, isDefaultOrder: false, onReset })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset tab order' }));
    expect(onReset).toHaveBeenCalled();
  });

  it('does not move past the first/last boundary', () => {
    const onMoveLeft = vi.fn();
    const onMoveRight = vi.fn();
    render(
      <SubTabBar
        tabs={TABS}
        activeTab="overview"
        onTabChange={vi.fn()}
        editMode={editModeProps({ isActive: true, onMoveLeft, onMoveRight })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move Overview tab left' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Class & Features tab right' }));
    expect(onMoveLeft).not.toHaveBeenCalled();
    expect(onMoveRight).not.toHaveBeenCalled();
  });
});
