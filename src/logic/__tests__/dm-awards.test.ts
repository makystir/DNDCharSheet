import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSeededRng } from '../random';
import { generateRandomCharacter } from '../personal-details-generation';
import type { Character } from '../../types/character';
import type { DmAward, DmCombatant, DmPartyMember } from '../../types/dm';
import { customCombatant } from '../dm-encounter';
import { xpBudget, xpAward, countsForXp } from '../dm-balance';
import { characterXp, levelingMode, xpForLevel } from '../advancement';
import { addAward, addManualMember, createCampaign, DEFAULT_MANUAL_STATS, emptyDmData } from '../dm-campaign';
import { parseDmData } from '../dm-sanitize';
import { importCharacterFromText } from '../dm-import';
import { encodeSharePayload } from '../share-codec';
import * as gzipModule from '../gzip';
import { hitPointMaxOf } from '../hit-points-state';
import {
  applyAward,
  awardBlocker,
  awardIdFromUuid,
  decodeAward,
  encodeAward,
  fightShare,
  shareBreakdown,
  ID_PATTERN,
  MAX_AWARD_XP,
  MAX_AWARDS,
  MAX_CODE_CHARS,
  milestoneShare,
  previewAward,
  validateAward,
  type AwardPayload,
} from '../dm-awards';

const NOW = 1_700_000_000_000;

function sheet(level: number, extra: Partial<Character> = {}): Character {
  const base = generateRandomCharacter(createSeededRng(3));
  const classes = base.classes ? [{ ...base.classes[0], level }] : undefined;
  const advancement = { ...base.advancement };
  delete advancement.leveling;
  delete advancement.appliedAwards;
  return { ...base, level, classes, advancement, ...extra };
}

function withMode(c: Character, mode: 'xp' | 'milestone' | undefined, xp?: number): Character {
  const advancement = { ...c.advancement };
  if (mode === undefined) delete advancement.leveling;
  else advancement.leveling = { mode, xp };
  return { ...c, advancement };
}

function twoClasses(c: Character, level: number): Character {
  const first = c.classes![0];
  return { ...c, level, classes: [{ ...first, level: level - 1 }, { ...first, level: 1 }] };
}

const xpAwardOf = (amount: number, id = 'abcdef123456', label = ''): AwardPayload => ({ kind: 'xp', amount, id, label });
const levelAwardOf = (amount: number, id = 'abcdef123456', label = ''): AwardPayload => ({ kind: 'level', amount, id, label });

const mon = (name: string, xp: number): DmCombatant => ({ ...customCombatant(name, { name, ac: 10, hpMax: 10, initiativeMod: 0 }), xp });

function member(character: Character, id = 'm1'): DmPartyMember {
  return { id, name: character.name || 'Hero', source: 'imported', character, addedAt: NOW, updatedAt: NOW };
}

describe('awardIdFromUuid', () => {
  it('gives a 12-character ID that matches the ID pattern', () => {
    const id = awardIdFromUuid('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE');
    expect(id).toHaveLength(12);
    expect(id).toBe('aaaaaaaabbbb');
    expect(ID_PATTERN.test(id)).toBe(true);
    expect(id).not.toContain('-');
    expect(ID_PATTERN.test(awardIdFromUuid(crypto.randomUUID()))).toBe(true);
  });
});

