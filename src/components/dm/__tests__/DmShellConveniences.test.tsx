import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import App from '../../../App';
import { DM_MODE_KEY } from '../../../logic/dm-mode';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import {
  DM_BACKUP_DISMISSED_KEY,
  DM_LAST_EXPORT_KEY,
  getDmBackupNudge,
  getDmLastExportAt,
} from '../../../storage/dm-backup';
import { BACKUP_STALE_DAYS } from '../../../storage/backup-reminder';
import { SHORTCUT_GROUPS, DM_SHORTCUT_GROUPS } from '../../../config/shortcuts';
import { buildSearchIndex } from '../../command-palette/searchIndex';

const DAY = 24 * 60 * 60 * 1000;

function seedDmData(campaigns: number) {
  localStorage.setItem(
    DM_DATA_KEY,
    JSON.stringify({
      version: 1,
      campaigns: Array.from({ length: campaigns }, (_, i) => ({
        id: `c${i}`,
        name: `Campaign ${i}`,
        notes: '',
        partyMemberIds: [],
        createdAt: 0,
        updatedAt: 0,
      })),
    }),
  );
}

async function renderDmApp(hash = '#dm/party') {
  localStorage.setItem(DM_MODE_KEY, 'true');
  window.location.hash = hash;
  await act(async () => {
    render(<App />);
  });
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
});

describe('DM palette index and shortcut groups', () => {
  it('offers one "Go to" page entry per DM page and no player pages', () => {
    const index = buildSearchIndex(undefined, true);
    const pages = index.filter((e) => e.type === 'page');
    expect(pages.map((e) => e.name)).toEqual([
      'Go to Campaign',
      'Go to Party',
      'Go to Encounter',
      'Go to Library',
      'Go to Journal',
      'Go to Generators',
      'Go to Treasure',
      'Go to Party XP',
      'Go to Settings',
    ]);
    expect(index.filter((e) => e.type === 'action').map((e) => e.id)).toEqual(['action-toggle-theme']);
  });

  it('documents DM keys 1-9 and leaves the player groups untouched', () => {
    const keys = DM_SHORTCUT_GROUPS[0].shortcuts.map((s) => s.keys);
    expect(keys).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(SHORTCUT_GROUPS[0].title).toBe('Navigation');
  });
});

describe('DM shell conveniences (App)', () => {
  it('opens the command palette with Ctrl+K and navigates to a DM page', async () => {
    await renderDmApp('#dm/campaign');
    await act(async () => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });
    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'go to treasure' } });
    fireEvent.click(screen.getByTestId('result-dm-page-treasure'));
    expect(window.location.hash).toBe('#dm/treasure');
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
  });

  it('shows the DM page shortcuts in the overlay, opened from the palette', async () => {
    await renderDmApp();
    await act(async () => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Keyboard Shortcuts' }));
    const overlay = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(overlay).getByText('Dungeon Master pages')).toBeInTheDocument();
    expect(within(overlay).getByText('Go to Party XP')).toBeInTheDocument();
    expect(within(overlay).getByText('9')).toBeInTheDocument();
  });

  it('reaches the dice roller from DM mode', async () => {
    await renderDmApp();
    fireEvent.click(screen.getByRole('button', { name: 'Open dice roller' }));
    expect(screen.getByRole('dialog', { name: 'd20 Roll' })).toBeInTheDocument();
  });
});

describe('DM backup nudge', () => {
  it('pure rule: needs campaigns and the player 14-day threshold', () => {
    const now = 100 * DAY;
    expect(BACKUP_STALE_DAYS).toBe(14);
    expect(getDmBackupNudge(false, null, now).show).toBe(false);
    expect(getDmBackupNudge(true, null, now).show).toBe(true);
    expect(getDmBackupNudge(true, now - 13 * DAY, now).show).toBe(false);
    expect(getDmBackupNudge(true, now - 14 * DAY, now).show).toBe(true);
  });

  it('appears when never exported, and a dismissal persists across reloads', async () => {
    seedDmData(1);
    const first = await (async () => {
      await renderDmApp();
      return screen.getByTestId('dm-backup-nudge');
    })();
    expect(first).toHaveTextContent('not exported them yet');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss backup reminder' }));
    expect(screen.queryByTestId('dm-backup-nudge')).not.toBeInTheDocument();
    expect(localStorage.getItem(DM_BACKUP_DISMISSED_KEY)).toBe('never');
  });

  it('stays hidden after a dismissal, then returns once a later export goes stale', async () => {
    seedDmData(1);
    localStorage.setItem(DM_BACKUP_DISMISSED_KEY, 'never');
    await renderDmApp();
    expect(screen.queryByTestId('dm-backup-nudge')).not.toBeInTheDocument();
    // A new, now stale export changes the marker, so the dismissal no longer applies.
    localStorage.setItem(DM_LAST_EXPORT_KEY, String(Date.now() - 20 * DAY));
    document.body.innerHTML = '';
    await renderDmApp();
    expect(screen.getByTestId('dm-backup-nudge')).toHaveTextContent('20 days');
  });

  it('is silent after a recent export or with no campaigns', async () => {
    seedDmData(1);
    localStorage.setItem(DM_LAST_EXPORT_KEY, String(Date.now() - DAY));
    await renderDmApp();
    expect(screen.queryByTestId('dm-backup-nudge')).not.toBeInTheDocument();
  });

  it('"Back up now" opens DM settings, and exporting records the time and hides the nudge', async () => {
    seedDmData(1);
    URL.createObjectURL = () => 'blob:test';
    URL.revokeObjectURL = () => {};
    await renderDmApp();
    fireEvent.click(screen.getByRole('button', { name: 'Back up now' }));
    expect(window.location.hash).toBe('#dm/settings');
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    fireEvent.click(screen.getByRole('button', { name: /Export DM data/ }));
    expect(getDmLastExportAt()).not.toBeNull();
    expect(screen.queryByTestId('dm-backup-nudge')).not.toBeInTheDocument();
  });
});