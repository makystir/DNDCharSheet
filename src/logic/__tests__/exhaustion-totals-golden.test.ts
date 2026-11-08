/**
 * Harness for exhaustion-totals-golden.ts (rows authored from the PHB first;
 * never edited here). Wires each row to the static-total functions and to the
 * in-app roll paths.
 */
import { describe, it, expect } from 'vitest';
import type { Character, InventoryItem } from '../../types/character';
import { createCharacter } from '../../storage/character-store';
import type { Breakdown } from '../breakdown';
import { setExhaustion, withExhaustion } from '../conditions';
import { allSkillBreakdowns } from '../skills';
import { allSavingThrowBreakdowns } from '../saving-throws';
import { initiativeBreakdown } from '../initiative';
import { passivePerceptionBreakdown } from '../passive-checks';
import { spellAttackBreakdown, spellSaveDcBreakdown } from '../spellcasting';
import { resolveAttack, unarmedStrike, weaponAttackProfile } from '../attacks';
import { characterInitiativeModifier, initiativeRoll } from '../initiative-roll';
import { resolveConcentrationSave } from '../concentration';
import { effectiveAbilityScores } from '../feats';
import {
  D20_ROWS,
  LEVELS,
  PENALTY,
  ROLL_ONCE_ROWS,
  UNAFFECTED_ROWS,
} from './exhaustion-totals-golden';

const DAGGER: InventoryItem = { id: 'w1', kind: 'weapon', catalogId: 'dagger', quantity: 1, attackBonus: 1 };

function build(level: number): Character {
  const base: Character = {
    ...createCharacter('Golden'),
    level: 5,
    classes: [{ id: 'sorcerer', level: 5 }],
    abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 16, cha: 18 },
    skills: {
      perception: { proficient: true, expertise: false },
      stealth: { proficient: true, expertise: true },
    },
    initiativeBonus: 1,
    inventory: [DAGGER],
  };
  return setExhaustion(base, level);
}

/** The Exhaustion component must be present (even at 0) and the sum invariant must hold. */
function expectLabelledOnce(b: Breakdown, level: number): void {
  const ex = b.components.filter((c) => c.label.startsWith('Exhaustion'));
  expect(ex).toHaveLength(1);
  expect(ex[0].value).toBe(PENALTY[level]);
  expect(b.components.reduce((n, c) => n + c.value, 0)).toBe(b.total);
}

describe.each(LEVELS)('exhaustion golden: level %i static D20-Test totals', (level) => {
  const c = build(level);
  const scores = effectiveAbilityScores(c);

  it('skills', () => {
    const skills = allSkillBreakdowns(c);
    expect(skills.perception.total).toBe(D20_ROWS.perceptionSkill.totals[level]);
    expect(skills.stealth.total).toBe(D20_ROWS.stealthSkill.totals[level]);
    expect(skills.athletics.total).toBe(D20_ROWS.athleticsSkill.totals[level]);
    for (const id of ['perception', 'stealth', 'athletics'] as const) expectLabelledOnce(skills[id], level);
  });

  it('saving throws', () => {
    const saves = allSavingThrowBreakdowns(c);
    expect(saves.cha.total).toBe(D20_ROWS.chaSave.totals[level]);
    expect(saves.dex.total).toBe(D20_ROWS.dexSave.totals[level]);
    expectLabelledOnce(saves.cha, level);
    expectLabelledOnce(saves.dex, level);
  });

  it('initiative', () => {
    const b = initiativeBreakdown(scores, c.initiativeBonus, level);
    expect(b.total).toBe(D20_ROWS.initiative.totals[level]);
    expectLabelledOnce(b, level);
  });

  it('weapon, unarmed and spell attack bonuses', () => {
    const dagger = withExhaustion(weaponAttackProfile(c, DAGGER)!.attack.breakdown, level);
    const unarmed = withExhaustion(unarmedStrike(scores, 3).attack, level);
    const spell = spellAttackBreakdown(c)!;
    expect(dagger.total).toBe(D20_ROWS.daggerAttack.totals[level]);
    expect(unarmed.total).toBe(D20_ROWS.unarmedAttack.totals[level]);
    expect(spell.total).toBe(D20_ROWS.spellAttack.totals[level]);
    for (const b of [dagger, unarmed, spell]) expectLabelledOnce(b, level);
  });

  it('does not apply to passive scores or DCs', () => {
    expect(passivePerceptionBreakdown(c).total).toBe(UNAFFECTED_ROWS.passivePerception.total);
    expect(spellSaveDcBreakdown(c)!.total).toBe(UNAFFECTED_ROWS.spellSaveDc.total);
    const strike = unarmedStrike(scores, 3);
    expect(strike.grappleDc.total).toBe(UNAFFECTED_ROWS.grappleDc.total);
    expect(strike.shoveDc.total).toBe(UNAFFECTED_ROWS.shoveDc.total);
    for (const b of [passivePerceptionBreakdown(c), spellSaveDcBreakdown(c)!, strike.grappleDc, strike.shoveDc]) {
      expect(b.components.some((x) => x.label.startsWith('Exhaustion'))).toBe(false);
    }
  });

  it('counts the penalty exactly once on in-app rolls', () => {
    const init = initiativeRoll([ROLL_ONCE_ROWS.initiativeRoll.face], 'normal', characterInitiativeModifier(c), level);
    expect(init.breakdown.total).toBe(ROLL_ONCE_ROWS.initiativeRoll.totals[level]);
    expect(init.breakdown.components.filter((x) => x.label.startsWith('Exhaustion'))).toHaveLength(1);

    const profile = weaponAttackProfile(c, DAGGER)!;
    const atk = resolveAttack([ROLL_ONCE_ROWS.daggerAttackRoll.face], 'normal', profile.attack.breakdown, profile.exhaustion, 0);
    expect(atk.total).toBe(ROLL_ONCE_ROWS.daggerAttackRoll.totals[level]);
    expect(atk.breakdown.components.filter((x) => x.label.startsWith('Exhaustion'))).toHaveLength(1);

    const conc = resolveConcentrationSave(c, ROLL_ONCE_ROWS.concentrationSave.face, 10);
    expect(conc.total).toBe(ROLL_ONCE_ROWS.concentrationSave.totals[level]);
    expect(conc.breakdown.components.filter((x) => x.label.startsWith('Exhaustion'))).toHaveLength(1);
  });
});

describe('exhaustion golden: penalty table is -2 x level (PHB L21024)', () => {
  it.each(LEVELS)('level %i', (level) => {
    expect(PENALTY[level]).toBe(0 - 2 * level);
  });
});
