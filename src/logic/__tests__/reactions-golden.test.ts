import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, ClassSpellcasting } from '../../types/character';
import { CLASS_CATALOG } from '../../data/classes';
import type { ClassData, ClassId } from '../../data/classes';
import { SPELL_CATALOG } from '../../data/spells';
import type { SpellId } from '../../data/spells';
import { effectiveSpellSlots, pactMagicSlotsForClass } from '../spellcasting';
import { availableReactions } from '../reactions';
import { REACTION_CATALOG_ORACLE, REACTION_SCENARIOS } from './reactions-golden';
import type { ReactionScenario } from './reactions-golden';

/** Maps a golden scenario onto a real Character. */
function buildCharacter(s: ReactionScenario): Character {
  const base = createCharacter('Golden');
  const classes = s.classes.map((c) => ({ id: c.id as ClassId, level: c.level }));
  const character: Character = {
    ...base,
    classes,
    level: Math.max(1, classes.reduce((sum, c) => sum + c.level, 0)),
  };

  // Spell selections live under byClass[classId]. Reaction spells go to the
  // first class (a Wizard also keeps its spellbook = prepared + spellbookOnly).
  const first = classes[0];
  if (first && (s.prepared || s.spellbookOnly)) {
    const prepared = s.prepared ?? [];
    const perClass: ClassSpellcasting = { prepared: prepared as SpellId[] };
    if (first.id === 'wizard') {
      perClass.spellbook = [...prepared, ...(s.spellbookOnly ?? [])] as SpellId[];
    }
    character.spellcasting = { byClass: { [first.id]: perClass } };
  }

  // Slots: golden gives UNEXPENDED counts; the app stores EXPENDED counts.
  if (s.slotsAvailable) {
    const max = effectiveSpellSlots(character);
    const expended: Partial<Record<number, number>> = {};
    for (const [key, available] of Object.entries(s.slotsAvailable)) {
      const level = Number(key);
      expended[level] = Math.max(0, (max?.[level] ?? 0) - available);
    }
    character.spellcasting = { ...character.spellcasting, slotsExpended: expended };
  }
  if (s.pact) {
    const pactMax = pactMagicSlotsForClass(character);
    expect(pactMax?.slotLevel).toBe(s.pact.slotLevel);
    character.spellcasting = {
      ...character.spellcasting,
      pactSlotsExpended: Math.max(0, (pactMax?.slots ?? 0) - s.pact.available),
    };
  }

  if (s.conditions) {
    character.conditions = s.conditions.map((id) => ({ id })) as Character['conditions'];
  }
  if (s.currentHp !== undefined) {
    character.hpMax = 30;
    character.currentHp = s.currentHp;
  }
  if (s.reactionUsed) {
    character.combat = {
      inCombat: true,
      round: 1,
      combatants: [],
      activeIndex: 0,
      turn: {
        actionUsed: false,
        bonusUsed: false,
        reactionUsed: true,
        objectInteractionUsed: false,
        movementUsed: 0,
        dashes: 0,
      },
    };
  }
  return character;
}

describe('availableReactions: golden scenarios', () => {
  it.each(REACTION_SCENARIOS.map((s) => [s.name, s] as const))('%s', (_name, scenario) => {
    const actual = availableReactions(buildCharacter(scenario));
    // Opportunity Attack is always first.
    expect(actual[0].name).toBe('Opportunity Attack');
    const project = (list: { name: string; kind: string; unavailable?: string }[]) =>
      Object.fromEntries(list.map((e) => [e.name, { kind: e.kind, unavailable: e.unavailable }]));
    expect(actual).toHaveLength(scenario.expected.length);
    expect(project(actual)).toEqual(project(scenario.expected));
  });
});

describe('reaction catalog oracle', () => {
  const classes = Object.values(CLASS_CATALOG) as ClassData[];

  it('tags exactly the oracle class features as reactions', () => {
    const tagged = classes.flatMap((c) =>
      c.features
        .filter((f) => f.mechanics?.activation === 'reaction')
        .map((f) => ({ classId: c.id, name: f.name, level: f.level })),
    );
    const sort = (l: { classId: string; name: string }[]) =>
      [...l].sort((a, b) => `${a.classId}${a.name}`.localeCompare(`${b.classId}${b.name}`));
    expect(sort(tagged)).toEqual(sort(REACTION_CATALOG_ORACLE.classFeatures));
  });

  it.each(REACTION_CATALOG_ORACLE.notReactionFeatures.map((f) => [f.name, f] as const))(
    'does not tag %s as a reaction',
    (_name, { classId, name }) => {
      const feature = (CLASS_CATALOG as Record<string, ClassData>)[classId].features.find(
        (f) => f.name === name,
      );
      expect(feature).toBeDefined();
      expect(feature?.mechanics?.activation).toBeUndefined();
    },
  );

  it('has exactly the oracle reaction-cast spells', () => {
    const reactionSpells = SPELL_CATALOG.filter((s) => s.castingTime.startsWith('Reaction')).map(
      (s) => ({ id: s.id, name: s.name, level: s.level }),
    );
    const sort = (l: { id: string }[]) => [...l].sort((a, b) => a.id.localeCompare(b.id));
    expect(sort(reactionSpells)).toEqual(sort(REACTION_CATALOG_ORACLE.spells));
  });
});
