import { describe, it, expect } from 'vitest';
import { createSeededRng } from '../random';
import { generateRandomCharacter } from '../personal-details-generation';
import {
  activeCampaign,
  addImportedMember,
  addManualMember,
  clampManualStats,
  createCampaign,
  DEFAULT_MANUAL_STATS,
  deleteCampaign,
  emptyDmData,
  memberStats,
  partySummary,
  removeMember,
  renameCampaign,
  setActiveCampaign,
  updateManualMember,
} from '../dm-campaign';
import { parseDmData, sanitizeDmData } from '../dm-sanitize';
import { extractShareCode, importCharacterFromText } from '../dm-import';
import { parseDmRoute, formatDmHash } from '../dm-mode';
import { passivePerceptionBreakdown, passiveSkillBreakdown } from '../passive-checks';
import { encodeSharePayload } from '../share-codec';
import { exportToJSON } from '../../storage/export-import';

const NOW = 1_700_000_000_000;

function character(seed: number, classId?: string) {
  return generateRandomCharacter(createSeededRng(seed), { classId: classId as never });
}

describe('DM routes', () => {
  it('opens the DM home for an empty hash and recognises DM pages', () => {
    expect(parseDmRoute('')).toEqual({ area: 'dm', page: 'party' });
    expect(parseDmRoute('#')).toEqual({ area: 'dm', page: 'party' });
    expect(parseDmRoute('#dm')).toEqual({ area: 'dm', page: 'party' });
    expect(parseDmRoute('#dm/campaign')).toEqual({ area: 'dm', page: 'campaign' });
    expect(parseDmRoute('#DM/Settings')).toEqual({ area: 'dm', page: 'settings' });
    expect(parseDmRoute('#DM/XP')).toEqual({ area: 'dm', page: 'xp' });
    expect(parseDmRoute('#dm/nonsense')).toEqual({ area: 'dm', page: 'party' });
  });

  it('treats player page hashes as the player area', () => {
    expect(parseDmRoute('#character')).toEqual({ area: 'player' });
    expect(parseDmRoute('#combat/x')).toEqual({ area: 'player' });
  });

  it('round-trips a DM page', () => {
    expect(parseDmRoute(formatDmHash('campaign'))).toEqual({ area: 'dm', page: 'campaign' });
  });
});

describe('campaigns', () => {
  it('creates, renames, switches and deletes', () => {
    let d = emptyDmData();
    d = createCampaign(d, { id: 'a', name: '  Ember Throne ', now: NOW });
    d = createCampaign(d, { id: 'b', name: '   ', now: NOW });
    expect(d.campaigns.map((c) => c.name)).toEqual(['Ember Throne', 'New campaign']);
    expect(activeCampaign(d)?.id).toBe('b');
    d = setActiveCampaign(d, 'a');
    expect(activeCampaign(d)?.id).toBe('a');
    d = renameCampaign(d, 'a', '   ', NOW + 1);
    expect(d.campaigns[0].name).toBe('Ember Throne');
    d = renameCampaign(d, 'a', 'Renamed', NOW + 1);
    expect(d.campaigns[0].name).toBe('Renamed');
    d = deleteCampaign(d, 'a');
    expect(d.campaigns.map((c) => c.id)).toEqual(['b']);
    expect(activeCampaign(d)?.id).toBe('b');
    d = deleteCampaign(d, 'b');
    expect(d.activeCampaignId).toBeNull();
    expect(activeCampaign(d)).toBeUndefined();
  });
});

