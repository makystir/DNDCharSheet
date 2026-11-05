import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Character } from '../../../types/character';
import { BLANK_CHARACTER, CURRENT_VERSION } from '../../../types/character';
import { encodeSharePayload } from '../../../logic/share-codec';
import { SharedCharacterViewer } from '../SharedCharacterViewer';

/**
 * SharedCharacterViewer (Stage B5): renders a valid shared character read-only,
 * shows the "invalid share link" state for a bad/garbage payload, and performs
 * NO store/manager writes. The decoded payload is UNTRUSTED.
 */
function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    ...structuredClone(BLANK_CHARACTER),
    _v: CURRENT_VERSION,
    id: 'orig',
    name: 'Aric the Bold',
    level: 5,
    abilities: { str: 16, dex: 14, con: 15, int: 10, wis: 12, cha: 8 },
    ...overrides,
  };
}

async function encode(character: Character): Promise<string> {
  return encodeSharePayload(JSON.stringify(character));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SharedCharacterViewer — valid character', () => {
  it('renders the identity and derived stats read-only', async () => {
    const encoded = await encode(makeCharacter());
    render(<SharedCharacterViewer encoded={encoded} />);

    expect(await screen.findByText('Aric the Bold')).toBeInTheDocument();
    expect(screen.getByText('Core Stats')).toBeInTheDocument();
    expect(screen.getByText('Ability Scores')).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
    // Read-only banner is present.
    expect(screen.getByText(/Read-only shared view/)).toBeInTheDocument();
  });

  it('shows a breakdown tooltip trigger for a calculated total (Proficiency Bonus)', async () => {
    const encoded = await encode(makeCharacter());
    render(<SharedCharacterViewer encoded={encoded} />);
    // CalculatedValue renders a button whose aria-label carries the breakdown.
    expect(await screen.findByRole('button', { name: /Proficiency Bonus:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Armor Class:/ })).toBeInTheDocument();
  });

  it('mounts no editable fields (no input/textarea/select)', async () => {
    const encoded = await encode(makeCharacter());
    const { container } = render(<SharedCharacterViewer encoded={encoded} />);
    await screen.findByText('Aric the Bold');
    expect(container.querySelectorAll('input, textarea, select')).toHaveLength(0);
  });
});

describe('SharedCharacterViewer — invalid payloads', () => {
  it('shows the invalid-link state for non-base64url garbage without throwing', async () => {
    render(<SharedCharacterViewer encoded="!!!not-base64url!!!" />);
    expect(await screen.findByText('Can’t open this shared character')).toBeInTheDocument();
    expect(screen.getByText(/incomplete or corrupted/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to my characters' })).toBeInTheDocument();
  });

  it('shows the invalid-link state for a well-formed but wrong-shape payload', async () => {
    const encoded = await encodeSharePayload(JSON.stringify({ not: 'a character' }));
    render(<SharedCharacterViewer encoded={encoded} />);
    expect(await screen.findByText('Can’t open this shared character')).toBeInTheDocument();
  });

  it('shows the invalid-link state for a newer-than-current version', async () => {
    const future = { ...makeCharacter(), _v: CURRENT_VERSION + 99 } as Character;
    const encoded = await encode(future);
    render(<SharedCharacterViewer encoded={encoded} />);
    expect(await screen.findByText('Can’t open this shared character')).toBeInTheDocument();
  });
});

describe('SharedCharacterViewer — read-only guarantee', () => {
  it('performs no localStorage writes on render of a valid character', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const encoded = await encode(makeCharacter());
    render(<SharedCharacterViewer encoded={encoded} />);
    await screen.findByText('Aric the Bold');
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});
