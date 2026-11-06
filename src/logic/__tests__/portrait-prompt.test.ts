import { describe, it, expect } from 'vitest';
import { buildPortraitPrompt, PORTRAIT_STYLES } from '../portrait-prompt';
import {
  PORTRAIT_RECOMMENDED_WIDTH,
  PORTRAIT_RECOMMENDED_HEIGHT,
  PORTRAIT_MAX_SIZE_LABEL,
} from '../portrait';
import { createCharacter } from '../../storage/character-store';
import type { Character } from '../../types/character';

function make(overrides: Partial<Character> = {}): Character {
  return { ...createCharacter('Tester'), ...overrides };
}

describe('buildPortraitPrompt', () => {
  it('embeds the portrait size and file-size constants', () => {
    const p = buildPortraitPrompt(make());
    expect(p).toContain(`${PORTRAIT_RECOMMENDED_WIDTH}x${PORTRAIT_RECOMMENDED_HEIGHT}`);
    expect(p).toContain(PORTRAIT_MAX_SIZE_LABEL);
  });

  it('tells the AI not to render any text and never describes a background', () => {
    const p = buildPortraitPrompt(make({ background: 'Soldier' }));
    expect(p).toMatch(/Do not include any text/);
    expect(p).toMatch(/no writing of any kind/);
    expect(p.toLowerCase()).not.toContain('background');
  });

  it('defaults to bust framing and supports fullBody', () => {
    expect(buildPortraitPrompt(make())).toMatch(/waist or chest up/);
    expect(buildPortraitPrompt(make(), { framing: 'fullBody' })).toMatch(/head to toe/);
    expect(buildPortraitPrompt(make(), { framing: 'fullBody' })).not.toMatch(/waist or chest up/);
  });

  it('is deterministic for identical input', () => {
    const c = make({ gender: 'female', species: { id: 'elf', elvenLineage: 'woodElf' } });
    expect(buildPortraitPrompt(c, { style: 'comic' })).toBe(buildPortraitPrompt(c, { style: 'comic' }));
  });

  it('never emits empty placeholders for unset fields', () => {
    const p = buildPortraitPrompt(make({ name: '' }));
    expect(p).not.toMatch(/undefined|null|\{\}|\[\]|NaN/);
    expect(p).not.toMatch(/Name:/);
    expect(p).not.toMatch(/Armor:|Weapons:|origin:|Additional details:/);
    expect(p).toMatch(/A portrait of a fantasy adventurer\./);
  });

  it('builds the appearance from set personal details', () => {
    const p = buildPortraitPrompt(
      make({
        gender: 'male',
        species: { id: 'dwarf' },
        age: '120',
        height: "4'5\"",
        hair: 'Red',
        eyes: 'Green',
        skin: 'Tan',
      }),
    );
    expect(p).toContain('Name: Tester.');
    expect(p).toContain('A portrait of a male Dwarf');
    expect(p).toContain('around 120 years old');
    expect(p).toContain('red hair');
    expect(p).toContain('green eyes');
    expect(p).toContain('tan skin');
  });

  it('includes class, subclass, experience tier and backgrounds', () => {
    const p = buildPortraitPrompt(
      make({
        level: 12,
        classes: [{ id: 'wizard', subclassId: 'evoker', level: 12 }],
        backgroundSelection: { id: 'sage' },
        background: 'Raised in a lighthouse',
      }),
    );
    expect(p).toContain('hardened veteran');
    expect(p).toMatch(/Wizard \(Evoker\)/);
    expect(p).toContain('origin: Sage / Raised in a lighthouse');
  });

  it('keeps level tiers coarse', () => {
    expect(buildPortraitPrompt(make({ level: 1 }))).toContain('fresh-faced novice');
    expect(buildPortraitPrompt(make({ level: 7 }))).toContain('seasoned adventurer');
    expect(buildPortraitPrompt(make({ level: 20 }))).toContain('legendary hero');
  });

  it('shows only equipped weapons when any are equipped, plus worn armor and shield', () => {
    const p = buildPortraitPrompt(
      make({
        inventory: [
          { id: 'w1', kind: 'weapon', catalogId: 'longsword', quantity: 1 },
          { id: 'w2', kind: 'weapon', catalogId: 'dagger', quantity: 1 },
          { id: 'a1', kind: 'armor', catalogId: 'chain-mail', quantity: 1 },
          { id: 'a2', kind: 'armor', catalogId: 'shield', quantity: 1 },
          { id: 'a3', kind: 'armor', catalogId: 'plate-armor', quantity: 1 },
        ],
        equipped: { weaponItemIds: ['w1'], armorItemId: 'a1', shieldItemId: 'a2' },
      }),
    );
    expect(p).toContain('Weapons: Longsword.');
    expect(p).not.toContain('Dagger');
    expect(p).toContain('Armor: Chain Mail, Shield.');
    expect(p).not.toContain('Plate');
  });

  it('falls back to carried weapons when none are equipped', () => {
    const p = buildPortraitPrompt(
      make({ inventory: [{ id: 'w2', kind: 'weapon', catalogId: 'dagger', quantity: 1 }] }),
    );
    expect(p).toContain('Weapons: Dagger.');
  });

  it('adds species cues only when the species is set', () => {
    expect(buildPortraitPrompt(make())).not.toMatch(/features:/);
    expect(buildPortraitPrompt(make({ species: { id: 'elf' } }))).toContain('pointed ears');
    expect(buildPortraitPrompt(make({ species: { id: 'tiefling' } }))).toContain('curved horns');
    const drag = buildPortraitPrompt(make({ species: { id: 'dragonborn', draconicAncestry: 'red' } }));
    expect(drag).toContain('red scales');
  });

  it('uses a set skin colour instead of ancestry colour for dragonborn', () => {
    const p = buildPortraitPrompt(
      make({ skin: 'Ashen', species: { id: 'dragonborn', draconicAncestry: 'red' } }),
    );
    expect(p).not.toContain('red scales');
    expect(p).toContain('ashen skin');
  });

  it('includes a matched deity symbol and spellcasting focus', () => {
    const p = buildPortraitPrompt(
      make({ faith: 'Boccob', classes: [{ id: 'wizard', level: 1 }] }),
    );
    expect(p).toContain('eye within a pentagram');
    expect(p).toContain('no lettering');
    expect(p).toContain('arcane focus');
  });

  it('mentions an unmatched faith without a symbol', () => {
    const p = buildPortraitPrompt(make({ faith: 'Homebrew God' }));
    expect(p).toContain('Devout follower of Homebrew God.');
    expect(p).not.toContain('holy symbol');
  });

  it('style presets change only the style sentence', () => {
    const c = make({ species: { id: 'elf' }, gender: 'female' });
    const base = buildPortraitPrompt(c, { style: 'oilPainting' });
    for (const s of PORTRAIT_STYLES) {
      const p = buildPortraitPrompt(c, { style: s.id });
      expect(p).toContain(`Art style: ${s.sentence}`);
      const strip = (t: string) => t.replace(/Art style: [^\n]*/, '');
      expect(strip(p)).toBe(strip(base));
    }
  });

  it('appends trimmed extra details and omits them when empty', () => {
    expect(buildPortraitPrompt(make(), { extraDetails: '  a scar on the cheek  ' })).toContain(
      'Additional details: a scar on the cheek',
    );
    expect(buildPortraitPrompt(make(), { extraDetails: '   ' })).not.toContain('Additional details');
  });

  it('mood selector: auto adds nothing beyond personality; explicit moods add a sentence', () => {
    expect(buildPortraitPrompt(make(), { mood: 'auto' })).not.toContain('Expression:');
    expect(buildPortraitPrompt(make(), { mood: 'weary' })).toContain('Expression: weary');
    const withPersonality = buildPortraitPrompt(make({ personality: 'Boisterous\nand kind' }));
    expect(withPersonality).toContain('this temperament: Boisterous and kind');
  });

  it('closes with the negative line', () => {
    const p = buildPortraitPrompt(make());
    expect(p.trim().split('\n\n').at(-1)).toMatch(/^Avoid: .*extra limbs or fingers.*modern objects/);
  });
});
