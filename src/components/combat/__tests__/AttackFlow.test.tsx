import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { AttackFlow } from '../AttackFlow';
import { StepIndicator } from '../StepIndicator';
import { CombatPage } from '../../pages/CombatPage';
import type { Character, InventoryItem } from '../../../types/character';
import type { ClassId } from '../../../data/classes';
import { createCharacter } from '../../../storage/character-store';
import { DEFAULT_ATTACK_TARGET, type AttackTarget } from '../../../logic/attack-flow';
import { freshTurn } from '../../../logic/turn-economy';
import { DICE_ENTRY_MODE_KEY } from '../../../hooks/useDiceEntryMode';
import type { RNG } from '../../../logic/random';

let latest: Character;
let latestAmmo: Record<string, number>;

/** An RNG that returns the given [face, sides] values in order. */
function seq(...dice: [number, number][]): RNG {
  let i = 0;
  return () => {
    const [face, sides] = dice[Math.min(i, dice.length - 1)];
    i += 1;
    return (face - 0.5) / sides;
  };
}

function Harness({
  initial,
  weaponId = 'w1',
  dice = 'manual',
  rng,
}: {
  initial: Character;
  weaponId?: string;
  dice?: 'manual' | 'auto';
  rng?: RNG;
}) {
  const [character, setCharacter] = useState<Character>(initial);
  const [target, setTarget] = useState<AttackTarget>(DEFAULT_ATTACK_TARGET);
  const [ammo, setAmmo] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(true);
  if (!open) return <p>Closed</p>;
  return (
    <AttackFlow
      character={character}
      onChange={(next) => {
        latest = next;
        setCharacter(next);
      }}
      weaponId={weaponId}
      onClose={() => setOpen(false)}
      target={target}
      onTargetChange={setTarget}
      ammoUsed={ammo}
      onAmmoUsedChange={(next) => {
        latestAmmo = next;
        setAmmo(next);
      }}
      diceEntryMode={dice}
      rng={rng}
    />
  );
}

const weapon = (id: string, catalogId: string): InventoryItem => ({ id, kind: 'weapon', catalogId, quantity: 1 });
const ammoItem = (id: string, catalogId: string, quantity: number): InventoryItem => ({
  id,
  kind: 'equipment',
  catalogId,
  quantity,
});

/** Level 5 Fighter, Str 16 (+3), Dex 12 (+1), Proficiency +3, Weapon Mastery limit 4. */
function fighter(overrides: Partial<Character> = {}): Character {
  const c = createCharacter('Tester');
  return {
    ...c,
    level: 5,
    class: { id: 'fighter' as ClassId, level: 5 },
    abilities: { ...c.abilities, str: 16, dex: 12 },
    hpMax: 40,
    inventory: [weapon('w1', 'longsword')],
    equipped: { weaponItemIds: ['w1'] },
    ...overrides,
  };
}

const inCombat = (c: Character): Character => ({
  ...c,
  combat: {
    inCombat: true,
    round: 1,
    combatants: [{ id: 'me', name: 'Me', initiative: 12, isCharacter: true }],
    activeIndex: 0,
    turn: freshTurn(),
  },
});

function renderFlow(initial: Character, props: { weaponId?: string; dice?: 'manual' | 'auto'; rng?: RNG } = {}) {
  latest = initial;
  latestAmmo = {};
  return render(<Harness initial={initial} {...props} />);
}

const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));
const radio = (name: RegExp | string) => fireEvent.click(screen.getByRole('radio', { name }));
const checkbox = (name: RegExp | string) => fireEvent.click(screen.getByRole('checkbox', { name }));
const setAc = (ac: string) => fireEvent.change(screen.getByLabelText('Target Armor Class'), { target: { value: ac } });
const flow = () => screen.getByTestId('attack-flow');

/** Weapon step: enter the AC and continue to the Roll step. */
function toRoll(ac = '15') {
  setAc(ac);
  click('Continue to roll');
}

/** Roll step: enter d20 faces in the roll prompt and use the result. */
function rollAttack(...faces: number[]) {
  click(/^(Enter attack roll|Roll attack)$/);
  const dialog = screen.getByRole('dialog', { name: /attack roll$/ });
  if (faces.length === 2) {
    fireEvent.change(within(dialog).getByLabelText('First d20 roll'), { target: { value: String(faces[0]) } });
    fireEvent.change(within(dialog).getByLabelText('Second d20 roll'), { target: { value: String(faces[1]) } });
  } else {
    fireEvent.change(within(dialog).getByLabelText('Your d20 roll'), { target: { value: String(faces[0]) } });
  }
  fireEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Use attack roll' }));
}

