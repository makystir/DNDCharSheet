import { describe, it, expect } from 'vitest';
import {
  CONDITIONS,
  EXHAUSTION,
  EXHAUSTION_TRACK,
  CONDITION_COLORS,
  getCondition,
  type ConditionData,
  type ConditionMechanics,
} from '../conditions';
import {
  resolveConditionTooltip,
  resolveExhaustionLevelTooltip,
} from '../../logic/tooltip-content';
import {
  GOLDEN_CONDITION_COUNT,
  GOLDEN_CONDITION_IDS,
  GOLDEN_CONDITIONS,
  GOLDEN_EXHAUSTION,
  GOLDEN_IMPLIES,
} from './conditions-golden';

/**
 * CONDITIONS COMPLETENESS ORACLE (Stage A4).
 * ------------------------------------------
 * The oracle tests MECHANICS, not the catalog's own wording. Three independent
 * layers, all compared against the hand-derived golden fixture
 * (conditions-golden.ts, from Docs/PlayersHandbook.md L20675-21709):
 *
 *  1. STRUCTURED FLAGS: `catalog.mechanics` must equal the golden flags exactly
 *     (a wrong, missing or extra flag fails, naming record and field).
 *  2. PROSE SIGNATURES: each flag has a keyword signature (case-insensitive,
 *     word-boundary anchored, evaluated line by line so `\badvantage\b` can
 *     never match "disadvantage"). For every record and every signature the
 *     prose must match EXACTLY when the golden flags say the rule applies:
 *     a missing rule fails ("prose missing") and a contradictory or extra rule
 *     fails ("prose contains forbidden"). Prose and flags cannot silently
 *     diverge. An exact effect-line count per record catches added/dropped rules.
 *  3. `endsWhen` tokens, `description`, `implies` and the PHB citation.
 *
 * Fail-closed is PROVEN over every record by mutation tests below: each flag,
 * signature, endsWhen token and count is removed/flipped/injected in turn and
 * the audit must report exactly that failure by record and field.
 */

// ── Prose signatures ───────────────────────────────────────────────────────

interface GoldenView {
  mechanics: ConditionMechanics;
  implies: string[];
}

interface Signature {
  id: string;
  /** Mechanic key (or 'implies') this signature guards. */
  key: keyof ConditionMechanics | 'implies';
  /** True when the golden record says this rule applies. */
  holds: (g: GoldenView) => boolean;
  /** A single effect line matches when ALL of these match and NONE of `none` do. */
  all: RegExp[];
  none?: RegExp[];
  /** A canonical line matching this signature (used to inject contradictions). */
  sample: string;
}

const AUTO = /\b(?:automatically fails?|fails? automatically)\b/;

