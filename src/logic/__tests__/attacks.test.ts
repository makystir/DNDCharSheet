import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, InventoryItem } from '../../types/character';
import { getWeapon, type WeaponData } from '../../data/weapons';
import type { ClassId } from '../../data/classes';
import { addCondition, setExhaustion } from '../conditions';
import type { Breakdown } from '../breakdown';
import { formatEquation } from '../breakdown';
import { sumComponents } from './breakdown-helpers';
import {
  ammunitionEquipmentIds,
  attackAbility,
  attackBonusBreakdown,
  attackSuggestions,
  attackerConditionSuggestions,
  coverAc,
  damageTotal,
  doubleDice,
  equippedWeapons,
  fireAmmo,
  lightExtraAvailable,
  lightExtraStatus,
  matchingAmmunition,
  recoverAmmo,
  resolveAttack,
  resolveAttackMode,
  rollAttack,
  rollWeaponDamage,
  unarmedStrike,
  weaponAttackProfile,
  weaponDamage,
  type AttackAbilityResult,
  type AttackBonus,
  type AttackBonusInput,
  type AttackResolution,
  type AttackSuggestions,
  type CoverResult,
  type WeaponDamage,
  type WeaponDamageInput,
} from '../attacks';
import {
  AMMO_FIRE_CASES,
  AMMO_RECOVER_CASES,
  ATTACK_BONUS_CASES,
  ATTACK_RESOLUTION_CASES,
  ATTACK_SUGGESTION_CASES,
  COVER_CASES,
  DOUBLE_DICE_CASES,
  LIGHT_EXTRA_CASES,
  UNARMED_CASES,
  WEAPON_DAMAGE_CASES,
  type AmmoFireCase,
  type AttackBonusCase,
  type AttackResolutionCase,
  type AttackSuggestionCase,
  type CoverCase,
  type DoubleDiceCase,
  type LightExtraCase,
  type UnarmedCase,
  type WeaponDamageCase,
} from './weapon-golden';

