/**
 * Multiclass Hit Points golden (level-up gap analysis, item 1).
 *
 * PHB 2024 "Gaining a Level" (L2011-2016), "Fixed Hit Points by Class" (L2016) and
 * "Multiclassing: Hit Points and Hit Point Dice" (L2088-2100): each level's HP uses
 * the Hit Die of the class in which that level was gained; the level-1 "max die"
 * term applies only once, for total level 1; every per-level gain is at least 1.
 */
import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character } from '../../types/character';
import type { ClassId } from '../../data/classes';
import { applyMulticlassLevel, hitPointMaxWithAdvancement, setLevelHp } from '../advancement';
import { characterHitPointMaxBreakdown } from '../hit-points-state';

function multi(classes: ReadonlyArray<[string, number]>, con = 10): Character {
  const base = createCharacter('T');
  return {
    ...base,
    level: classes.reduce((s, [, l]) => s + l, 0),
    classes: classes.map(([id, level]) => ({ id: id as ClassId, level })),
    abilities: { ...base.abilities, con },
  };
}

/** Add a level in `classId` with a rolled face, through the real level-up path. */
function levelRolled(c: Character, classId: string, face: number): Character {
  const next = applyMulticlassLevel(c, classId, { mode: 'rolled', face }, 1);
  if (!next) throw new Error('level-up refused');
  return next;
}

describe('multiclass HP golden — fixed default', () => {
  const rows: ReadonlyArray<{ name: string; classes: ReadonlyArray<[string, number]>; con: number; hp: number }> = [
    // d10 L1 + 4 d10 fixed (6) + 2 d8 fixed (5), Con +0
    { name: 'Fighter 5 / Rogue 2: d10 levels + d8 levels', classes: [['fighter', 5], ['rogue', 2]], con: 10, hp: 10 + 24 + 10 },
    // Level-1 term once: Wizard d6 initial; Fighter level is fixed 6, NOT 10
    { name: 'Wizard 1 / Fighter 1: level-1 max die only once', classes: [['wizard', 1], ['fighter', 1]], con: 10, hp: 6 + 6 },
    // Con +2: each level +2
    { name: 'Fighter 2 / Rogue 2, Con +2', classes: [['fighter', 2], ['rogue', 2]], con: 14, hp: 10 + 2 + (6 + 2) + 2 * (5 + 2) },
    // Con -5: initial L1 = max(1, 6-5) = 1; each later level floored at 1
    { name: 'Wizard 1 / Fighter 2, Con -5: minimum 1 per level', classes: [['wizard', 1], ['fighter', 2]], con: 1, hp: 1 + 1 + 1 },
  ];
  it.each(rows)('$name', ({ classes, con, hp }) => {
    const c = multi(classes, con);
    expect(characterHitPointMaxBreakdown(c).total).toBe(hp);
    // No records: the advancement-aware total is the same.
    expect(hitPointMaxWithAdvancement(c).total).toBe(hp);
  });
});

describe('multiclass HP golden — rolled records use the leveled class Hit Die', () => {
  it('Fighter 3 then a rolled Rogue level: 10 + 2*6 + rolled 8 (not the fixed 5)', () => {
    const c = levelRolled(multi([['fighter', 3]]), 'rogue', 8);
    expect(c.advancement?.levels?.find((l) => l.level === 4)?.classId).toBe('rogue');
    expect(hitPointMaxWithAdvancement(c).total).toBe(10 + 12 + 8);
    expect(characterHitPointMaxBreakdown(c).total).toBe(10 + 12 + 8);
  });

  it('rolled face + Con, floored at 1 per level', () => {
    const c = levelRolled(multi([['fighter', 1]], 6), 'rogue', 2); // Con -2: max(1, 2-2) = 1
    // L1 = max(1, 10-2) = 8; rogue level rolled = 1.
    expect(hitPointMaxWithAdvancement(c).total).toBe(8 + 1);
  });

  it('unrecorded levels of a multiclass character stay at their own class fixed value', () => {
    // Fighter 4 / Rogue 1 (rolled) / one more Fighter level left unrecorded
    let c = levelRolled(multi([['fighter', 4]]), 'rogue', 3);
    c = { ...c, classes: c.classes!.map((e) => (e.id === 'fighter' ? { ...e, level: 5 } : e)), level: 6 };
    expect(hitPointMaxWithAdvancement(c).total).toBe(10 + 4 * 6 + 3);
  });

  it('a stale record cannot count more rolled levels than the class has', () => {
    let c = multi([['fighter', 2], ['rogue', 1]]);
    for (const level of [3, 4, 5]) {
      c = setLevelHp(c, level, { mode: 'rolled', face: 8 }, 1, 8, 'rogue');
    }
    // Rogue has 1 level: only one rolled face counts.
    expect(hitPointMaxWithAdvancement(c).total).toBe(10 + 6 + 8);
  });

  it('legacy records without a classId read as the initial class', () => {
    const c = setLevelHp(multi([['fighter', 2], ['rogue', 1]]), 2, { mode: 'rolled', face: 10 }, 1);
    expect(c.advancement?.levels?.[0].classId).toBeUndefined();
    expect(hitPointMaxWithAdvancement(c).total).toBe(10 + 10 + 5);
  });

  it('re-recording a level keeps the class it was gained in', () => {
    let c = levelRolled(multi([['fighter', 3]]), 'rogue', 8);
    c = setLevelHp(c, 4, { mode: 'rolled', face: 4 }, 2);
    expect(c.advancement?.levels?.find((l) => l.level === 4)?.classId).toBe('rogue');
    expect(hitPointMaxWithAdvancement(c).total).toBe(10 + 12 + 4);
  });
});
