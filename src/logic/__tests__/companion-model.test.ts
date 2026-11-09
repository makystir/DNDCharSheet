import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, CompanionRecord } from '../../types/character';
import { CREATURE_CATALOG } from '../../data/creatures';
import { buildCompanionModel, companionDisplayName, creatureOptionsForOrigin } from '../companion-model';
import { catalogStatBlockModel, customStatBlockModel } from '../stat-block-model';

function ranger(level: number, wis = 16): Character {
  const c = createCharacter('Ranger');
  return { ...c, level, abilities: { ...c.abilities, wis }, classes: [{ id: 'ranger', level, subclassId: 'beastMaster' }] };
}

describe('customStatBlockModel', () => {
  it('derives MOD and SAVE from typed scores and the Proficiency Bonus', () => {
    const m = customStatBlockModel('Guard', {
      abilities: { str: 13, dex: 12, con: 12, int: 10, wis: 11, cha: 10 },
      saveProficiencies: ['str'],
      proficiencyBonus: 2,
      ac: 16,
    });
    const str = m.abilities.find((a) => a.key === 'str')!;
    expect(str.mod.text).toBe('+1');
    expect(str.save.text).toBe('+3');
    expect(str.save.breakdown?.total).toBe(3);
    expect(m.abilities.find((a) => a.key === 'int')!.save.text).toBe('+0');
    expect(m.ac?.text).toBe('16');
  });

  it('leaves absent fields blank and invents nothing', () => {
    const m = customStatBlockModel('Scout', undefined);
    expect(m.ac).toBeNull();
    expect(m.hp).toBeNull();
    expect(m.lines).toEqual([]);
    expect(m.abilities.every((a) => a.score === '' && a.mod.text === '')).toBe(true);
  });
});

describe('catalogStatBlockModel', () => {
  it('shows printed AC, HP and abilities for a catalog creature', () => {
    const m = catalogStatBlockModel(CREATURE_CATALOG.cat);
    expect(m.ac?.text).toBe('12');
    expect(m.hp?.text).toContain('2');
    expect(m.abilities).toHaveLength(6);
    expect(m.hpMax).toBe(2);
  });

  it('uses an actual maximum HP override instead of the printed average', () => {
    expect(catalogStatBlockModel(CREATURE_CATALOG.cat, undefined, 5).hpMax).toBe(5);
  });
});

describe('buildCompanionModel', () => {
  const primal: CompanionRecord = { id: 'p', creatureId: 'beast-of-the-land', origin: 'primal-companion' };

  it('computes Primal Companion HP from Ranger level and updates with it', () => {
    expect(buildCompanionModel(primal, ranger(5))?.hpMax).toBe(30);
    expect(buildCompanionModel(primal, ranger(11))?.hpMax).toBe(60);
  });

  it('has no numbers below Ranger level 3 but still warns', () => {
    const built = buildCompanionModel(primal, ranger(2));
    expect(built?.hpMax).toBeNull();
    expect(built?.warning).toMatch(/level 3/);
    expect(built?.formulaNote).toMatch(/AC 13/);
  });

  it('forces the Fey type for a Wild Companion familiar', () => {
    const rec: CompanionRecord = { id: 'w', creatureId: 'cat', origin: 'wild-companion' };
    expect(buildCompanionModel(rec, ranger(5))?.model.subtitle).toMatch(/Fey/);
  });

  it('uses the chosen familiar type for Find Familiar', () => {
    const rec: CompanionRecord = { id: 'f', creatureId: 'cat', origin: 'find-familiar', familiarType: 'Celestial' };
    expect(buildCompanionModel(rec, ranger(5))?.model.subtitle).toMatch(/Celestial/);
  });

  it('derives the Otherworldly Steed AC and HP from the slot level', () => {
    const rec: CompanionRecord = { id: 's', creatureId: 'otherworldly-steed', origin: 'find-steed', spellSlotLevel: 4, steedType: 'Fey' };
    const built = buildCompanionModel(rec, ranger(9));
    expect(built?.model.ac?.text).toBe('14');
    expect(built?.hpMax).toBe(45);
    expect(built?.model.speed).toMatch(/Fly/);
  });

  it('returns null for an unknown creature id', () => {
    expect(buildCompanionModel({ id: 'x', creatureId: 'nope', origin: 'pet' }, ranger(5))).toBeNull();
  });
});

describe('companionDisplayName', () => {
  it('prefers a trimmed nickname over the creature name', () => {
    expect(companionDisplayName({ creatureId: 'cat', nickname: '  Mittens ' })).toBe('Mittens');
    expect(companionDisplayName({ creatureId: 'cat' })).toBe('Cat');
  });
});

describe('creatureOptionsForOrigin', () => {
  it('offers the three Primal Companion beasts', () => {
    expect(creatureOptionsForOrigin('primal-companion').map((c) => c.id).sort()).toEqual([
      'beast-of-the-land',
      'beast-of-the-sea',
      'beast-of-the-sky',
    ]);
  });

  it('gives Pact of the Chain more forms than Find Familiar', () => {
    const find = creatureOptionsForOrigin('find-familiar').map((c) => c.id);
    const pact = creatureOptionsForOrigin('pact-of-the-chain').map((c) => c.id);
    expect(pact.length).toBeGreaterThan(find.length);
    expect(pact).toContain('imp');
    expect(find).not.toContain('imp');
  });

  it('limits Find Steed and Animate Dead to their creatures', () => {
    expect(creatureOptionsForOrigin('find-steed').map((c) => c.id)).toEqual(['otherworldly-steed']);
    expect(creatureOptionsForOrigin('animate-dead').map((c) => c.id).sort()).toEqual(['skeleton', 'zombie']);
  });

  it('offers every catalog animal as a pet', () => {
    const ids = creatureOptionsForOrigin('pet').map((c) => c.id);
    expect(ids).toContain('mastiff');
    expect(ids).toContain('riding-horse');
  });
});