const weaponOf = (id: string): WeaponData => {
  const weapon = getWeapon(id);
  if (!weapon) throw new Error(`unknown weapon ${id}`);
  return weapon;
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

function invariantBreakdown(b: Breakdown): string[] {
  return b.total === sumComponents(b) ? [] : ['breakdown-sum'];
}

// ─── Attack bonus ────────────────────────────────────────────────────────────

type BonusFn = (input: AttackBonusInput) => AttackBonus;

function bonusMismatches(fn: BonusFn, row: AttackBonusCase): string[] {
  const i = row.input;
  const got = fn({
    weapon: weaponOf(i.weaponId),
    scores: { str: i.str, dex: i.dex },
    proficient: i.proficient,
    pb: i.pb,
    attackBonus: i.attackBonus,
    abilityChoice: i.abilityChoice,
  });
  const out: string[] = [];
  if (got.ability !== row.expect.ability) out.push('ability');
  if (got.abilityMod !== row.expect.abilityMod) out.push('abilityMod');
  if (got.breakdown.total !== row.expect.attackTotal) out.push('attackTotal');
  out.push(...invariantBreakdown(got.breakdown));
  return out;
}

describe('golden: ATTACK_BONUS_CASES', () => {
  for (const row of ATTACK_BONUS_CASES) {
    it(row.name, () => {
      expect(bonusMismatches(attackBonusBreakdown, row)).toEqual([]);
    });
  }

  it('lists every component, zeros included, with named sources', () => {
    const b = attackBonusBreakdown({ weapon: weaponOf('longsword'), scores: { str: 10, dex: 10 }, proficient: false, pb: 2 }).breakdown;
    expect(b.components.map((c) => c.value)).toEqual([0, 0, 0]);
    expect(b.components.map((c) => c.label)).toEqual(['Strength mod', 'Proficiency (not proficient)', 'Magic / other']);
    expect(formatEquation(b)).toContain('= 0');
  });
});

describe('attack ability: own rules', () => {
  it('ignores an ability choice on a weapon without Finesse', () => {
    const r: AttackAbilityResult = attackAbility(weaponOf('longsword'), { str: 8, dex: 18 }, 'dex');
    expect(r.ability).toBe('str');
  });
});

// ─── Damage ──────────────────────────────────────────────────────────────────

type DamageFn = (input: WeaponDamageInput) => WeaponDamage;

function damageMismatches(fn: DamageFn, row: WeaponDamageCase): string[] {
  const i = row.input;
  const got = fn({
    weapon: weaponOf(i.weaponId),
    mod: i.mod,
    twoHanded: i.twoHanded,
    kind: i.kind,
    damageBonus: i.damageBonus,
  });
  const out: string[] = [];
  if (got.dice !== row.expect.dice) out.push('dice');
  if (got.flat !== row.expect.flat) out.push('flat');
  if (got.breakdown.total !== got.flat) out.push('breakdown-total');
  out.push(...invariantBreakdown(got.breakdown));
  return out;
}

describe('golden: WEAPON_DAMAGE_CASES', () => {
  for (const row of WEAPON_DAMAGE_CASES) {
    it(row.name, () => {
      expect(damageMismatches(weaponDamage, row)).toEqual([]);
    });
  }

  it('explains why a modifier was left out and still lists the zero component', () => {
    const d = weaponDamage({ weapon: weaponOf('dagger'), mod: 3, ability: 'dex', kind: 'light-extra' });
    expect(d.breakdown.components).toEqual([
      { label: 'Dexterity mod', value: 0 },
      { label: 'Magic / other', value: 0 },
    ]);
    expect(d.breakdown.note).toMatch(/Light extra attack adds no ability modifier/);
    expect(weaponDamage({ weapon: weaponOf('greataxe'), mod: 4, kind: 'cleave' }).breakdown.note).toMatch(/Cleave/);
    expect(weaponDamage({ weapon: weaponOf('blowgun'), mod: 4 }).breakdown.note).toMatch(/fixed damage/i);
  });

  it('a thrown Versatile weapon does not use its two-handed dice (that needs a melee attack)', () => {
    expect(weaponDamage({ weapon: weaponOf('spear'), mod: 2, twoHanded: true, thrown: true }).dice).toBe('1d6');
    expect(weaponDamage({ weapon: weaponOf('spear'), mod: 2, twoHanded: true }).dice).toBe('1d8');
  });
});

describe('golden: DOUBLE_DICE_CASES', () => {
  const mismatches = (fn: (dice: string) => string): string[] =>
    DOUBLE_DICE_CASES.filter((row: DoubleDiceCase) => fn(row.dice) !== row.expect).map((row) => row.dice);

  for (const row of DOUBLE_DICE_CASES) {
    it(`${row.dice} -> ${row.expect}`, () => {
      expect(doubleDice(row.dice)).toBe(row.expect);
    });
  }

  it('throws on an expression that is not dice or a fixed amount', () => {
    expect(() => doubleDice('2d6+3')).toThrow();
  });

  it('fail-closed: a mutant that doubles the fixed amount, or does not double at all, is caught', () => {
    expect(mismatches((d) => (/^\d+$/.test(d) ? String(Number(d) * 2) : doubleDice(d)))).toEqual(['1']);
    expect(mismatches((d) => d).length).toBeGreaterThan(0);
  });
});

describe('critical hit damage: dice doubled, modifiers once', () => {
  it('rolls 2d8 plus the flat part once (rng face 1 and 8)', () => {
    const d = weaponDamage({ weapon: weaponOf('longsword'), mod: 3, damageBonus: 1 });
    const low = rollWeaponDamage(d, true, () => 0);
    expect(low).toMatchObject({ dice: '2d8', rolls: [1, 1], diceTotal: 2, flat: 4, total: 6 });
    const high = rollWeaponDamage(d, true, () => 0.999);
    expect(high).toMatchObject({ dice: '2d8', rolls: [8, 8], diceTotal: 16, total: 20 });
    expect(rollWeaponDamage(d, false, () => 0)).toMatchObject({ dice: '1d8', rolls: [1], total: 5 });
  });

  it('a fixed-damage weapon rolls no dice on a Critical Hit', () => {
    const d = weaponDamage({ weapon: weaponOf('blowgun'), mod: 3 });
    expect(rollWeaponDamage(d, true, () => 0.5)).toMatchObject({ dice: '1', rolls: [], total: 1 });
  });

  it('damage never goes below 0 (negative modifier on a low roll)', () => {
    expect(damageTotal(1, -3)).toBe(0);
    expect(damageTotal(5, -3)).toBe(2);
    const d = weaponDamage({ weapon: weaponOf('dagger'), mod: -4 });
    expect(rollWeaponDamage(d, false, () => 0).total).toBe(0);
  });
});

// ─── Attack resolution ───────────────────────────────────────────────────────

type ResolveFn = (row: AttackResolutionCase) => AttackResolution;

function resolutionMismatches(fn: ResolveFn, row: AttackResolutionCase): string[] {
  const got = fn(row);
  const out: string[] = [];
  if (got.used !== row.expect.used) out.push('used');
  if (got.natural !== row.expect.natural) out.push('natural');
  if (got.total !== row.expect.total) out.push('total');
  if (got.result !== row.expect.result) out.push('result');
  out.push(...invariantBreakdown(got.breakdown));
  if (got.breakdown.total !== got.total) out.push('breakdown-total');
  return out;
}

const realResolve: ResolveFn = (row) => resolveAttack(row.faces, row.mode, row.bonus, row.exhaustion, row.ac);

describe('golden: ATTACK_RESOLUTION_CASES', () => {
  for (const row of ATTACK_RESOLUTION_CASES) {
    it(row.name, () => {
      expect(resolutionMismatches(realResolve, row)).toEqual([]);
    });
  }

  it('D1: Exhaustion is its own visible component, even at level 0', () => {
    const none = resolveAttack([10], 'normal', 5, 0, 15).breakdown;
    expect(none.components.at(-1)).toEqual({ label: 'Exhaustion (none)', value: 0 });
    const tired = resolveAttack([10], 'normal', 5, 3, 15).breakdown;
    expect(tired.components.at(-1)).toEqual({ label: 'Exhaustion -6', value: -6 });
    expect(tired.total).toBe(9);
  });

  it('lists the attack-bonus Breakdown components individually', () => {
    const bonus = attackBonusBreakdown({ weapon: weaponOf('longsword'), scores: { str: 16, dex: 10 }, proficient: true, pb: 2 }).breakdown;
    const r = resolveAttack([12], 'normal', bonus, 0, 15);
    expect(r.breakdown.components.map((c) => c.label)).toEqual([
      'd20 roll',
      'Strength mod',
      'Proficiency',
      'Magic / other',
      'Exhaustion (none)',
    ]);
    expect(r.total).toBe(12 + 3 + 2);
    expect(r.result).toBe('hit');
  });

  it('records the faces under Advantage and Disadvantage in the note', () => {
    expect(resolveAttack([3, 17], 'advantage', 0, 0, 10).breakdown.note).toMatch(/rolled 3 and 17, kept 17/);
    expect(resolveAttack([3, 17], 'disadvantage', 0, 0, 10).breakdown.note).toMatch(/kept 3/);
    expect(resolveAttack([3], 'normal', 0, 0, 10).breakdown.note).toBeUndefined();
  });

  it('throws when the faces do not match the mode', () => {
    expect(() => resolveAttack([3, 17], 'normal', 0, 0, 10)).toThrow(RangeError);
    expect(() => resolveAttack([21], 'normal', 0, 0, 10)).toThrow(RangeError);
  });

  it('rollAttack uses the injected RNG (face = floor(r x 20) + 1)', () => {
    expect(rollAttack(() => 0.95, 'normal', 0, 0, 30)).toMatchObject({ natural: 20, result: 'critical-hit' });
    expect(rollAttack(() => 0, 'normal', 99, 0, 5)).toMatchObject({ natural: 1, result: 'miss' });
  });
});

// ─── Cover ───────────────────────────────────────────────────────────────────

type CoverFn = (ac: number, covers: CoverCase['covers']) => CoverResult;

function coverMismatches(fn: CoverFn, row: CoverCase): string[] {
  const got = fn(row.ac, row.covers);
  const out: string[] = [];
  if (got.targetable !== row.targetable) out.push('targetable');
  if (row.targetable && got.effectiveAc !== row.effectiveAc) out.push('effectiveAc');
  if (!row.targetable && got.effectiveAc !== undefined) out.push('effectiveAc-present');
  if (row.targetable && got.breakdown.total !== got.effectiveAc) out.push('breakdown-total');
  out.push(...invariantBreakdown(got.breakdown));
  return out;
}

describe('golden: COVER_CASES', () => {
  for (const row of COVER_CASES) {
    it(row.name, () => {
      expect(coverMismatches(coverAc, row)).toEqual([]);
    });
  }

  it('names the cover that applied and lists the zero when there is none', () => {
    expect(coverAc(15, []).breakdown.components).toEqual([
      { label: 'Armor Class', value: 15 },
      { label: 'Cover (none)', value: 0 },
    ]);
    expect(coverAc(15, ['half', 'three-quarters']).applied).toBe('three-quarters');
    expect(coverAc(15, ['half']).breakdown.components[1]).toEqual({ label: 'Half Cover', value: 2 });
    expect(coverAc(15, ['total']).breakdown.note).toMatch(/Total Cover/);
  });
});

// ─── Suggestions ─────────────────────────────────────────────────────────────

type SuggestFn = (weapon: WeaponData, row: AttackSuggestionCase['input']) => AttackSuggestions;

function suggestionMismatches(fn: SuggestFn, row: AttackSuggestionCase): string[] {
  const got = fn(weaponOf(row.input.weaponId), row.input);
  const out: string[] = [];
  if (!sameSet(got.disadvantageFrom, row.expect.disadvantageFrom)) out.push('disadvantageFrom');
  if (!sameSet(got.advantageFrom, row.expect.advantageFrom)) out.push('advantageFrom');
  if (got.mode !== row.expect.mode) out.push('mode');
  if (got.blocked !== row.expect.blocked) out.push('blocked');
  return out;
}

const realSuggest: SuggestFn = (weapon, input) => attackSuggestions(weapon, input);

describe('golden: ATTACK_SUGGESTION_CASES', () => {
  for (const row of ATTACK_SUGGESTION_CASES) {
    it(row.name, () => {
      expect(suggestionMismatches(realSuggest, row)).toEqual([]);
    });
  }

  it('extra suggested sources join the list and still cancel with the rest', () => {
    const longbow = weaponOf('longbow');
    const base = { str: 10, dex: 14, distanceFt: 100 };
    const poisoned = attackSuggestions(longbow, { ...base, extraDisadvantageFrom: ['condition:poisoned'] });
    expect(poisoned).toMatchObject({ disadvantageFrom: ['condition:poisoned'], mode: 'disadvantage' });
    const cancel = attackSuggestions(longbow, { ...base, extraDisadvantageFrom: ['condition:poisoned'], attackerUnseen: true });
    expect(cancel).toMatchObject({ mode: 'normal', advantageFrom: ['attacker-unseen'] });
  });

  it('resolveAttackMode: any mix cancels, same side never stacks', () => {
    expect(resolveAttackMode([], [])).toBe('normal');
    expect(resolveAttackMode(['a', 'b', 'c'], [])).toBe('advantage');
    expect(resolveAttackMode([], ['a', 'b'])).toBe('disadvantage');
    expect(resolveAttackMode(['a'], ['b', 'c', 'd'])).toBe('normal');
  });

  it('a user toggle of one suggestion changes the mode (suggestions are not automatic)', () => {
    const s = attackSuggestions(weaponOf('longbow'), { str: 10, dex: 14, distanceFt: 200, attackerUnseen: true });
    expect(s.mode).toBe('normal');
    expect(resolveAttackMode(s.advantageFrom, [])).toBe('advantage');
  });

  it('a distance with no range data for a melee weapon is ignored', () => {
    expect(attackSuggestions(weaponOf('longsword'), { str: 14, dex: 14, distanceFt: 500 })).toMatchObject({ blocked: false, mode: 'normal' });
  });

  it('the thrown flag on a weapon without Thrown is ignored', () => {
    expect(attackSuggestions(weaponOf('longsword'), { str: 14, dex: 14, thrown: true, hostileAdjacentSeesYou: true })).toMatchObject({ mode: 'normal' });
  });
});

function characterWithConditions(...ids: Array<Parameters<typeof addCondition>[1]>): Character {
  let c: Character = { ...createCharacter('Tester'), hpMax: 20 };
  for (const id of ids) c = addCondition(c, id);
  return c;
}

describe('attacker condition suggestions (conditions catalog mechanics.ownAttacks)', () => {
  it('none for a healthy, condition-free character', () => {
    expect(attackerConditionSuggestions(characterWithConditions())).toEqual([]);
  });

  it('Poisoned, Prone, Blinded and Restrained suggest Disadvantage', () => {
    for (const id of ['poisoned', 'prone', 'blinded', 'restrained'] as const) {
      expect(attackerConditionSuggestions(characterWithConditions(id))).toEqual([
        { source: `condition:${id}`, conditionId: id, side: 'disadvantage' },
      ]);
    }
  });

  it('Invisible suggests Advantage with the unseen caveat', () => {
    const [s] = attackerConditionSuggestions(characterWithConditions('invisible'));
    expect(s).toMatchObject({ source: 'condition:invisible', side: 'advantage' });
    expect(s.situational).toMatch(/can somehow see you/);
  });

  it('Frightened and Grappled are situational Disadvantage', () => {
    const f = attackerConditionSuggestions(characterWithConditions('frightened'));
    expect(f[0]).toMatchObject({ side: 'disadvantage' });
    expect(f[0].situational).toMatch(/line of sight/);
    const g = attackerConditionSuggestions(characterWithConditions('grappled'));
    expect(g[0].situational).toMatch(/other than the grappler/);
  });

  it('Exhaustion adds no suggestion (its penalty is the visible roll component)', () => {
    expect(attackerConditionSuggestions(setExhaustion(characterWithConditions(), 3))).toEqual([]);
  });

  it('feeds attackSuggestions as optional extra sources', () => {
    const c = characterWithConditions('poisoned', 'invisible');
    const extras = attackerConditionSuggestions(c);
    const s = attackSuggestions(weaponOf('longsword'), {
      str: 14,
      dex: 14,
      extraAdvantageFrom: extras.filter((e) => e.side === 'advantage').map((e) => e.source),
      extraDisadvantageFrom: extras.filter((e) => e.side === 'disadvantage').map((e) => e.source),
    });
    expect(s.advantageFrom).toEqual(['condition:invisible']);
    expect(s.disadvantageFrom).toEqual(['condition:poisoned']);
    expect(s.mode).toBe('normal');
  });

  it('does not mutate the character', () => {
    const c = Object.freeze(characterWithConditions('poisoned'));
    expect(() => attackerConditionSuggestions(c)).not.toThrow();
  });
});

// ─── Unarmed Strike ──────────────────────────────────────────────────────────

describe('golden: UNARMED_CASES', () => {
  const mismatches = (row: UnarmedCase, fn: typeof unarmedStrike): string[] => {
    const got = fn({ str: row.str }, row.pb);
    const out: string[] = [];
    if (got.attack.total !== row.expectAttack) out.push('attack');
    if (got.damage.total !== row.expectDamage) out.push('damage');
    if (got.grappleDc.total !== row.expectGrappleDc) out.push('grappleDc');
    for (const b of [got.attack, got.damage, got.grappleDc, got.shoveDc]) out.push(...invariantBreakdown(b));
    return out;
  };

  for (const row of UNARMED_CASES) {
    it(`Str ${row.str}, PB ${row.pb}`, () => {
      expect(mismatches(row, unarmedStrike)).toEqual([]);
    });
  }

  it('lists the 0-floor component and the shove DC equals the grapple DC', () => {
    const u = unarmedStrike({ str: 6 }, 2);
    expect(u.damage.components.map((c) => c.value)).toEqual([1, -2, 1]);
    expect(u.shoveDc.total).toBe(u.grappleDc.total);
    expect(u.attack.components.map((c) => c.label)).toEqual(['Strength mod', 'Proficiency']);
  });

  it('fail-closed: a mutant without the 0 floor is caught by the Str 6 row', () => {
    const noFloor: typeof unarmedStrike = (scores, pb) => {
      const real = unarmedStrike(scores, pb);
      const raw = 1 + Math.floor((scores.str - 10) / 2);
      return { ...real, damage: { total: raw, components: [{ label: 'x', value: raw }] } };
    };
    expect(UNARMED_CASES.some((row) => mismatches(row, noFloor).includes('damage'))).toBe(true);
  });
});

// ─── Ammunition ──────────────────────────────────────────────────────────────

function ammoCharacter(weaponId: string, ammoCatalogId: string, quantity: number): Character {
  return {
    ...createCharacter('Archer'),
    inventory: [
      { id: 'w1', kind: 'weapon', catalogId: weaponId, quantity: 1 },
      { id: 'a1', kind: 'equipment', catalogId: ammoCatalogId, quantity },
    ],
  };
}

describe('golden: AMMO_RECOVER_CASES', () => {
  for (const row of AMMO_RECOVER_CASES) {
    it(`used ${row.used} -> recovers ${row.expectRecovered}`, () => {
      expect(recoverAmmo(row.used)).toBe(row.expectRecovered);
    });
  }

  it('fail-closed: rounding up would be caught', () => {
    expect(AMMO_RECOVER_CASES.filter((row) => Math.ceil(row.used / 2) !== row.expectRecovered).length).toBeGreaterThan(0);
  });

  it('a negative count recovers nothing', () => {
    expect(recoverAmmo(-4)).toBe(0);
  });
});

describe('golden: AMMO_FIRE_CASES', () => {
  const run = (row: AmmoFireCase) => {
    const c = ammoCharacter('longbow', 'arrows', row.quantity);
    return { c, result: fireAmmo(c, weaponOf('longbow')) };
  };

  for (const row of AMMO_FIRE_CASES) {
    it(`quantity ${row.quantity}`, () => {
      const { result } = run(row);
      expect(result.blocked).toBe(row.blocked);
      const stack = result.character.inventory?.find((i) => i.id === 'a1');
      expect(stack?.quantity).toBe(row.expectQuantity);
      expect(result.consumed).toBe(!row.blocked);
    });
  }

  it('does not mutate the input character or its items', () => {
    const c = ammoCharacter('longbow', 'arrows', 5);
    const frozen = Object.freeze({ ...c, inventory: Object.freeze(c.inventory?.map((i) => Object.freeze({ ...i }))) as InventoryItem[] });
    const result = fireAmmo(frozen, weaponOf('longbow'));
    expect(result.character).not.toBe(frozen);
    expect(frozen.inventory?.[1].quantity).toBe(5);
    expect(result.character.inventory?.[1].quantity).toBe(4);
    expect(result.ammoItemId).toBe('a1');
    expect(result.remaining).toBe(4);
  });

  it('a blocked shot returns the very same character', () => {
    const c = ammoCharacter('longbow', 'arrows', 0);
    expect(fireAmmo(c, weaponOf('longbow')).character).toBe(c);
  });
});

describe('ammunition matching by ammunitionType', () => {
  it('maps each type to its ammunition item', () => {
    expect(ammunitionEquipmentIds(weaponOf('longbow'))).toEqual(['arrows']);
    expect(ammunitionEquipmentIds(weaponOf('heavy-crossbow'))).toEqual(['bolts']);
    expect(ammunitionEquipmentIds(weaponOf('blowgun'))).toEqual(['needles']);
    expect(ammunitionEquipmentIds(weaponOf('sling'))).toEqual(['bullets-sling']);
    expect(ammunitionEquipmentIds(weaponOf('pistol'))).toEqual(['bullets-firearm']);
    expect(ammunitionEquipmentIds(weaponOf('musket'))).toEqual(['bullets-firearm']);
    expect(ammunitionEquipmentIds(weaponOf('longsword'))).toEqual([]);
  });

  it('a bow does not fire Bolts, and a crossbow does not fire Arrows', () => {
    expect(fireAmmo(ammoCharacter('longbow', 'bolts', 20), weaponOf('longbow'))).toMatchObject({ blocked: true });
    expect(fireAmmo(ammoCharacter('light-crossbow', 'arrows', 20), weaponOf('light-crossbow'))).toMatchObject({ blocked: true });
    expect(fireAmmo(ammoCharacter('hand-crossbow', 'bolts', 3), weaponOf('hand-crossbow'))).toMatchObject({ blocked: false, remaining: 2 });
  });

  it('Sling and firearm Bullets are different items', () => {
    expect(fireAmmo(ammoCharacter('sling', 'bullets-firearm', 10), weaponOf('sling')).blocked).toBe(true);
    expect(fireAmmo(ammoCharacter('sling', 'bullets-sling', 10), weaponOf('sling')).blocked).toBe(false);
    expect(fireAmmo(ammoCharacter('pistol', 'bullets-sling', 10), weaponOf('pistol')).blocked).toBe(true);
    expect(fireAmmo(ammoCharacter('pistol', 'bullets-firearm', 10), weaponOf('pistol')).blocked).toBe(false);
  });

  it('uses the first stack that still has pieces', () => {
    const c: Character = {
      ...createCharacter('Archer'),
      inventory: [
        { id: 'a0', kind: 'equipment', catalogId: 'arrows', quantity: 0 },
        { id: 'a2', kind: 'equipment', catalogId: 'arrows', quantity: 7 },
      ],
    };
    expect(matchingAmmunition(c, weaponOf('longbow')).map((i) => i.id)).toEqual(['a0', 'a2']);
    const r = fireAmmo(c, weaponOf('longbow'));
    expect(r.ammoItemId).toBe('a2');
    expect(r.character.inventory?.map((i) => i.quantity)).toEqual([0, 6]);
  });

  it('a weapon without Ammunition is never blocked and the character is unchanged', () => {
    const c = createCharacter('Fighter');
    const r = fireAmmo(c, weaponOf('longsword'));
    expect(r).toEqual({ character: c, blocked: false, consumed: false });
    expect(r.character).toBe(c);
  });

  it('ignores a weapon item that merely shares a name with ammunition', () => {
    const c: Character = { ...createCharacter('A'), inventory: [{ id: 'x', kind: 'weapon', catalogId: 'arrows', quantity: 20 }] };
    expect(matchingAmmunition(c, weaponOf('longbow'))).toEqual([]);
  });
});

// ─── Light extra attack ──────────────────────────────────────────────────────

describe('golden: LIGHT_EXTRA_CASES', () => {
  const run = (row: LightExtraCase, fn: typeof lightExtraAvailable): boolean =>
    fn(
      { itemId: row.mainItemId, weapon: weaponOf(row.mainWeaponId) },
      { itemId: row.offItemId, weapon: weaponOf(row.offWeaponId) },
      row.attackActionTaken,
    );

  for (const row of LIGHT_EXTRA_CASES) {
    it(row.name, () => {
      expect(run(row, lightExtraAvailable)).toBe(row.expect);
      const status = lightExtraStatus(
        { itemId: row.mainItemId, weapon: weaponOf(row.mainWeaponId) },
        { itemId: row.offItemId, weapon: weaponOf(row.offWeaponId) },
        row.attackActionTaken,
      );
      expect(status.available).toBe(row.expect);
      expect(status.reason === undefined).toBe(row.expect);
    });
  }

  it('fail-closed: a mutant that ignores the "different item" rule or the Attack action is caught', () => {
    const ignoresItem: typeof lightExtraAvailable = (main, off, taken) =>
      lightExtraAvailable({ ...main, itemId: 'a' }, { ...off, itemId: 'b' }, taken);
    expect(LIGHT_EXTRA_CASES.some((row) => run(row, ignoresItem) !== row.expect)).toBe(true);
    const ignoresAction: typeof lightExtraAvailable = (main, off) => lightExtraAvailable(main, off, true);
    expect(LIGHT_EXTRA_CASES.some((row) => run(row, ignoresAction) !== row.expect)).toBe(true);
  });
});

// ─── Equipped weapons and the combined profile ───────────────────────────────

describe('equipped weapons only', () => {
  const sword: InventoryItem = { id: 's', kind: 'weapon', catalogId: 'longsword', quantity: 1 };
  const dagger: InventoryItem = { id: 'd', kind: 'weapon', catalogId: 'dagger', quantity: 1 };
  const homebrew: InventoryItem = { id: 'h', kind: 'weapon', name: 'Homebrew', quantity: 1 };
  const shield: InventoryItem = { id: 'sh', kind: 'armor', catalogId: 'shield', quantity: 1 };
  const base: Character = { ...createCharacter('T'), inventory: [sword, dagger, homebrew, shield] };

  it('returns nothing when nothing is equipped', () => {
    expect(equippedWeapons(base)).toEqual([]);
  });

  it('returns only equipped catalog weapons, in equipped order', () => {
    const c: Character = { ...base, equipped: { weaponItemIds: ['d', 's'] } };
    expect(equippedWeapons(c).map((e) => e.item.id)).toEqual(['d', 's']);
    expect(equippedWeapons(c)[0].weapon.id).toBe('dagger');
  });

  it('skips unknown ids, non-weapons and custom weapons', () => {
    const c: Character = { ...base, equipped: { weaponItemIds: ['ghost', 'sh', 'h', 's'] } };
    expect(equippedWeapons(c).map((e) => e.item.id)).toEqual(['s']);
  });
});

describe('weaponAttackProfile', () => {
  const sword: InventoryItem = { id: 's', kind: 'weapon', catalogId: 'longsword', quantity: 1, attackBonus: 1, damageBonus: 1 };
  const fighter = (over: Partial<Character> = {}): Character => ({
    ...createCharacter('F'),
    level: 5,
    classes: [{ id: 'fighter' as ClassId, level: 5 }],
    abilities: { str: 16, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
    ...over,
  });

  it('puts PB, ability, magic bonus and damage together, every total a Breakdown', () => {
    const p = weaponAttackProfile(fighter(), sword);
    expect(p?.proficiency.proficient).toBe(true);
    expect(p?.attack.breakdown.total).toBe(3 + 3 + 1);
    expect(p?.damage).toMatchObject({ dice: '1d8', flat: 4 });
    expect(p?.criticalDice).toBe('2d8');
    expect(p?.attack.breakdown.components.map((c) => c.value)).toEqual([3, 3, 1]);
  });

  it('uses the two-handed Versatile dice and the Light extra rule when asked', () => {
    expect(weaponAttackProfile(fighter(), sword, { twoHanded: true })?.damage.dice).toBe('1d10');
    const dagger: InventoryItem = { id: 'd', kind: 'weapon', catalogId: 'dagger', quantity: 1 };
    const extra = weaponAttackProfile(fighter(), dagger, { kind: 'light-extra' });
    expect(extra?.damage.flat).toBe(0);
  });

  it('is not proficient with no class, and carries the Exhaustion level for the roll', () => {
    const noClass: Character = { ...fighter(), classes: undefined, exhaustionLevel: 2 };
    const p = weaponAttackProfile(noClass, sword);
    expect(p?.proficiency).toMatchObject({ proficient: false, source: 'no-class' });
    expect(p?.attack.breakdown.total).toBe(3 + 0 + 1);
    expect(p?.exhaustion).toBe(2);
  });

  it('returns undefined for a custom weapon', () => {
    expect(weaponAttackProfile(fighter(), { id: 'h', kind: 'weapon', name: 'x', quantity: 1 })).toBeUndefined();
  });

  it('does not mutate the character or the item', () => {
    const c = Object.freeze(fighter());
    expect(() => weaponAttackProfile(c, Object.freeze({ ...sword }))).not.toThrow();
  });
});

// ─── Fail-closed: permanent mutation-style tests ─────────────────────────────

describe('fail-closed: mutants are caught by the golden rows', () => {
  it('Light extra attack that adds a POSITIVE modifier fails the Light rows', () => {
    const mutant: DamageFn = (input) => {
      if (input.kind !== 'light-extra') return weaponDamage(input);
      return weaponDamage({ ...input, kind: 'normal' });
    };
    const failed = WEAPON_DAMAGE_CASES.filter((row) => damageMismatches(mutant, row).length > 0).map((row) => row.name);
    expect(failed).toContain('Light extra attack adds NO ability modifier when it is positive');
  });

  it('Cleave that adds the positive modifier fails the Cleave row', () => {
    const mutant: DamageFn = (input) => weaponDamage(input.kind === 'cleave' ? { ...input, kind: 'normal' } : input);
    const failed = WEAPON_DAMAGE_CASES.filter((row) => damageMismatches(mutant, row).length > 0).map((row) => row.name);
    expect(failed).toContain('Cleave second attack adds NO positive modifier');
  });

  it('a Light extra attack that drops a NEGATIVE modifier fails the negative row', () => {
    const mutant: DamageFn = (input) => {
      const real = weaponDamage(input);
      return input.kind === 'light-extra' && input.mod < 0 ? { ...real, flat: 0, breakdown: { total: 0, components: [] } } : real;
    };
    const failed = WEAPON_DAMAGE_CASES.filter((row) => damageMismatches(mutant, row).length > 0).map((row) => row.name);
    expect(failed).toContain('Light extra attack DOES add a negative modifier');
  });

  it('a fixed-damage weapon that adds the modifier fails the Blowgun row', () => {
    const mutant: DamageFn = (input) => {
      const real = weaponDamage(input);
      return input.weapon.id === 'blowgun' ? { ...real, flat: input.mod, breakdown: { total: input.mod, components: [{ label: 'm', value: input.mod }] } } : real;
    };
    expect(WEAPON_DAMAGE_CASES.filter((row) => damageMismatches(mutant, row).length > 0).map((r) => r.input.weaponId)).toContain('blowgun');
  });

  it('a magic bonus dropped from the Light extra attack fails the interpretation row', () => {
    const mutant: DamageFn = (input) => weaponDamage(input.kind === 'light-extra' ? { ...input, damageBonus: 0 } : input);
    const failed = WEAPON_DAMAGE_CASES.filter((row) => damageMismatches(mutant, row).length > 0).map((row) => row.name);
    expect(failed.some((name) => name.startsWith('A magic damage bonus still applies'))).toBe(true);
  });

  it('natural 20 judged by the TOTAL (Exhaustion makes it miss) fails the Exhaustion rows', () => {
    const mutant: ResolveFn = (row) => {
      const real = realResolve(row);
      const result = real.total >= row.ac && real.natural !== 1 ? (real.natural === 20 ? 'critical-hit' : 'hit') : 'miss';
      return { ...real, result };
    };
    const failed = ATTACK_RESOLUTION_CASES.filter((row) => resolutionMismatches(mutant, row).length > 0).map((row) => row.name);
    expect(failed).toContain('Natural 20 always hits and is a Critical Hit, even far below the AC');
    expect(failed).toContain('Natural 20 stays a Critical Hit under Exhaustion (judged on the raw die)');
  });

  it('natural 1 judged by the total fails the natural 1 rows', () => {
    const mutant: ResolveFn = (row) => {
      const real = realResolve(row);
      return { ...real, result: real.natural === 20 ? 'critical-hit' : real.total >= row.ac ? 'hit' : 'miss' };
    };
    const failed = ATTACK_RESOLUTION_CASES.filter((row) => resolutionMismatches(mutant, row).length > 0).map((row) => row.name);
    expect(failed).toContain('Natural 1 always misses, even with a huge bonus');
  });

  it('Exhaustion ignored fails the Exhaustion rows', () => {
    const mutant: ResolveFn = (row) => resolveAttack(row.faces, row.mode, row.bonus, 0, row.ac);
    const failed = ATTACK_RESOLUTION_CASES.filter((row) => resolutionMismatches(mutant, row).length > 0);
    expect(failed.length).toBeGreaterThan(0);
  });

  it('a hit needing the total to EXCEED the AC fails the equal-to-AC row', () => {
    const mutant: ResolveFn = (row) => {
      const real = realResolve(row);
      const result = real.natural === 20 ? 'critical-hit' : real.natural === 1 ? 'miss' : real.total > row.ac ? 'hit' : 'miss';
      return { ...real, result };
    };
    const failed = ATTACK_RESOLUTION_CASES.filter((row) => resolutionMismatches(mutant, row).length > 0).map((row) => row.name);
    expect(failed).toContain('Total EQUAL to the AC hits');
  });

  it('Advantage/Disadvantage faces swapped fails the Advantage and Disadvantage rows', () => {
    const mutant: ResolveFn = (row) =>
      resolveAttack(row.faces, row.mode === 'advantage' ? 'disadvantage' : row.mode === 'disadvantage' ? 'advantage' : 'normal', row.bonus, row.exhaustion, row.ac);
    expect(ATTACK_RESOLUTION_CASES.filter((row) => resolutionMismatches(mutant, row).length > 0).length).toBeGreaterThanOrEqual(2);
  });

  it('STACKED cover bonuses (+7) fail the Half + Three-Quarters row', () => {
    const mutant: CoverFn = (ac, covers) => {
      const bonus = covers.reduce((total, c) => total + (c === 'half' ? 2 : c === 'three-quarters' ? 5 : 0), 0);
      const total = covers.includes('total');
      return {
        targetable: !total,
        applied: null,
        effectiveAc: total ? undefined : ac + bonus,
        breakdown: { total: ac + bonus, components: [{ label: 'x', value: ac + bonus }] },
      };
    };
    const failed = COVER_CASES.filter((row) => coverMismatches(mutant, row).length > 0).map((row) => row.name);
    expect(failed).toContain('Only the most protective degree applies (Half + Three-Quarters = +5, not +7)');
  });

  it('Total Cover treated as targetable fails the Total Cover rows', () => {
    const mutant: CoverFn = (ac, covers) => coverAc(ac, covers.filter((c) => c !== 'total'));
    expect(COVER_CASES.filter((row) => coverMismatches(mutant, row).length > 0).length).toBe(2);
  });

  it('Finesse always Dex, or a tie going to Dex, fails the Finesse rows', () => {
    const alwaysDex: BonusFn = (input) => attackBonusBreakdown({ ...input, abilityChoice: input.weapon.properties.includes('finesse') ? 'dex' : undefined });
    const failed = ATTACK_BONUS_CASES.filter((row) => bonusMismatches(alwaysDex, row).length > 0).map((row) => row.name);
    expect(failed).toContain('Finesse picks Strength when it is higher (Rapier, Str 18 > Dex 14)');
    const tieDex: BonusFn = (input) =>
      attackBonusBreakdown({
        ...input,
        abilityChoice: input.weapon.properties.includes('finesse') && input.scores.str === input.scores.dex ? 'dex' : input.abilityChoice,
      });
    expect(ATTACK_BONUS_CASES.filter((row) => bonusMismatches(tieDex, row).length > 0).map((r) => r.name)).toContain('Finesse tie defaults to Strength');
  });

  it('a thrown melee weapon switched to Dex, or a ranged weapon using Str, fails the rows', () => {
    const thrownDex: BonusFn = (input) =>
      input.weapon.id === 'handaxe' ? attackBonusBreakdown({ ...input, weapon: { ...input.weapon, range: 'ranged' } }) : attackBonusBreakdown(input);
    expect(ATTACK_BONUS_CASES.filter((row) => bonusMismatches(thrownDex, row).length > 0).map((r) => r.input.weaponId)).toContain('handaxe');
    const rangedStr: BonusFn = (input) => attackBonusBreakdown({ ...input, weapon: { ...input.weapon, range: 'melee' } });
    expect(ATTACK_BONUS_CASES.filter((row) => bonusMismatches(rangedStr, row).length > 0).length).toBeGreaterThan(0);
  });

  it('proficiency always added fails the not-proficient row', () => {
    const mutant: BonusFn = (input) => attackBonusBreakdown({ ...input, proficient: true });
    expect(ATTACK_BONUS_CASES.filter((row) => bonusMismatches(mutant, row).length > 0).map((r) => r.name)).toContain('Not proficient: no Proficiency Bonus');
  });

  it('Heavy checking the wrong ability, or the modifier instead of the score, fails the Heavy rows', () => {
    const wrongAbility: SuggestFn = (weapon, input) => attackSuggestions(weapon, { ...input, str: input.dex, dex: input.str });
    const failed = ATTACK_SUGGESTION_CASES.filter((row) => suggestionMismatches(wrongAbility, row).length > 0).map((r) => r.name);
    expect(failed).toContain('Heavy melee weapon checks Strength, not Dexterity (Str 8, Dex 18)');
    const modifierNot13: SuggestFn = (weapon, input) => {
      const real = attackSuggestions(weapon, input);
      if (!weapon.properties.includes('heavy')) return real;
      const score = weapon.range === 'melee' ? input.str : input.dex;
      const others = real.disadvantageFrom.filter((s) => s !== 'heavy-weapon');
      const disadvantageFrom = Math.floor((score - 10) / 2) < 1 ? [...others, 'heavy-weapon'] : others;
      return { ...real, disadvantageFrom, mode: disadvantageFrom.length > 0 ? 'disadvantage' : 'normal' };
    };
    expect(ATTACK_SUGGESTION_CASES.filter((row) => suggestionMismatches(modifierNot13, row).length > 0).map((r) => r.name)).toContain('Heavy melee weapon with Str 12: Disadvantage');
  });

  it('range off-by-one (long range exclusive) and advantage/disadvantage stacking are caught', () => {
    const exclusive: SuggestFn = (weapon, input) =>
      input.distanceFt === 600 ? { disadvantageFrom: [], advantageFrom: [], mode: 'normal', blocked: true } : attackSuggestions(weapon, input);
    expect(ATTACK_SUGGESTION_CASES.filter((row) => suggestionMismatches(exclusive, row).length > 0).map((r) => r.name)).toContain('Exactly at long range (600) is still allowed');
    const noCancel: SuggestFn = (weapon, input) => {
      const real = attackSuggestions(weapon, input);
      return real.disadvantageFrom.length > 0 ? { ...real, mode: 'disadvantage' } : real;
    };
    expect(ATTACK_SUGGESTION_CASES.filter((row) => suggestionMismatches(noCancel, row).length > 0).map((r) => r.name)).toContain('Unseen on both sides: Advantage and Disadvantage cancel');
  });

  it('a melee use of a thrown weapon treated as ranged fails the adjacent-enemy row', () => {
    const mutant: SuggestFn = (weapon, input) => attackSuggestions(weapon, { ...input, thrown: weapon.properties.includes('thrown') ? true : input.thrown });
    expect(ATTACK_SUGGESTION_CASES.filter((row) => suggestionMismatches(mutant, row).length > 0).map((r) => r.name)).toContain('The same Handaxe used in MELEE with an adjacent enemy: no penalty');
  });
});

describe('fail-closed: perturbing a golden input changes the result', () => {
  it('+1 Exhaustion lowers the total by 2', () => {
    const a = resolveAttack([10], 'normal', 5, 1, 15);
    const b = resolveAttack([10], 'normal', 5, 2, 15);
    expect(a.total - b.total).toBe(2);
  });

  it('changing the cover degree changes the effective AC', () => {
    expect(coverAc(15, ['half']).effectiveAc).not.toBe(coverAc(15, ['three-quarters']).effectiveAc);
  });

  it('the same weapon, normal vs Light extra attack, differs when the modifier is positive and not when negative', () => {
    const dagger = weaponOf('dagger');
    expect(weaponDamage({ weapon: dagger, mod: 3 }).flat).not.toBe(weaponDamage({ weapon: dagger, mod: 3, kind: 'light-extra' }).flat);
    expect(weaponDamage({ weapon: dagger, mod: -2 }).flat).toBe(weaponDamage({ weapon: dagger, mod: -2, kind: 'light-extra' }).flat);
  });

  it('adding a hostile within 5 feet, or Str 12, flips the suggestion', () => {
    const base = { str: 14, dex: 14, distanceFt: 50 };
    expect(attackSuggestions(weaponOf('longbow'), base).mode).toBe('normal');
    expect(attackSuggestions(weaponOf('longbow'), { ...base, hostileAdjacentSeesYou: true }).mode).toBe('disadvantage');
    expect(attackSuggestions(weaponOf('greataxe'), { str: 13, dex: 10 }).mode).toBe('normal');
    expect(attackSuggestions(weaponOf('greataxe'), { str: 12, dex: 10 }).mode).toBe('disadvantage');
  });
});
