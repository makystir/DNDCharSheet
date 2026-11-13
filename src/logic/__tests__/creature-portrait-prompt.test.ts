import { describe, it, expect } from 'vitest';
import { buildRecordPortraitPrompt } from '../creature-portrait-prompt';

describe('buildRecordPortraitPrompt', () => {
  it('describes a creature companion from the fields that are set', () => {
    const prompt = buildRecordPortraitPrompt({
      subject: 'creature',
      name: 'Ash',
      creatureName: 'Beast of the Land',
      size: 'Medium',
      creatureType: 'Beast',
      appearance: 'a grey wolf with a torn ear',
      flavor: ['It bears primal markings that show its supernatural origin.'],
    });
    expect(prompt).toMatch(/^Create a portrait of a creature companion/);
    expect(prompt).toContain('Name: Ash.');
    expect(prompt).toContain('It is a Medium Beast: a Beast of the Land.');
    expect(prompt).toContain('primal markings');
    expect(prompt).toContain('Appearance: a grey wolf with a torn ear');
    expect(prompt).toContain('square, approximately 400x400 pixels');
  });

  it('describes a person, leaves out what is not set, and follows the shared options', () => {
    const prompt = buildRecordPortraitPrompt(
      { subject: 'person', name: 'Mira', role: 'Healer' },
      { style: 'comic', framing: 'fullBody', mood: 'cheerful', extraDetails: 'a satchel of herbs' },
    );
    expect(prompt).toMatch(/^Create a character portrait of a non-player character/);
    expect(prompt).toContain('Role: Healer.');
    expect(prompt).not.toContain('Appearance:');
    expect(prompt).not.toContain('It is');
    expect(prompt).toContain('Graphic novel illustration');
    expect(prompt).toContain('Expression: cheerful');
    expect(prompt).toContain('Additional details: a satchel of herbs');
    expect(prompt).toContain('head to toe');
  });
});