export const SIGNATURES: Signature[] = [
  { id: 'cannotSee', key: 'cannotSee', holds: (g) => g.mechanics.cannotSee === true, all: [/\bcannot see\b/], sample: 'You cannot see.' },
  { id: 'autoFailSight', key: 'autoFailChecksRequiring', holds: (g) => g.mechanics.autoFailChecksRequiring === 'sight', all: [/\bsight\b/, AUTO], none: [/\bline of sight\b/], sample: 'Any check that relies on sight fails automatically.' },
  { id: 'cannotHear', key: 'cannotHear', holds: (g) => g.mechanics.cannotHear === true, all: [/\bcannot hear\b/], sample: 'You cannot hear.' },
  { id: 'autoFailHearing', key: 'autoFailChecksRequiring', holds: (g) => g.mechanics.autoFailChecksRequiring === 'hearing', all: [/\bhearing\b/, AUTO], sample: 'Any check that relies on hearing fails automatically.' },
  { id: 'speedZero', key: 'speedZero', holds: (g) => g.mechanics.speedZero === true, all: [/\bspeed\b/, /\b0\b/, /\bcannot be increased\b/], sample: 'Your Speed drops to 0 and cannot be increased.' },
  { id: 'autoFailStrDex', key: 'autoFailStrDexSaves', holds: (g) => g.mechanics.autoFailStrDexSaves === true, all: [/\bstrength and dexterity saving throws\b/, AUTO], sample: 'You automatically fail Strength and Dexterity saving throws.' },
  { id: 'dexSavesDisadvantage', key: 'dexSaves', holds: (g) => g.mechanics.dexSaves === 'disadvantage', all: [/\bdexterity saving throws\b/, /\bdisadvantage\b/], none: [/\bstrength\b/], sample: 'You have disadvantage on Dexterity saving throws.' },
  { id: 'attacksAgainstAdvantage', key: 'attacksAgainst', holds: (g) => g.mechanics.attacksAgainst === 'advantage', all: [/\battacks against you\b/, /\badvantage\b/], none: [/\bdisadvantage\b/], sample: 'Attacks against you have advantage.' },
  { id: 'attacksAgainstDisadvantage', key: 'attacksAgainst', holds: (g) => g.mechanics.attacksAgainst === 'disadvantage', all: [/\battacks against you\b/, /\bdisadvantage\b/], none: [/\badvantage\b/, /\bexcept\b/], sample: 'Attacks against you have disadvantage.' },
  { id: 'attacksAgainstDisadvantageUnlessSeen', key: 'attacksAgainst', holds: (g) => g.mechanics.attacksAgainst === 'disadvantage-unless-seen', all: [/\battacks against you\b/, /\bdisadvantage\b/, /\bexcept\b/, /\bsee you\b/], none: [/\badvantage\b/], sample: 'Attacks against you have disadvantage, except from a creature that can somehow see you.' },
  { id: 'attacksAgainstNear', key: 'attacksAgainst', holds: (g) => g.mechanics.attacksAgainst === 'advantage-within-5ft-else-disadvantage', all: [/\battacks against you\b/, /\badvantage\b/, /\bdisadvantage\b/, /\bwithin 5 feet\b/], sample: 'Attacks against you have advantage if the attacker is within 5 feet, and disadvantage if it is farther away.' },
  { id: 'ownAttacksAdvantage', key: 'ownAttacks', holds: (g) => g.mechanics.ownAttacks === 'advantage', all: [/\byour attacks\b/, /\badvantage\b/], none: [/\bdisadvantage\b/, /\bexcept\b/], sample: 'Your attacks have advantage.' },
  { id: 'ownAttacksAdvantageUnlessSeen', key: 'ownAttacks', holds: (g) => g.mechanics.ownAttacks === 'advantage-unless-seen', all: [/\byour attacks\b/, /\badvantage\b/, /\bexcept\b/, /\bsee you\b/], none: [/\bdisadvantage\b/], sample: 'Your attacks have advantage, except against a creature that can somehow see you.' },
  { id: 'ownAttacksDisadvantage', key: 'ownAttacks', holds: (g) => g.mechanics.ownAttacks === 'disadvantage', all: [/\byour attacks\b/, /\bdisadvantage\b/], none: [/\badvantage\b/, /\bline of sight\b/, /\bother than\b/], sample: 'Your attacks have disadvantage.' },
  { id: 'ownAttacksDisadvantageFear', key: 'ownAttacks', holds: (g) => g.mechanics.ownAttacks === 'disadvantage-while-source-in-sight', all: [/\byour attacks\b/, /\bdisadvantage\b/, /\bline of sight\b/], sample: 'Your attacks have disadvantage while the source of your fear is in your line of sight.' },
  { id: 'ownAttacksDisadvantageNonGrappler', key: 'ownAttacks', holds: (g) => g.mechanics.ownAttacks === 'disadvantage-vs-non-grappler', all: [/\byour attacks\b/, /\bdisadvantage\b/, /\bother than the grappler\b/], sample: 'Your attacks have disadvantage against any target other than the grappler.' },
  { id: 'checksDisadvantage', key: 'abilityChecks', holds: (g) => g.mechanics.abilityChecks === 'disadvantage', all: [/\bability checks\b/, /\bdisadvantage\b/], none: [/\bline of sight\b/], sample: 'Your ability checks have disadvantage.' },
  { id: 'checksDisadvantageFear', key: 'abilityChecks', holds: (g) => g.mechanics.abilityChecks === 'disadvantage-while-source-in-sight', all: [/\bability checks\b/, /\bdisadvantage\b/, /\bline of sight\b/], sample: 'Your ability checks have disadvantage while the source of your fear is in your line of sight.' },
  { id: 'critWithin5ft', key: 'critWithin5ft', holds: (g) => g.mechanics.critWithin5ft === true, all: [/\bcritical hit\b/, /\bwithin 5 feet\b/], sample: 'A hit against you is automatically a Critical Hit when the attacker is within 5 feet.' },
  { id: 'initiativeAdvantage', key: 'initiative', holds: (g) => g.mechanics.initiative === 'advantage', all: [/\binitiative\b/, /\badvantage\b/], none: [/\bdisadvantage\b/], sample: 'If you roll Initiative, the roll has advantage.' },
  { id: 'initiativeDisadvantage', key: 'initiative', holds: (g) => g.mechanics.initiative === 'disadvantage', all: [/\binitiative\b/, /\bdisadvantage\b/], sample: 'If you roll Initiative, the roll has disadvantage.' },
  { id: 'noActions', key: 'noActions', holds: (g) => g.mechanics.noActions === true, all: [/\bactions\b/, /\bbonus actions\b/, /\breactions\b/], sample: 'You cannot take actions, Bonus Actions, or Reactions.' },
  { id: 'concentrationBroken', key: 'concentrationBroken', holds: (g) => g.mechanics.concentrationBroken === true, all: [/\bconcentration\b/], sample: 'Your Concentration ends.' },
  { id: 'cannotSpeak', key: 'cannotSpeak', holds: (g) => g.mechanics.cannotSpeak === true, all: [/\bcannot speak\b/], sample: 'You cannot speak.' },
  { id: 'cannotHarmCharmer', key: 'cannotHarmCharmer', holds: (g) => g.mechanics.cannotHarmCharmer === true, all: [/\bcharmer\b/, /\bcannot\b/, /\bdamaging\b/], sample: 'You cannot attack the charmer or use damaging effects on it.' },
  { id: 'charmerSocialAdvantage', key: 'charmerSocialAdvantage', holds: (g) => g.mechanics.charmerSocialAdvantage === true, all: [/\bcharmer\b/, /\badvantage\b/, /\bsocially\b/], sample: 'The charmer has advantage on checks to interact with you socially.' },
  { id: 'cannotApproachSource', key: 'cannotApproachSource', holds: (g) => g.mechanics.cannotApproachSource === true, all: [/\bcannot voluntarily move closer\b/], sample: 'You cannot voluntarily move closer to the source of your fear.' },
  { id: 'grapplerDrag', key: 'grapplerDragExtraFeet', holds: (g) => g.mechanics.grapplerDragExtraFeet === 1, all: [/\bdrag\b/, /\b1 extra foot\b/, /\btiny\b/, /\btwo sizes\b/], sample: 'The grappler can drag you, paying 1 extra foot per foot, unless you are Tiny or two sizes smaller.' },
  { id: 'crawl', key: 'onlyCrawlOrStand', holds: (g) => g.mechanics.onlyCrawlOrStand === true, all: [/\bcrawl\b/], sample: 'You can only crawl.' },
  { id: 'standCostHalfSpeed', key: 'standCostFractionOfSpeed', holds: (g) => g.mechanics.standCostFractionOfSpeed === 0.5, all: [/\bhalf\b/, /\bspeed\b/, /\brounded down\b/], sample: 'Standing costs half your Speed (rounded down).' },
  { id: 'cannotStandAtSpeedZero', key: 'cannotStandAtSpeedZero', holds: (g) => g.mechanics.cannotStandAtSpeedZero === true, all: [/\bcannot stand up\b/, /\bspeed is 0\b/], sample: 'You cannot stand up if your Speed is 0.' },
  { id: 'seenTargetImmunity', key: 'immuneToSeenTargetEffects', holds: (g) => g.mechanics.immuneToSeenTargetEffects === true, all: [/\brequire\b/, /\btarget\b/, /\bunless\b/, /\bcreator\b/], sample: 'Effects that require a seen target do not affect you, unless the creator can see you.' },
  { id: 'equipmentConcealed', key: 'equipmentConcealed', holds: (g) => g.mechanics.equipmentConcealed === true, all: [/\bequipment\b/, /\bconcealed\b/], sample: 'Your equipment is concealed.' },
  { id: 'becomesInanimate', key: 'becomesInanimate', holds: (g) => g.mechanics.becomesInanimate === true, all: [/\binanimate\b/], sample: 'You become an inanimate substance.' },
  { id: 'weightTimesTen', key: 'weightMultiplier', holds: (g) => g.mechanics.weightMultiplier === 10, all: [/\bweight\b/, /\b10 times\b/], sample: 'Your weight becomes 10 times normal.' },
  { id: 'ceasesAging', key: 'ceasesAging', holds: (g) => g.mechanics.ceasesAging === true, all: [/\baging\b/], sample: 'You stop aging.' },
  { id: 'resistanceAllDamage', key: 'resistanceAllDamage', holds: (g) => g.mechanics.resistanceAllDamage === true, all: [/\bresistance\b/, /\ball damage\b/], sample: 'You have resistance to all damage.' },
  { id: 'immuneToPoisoned', key: 'immuneToPoisoned', holds: (g) => g.mechanics.immuneToPoisoned === true, all: [/\bimmune\b/, /\bpoisoned\b/], sample: 'You are immune to the Poisoned condition.' },
  { id: 'dropsHeld', key: 'dropsHeld', holds: (g) => g.mechanics.dropsHeld === true, all: [/\bdrop\b/], sample: 'You drop whatever you are holding.' },
  { id: 'remainsProneAfter', key: 'remainsProneAfter', holds: (g) => g.mechanics.remainsProneAfter === true, all: [/\bremain\b/, /\bprone\b/], sample: 'When this ends, you remain Prone.' },
  { id: 'exhaustionCumulative', key: 'cumulativeLevels', holds: (g) => g.mechanics.cumulativeLevels === true, all: [/\bcumulative\b/, /\bgain 1 exhaustion level\b/], sample: 'Cumulative: you gain 1 Exhaustion level each time.' },
  { id: 'exhaustionDeath', key: 'deathLevel', holds: (g) => g.mechanics.deathLevel === 6, all: [/\bdie\b/, /\blevel 6\b/], sample: 'At Exhaustion level 6, you die.' },
  { id: 'exhaustionD20', key: 'd20PenaltyPerLevel', holds: (g) => g.mechanics.d20PenaltyPerLevel === 2, all: [/\bd20 test\b/, /\b2\b/, /\bexhaustion level\b/], sample: 'Each D20 Test is lowered by 2 per Exhaustion level.' },
  { id: 'exhaustionSpeed', key: 'speedPenaltyPerLevel', holds: (g) => g.mechanics.speedPenaltyPerLevel === 5, all: [/\bspeed\b/, /\b5 feet\b/, /\bexhaustion level\b/], sample: 'Your Speed is lowered by 5 feet per Exhaustion level.' },
  { id: 'exhaustionLongRest', key: 'longRestRemovesLevels', holds: (g) => g.mechanics.longRestRemovesLevels === 1, all: [/\blong rest\b/, /\b1 exhaustion level\b/], sample: 'A Long Rest removes 1 Exhaustion level.' },
  { id: 'impliesIncapacitated', key: 'implies', holds: (g) => g.implies.includes('incapacitated'), all: [/\bincapacitated\b/, /\bconditions?\b/], none: [/\binitiative\b/], sample: 'You also have the Incapacitated condition.' },
  { id: 'impliesProne', key: 'implies', holds: (g) => g.implies.includes('prone'), all: [/\bprone\b/, /\bconditions?\b/], none: [/\bremain\b/], sample: 'You also have the Prone condition.' },
];

