import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { indexedDB } from 'fake-indexeddb';
import { useCharacterManager } from '../useCharacterManager';
import {
  createCharacter as storeCreateCharacter,
  saveCharacter,
  _resetDbForTests,
} from '../../storage/character-store';
import { _resetPortraitDbForTests } from '../../storage/portrait-store';

beforeEach(async () => {
  _resetDbForTests();
  _resetPortraitDbForTests();
  localStorage.clear();
  for (const name of ['dnd-char-sheet', 'dnd-portraits']) {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCharacterManager', () => {
  it('settles to welcome when the store is empty', async () => {
    const { result } = renderHook(() => useCharacterManager());
    await waitFor(() => expect(result.current.status).toBe('welcome'));
    expect(result.current.activeCharacter).toBeNull();
    expect(result.current.characters).toHaveLength(0);
  });

  it('settles to ready with the active character when one exists', async () => {
    await saveCharacter(storeCreateCharacter('Existing'));
    const { result } = renderHook(() => useCharacterManager());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.activeCharacter?.name).toBe('Existing');
    expect(result.current.characters).toHaveLength(1);
  });

  it('adoptCharacter adds a character and makes it active', async () => {
    const { result } = renderHook(() => useCharacterManager());
    await waitFor(() => expect(result.current.status).toBe('welcome'));
    await act(async () => {
      await result.current.adoptCharacter(storeCreateCharacter('Hero'));
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.activeCharacter?.name).toBe('Hero');
    expect(result.current.characters).toHaveLength(1);
  });

  it('updateActiveCharacter reflects an edit in the active character and the list', async () => {
    await saveCharacter(storeCreateCharacter('Edited'));
    const { result } = renderHook(() => useCharacterManager());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const edited = { ...result.current.activeCharacter!, name: 'Renamed Inline' };
    act(() => result.current.updateActiveCharacter(edited));
    expect(result.current.activeCharacter?.name).toBe('Renamed Inline');
    expect(result.current.characters[0].name).toBe('Renamed Inline');
  });

  it('switchCharacter changes the active character', async () => {
    const a = await saveCharacter(storeCreateCharacter('Alpha'));
    await new Promise((r) => setTimeout(r, 2));
    await saveCharacter(storeCreateCharacter('Beta'));
    const { result } = renderHook(() => useCharacterManager());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    // Newest (Beta) is active initially.
    expect(result.current.activeCharacter?.name).toBe('Beta');
    await act(async () => {
      await result.current.switchCharacter(a.id);
    });
    expect(result.current.activeCharacter?.name).toBe('Alpha');
    expect(result.current.activeId).toBe(a.id);
  });

  it('duplicateCharacter adds a copy and makes it active', async () => {
    await saveCharacter(storeCreateCharacter('Original'));
    const { result } = renderHook(() => useCharacterManager());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.duplicateCharacter(result.current.activeId);
    });
    expect(result.current.characters).toHaveLength(2);
    expect(result.current.activeCharacter?.name).toBe('Original (Copy)');
  });

  it('deleting the active character falls back to the next most-recent', async () => {
    const a = await saveCharacter(storeCreateCharacter('Alpha'));
    await new Promise((r) => setTimeout(r, 2));
    const b = await saveCharacter(storeCreateCharacter('Beta'));
    const { result } = renderHook(() => useCharacterManager());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.activeId).toBe(b.id); // Beta active
    await act(async () => {
      await result.current.deleteCharacter(b.id);
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.activeId).toBe(a.id);
    expect(result.current.characters).toHaveLength(1);
  });

  it('deleting the last character returns to welcome', async () => {
    const a = await saveCharacter(storeCreateCharacter('OnlyOne'));
    const { result } = renderHook(() => useCharacterManager());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => {
      await result.current.deleteCharacter(a.id);
    });
    expect(result.current.status).toBe('welcome');
    expect(result.current.activeCharacter).toBeNull();
    expect(result.current.characters).toHaveLength(0);
  });
});
