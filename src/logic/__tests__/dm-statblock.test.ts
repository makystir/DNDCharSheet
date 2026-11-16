import { describe, it, expect } from 'vitest';
import { MONSTER_MANUAL_2024_LIST } from '../../data/monster-manual-2024';
import { NPC_TEMPLATE_LIST } from '../../data/npc-templates';
import type { DmCombatant, DmCustomMonster, DmEncounter } from '../../types/dm';
import {
  MAX_COMBATANTS,
  addCombatants,
  combatantFromCreature,
  combatantFromMember,
  combatantFromMonsterManual,
  combatantFromTemplate,
  createEncounter,
  customCombatant,
  customIdOfKey,
  duplicateCombatant,
  duplicateEncounter,
  makeCopies,
  ownSnapshot,
  removeCombatant,
  saveEncounter,
  usableCreatures,
} from '../dm-encounter';
import {
  blankCustomMonster,
  builtInMonsters,
  canShowStatBlock,
  combatantFromLibrary,
  fromCustom,
  libraryMonsters,
  matchLegacyLabel,
  resolveCombatantStatBlock,
  saveCustomMonster,
  type LibraryMonster,
} from '../dm-library';
import { sanitizeDmData } from '../dm-sanitize';
import { addManualMember, createCampaign, DEFAULT_MANUAL_STATS, emptyDmData } from '../dm-campaign';

let n = 0;
const nid = () => `id${++n}`;

const custom = (id: string, name = 'Ogre', now = 1): DmCustomMonster => ({
  ...blankCustomMonster(id, now),
  name,
  actions: [{ name: 'Club', description: 'Hits hard.' }],
});

function fromLibrary(m: DmCustomMonster, id: string): DmCombatant {
  const c = combatantFromLibrary(fromCustom(m), id);
  if (!c) throw new Error('not addable');
  return c;
}

const roundTrip = (enc: DmEncounter): DmEncounter => {
  let d = createCampaign(emptyDmData(), { id: 'c', name: 'C', now: 1 });
  d = saveEncounter(d, 'c', enc, 1);
  return sanitizeDmData(JSON.parse(JSON.stringify(d))).campaigns[0].encounters[0];
};

describe('libraryKey on each origin', () => {
  it('matches the LibraryMonster key for one entry of every origin', () => {
    const all = builtInMonsters();
    const npc = NPC_TEMPLATE_LIST[0];
    expect(combatantFromTemplate(npc, 'a').libraryKey).toBe(all.find((m) => m.key === `npc:${npc.id}`)?.key);
    const cr = usableCreatures()[0];
    expect(combatantFromCreature(cr, 'a')?.libraryKey).toBe(all.find((m) => m.key === `creature:${cr.id}`)?.key);
    const mm = MONSTER_MANUAL_2024_LIST[0];
    expect(combatantFromMonsterManual(mm, 'a').libraryKey).toBe(all.find((m) => m.origin === 'monster-manual' && m.name === mm.name)?.key);
    const cm = custom('ogre-1');
    expect(fromLibrary(cm, 'a').libraryKey).toBe(fromCustom(cm).key);
  });

  it('is set to the library key for every Monster Manual 2024 creature', () => {
    const keys = new Set(builtInMonsters().map((m) => m.key));
    for (const e of MONSTER_MANUAL_2024_LIST) {
      const key = combatantFromMonsterManual(e, 'x').libraryKey;
      expect(key && keys.has(key), e.name).toBe(true);
    }
  });

  it('goes through combatantFromLibrary for every built-in', () => {
    for (const m of builtInMonsters().filter((x) => x.addable)) {
      expect(combatantFromLibrary(m, 'x')?.libraryKey, m.key).toBe(m.key);
    }
  });

  it('is absent for party members and Custom-tab combatants', () => {
    expect(customCombatant('a', { name: 'X', ac: 10, hpMax: 5, initiativeMod: 0 }).libraryKey).toBeUndefined();
    let d = createCampaign(emptyDmData(), { id: 'c', name: 'C', now: 1 });
    d = addManualMember(d, 'c', { id: 'm1', name: 'Borin', stats: { ...DEFAULT_MANUAL_STATS }, now: 1 });
    const member = d.campaigns[0].party[0];
    expect(combatantFromMember(member, 'p')?.libraryKey).toBeUndefined();
  });
});