/** Case-insensitive copy of a signature regex. */
const ci = (r: RegExp): RegExp => new RegExp(r.source, 'i');

function lineMatches(line: string, s: Signature): boolean {
  return s.all.every((r) => ci(r).test(line)) && !(s.none ?? []).some((r) => ci(r).test(line));
}

function proseMatches(effects: string[], s: Signature): boolean {
  return effects.some((l) => lineMatches(l, s));
}

function goldenView(id: string): GoldenView {
  const g = GOLDEN_CONDITIONS[id as keyof typeof GOLDEN_CONDITIONS];
  return { mechanics: g.mechanics, implies: GOLDEN_IMPLIES[id] };
}

// ── Audit ──────────────────────────────────────────────────────────────────

/** Returns a list of failure messages for one record (empty = complete). */
export function auditCondition(c: ConditionData): string[] {
  const failures: string[] = [];
  const golden = GOLDEN_CONDITIONS[c.id];
  if (!golden) return [`${c.id}: no golden record`];

  if (!c.name.trim()) failures.push(`${c.id}: missing name`);
  if (!c.description.trim()) failures.push(`${c.id}: missing description`);
  if (c.effects.length === 0 || c.effects.some((e) => !e.trim())) {
    failures.push(`${c.id}: missing effects`);
  }
  if (!c.source.trim() || !/PHB 2024/.test(c.source)) {
    failures.push(`${c.id}: missing PHB 2024 citation`);
  }
  if (c.effects.length !== golden.effectCount) {
    failures.push(`${c.id}: effect line count ${c.effects.length}, expected ${golden.effectCount}`);
  }

  // Layer 1: structured flags must equal the golden flags exactly.
  const keys = new Set([...Object.keys(c.mechanics), ...Object.keys(golden.mechanics)]);
  for (const key of [...keys].sort()) {
    const actual = (c.mechanics as Record<string, unknown>)[key];
    const expected = (golden.mechanics as Record<string, unknown>)[key];
    if (actual !== expected) {
      failures.push(
        `${c.id}: mechanics.${key} is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
      );
    }
  }

  // Layer 2: prose must carry exactly the rules the golden flags specify.
  const view = goldenView(c.id);
  for (const s of SIGNATURES) {
    const present = proseMatches(c.effects, s);
    const required = s.holds(view);
    if (required && !present) failures.push(`${c.id}: prose missing "${s.id}"`);
    if (!required && present) failures.push(`${c.id}: prose contains forbidden "${s.id}"`);
  }

  // implies
  if ([...c.implies].join(',') !== GOLDEN_IMPLIES[c.id].join(',')) {
    failures.push(`${c.id}: implies [${c.implies.join(',')}], expected [${GOLDEN_IMPLIES[c.id].join(',')}]`);
  }

  // Layer 3: endsWhen.
  if (golden.endsWhen === null) {
    if (c.endsWhen !== undefined) failures.push(`${c.id}: endsWhen not expected`);
  } else if (!c.endsWhen || !c.endsWhen.trim()) {
    failures.push(`${c.id}: missing endsWhen`);
  } else {
    for (const t of golden.endsWhen) {
      if (!ci(t).test(c.endsWhen)) failures.push(`${c.id}: endsWhen missing ${t}`);
    }
  }
  return failures;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('conditions completeness oracle', () => {
  it('has exactly the PHB list of 15 conditions, by id and order', () => {
    expect(CONDITIONS).toHaveLength(GOLDEN_CONDITION_COUNT);
    expect(CONDITIONS.map((c) => c.id)).toEqual([...GOLDEN_CONDITION_IDS]);
    expect(new Set(CONDITIONS.map((c) => c.id)).size).toBe(GOLDEN_CONDITION_COUNT);
  });

  it('has a golden record and implied map for every golden id', () => {
    for (const id of GOLDEN_CONDITION_IDS) {
      expect(GOLDEN_CONDITIONS[id], `${id}: no golden record`).toBeDefined();
      expect(GOLDEN_IMPLIES[id], `${id}: no implied map`).toBeDefined();
    }
  });

  it.each(CONDITIONS.map((c) => [c.id, c] as const))(
    '%s matches the golden mechanics, prose signatures, endsWhen and description',
    (_id, c) => {
      expect(auditCondition(c)).toEqual([]);
    },
  );

  it('catalog mechanics deep-equal the golden flags for every record', () => {
    for (const c of CONDITIONS) {
      expect(c.mechanics, `${c.id} mechanics`).toEqual(GOLDEN_CONDITIONS[c.id].mechanics);
    }
  });

  it('every golden mechanic is guarded by at least one prose signature', () => {
    const guarded = new Set(SIGNATURES.map((s) => s.key));
    for (const id of GOLDEN_CONDITION_IDS) {
      for (const key of Object.keys(GOLDEN_CONDITIONS[id].mechanics)) {
        expect(guarded.has(key as keyof ConditionMechanics), `${id}.${key} has no signature`).toBe(true);
      }
    }
  });

  it('signature ids are unique and each sample satisfies its own signature', () => {
    expect(new Set(SIGNATURES.map((s) => s.id)).size).toBe(SIGNATURES.length);
    for (const s of SIGNATURES) {
      expect(lineMatches(s.sample, s), `${s.id} sample`).toBe(true);
    }
  });

  it('every golden-required signature is satisfied by some line, and no unexpected one is', () => {
    for (const c of CONDITIONS) {
      const view = goldenView(c.id);
      for (const s of SIGNATURES) {
        expect(proseMatches(c.effects, s), `${c.id}/${s.id}`).toBe(s.holds(view));
      }
    }
  });

  it('keywords are word-bounded: advantage never matches disadvantage', () => {
    expect(/\badvantage\b/i.test('Attacks have disadvantage')).toBe(false);
    expect(/\badvantage\b/i.test('Attacks have advantage')).toBe(true);
    const adv = SIGNATURES.find((s) => s.id === 'attacksAgainstAdvantage')!;
    expect(lineMatches('Attacks against you have disadvantage.', adv)).toBe(false);
    const inv = getCondition('invisible')!;
    const flipped = { ...inv, effects: inv.effects.map((l) => l.replace('Attacks against you have disadvantage', 'Attacks against you have advantage')) };
    expect(auditCondition(flipped)).toEqual(
      expect.arrayContaining([
        'invisible: prose missing "attacksAgainstDisadvantageUnlessSeen"',
        'invisible: prose contains forbidden "attacksAgainstAdvantage"',
      ]),
    );
  });

  it('dropping the Invisible "can somehow see you" carve-out from attacks-against is caught', () => {
    // PHB 2024 "Attacks Affected" (L21267): the carve-out removes BOTH benefits
    // against a creature that can see you. A paraphrase that keeps only the
    // own-attacks carve-out is a rules error, so the oracle must fail it.
    const inv = getCondition('invisible')!;
    const dropped = {
      ...inv,
      effects: inv.effects.map((l) =>
        l.replace(', except from a creature that can somehow see you', ''),
      ),
    };
    expect(dropped.effects).not.toEqual(inv.effects);
    expect(auditCondition(dropped)).toEqual(
      expect.arrayContaining(['invisible: prose missing "attacksAgainstDisadvantageUnlessSeen"']),
    );
  });

  it('no two conditions share identical effect text', () => {
    const seen = new Map<string, string>();
    for (const c of CONDITIONS) {
      const key = c.effects.join('|');
      expect(seen.has(key), `${c.id} duplicates ${seen.get(key)}`).toBe(false);
      seen.set(key, c.id);
    }
  });

  it('implied-condition relations match the PHB', () => {
    for (const c of CONDITIONS) {
      expect([...c.implies], `${c.id} implies`).toEqual(GOLDEN_IMPLIES[c.id]);
    }
    // Every implied condition must itself be a real condition.
    for (const c of CONDITIONS) {
      for (const i of c.implies) expect(getCondition(i), `${c.id} -> ${i}`).toBeDefined();
    }
  });

  it('records endsWhen exactly where the golden fixture says, and a non-empty description everywhere', () => {
    for (const c of CONDITIONS) {
      const golden = GOLDEN_CONDITIONS[c.id];
      expect(c.endsWhen !== undefined, `${c.id} endsWhen presence`).toBe(golden.endsWhen !== null);
      expect(c.description.trim(), `${c.id} description`).not.toBe('');
    }
    for (const id of ['grappled', 'prone', 'exhaustion'] as const) {
      expect(getCondition(id)!.endsWhen, `${id} endsWhen`).toBeTruthy();
    }
  });

  it('is conservatively flagged (srd false) and colour-keyed for every condition', () => {
    for (const c of CONDITIONS) {
      expect(c.srd, `${c.id} srd flag`).toBe(false);
      expect(CONDITION_COLORS[c.id], `${c.id} colour`).toBeDefined();
    }
  });

  it('grants a content tooltip for every condition (null for unknown)', () => {
    for (const c of CONDITIONS) {
      const t = resolveConditionTooltip(c.id);
      expect(t, `${c.id} tooltip`).not.toBeNull();
      expect(t!.title).toBe(c.name);
      const labels = t!.sections.map((s) => s.label);
      expect(labels, `${c.id} sections`).toEqual(expect.arrayContaining(['Description', 'Effects']));
      for (const s of t!.sections) expect(s.text.trim(), `${c.id} ${s.label}`).not.toBe('');
    }
    expect(resolveConditionTooltip('not-a-condition')).toBeNull();
  });
});

// ── Fail-closed proof: mutate EVERY record and EVERY requirement ───────────

/** Replace one mechanic (undefined deletes it). */
function withMechanic(c: ConditionData, key: string, value: unknown): ConditionData {
  const m: Record<string, unknown> = { ...c.mechanics };
  if (value === undefined) delete m[key];
  else m[key] = value;
  return { ...c, mechanics: m as unknown as ConditionMechanics };
}

function flipped(value: unknown): unknown {
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value + 1;
  return '__flipped__';
}

/** Every mechanic key used by any golden record, with one sample value each. */
const ALL_MECHANIC_SAMPLES = new Map<string, unknown>();
for (const id of GOLDEN_CONDITION_IDS) {
  for (const [k, v] of Object.entries(GOLDEN_CONDITIONS[id].mechanics)) {
    if (!ALL_MECHANIC_SAMPLES.has(k)) ALL_MECHANIC_SAMPLES.set(k, v);
  }
}

describe('oracle fails closed across EVERY record (mutation proof)', () => {
  it('starts from a clean slate: unmutated catalog reports no failures', () => {
    for (const c of CONDITIONS) expect(auditCondition(c), c.id).toEqual([]);
  });

  describe.each(CONDITIONS.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const golden = GOLDEN_CONDITIONS[c.id];
    const view = goldenView(c.id);

    it('every golden mechanic: deleting or flipping it reports exactly that field', () => {
      for (const key of Object.keys(golden.mechanics)) {
        const value = (golden.mechanics as Record<string, unknown>)[key];
        for (const [how, mutated] of [
          ['deleted', withMechanic(c, key, undefined)],
          ['flipped', withMechanic(c, key, flipped(value))],
        ] as const) {
          const failures = auditCondition(mutated);
          expect(failures, `${c.id}.${key} ${how}`).toHaveLength(1);
          expect(failures[0], `${c.id}.${key} ${how}`).toMatch(
            new RegExp(`^${c.id}: mechanics\\.${key} is `),
          );
        }
      }
    });

    it('every mechanic the PHB does not give this record: adding it reports exactly that field', () => {
      for (const [key, sample] of ALL_MECHANIC_SAMPLES) {
        if (key in golden.mechanics) continue;
        const failures = auditCondition(withMechanic(c, key, sample));
        expect(failures, `${c.id}.${key} extra`).toHaveLength(1);
        expect(failures[0]).toMatch(new RegExp(`^${c.id}: mechanics\\.${key} is `));
      }
    });

    it('every required prose signature: neutralising its keyword reports it missing', () => {
      for (const s of SIGNATURES.filter((x) => x.holds(view))) {
        const idx = c.effects.findIndex((l) => lineMatches(l, s));
        expect(idx, `${c.id}/${s.id} has a matching line`).toBeGreaterThanOrEqual(0);
        const effects = c.effects.map((l, i) => (i === idx ? l.replace(new RegExp(s.all[0].source, 'gi'), 'zzz') : l));
        const failures = auditCondition({ ...c, effects });
        expect(failures, `${c.id}/${s.id} neutralised`).toContain(`${c.id}: prose missing "${s.id}"`);
        for (const f of failures) {
          expect(f, `${c.id}/${s.id} unexpected failure`).toMatch(
            new RegExp(`^${c.id}: prose missing "`),
          );
        }
      }
    });

    it('every contradictory rule: injecting it reports it forbidden', () => {
      for (const s of SIGNATURES.filter((x) => !x.holds(view))) {
        const failures = auditCondition({ ...c, effects: [...c.effects, s.sample] });
        expect(failures, `${c.id}/${s.id} injected`).toContain(
          `${c.id}: prose contains forbidden "${s.id}"`,
        );
        for (const f of failures) {
          expect(f, `${c.id}/${s.id} unexpected failure`).toMatch(
            new RegExp(`^${c.id}: (prose contains forbidden "|effect line count )`),
          );
        }
      }
    });

    it('effect line count: an added or dropped line is reported', () => {
      const added = auditCondition({ ...c, effects: [...c.effects, 'Nothing else applies.'] });
      expect(added).toEqual([
        `${c.id}: effect line count ${golden.effectCount + 1}, expected ${golden.effectCount}`,
      ]);
      const dropped = auditCondition({ ...c, effects: c.effects.slice(0, -1) });
      expect(dropped).toContain(
        `${c.id}: effect line count ${golden.effectCount - 1}, expected ${golden.effectCount}`,
      );
    });

    it('description, effects, citation: blanking each is reported', () => {
      expect(auditCondition({ ...c, description: '  ' })).toEqual([`${c.id}: missing description`]);
      expect(auditCondition({ ...c, name: '' })).toEqual([`${c.id}: missing name`]);
      expect(auditCondition({ ...c, source: '' })).toEqual([`${c.id}: missing PHB 2024 citation`]);
      expect(auditCondition({ ...c, effects: [] })).toContain(`${c.id}: missing effects`);
    });

    it('implies: adding or removing an implied condition is reported', () => {
      const extra = c.id === 'blinded' ? 'deafened' : 'blinded';
      expect(auditCondition({ ...c, implies: [...c.implies, extra] })).toEqual([
        `${c.id}: implies [${[...c.implies, extra].join(',')}], expected [${GOLDEN_IMPLIES[c.id].join(',')}]`,
      ]);
      if (c.implies.length > 0) {
        const failures = auditCondition({ ...c, implies: c.implies.slice(1) });
        expect(failures.some((f) => f.startsWith(`${c.id}: implies [`))).toBe(true);
      }
    });

    it('endsWhen: required tokens are enforced; an unexpected one is rejected', () => {
      if (golden.endsWhen === null) {
        expect(auditCondition({ ...c, endsWhen: 'Ends eventually.' })).toEqual([
          `${c.id}: endsWhen not expected`,
        ]);
        return;
      }
      const noEnds = { ...c };
      delete noEnds.endsWhen;
      expect(auditCondition(noEnds)).toEqual([`${c.id}: missing endsWhen`]);
      for (const t of golden.endsWhen) {
        const failures = auditCondition({ ...c, endsWhen: c.endsWhen!.replace(ci(t), 'zzz') });
        expect(failures, `${c.id} endsWhen ${t}`).toContain(`${c.id}: endsWhen missing ${t}`);
      }
    });
  });

  it('a record with no golden entry fails closed', () => {
    const fake = { ...getCondition('blinded')!, id: 'bleeding' as ConditionData['id'] };
    expect(auditCondition(fake)).toEqual(['bleeding: no golden record']);
  });
});

