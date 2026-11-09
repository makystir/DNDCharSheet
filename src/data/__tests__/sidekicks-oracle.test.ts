/**
 * ORACLE test for the Sidekick class catalog (Stage 1b).
 *
 * Tasha's 2020 (5e, 2014 rules): Docs/TashasCauldronOfEverything.md, "Sidekicks"
 * (L6917-7275). Compares the live catalog (src/data/sidekicks.ts) against the
 * independently authored golden fixture (./sidekicks-golden.ts). It FAILS
 * CLOSED: every assertion message names `<class>/L<level>/<feature>` and the
 * field, a missing or extra class / row / feature fails by name, and structured
 * values (proficiency bonus, slots, uses, dice, choice options, grants) are
 * compared to the golden values, never matched against paraphrased prose.
 */
import { describe, it, expect } from 'vitest';
import {
  SIDEKICK_BONUS_PROFICIENCIES_BY_CREATURE_TYPE,
  SIDEKICK_CLASSES,
  SIDEKICK_CLASS_IDS,
  SIDEKICK_MAX_CHALLENGE_RATING,
  SIDEKICK_SPELLCASTING_ROLES,
  type SidekickClassId,
  type SidekickFeature,
} from '../sidekicks';
import {
  EXPERT_GOLDEN,
  EXPERT_SHARP_MIND_SAVES_GOLDEN,
  SIDEKICK_ASI_LEVELS_GOLDEN,
  SIDEKICK_BONUS_PROFICIENCIES_BY_CREATURE_TYPE_GOLDEN,
  SIDEKICK_BONUS_PROFICIENCIES_GOLDEN,
  SIDEKICK_HIT_DIE_GOLDEN,
  SIDEKICK_RULES_GOLDEN,
  SIDEKICK_SPELLCASTING_ROLES_GOLDEN,
  SPELLCASTER_GOLDEN,
  WARRIOR_GOLDEN,
  WARRIOR_MARTIAL_ROLES_GOLDEN,
  type GoldenSidekickLevel,
} from './sidekicks-golden';

const GOLDEN_ROWS: Record<SidekickClassId, readonly GoldenSidekickLevel[]> = {
  expert: EXPERT_GOLDEN,
  spellcaster: SPELLCASTER_GOLDEN,
  warrior: WARRIOR_GOLDEN,
};

/** Feature record ids pinned independently of the golden file (cardinality: 10 + 6 + 9). */
const EXPECTED_FEATURE_IDS: Record<SidekickClassId, string[]> = {
  expert: [
    'expert.bonus-proficiencies', 'expert.helpful', 'expert.cunning-action', 'expert.expertise',
    'expert.ability-score-improvement', 'expert.coordinated-strike', 'expert.evasion',
    'expert.inspiring-help', 'expert.reliable-talent', 'expert.sharp-mind',
  ],
  spellcaster: [
    'spellcaster.bonus-proficiencies', 'spellcaster.spellcasting', 'spellcaster.ability-score-improvement',
    'spellcaster.potent-cantrips', 'spellcaster.empowered-spells', 'spellcaster.focused-casting',
  ],
  warrior: [
    'warrior.bonus-proficiencies', 'warrior.martial-role', 'warrior.second-wind', 'warrior.improved-critical',
    'warrior.ability-score-improvement', 'warrior.extra-attack', 'warrior.battle-readiness',
    'warrior.improved-defense', 'warrior.indomitable',
  ],
};

/** Level at which each feature is first gained (the "Nth-level <Class> feature" line). */
const EXPECTED_FIRST_LEVEL: Record<string, number> = {
  'expert.bonus-proficiencies': 1, 'expert.helpful': 1, 'expert.cunning-action': 2, 'expert.expertise': 3,
  'expert.ability-score-improvement': 4, 'expert.coordinated-strike': 6, 'expert.evasion': 7,
  'expert.inspiring-help': 11, 'expert.reliable-talent': 14, 'expert.sharp-mind': 18,
  'spellcaster.bonus-proficiencies': 1, 'spellcaster.spellcasting': 1, 'spellcaster.ability-score-improvement': 4,
  'spellcaster.potent-cantrips': 6, 'spellcaster.empowered-spells': 14, 'spellcaster.focused-casting': 20,
  'warrior.bonus-proficiencies': 1, 'warrior.martial-role': 1, 'warrior.second-wind': 2, 'warrior.improved-critical': 3,
  'warrior.ability-score-improvement': 4, 'warrior.extra-attack': 6, 'warrior.battle-readiness': 7,
  'warrior.improved-defense': 10, 'warrior.indomitable': 11,
};

