import { describe, it, expect } from 'vitest';
import {
  WIZARD_DRAFT_KEY,
  clearWizardDraft,
  draftHasProgress,
  isWizardDraft,
  loadWizardDraft,
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
