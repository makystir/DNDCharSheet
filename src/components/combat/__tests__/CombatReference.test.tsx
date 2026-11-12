import { useState } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CombatPage } from '../../pages/CombatPage';
import type { Character } from '../../../types/character';
import type { ClassId } from '../../../data/classes';
import { createCharacter } from '../../../storage/character-store';
import { STANDARD_ACTIONS, bonusActionSpells, featureTurnOptionsFor } from '../../../logic/turn-options';
import { setPactExpended, setSlotsExpended, slotLevels, pactSlots } from '../../../logic/spell-slot-spend';
import { attackModeAdvice, attackNaturalNote } from '../../../logic/attack-rolls';

let latest: Character;

function Harness({ initial }: { initial: Character }) {
  const [character, setCharacter] = useState<Character>(initial);
  return (
    <CombatPage
      character={character}
      onChange={(next) => {
        latest = next;
        setCharacter(next);
      }}
    />
  );
}

function renderPage(overrides: Partial<Character> = {}) {
  latest = { ...createCharacter('Caster'), ...overrides };
  render(<Harness initial={latest} />);
}

const wizard3 = (extra: Partial<Character> = {}): Partial<Character> => ({
  level: 3,
  classes: [{ id: 'wizard' as ClassId, level: 3 }],
  abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
  ...extra,
});

beforeEach(() => localStorage.clear());

describe('Spellcasting quick card', () => {
  it('is hidden for a character who cannot cast', () => {
    renderPage({ level: 3, classes: [{ id: 'fighter' as ClassId, level: 3 }] });
    expect(screen.queryByRole('heading', { name: 'Spellcasting' })).toBeNull();
  });

  it('shows save DC and spell attack with breakdowns, and slots to spend', () => {
    renderPage(wizard3());
    expect(screen.getByRole('button', { name: /Wizard Spell Save DC/ })).toHaveTextContent('13');
    expect(screen.getByRole('button', { name: /Wizard Spell Attack Bonus/ })).toHaveTextContent('+5');
    // Level 3 Wizard: four level-1 and two level-2 slots (PHB 2024 Wizard Features).
    expect(screen.getByTestId('slots-Level 1')).toHaveTextContent('Level 1: 4/4');
    expect(screen.getByTestId('slots-Level 2')).toHaveTextContent('Level 2: 2/2');
    fireEvent.click(within(screen.getByTestId('slots-Level 1')).getAllByRole('button', { name: 'Spend a Level 1 slot' })[0]);
    expect(latest.spellcasting?.slotsExpended?.[1]).toBe(1);
    expect(screen.getByTestId('slots-Level 1')).toHaveTextContent('Level 1: 3/4');
    fireEvent.click(within(screen.getByTestId('slots-Level 1')).getByRole('button', { name: 'Recover a Level 1 slot' }));
    expect(latest.spellcasting?.slotsExpended?.[1]).toBe(0);
  });

  it('lists the cantrips and prepared spells ready to cast', () => {
    renderPage(
      wizard3({
        spellcasting: {
          byClass: { wizard: { cantrips: ['fire-bolt'], spellbook: ['magic-missile', 'shield'], prepared: ['magic-missile'] } },
        },
      }),
    );
    const section = screen.getByRole('region', { name: 'Wizard spells to cast' });
    expect(within(section).getByText('Fire Bolt')).toBeInTheDocument();
    expect(within(section).getByRole('list', { name: 'Wizard level 1 spells' })).toHaveTextContent('Magic Missile');
    expect(within(section).queryByText('Shield')).toBeNull();
  });
});