describe('copies keep the link and the snapshots', () => {
  const mm = combatantFromMonsterManual(MONSTER_MANUAL_2024_LIST.find((e) => e.name === 'Goblin Warrior')!, 'g');

  it('makeCopies, duplicateCombatant and duplicateEncounter keep libraryKey', () => {
    const copies = makeCopies(mm, 6, nid, true);
    expect(copies).toHaveLength(6);
    for (const c of copies) expect(c.libraryKey).toBe(mm.libraryKey);
    const enc = addCombatants(createEncounter('e', 'T', 1), [mm]);
    const dup = duplicateCombatant(enc, 'g', nid);
    expect(dup.combatants[1].libraryKey).toBe(mm.libraryKey);
    expect(duplicateEncounter(dup, nid, 2).combatants.every((c) => c.libraryKey === mm.libraryKey)).toBe(true);
  });

  it('duplicateEncounter keeps the snapshots of the custom monsters it uses', () => {
    const ogre = custom('ogre-1');
    const enc = addCombatants(createEncounter('e', 'T', 1), [fromLibrary(ogre, 'a')], [ogre]);
    const copy = duplicateEncounter(enc, nid, 2);
    expect(ownSnapshot(copy.customMonsterSnapshots, 'ogre-1')?.name).toBe('Ogre');
  });
});

describe('addCombatants snapshots', () => {
  it('stores one snapshot for six copies of a custom monster', () => {
    const ogre = custom('ogre-1');
    const base = fromLibrary(ogre, 'a');
    const enc = addCombatants(createEncounter('e', 'T', 1), makeCopies(base, 6, nid, true), [ogre]);
    expect(Object.keys(enc.customMonsterSnapshots ?? {})).toEqual(['ogre-1']);
  });

  it('stores none for built-ins, or when the custom list is omitted', () => {
    const goblin = combatantFromMonsterManual(MONSTER_MANUAL_2024_LIST[0], 'g');
    expect(addCombatants(createEncounter('e', 'T', 1), [goblin]).customMonsterSnapshots).toBeUndefined();
    const ogre = custom('ogre-1');
    expect(addCombatants(createEncounter('e', 'T', 1), [fromLibrary(ogre, 'a')]).customMonsterSnapshots).toBeUndefined();
    expect(addCombatants(createEncounter('e', 'T', 1), [fromLibrary(ogre, 'a')], [custom('other')]).customMonsterSnapshots).toBeUndefined();
  });

  it('stores snapshots only for combatants that fit under the cap', () => {
    const filler = Array.from({ length: MAX_COMBATANTS }, (_, i) => customCombatant(`f${i}`, { name: 'F', ac: 10, hpMax: 5, initiativeMod: 0 }));
    const ogre = custom('ogre-1');
    const full = addCombatants(createEncounter('e', 'T', 1), filler);
    expect(addCombatants(full, [fromLibrary(ogre, 'a')], [ogre])).toBe(full);
    const nearly = addCombatants(createEncounter('e', 'T', 1), filler.slice(0, MAX_COMBATANTS - 1));
    const other = custom('goblin-9', 'Other');
    const result = addCombatants(nearly, [fromLibrary(ogre, 'a'), fromLibrary(other, 'b')], [ogre, other]);
    expect(Object.keys(result.customMonsterSnapshots ?? {})).toEqual(['ogre-1']);
  });

  it('keeps the first snapshot after an edit (first add wins) and reports changed', () => {
    const v1 = custom('ogre-1', 'Ogre', 1);
    let enc = addCombatants(createEncounter('e', 'T', 1), [fromLibrary(v1, 'a')], [v1]);
    const v2 = { ...v1, name: 'Ogre', ac: 20, updatedAt: 2 };
    enc = addCombatants(enc, [fromLibrary(v2, 'b')], [v2]);
    expect(ownSnapshot(enc.customMonsterSnapshots, 'ogre-1')?.ac).toBe(v1.ac);
    expect(enc.combatants[1].ac).toBe(20);
    const r = resolveCombatantStatBlock(enc.combatants[1], enc, [v2]);
    expect(r?.monster.ac).toBe(v1.ac);
    expect(r?.customStatus).toBe('changed');
  });

  it('takes a deep copy', () => {
    const ogre = custom('ogre-1');
    const enc = addCombatants(createEncounter('e', 'T', 1), [fromLibrary(ogre, 'a')], [ogre]);
    ogre.actions[0].description = 'Changed later.';
    ogre.actions.push({ name: 'New', description: 'x' });
    const snap = ownSnapshot(enc.customMonsterSnapshots, 'ogre-1');
    expect(snap?.actions).toEqual([{ name: 'Club', description: 'Hits hard.' }]);
  });

  it('removing the last user of a snapshot prunes it', () => {
    const ogre = custom('ogre-1');
    const [a, b] = makeCopies(fromLibrary(ogre, 'x'), 2, nid, false);
    let enc = addCombatants(createEncounter('e', 'T', 1), [a, b], [ogre]);
    enc = removeCombatant(enc, a.id);
    expect(ownSnapshot(enc.customMonsterSnapshots, 'ogre-1')).toBeDefined();
    enc = removeCombatant(enc, b.id);
    expect(enc.customMonsterSnapshots).toBeUndefined();
  });
});