const outcome = () => screen.getByTestId('attack-outcome');
const announcer = () => screen.getByTestId('attack-announcer');

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('StepIndicator', () => {
  it('marks the current step and speaks each status', () => {
    const { container } = render(<StepIndicator steps={['Weapon', 'Roll', 'Damage', 'Result']} currentStep={1} />);
    expect(screen.getByRole('group', { name: 'Step progress' })).toBeTruthy();
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(screen.getByText('Weapon').textContent).toContain('(completed)');
    expect(screen.getByText('Roll').textContent).toContain('(current step)');
    expect(screen.getByText('Result').textContent).toContain('(upcoming)');
  });
});

describe('Weapon step', () => {
  it('shows the attack bonus Breakdown with zero components and starts on step 1', () => {
    renderFlow(fighter());
    expect(screen.getByRole('heading', { name: 'Step 1: Weapon' })).toBeTruthy();
    const bonus = within(flow()).getByRole('button', { name: /Longsword attack bonus/ });
    expect(bonus.textContent).toBe('+6');
    fireEvent.mouseEnter(bonus);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Strength mod');
    expect(tip.textContent).toContain('Proficiency');
    expect(tip.textContent).toContain('Magic / other');
  });

  it('needs a target Armor Class before the roll step', () => {
    renderFlow(fighter());
    expect((screen.getByRole('button', { name: 'Continue to roll' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('attack-blockers').textContent).toContain('Armor Class');
    setAc('14');
    expect((screen.getByRole('button', { name: 'Continue to roll' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the cover-adjusted Armor Class as a Breakdown', () => {
    renderFlow(fighter());
    setAc('15');
    radio(/Half/);
    const ac = screen.getByRole('button', { name: /Armor Class to hit/ });
    expect(ac.textContent).toBe('17');
    fireEvent.mouseEnter(ac);
    expect(screen.getByRole('tooltip').textContent).toContain('Half Cover');
  });

  it('blocks the attack under Total Cover with an explanation', () => {
    renderFlow(fighter());
    setAc('15');
    radio(/Total/);
    expect((screen.getByRole('button', { name: 'Continue to roll' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('attack-blockers').textContent).toContain('Total Cover');
    expect(screen.getByTestId('attack-blockers').textContent).toContain('cannot be targeted');
  });

  it('offers a Finesse ability choice and switches the attack bonus', () => {
    renderFlow(fighter({ abilities: { ...fighter().abilities, str: 10, dex: 18 }, inventory: [weapon('w1', 'rapier')] }));
    expect(screen.getByRole('button', { name: /Rapier attack bonus/ }).textContent).toBe('+7');
    radio('Strength');
    expect(screen.getByRole('button', { name: /Rapier attack bonus/ }).textContent).toBe('+3');
  });

  it('offers a thrown toggle on a Thrown weapon and a two-handed toggle on a Versatile weapon', () => {
    renderFlow(fighter({ inventory: [weapon('w1', 'handaxe')] }));
    checkbox('Throw the weapon');
    expect(screen.getByLabelText('Distance to the target in feet')).toBeTruthy();
  });

  it('switches to the Versatile dice when wielded two-handed', () => {
    renderFlow(fighter());
    expect(screen.getByRole('button', { name: /Longsword damage modifier/ }).textContent).toBe('1d8+3 slashing');
    checkbox(/Wield two-handed/);
    expect(screen.getByRole('button', { name: /Longsword damage modifier/ }).textContent).toBe('1d10+3 slashing');
  });
});

describe('Advantage and Disadvantage', () => {
  const mode = () => screen.getByTestId('attack-mode').textContent ?? '';

  it('applies nothing automatically: suggestions are unticked toggles', () => {
    renderFlow(fighter({ inventory: [weapon('w1', 'longbow'), ammoItem('a1', 'arrows', 5)], equipped: { weaponItemIds: ['w1'] } }));
    fireEvent.change(screen.getByLabelText('Distance to the target in feet'), { target: { value: '300' } });
    const box = screen.getByRole('checkbox', { name: /beyond the weapon.s normal range/ }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(mode()).toContain('Normal');
    fireEvent.click(box);
    expect(mode()).toContain('Disadvantage');
    expect(mode()).toContain('beyond the weapon');
  });

  it('cancels a mix of Advantage and Disadvantage into a normal roll', () => {
    renderFlow(fighter());
    checkbox(/Advantage from another source/);
    expect(mode()).toContain('Advantage');
    checkbox(/Disadvantage from another source/);
    expect(mode()).toContain('Normal');
    expect(mode()).toContain('cancel');
  });

  it('does not stack: two Advantage sources are still plain Advantage', () => {
    renderFlow(fighter());
    checkbox(/Advantage from another source/);
    checkbox('The target cannot see me');
    fireEvent.click(screen.getByRole('checkbox', { name: /The target cannot see you/ }));
    expect(mode()).toContain('Advantage');
    expect(mode()).not.toContain('cancel');
  });

  it('lists the attacker conditions as suggestions and the target conditions as manual toggles', () => {
    renderFlow(fighter({ conditions: [{ id: 'poisoned' }] }));
    expect(screen.getByRole('checkbox', { name: /You have the Poisoned condition/ })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Target is Paralyzed/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /You have the Poisoned condition/ }));
    expect(mode()).toContain('Disadvantage');
    fireEvent.click(screen.getByRole('checkbox', { name: /Target is Stunned/ }));
    expect(mode()).toContain('Normal');
  });

  it('blocks an attack beyond long range', () => {
    renderFlow(fighter({ inventory: [weapon('w1', 'longbow'), ammoItem('a1', 'arrows', 5)], equipped: { weaponItemIds: ['w1'] } }));
    setAc('12');
    fireEvent.change(screen.getByLabelText('Distance to the target in feet'), { target: { value: '700' } });
    expect(screen.getByTestId('attack-blockers').textContent).toContain('long range');
    expect((screen.getByRole('button', { name: 'Continue to roll' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('starts the roll prompt in the resolved mode and shows the sources', () => {
    renderFlow(fighter());
    checkbox(/Advantage from another source/);
    toRoll('12');
    click('Enter attack roll');
    const dialog = screen.getByRole('dialog', { name: /attack roll$/ });
    expect((within(dialog).getByRole('radio', { name: 'Advantage' }) as HTMLInputElement).checked).toBe(true);
    expect(dialog.textContent).toContain('Advantage from');
  });
});

describe('Roll and judgement', () => {
  it('hits when the total meets the cover-adjusted Armor Class, with the Exhaustion line shown', () => {
    renderFlow(fighter({ exhaustionLevel: 2 }));
    toRoll('17');
    rollAttack(15); // 15 + 6 - 4 = 17
    expect(outcome().textContent).toMatch(/^Hit/);
    const total = within(outcome()).getByRole('button', { name: /Attack roll total/ });
    expect(total.textContent).toBe('17');
    expect(total.getAttribute('aria-label')).toContain('Exhaustion -4');
    expect(announcer().textContent).toContain('Hit.');
  });

  it('misses one below the Armor Class', () => {
    renderFlow(fighter({ exhaustionLevel: 2 }));
    toRoll('18');
    rollAttack(15);
    expect(outcome().textContent).toMatch(/^Miss/);
  });

  it('judges a natural 20 on the raw die as a Critical Hit even under Exhaustion', () => {
    renderFlow(fighter({ exhaustionLevel: 6 }));
    toRoll('30');
    rollAttack(20);
    expect(outcome().textContent).toMatch(/^Critical Hit/);
    expect(outcome().textContent).toContain('natural 20 always hits');
  });

  it('judges a natural 1 as a miss however high the total', () => {
    renderFlow(fighter({ inventory: [weapon('w1', 'longsword')], abilities: { ...fighter().abilities, str: 30 } }));
    toRoll('1');
    rollAttack(1);
    expect(outcome().textContent).toMatch(/^Miss/);
    expect(outcome().textContent).toContain('natural 1 always misses');
  });

  it('judges against the cover-adjusted Armor Class', () => {
    renderFlow(fighter());
    setAc('13');
    radio(/Three-Quarters/); // 13 + 5 = 18
    click('Continue to roll');
    rollAttack(11); // 11 + 6 = 17 < 18
    expect(outcome().textContent).toMatch(/^Miss/);
  });

  it('uses the kept die on Advantage', () => {
    renderFlow(fighter());
    checkbox(/Advantage from another source/);
    toRoll('15');
    rollAttack(4, 12); // keeps 12: 12 + 6 = 18
    expect(outcome().textContent).toMatch(/^Hit/);
    expect(within(outcome()).getByRole('button', { name: /Attack roll total/ }).textContent).toBe('18');
  });

  it('can roll automatically with an injected RNG', () => {
    renderFlow(fighter(), { dice: 'auto', rng: seq([14, 20]) });
    toRoll('15');
    click('Roll attack');
    const dialog = screen.getByRole('dialog', { name: /attack roll$/ });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Roll' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use attack roll' }));
    expect(outcome().textContent).toMatch(/^Hit/);
  });

  it('does nothing when the roll prompt is cancelled (no ammunition spent, no event)', () => {
    const c = inCombat(
      fighter({ inventory: [weapon('w1', 'longbow'), ammoItem('a1', 'arrows', 5)], equipped: { weaponItemIds: ['w1'] } }),
    );
    renderFlow(c);
    toRoll('12');
    click('Enter attack roll');
    fireEvent.click(within(screen.getByRole('dialog', { name: /attack roll$/ })).getByRole('button', { name: 'Cancel' }));
    expect(latest).toBe(c);
    expect(screen.queryByTestId('attack-outcome')).toBeNull();
  });
});

describe('Damage', () => {
  it('adds the modifier to a typed dice total and shows the Breakdown with the damage type', () => {
    renderFlow(fighter());
    toRoll('15');
    rollAttack(12);
    click('Continue to damage');
    expect(screen.getByRole('heading', { name: 'Step 3: Damage' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Total of the 1d8 dice'), { target: { value: '5' } });
    click('Use damage dice total');
    const box = screen.getByTestId('damage-outcome');
    const total = within(box).getByRole('button', { name: /Longsword damage total/ });
    expect(total.textContent).toBe('8');
    expect(total.getAttribute('aria-label')).toContain('Strength mod');
    expect(total.getAttribute('aria-label')).toContain('Magic / other');
    expect(box.textContent).toContain('slashing damage');
    expect(screen.getByText(/does not track the target/)).toBeTruthy();
  });

  it('doubles the dice on a Critical Hit and adds the modifier once', () => {
    renderFlow(fighter());
    toRoll('15');
    rollAttack(20);
    click('Continue to damage');
    expect(screen.getByText(/Critical Hit: dice doubled/)).toBeTruthy();
    const input = screen.getByLabelText('Total of the 2d8 dice');
    fireEvent.change(input, { target: { value: '17' } });
    click('Use damage dice total');
    expect(screen.getByRole('alert').textContent).toContain('from 2 to 16');
    fireEvent.change(input, { target: { value: '10' } });
    click('Use damage dice total');
    const box = screen.getByTestId('damage-outcome');
    expect(within(box).getByRole('button', { name: /damage total/ }).textContent).toBe('13'); // 10 + 3
    expect(box.textContent).toContain('dice doubled');
  });

  it('rolls damage automatically with rollDice and doubles the dice on a Critical Hit', () => {
    renderFlow(fighter(), { dice: 'auto', rng: seq([20, 20], [5, 8], [6, 8]) });
    toRoll('15');
    click('Roll attack');
    const dialog = screen.getByRole('dialog', { name: /attack roll$/ });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Roll' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use attack roll' }));
    click('Continue to damage');
    click('Roll damage');
    const box = screen.getByTestId('damage-outcome');
    expect(box.textContent).toContain('Dice: 5, 6');
    expect(within(box).getByRole('button', { name: /damage total/ }).textContent).toBe('14'); // 5 + 6 + 3
  });

  it('copies the damage to the clipboard', async () => {
    let written = '';
    const writeText = async (text: string) => {
      written = text;
    };
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderFlow(fighter());
    toRoll('15');
    rollAttack(12);
    click('Continue to damage');
    fireEvent.change(screen.getByLabelText('Total of the 1d8 dice'), { target: { value: '4' } });
    click('Use damage dice total');
    click('Copy damage');
    expect(await screen.findByText('Copied to the clipboard.')).toBeTruthy();
    expect(written).toBe('7 slashing damage from Longsword');
  });

  it('skips damage after a miss', () => {
    renderFlow(fighter());
    toRoll('25');
    rollAttack(5);
    click('Continue to result');
    expect(screen.getByRole('heading', { name: 'Step 4: Result' })).toBeTruthy();
    expect(screen.queryByTestId('damage-outcome')).toBeNull();
  });

  it('works out an Unarmed Strike with its floor at 0', () => {
    const c = fighter();
    renderFlow({ ...c, abilities: { ...c.abilities, str: 6 } }, { weaponId: 'unarmed' });
    toRoll('10');
    rollAttack(15);
    click('Continue to damage');
    click('Work out damage');
    const total = within(screen.getByTestId('damage-outcome')).getByRole('button', { name: /damage total/ });
    expect(total.textContent).toBe('0');
    expect(total.getAttribute('aria-label')).toContain('Cannot go below 0');
  });
});

describe('Result riders', () => {
  const sword = (extra: Partial<Character> = {}) =>
    fighter({ inventory: [weapon('w1', 'greatsword')], equipped: { weaponItemIds: ['w1'] }, ...extra });

  it('shows Graze damage on a miss when the mastery is unlocked', () => {
    renderFlow(sword({ weaponMasteries: ['greatsword'] }));
    toRoll('25');
    rollAttack(5);
    click('Continue to result');
    const graze = screen.getByTestId('rider-graze');
    expect(graze.textContent).toContain('slashing');
    expect(within(graze).getByRole('button', { name: /Graze damage/ }).textContent).toBe('3');
  });

  it('shows no mastery rider while the mastery is locked (D8)', () => {
    renderFlow(sword());
    toRoll('25');
    rollAttack(5);
    click('Continue to result');
    expect(screen.queryByTestId('rider-graze')).toBeNull();
  });

  it('shows the Topple save DC on a hit', () => {
    renderFlow(fighter({ inventory: [weapon('w1', 'quarterstaff')], weaponMasteries: ['quarterstaff'] }));
    toRoll('10');
    rollAttack(15);
    click('Continue to damage');
    fireEvent.change(screen.getByLabelText('Total of the 1d6 dice'), { target: { value: '3' } });
    click('Use damage dice total');
    click('Continue to result');
    expect(within(screen.getByTestId('rider-topple')).getByRole('button', { name: /Topple DC/ }).textContent).toBe('14');
  });

  it('shows informational mastery text for Sap on a hit', () => {
    renderFlow(fighter({ weaponMasteries: ['longsword'] }));
    toRoll('10');
    rollAttack(15);
    click('Continue to damage');
    fireEvent.change(screen.getByLabelText('Total of the 1d8 dice'), { target: { value: '3' } });
    click('Use damage dice total');
    click('Continue to result');
    expect(screen.getByTestId('rider-info').textContent).toContain('Sap');
  });

  it('offers a manual Cleave attack on a hit that adds no positive modifier', () => {
    renderFlow(fighter({ inventory: [weapon('w1', 'greataxe')], weaponMasteries: ['greataxe'] }));
    toRoll('10');
    rollAttack(15);
    click('Continue to damage');
    fireEvent.change(screen.getByLabelText('Total of the 1d12 dice'), { target: { value: '6' } });
    click('Use damage dice total');
    click('Continue to result');
    click('Cleave attack');
    expect(screen.getByRole('heading', { name: /Cleave attack: Greataxe/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Greataxe damage modifier/ }).textContent).toBe('1d12+0 slashing');
    // The weapon cannot be changed during a Cleave attack, and the AC is remembered.
    expect((screen.getByLabelText('Weapon') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('Target Armor Class') as HTMLInputElement).value).toBe('10');
  });

  it('offers no Cleave attack without the mastery or on a miss', () => {
    renderFlow(fighter({ inventory: [weapon('w1', 'greataxe')] }));
    toRoll('10');
    rollAttack(15);
    click('Continue to damage');
    fireEvent.change(screen.getByLabelText('Total of the 1d12 dice'), { target: { value: '6' } });
    click('Use damage dice total');
    click('Continue to result');
    expect(screen.queryByRole('button', { name: 'Cleave attack' })).toBeNull();
  });
});

describe('Ammunition', () => {
  const archer = (quantity: number) =>
    fighter({
      inventory: [weapon('w1', 'longbow'), ammoItem('a1', 'arrows', quantity)],
      equipped: { weaponItemIds: ['w1'] },
    });

  it('is blocked at 0 with an explanation', () => {
    renderFlow(archer(0));
    setAc('12');
    expect(screen.getByTestId('attack-blockers').textContent).toContain('cannot be fired');
    expect((screen.getByRole('button', { name: 'Continue to roll' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('spends one piece when the attack is rolled and counts it as fired this fight', () => {
    renderFlow(archer(2));
    toRoll('12');
    rollAttack(15);
    expect(latest.inventory?.find((i) => i.id === 'a1')?.quantity).toBe(1);
    expect(latestAmmo).toEqual({ a1: 1 });
    expect(announcer().textContent).toContain('1 left');
  });

  it('blocks the next attack once the last piece is gone', () => {
    renderFlow(archer(1));
    toRoll('12');
    rollAttack(15);
    click('Continue to damage');
    fireEvent.change(screen.getByLabelText('Total of the 1d8 dice'), { target: { value: '3' } });
    click('Use damage dice total');
    click('Continue to result');
    click('Another attack in this Attack action');
    expect(screen.getByTestId('attack-blockers').textContent).toContain('cannot be fired');
  });
});

describe('Turn events', () => {
  it('records nothing outside combat', () => {
    const c = fighter();
    renderFlow(c);
    toRoll('15');
    rollAttack(15);
    expect(latest).toBe(c);
  });

  it('records the action event once per Attack action while in combat', () => {
    renderFlow(inCombat(fighter()));
    toRoll('15');
    rollAttack(15);
    expect(latest.combat?.turn.actionUsed).toBe(true);
    expect(latest.combat?.turn.bonusUsed).toBe(false);
    click('Continue to damage');
    fireEvent.change(screen.getByLabelText('Total of the 1d8 dice'), { target: { value: '3' } });
    click('Use damage dice total');
    click('Continue to result');
    expect(screen.queryByTestId('attack-warnings')).toBeNull();
    // A second attack in the same Attack action does not record the action again.
    click('Another attack in this Attack action');
    toRoll('15');
    rollAttack(15);
    click('Continue to damage');
    fireEvent.change(screen.getByLabelText('Total of the 1d8 dice'), { target: { value: '3' } });
    click('Use damage dice total');
    click('Continue to result');
    expect(screen.queryByTestId('attack-warnings')).toBeNull();
  });

  it('warns without blocking when the action was already used', () => {
    const c = inCombat(fighter());
    const used = { ...c, combat: { ...c.combat!, turn: { ...c.combat!.turn, actionUsed: true } } };
    renderFlow(used);
    toRoll('15');
    rollAttack(15);
    click('Continue to damage');
    fireEvent.change(screen.getByLabelText('Total of the 1d8 dice'), { target: { value: '3' } });
    click('Use damage dice total');
    click('Continue to result');
    expect(screen.getByTestId('attack-warnings').textContent).toContain('already used your action');
    expect(latest.combat?.turn.actionUsed).toBe(true);
  });

  const lightPair = () =>
    inCombat(
      fighter({
        inventory: [weapon('w1', 'shortsword'), weapon('w2', 'dagger')],
        equipped: { weaponItemIds: ['w1', 'w2'] },
        weaponMasteries: ['dagger'],
      }),
    );

  function toLightExtra() {
    toRoll('10');
    rollAttack(15);
    click('Continue to damage');
    fireEvent.change(screen.getByLabelText('Total of the 1d6 dice'), { target: { value: '3' } });
    click('Use damage dice total');
    click('Continue to result');
  }

  it('records the bonus event for the Light extra attack', () => {
    renderFlow(lightPair());
    toLightExtra();
    expect(latest.combat?.turn.actionUsed).toBe(true);
    expect(latest.combat?.turn.bonusUsed).toBe(false);
    click('Light extra attack');
    expect(screen.getByRole('heading', { name: /Light extra attack \(Bonus Action\): Dagger/ })).toBeTruthy();
    // The extra attack adds no positive modifier to damage.
    expect(screen.getByRole('button', { name: /Dagger damage modifier/ }).textContent).toBe('1d4+0 piercing');
    toRoll('10');
    rollAttack(15);
    expect(latest.combat?.turn.bonusUsed).toBe(true);
  });

  it('does not use the Bonus Action when made as part of the Attack action (Nick)', () => {
    renderFlow(lightPair());
    toLightExtra();
    expect(screen.getByText(/Nick:/)).toBeTruthy();
    checkbox(/Made as part of the Attack action \(Nick\)/);
    click('Light extra attack');
    toRoll('10');
    rollAttack(15);
    expect(latest.combat?.turn.bonusUsed).toBe(false);
  });

  it('shows no Nick toggle while the Nick mastery is locked', () => {
    const c = lightPair();
    renderFlow({ ...c, weaponMasteries: [] });
    toLightExtra();
    expect(screen.queryByRole('checkbox', { name: /Nick/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Light extra attack' })).toBeTruthy();
  });

  it('offers no Light extra attack from a weapon without the Light property', () => {
    renderFlow(fighter());
    toRoll('10');
    rollAttack(15);
    click('Continue to damage');
    fireEvent.change(screen.getByLabelText('Total of the 1d8 dice'), { target: { value: '3' } });
    click('Use damage dice total');
    click('Continue to result');
    expect(screen.queryByTestId('light-extra')).toBeNull();
  });

  it('explains when no different Light weapon is equipped', () => {
    renderFlow(fighter({ inventory: [weapon('w1', 'dagger')], equipped: { weaponItemIds: ['w1'] } }));
    toRoll('10');
    rollAttack(15);
    click('Continue to damage');
    fireEvent.change(screen.getByLabelText('Total of the 1d4 dice'), { target: { value: '3' } });
    click('Use damage dice total');
    click('Continue to result');
    expect(screen.getByTestId('light-extra').textContent).toContain('different equipped Light weapon');
    expect(screen.queryByRole('button', { name: 'Light extra attack' })).toBeNull();
  });
});

describe('Accessibility and wiring', () => {
  it('closes with Escape and returns focus to the Attack button', () => {
    localStorage.setItem(DICE_ENTRY_MODE_KEY, 'manual');
    latest = fighter();
    render(
      <CombatPage
        character={fighter()}
        onChange={() => {
          /* no state needed here */
        }}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Attack with Longsword' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByTestId('attack-flow')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('attack-flow')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('returns focus to the Attack button when closed with the close button', () => {
    render(<CombatPage character={fighter()} onChange={() => undefined} />);
    const trigger = screen.getByRole('button', { name: 'Attack with Unarmed Strike' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: 'Close attack flow' }));
    expect(document.activeElement).toBe(trigger);
  });

  it('moves focus to the step heading when the step changes', () => {
    renderFlow(fighter());
    toRoll('15');
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Step 2: Roll' }));
  });

  it('announces results in a live region', () => {
    renderFlow(fighter());
    expect(announcer().getAttribute('aria-live')).toBe('polite');
    expect(announcer().getAttribute('role')).toBe('status');
    toRoll('15');
    rollAttack(15);
    expect(announcer().textContent).toContain('Longsword attack total 21 against Armor Class 15');
  });

  it('remembers the last-used target Armor Class and cover when reopened', () => {
    localStorage.setItem(DICE_ENTRY_MODE_KEY, 'manual');
    function Page() {
      const [character, setCharacter] = useState<Character>(fighter());
      return <CombatPage character={character} onChange={setCharacter} />;
    }
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Attack with Longsword' }));
    setAc('16');
    radio(/Half/);
    fireEvent.click(screen.getByRole('button', { name: 'Close attack flow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Attack with Longsword' }));
    expect((screen.getByLabelText('Target Armor Class') as HTMLInputElement).value).toBe('16');
    expect((screen.getByRole('radio', { name: /Half/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('keeps the Ammunition tracker in step with shots fired from the flow', () => {
    localStorage.setItem(DICE_ENTRY_MODE_KEY, 'manual');
    function Page() {
      const [character, setCharacter] = useState<Character>(
        fighter({
          inventory: [weapon('w1', 'longbow'), ammoItem('a1', 'arrows', 10)],
          equipped: { weaponItemIds: ['w1'] },
        }),
      );
      return <CombatPage character={character} onChange={setCharacter} />;
    }
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Attack with Longbow' }));
    toRoll('12');
    rollAttack(15);
    fireEvent.click(screen.getByRole('button', { name: 'Close attack flow' }));
    expect(screen.getByTestId('ammo-used-a1').textContent).toBe('1');
    expect(within(screen.getByTestId('ammo-a1')).getByText('9')).toBeTruthy();
  });

  it('shows a message and a Close button when the weapon is no longer equipped', () => {
    renderFlow(fighter(), { weaponId: 'gone' });
    expect(screen.getByText('That weapon is no longer equipped.')).toBeTruthy();
    click('Close');
    expect(screen.getByText('Closed')).toBeTruthy();
  });
});
