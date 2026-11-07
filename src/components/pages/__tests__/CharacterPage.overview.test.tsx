import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CharacterPage } from '../CharacterPage';
import { createCharacter } from '../../../storage/character-store';
import type { Character } from '../../../types/character';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function renderOverview(character: Character) {
  render(<CharacterPage character={character} onChange={vi.fn()} subTab="identity" />);
}

/** Headings (h3 from SectionHeader) in document order. */
function headingOrder(): string[] {
  return screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent ?? '');
}

describe('CharacterPage Overview order', () => {
  it('stacks Personal Details, Species, Vitals, Inspiration, then the grid cards', () => {
    const wizard: Character = {
      ...createCharacter('Caster'),
      level: 5,
      classes: [{ id: 'wizard', level: 5 }],
    };
    renderOverview(wizard);
    const order = headingOrder();
    const expected = [
      'Personal Details',
      'Species',
      'Vitals',
      'Heroic Inspiration',
      'Conditions & Effects',
      'Reactions',
      'Attacks',
      'Spellcasting',
      'Skills & Saves',
      'Traits & Feats',
    ];
    const positions = expected.map((title) => order.findIndex((h) => h.includes(title)));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('omits Spellcasting for a non-caster without leaving a gap in the order', () => {
    const fighter: Character = {
      ...createCharacter('Fighter'),
      level: 5,
      classes: [{ id: 'fighter', level: 5 }],
    };
    renderOverview(fighter);
    const order = headingOrder();
    expect(order.some((h) => h.includes('Spellcasting'))).toBe(false);
    const attacks = order.findIndex((h) => h.includes('Attacks'));
    const skills = order.findIndex((h) => h.includes('Skills & Saves'));
    expect(skills).toBe(attacks + 1);
  });
});

describe('stale structure text guard', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === '__tests__') continue;
        walk(full, out);
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) {
        out.push(full);
      }
    }
    return out;
  }

  it('no source file refers to the removed Identity / Species / Build tabs', () => {
    const stale = /\b(Identity|Species|Build) (tab|sub-?tab)\b/i;
    const offenders = walk(join(process.cwd(), 'src')).filter((f) =>
      stale.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
