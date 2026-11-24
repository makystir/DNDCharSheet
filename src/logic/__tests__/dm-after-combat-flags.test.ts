import { describe, it, expect } from 'vitest';
import { addCombatants, combatSummaryText, createEncounter, customCombatant, markAfterCombat, saveEncounter } from '../dm-encounter';
import { appendToLatestSession } from '../dm-journal';
import { createCampaign, emptyDmData } from '../dm-campaign';
import { parseDmData } from '../dm-sanitize';

const base = () => {
  const e = addCombatants(createEncounter('e', 'Ambush', 1), [customCombatant('o', { name: 'Orc', ac: 12, hpMax: 5, initiativeMod: 0 })]);
  return { ...e, status: 'ended' as const, round: 3, log: Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`) };
};

describe('combat summary text', () => {
  it('keeps the whole log by default', () => {
    expect(combatSummaryText(base())).toContain('- Line 1\n');
  });
  it('keeps only the last lines and says how many exist when asked', () => {
    const text = combatSummaryText(base(), { maxLogLines: 5 });
    expect(text).toContain('last 5 of 30 lines');
    expect(text).toContain('- Line 30');
    expect(text).toContain('- Line 26');
    expect(text).not.toContain('- Line 25');
    expect(text).toContain('Combat: Ambush');
  });
});

describe('after-combat checklist flags', () => {
  const seed = () => saveEncounter(createCampaign(emptyDmData(), { id: 'c', name: 'T', now: 1 }), 'c', base(), 2);
  it('marks steps on the saved encounter and leaves the others alone', () => {
    const d = markAfterCombat(seed(), 'c', 'e', { awardMade: true, xpSharers: 4 }, 9);
    const e = d.campaigns[0].encounters[0];
    expect(e).toMatchObject({ awardMade: true, xpSharers: 4, updatedAt: 9 });
    expect(e.treasureRolled).toBeUndefined();
  });
  it('ignores an unknown encounter', () => {
    const d = seed();
    expect(markAfterCombat(d, 'c', 'nope', { awardMade: true }, 9)).toEqual(d);
  });
  it('keeps the flags through a save and load, and treats older saves as not done', () => {
    const marked = markAfterCombat(seed(), 'c', 'e', { treasureRolled: true, summaryAdded: true, summaryNoteId: 'n1', summaryNoteTitle: 'Session 2', partyUpdated: true, xpSharers: 3 }, 9);
    const back = parseDmData(JSON.stringify(marked));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.data.campaigns[0].encounters[0]).toMatchObject({ treasureRolled: true, summaryAdded: true, summaryNoteId: 'n1', summaryNoteTitle: 'Session 2', partyUpdated: true, xpSharers: 3 });
    const old = parseDmData(JSON.stringify(seed()));
    expect(old.ok).toBe(true);
    if (!old.ok) return;
    const e = old.data.campaigns[0].encounters[0];
    expect([e.awardMade, e.treasureRolled, e.summaryAdded, e.partyUpdated, e.xpSharers]).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });
  it('rejects a bad sharer count', () => {
    const d = markAfterCombat(seed(), 'c', 'e', { xpSharers: 0 }, 9);
    const back = parseDmData(JSON.stringify(d));
    expect(back.ok && back.data.campaigns[0].encounters[0].xpSharers).toBeFalsy();
  });
});

describe('appendToLatestSession', () => {
  it('returns the id of the note that was written to', () => {
    const d = createCampaign(emptyDmData(), { id: 'c', name: 'T', now: 1 });
    const first = appendToLatestSession(d, 'c', 'one', 'n1', 2);
    expect(first).toMatchObject({ created: true, noteId: 'n1' });
    const second = appendToLatestSession(first.data, 'c', 'two', 'n2', 3);
    expect(second).toMatchObject({ created: false, noteId: 'n1' });
  });
});
