import { describe, expect, it } from 'vitest';
import type { Character, InventoryItem } from '../../types/character';
import type { ClassId } from '../../data/classes';
import { createCharacter } from '../../storage/character-store';
import {
  UNARMED_ATTACK_ID,
  attackSourceList,
  buildAttackPlan,
  damageOutcome,
  diceRange,
  lightExtraOptions,
  parseTargetAc,
  recordAttackEvent,
  resolveSelectedMode,
  targetConditionSources,
  targetCover,
} from '../attack-flow';
import { freshTurn } from '../turn-economy';

const weapon = (id: string, catalogId: string): InventoryItem => ({ id, kind: 'weapon', catalogId, quantity: 1 });

function fighter(overrides: Partial<Character> = {}): Character {
  const c = createCharacter('Tester');
  return {
    ...c,
    level: 5,
    class: { id: 'fighter' as ClassId, level: 5 },
    abilities: { ...c.abilities, str: 16, dex: 12 },
    inventory: [weapon('w1', 'longsword')],
    equipped: { weaponItemIds: ['w1'] },
    ...overrides,
  };
}

const sum = (components: { value: number }[]) => components.reduce((total, c) => total + c.value, 0);

describe('target', () => {
  it('parses a typed Armor Class', () => {
    expect(parseTargetAc('15')).toBe(15);
    expect(parseTargetAc(' 0 ')).toBe(0);
    expect(parseTargetAc('')).toBeUndefined();
    expect(parseTargetAc('-3')).toBeUndefined();
    expect(parseTargetAc('1.5')).toBeUndefined();
  });

  it('has no cover result until an Armor Class is entered, and applies only the most protective cover', () => {
    expect(targetCover({ cover: 'none' })).toBeUndefined();
    expect(targetCover({ ac: 15, cover: 'none' })?.effectiveAc).toBe(15);
    expect(targetCover({ ac: 15, cover: 'half' })?.effectiveAc).toBe(17);
    expect(targetCover({ ac: 15, cover: 'three-quarters' })?.effectiveAc).toBe(20);
    expect(targetCover({ ac: 15, cover: 'total' })?.targetable).toBe(false);
  });
});

describe('buildAttackPlan', () => {
  it('builds a weapon plan from the equipped weapon', () => {
    const plan = buildAttackPlan(fighter(), 'w1');
    expect(plan?.name).toBe('Longsword');
    expect(plan?.attackBonus.total).toBe(6);
    expect(plan?.damage.dice).toBe('1d8');
    expect(plan?.damage.flat).toBe(3);
    expect(plan?.exhaustion).toBe(0);
  });

  it('returns undefined for an item that is not an equipped weapon', () => {
    expect(buildAttackPlan(fighter(), 'nope')).toBeUndefined();
    expect(buildAttackPlan(fighter({ equipped: { weaponItemIds: [] } }), 'w1')).toBeUndefined();
  });

  it('builds an Unarmed Strike plan: Strength + Proficiency, fixed 1 + Strength damage', () => {
    const plan = buildAttackPlan(fighter(), UNARMED_ATTACK_ID);
    expect(plan?.unarmed).toBe(true);
    expect(plan?.attackBonus.total).toBe(6);
    expect(plan?.damage).toMatchObject({ dice: '1', flat: 3, damageType: 'bludgeoning' });
  });

  it('carries the Exhaustion level for the d20', () => {
    expect(buildAttackPlan(fighter({ exhaustionLevel: 3 }), 'w1')?.exhaustion).toBe(3);
  });

  it('gives the Light extra and Cleave kinds no positive modifier', () => {
    const c = fighter({ inventory: [weapon('w1', 'dagger')] });
    expect(buildAttackPlan(c, 'w1', { kind: 'light-extra' })?.damage.flat).toBe(0);
    expect(buildAttackPlan(c, 'w1', { kind: 'cleave' })?.damage.flat).toBe(0);
    expect(buildAttackPlan(c, 'w1')?.damage.flat).toBe(3);
  });
});

describe('attack sources and the resolved mode', () => {
  const longbow = fighter({ inventory: [weapon('w1', 'longbow')] });

  it('suggests range disadvantage and flags beyond long range as blocked', () => {
    const plan = buildAttackPlan(longbow, 'w1')!;
    const far = attackSourceList(longbow, plan, { distanceFt: 300 });
    expect(far.sources.some((s) => s.id === 'rule:beyond-normal-range' && s.side === 'disadvantage')).toBe(true);
    expect(far.blocked).toBe(false);
    expect(attackSourceList(longbow, plan, { distanceFt: 601 }).blocked).toBe(true);
  });

  it('lists attacker conditions from the catalog and the target conditions as manual sources', () => {
    const c = fighter({ conditions: [{ id: 'poisoned' }] });
    const plan = buildAttackPlan(c, 'w1')!;
    const list = attackSourceList(c, plan, {});
    expect(list.sources.find((s) => s.id === 'condition:poisoned')?.side).toBe('disadvantage');
    expect(list.sources.some((s) => s.origin === 'manual')).toBe(true);
    expect(targetConditionSources().some((s) => s.id === 'target-condition:prone:near' && s.side === 'advantage')).toBe(true);
    expect(targetConditionSources().some((s) => s.id === 'target-condition:prone:far' && s.side === 'disadvantage')).toBe(true);
  });

  it('applies nothing until the sources are chosen, cancels a mix, and never stacks', () => {
    const c = fighter();
    const plan = buildAttackPlan(c, 'w1')!;
    const { sources } = attackSourceList(c, plan, { targetUnseen: true, attackerUnseen: true });
    expect(resolveSelectedMode(sources, []).mode).toBe('normal');
    expect(resolveSelectedMode(sources, ['rule:target-unseen']).mode).toBe('disadvantage');
    expect(resolveSelectedMode(sources, ['rule:attacker-unseen']).mode).toBe('advantage');
    const mixed = resolveSelectedMode(sources, ['rule:target-unseen', 'rule:attacker-unseen']);
    expect(mixed).toMatchObject({ mode: 'normal', cancelled: true });
    const two = resolveSelectedMode(sources, ['rule:attacker-unseen', 'manual:advantage']);
    expect(two).toMatchObject({ mode: 'advantage', cancelled: false });
  });

  it('only offers the unseen sources for an Unarmed Strike', () => {
    const c = fighter();
    const plan = buildAttackPlan(c, UNARMED_ATTACK_ID)!;
    const ids = attackSourceList(c, plan, { targetUnseen: true, attackerUnseen: true }).sources.filter((s) => s.origin === 'rule').map((s) => s.id);
    expect(ids.sort()).toEqual(['rule:attacker-unseen', 'rule:target-unseen']);
  });
});

