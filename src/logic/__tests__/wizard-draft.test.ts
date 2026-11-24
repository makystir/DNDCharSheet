import { describe, it, expect } from 'vitest';
import {
  WIZARD_DRAFT_KEY,
  clearWizardDraft,
  draftHasProgress,
  isWizardDraft,
  loadWizardDraft,
  resolveDraftStep,
  saveWizardDraft,
  type WizardDraft,
} from '../wizard-draft';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

const draft = (overrides: Partial<WizardDraft> = {}): WizardDraft => ({
  v: 1,
  savedAt: 1700000000000,
  step: 2,
  furthest: 3,
  name: 'Tess',
  classId: 'fighter',
  backgroundId: 'soldier',
  allocation: { str: 2, dex: 1 },
  speciesId: 'dwarf',
  speciesChoices: {},
  chosenLanguages: ['dwarvish', 'giant'],
  grantedLanguages: [],
  toolProficiency: 'Dice Set',
  skillChoices: ['athletics'],
  spellPicks: {},
  abilityMethod: 'standard-array',
  arrayAssignment: { str: 0, dex: 2 },
  pointBuyScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
  rolledPool: null,
  rolledAssignment: {},
  gender: 'female',
  alignment: 'Lawful Good',
  details: { age: '40', eyes: 'Grey' },
  equipmentChoice: 'A',
  classOption: 'A',
  classPicks: {},
  cart: { 'gear:rope': 1 },
  trinketRoll: 12,
  ...overrides,
});

describe('wizard draft', () => {
  it('round-trips through storage', () => {
    const s = memoryStorage();
    saveWizardDraft(draft(), s);
    expect(loadWizardDraft(s)).toEqual(draft());
    clearWizardDraft(s);
    expect(loadWizardDraft(s)).toBeNull();
  });

  it('discards corrupt JSON, other versions and unknown content', () => {
    const s = memoryStorage();
    s.setItem(WIZARD_DRAFT_KEY, '{not json');
    expect(loadWizardDraft(s)).toBeNull();
    expect(isWizardDraft({ ...draft(), v: 2 })).toBe(false);
    expect(isWizardDraft(draft({ classId: 'necromancer' }))).toBe(false);
    expect(isWizardDraft(draft({ speciesId: 'kender' }))).toBe(false);
    expect(isWizardDraft(draft({ trinketRoll: 101 }))).toBe(false);
    expect(isWizardDraft(draft({ chosenLanguages: [1 as unknown as string] }))).toBe(false);
    expect(isWizardDraft(draft({ classId: '', backgroundId: '', speciesId: '' }))).toBe(true);
  });

  it('counts a draft as progress once it has a class or a name', () => {
    expect(draftHasProgress(draft({ classId: '', name: '  ' }))).toBe(false);
    expect(draftHasProgress(draft({ classId: '', name: 'Tess' }))).toBe(true);
    expect(draftHasProgress(draft({ name: '' }))).toBe(true);
  });
});

describe('resolveDraftStep', () => {
  // The current step list for a Fighter (Class Features, no Spells) and a Wizard (Spells, no Class Features).
  const fighter = ['class', 'background', 'species', 'skills', 'abilities', 'equipment', 'features', 'details', 'review'];
  const wizard = ['class', 'background', 'species', 'skills', 'abilities', 'equipment', 'spells', 'details', 'review'];

  it('maps a legacy numeric step (no ids) from the old order to the same step now', () => {
    // Old Fighter order: class, background, species, skills, features, abilities, details, equipment, review.
    expect(resolveDraftStep(draft({ step: 7, furthest: 7 }), fighter)).toEqual({ step: 5, furthest: 5 }); // equipment
    expect(resolveDraftStep(draft({ step: 4, furthest: 6 }), fighter)).toEqual({ step: 6, furthest: 7 }); // features, details
    expect(resolveDraftStep(draft({ step: 8, furthest: 8 }), fighter)).toEqual({ step: 8, furthest: 8 }); // review
  });
  it('uses saved step ids when present', () => {
    const d = draft({ step: 99, furthest: 99, stepId: 'equipment', furthestId: 'details' });
    expect(resolveDraftStep(d, fighter)).toEqual({ step: 5, furthest: 7 });
  });
  it('translates a legacy draft for a class with Spells and no Class Features', () => {
    // Old Wizard order: ..., skills(3), abilities(4), spells(5), details(6), equipment(7), review(8).
    expect(resolveDraftStep(draft({ classId: 'wizard', step: 7, furthest: 8 }), wizard)).toEqual({ step: 5, furthest: 8 });
  });
  it('clamps an id the class no longer has and an index past the end', () => {
    expect(resolveDraftStep(draft({ stepId: 'spells', furthestId: 'review' }), fighter)).toEqual({ step: 2, furthest: 8 });
    expect(resolveDraftStep(draft({ step: 50, furthest: 50 }), wizard)).toEqual({ step: 8, furthest: 8 });
  });
});

describe('wizard draft step ids', () => {
  it('accepts drafts without the id fields and rejects non-string ids', () => {
    expect(isWizardDraft(draft())).toBe(true);
    expect(isWizardDraft(draft({ stepId: 'equipment', furthestId: 'review' }))).toBe(true);
    expect(isWizardDraft({ ...draft(), stepId: 3 })).toBe(false);
    expect(isWizardDraft({ ...draft(), furthestId: 3 })).toBe(false);
  });
});