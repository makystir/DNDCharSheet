import { describe, it, expect } from 'vitest';
import type { DmCombatant, DmEncounter } from '../../types/dm';
import { createEncounter, combatSummaryText } from '../dm-encounter';
import { appendToLatestSession, newNote, saveNote, SESSION_TEMPLATE } from '../dm-journal';
import { createCampaign, emptyDmData } from '../dm-campaign';
import { encounterTreasureSource } from '../dm-treasure';
import { saveNpcToJournal, generateNpc } from '../dm-generators';
import { createDefaultRng } from '../random';

const mon = (id: string, over: Partial<DmCombatant> = {}): DmCombatant =>
  ({
    id,
    name: id,
    kind: 'monster',
    sourceLabel: 'test',
    ac: 10,
    hp: { hp: 0, max: 5, temp: 0, dead: true, stable: false, deathSaves: { successes: 0, failures: 0 } },
    initiative: 10,
    initiativeMod: 0,
    surprised: false,
    resistances: '',
    vulnerabilities: '',
    immunities: '',
    conditions: [],
    concentration: { active: false, label: '' },
    concentrationDcs: [],
    diesLikeCharacter: false,
    notes: '',
    ...over,
  }) as DmCombatant;

const enc = (combatants: DmCombatant[], log: string[] = []): DmEncounter => ({
  ...createEncounter('e', 'Ambush', 1),
  status: 'ended',
  round: 3,
  combatants,
  log,
});

describe('encounterTreasureSource', () => {
  it('groups counted monsters by CR, lowest first, using the XP-award test', () => {
    const e = enc([
      mon('a', { cr: '2' }),
      mon('b', { cr: '1/4' }),
      mon('c', { cr: '1/4' }),
      mon('d', { cr: '5', xpCounts: false }), // ticked off: not overcome
      mon('f', { cr: '5', xpCounts: true, hp: { ...mon('x').hp, dead: false, hp: 5 } }), // routed, ticked on
      mon('g', { cr: '9', hp: { ...mon('x').hp, dead: false, hp: 5 } }), // still standing, not ticked
    ]);
    expect(encounterTreasureSource(e)).toEqual({
      groups: [
        { cr: '1/4', count: 2 },
        { cr: '2', count: 1 },
        { cr: '5', count: 1 },
      ],
      skipped: 0,
    });
  });

  it('skips counted monsters without a usable CR and ignores party members', () => {
    const e = enc([mon('a'), mon('b', { cr: '99' }), mon('c', { cr: '1' }), mon('pc', { kind: 'pc', cr: '3' })]);
    expect(encounterTreasureSource(e)).toEqual({ groups: [{ cr: '1', count: 1 }], skipped: 2 });
  });
});

describe('combatSummaryText', () => {
  it('names the fight, who stood and who fell, then the log in order', () => {
    const alive = mon('Borin', { kind: 'pc', hp: { ...mon('x').hp, dead: false, hp: 3 } });
    const text = combatSummaryText(enc([alive, mon('Goblin')], ['Round 1.', 'Borin hits Goblin.']));
    expect(text).toBe(
      ['Combat: Ambush (3 rounds).', 'Still standing: Borin.', 'Down for good: Goblin.', '', 'Combat log:', '- Round 1.', '- Borin hits Goblin.'].join('\n'),
    );
  });

  it('leaves out the log section when the log is empty', () => {
    expect(combatSummaryText(enc([mon('Goblin')]))).toBe('Combat: Ambush (3 rounds).\nStill standing: nobody.\nDown for good: Goblin.');
  });
});

describe('appendToLatestSession', () => {
  const start = () => createCampaign(emptyDmData(), { id: 'c', name: 'C', now: 1 });
  const journalOf = (d: ReturnType<typeof start>) => d.campaigns[0].journal;

  it('starts a session entry from the template when there is none', () => {
    const r = appendToLatestSession(start(), 'c', 'Fight.', 'n1', 5);
    expect(r.created).toBe(true);
    expect(r.title).toBe('Session 1');
    const note = journalOf(r.data)[0];
    expect(note.kind).toBe('session');
    expect(note.sessionNumber).toBe(1);
    expect(note.body.startsWith(SESSION_TEMPLATE.trimEnd())).toBe(true);
    expect(note.body).toContain('Fight.');
  });

  it('appends to the highest-numbered session and leaves other entries alone', () => {
    let d = start();
    d = saveNote(d, 'c', { ...newNote([], { id: 's1', kind: 'session', now: 1 }), body: 'one' }, 1);
    d = saveNote(d, 'c', { ...newNote(journalOf(d), { id: 's2', kind: 'session', now: 2 }), body: 'two' }, 2);
    d = saveNote(d, 'c', { ...newNote(journalOf(d), { id: 'n', kind: 'note', now: 9 }), body: 'other' }, 9);
    const r = appendToLatestSession(d, 'c', 'Fight.', 'unused', 10);
    expect(r.created).toBe(false);
    expect(r.title).toBe('Session 2');
    const byId = Object.fromEntries(journalOf(r.data).map((n) => [n.id, n.body]));
    expect(byId.s2).toBe('two\n\nFight.\n');
    expect(byId.s1).toBe('one');
    expect(byId.n).toBe('other');
    expect(journalOf(r.data)).toHaveLength(3);
  });
});

describe('saveNpcToJournal with a stat block', () => {
  it('names the chosen stat block in plain text and adds nothing when none is chosen', () => {
    const npc = generateNpc(createDefaultRng(), {});
    const d = createCampaign(emptyDmData(), { id: 'c', name: 'C', now: 1 });
    const withBlock = saveNpcToJournal(d, 'c', npc, { npc: 'n1' }, 2, { name: 'Veteran', source: 'Monster Manual 2024, p.1' });
    expect(withBlock.data.campaigns[0].journal[0].body).toContain('Stat block: Veteran (Monster Manual 2024, p.1), in the Library.');
    const without = saveNpcToJournal(d, 'c', npc, { npc: 'n2' }, 2);
    expect(without.data.campaigns[0].journal[0].body).not.toContain('Stat block');
  });
});