describe('damage outcome', () => {
  const plan = buildAttackPlan(fighter(), 'w1')!;

  it('adds the flat modifier once and keeps components summing to the total', () => {
    const out = damageOutcome(plan.damage, '1d8', 5, false);
    expect(out.total).toBe(8);
    expect(sum(out.breakdown.components)).toBe(out.breakdown.total);
    expect(out.breakdown.components.map((c) => c.label)).toContain('Cannot go below 0');
  });

  it('labels doubled dice on a Critical Hit', () => {
    const out = damageOutcome(plan.damage, '2d8', 10, true);
    expect(out.total).toBe(13);
    expect(out.critical).toBe(true);
    expect(out.breakdown.components[0].label).toContain('dice doubled');
    expect(out.breakdown.note).toContain('rolled twice');
  });

  it('never goes below 0 and shows the floor as a component', () => {
    const c = fighter();
    const weak = buildAttackPlan({ ...c, abilities: { ...c.abilities, str: 3 } }, 'w1')!;
    const out = damageOutcome(weak.damage, '1d8', 1, false); // 1 - 4 = -3
    expect(out.total).toBe(0);
    expect(sum(out.breakdown.components)).toBe(0);
    expect(out.breakdown.components.at(-1)).toMatchObject({ label: 'Cannot go below 0', value: 3 });
  });

  it('treats a fixed amount as no dice', () => {
    const out = damageOutcome(buildAttackPlan(fighter(), UNARMED_ATTACK_ID)!.damage, '1', 1, true);
    expect(out.total).toBe(4);
    expect(out.breakdown.components[0].label).toBe('Fixed damage');
  });

  it('reports the range of the dice', () => {
    expect(diceRange('2d8')).toEqual({ count: 2, min: 2, max: 16 });
    expect(diceRange('1')).toEqual({ count: 0, min: 1, max: 1 });
    expect(() => diceRange('d8')).toThrow();
  });
});

describe('Light extra options', () => {
  it('lists different Light weapons only, and explains when there are none', () => {
    const pair = fighter({
      inventory: [weapon('w1', 'shortsword'), weapon('w2', 'dagger'), weapon('w3', 'longsword')],
      equipped: { weaponItemIds: ['w1', 'w2', 'w3'] },
    });
    expect(lightExtraOptions(pair, 'w1')?.candidates.map((c) => c.item.id)).toEqual(['w2']);
    expect(lightExtraOptions(pair, 'w3')).toBeUndefined();
    const alone = fighter({ inventory: [weapon('w1', 'dagger')] });
    const options = lightExtraOptions(alone, 'w1');
    expect(options?.candidates).toEqual([]);
    expect(options?.reason).toContain('different');
  });
});

describe('recording turn events', () => {
  const inCombat = (c: Character): Character => ({
    ...c,
    combat: { inCombat: true, round: 1, combatants: [], activeIndex: 0, turn: freshTurn() },
  });

  it('records nothing outside combat and returns the same character', () => {
    const c = fighter();
    expect(recordAttackEvent(c, 'action')).toEqual({ character: c, warnings: [] });
    expect(recordAttackEvent(c, 'action').character).toBe(c);
  });

  it('records the action and bonus events in combat and warns without blocking', () => {
    const c = inCombat(fighter());
    const a = recordAttackEvent(c, 'action');
    expect(a.character.combat?.turn.actionUsed).toBe(true);
    expect(a.warnings).toEqual([]);
    const again = recordAttackEvent(a.character, 'action');
    expect(again.character.combat?.turn.actionUsed).toBe(true);
    expect(again.warnings).toContain('action-already-used');
    expect(recordAttackEvent(c, 'bonus').character.combat?.turn.bonusUsed).toBe(true);
  });

  it('records nothing when the tracker exists but combat has ended', () => {
    const c = fighter();
    const ended: Character = { ...c, combat: { inCombat: false, round: 1, combatants: [], activeIndex: 0, turn: freshTurn() } };
    expect(recordAttackEvent(ended, 'action').character).toBe(ended);
  });
});
