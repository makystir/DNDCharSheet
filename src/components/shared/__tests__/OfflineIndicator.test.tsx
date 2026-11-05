import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OfflineIndicator } from '../OfflineIndicator';

// Drive the indicator by mocking the online-status hook.
const mockUseOnlineStatus = vi.fn();
vi.mock('../../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders nothing when online', () => {
    mockUseOnlineStatus.mockReturnValue(true);
    const { container } = render(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the Offline chip when offline', () => {
    mockUseOnlineStatus.mockReturnValue(false);
    render(<OfflineIndicator />);
    const chip = screen.getByRole('status');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('Offline');
  });

  it('fades out then unmounts after connectivity is restored', () => {
    mockUseOnlineStatus.mockReturnValue(false);
    const { rerender } = render(<OfflineIndicator />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Come back online — chip enters the hiding state but stays mounted...
    mockUseOnlineStatus.mockReturnValue(true);
    rerender(<OfflineIndicator />);
    expect(screen.getByRole('status')).toHaveAttribute('data-hiding', 'true');

    // ...and unmounts after the 1s fade completes.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
