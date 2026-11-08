import { describe, it, expect } from 'vitest';
import { createCharacter } from '../../storage/character-store';
import type { Character, ClassChoices, ClassSpellcasting } from '../../types/character';
import { CLASS_CATALOG } from '../../data/classes';
import type { ClassData, ClassId, SubclassId } from '../../data/classes';
import { SPELL_CATALOG } from '../../data/spells';
import type { SpellId } from '../../data/spells';
import { effectiveSpellSlots, pactMagicSlotsForClass } from '../spellcasting';
import { availableReactions } from '../reactions';
import { FEAT_CATALOG, getFeat } from '../../data/feats';
import type { FeatId } from '../../data/feats';
import { getSpecies } from '../../data/species';
import type { GiantAncestryId, SpeciesId } from '../../data/species';
import { getInvocation } from '../../data/invocations';
import { MANEUVER_LIST } from '../../data/maneuvers';
import { ALL_REACTION_SCENARIOS, REACTION_CATALOG_ORACLE, SUBCLASS_REACTIONS } from './reactions-golden';
import type { ReactionScenario } from './reactions-golden';

/** Maps a golden scenario onto a real Character. */
function buildCharacter(s: ReactionScenario): Character {
  const base = createCharacter('Golden');
  const classes = s.classes.map((c) => ({
    id: c.id as ClassId,
    level: c.level,
    ...(c.subclass ? { subclassId: c.subclass as SubclassId } : {}),
  }));
  const character: Character = {
    ...base,
    classes,
    level: Math.max(1, classes.reduce((sum, c) => sum + c.level, 0)),
  };
  if (s.feats) {
    character.advancement = { feats: s.feats.map((featId) => ({ featId: featId as FeatId, level: 0 })) };
  }
  if (s.species) {
    character.species = {
      id: s.species.id as SpeciesId,
      ...(s.species.giantAncestry ? { giantAncestry: s.species.giantAncestry as GiantAncestryId } : {}),
    };
  }
  if (s.classChoices) character.classChoices = s.classChoices as ClassChoices;
  if (s.resourcesSpent) character.resourcesSpent = s.resourcesSpent;

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
  it.each(ALL_REACTION_SCENARIOS.map((s) => [s.name, s] as const))('%s', (_name, scenario) => {
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

  it('tags exactly the oracle subclass features as reactions (by subclass)', () => {
    const tagged = classes.flatMap((c) =>
      c.subclasses.flatMap((sub) =>
        sub.features
          .filter((f) => f.mechanics?.activation === 'reaction')
          .map((f) => `${c.id}/${sub.id}/${f.level}/${f.name}`),
      ),
    );
    const expected = SUBCLASS_REACTIONS.map((s) => `${s.classId}/${s.subclass}/${s.level}/${s.featureName ?? s.name}`);
    expect([...tagged].sort()).toEqual([...expected].sort());
  });

  it.each(REACTION_CATALOG_ORACLE.notReactionSubclassFeatures.map((f) => [`${f.subclass}: ${f.name}`, f] as const))(
    'does not tag %s as a reaction',
    (_label, { classId, subclass, name }) => {
      const sub = (CLASS_CATALOG as Record<string, ClassData>)[classId].subclasses.find((s) => s.id === subclass);
      const feature = sub?.features.find((f) => f.name === name);
      expect(feature).toBeDefined();
      expect(feature?.mechanics?.activation).toBeUndefined();
    },
  );

  it('tags exactly the oracle feats with reactions', () => {
    const tagged = Object.values(FEAT_CATALOG)
      .filter((f) => f.reactions && f.reactions.length > 0)
      .map((f) => ({ id: f.id, reactions: (f.reactions ?? []).map((r) => r.name) }));
    const sort = (l: { id: string }[]) => [...l].sort((a, b) => a.id.localeCompare(b.id));
    expect(sort(tagged)).toEqual(sort(REACTION_CATALOG_ORACLE.feats));
  });

  it.each(REACTION_CATALOG_ORACLE.notReactionFeats.map((id) => [id] as const))('feat %s carries no reaction tag', (id) => {
    const feat = getFeat(id);
    expect(feat).toBeDefined();
    expect(feat?.reactions).toBeUndefined();
  });

  it('tags exactly the oracle species options with reactions', () => {
    const tagged = ['goliath'].flatMap((speciesId) =>
      (getSpecies(speciesId)?.choices ?? []).flatMap((spec) =>
        spec.options.filter((o) => o.reaction).map((o) => ({ speciesId, optionId: o.id, name: o.reaction?.name ?? '' })),
      ),
    );
    expect(tagged).toEqual(REACTION_CATALOG_ORACLE.speciesOptions);
  });

  it('has exactly the oracle reaction maneuvers and invocations', () => {
    expect(MANEUVER_LIST.filter((m) => m.trigger === 'reaction').map((m) => m.id).sort()).toEqual([...REACTION_CATALOG_ORACLE.maneuvers].sort());
    for (const { id, name } of REACTION_CATALOG_ORACLE.invocations) {
      expect(getInvocation(id)?.reaction?.name).toBe(name);
    }
  });

  it('has exactly the oracle reaction-cast spells', () => {
    const reactionSpells = SPELL_CATALOG.filter((s) => s.castingTime.startsWith('Reaction')).map(
      (s) => ({ id: s.id, name: s.name, level: s.level }),
    );
    const sort = (l: { id: string }[]) => [...l].sort((a, b) => a.id.localeCompare(b.id));
    expect(sort(reactionSpells)).toEqual(sort(REACTION_CATALOG_ORACLE.spells));
  });
});
