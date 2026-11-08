import { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import {
  ClassChoicesPending,
  ClassChoicesOverNote,
  ClassChoicesSection,
  MulticlassPicksPending,
} from '../ClassChoicesPending';
import { choiceStatus, pendingClassChoices } from '../../../../logic/class-choices';
import { classProficiencies } from '../../../../logic/classes';
import { cantripsKnown } from '../../../../logic/spellcasting';
import { effectiveSkillTraining } from '../../../../logic/skills';
import type { Character } from '../../../../types/character';
import { createCharacter } from '../../../../storage/character-store';

afterEach(cleanup);

/**
 * The class-feature choice pickers on the Advancement page. The owed counts and
 * prerequisites live in logic/class-choices (pinned by class-choice-counts);
 * these tests assert the UI wires them: pending items, counts, non-blocking
 * over-allocation warnings, prerequisite reasons and the Remove affordance.
 */
function renderChoices(overrides: Partial<Character>) {
  let latest: Character = { ...createCharacter('Tester'), ...overrides };
  function Harness() {
    const [character, setCharacter] = useState<Character>(latest);
    const onChange = (next: Character) => {
      latest = next;
      setCharacter(next);
    };
    const statuses = choiceStatus(character);
    return (
      <div>
        <ul>
          <ClassChoicesPending character={character} onChange={onChange} statuses={statuses} />
          <MulticlassPicksPending character={character} onChange={onChange} />
        </ul>
        <ClassChoicesOverNote statuses={statuses} />
        <ClassChoicesSection character={character} onChange={onChange} statuses={statuses} />
      </div>
    );
  }
  render(<Harness />);
  return { get: () => latest };
}

describe('ClassChoicesPending', () => {
  it('lists a Sorcerer 2 Metamagic pick, and clears it once two are chosen', () => {
    const { get } = renderChoices({ level: 2, classes: [{ id: 'sorcerer', level: 2 }] });
    const item = screen.getByTestId('pending-choice-sorcerer.metamagic');
    expect(item).toHaveTextContent('Choose 2 more Metamagic options (0 of 2 chosen)');
    fireEvent.click(within(item).getByRole('checkbox', { name: 'Careful Spell' }));
    expect(screen.getByTestId('pending-choice-sorcerer.metamagic')).toHaveTextContent('Choose 1 more');
    fireEvent.click(within(screen.getByTestId('pending-choice-sorcerer.metamagic')).getByRole('checkbox', { name: 'Distant Spell' }));
    expect(screen.queryByTestId('pending-choice-sorcerer.metamagic')).not.toBeInTheDocument();
    expect(get().classChoices?.['sorcerer.metamagic']).toEqual(['careful-spell', 'distant-spell']);
    expect(pendingClassChoices(get())).toEqual([]);
  });

  it('warns, without blocking, when more is picked than the class grants', () => {
    const { get } = renderChoices({
      level: 2,
      classes: [{ id: 'sorcerer', level: 2 }],
      classChoices: { 'sorcerer.metamagic': ['careful-spell', 'distant-spell'] },
    });
    expect(screen.queryByTestId('choice-over-note-sorcerer.metamagic')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Edit Metamagic options'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Empowered Spell' }));
    expect(get().classChoices?.['sorcerer.metamagic']).toHaveLength(3);
    expect(screen.getByTestId('choice-over-note-sorcerer.metamagic')).toHaveTextContent('3 chosen, but your class grants 2');
  });

  it('removes a chosen entry from the Class Choices list', () => {
    const { get } = renderChoices({
      level: 2,
      classes: [{ id: 'sorcerer', level: 2 }],
      classChoices: { 'sorcerer.metamagic': ['careful-spell', 'distant-spell'] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Careful Spell' }));
    expect(get().classChoices?.['sorcerer.metamagic']).toEqual(['distant-spell']);
    expect(screen.getByTestId('pending-choice-sorcerer.metamagic')).toBeInTheDocument();
  });

  it('disables an invocation whose prerequisite is unmet and says why', () => {
    renderChoices({ level: 1, classes: [{ id: 'warlock', level: 1 }] });
    const item = screen.getByTestId('pending-choice-warlock.invocations');
    expect(item).toHaveTextContent('Choose 1 more Eldritch Invocations');
    const agonizing = within(item).getByRole('checkbox', { name: 'Agonizing Blast' });
    expect(agonizing).toBeDisabled();
    expect(item).toHaveTextContent('Requires Warlock level 2');
    expect(within(item).getByRole('checkbox', { name: 'Pact of the Blade' })).toBeEnabled();
    // Eldritch Smite needs Warlock 5 AND Pact of the Blade.
    expect(within(item).getByRole('checkbox', { name: 'Eldritch Smite' })).toBeDisabled();
  });

  it('records a Cleric Divine Order, which grants Heavy armor and a Thaumaturge cantrip', () => {
    const { get } = renderChoices({ level: 1, classes: [{ id: 'cleric', level: 1 }] });
    const before = cantripsKnown(get());
    fireEvent.click(within(screen.getByTestId('pending-choice-cleric.divineOrder')).getByRole('radio', { name: 'Protector' }));
    expect(get().classChoices?.['cleric.divineOrder']).toEqual(['protector']);
    expect(classProficiencies(get()).armor).toContain('Heavy armor');
    expect(classProficiencies(get()).weapons).toContain('Martial weapons');
    expect(screen.queryByTestId('pending-choice-cleric.divineOrder')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Protector' }));
    fireEvent.click(
      within(screen.getByTestId('pending-choice-cleric.divineOrder')).getByRole('radio', { name: 'Thaumaturge' }),
    );
    expect(cantripsKnown(get())).toBe(before + 1);
    expect(classProficiencies(get()).armor).not.toContain('Heavy armor');
  });

  it('grants the skill picked for Primal Knowledge', () => {
    const { get } = renderChoices({ level: 3, classes: [{ id: 'barbarian', level: 3 }] });
    const item = screen.getByTestId('pending-choice-barbarian.primalKnowledge');
    fireEvent.click(within(item).getByRole('radio', { name: 'Perception' }));
    expect(effectiveSkillTraining(get(), 'perception').proficient).toBe(true);
    expect(effectiveSkillTraining(get(), 'perception').sourceLabel).toContain('Primal Knowledge');
  });

  it('asks a multiclass Rogue for a skill and applies it', () => {
    const { get } = renderChoices({
      level: 2,
      classes: [
        { id: 'fighter', level: 1 },
        { id: 'rogue', level: 1 },
      ],
    });
    const item = screen.getByTestId('pending-multiclass-rogue-skill');
    expect(item).toHaveTextContent('Choose 1 more Rogue multiclass skill');
    fireEvent.click(within(item).getByRole('checkbox', { name: 'Stealth' }));
    expect(get().classes?.[1].skillChoices).toEqual(['stealth']);
    expect(screen.queryByTestId('pending-multiclass-rogue-skill')).not.toBeInTheDocument();
  });

  it('renders nothing for a class with no choices', () => {
    renderChoices({ level: 1, classes: [{ id: 'wizard', level: 1 }] });
    expect(screen.queryByTestId(/pending-choice-/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Class choices' })).not.toBeInTheDocument();
  });
});
