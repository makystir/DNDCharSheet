import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBackupReminder,
  recordBackup,
  getLastBackupAt,
  LAST_BACKUP_KEY,
  BACKUP_STALE_DAYS,
} from '../backup-reminder';

const DAY = 24 * 60 * 60 * 1000;

describe('getBackupReminder', () => {
  it('reminds and flags "never" when there is no recorded backup', () => {
    const r = getBackupReminder(null, 1_000_000);
    expect(r.show).toBe(true);
    expect(r.never).toBe(true);
    expect(r.daysSince).toBeNull();
  });

  it('does not remind immediately after a fresh backup', () => {
    const now = 10 * DAY;
    const r = getBackupReminder(now, now);
    expect(r.show).toBe(false);
    expect(r.never).toBe(false);
    expect(r.daysSince).toBe(0);
  });

  it('does not remind before the stale threshold', () => {
    const now = 100 * DAY;
    const last = now - (BACKUP_STALE_DAYS - 1) * DAY;
    const r = getBackupReminder(last, now);
    expect(r.show).toBe(false);
    expect(r.daysSince).toBe(BACKUP_STALE_DAYS - 1);
  });

  it('reminds once the stale threshold is reached', () => {
    const now = 100 * DAY;
    const last = now - BACKUP_STALE_DAYS * DAY;
    const r = getBackupReminder(last, now);
    expect(r.show).toBe(true);
    expect(r.never).toBe(false);
    expect(r.daysSince).toBe(BACKUP_STALE_DAYS);
  });
});

describe('recordBackup / getLastBackupAt', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing is recorded', () => {
    expect(getLastBackupAt()).toBeNull();
  });

  it('round-trips a recorded timestamp', () => {
    recordBackup(1_234_567);
    expect(localStorage.getItem(LAST_BACKUP_KEY)).toBe('1234567');
    expect(getLastBackupAt()).toBe(1_234_567);
  });

  it('treats a non-numeric stored value as null', () => {
    localStorage.setItem(LAST_BACKUP_KEY, 'not-a-number');
    expect(getLastBackupAt()).toBeNull();
  });
});