describe('On your turn card', () => {
  it('lists the twelve standard actions from the PHB Actions table', () => {
    renderPage();
    const list = screen.getByRole('list', { name: 'Standard actions' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(12);
    expect(STANDARD_ACTIONS.map((a) => a.name)).toEqual([
      'Attack', 'Dash', 'Disengage', 'Dodge', 'Help', 'Hide', 'Influence', 'Magic', 'Ready', 'Search', 'Study', 'Utilize',
    ]);
  });

  it('always lists the Opportunity Attack reaction', () => {
    renderPage();
    expect(within(screen.getByRole('list', { name: 'Reactions' })).getByText('Opportunity Attack')).toBeInTheDocument();
  });

  it('lists ready Bonus Action spells', () => {
    const c: Character = {
      ...createCharacter('Cleric'),
      level: 1,
      classes: [{ id: 'cleric' as ClassId, level: 1 }],
      spellcasting: { byClass: { cleric: { prepared: ['healing-word', 'bless'] } } },
    };
    expect(bonusActionSpells(c).map((s) => s.name)).toEqual(['Healing Word']);
    renderPage(c);
    expect(within(screen.getByRole('list', { name: 'Bonus Action spells' })).getByText('Healing Word')).toBeInTheDocument();
  });

  it('says when no Bonus Actions are available', () => {
    renderPage({ level: 1, classes: [{ id: 'wizard' as ClassId, level: 1 }] });
    expect(screen.getByText('No Bonus Actions available.')).toBeInTheDocument();
  });

  it('lists class features used as a Bonus Action, gated by level', () => {
    renderPage({ level: 1, classes: [{ id: 'fighter' as ClassId, level: 1 }] });
    const list = screen.getByRole('list', { name: 'Features that use a Bonus Action' });
    expect(within(list).getByText('Second Wind')).toBeInTheDocument();
    expect(within(list).queryByText(/Know Your Enemy/)).toBeNull();
  });

  it('lists subclass features only for the chosen subclass', () => {
    const c = (sub: string): Partial<Character> => ({
      level: 7,
      classes: [{ id: 'fighter' as ClassId, level: 7, subclassId: sub as never }],
    });
    expect(featureTurnOptionsFor({ ...createCharacter('F'), ...c('battleMaster') }).map((f) => f.name)).toContain('Know Your Enemy');
    expect(featureTurnOptionsFor({ ...createCharacter('F'), ...c('champion') }).map((f) => f.name)).not.toContain('Know Your Enemy');
  });

  it('lists the Cleric Channel Divinity options under actions', () => {
    renderPage({ level: 2, classes: [{ id: 'cleric' as ClassId, level: 2 }] });
    const list = screen.getByRole('list', { name: 'Features that use an action' });
    expect(within(list).getByText('Channel Divinity: Turn Undead')).toBeInTheDocument();
    expect(within(list).getByText('Channel Divinity: Divine Spark')).toBeInTheDocument();
  });

  it('lists every feature of a multiclass character, each by its own class level', () => {
    const c: Character = {
      ...createCharacter('Mc'),
      level: 4,
      classes: [
        { id: 'rogue' as ClassId, level: 2 },
        { id: 'monk' as ClassId, level: 2 },
      ],
    };
    const names = featureTurnOptionsFor(c).map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(['Cunning Action: Dash, Disengage or Hide', 'Flurry of Blows', 'Martial Arts: Unarmed Strike']));
    expect(names).not.toContain('Steady Aim');
  });
});

describe('slot spending logic', () => {
  const c = (): Character => ({ ...createCharacter('W'), ...wizard3() });

  it('clamps to the pool maximum', () => {
    expect(setSlotsExpended(c(), 1, 99).spellcasting?.slotsExpended?.[1]).toBe(4);
    expect(setSlotsExpended(c(), 1, -3).spellcasting?.slotsExpended?.[1]).toBe(0);
    expect(slotLevels(c()).map((s) => [s.level, s.max])).toEqual([[1, 4], [2, 2]]);
  });

  it('handles Pact Magic', () => {
    const warlock: Character = { ...createCharacter('Wl'), level: 3, classes: [{ id: 'warlock' as ClassId, level: 3 }] };
    expect(pactSlots(warlock)).toEqual({ slotLevel: 2, max: 2, expended: 0 });
    expect(setPactExpended(warlock, 5).spellcasting?.pactSlotsExpended).toBe(2);
    expect(slotLevels(warlock)).toEqual([]);
  });
});

describe('attack roll advice', () => {
  it('reads Advantage and Disadvantage from conditions that always apply', () => {
    const base = createCharacter('A');
    expect(attackModeAdvice(base).mode).toBe('normal');
    expect(attackModeAdvice({ ...base, conditions: [{ id: 'poisoned' }] }).mode).toBe('disadvantage');
    expect(attackModeAdvice({ ...base, conditions: [{ id: 'poisoned' }, { id: 'invisible' }] }).mode).toBe('disadvantage');
    expect(attackModeAdvice({ ...base, conditions: [{ id: 'frightened' }] }).mode).toBe('normal');
    expect(attackModeAdvice({ ...base, conditions: [{ id: 'frightened' }] }).notes[0]).toMatch(/Frightened: Disadvantage\. While/);
  });

  it('explains a natural 20 and a natural 1', () => {
    expect(attackNaturalNote(20)).toMatch(/Critical Hit/);
    expect(attackNaturalNote(1)).toMatch(/misses/);
    expect(attackNaturalNote(12)).toBeNull();
  });
});