describe('own-property snapshot reads (adversarial ids)', () => {
  for (const id of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    it(`handles the custom monster id ${id}`, () => {
      const m = custom(id, 'Weird');
      const c = fromLibrary(m, 'a');
      expect(customIdOfKey(c.libraryKey)).toBe(id);
      const enc = addCombatants(createEncounter('e', 'T', 1), [c], [m]);
      expect(ownSnapshot(enc.customMonsterSnapshots, id)?.name).toBe('Weird');
      const resolved = resolveCombatantStatBlock(enc.combatants[0], enc, []);
      expect(resolved?.monster.name).toBe('Weird');
      expect(resolved?.customStatus).toBe('deleted');
      // The sanitizer keeps the snapshot and its combatant on a round trip.
      const back = roundTrip(enc);
      expect(ownSnapshot(back.customMonsterSnapshots, id)?.name).toBe('Weird');
      expect(back.combatants[0].libraryKey).toBe(`custom:${id}`);
      expect(({} as Record<string, unknown>).name).toBeUndefined();
      expect(Object.keys(Object.prototype)).toEqual([]);
    });

    it(`returns undefined without throwing for ${id} with no snapshot and no live monster`, () => {
      const c = fromLibrary(custom(id), 'a');
      const enc = addCombatants(createEncounter('e', 'T', 1), [c]);
      expect(ownSnapshot(enc.customMonsterSnapshots, id)).toBeUndefined();
      expect(resolveCombatantStatBlock(enc.combatants[0], enc, [])).toBeUndefined();
    });
  }

  it('does not treat inherited properties as snapshots', () => {
    expect(ownSnapshot({}, 'constructor')).toBeUndefined();
    expect(ownSnapshot({}, '__proto__')).toBeUndefined();
    expect(ownSnapshot(undefined, 'x')).toBeUndefined();
  });
});

