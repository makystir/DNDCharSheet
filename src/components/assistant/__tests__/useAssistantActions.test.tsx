import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SuggestionAction } from '../../../logic/assistant/types';
import { useAssistantActions } from '../useAssistantActions';
import type { AssistantRollSeed } from '../useAssistantActions';
import * as backupService from '../../../storage/backup-service';

describe('useAssistantActions dispatcher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('routes a navigate action to the injected navigate(page, subTab)', () => {
    const navigate = vi.fn();
    const openRoll = vi.fn();

    const { result } = renderHook(() => useAssistantActions({ navigate, openRoll }));

    result.current({ kind: 'navigate', page: 'advancement' });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('advancement', undefined);
    expect(openRoll).not.toHaveBeenCalled();
  });

  it('forwards a subTab through navigate', () => {
    const navigate = vi.fn();
    const openRoll = vi.fn();
    const { result } = renderHook(() => useAssistantActions({ navigate, openRoll }));

    result.current({ kind: 'navigate', page: 'character', subTab: 'skills' });
    expect(navigate).toHaveBeenCalledWith('character', 'skills');
  });

  it('seeds the RollDialog for a roll action (label/dc/initialMode), without navigating', () => {
    const navigate = vi.fn();
    const openRoll = vi.fn<(seed: AssistantRollSeed) => void>();
    const { result } = renderHook(() => useAssistantActions({ navigate, openRoll }));

    const action: SuggestionAction = {
      kind: 'roll',
      label: 'Death Saving Throw',
      dc: 10,
      initialMode: 'normal',
    };
    result.current(action);

    expect(openRoll).toHaveBeenCalledTimes(1);
    expect(openRoll).toHaveBeenCalledWith({
      label: 'Death Saving Throw',
      dc: 10,
      initialMode: 'normal',
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('runs the existing bulk export for a backup-file action and notifies on success', async () => {
    const navigate = vi.fn();
    const openRoll = vi.fn();
    const onFileBackedUp = vi.fn();

    const payload = { version: 1, exportedAt: 'x', characterCount: 1, characters: [] };
    const assembleSpy = vi
      .spyOn(backupService, 'assembleBackup')
      .mockResolvedValue({ ok: true, payload } as never);
    const downloadSpy = vi
      .spyOn(backupService, 'downloadBackup')
      .mockReturnValue({ ok: true });

    const { result } = renderHook(() =>
      useAssistantActions({ navigate, openRoll, onFileBackedUp }),
    );

    result.current({ kind: 'backup-file' });
    // Fire-and-forget: let the async chain settle.
    await vi.waitFor(() => {
      expect(onFileBackedUp).toHaveBeenCalledTimes(1);
    });

    expect(assembleSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy).toHaveBeenCalledWith(payload);
    // No navigation / roll for a backup.
    expect(navigate).not.toHaveBeenCalled();
    expect(openRoll).not.toHaveBeenCalled();
  });

  it('does not notify when the export fails', async () => {
    const onFileBackedUp = vi.fn();
    vi.spyOn(backupService, 'assembleBackup').mockResolvedValue({
      ok: false,
      error: 'No characters',
    } as never);
    const downloadSpy = vi.spyOn(backupService, 'downloadBackup');

    const { result } = renderHook(() =>
      useAssistantActions({ navigate: vi.fn(), openRoll: vi.fn(), onFileBackedUp }),
    );

    result.current({ kind: 'backup-file' });
    await Promise.resolve();
    await Promise.resolve();
    expect(downloadSpy).not.toHaveBeenCalled();
    expect(onFileBackedUp).not.toHaveBeenCalled();
  });
});