const feat = (id: string): SidekickFeature => {
  const [cls] = id.split('.') as [SidekickClassId];
  const f = SIDEKICK_CLASSES[cls].features.find((x) => x.id === id);
  if (!f) throw new Error(`${id}: feature missing from the catalog`);
  return f;
};

describe('sidekick catalog oracle (Tasha 2020, 5e 2014 rules)', () => {
  it('has exactly the three classes', () => {
    expect([...SIDEKICK_CLASS_IDS]).toEqual(['expert', 'spellcaster', 'warrior']);
    expect(Object.keys(SIDEKICK_CLASSES).sort()).toEqual(['expert', 'spellcaster', 'warrior']);
  });

  for (const cls of ['expert', 'spellcaster', 'warrior'] as const) {
    describe(cls, () => {
      const data = SIDEKICK_CLASSES[cls];
      const golden = GOLDEN_ROWS[cls];

      it('has 20 level rows, 1..20', () => {
        expect(data.rows.length, `${cls}: row count`).toBe(20);
        expect(golden.length, `${cls}: golden row count`).toBe(20);
        data.rows.forEach((r, i) => expect(r.level, `${cls}/row ${i}: level`).toBe(i + 1));
      });

      it('matches the golden proficiency bonus and exact feature set at every level', () => {
        for (const g of golden) {
          const row = data.rows.find((r) => r.level === g.level);
          expect(row, `${cls}/L${g.level}: row missing`).toBeDefined();
          expect(row!.proficiencyBonus, `${cls}/L${g.level}: proficiencyBonus`).toBe(g.proficiencyBonus);
          expect([...row!.features], `${cls}/L${g.level}: features`).toEqual(g.features);
        }
      });

      it('every row feature resolves to a catalog record, and every record is on a row', () => {
        for (const row of data.rows) {
          for (const id of row.featureIds) {
            expect(data.features.some((f) => f.id === id), `${cls}/L${row.level}/${id}: no feature record`).toBe(true);
          }
        }
        for (const f of data.features) {
          expect(f.levels.length, `${cls}/${f.name}: appears on no table row`).toBeGreaterThan(0);
        }
      });

      it('has exactly the pinned feature records with first levels and citations', () => {
        expect(data.features.map((f) => f.id), `${cls}: feature id set`).toEqual(EXPECTED_FEATURE_IDS[cls]);
        for (const f of data.features) {
          expect(f.level, `${cls}/${f.name}: first level`).toBe(EXPECTED_FIRST_LEVEL[f.id]);
          expect(f.levels[0], `${cls}/${f.name}: first table level`).toBe(f.level);
          expect(f.source.edition, `${cls}/${f.name}: edition marker`).toBe("Tasha's 2020 (5e, 2014 rules)");
          expect(f.source.line, `${cls}/${f.name}: source line`).toBeGreaterThan(6916);
          expect(f.source.lines[1], `${cls}/${f.name}: source end line`).toBeLessThanOrEqual(7275);
          expect(f.summary.length, `${cls}/${f.name}: summary`).toBeGreaterThan(10);
        }
      });

      it('has the Ability Score Improvement levels of the prose, equal to the table rows', () => {
        expect([...data.abilityScoreImprovementLevels], `${cls}: ASI levels`).toEqual(SIDEKICK_ASI_LEVELS_GOLDEN[cls]);
        const fromRows = data.rows.filter((r) => r.features.includes('Ability Score Improvement')).map((r) => r.level);
        expect(fromRows, `${cls}: ASI table rows`).toEqual(SIDEKICK_ASI_LEVELS_GOLDEN[cls]);
      });
    });
  }

  it('Spellcaster table: cantrips, spells known and slots match the golden at every level', () => {
    for (const g of SPELLCASTER_GOLDEN) {
      const r = SIDEKICK_CLASSES.spellcaster.rows[g.level - 1];
      expect(r.cantripsKnown, `spellcaster/L${g.level}: cantripsKnown`).toBe(g.cantripsKnown);
      expect(r.spellsKnown, `spellcaster/L${g.level}: spellsKnown`).toBe(g.spellsKnown);
      expect(r.spellsKnownInferred, `spellcaster/L${g.level}: spellsKnownInferred`).toBe(g.spellsKnownInferred);
      expect([...r.slots], `spellcaster/L${g.level}: slots`).toEqual([...g.slots]);
    }
  });

  it('Spellcaster slots never decrease, and the 1st-level spell is the only inferred cell', () => {
    const rows = SIDEKICK_CLASSES.spellcaster.rows;
    expect(rows.filter((r) => r.spellsKnownInferred).map((r) => r.level)).toEqual([1]);
    for (let i = 1; i < rows.length; i++) {
      rows[i].slots.forEach((n, s) => expect(n, `spellcaster/L${i + 1}: ${s + 1}-level slots decreased`).toBeGreaterThanOrEqual(rows[i - 1].slots[s]));
      expect(rows[i].spellsKnown, `spellcaster/L${i + 1}: spellsKnown decreased`).toBeGreaterThanOrEqual(rows[i - 1].spellsKnown);
    }
  });

  it('Spellcaster roles match the Spellcasting table', () => {
    expect(SIDEKICK_SPELLCASTING_ROLES.map((r) => ({ role: r.role, lists: [...r.spellLists], ability: r.ability }))).toEqual(
      SIDEKICK_SPELLCASTING_ROLES_GOLDEN.map((r) => ({ role: r.role, lists: [...r.spellList], ability: r.ability })),
    );
    expect(feat('spellcaster.spellcasting').choices![0].options).toEqual(['Mage', 'Healer', 'Prodigy']);
    for (const r of SIDEKICK_SPELLCASTING_ROLES) {
      expect(r.recommendedSpells.length, `spellcaster/${r.role}: recommended spells`).toBe(3);
    }
  });

  it('Bonus Proficiencies grants match the golden (saves, skill counts and lists, armor, weapons)', () => {
    for (const cls of ['expert', 'spellcaster', 'warrior'] as const) {
      const g = SIDEKICK_BONUS_PROFICIENCIES_GOLDEN[cls];
      const f = feat(`${cls}.bonus-proficiencies`);
      const grants = f.grants!;
      expect([...grants.savingThrow!.from], `${cls}/Bonus Proficiencies: save choices`).toEqual([...g.saveChoices]);
      expect(grants.skills!.pick, `${cls}/Bonus Proficiencies: skill count`).toBe(g.skillCount);
      expect(grants.skills!.from === null ? null : [...grants.skills!.from], `${cls}/Bonus Proficiencies: skill list`).toEqual(
        g.skillChoices === null ? null : [...g.skillChoices],
      );
      expect([...grants.armor!], `${cls}/Bonus Proficiencies: armor`).toEqual([...g.armor]);
    }
    const ex = feat('expert.bonus-proficiencies').grants!.ifHumanoidOrHasWeapon!;
    expect([...ex.weapons]).toEqual(['simple']);
    expect(ex.tools!.pick, 'expert/Bonus Proficiencies: tool count').toBe(2);
    expect([...feat('spellcaster.bonus-proficiencies').grants!.ifHumanoidOrHasWeapon!.weapons]).toEqual(['simple']);
    expect([...feat('warrior.bonus-proficiencies').grants!.ifHumanoidOrHasWeapon!.weapons]).toEqual(['shields', 'simple', 'martial']);
  });

  it('class-level choices have the exact options', () => {
    expect([...feat('expert.sharp-mind').grants!.savingThrow!.from]).toEqual([...EXPERT_SHARP_MIND_SAVES_GOLDEN]);
    expect(feat('warrior.martial-role').choices![0].options).toEqual([...WARRIOR_MARTIAL_ROLES_GOLDEN]);
    const exp = feat('expert.expertise').choices![0];
    expect(exp.pick, 'expert/Expertise: pick').toBe(2);
    expect([...exp.atLevels!], 'expert/Expertise: levels').toEqual([3, 15]);
    expect(feat('spellcaster.empowered-spells').choices![0].kind).toBe('school-of-magic');
    const bp = feat('expert.bonus-proficiencies').choices!;
    expect(bp.map((c) => `${c.id}:${c.pick}`)).toEqual(['save:1', 'skills:5', 'tools:2']);
  });

  it('structured feature values: dice, uses, DCs, ranges', () => {
    expect(feat('expert.coordinated-strike').dice, 'expert/Coordinated Strike: dice').toBe('2d6');
    expect(feat('expert.coordinated-strike').rangeFt, 'expert/Coordinated Strike: range').toBe(30);
    expect(feat('expert.inspiring-help').diceByLevel, 'expert/Inspiring Help: dice').toEqual([
      { level: 11, dice: '1d6' },
      { level: 20, dice: '2d6' },
    ]);
    const sw = feat('warrior.second-wind');
    expect(sw.dice, 'warrior/Second Wind: dice').toBe('1d10');
    expect(sw.addsClassLevel, 'warrior/Second Wind: adds level').toBe(true);
    expect(sw.usesByLevel, 'warrior/Second Wind: uses').toEqual([{ level: 2, uses: 1 }, { level: 20, uses: 2 }]);
    expect(sw.recharge, 'warrior/Second Wind: recharge').toBe('short-or-long-rest');
    expect(feat('warrior.indomitable').usesByLevel, 'warrior/Indomitable: uses').toEqual([{ level: 11, uses: 1 }, { level: 18, uses: 2 }]);
    expect(feat('warrior.indomitable').recharge, 'warrior/Indomitable: recharge').toBe('long-rest');
    expect(feat('warrior.extra-attack').attacksPerAttackAction, 'warrior/Extra Attack: attacks').toEqual([
      { level: 6, attacks: 2 },
      { level: 15, attacks: 3 },
    ]);
    expect(feat('warrior.improved-critical').critRange, 'warrior/Improved Critical: range').toBe(19);
    expect(feat('warrior.improved-defense').acBonus, 'warrior/Improved Defense: AC').toBe(1);
    expect(feat('warrior.martial-role').flatBonus, 'warrior/Martial Role: Attacker bonus').toBe(2);
  });

  it('class rules: language requirement, CR ceiling, absent tables stay null', () => {
    expect(SIDEKICK_CLASSES.expert.requiresSpokenLanguage).toBe(SIDEKICK_RULES_GOLDEN.expertAndSpellcasterNeedSpokenLanguage);
    expect(SIDEKICK_CLASSES.spellcaster.requiresSpokenLanguage).toBe(SIDEKICK_RULES_GOLDEN.expertAndSpellcasterNeedSpokenLanguage);
    expect(SIDEKICK_CLASSES.warrior.requiresSpokenLanguage).toBe(SIDEKICK_RULES_GOLDEN.warriorNeedsLanguage);
    expect(SIDEKICK_MAX_CHALLENGE_RATING).toBe(SIDEKICK_RULES_GOLDEN.maxChallengeRating);
    // Never invented: the book text has no such table and no class-fixed Hit Die.
    expect(SIDEKICK_BONUS_PROFICIENCIES_BY_CREATURE_TYPE).toBe(SIDEKICK_BONUS_PROFICIENCIES_BY_CREATURE_TYPE_GOLDEN);
    expect(SIDEKICK_HIT_DIE_GOLDEN).toBeNull();
  });

  it('proficiency bonus follows +2/+3/+4/+5/+6 every four levels in all classes', () => {
    for (const cls of SIDEKICK_CLASS_IDS) {
      for (const r of SIDEKICK_CLASSES[cls].rows) {
        expect(r.proficiencyBonus, `${cls}/L${r.level}: proficiencyBonus`).toBe(2 + Math.floor((r.level - 1) / 4));
      }
    }
  });
});
