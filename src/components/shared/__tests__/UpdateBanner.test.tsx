import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { UpdateBanner } from '../UpdateBanner';

// Mock the useSWUpdate hook so we can drive banner state directly.
const mockUseSWUpdate = vi.fn();
vi.mock('../../../hooks/useSWUpdate', () => ({
  useSWUpdate: () => mockUseSWUpdate(),
}));

describe('UpdateBanner', () => {
  const defaultState = {
    updateAvailable: false,
    applying: false,
    error: null,
    applyUpdate: vi.fn(),
    dismiss: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSWUpdate.mockReturnValue(defaultState);
  });

  it('renders nothing when updateAvailable is false', () => {
    const { container } = render(<UpdateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a banner when updateAvailable is true', () => {
    mockUseSWUpdate.mockReturnValue({ ...defaultState, updateAvailable: true });

    render(<UpdateBanner />);

    expect(screen.getByText('A new version is available')).toBeInTheDocument();
  });

  it('displays Reload and Dismiss buttons', () => {
    mockUseSWUpdate.mockReturnValue({ ...defaultState, updateAvailable: true });

    render(<UpdateBanner />);

    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('calls applyUpdate when Reload is clicked', async () => {
    const applyUpdate = vi.fn();
    mockUseSWUpdate.mockReturnValue({ ...defaultState, updateAvailable: true, applyUpdate });
    const user = userEvent.setup();

    render(<UpdateBanner />);
    await user.click(screen.getByRole('button', { name: 'Reload' }));

    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('calls dismiss when Dismiss is clicked', async () => {
    const dismiss = vi.fn();
    mockUseSWUpdate.mockReturnValue({ ...defaultState, updateAvailable: true, dismiss });
    const user = userEvent.setup();

    render(<UpdateBanner />);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('shows "Updating…" text and disables buttons while applying', () => {
    mockUseSWUpdate.mockReturnValue({ ...defaultState, updateAvailable: true, applying: true });

    render(<UpdateBanner />);

    expect(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDisabled();
  });

  it('displays error message and Try Again button in error state', () => {
    mockUseSWUpdate.mockReturnValue({
      ...defaultState,
      updateAvailable: true,
      error: 'Update failed — try reloading manually',
    });

    render(<UpdateBanner />);

    expect(screen.getByText('Update failed — try reloading manually')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('calls applyUpdate when Try Again is clicked in error state', async () => {
    const applyUpdate = vi.fn();
    mockUseSWUpdate.mockReturnValue({
      ...defaultState,
      updateAvailable: true,
      error: 'Update failed',
      applyUpdate,
    });
    const user = userEvent.setup();

    render(<UpdateBanner />);
    await user.click(screen.getByRole('button', { name: 'Try Again' }));

    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('has role="status" for accessibility (ARIA live region)', () => {
    mockUseSWUpdate.mockReturnValue({ ...defaultState, updateAvailable: true });

    render(<UpdateBanner />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders as a fixed-position banner (via CSS module class)', () => {
    mockUseSWUpdate.mockReturnValue({ ...defaultState, updateAvailable: true });

    render(<UpdateBanner />);

    const banner = screen.getByRole('status');
    expect(banner.className).toMatch(/banner/);
  });
});
