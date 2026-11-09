import { describe, it, expect } from 'vitest';
import {
  sanitizeCompanions,
  sanitizeCompanionsState,
  sanitizeCustomStatBlock,
  sanitizeHirelings,
  sanitizeLoyaltyMaxOverride,
  sanitizeMounts,
  sanitizeNpcPartyMembers,
  sanitizeSidekicks,
} from '../companions-sanitize';
import { COMPANION_CAPS } from '../companions';

const companion = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  creatureId: 'wolf',
  origin: 'pet',
  ...over,
});

describe('sanitizeCompanions', () => {
  it('keeps a valid record and trims text', () => {
    const out = sanitizeCompanions([companion({ nickname: '  Fang  ', hp: 7, tempHp: 3, notes: 'good boy' })]);
    expect(out).toEqual([{ id: 'c1', creatureId: 'wolf', origin: 'pet', nickname: 'Fang', hp: 7, tempHp: 3, notes: 'good boy' }]);
  });

  it('removes the field when the value is not an array or nothing survives', () => {
    expect(sanitizeCompanions('nope')).toBeUndefined();
    expect(sanitizeCompanions({})).toBeUndefined();
    expect(sanitizeCompanions([])).toBeUndefined();
    expect(sanitizeCompanions([null, 5, 'x', []])).toBeUndefined();
  });

  it('drops a record with an unknown creature id', () => {
    expect(sanitizeCompanions([companion({ creatureId: 'not-a-creature' })])).toBeUndefined();
    expect(sanitizeCompanions([companion({ creatureId: '__proto__' })])).toBeUndefined();
    expect(sanitizeCompanions([companion({ creatureId: 'constructor' })])).toBeUndefined();
  });

  it('drops records with a bad origin, a missing id or a duplicate id', () => {
    const out = sanitizeCompanions([
      companion({ origin: 'summoned' }),
      companion({ id: '' }),
      companion({ id: undefined }),
      companion({ id: 'dup' }),
      companion({ id: 'dup', nickname: 'second' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out?.[0].id).toBe('dup');
    expect(out?.[0].nickname).toBeUndefined();
  });

  it('drops negative, fractional, huge and non-numeric numbers (the field, not the record)', () => {
    const out = sanitizeCompanions([
      companion({ hp: -4, tempHp: 1.5, exhaustionLevel: 9, hpMaxOverride: 10 ** 9, spellSlotLevel: 1 }),
    ]);
    expect(out).toEqual([{ id: 'c1', creatureId: 'wolf', origin: 'pet' }]);
    const out2 = sanitizeCompanions([companion({ hp: '7', tempHp: Number.NaN, spellSlotLevel: 10 })]);
    expect(out2).toEqual([{ id: 'c1', creatureId: 'wolf', origin: 'pet' }]);
  });

  it('keeps boundary numbers: hp 0, spell slot 2 and 9, exhaustion 6', () => {
    const out = sanitizeCompanions([companion({ hp: 0, spellSlotLevel: 2, exhaustionLevel: 6 })]);
    expect(out?.[0]).toMatchObject({ hp: 0, spellSlotLevel: 2, exhaustionLevel: 6 });
    expect(sanitizeCompanions([companion({ spellSlotLevel: 9 })])?.[0].spellSlotLevel).toBe(9);
  });

  it('drops an invalid steed or familiar type but keeps the record', () => {
    const out = sanitizeCompanions([companion({ steedType: 'Dragon', familiarType: 'Fey' })]);
    expect(out?.[0].steedType).toBeUndefined();
    expect(out?.[0].familiarType).toBe('Fey');
  });

  it('keeps only known tracked condition ids, deduplicated, no durations, no Exhaustion', () => {
    const out = sanitizeCompanions([
      companion({
        conditions: [
          { id: 'poisoned', duration: { kind: 'rounds', rounds: 3 } },
          { id: 'poisoned' },
          { id: 'exhaustion' },
          { id: 'made-up' },
          'prone',
          { id: 'prone', note: 'knocked down' },
        ],
      }),
    ]);
    expect(out?.[0].conditions).toEqual([{ id: 'poisoned' }, { id: 'prone', note: 'knocked down' }]);
  });

  it('caps the list at 20 and rejects the 21st', () => {
    const many = Array.from({ length: COMPANION_CAPS.companions + 1 }, (_, i) => companion({ id: `c${i}` }));
    const out = sanitizeCompanions(many);
    expect(out).toHaveLength(COMPANION_CAPS.companions);
    expect(out?.some((r) => r.id === `c${COMPANION_CAPS.companions}`)).toBe(false);
  });

  it('strips control characters and caps string length', () => {
    const out = sanitizeCompanions([companion({ nickname: 'A\u0000B\u0007C', notes: 'x'.repeat(5000) })]);
    expect(out?.[0].nickname).toBe('ABC');
    expect(out?.[0].notes).toHaveLength(2000);
  });

  it('never copies unknown or prototype keys', () => {
    const raw = JSON.parse('{"id":"c1","creatureId":"wolf","origin":"pet","__proto__":{"x":1},"extra":true}');
    const out = sanitizeCompanions([raw]);
    expect(out?.[0]).toEqual({ id: 'c1', creatureId: 'wolf', origin: 'pet' });
  });
});

describe('sanitizeMounts', () => {
  it('keeps a valid mount and drops bad barding, saddle and weights', () => {
    const out = sanitizeMounts([
      {
        id: 'm1',
        creatureId: 'mule',
        carriedLb: 120,
        saddle: 'military',
        bardingArmorId: 'padded-armor',
        bardingCustom: { costGp: 5, weightLb: 8 },
        pullsVehicle: true,
        vehicleWeightLb: 300,
      },
      { id: 'm2', creatureId: 'mule', carriedLb: -1, saddle: 'golden', bardingArmorId: 'unobtainium', bardingCustom: { costGp: -1, weightLb: 1 }, vehicleWeightLb: 'heavy' },
    ]);
    expect(out?.[0]).toEqual({
      id: 'm1',
      creatureId: 'mule',
      carriedLb: 120,
      saddle: 'military',
      bardingArmorId: 'padded-armor',
      bardingCustom: { costGp: 5, weightLb: 8 },
      pullsVehicle: true,
      vehicleWeightLb: 300,
    });
    expect(out?.[1]).toEqual({ id: 'm2', creatureId: 'mule' });
  });

  it('drops an unknown creature and caps at 20', () => {
    expect(sanitizeMounts([{ id: 'm', creatureId: 'unicorn' }])).toBeUndefined();
    const many = Array.from({ length: COMPANION_CAPS.mounts + 1 }, (_, i) => ({ id: `m${i}`, creatureId: 'pony' }));
    expect(sanitizeMounts(many)).toHaveLength(COMPANION_CAPS.mounts);
  });
});

describe('sanitizeHirelings and sanitizeNpcPartyMembers', () => {
  it('keeps a valid hireling and clamps nothing silently: bad numbers are dropped', () => {
    const out = sanitizeHirelings([
      { id: 'h1', name: ' Mara ', kind: 'skilled', units: 5, customRateCp: 300, loyalty: 8 },
      { id: 'h2', name: 'Bad', kind: 'skilled', units: -3, customRateCp: -1, loyalty: 21 },
      { id: 'h3', name: 'Huge', kind: 'messenger', units: 100000 },
      { id: 'h4', name: 'Wrong kind', kind: 'wizard', units: 1 },
    ]);
    expect(out).toEqual([
      { id: 'h1', name: 'Mara', kind: 'skilled', units: 5, customRateCp: 300, loyalty: 8 },
      { id: 'h2', name: 'Bad', kind: 'skilled', units: 0 },
      { id: 'h3', name: 'Huge', kind: 'messenger', units: 0 },
    ]);
  });

  it('caps hirelings at 30 and NPC party members at 10', () => {
    const hirelings = Array.from({ length: COMPANION_CAPS.hirelings + 1 }, (_, i) => ({ id: `h${i}`, name: 'H', kind: 'untrained', units: 1 }));
    expect(sanitizeHirelings(hirelings)).toHaveLength(30);
    const npcs = Array.from({ length: COMPANION_CAPS.npcPartyMembers + 1 }, (_, i) => ({ id: `n${i}`, name: 'N' }));
    expect(sanitizeNpcPartyMembers(npcs)).toHaveLength(10);
  });

  it('keeps an NPC with a stat block and drops a non-string name', () => {
    const out = sanitizeNpcPartyMembers([
      { id: 'n1', name: 'Scout', role: 'Guide', stats: { ac: 13, abilities: { str: 11, dex: 14 }, cr: '1/2' } },
      { id: 'n2', name: 42 },
    ]);
    expect(out).toEqual([{ id: 'n1', name: 'Scout', role: 'Guide', stats: { ac: 13, abilities: { str: 11, dex: 14 }, cr: '1/2' } }]);
  });
});

describe('sanitizeCustomStatBlock', () => {
  it('bounds ability scores, AC, proficiency bonus and list lengths', () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({ name: `T${i}`, description: 'd' }));
    const out = sanitizeCustomStatBlock({
      ac: 100,
      initiativeMod: 3,
      hpMax: -2,
      abilities: { str: 0, dex: 31, con: 14, wis: 'ten', bogus: 5 },
      saveProficiencies: ['dex', 'dex', 'nope'],
      proficiencyBonus: 10,
      size: 'Colossal',
      traits: entries,
      actions: [{ name: '', description: 'unnamed' }, { name: 'Bite', description: 'x'.repeat(5000) }, 'bad'],
    });
    expect(out?.ac).toBeUndefined();
    expect(out?.initiativeMod).toBe(3);
    expect(out?.hpMax).toBeUndefined();
    expect(out?.abilities).toEqual({ con: 14 });
    expect(out?.saveProficiencies).toEqual(['dex']);
    expect(out?.proficiencyBonus).toBeUndefined();
    expect(out?.size).toBeUndefined();
    expect(out?.traits).toHaveLength(20);
    expect(out?.actions).toHaveLength(1);
    expect(out?.actions?.[0].description).toHaveLength(2000);
  });

  it('returns undefined for a non-object or an empty block', () => {
    expect(sanitizeCustomStatBlock(null)).toBeUndefined();
    expect(sanitizeCustomStatBlock([])).toBeUndefined();
    expect(sanitizeCustomStatBlock({})).toBeUndefined();
  });
});

describe('sanitizeSidekicks', () => {
  const sidekick = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    creatureId: 'wolf',
    classId: 'warrior',
    level: 3,
    baseHpMax: 11,
    levelUps: [{ level: 2, roll: 4, hpGained: 6 }],
    ...over,
  });

  it('keeps a valid sidekick', () => {
    expect(sanitizeSidekicks([sidekick({ martialRole: 'Attacker', deathSaves: { successes: 1, failures: 2 }, stable: true })])).toEqual([
      sidekick({ martialRole: 'Attacker', deathSaves: { successes: 1, failures: 2 }, stable: true }),
    ]);
  });

  it('drops a sidekick with an unknown creature, class, bad level or bad base HP', () => {
    expect(sanitizeSidekicks([sidekick({ creatureId: 'dragon-god' })])).toBeUndefined();
    expect(sanitizeSidekicks([sidekick({ classId: 'fighter' })])).toBeUndefined();
    expect(sanitizeSidekicks([sidekick({ level: 0 })])).toBeUndefined();
    expect(sanitizeSidekicks([sidekick({ level: 21 })])).toBeUndefined();
    expect(sanitizeSidekicks([sidekick({ baseHpMax: -1 })])).toBeUndefined();
  });

  it('drops malformed level-ups, bad death saves and caps level-ups at 19 and sidekicks at 10', () => {
    const out = sanitizeSidekicks([
      sidekick({
        levelUps: [{ level: 1, roll: 2, hpGained: 3 }, { level: 2, roll: 'x', hpGained: 3 }, { level: 3, roll: 5, hpGained: 7 }],
        deathSaves: { successes: 4, failures: 0 },
      }),
    ]);
    expect(out?.[0].levelUps).toEqual([{ level: 3, roll: 5, hpGained: 7 }]);
    expect(out?.[0].deathSaves).toBeUndefined();
    const longLevelUps = Array.from({ length: 30 }, (_, i) => ({ level: 2 + (i % 19), roll: 1, hpGained: 1 }));
    expect(sanitizeSidekicks([sidekick({ levelUps: longLevelUps })])?.[0].levelUps).toHaveLength(19);
    const many = Array.from({ length: COMPANION_CAPS.sidekicks + 1 }, (_, i) => sidekick({ id: `s${i}` }));
    expect(sanitizeSidekicks(many)).toHaveLength(10);
  });
});

