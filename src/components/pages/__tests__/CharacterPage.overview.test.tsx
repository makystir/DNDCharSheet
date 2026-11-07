import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
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
  it('places Finish setting up between Species and Vitals only when choices are pending', () => {
    const pending: Character = {
      ...createCharacter('Pending'),
      classes: [{ id: 'wizard', level: 1 }],
    };
    renderOverview(pending);
    const order = headingOrder();
    const species = order.findIndex((h) => h.includes('Species'));
    const setup = order.findIndex((h) => h.includes('Finish setting up'));
    const vitals = order.findIndex((h) => h.includes('Vitals'));
    expect(setup).toBe(species + 1);
    expect(vitals).toBe(setup + 1);
    cleanup();

    const done: Character = {
      ...createCharacter('Done'),
      classes: [{ id: 'fighter', level: 1, skillChoices: ['athletics', 'acrobatics'] }],
    };
    renderOverview(done);
    expect(headingOrder().some((h) => h.includes('Finish setting up'))).toBe(false);
    expect(screen.queryByTestId('overview-setup-class-skills')).toBeNull();
  });

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
    // No empty placeholder is left in the "right now" column either: Attacks
    // is its last card.
    const now = screen.getByTestId('overview-column-now');
    const last = now.lastElementChild as HTMLElement;
    expect(within(last).getByRole('heading', { level: 3 })).toHaveTextContent('Attacks');
  });

  it('lays the grid cards out as two independent column stacks (no shared rows)', () => {
    const wizard: Character = {
      ...createCharacter('Caster'),
      level: 5,
      classes: [{ id: 'wizard', level: 5 }],
    };
    renderOverview(wizard);
    const titlesIn = (testId: string) =>
      within(screen.getByTestId(testId))
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent ?? '');
    // Left: the "right now" cards (Spellcasting is followed by its Spell Slots card).
    expect(titlesIn('overview-column-now')).toEqual([
      'Conditions & Effects',
      'Reactions',
      'Attacks',
      'Spellcasting',
      'Spell Slots',
    ]);
    // Right: the reference cards. Each has exactly ONE header.
    expect(titlesIn('overview-column-reference')).toEqual(['Skills & Saves', 'Traits & Feats']);
  });

  it('renders no SRD status text anywhere on the Overview', () => {
    const hermit: Character = {
      ...createCharacter('Hermit'),
      species: { id: 'elf' },
      backgroundSelection: { id: 'hermit' },
      classes: [{ id: 'wizard', level: 3, subclassId: 'evoker' }],
      level: 3,
    };
    renderOverview(hermit);
    // The selected background still shows, by name only.
    expect(screen.getByTestId('pd-selected-background')).toHaveTextContent('Hermit');
    expect(document.body.textContent).not.toMatch(/srd/i);
    // ...and no hover copy (title attributes) mentions it either.
    const titles = [...document.querySelectorAll('[title]')].map((el) => el.getAttribute('title'));
    expect(titles.filter((t) => /srd/i.test(t ?? ''))).toEqual([]);
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
