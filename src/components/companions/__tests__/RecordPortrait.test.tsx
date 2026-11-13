import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
import { indexedDB } from 'fake-indexeddb';
import { CreaturesTab } from '../CreaturesTab';
import { getPortraitStore, _resetPortraitDbForTests } from '../../../storage/portrait-store';
import type { Character } from '../../../types/character';
import { plainCharacter, rangerCharacter, track, undoStub } from './helpers';
import { Stateful } from './Stateful';

beforeEach(async () => {
  localStorage.clear();
  _resetPortraitDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('dnd-portraits');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:portrait');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderTab(initial: Character, latest?: { current: Character }) {
  render(
    <Stateful initial={initial} onState={latest ? track(latest) : undefined}>
      {(character, onChange) => <CreaturesTab character={character} onChange={onChange} undo={undoStub()} />}
    </Stateful>,
  );
}

function open(id: string) {
  fireEvent.click(within(screen.getByTestId(`companion-${id}`)).getAllByRole('button')[0]);
}

describe('companion portraits on the cards', () => {
  it('uploads a portrait under <characterId>:<recordId> and shows it in the header and body', async () => {
    const character = plainCharacter({ companions: [{ id: 'c1', creatureId: 'cat', origin: 'pet', nickname: 'Tom' }] });
    renderTab(character);
    open('c1');
    expect(screen.queryByTestId('record-thumbnail')).toBeNull();
    const file = new File([new Uint8Array([1, 2, 3])], 'tom.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload portrait of Tom'), { target: { files: [file] } });
    expect(await screen.findByRole('img', { name: 'Portrait of Tom' })).toHaveAttribute('src', 'blob:portrait');
    expect(screen.getByTestId('record-thumbnail')).toBeInTheDocument();
    const stored = await getPortraitStore().getPortraitBlob(`${character.id}:c1`);
    expect(stored.ok && stored.value).toBeTruthy();
    expect(screen.getByRole('button', { name: /Remove portrait/ })).toBeInTheDocument();
  });

  it('rejects a file that is not an image without storing it', async () => {
    const character = plainCharacter({ companions: [{ id: 'c1', creatureId: 'cat', origin: 'pet', nickname: 'Tom' }] });
    renderTab(character);
    open('c1');
    const file = new File(['hello'], 'tom.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Upload portrait of Tom'), { target: { files: [file] } });
    expect(screen.getByText(/must be a JPEG, PNG, or WebP/)).toBeInTheDocument();
    await waitFor(async () => {
      const stored = await getPortraitStore().getPortraitBlob(`${character.id}:c1`);
      expect(stored.ok && stored.value).toBeNull();
    });
  });

  it('a Primal Companion asks for the kind of animal, and the prompt uses it', () => {
    const latest: { current: Character } = {
      current: { ...rangerCharacter(5, 16), companions: [{ id: 'p1', creatureId: 'beast-of-the-land', origin: 'primal-companion' }] },
    };
    renderTab(latest.current, latest);
    open('p1');
    const field = screen.getByLabelText('Beast of the Land kind of animal and appearance');
    fireEvent.change(field, { target: { value: 'a grey wolf' } });
    fireEvent.blur(field);
    expect(latest.current.companions?.[0].appearance).toBe('a grey wolf');

    fireEvent.click(screen.getByRole('button', { name: /Portrait prompt/ }));
    const text = (screen.getByLabelText('Generated portrait prompt') as HTMLTextAreaElement).value;
    expect(text).toContain('Appearance: a grey wolf');
    expect(text).toContain('primal markings');
  });
});