describe('resolveCombatantStatBlock', () => {
  const none = { customMonsterSnapshots: undefined };

  it('prefers the snapshot over an edited live monster, and reports same / changed / deleted', () => {
    const v1 = custom('o', 'Ogre', 1);
    const enc = addCombatants(createEncounter('e', 'T', 1), [fromLibrary(v1, 'a')], [v1]);
    const c = enc.combatants[0];
    expect(resolveCombatantStatBlock(c, enc, [v1])?.customStatus).toBe('same');
    const edited = { ...v1, name: 'Big Ogre', updatedAt: 5 };
    const changed = resolveCombatantStatBlock(c, enc, [edited]);
    expect(changed?.customStatus).toBe('changed');
    expect(changed?.monster.name).toBe('Ogre');
    const deleted = resolveCombatantStatBlock(c, enc, []);
    expect(deleted?.customStatus).toBe('deleted');
    expect(deleted?.monster.name).toBe('Ogre');
  });

  it('uses the live custom monster only when there is no snapshot', () => {
    const live = custom('o');
    const c = fromLibrary(live, 'a');
    const r = resolveCombatantStatBlock(c, none, [live]);
    expect(r?.customStatus).toBe('no-snapshot');
    expect(r?.monster.key).toBe('custom:o');
    expect(resolveCombatantStatBlock(c, none, [])).toBeUndefined();
  });

  it('finds built-ins by key, and a miss resolves to nothing', () => {
    const c = combatantFromMonsterManual(MONSTER_MANUAL_2024_LIST.find((e) => e.name === 'Goblin Warrior')!, 'a');
    expect(resolveCombatantStatBlock(c, none, [])?.monster.name).toBe('Goblin Warrior');
    expect(resolveCombatantStatBlock({ ...c, libraryKey: 'monster-manual:No Such Beast' }, none, [])).toBeUndefined();
    expect(resolveCombatantStatBlock({ ...c, libraryKey: 'npc:constructor' }, none, [])).toBeUndefined();
  });

  it('matches a legacy label for each built-in origin', () => {
    const legacy = (c: DmCombatant | undefined): DmCombatant => {
      const { libraryKey: _k, ...rest } = c as DmCombatant;
      void _k;
      return rest;
    };
    const npc = legacy(combatantFromTemplate(NPC_TEMPLATE_LIST[0], 'a'));
    expect(resolveCombatantStatBlock(npc, none, [])?.monster.key.startsWith('monster-manual:')).toBe(true);
    const mm = legacy(combatantFromMonsterManual(MONSTER_MANUAL_2024_LIST.find((e) => e.name === 'Goblin Warrior')!, 'a'));
    expect(resolveCombatantStatBlock(mm, none, [])?.monster.key).toBe('monster-manual:Goblin Warrior');
    const cr = usableCreatures().find((x) => !builtInMonsters().some((m) => m.origin === 'monster-manual' && `${m.name} (${m.source})` === `${x.name} (${x.source.book}, p.${x.source.printedPage})`));
    if (cr) {
      const c = legacy(combatantFromCreature(cr, 'a'));
      expect(resolveCombatantStatBlock(c, none, [])?.monster.key).toBe(`creature:${cr.id}`);
    }
  });

  it('resolves nothing for legacy custom, Custom-tab and pc combatants', () => {
    const legacyCustom = { ...fromLibrary(custom('o', 'Goblin'), 'a'), libraryKey: undefined };
    expect(resolveCombatantStatBlock(legacyCustom, none, [])).toBeUndefined();
    const tab = customCombatant('t', { name: 'X', ac: 10, hpMax: 5, initiativeMod: 0 });
    expect(canShowStatBlock(tab)).toBe(false);
    expect(resolveCombatantStatBlock(tab, none, [])).toBeUndefined();
    const pc: DmCombatant = { ...tab, kind: 'pc', sourceLabel: 'Party member' };
    expect(canShowStatBlock(pc)).toBe(false);
    expect(resolveCombatantStatBlock(pc, none, [])).toBeUndefined();
  });
});

describe('matchLegacyLabel with synthetic lists', () => {
  const mk = (key: string, name: string, source: string): LibraryMonster => ({ ...builtInMonsters()[0], key, name, source });
  const label = 'Bandit (Monster Manual 2024, p.27)';

  it('returns the unique match, or nothing', () => {
    const list = [mk('creature:a', 'Bandit', 'Monster Manual 2024, p.27'), mk('creature:b', 'Other', 'X')];
    expect(matchLegacyLabel(label, list)?.key).toBe('creature:a');
    expect(matchLegacyLabel('Nothing (X)', list)).toBeUndefined();
  });

  it('resolves same name and source twins to the monster-manual entry', () => {
    const list = [
      mk('npc:bandit', 'Bandit', 'Monster Manual 2024, p.27'),
      mk('monster-manual:Bandit', 'Bandit', 'Monster Manual 2024, p.27'),
    ];
    expect(matchLegacyLabel(label, list)?.key).toBe('monster-manual:Bandit');
  });

  it('returns nothing for ambiguous matches', () => {
    expect(
      matchLegacyLabel('A (S)', [mk('monster-manual:A', 'A', 'S'), mk('monster-manual:A2', 'A', 'S')]),
    ).toBeUndefined();
    expect(matchLegacyLabel('A (S)', [mk('npc:x', 'A', 'S'), mk('creature:y', 'A', 'S')])).toBeUndefined();
  });
});

