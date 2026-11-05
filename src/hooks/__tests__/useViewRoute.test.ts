import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewRoute } from '../useViewRoute';

/** useViewRoute returns null for a non-view hash and the payload for a view hash. */
function setHash(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('useViewRoute', () => {
  afterEach(() => {
    act(() => {
      window.location.hash = '';
    });
  });

  it('returns null for a non-view hash', () => {
    setHash('#character');
    const { result } = renderHook(() => useViewRoute());
    expect(result.current).toBeNull();
  });

  it('returns the encoded payload for a #view/ hash', () => {
    setHash('#view/ABC123');
    const { result } = renderHook(() => useViewRoute());
    expect(result.current).toBe('ABC123');
  });

  it('updates reactively when the hash changes to/from a view route', () => {
    setHash('#combat');
    const { result } = renderHook(() => useViewRoute());
    expect(result.current).toBeNull();

    setHash('#view/PAYLOAD');
    expect(result.current).toBe('PAYLOAD');

    setHash('#character');
    expect(result.current).toBeNull();
  });
});