describe('sanitizeLoyaltyMaxOverride and sanitizeCompanionsState', () => {
  it('accepts only integers 0..20', () => {
    expect(sanitizeLoyaltyMaxOverride(0)).toBe(0);
    expect(sanitizeLoyaltyMaxOverride(20)).toBe(20);
    expect(sanitizeLoyaltyMaxOverride(21)).toBeUndefined();
    expect(sanitizeLoyaltyMaxOverride(-1)).toBeUndefined();
    expect(sanitizeLoyaltyMaxOverride(7.5)).toBeUndefined();
    expect(sanitizeLoyaltyMaxOverride('12')).toBeUndefined();
  });

  it('cleans every field of a character in place and deletes empty ones', () => {
    const c: Record<string, unknown> = {
      name: 'Keep',
      companions: [companion()],
      mounts: 'bad',
      hirelings: [],
      npcPartyMembers: [{ id: 'n1' }],
      sidekicks: [{ id: 's', creatureId: 'nope', classId: 'warrior', level: 1, baseHpMax: 1 }],
      loyaltyMaxOverride: 99,
    };
    const out = sanitizeCompanionsState(c);
    expect(out).toBe(c);
    expect(c.name).toBe('Keep');
    expect(c.companions).toHaveLength(1);
    for (const key of ['mounts', 'hirelings', 'npcPartyMembers', 'sidekicks', 'loyaltyMaxOverride']) {
      expect(key in c).toBe(false);
    }
  });
});