describe('legacy label sweep over the real built-ins', () => {
  const all = builtInMonsters();
  const labelOf = (m: LibraryMonster) => `${m.name} (${m.source})`;

  it('resolves every built-in label to a creature with the same name and source', () => {
    for (const b of all) {
      const hit = matchLegacyLabel(labelOf(b), all);
      expect(hit, labelOf(b)).toBeDefined();
      expect(hit?.name).toBe(b.name);
      expect(hit?.source).toBe(b.source);
    }
  });

  it('resolves every NPC template label to a monster-manual entry', () => {
    let twins = 0;
    for (const t of NPC_TEMPLATE_LIST) {
      const c = combatantFromTemplate(t, 'x');
      const hit = matchLegacyLabel(c.sourceLabel, all);
      expect(hit?.key.startsWith('monster-manual:'), t.name).toBe(true);
      twins++;
    }
    expect(twins).toBe(NPC_TEMPLATE_LIST.length);
  });

  // Known data discrepancies, NOT fixed here (the data edit needs separate user approval; see the stat-block design,
  // section 5). The design expected only the Frog; the sweep found these five creature/monster-manual twins whose AC
  // or average HP differ (src/data/creatures.ts vs src/data/monsters.json). A new disagreement fails this test, and
  // fixing the data also fails it, which prompts removal from the list.
  const KNOWN_TWIN_DISAGREEMENTS = [
    'Frog (Monster Manual 2024, p.354)',
    'Panther (Monster Manual 2024, p.366)',
    'Tiger (Monster Manual 2024, p.371)',
    'Warhorse (Monster Manual 2024, p.373)',
    'Wolf (Monster Manual 2024, p.373)',
  ];

  it('pins the creature/monster-manual twins whose AC or HP disagree', () => {
    const byLabel = new Map<string, LibraryMonster[]>();
    for (const m of all) byLabel.set(labelOf(m), [...(byLabel.get(labelOf(m)) ?? []), m]);
    const disagree: string[] = [];
    let twinCount = 0;
    for (const [label, list] of byLabel) {
      const cr = list.find((m) => m.origin === 'creature');
      const mm = list.find((m) => m.origin === 'monster-manual');
      if (!cr || !mm) continue;
      twinCount++;
      if (cr.ac !== mm.ac || cr.hpAverage !== mm.hpAverage) disagree.push(label);
    }
    // 43 creature: entries share a label with a monster-manual: entry (design, Testing).
    expect(twinCount).toBe(43);
    expect(disagree.sort()).toEqual([...KNOWN_TWIN_DISAGREEMENTS].sort());
  });

  it('libraryMonsters includes custom ones for the resolver key space', () => {
    const data = saveCustomMonster(emptyDmData(), custom('o'), 1);
    expect(libraryMonsters(data).some((m) => m.key === 'custom:o')).toBe(true);
  });
});