describe('party members', () => {
  const base = () => createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: NOW });

  it('adds an imported character, and refreshes the same name instead of duplicating', () => {
    const c = character(1);
    const first = addImportedMember(base(), 'c', { id: 'm1', character: c, now: NOW });
    expect(first.outcome).toBe('added');
    const again = addImportedMember(first.data, 'c', {
      id: 'm2',
      character: { ...c, name: c.name.toUpperCase(), level: 5 },
      now: NOW + 5,
    });
    expect(again.outcome).toBe('refreshed');
    expect(again.memberId).toBe('m1');
    expect(again.data.campaigns[0].party).toHaveLength(1);
    expect(again.data.campaigns[0].party[0].character?.level).toBe(5);
  });

  it('refreshes a chosen member even when the name changed', () => {
    const a = addImportedMember(base(), 'c', { id: 'm1', character: { ...character(2), name: 'Old' }, now: NOW });
    const b = addImportedMember(a.data, 'c', {
      id: 'm2',
      character: { ...character(2), name: 'New' },
      now: NOW + 1,
      replaceMemberId: 'm1',
    });
    expect(b.outcome).toBe('refreshed');
    expect(b.data.campaigns[0].party.map((m) => m.name)).toEqual(['New']);
  });

  it('adds, edits and removes a manual member with clamped numbers', () => {
    let d = addManualMember(base(), 'c', {
      id: 'x',
      name: 'Borin',
      stats: { ...DEFAULT_MANUAL_STATS, level: 99, hpMax: 12, hpCurrent: 50, ac: -4, languages: [' Dwarvish ', ''] },
      now: NOW,
    });
    const m = d.campaigns[0].party[0].manual!;
    expect(m.level).toBe(20);
    expect(m.hpCurrent).toBe(12);
    expect(m.ac).toBe(0);
    expect(m.languages).toEqual(['Dwarvish']);
    d = updateManualMember(d, 'c', 'x', { name: 'Borin II', stats: { ...m, ac: 17 }, now: NOW + 1 });
    expect(d.campaigns[0].party[0].name).toBe('Borin II');
    expect(d.campaigns[0].party[0].manual?.ac).toBe(17);
    d = removeMember(d, 'c', 'x', NOW + 2);
    expect(d.campaigns[0].party).toEqual([]);
  });

  it('clamps non-finite manual input', () => {
    const s = clampManualStats({ ...DEFAULT_MANUAL_STATS, ac: Number.NaN, level: Number.POSITIVE_INFINITY });
    expect(Number.isFinite(s.ac)).toBe(true);
    expect(s.level).toBeGreaterThanOrEqual(1);
  });
});

describe('member stats', () => {
  it('shows the same numbers the player sheet derives, each with a breakdown', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const c = character(seed);
      const d = addImportedMember(createCampaign(emptyDmData(), { id: 'c', name: 'T', now: NOW }), 'c', {
        id: 'm',
        character: c,
        now: NOW,
      }).data;
      const stats = memberStats(d.campaigns[0].party[0])!;
      expect(stats).toBeDefined();
      expect(stats.passivePerception.total).toBe(passivePerceptionBreakdown(c).total);
      expect(stats.passiveInsight.total).toBe(passiveSkillBreakdown(c, 'insight').total);
      expect(stats.passiveInvestigation.total).toBe(passiveSkillBreakdown(c, 'investigation').total);
      for (const b of [stats.ac, stats.speed, stats.passivePerception, stats.passiveInsight, stats.passiveInvestigation]) {
        expect(b.components.reduce((s, x) => s + x.value, 0)).toBe(b.total);
      }
      expect(stats.hp).not.toBeNull();
      expect(stats.hp!.current).toBeLessThanOrEqual(stats.hp!.max.total);
    }
  });

  it('adds 10 to the skill modifier for a passive score', () => {
    const c = character(3);
    const b = passiveSkillBreakdown(c, 'insight');
    expect(b.components[0]).toEqual({ label: 'Base', value: 10 });
    expect(b.components.reduce((s, x) => s + x.value, 0)).toBe(b.total);
  });

  it('shows manual numbers as entered, with a source in the breakdown', () => {
    const d = addManualMember(createCampaign(emptyDmData(), { id: 'c', name: 'T', now: NOW }), 'c', {
      id: 'x',
      name: 'Pip',
      stats: { ...DEFAULT_MANUAL_STATS, ac: 15, spellSaveDc: 13, darkvisionFt: 60, conditions: ['Poisoned'] },
      now: NOW,
    });
    const s = memberStats(d.campaigns[0].party[0])!;
    expect(s.ac.total).toBe(15);
    expect(s.ac.components).toEqual([{ label: 'Entered by the DM', value: 15 }]);
    expect(s.spellSaveDc?.total).toBe(13);
    expect(s.darkvision.total).toBe(60);
    expect(s.conditions).toEqual(['Poisoned']);
  });

  it('returns undefined rather than throwing for a damaged stored member', () => {
    expect(memberStats({ id: 'x', name: 'Bad', source: 'imported', addedAt: 0, updatedAt: 0 })).toBeUndefined();
  });
});