describe('encode and decode', () => {
  it('round-trips both kinds, with and without a label', async () => {
    for (const award of [xpAwardOf(450, 'abcdef123456', 'Cleared the crypt'), xpAwardOf(10), levelAwardOf(5, 'abcdef123457', 'Milestone'), levelAwardOf(20)]) {
      const encoded = await encodeAward(award);
      expect(encoded.ok).toBe(true);
      if (!encoded.ok) return;
      expect(encoded.code.startsWith('AWARD-')).toBe(true);
      const decoded = await decodeAward(encoded.code);
      expect(decoded).toEqual({ ok: true, award });
    }
  });

  it('keeps the worst-case codes within the stated length targets', async () => {
    const ascii = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
    let worstAscii = 0;
    let worstCjk = 0;
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    for (let n = 0; n < 40; n += 1) {
      const labelA = Array.from({ length: 40 }, () => ascii[rnd() % ascii.length]).join('');
      const labelC = Array.from({ length: 40 }, () => String.fromCharCode(0x4e00 + (rnd() % 20000))).join('');
      const a = await encodeAward({ kind: 'xp', amount: MAX_AWARD_XP, id: 'abcdef123456', label: labelA });
      const c = await encodeAward({ kind: 'xp', amount: MAX_AWARD_XP, id: 'abcdef123456', label: labelC });
      if (!a.ok || !c.ok) throw new Error('encode failed');
      worstAscii = Math.max(worstAscii, a.code.length);
      worstCjk = Math.max(worstCjk, c.code.length);
    }
    expect(worstAscii).toBeLessThanOrEqual(180);
    expect(worstCjk).toBeLessThanOrEqual(300);
    expect(worstCjk).toBeLessThan(MAX_CODE_CHARS);
  });

  it('refuses to encode an invalid award', async () => {
    expect((await encodeAward(xpAwardOf(0))).ok).toBe(false);
    expect((await encodeAward(levelAwardOf(21))).ok).toBe(false);
  });

  it('refuses to encode when compression is unavailable, without calling the codec', async () => {
    const spy = vi.spyOn(gzipModule, 'isGzipSupported').mockReturnValue(false);
    const result = await encodeAward(xpAwardOf(100));
    spy.mockRestore();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('compression is unavailable');
  });

  it('never throws and gives the right code for bad input', async () => {
    const good = await encodeAward(xpAwardOf(100));
    if (!good.ok) throw new Error('encode failed');
    const body = good.code.slice('AWARD-'.length);
    const wire = async (obj: unknown) => 'AWARD-' + (await encodeSharePayload(JSON.stringify(obj)));
    const w = (o: Record<string, unknown>) => ({ t: 'award', k: 'xp', n: 100, i: 'abcdef123456', ...o });

    const cases: Array<[string, string, string]> = [
      ['', 'empty', 'empty'],
      ['   ', 'empty', 'empty'],
      ['hello there', 'not-award', 'not-award'],
      ['AWAD-' + body, 'not-award', 'not-award'],
      [body, 'not-award', 'not-award'],
      ['https://x.test/#view/' + body, 'looks-like-character', 'looks-like-character'],
      ['{"name":"x"}', 'looks-like-character', 'looks-like-character'],
      ['AWARD-' + 'A'.repeat(MAX_CODE_CHARS), 'too-large', 'too-large'],
      ['AWARD-@@@@', 'bad-code', 'bad-code'],
      ['AWARD-' + body.slice(0, 10), 'bad-code', 'bad-code'],
      ['AWARD-' + body.slice(0, 20) + 'AAAA' + body.slice(24), 'bad-code', 'bad-code'],
    ];
    for (const [input, , code] of cases) {
      const r = await decodeAward(input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe(code);
    }
    const invalid: Array<Record<string, unknown>> = [
      { t: 'nope' },
      { k: 'gold' },
      { n: -5 },
      { n: 1.5 },
      { n: Number.NaN },
      { n: MAX_AWARD_XP + 1 },
      { k: 'level', n: 0 },
      { k: 'level', n: 21 },
      { l: 'x'.repeat(41) },
      { l: 5 },
      { i: 'short' },
      { i: 'ABCDEF123456' },
    ];
    for (const o of invalid) {
      const r = await decodeAward(await wire(w(o)));
      expect(r.ok).toBe(false);
    }
    const unknown = await decodeAward(await wire(w({ k: 'gold' })));
    if (!unknown.ok) expect(unknown.code).toBe('unknown-kind');
    const notJson = await decodeAward('AWARD-' + (await encodeSharePayload('not json')));
    if (!notJson.ok) expect(notJson.code).toBe('bad-json');
    const big = await decodeAward('AWARD-' + (await encodeSharePayload(JSON.stringify(w({ l: 'y'.repeat(2000) })))));
    expect(big.ok).toBe(false);
    // wrong version byte: flip the first character group
    const badVersion = await decodeAward('AWARD-' + 'Ag' + body.slice(2));
    expect(badVersion.ok).toBe(false);
  });

  it('maps corrupted gzip bytes to the damaged-code message', async () => {
    // Version byte 1 followed by bytes that are not gzip.
    const bytes = new Uint8Array([1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const r = await decodeAward('AWARD-' + b64);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('bad-code');
      expect(r.error).toContain('damaged');
    }
  });

  it('strips control characters and trims the label, and ignores unknown fields', () => {
    const r = validateAward({ t: 'award', k: 'xp', n: 5, i: 'abcdef123456', l: '  hi\u0007 there ', extra: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.award).toEqual({ kind: 'xp', amount: 5, id: 'abcdef123456', label: 'hi there' });
  });
});

describe('dm-import', () => {
  it('points an award code at the Advancement page', async () => {
    const r = await importCharacterFromText('AWARD-abc');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('award code');
  });
});

describe('shares', () => {
  const members = [
    { name: 'A', level: 3 },
    { name: 'B', level: 3 },
    { name: 'C', level: 3 },
    { name: 'D', level: 3 },
  ];
  it('gives each equal-level member their own budget value', () => {
    const major = milestoneShare(members, 'major');
    expect(major.share.total).toBe(xpBudget([members[0]], 'high').total);
    const minor = milestoneShare(members, 'minor');
    expect(minor.share.total).toBe(xpBudget([members[0]], 'low').total);
    expect(milestoneShare(members, 'moderate').share.total).toBe(xpBudget([members[0]], 'moderate').total);
  });
  it('splits the summed budget evenly for a mixed-level party', () => {
    const mixed = [
      { name: 'A', level: 1 },
      { name: 'B', level: 4 },
      { name: 'C', level: 9 },
    ];
    const total = xpBudget(mixed, 'high').total;
    expect(milestoneShare(mixed, 'major').share.total).toBe(Math.floor(total / 3));
  });
  it('gives 0 and a note for an empty party', () => {
    const r = milestoneShare([], 'major');
    expect(r.share.total).toBe(0);
    expect(r.note).toBeTruthy();
  });
  it('fightShare equals xpAward', () => {
    const counted = [mon('Orc', 100), mon('Orc 2', 100), mon('Ogre', 450)];
    expect(fightShare(counted, 4)).toEqual(xpAward(counted, 4));
    expect(fightShare(counted, 4).share.total).toBe(162);
  });
  it('countsForXp follows the explicit flag, else death', () => {
    const m = mon('Orc', 100);
    expect(countsForXp(m)).toBe(false);
    expect(countsForXp({ ...m, xpCounts: true })).toBe(true);
    expect(countsForXp({ ...m, hp: { ...m.hp, dead: true } })).toBe(true);
    expect(countsForXp({ ...m, xpCounts: false, hp: { ...m.hp, dead: true } })).toBe(false);
  });
});

describe('previewAward', () => {
  const xpSheet = (level: number, xp: number) => withMode(sheet(level), 'xp', xp);

  it('adds XP and finds the reachable level', () => {
    const p = previewAward(member(xpSheet(3, xpForLevel(4) - 100)), xpAward_(100));
    expect(p.newXp?.total).toBe(xpForLevel(4));
    expect(p.reachableLevel?.total).toBe(4);
    expect(p.levelsGained).toBe(1);
    const p2 = previewAward(member(xpSheet(3, xpForLevel(4) - 100)), xpAward_(99));
    expect(p2.reachableLevel?.total).toBe(3);
    expect(p2.levelsGained).toBe(0);
  });
  function xpAward_(n: number) {
    return xpAwardOf(n);
  }
  it('explains the thresholds for a non-exact total', () => {
    const p = previewAward(member(xpSheet(3, 2900)), xpAwardOf(100));
    expect(p.reachableLevel?.total).toBe(4);
    expect(p.reachableLevel?.note).toContain('level 4 threshold is 2,700 XP');
    expect(p.reachableLevel?.note).toContain('level 5 threshold is 6,500 XP');
  });
  it('caps at level 20', () => {
    const p = previewAward(member(xpSheet(19, 305000)), xpAwardOf(MAX_AWARD_XP));
    expect(p.reachableLevel?.total).toBe(20);
  });
  it('handles a level award at or above the target', () => {
    const p = previewAward(member(xpSheet(6, 0)), levelAwardOf(5));
    expect(p.unchanged).toBe(true);
    expect(p.reachableLevel?.total).toBe(6);
    const q = previewAward(member(xpSheet(4, 0)), levelAwardOf(6));
    expect(q.unchanged).toBe(false);
    expect(q.reachableLevel?.total).toBe(6);
    expect(q.levelsGained).toBe(2);
  });
  it('shows only the level for a manual member', () => {
    const manual: DmPartyMember = {
      id: 'x', name: 'Man', source: 'manual', manual: { ...DEFAULT_MANUAL_STATS, level: 4 }, addedAt: 0, updatedAt: 0,
    };
    const p = previewAward(manual, xpAwardOf(100));
    expect(p.xpTracked).toBe(false);
    expect(p.currentLevel).toBe(4);
    expect(p.blocked).toBeNull();
    expect(p.newXp).toBeNull();
    expect(p.addedXp?.total).toBe(100);
  });
  it('gives a manual member the known delta and a direct level result', () => {
    const manual: DmPartyMember = {
      id: 'x', name: 'Man', source: 'manual', manual: { ...DEFAULT_MANUAL_STATS, level: 4 }, addedAt: 0, updatedAt: 0,
    };
    const lvl = previewAward(manual, levelAwardOf(6));
    expect(lvl.reachableLevel?.total).toBe(6);
    expect(lvl.levelsGained).toBe(2);
    expect(lvl.addedXp?.total).toBe(0);
    expect(lvl.currentXp).toBeNull();
    expect(previewAward(manual, xpAwardOf(100)).reachableLevel).toBeNull();
  });
  it('survives a malformed appliedAwards value', () => {
    const base = withMode(sheet(3), 'xp', 0);
    for (const bad of ['abcdef123456', 5, { a: 1 }, ['BAD', 7, 'abcdef123456']]) {
      const c = { ...base, advancement: { ...base.advancement, appliedAwards: bad as unknown as string[] } };
      expect(() => awardBlocker(c, xpAwardOf(10))).not.toThrow();
      const r = applyAward(c, xpAwardOf(10, 'zzzzzzzz1111'), NOW);
      expect(r.outcome).toBe('applied');
      expect(r.character.advancement?.appliedAwards?.at(-1)).toBe('zzzzzzzz1111');
      expect((r.character.advancement?.appliedAwards ?? []).every((x) => typeof x === 'string' && x.length >= 8)).toBe(true);
    }
  });
  it('reports an unreadable-code error when compression is unavailable', async () => {
    const encoded = await encodeAward(xpAwardOf(100));
    if (!encoded.ok) throw new Error(encoded.error);
    const spy = vi.spyOn(gzipModule, 'isGzipSupported').mockReturnValue(false);
    const r = await decodeAward(encoded.code);
    spy.mockRestore();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cannot read award codes/);
  });
  it('marks blocked rows and leaves their cells empty', () => {
    const milestone = previewAward(member(withMode(sheet(5), 'milestone')), xpAwardOf(100));
    expect(milestone.blocked).toBe('milestone-blocked');
    expect(milestone.newXp).toBeNull();
    expect(milestone.reachableLevel).toBeNull();
    const multi = previewAward(member(twoClasses(sheet(5), 5)), levelAwardOf(8));
    expect(multi.blocked).toBe('multiclass-unsupported');
    expect(previewAward(member(withMode(sheet(5), 'milestone')), levelAwardOf(8)).blocked).toBeNull();
    expect(previewAward(member(withMode(twoClasses(sheet(5), 5), 'xp', 0)), xpAwardOf(100)).blocked).toBeNull();
  });
});

describe('applyAward', () => {
  it('adds XP and writes a log entry', () => {
    const c = withMode(sheet(3), 'xp', 1000);
    const r = applyAward(c, xpAwardOf(250, 'abcdef123456', 'Crypt'), NOW);
    expect(r.outcome).toBe('applied');
    expect(characterXp(r.character)).toBe(1250);
    expect(r.character.advancement?.appliedAwards).toEqual(['abcdef123456']);
    const last = r.character.advancement?.log?.at(-1);
    expect(last?.kind).toBe('xp-award');
    expect(last?.detail).toContain('DM award: Crypt');
  });

  it('refuses a repeat and leaves the content identical', () => {
    const c = withMode(sheet(3), 'xp', 1000);
    const first = applyAward(c, xpAwardOf(250), NOW).character;
    const again = applyAward(first, xpAwardOf(250), NOW + 5);
    expect(again.outcome).toBe('already-applied');
    expect(again.character).toBe(first);
  });

  it('sets the level for a level award and logs it', () => {
    const c = withMode(sheet(3), 'milestone');
    const r = applyAward(c, levelAwardOf(5, 'abcdef123456', 'Boss'), NOW);
    expect(r.outcome).toBe('applied');
    expect(r.character.level).toBe(5);
    expect(r.character.classes?.[0].level).toBe(5);
    const last = r.character.advancement?.log?.at(-1);
    expect(last?.kind).toBe('level-up');
    expect(last?.detail).toContain('Level 5: DM award: Boss');
  });

  it('raises stored current HP by the maximum gain for a level award', () => {
    const base = withMode(sheet(3), 'milestone');
    const maxBefore = hitPointMaxOf(base)!;
    for (const hp of [0, 4]) {
      const r = applyAward({ ...base, currentHp: hp }, levelAwardOf(5), NOW);
      const gain = hitPointMaxOf(r.character)! - maxBefore;
      expect(gain).toBeGreaterThan(0);
      expect(r.character.currentHp).toBe(hp + gain);
    }
    // A character at full HP (no stored value) stays following the maximum.
    expect(applyAward(base, levelAwardOf(5), NOW).character.currentHp).toBeUndefined();
  });

  it('records the ID for no-change and leaves the log alone', () => {
    const c = withMode(sheet(6), 'xp', 0);
    const r = applyAward(c, levelAwardOf(5), NOW);
    expect(r.outcome).toBe('no-change');
    expect(r.character.level).toBe(6);
    expect(r.character.advancement?.appliedAwards).toEqual(['abcdef123456']);
    expect(r.character.advancement?.log).toEqual(c.advancement?.log);
  });

  it('never drops old IDs, so an old code cannot be applied twice', () => {
    let c = withMode(sheet(3), 'xp', 0);
    const total = 520;
    for (let i = 0; i < total; i += 1) {
      c = applyAward(c, xpAwardOf(1, `id${String(i).padStart(8, '0')}`), NOW).character;
    }
    expect(c.advancement!.appliedAwards).toHaveLength(total);
    expect(applyAward(c, xpAwardOf(1, 'id00000000'), NOW).outcome).toBe('already-applied');
  });

  it('level award at 0 HP clears death saves and Stable', () => {
    const base = withMode(sheet(3), 'milestone');
    const failing = { ...base, currentHp: 0, deathSaves: { successes: 1, failures: 2 } };
    const r1 = applyAward(failing, levelAwardOf(5), NOW).character;
    expect(r1.currentHp).toBeGreaterThan(0);
    expect(r1.deathSaves).toBeUndefined();
    const stable = { ...base, currentHp: 0, deathSaves: { successes: 0, failures: 0, stable: true } };
    const r2 = applyAward(stable, levelAwardOf(5), NOW).character;
    expect(r2.currentHp).toBeGreaterThan(0);
    expect(r2.deathSaves).toBeUndefined();
  });

  it('level award keeps a dead character dead with no HP change', () => {
    const dead = { ...withMode(sheet(3), 'milestone'), currentHp: 0, dead: true };
    const r = applyAward(dead, levelAwardOf(5), NOW);
    expect(r.outcome).toBe('applied');
    expect(r.character.level).toBe(5);
    expect(r.character.currentHp).toBe(0);
    expect(r.character.dead).toBe(true);
  });
  it('refuses a level award on a multiclass sheet but allows XP', () => {
    const c = withMode(twoClasses(sheet(5), 5), 'xp', 0);
    const r = applyAward(c, levelAwardOf(8), NOW);
    expect(r.outcome).toBe('multiclass-unsupported');
    expect(r.character).toBe(c);
    expect(r.character.advancement?.appliedAwards).toBeUndefined();
    expect(awardBlocker(c, levelAwardOf(8))).toBe('multiclass-unsupported');
    expect(applyAward(c, xpAwardOf(100), NOW).outcome).toBe('applied');
    const same = applyAward(c, levelAwardOf(5), NOW);
    expect(same.outcome).toBe('no-change');
    expect(same.character.advancement?.appliedAwards).toEqual(['abcdef123456']);
    expect(applyAward(c, levelAwardOf(4, 'abcdef123499'), NOW).outcome).toBe('no-change');
  });

  it('blocks XP on milestone sheets above level 1 and allows it otherwise', () => {
    for (const mode of [undefined, 'milestone'] as const) {
      const c = withMode(sheet(5), mode);
      const r = applyAward(c, xpAwardOf(100), NOW);
      expect(r.outcome).toBe('milestone-blocked');
      expect(r.character).toBe(c);
      expect(r.character.advancement?.appliedAwards).toBeUndefined();
    }
    expect(applyAward(withMode(sheet(5), 'xp', 0), xpAwardOf(100), NOW).outcome).toBe('applied');
    expect(applyAward(withMode(sheet(5), 'milestone'), levelAwardOf(7), NOW).outcome).toBe('applied');
  });

  it('switches a level 1 sheet to XP mode', () => {
    for (const mode of [undefined, 'milestone'] as const) {
      const r = applyAward(withMode(sheet(1), mode), xpAwardOf(50), NOW);
      expect(r.outcome).toBe('applied');
      expect(levelingMode(r.character)).toBe('xp');
      expect(characterXp(r.character)).toBe(50);
    }
  });
});

describe('campaign awards', () => {
  it('stores awards, caps history, and round-trips through parseDmData', () => {
    let data = createCampaign(emptyDmData(), { id: 'c', name: 'C', now: NOW });
    const award = (i: number): DmAward => ({ id: `id${String(i).padStart(8, '0')}`, kind: 'xp', amount: 10, label: 'L', source: 'manual', createdAt: NOW + i });
    for (let i = 0; i < MAX_AWARDS + 2; i += 1) data = addAward(data, 'c', award(i));
    expect(data.campaigns[0].awards).toHaveLength(MAX_AWARDS);
    expect(data.campaigns[0].awards![0].id).toBe(award(2).id);
    const parsed = parseDmData(JSON.stringify(data));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.campaigns[0].awards).toEqual(data.campaigns[0].awards);
  });

  it('loads an old campaign without awards and drops junk', () => {
    const old = createCampaign(emptyDmData(), { id: 'c', name: 'C', now: NOW });
    const raw = JSON.parse(JSON.stringify(old));
    delete raw.campaigns[0].awards;
    const a = parseDmData(JSON.stringify(raw));
    expect(a.ok && a.data.campaigns[0].awards).toEqual([]);
    raw.campaigns[0].awards = [
      null,
      { id: 'abcdef123456', kind: 'xp', amount: 5, label: 'ok', source: 'fight', createdAt: 1 },
      { id: 'abcdef123456', kind: 'xp', amount: -5, label: 'bad', source: 'fight', createdAt: 1 },
      { id: 'abcdef123456', kind: 'xp', amount: 5, label: 'bad', source: 'weird', createdAt: 1 },
      { id: 'BAD', kind: 'xp', amount: 5, label: '', source: 'fight', createdAt: 1 },
    ];
    const b = parseDmData(JSON.stringify(raw));
    expect(b.ok && b.data.campaigns[0].awards).toHaveLength(1);
  });

  it('keeps manual members available for addManualMember tests', () => {
    const data = addManualMember(createCampaign(emptyDmData(), { id: 'c', name: 'C', now: NOW }), 'c', {
      id: 'm', name: 'M', stats: DEFAULT_MANUAL_STATS, now: NOW,
    });
    expect(data.campaigns[0].party).toHaveLength(1);
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('shareBreakdown', () => {
  it('shows each source component and the rounded-down division, summing to the share', () => {
    const b = shareBreakdown({ total: 150, components: [{ label: 'A', value: 100 }, { label: 'B', value: 50 }, { label: 'C', value: 0 }] }, 4);
    expect(b.total).toBe(37);
    expect(b.components.map((c) => c.label).slice(0, 3)).toEqual(['A', 'B', 'C']);
    expect(b.components.reduce((s, c) => s + c.value, 0)).toBe(37);
  });
  it('divides a milestone budget by the given sharers, including a member with no stats', () => {
    const members = [{ name: 'A', level: 3 }];
    const total = xpBudget(members, 'high').total;
    expect(milestoneShare(members, 'major', 2).share.total).toBe(Math.floor(total / 2));
  });
});
