import { describe, it, expect, beforeEach } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { createCharacter, getCharacter, saveCharacter, _resetDbForTests } from '../character-store';
import { exportToJSON, importFromJSON } from '../export-import';
import { encodeSharePayload, decodeSharePayload } from '../../logic/share-codec';
import { validateSharedPayload } from '../../logic/share-validate';

/** Stage 8: the replay list `advancement.appliedAwards` must travel with the character. */
const IDS = ['abcdef123456', 'zzzz99998888'];

function withAwards() {
  const c = createCharacter('Awarded');
  return { ...c, advancement: { ...c.advancement, appliedAwards: IDS } };
}

beforeEach(async () => {
  _resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('dnd-char-sheet');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe('advancement.appliedAwards persistence', () => {
  it('survives save and load', async () => {
    const saved = await saveCharacter(withAwards());
    const loaded = await getCharacter(saved.id);
    expect(loaded?.advancement?.appliedAwards).toEqual(IDS);
  });

  it('survives JSON export and import', () => {
    const result = importFromJSON(exportToJSON(withAwards()));
    expect(result.success).toBe(true);
    expect(result.character?.advancement?.appliedAwards).toEqual(IDS);
  });

  it('survives a share link round trip', async () => {
    const code = await encodeSharePayload(exportToJSON(withAwards()));
    const decoded = await decodeSharePayload(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const validated = validateSharedPayload(decoded.json);
    expect(validated.ok).toBe(true);
    if (validated.ok) expect(validated.character.advancement?.appliedAwards).toEqual(IDS);
  });
});
