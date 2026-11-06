import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { OverviewVitals } from '../OverviewVitals';
import { DefenseReadout } from '../../../combat/DefenseReadout';
import { buildCoreStats } from '../../../layout/printLayoutGenerators';
import { createCharacter } from '../../../../storage/character-store';
import type { Character } from '../../../../types/character';
import { characterArmorClassBreakdown } from '../../../../logic/armor-class';
import { characterHitPointMaxBreakdown } from '../../../../logic/hit-points-state';

afterEach(cleanup);

function make(overrides: Partial<Character>): Character {
  return { ...createCharacter('Tester'), ...overrides };
}

const base = { str: 10, dex: 14, con: 14, int: 10, wis: 12, cha: 10 };

const CASES: Record<string, Character> = {
  armored: make({
    level: 5,
    classes: [{ id: 'fighter', level: 5 }],
    abilities: { ...base, str: 16 },
    inventory: [
      { id: 'a1', kind: 'armor', catalogId: 'chain-mail', quantity: 1 },
      { id: 's1', kind: 'armor', catalogId: 'shield', quantity: 1 },
    ],
    equipped: { armorItemId: 'a1', shieldItemId: 's1' },
  }),
  'barbarian unarmored defense': make({
    level: 3,
    classes: [{ id: 'barbarian', level: 3 }],
    abilities: { ...base, con: 16 },
  }),
  'monk with shield': make({
    level: 3,
    classes: [{ id: 'monk', level: 3 }],
    abilities: { ...base, wis: 16 },
    inventory: [{ id: 's1', kind: 'armor', catalogId: 'shield', quantity: 1 }],
    equipped: { shieldItemId: 's1' },
  }),
  'custom un-cataloged armor': make({
    level: 2,
    classes: [{ id: 'fighter', level: 2 }],
    inventory: [{ id: 'c1', kind: 'armor', name: 'Dragon Scale', quantity: 1 }],
    equipped: { armorItemId: 'c1' },
  }),
  multiclass: make({
    level: 5,
    classes: [
      { id: 'fighter', level: 3 },
      { id: 'wizard', level: 2 },
    ],
    abilities: { ...base, con: 15 },
    currentHp: 20,
    tempHp: 3,
  }),
};

const text = (name: RegExp) => screen.getByRole('button', { name }).textContent ?? '';

describe('OverviewVitals parity with DefenseReadout and the print sheet', () => {
  for (const [label, character] of Object.entries(CASES)) {
    it(`matches AC / HP max / Initiative / Passive Perception / Speed: ${label}`, () => {
      render(<OverviewVitals character={character} />);
      const overview = {
        ac: text(/^Armor Class/),
        hpMax: text(/^Hit Point Maximum/),
        initiative: text(/^Initiative/),
        pp: text(/^Passive Perception/),
        speed: text(/^Speed/),
      };
      cleanup();

      render(<DefenseReadout character={character} />);
      expect(overview).toEqual({
        ac: text(/^Armor Class/),
        hpMax: text(/^Hit Point Maximum/),
        initiative: text(/^Initiative/),
        pp: text(/^Passive Perception/),
        speed: text(/^Speed/),
      });

      // Print sheet (buildCoreStats) shows the same numbers.
      const print = Object.fromEntries(buildCoreStats(character).map((s) => [s.label, s.value]));
      expect(print['Armor Class']).toBe(overview.ac);
      expect(print['Initiative']).toBe(overview.initiative);
      expect(print['Passive Perception']).toBe(overview.pp);
      expect(print['Speed']).toBe(overview.speed);
      expect(print['Hit Points']).toMatch(new RegExp(`${overview.hpMax}$`));
    });
  }

  it('uses the multiclass-aware Hit Point maximum (not the single-class die)', () => {
    const character = CASES.multiclass;
    const max = characterHitPointMaxBreakdown(character).total;
    render(<OverviewVitals character={character} />);
    expect(text(/^Hit Point Maximum/)).toBe(String(max));
    cleanup();
    render(<DefenseReadout character={character} />);
    expect(text(/^Hit Point Maximum/)).toBe(String(max));
    // Fighter d10 x3 + Wizard d6 x2 + Con(+2) x 5 differs from a single d10 x5.
    expect(max).toBe(10 + 2 + 2 * (6 + 2) /* fighter 2-3 */ + 2 * (4 + 2) /* wizard */);
  });

  it('shares one AC assembly: the helper names an ignored custom armor in the note', () => {
    const bd = characterArmorClassBreakdown(CASES['custom un-cataloged armor']);
    expect(bd.note).toContain('Dragon Scale');
  });
});

describe('OverviewVitals tiles', () => {
  it('shows HP current / max, temp HP and Bloodied, with manage links', () => {
    const character = make({
      level: 5,
      classes: [{ id: 'fighter', level: 5 }],
      abilities: { ...base, con: 14 },
      currentHp: 5,
      tempHp: 4,
    });
    render(<OverviewVitals character={character} />);
    const hp = screen.getByTestId('vital-hp');
    expect(hp).toHaveTextContent('Temp HP');
    expect(hp).toHaveTextContent('Bloodied');
    expect(screen.getAllByRole('link', { name: 'manage on Combat' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Level up on Advancement' })).toBeInTheDocument();
  });

  it('shows Hit Dice remaining per die type for a multiclass character', () => {
    render(<OverviewVitals character={{ ...CASES.multiclass, hitDiceSpent: 2 }} />);
    const hd = screen.getByTestId('vital-hit-dice');
    expect(hd).toHaveTextContent('3 / 5');
    expect(hd).toHaveTextContent('3d10 + 2d6');
  });

  it('shows Darkvision None when the species grants none', () => {
    render(<OverviewVitals character={make({})} />);
    expect(text(/Darkvision/)).toBe('None');
  });
});
