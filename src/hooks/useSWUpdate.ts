import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import type { SWUpdateState } from '../sw/types';
import { registerServiceWorker } from '../sw-register';

/**
 * Values exposed by the SWUpdate context to consuming components.
 */
export interface SWUpdateContextValue {
  updateAvailable: boolean;
  applying: boolean;
  error: string | null;
  applyUpdate: () => void;
  dismiss: () => void;
}

const defaultValue: SWUpdateContextValue = {
  updateAvailable: false,
  applying: false,
  error: null,
  applyUpdate: () => {},
  dismiss: () => {},
};

const SWUpdateContext = createContext<SWUpdateContextValue>(defaultValue);

/**
 * Provider that registers the service worker (production only) and surfaces
 * update state to the component tree via context.
 *
 * This is the SINGLE service-worker registration point for the app: it wraps
 * the existing `registerServiceWorker` handle from sw-register.ts (which owns
 * all update detection — waiting worker, updatefound/statechange, periodic
 * reg.update(), SKIP_WAITING, controllerchange reload). main.tsx must NOT
 * register separately; a duplicate registration races with this provider and
 * update notifications get missed.
 */
export function SWUpdateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SWUpdateState>({
    updateAvailable: false,
    applying: false,
    error: null,
  });

  // Keep stable references to the registration API methods
  const apiRef = useRef<{
    applyUpdate: () => Promise<void>;
    dismiss: () => void;
  } | null>(null);

  useEffect(() => {
    // Only register service worker in production
    if (!import.meta.env.PROD) return;

    const api = registerServiceWorker(import.meta.env.BASE_URL);
    apiRef.current = api;

    const unsubscribe = api.subscribe((newState: SWUpdateState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
      apiRef.current = null;
    };
  }, []);

  const applyUpdate = useCallback(() => {
    void apiRef.current?.applyUpdate();
  }, []);

  const dismiss = useCallback(() => {
    apiRef.current?.dismiss();
  }, []);

  const value: SWUpdateContextValue = {
    updateAvailable: state.updateAvailable,
    applying: state.applying,
    error: state.error,
    applyUpdate,
    dismiss,
  };

  // `value` carries applyUpdate/dismiss, which read apiRef.current — but only
  // when invoked from user events, never during render. The compiler can't
  // prove that statically, so the ref-in-render check is suppressed here.
  // eslint-disable-next-line react-hooks/refs
  return createElement(SWUpdateContext.Provider, { value }, children);
}

/**
 * Hook that reads the current service worker update state from context.
 * Must be used within a <SWUpdateProvider>.
 */
export function useSWUpdate(): SWUpdateContextValue {
  return useContext(SWUpdateContext);
}
