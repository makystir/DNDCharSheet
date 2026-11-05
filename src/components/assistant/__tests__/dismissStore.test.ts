import { describe, it, expect, beforeEach } from 'vitest';
import { dismissStore, DISMISS_STORAGE_KEY, SNOOZE_DURATION_MS } from '../dismissStore';

describe('dismissStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty and persists a dismiss that survives a re-read (rehydrate)', () => {
    expect(dismissStore.read()).toEqual({ dismissed: [], snoozedUntil: {} });

    dismissStore.dismiss('encumbrance:over');
    // Persisted to the dedicated key.
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    // A fresh read reflects the persisted value.
    expect(dismissStore.read().dismissed).toContain('encumbrance:over');
  });

  it('dismiss is idempotent', () => {
    dismissStore.dismiss('x');
    dismissStore.dismiss('x');
    expect(dismissStore.read().dismissed).toEqual(['x']);
  });

  it('snooze records an expiry 24h out and rehydrates', () => {
    const now = 1_000_000;
    dismissStore.snooze('rest:exhaustion', now);
    expect(dismissStore.read().snoozedUntil['rest:exhaustion']).toBe(now + SNOOZE_DURATION_MS);
  });

  it('pruneDismissed drops ids no longer active and keeps active ones', () => {
    dismissStore.dismiss('keep');
    dismissStore.dismiss('drop');
    dismissStore.snooze('snooze-keep', 1000);
    dismissStore.snooze('snooze-drop', 1000);

    const pruned = dismissStore.pruneDismissed(new Set(['keep', 'snooze-keep']));
    expect(pruned.dismissed).toEqual(['keep']);
    expect(Object.keys(pruned.snoozedUntil)).toEqual(['snooze-keep']);
    // Persisted.
    expect(dismissStore.read().dismissed).toEqual(['keep']);
  });

  it('pruneDismissed is a no-op write when nothing changed', () => {
    dismissStore.dismiss('a');
    const before = localStorage.getItem(DISMISS_STORAGE_KEY);
    const result = dismissStore.pruneDismissed(new Set(['a']));
    expect(result.dismissed).toEqual(['a']);
    expect(localStorage.getItem(DISMISS_STORAGE_KEY)).toBe(before);
  });

  it('degrades to an empty record on malformed JSON', () => {
    localStorage.setItem(DISMISS_STORAGE_KEY, '{not json');
    expect(dismissStore.read()).toEqual({ dismissed: [], snoozedUntil: {} });
  });
});
