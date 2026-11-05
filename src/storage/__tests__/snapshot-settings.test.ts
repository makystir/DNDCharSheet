import { describe, it, expect, beforeEach } from 'vitest';
import {
  isAutoBackupEnabled,
  setAutoBackupEnabled,
  AUTO_BACKUP_ENABLED_KEY,
} from '../snapshot-settings';

/**
 * Unit tests for the B3 auto-backup toggle persistence (design §5/§7):
 * default ON, explicit 'false' ⇒ off, round-trip. Uses the real jsdom
 * localStorage (the shared `local-storage.ts` wrappers read/write it).
 */

beforeEach(() => {
  localStorage.clear();
});

describe('snapshot-settings', () => {
  it('defaults to enabled when the flag is absent', () => {
    expect(isAutoBackupEnabled()).toBe(true);
  });

  it('only the explicit string "false" disables it', () => {
    localStorage.setItem(AUTO_BACKUP_ENABLED_KEY, 'false');
    expect(isAutoBackupEnabled()).toBe(false);

    localStorage.setItem(AUTO_BACKUP_ENABLED_KEY, 'true');
    expect(isAutoBackupEnabled()).toBe(true);

    localStorage.setItem(AUTO_BACKUP_ENABLED_KEY, 'anything-else');
    expect(isAutoBackupEnabled()).toBe(true);
  });

  it('round-trips through setAutoBackupEnabled', () => {
    setAutoBackupEnabled(false);
    expect(isAutoBackupEnabled()).toBe(false);
    setAutoBackupEnabled(true);
    expect(isAutoBackupEnabled()).toBe(true);
  });
});