describe('exhaustion track oracle', () => {
  it('matches the PHB numeric facts', () => {
    expect(EXHAUSTION.maxLevel).toBe(GOLDEN_EXHAUSTION.maxLevel);
    expect(EXHAUSTION.deathLevel).toBe(GOLDEN_EXHAUSTION.deathLevel);
    expect(EXHAUSTION.d20PenaltyPerLevel).toBe(GOLDEN_EXHAUSTION.d20PenaltyPerLevel);
    expect(EXHAUSTION.speedPenaltyPerLevel).toBe(GOLDEN_EXHAUSTION.speedPenaltyPerLevel);
    expect(EXHAUSTION.longRestReduction).toBe(GOLDEN_EXHAUSTION.longRestReduction);
  });

  it('has the full level 1..6 track with the correct penalties and death at 6 only', () => {
    expect(EXHAUSTION_TRACK.map((r) => r.level)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const r of EXHAUSTION_TRACK) {
      expect(r.d20Penalty, `level ${r.level} d20`).toBe(2 * r.level);
      expect(r.speedPenaltyFt, `level ${r.level} speed`).toBe(5 * r.level);
      expect(r.fatal, `level ${r.level} fatal`).toBe(r.level === 6);
    }
  });

  it('exposes a per-level tooltip with the death rule at level 6 only', () => {
    for (const r of EXHAUSTION_TRACK) {
      const t = resolveExhaustionLevelTooltip(r.level);
      expect(t, `level ${r.level}`).not.toBeNull();
      const labels = t!.sections.map((s) => s.label);
      expect(labels.includes('Death'), `level ${r.level} Death section`).toBe(r.fatal);
      expect(labels).toEqual(expect.arrayContaining(['D20 Tests', 'Speed', 'Removal']));
    }
    expect(resolveExhaustionLevelTooltip(0)).toBeNull();
    expect(resolveExhaustionLevelTooltip(7)).toBeNull();
  });
});
