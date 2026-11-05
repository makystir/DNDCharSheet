import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { SWUpdateListener, SWUpdateState } from '../../sw/types';

/**
 * Tests for the SWUpdate hook/provider SHAPE (B4).
 *
 * The provider does NOT reimplement service-worker update detection — it wraps
 * the existing `registerServiceWorker` handle from sw-register.ts. These tests
 * mock that module so we can assert the provider:
 *   - registers EXACTLY ONCE (single-registration hazard),
 *   - reflects the handle's subscribed state into context,
 *   - delegates applyUpdate()/dismiss() to the same handle.
 *
 * The provider gates registration on `import.meta.env.PROD`, so we force PROD
 * true for these tests via vi.stubEnv.
 */

// Shared mock handle captured by the mocked registerServiceWorker.
let lastListener: SWUpdateListener | null = null;
const applyUpdateMock = vi.fn().mockResolvedValue(undefined);
const dismissMock = vi.fn();
const unsubscribeMock = vi.fn();
const registerMock = vi.fn((_baseUrl: string) => ({
  subscribe: (listener: SWUpdateListener) => {
    lastListener = listener;
    // Mirror the real handle: notify immediately with the initial state.
    listener({ updateAvailable: false, applying: false, error: null });
    return unsubscribeMock;
  },
  applyUpdate: applyUpdateMock,
  dismiss: dismissMock,
}));

vi.mock('../../sw-register', () => ({
  registerServiceWorker: (baseUrl: string) => registerMock(baseUrl),
}));

// Import after the mock is registered.
import { SWUpdateProvider, useSWUpdate } from '../useSWUpdate';

/** Probe component that renders the context value + buttons to invoke actions. */
function Probe() {
  const { updateAvailable, applying, error, applyUpdate, dismiss } = useSWUpdate();
  return (
    <div>
      <span data-testid="updateAvailable">{String(updateAvailable)}</span>
      <span data-testid="applying">{String(applying)}</span>
      <span data-testid="error">{String(error)}</span>
      <button type="button" onClick={applyUpdate}>
        apply
      </button>
      <button type="button" onClick={dismiss}>
        dismiss
      </button>
    </div>
  );
}

/** Push a new state through the captured subscribe listener. */
function pushState(state: SWUpdateState) {
  act(() => {
    lastListener?.(state);
  });
}

describe('SWUpdateProvider / useSWUpdate', () => {
  beforeEach(() => {
    vi.stubEnv('PROD', true);
    lastListener = null;
    registerMock.mockClear();
    applyUpdateMock.mockClear();
    dismissMock.mockClear();
    unsubscribeMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('registers the service worker exactly once (single-registration hazard)', () => {
    render(
      <SWUpdateProvider>
        <Probe />
      </SWUpdateProvider>,
    );

    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it('starts with no update available and reflects the handle initial state', () => {
    render(
      <SWUpdateProvider>
        <Probe />
      </SWUpdateProvider>,
    );

    expect(screen.getByTestId('updateAvailable')).toHaveTextContent('false');
    expect(screen.getByTestId('applying')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toHaveTextContent('null');
  });

  it('reflects subscribed state changes from the handle', () => {
    render(
      <SWUpdateProvider>
        <Probe />
      </SWUpdateProvider>,
    );

    pushState({ updateAvailable: true, applying: false, error: null });
    expect(screen.getByTestId('updateAvailable')).toHaveTextContent('true');

    pushState({ updateAvailable: true, applying: true, error: null });
    expect(screen.getByTestId('applying')).toHaveTextContent('true');

    pushState({ updateAvailable: true, applying: false, error: 'boom' });
    expect(screen.getByTestId('error')).toHaveTextContent('boom');
  });

  it('delegates applyUpdate() and dismiss() to the same handle', async () => {
    render(
      <SWUpdateProvider>
        <Probe />
      </SWUpdateProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'apply' }).click();
    });
    expect(applyUpdateMock).toHaveBeenCalledTimes(1);

    act(() => {
      screen.getByRole('button', { name: 'dismiss' }).click();
    });
    expect(dismissMock).toHaveBeenCalledTimes(1);
  });

  it('does not register the service worker outside production', () => {
    vi.stubEnv('PROD', false);
    render(
      <SWUpdateProvider>
        <Probe />
      </SWUpdateProvider>,
    );

    expect(registerMock).not.toHaveBeenCalled();
  });

  it('unsubscribes from the handle on unmount', () => {
    const { unmount } = render(
      <SWUpdateProvider>
        <Probe />
      </SWUpdateProvider>,
    );

    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
