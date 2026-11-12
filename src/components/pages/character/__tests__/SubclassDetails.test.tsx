import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CLASS_LIST } from '../../../../data/classes';
import { SUBCLASS_INFO } from '../../../../data/subclass-info';
import { CharacterPage } from '../../CharacterPage';
import { createCharacter } from '../../../../storage/character-store';
import type { Character } from '../../../../types/character';

const PHB = resolve(__dirname, '../../../../../Docs/PlayersHandbook.md');

describe('subclass summaries', () => {
  it('cover every subclass of every class', () => {
    const ids = CLASS_LIST.flatMap((c) => c.subclasses.map((s) => s.id)).sort();
    expect(Object.keys(SUBCLASS_INFO).sort()).toEqual(ids);
  });

  it.skipIf(!existsSync(PHB))("cite a PHB line in that subclass's introduction", () => {
    const lines = readFileSync(PHB, 'utf8').split(/\r?\n/);
    for (const c of CLASS_LIST) {
      for (const s of c.subclasses) {
        const n = Number(/\(L(\d+)/.exec(SUBCLASS_INFO[s.id].source)?.[1]);
        // The cited line sits just below the subclass's own heading ("## PATH OF
        // THE BERSERKER"), or (Circle of the Land, read from its features) within
        // that subclass's feature lines.
        const norm = (x: string) => x.toUpperCase().replace(/[^A-Z]/g, '');
        const above = lines.slice(Math.max(0, n - 12), n + 2).map(norm);
        // Where the scan lost the heading (Illusionist), one of the subclass's own
        // feature headings follows the introduction instead.
        const after = lines.slice(n - 1, n + 10).map(norm).join(' ');
        const named = above.some((l) => l.includes(norm(s.name))) ||
          lines.slice(n - 2, n + 70).join(' ').includes(s.name) ||
          s.features.some((f) => after.includes(norm(f.name)));
        expect(named, `${s.id} near L${n}`).toBe(true);
      }
    }
  });
});

function renderBuild(overrides: Partial<Character>) {
  const character = { ...createCharacter('Tester'), ...overrides };
  const onChange = vi.fn();
  render(<CharacterPage character={character} onChange={onChange} subTab="build" />);
  return { onChange };
}

describe('subclass details on Class & Features', () => {
  it('previews the subclasses before the subclass level, with no Choose buttons', () => {
    renderBuild({ level: 1, classes: [{ id: 'barbarian', level: 1 }] });
    expect(screen.getByText(/You choose your Barbarian subclass at level 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Preview Barbarian subclasses'));
    expect(screen.getByText(/Turns Rage into pure, reckless violence/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose Path of the Berserker' })).toBeNull();
  });

  it('compares and chooses a subclass, then shows its summary and features with tooltips', () => {
    const { onChange } = renderBuild({ level: 3, classes: [{ id: 'barbarian', level: 3 }] });
    fireEvent.click(screen.getByText('Compare all Barbarian subclasses'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose Path of the Berserker' }));
    expect(onChange.mock.calls.at(-1)?.[0].classes).toEqual([{ id: 'barbarian', level: 3, subclassId: 'berserker' }]);
  });

  it('shows the chosen subclass with its features by level', () => {
    renderBuild({ level: 3, classes: [{ id: 'barbarian', level: 3, subclassId: 'berserker' }] });
    const panel = screen.getByRole('region', { name: 'Path of the Berserker details' });
    expect(within(panel).getByText('Level 3')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Frenzy' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Reckless Attack');
  });
});

describe('subclass choice for a multiclass character', () => {
  const multi: Partial<Character> = {
    level: 6,
    classes: [
      { id: 'fighter', level: 3 },
      { id: 'wizard', level: 3 },
    ],
  };

  it('changing one class\'s subclass keeps the other class (no lost classes)', () => {
    const { onChange } = renderBuild(multi);
    fireEvent.click(screen.getByText('Compare all Wizard subclasses'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose Evoker' }));
    expect(onChange.mock.calls.at(-1)?.[0].classes).toEqual([
      { id: 'fighter', level: 3 },
      { id: 'wizard', level: 3, subclassId: 'evoker' },
    ]);
  });

  it('the Subclass dropdown keeps the other classes too', () => {
    const { onChange } = renderBuild(multi);
    fireEvent.change(screen.getByLabelText('Subclass'), { target: { value: 'champion' } });
    expect(onChange.mock.calls.at(-1)?.[0].classes).toEqual([
      { id: 'fighter', level: 3, subclassId: 'champion' },
      { id: 'wizard', level: 3 },
    ]);
  });

  it('unlocks a class\'s subclass at its own class level, not the total level', () => {
    renderBuild({ level: 4, classes: [{ id: 'fighter', level: 2 }, { id: 'wizard', level: 2 }] });
    expect(screen.queryByLabelText('Subclass')).toBeNull();
    expect(screen.getByText(/You choose your Fighter subclass at level 3/)).toBeInTheDocument();
  });
});

describe('class changes for a multiclass character', () => {
  const multi: Partial<Character> = {
    level: 6,
    classes: [
      { id: 'fighter', level: 3, skillChoices: ['athletics'] },
      { id: 'wizard', level: 3 },
    ],
    spellcasting: { byClass: { wizard: { cantrips: ['fire-bolt'] } } },
  };

  it('changing the Class dropdown replaces only the first class, keeping its level and the other class', () => {
    const { onChange } = renderBuild(multi);
    fireEvent.change(screen.getByRole('combobox', { name: 'Class' }), { target: { value: 'rogue' } });
    const next = onChange.mock.calls.at(-1)?.[0] as Character;
    expect(next.classes).toEqual([
      { id: 'rogue', level: 3 },
      { id: 'wizard', level: 3 },
    ]);
    // The wizard's spells are untouched.
    expect(next.spellcasting?.byClass?.wizard).toEqual({ cantrips: ['fire-bolt'] });
  });

  it("won't swap the first class for one the character already has, or clear it", () => {
    renderBuild(multi);
    const select = screen.getByRole('combobox', { name: 'Class' }) as HTMLSelectElement;
    const option = (v: string) => Array.from(select.options).find((o) => o.value === v)!;
    expect(option('wizard').disabled).toBe(true);
    expect(option('').disabled).toBe(true);
    expect(option('rogue').disabled).toBe(false);
  });

  it('ticking a class skill keeps the other class', () => {
    const { onChange } = renderBuild(multi);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Intimidation class proficiency' }));
    expect(onChange.mock.calls.at(-1)?.[0].classes).toEqual([
      { id: 'fighter', level: 3, skillChoices: ['athletics', 'intimidation'] },
      { id: 'wizard', level: 3 },
    ]);
  });
});