describe('sanitizer', () => {
  const baseEnc = () => {
    const ogre = custom('ogre-1');
    return addCombatants(createEncounter('e', 'T', 1), makeCopies(fromLibrary(ogre, 'a'), 2, nid, true), [ogre]);
  };
  const withKey = (key: unknown): DmEncounter => {
    const enc = baseEnc();
    const raw = JSON.parse(JSON.stringify(enc));
    raw.combatants[0].libraryKey = key;
    return roundTripRaw(raw);
  };
  function roundTripRaw(rawEnc: unknown): DmEncounter {
    const d = createCampaign(emptyDmData(), { id: 'c', name: 'C', now: 1 });
    const raw = JSON.parse(JSON.stringify(d));
    raw.campaigns[0].encounters = [rawEnc];
    return sanitizeDmData(raw).campaigns[0].encounters[0];
  }

  it('round-trips key and snapshots', () => {
    const enc = baseEnc();
    const back = roundTrip(enc);
    expect(back.combatants.map((c) => c.libraryKey)).toEqual(['custom:ogre-1', 'custom:ogre-1']);
    expect(back.customMonsterSnapshots).toEqual(enc.customMonsterSnapshots);
  });

  it('old saves without either field load unchanged', () => {
    const goblin = combatantFromMonsterManual(MONSTER_MANUAL_2024_LIST.find((e) => e.name === 'Goblin Warrior')!, 'g');
    const enc = addCombatants(createEncounter('e', 'T', 1), [goblin]);
    const raw = JSON.parse(JSON.stringify(enc));
    delete raw.combatants[0].libraryKey;
    const back = roundTripRaw(raw);
    expect(back.combatants[0].libraryKey).toBeUndefined();
    expect('libraryKey' in back.combatants[0]).toBe(false);
    expect(back.customMonsterSnapshots).toBeUndefined();
    expect('customMonsterSnapshots' in back).toBe(false);
    const { libraryKey: _k, ...before } = goblin;
    void _k;
    expect(back.combatants[0]).toEqual(before);
  });

  it('drops bad keys and keeps a 120-character key whole', () => {
    for (const bad of [5, null, 'bogus:x', 'custom:', 'npc:', ' ', 'custom: x', `npc:${'x'.repeat(117)}`]) {
      expect(withKey(bad).combatants[0].libraryKey, String(bad)).toBeUndefined();
    }
    const ok = `monster-manual:${'x'.repeat(120 - 'monster-manual:'.length)}`;
    expect(ok).toHaveLength(120);
    expect(withKey(ok).combatants[0].libraryKey).toBe(ok);
    expect(withKey('monster-manual:Ancient Red Dragon').combatants[0].libraryKey).toBe('monster-manual:Ancient Red Dragon');
  });

  it('drops orphan and non-monster snapshots', () => {
    const raw = JSON.parse(JSON.stringify(baseEnc()));
    raw.customMonsterSnapshots.orphan = { ...raw.customMonsterSnapshots['ogre-1'], id: 'orphan' };
    raw.customMonsterSnapshots.junk = 5;
    raw.customMonsterSnapshots.noid = { name: 'x' };
    const back = roundTripRaw(raw);
    expect(Object.keys(back.customMonsterSnapshots ?? {})).toEqual(['ogre-1']);
  });

  it('drops snapshots when no combatant uses them', () => {
    const raw = JSON.parse(JSON.stringify(baseEnc()));
    raw.combatants.forEach((c: { libraryKey?: string }) => delete c.libraryKey);
    expect(roundTripRaw(raw).customMonsterSnapshots).toBeUndefined();
  });

  it('keeps at most 60 snapshots', () => {
    const raw = JSON.parse(JSON.stringify(createEncounter('e', 'T', 1)));
    raw.combatants = Array.from({ length: 70 }, (_, i) => ({ ...JSON.parse(JSON.stringify(customCombatant(`c${i}`, { name: 'X', ac: 10, hpMax: 5, initiativeMod: 0 }))), libraryKey: `custom:m${i}` }));
    raw.customMonsterSnapshots = Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`m${i}`, JSON.parse(JSON.stringify(custom(`m${i}`)))]));
    const back = roundTripRaw(raw);
    expect(back.combatants).toHaveLength(MAX_COMBATANTS);
    expect(Object.keys(back.customMonsterSnapshots ?? {}).length).toBeLessThanOrEqual(MAX_COMBATANTS);
  });

  it('does not pollute Object.prototype with a __proto__ snapshot id', () => {
    const raw = JSON.parse(JSON.stringify(baseEnc()));
    raw.combatants[0].libraryKey = 'custom:__proto__';
    raw.customMonsterSnapshots = JSON.parse(`{"__proto__":${JSON.stringify(custom('__proto__', 'Evil'))}}`);
    const back = roundTripRaw(raw);
    expect(ownSnapshot(back.customMonsterSnapshots, '__proto__')?.name).toBe('Evil');
    expect(({} as { name?: string }).name).toBeUndefined();
    expect(Object.getPrototypeOf(back.customMonsterSnapshots)).toBe(Object.prototype);
  });
});
