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
  it('places Finish setting up between Personal Details and Vitals only when choices are pending', () => {
    const pending: Character = {
      ...createCharacter('Pending'),
      classes: [{ id: 'wizard', level: 1 }],
    };
    renderOverview(pending);
    const order = headingOrder();
    const details = order.findIndex((h) => h.includes('Personal Details'));
    const setup = order.findIndex((h) => h.includes('Finish setting up'));
    const vitals = order.findIndex((h) => h.includes('Vitals'));
    expect(setup).toBe(details + 1);
    expect(vitals).toBe(setup + 1);
    cleanup();

    const done: Character = {
      ...createCharacter('Done'),
      classes: [{ id: 'fighter', level: 1, skillChoices: ['athletics', 'acrobatics'] }],
      // Fighter 1 also picks a Fighting Style feat.
      advancement: { feats: [{ featId: 'archery', level: 0, grantedBy: 'fighter' }] },
    };
    renderOverview(done);
    expect(headingOrder().some((h) => h.includes('Finish setting up'))).toBe(false);
    expect(screen.queryByTestId('overview-setup-class-skills')).toBeNull();
  });

  it('stacks Personal Details, Vitals, Inspiration, then the grid cards', () => {
    const wizard: Character = {
      ...createCharacter('Caster'),
      level: 5,
      classes: [{ id: 'wizard', level: 5 }],
    };
    renderOverview(wizard);
    const order = headingOrder();
    const expected = [
      'Personal Details',
      'Vitals',
      'Heroic Inspiration',
      'Right now',
      'Spellcasting',
      'Traits & Feats',
      'Abilities, Saves & Skills',
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
    const now = order.findIndex((h) => h.includes('Right now'));
    const traits = order.findIndex((h) => h.includes('Traits & Feats'));
    expect(traits).toBe(now + 1);
    // No empty placeholder is left in the left column either: it holds exactly
    // Right now and Traits & Feats.
    const column = screen.getByTestId('overview-column-now');
    expect(column.children).toHaveLength(2);
  });

  it('no longer repeats the Combat cards (conditions, reactions, resources, attacks) on the Overview', () => {
    const fighter: Character = {
      ...createCharacter('Fighter'),
      level: 5,
      classes: [{ id: 'fighter', level: 5 }],
    };
    renderOverview(fighter);
    const order = headingOrder();
    for (const gone of ['Conditions & Effects', 'Reactions', 'Resources', 'Attacks', 'Spell Slots']) {
      expect(order.some((h) => h === gone)).toBe(false);
    }
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
    // Left: the Right now summary, Spellcasting, then Traits & Feats (balance).
    expect(titlesIn('overview-column-now')).toEqual(['Right now', 'Spellcasting', 'Traits & Feats']);
    // Right: Abilities, Saves & Skills. Each card has exactly ONE header.
    expect(titlesIn('overview-column-reference')).toEqual(['Abilities, Saves & Skills']);
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