describe('party summary', () => {
  it('rounds the average level down and explains it', () => {
    const mk = (id: string, level: number, langs: string[], dv: number) =>
      memberStats({
        id,
        name: id,
        source: 'manual',
        manual: { ...DEFAULT_MANUAL_STATS, level, languages: langs, darkvisionFt: dv },
        addedAt: 0,
        updatedAt: 0,
      })!;
    const s = partySummary([
      mk('A', 3, ['Common', 'Elvish'], 60),
      mk('B', 4, ['Common', 'Dwarvish'], 0),
      mk('C', 4, ['common'], 0),
    ]);
    expect(s.size).toBe(3);
    expect(s.levels.total).toBe(11);
    expect(s.averageLevel).toBe(3);
    expect(s.levels.note).toContain('11 ÷ 3');
    expect(s.withoutDarkvision).toEqual(['B', 'C']);
    expect(s.sharedLanguages).toEqual(['Common']);
    expect(s.allLanguages.map((l) => l.toLowerCase()).sort()).toEqual(['common', 'dwarvish', 'elvish']);
  });

  it('handles an empty party', () => {
    const s = partySummary([]);
    expect(s).toMatchObject({ size: 0, averageLevel: 0, sharedLanguages: [] });
  });
});

describe('sanitising stored and imported data', () => {
  it('survives garbage', () => {
    expect(sanitizeDmData(null)).toEqual(emptyDmData());
    expect(sanitizeDmData('x')).toEqual(emptyDmData());
    expect(sanitizeDmData({ campaigns: 'no' })).toEqual(emptyDmData());
    expect(parseDmData('{not json').ok).toBe(false);
    expect(parseDmData('{"a":1}').ok).toBe(false);
  });

  it('keeps good members, drops broken ones, and fixes the active campaign', () => {
    const c = character(4);
    let d = createCampaign(emptyDmData(), { id: 'c', name: 'T', now: NOW });
    d = addImportedMember(d, 'c', { id: 'm', character: c, now: NOW }).data;
    d = addManualMember(d, 'c', { id: 'x', name: 'Pip', stats: DEFAULT_MANUAL_STATS, now: NOW });
    const raw = JSON.parse(JSON.stringify(d));
    raw.activeCampaignId = 'missing';
    raw.campaigns[0].party.push({ id: 'bad', name: 'Bad', source: 'imported', character: 'nope' });
    raw.campaigns[0].party.push({ id: 'bad2', source: 'weird' });
    const out = sanitizeDmData(raw);
    expect(out.activeCampaignId).toBe('c');
    expect(out.campaigns[0].party.map((m) => m.id)).toEqual(['m', 'x']);
    expect(memberStats(out.campaigns[0].party[0])).toBeDefined();
  });

  it('round-trips through JSON', () => {
    let d = createCampaign(emptyDmData(), { id: 'c', name: 'T', now: NOW });
    d = addImportedMember(d, 'c', { id: 'm', character: character(5), now: NOW }).data;
    const back = parseDmData(JSON.stringify(d));
    expect(back.ok && back.data.campaigns[0].party[0].character?.name).toBe(d.campaigns[0].party[0].character?.name);
  });
});

describe('importing a player character', () => {
  it('finds the code in a link, a bare code, or nothing', () => {
    expect(extractShareCode('https://x.io/app/#view/AbC-_9')).toBe('AbC-_9');
    expect(extractShareCode('  AbC-_9  ')).toBe('AbC-_9');
    expect(extractShareCode('hello world')).toBeNull();
    expect(extractShareCode('')).toBeNull();
  });

  it('reads a share link and an exported file, and reports bad input', async () => {
    const c = character(6);
    const code = await encodeSharePayload(exportToJSON(c));
    const viaLink = await importCharacterFromText(`https://x.io/#view/${code}`);
    expect(viaLink.ok && viaLink.character.name).toBe(c.name);
    const viaCode = await importCharacterFromText(code);
    expect(viaCode.ok).toBe(true);
    const viaFile = await importCharacterFromText(exportToJSON(c));
    expect(viaFile.ok && viaFile.character.level).toBe(c.level);

    for (const bad of ['', 'not a link!', 'AAAA', '{"nope":1}']) {
      const r = await importCharacterFromText(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
    }
  });
});
