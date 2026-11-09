/**
 * Display model of a 2024-layout stat block (AC, Initiative, HP, Speed, six
 * abilities with MOD and SAVE, skills, senses, languages, CR / XP / PB, traits,
 * actions, bonus actions, reactions). One model feeds the single StatBlockView
 * component, whether the block comes from the creature catalog (companions,
 * mounts, sidekicks) or was typed by the user (hirelings, NPC party members).
 *
 * Derived numbers carry a `Breakdown` so the view can wrap them in a
 * CalculatedValue (calculated-totals steering). Printed numbers are plain text.
 * Nothing is invented: a value the source does not give is simply absent.
 *
 * Rules basis: PHB 2024 "Ability Scores" (modifier = floor((score - 10) / 2),
 * Docs/PlayersHandbook.md), Appendix B stat block layout, Monster Manual 2024
 * "Stat Block" layout.
 */

import type { Ability, CustomStatBlock } from '../types/character';
import { ABILITY_NAMES } from '../types/character';
import type { CreatureFeature, CreatureStatBlock } from '../data/creatures';
import type { Breakdown } from './breakdown';
import { formatSigned } from './breakdown';
import { abilityModifier } from './abilities';

/** A value shown in the block: plain text, optionally explained by a breakdown. */
export interface StatValue {
  text: string;
  /** When present the view renders the value as a CalculatedValue. */
  breakdown?: Breakdown;
  /** Tooltip heading for the breakdown. */
  breakdownLabel?: string;
}

export interface StatAbilityRow {
  key: Ability;
  name: string;
  score: string;
  mod: StatValue;
  save: StatValue;
}

/** A labelled line such as "Skills Perception +3". */
export interface StatLine {
  label: string;
  value: StatValue;
}

/** A live number attached to a feature (attack bonus, save DC, damage). */
export interface StatFeatureDerived {
  label: string;
  /** Text before the number, e.g. "1d8 + ". */
  prefix?: string;
  value: StatValue;
  /** Text after the number, e.g. " Force". */
  suffix?: string;
}

export interface StatFeature {
  name: string;
  description: string;
  usage?: string;
  derived: StatFeatureDerived[];
}

export type StatFeatureSection = 'traits' | 'actions' | 'bonusActions' | 'reactions';

export interface StatBlockModel {
  /** Catalog id, when the block is a catalog creature (enables creature tooltips). */
  creatureId?: string;
  name: string;
  /** "Large Beast, Unaligned" style line. */
  subtitle: string;
  ac: StatValue | null;
  initiative: StatValue | null;
  hp: StatValue | null;
  /** Hit points maximum as a number, when known (feeds HP tracking). */
  hpMax: number | null;
  speed: string;
  abilities: StatAbilityRow[];
  /** Skills, resistances, immunities, senses, languages, Hit Dice, CR (omitted when empty). */
  lines: StatLine[];
  traits: StatFeature[];
  actions: StatFeature[];
  bonusActions: StatFeature[];
  reactions: StatFeature[];
}

export const ABILITY_ORDER: readonly Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Live numbers of an owner-scaled creature (Primal Companion, Otherworldly Steed). */
export interface StatBlockLive {
  armorClass?: Breakdown;
  hitPoints?: Breakdown;
  hitDice?: Breakdown;
  /** Owner's spell attack modifier (attacks with `bonusFormula`). */
  attackBonus?: Breakdown | null;
  /** Owner's spell save DC (saves with `dcFormula`). */
  spellSaveDc?: Breakdown | null;
  /** Flat damage added to the dice (owner-scaled damage). */
  damageFlat?: Breakdown | null;
  /** Primal Bond: the owner's Proficiency Bonus on the beast's checks and saves. */
  primalBond?: Breakdown;
  /** Steed type or familiar type shown in the subtitle instead of the catalog's. */
  creatureTypeOverride?: string;
  /** Speeds replaced by the live value (Otherworldly Steed Fly from spell level 4). */
  speedText?: string;
  /** Why attack / DC are missing (no spellcasting class). */
  missingSpellcastingNote?: string;
}

// -- Helpers ------------------------------------------------------------------

function modBreakdown(score: number): Breakdown {
  const mod = abilityModifier(score);
  return {
    total: mod,
    components: [{ label: `Score ${score}: (${score} - 10) / 2, rounded down`, value: mod }],
  };
}

function saveBreakdown(mod: number, proficiencyBonus: number): Breakdown {
  return {
    total: mod + proficiencyBonus,
    components: [
      { label: 'Ability modifier', value: mod },
      { label: 'Proficiency Bonus', value: proficiencyBonus },
    ],
  };
}

function signedValue(n: number, breakdown?: Breakdown, label?: string): StatValue {
  return { text: formatSigned(n), ...(breakdown ? { breakdown, breakdownLabel: label } : {}) };
}

function breakdownValue(b: Breakdown, label: string, text?: string): StatValue {
  return { text: text ?? String(b.total), breakdown: b, breakdownLabel: label };
}

function speedsText(speeds: CreatureStatBlock['speeds']): string {
  if (!speeds) return '';
  const parts: string[] = [];
  if (speeds.walk !== undefined) parts.push(`${speeds.walk} ft.`);
  for (const [key, label] of [
    ['burrow', 'Burrow'],
    ['climb', 'Climb'],
    ['fly', 'Fly'],
    ['swim', 'Swim'],
  ] as const) {
    const v = speeds[key];
    if (v !== undefined) parts.push(`${label} ${v} ft.`);
  }
  return parts.join(', ');
}

function nonEmptyLine(label: string, text: string | null | undefined): StatLine[] {
  const t = (text ?? '').trim();
  return t ? [{ label, value: { text: t } }] : [];
}

function diceOnly(dice: string): string {
  // "1d8+4" -> "1d8"; a flat number stays as is.
  const m = /^(\d+d\d+)/.exec(dice);
  return m ? m[1] : dice;
}

function catalogFeature(feature: CreatureFeature, live?: StatBlockLive): StatFeature {
  const derived: StatFeatureDerived[] = [];
  if (feature.attack?.bonusFormula && live) {
    derived.push({
      label: 'Attack bonus',
      value: live.attackBonus
        ? breakdownValue(live.attackBonus, 'Spell attack modifier', formatSigned(live.attackBonus.total))
        : { text: live.missingSpellcastingNote ?? 'needs a spellcasting class' },
    });
  } else if (feature.attack && feature.attack.bonus !== null) {
    derived.push({ label: 'Attack bonus', value: { text: formatSigned(feature.attack.bonus) } });
  }
  if (feature.save?.dcFormula && live) {
    derived.push({
      label: 'Save DC',
      value: live.spellSaveDc
        ? breakdownValue(live.spellSaveDc, 'Spell save DC')
        : { text: live.missingSpellcastingNote ?? 'needs a spellcasting class' },
    });
  } else if (feature.save && feature.save.dc !== null) {
    derived.push({ label: 'Save DC', value: { text: String(feature.save.dc) } });
  }
  for (const d of feature.damage ?? []) {
    const ownerScaled = d.plusAbilityOfOwner !== undefined || d.plusSpellLevel === true;
    if (ownerScaled && live?.damageFlat) {
      derived.push({
        label: 'Damage',
        prefix: `${diceOnly(d.dice)} + `,
        value: breakdownValue(live.damageFlat, 'Damage bonus'),
        suffix: ` ${d.typeChoice ? d.typeChoice.join(', ') : d.type}`,
      });
    } else if (!ownerScaled) {
      const avg = d.average !== null ? `${d.average} ` : '';
      derived.push({ label: 'Damage', value: { text: `${avg}(${d.dice}) ${d.type}`.replace(/\s+/g, ' ') } });
    }
  }
  return {
    name: feature.name,
    description: feature.description,
    ...(feature.usage ? { usage: feature.usage } : {}),
    derived,
  };
}

// -- Catalog creature ---------------------------------------------------------

/**
 * Build the model of a catalog creature. `live` carries the owner-scaled numbers
 * of a Primal Companion or Otherworldly Steed; without it printed values are used.
 * `hpMaxOverride` replaces the printed average (a rolled or actual maximum).
 */
export function catalogStatBlockModel(
  creature: CreatureStatBlock,
  live?: StatBlockLive,
  hpMaxOverride?: number,
): StatBlockModel {
  const subtitleParts = [
    creature.size,
    live?.creatureTypeOverride ?? (creature.subtype ? `${creature.creatureType} (${creature.subtype})` : creature.creatureType),
  ].filter(Boolean);
  const subtitle = `${subtitleParts.join(' ')}${creature.alignment ? `, ${creature.alignment}` : ''}`;

  // Armor Class
  let ac: StatValue | null = null;
  if (live?.armorClass) ac = breakdownValue(live.armorClass, 'Armor Class');
  else if (typeof creature.ac === 'number') ac = { text: String(creature.ac) };

  // Hit Points
  let hp: StatValue | null = null;
  let hpMax: number | null = null;
  if (live?.hitPoints) {
    hp = breakdownValue(live.hitPoints, 'Hit Points maximum');
    hpMax = live.hitPoints.total;
  } else if ('average' in creature.hp && creature.hp.average !== null) {
    hpMax = hpMaxOverride ?? creature.hp.average;
    const printedDice = 'dice' in creature.hp && creature.hp.dice ? creature.hp.dice : null;
    hp = { text: printedDice && hpMaxOverride === undefined ? `${hpMax} (${printedDice})` : String(hpMax) };
  }

  const initiative: StatValue | null = creature.initiative
    ? signedValue(
        creature.initiative.modifier,
        {
          total: creature.initiative.modifier,
          components: [{ label: 'Dexterity modifier', value: creature.initiative.modifier }],
        },
        'Initiative',
      )
    : null;

  const abilities: StatAbilityRow[] = ABILITY_ORDER.map((key) => {
    const a = creature.abilities[key];
    const mod: StatValue =
      a.mod === null
        ? { text: '?' }
        : signedValue(a.mod, a.score !== null ? modBreakdown(a.score) : undefined, `${ABILITY_NAMES[key]} modifier`);
    let save: StatValue;
    if (a.save === null || a.mod === null) save = { text: '?' };
    else if (a.saveProficient) {
      save = signedValue(a.save, saveBreakdown(a.mod, a.save - a.mod), `${ABILITY_NAMES[key]} saving throw`);
    } else {
      save = signedValue(a.save, undefined);
    }
    return { key, name: ABILITY_NAMES[key], score: a.score === null ? '?' : String(a.score), mod, save };
  });

  const lines: StatLine[] = [];
  const skills = Object.entries(creature.skills)
    .map(([name, bonus]) => `${name} ${formatSigned(bonus)}`)
    .join(', ');
  lines.push(...nonEmptyLine('Skills', skills));
  lines.push(...nonEmptyLine('Gear', creature.gear.join(', ')));
  lines.push(...nonEmptyLine('Vulnerabilities', creature.damageVulnerabilities.join(', ')));
  lines.push(...nonEmptyLine('Resistances', creature.damageResistances.join(', ')));
  lines.push(...nonEmptyLine('Immunities', [...creature.damageImmunities, ...creature.conditionImmunities].join(', ')));
  if (creature.senses) {
    const s = creature.senses;
    const parts: string[] = [];
    if (s.blindsightFt !== undefined) parts.push(`Blindsight ${s.blindsightFt} ft.`);
    if (s.darkvisionFt !== undefined) parts.push(`Darkvision ${s.darkvisionFt} ft.`);
    if (s.passivePerception !== null) parts.push(`Passive Perception ${s.passivePerception}`);
    lines.push(...nonEmptyLine('Senses', parts.join(', ')));
  }
  lines.push(...nonEmptyLine('Languages', creature.languages));
  if (live?.hitDice) {
    lines.push({
      label: 'Hit Dice',
      value: breakdownValue(live.hitDice, 'Hit Dice', `${live.hitDice.total}d${hitDieOf(creature)}`),
    });
  }
  if (live?.primalBond) {
    lines.push({
      label: 'Primal Bond',
      value: breakdownValue(live.primalBond, 'Primal Bond', `+${live.primalBond.total} to its ability checks and saving throws`),
    });
  }
  const c = creature.challenge;
  const crParts: string[] = [];
  if (c.cr !== null) crParts.push(c.cr === 'None' ? 'None' : c.cr);
  if (c.xp !== null) crParts.push(`XP ${c.xp}`);
  if (c.proficiencyBonus !== null) crParts.push(`PB ${formatSigned(c.proficiencyBonus)}`);
  else if (c.pbNote) crParts.push(`PB: ${c.pbNote}`);
  lines.push(...nonEmptyLine('Challenge', crParts.join('; ')));

  return {
    creatureId: creature.id,
    name: creature.name,
    subtitle,
    ac,
    initiative,
    hp,
    hpMax,
    speed: live?.speedText ?? speedsText(creature.speeds),
    abilities,
    lines,
    traits: creature.traits.map((f) => catalogFeature(f, live)),
    actions: creature.actions.map((f) => catalogFeature(f, live)),
    bonusActions: creature.bonusActions.map((f) => catalogFeature(f, live)),
    reactions: creature.reactions.map((f) => catalogFeature(f, live)),
  };
}

function hitDieOf(creature: CreatureStatBlock): number {
  return 'formula' in creature.hp ? creature.hp.formula.hitDie : 8;
}

// -- Custom (user-typed) block ------------------------------------------------

/**
 * Build the model of a hand-entered stat block. MOD and SAVE are derived from
 * the typed scores and Proficiency Bonus; every other field is shown exactly as
 * typed and absent fields stay blank (nothing is filled in from the book).
 */
export function customStatBlockModel(name: string, stats: CustomStatBlock | undefined): StatBlockModel {
  const s = stats ?? {};
  const pb = s.proficiencyBonus ?? 0;
  const subtitle = [s.size, s.creatureType].filter(Boolean).join(' ') + (s.alignment ? `${s.size || s.creatureType ? ', ' : ''}${s.alignment}` : '');
  const abilities: StatAbilityRow[] = ABILITY_ORDER.map((key) => {
    const score = s.abilities?.[key];
    if (score === undefined) {
      return { key, name: ABILITY_NAMES[key], score: '', mod: { text: '' }, save: { text: '' } };
    }
    const mod = abilityModifier(score);
    const proficient = s.saveProficiencies?.includes(key) === true;
    return {
      key,
      name: ABILITY_NAMES[key],
      score: String(score),
      mod: signedValue(mod, modBreakdown(score), `${ABILITY_NAMES[key]} modifier`),
      save: proficient
        ? signedValue(mod + pb, saveBreakdown(mod, pb), `${ABILITY_NAMES[key]} saving throw`)
        : signedValue(mod, {
            total: mod,
            components: [
              { label: 'Ability modifier', value: mod },
              { label: 'Proficiency Bonus (not proficient)', value: 0 },
            ],
          }, `${ABILITY_NAMES[key]} saving throw`),
    };
  });
  const lines: StatLine[] = [];
  lines.push(...nonEmptyLine('Skills', s.skills));
  lines.push(...nonEmptyLine('Vulnerabilities', s.vulnerabilities));
  lines.push(...nonEmptyLine('Resistances', s.resistances));
  lines.push(...nonEmptyLine('Immunities', s.immunities));
  lines.push(...nonEmptyLine('Senses', s.senses));
  lines.push(...nonEmptyLine('Languages', s.languages));
  const challenge: string[] = [];
  if (s.cr) challenge.push(s.cr);
  if (s.xp !== undefined) challenge.push(`XP ${s.xp}`);
  if (s.proficiencyBonus !== undefined) challenge.push(`PB ${formatSigned(s.proficiencyBonus)}`);
  lines.push(...nonEmptyLine('Challenge', challenge.join('; ')));

  const toFeatures = (list: CustomStatBlock['traits']): StatFeature[] =>
    (list ?? []).map((e) => ({ name: e.name, description: e.description, derived: [] }));

  return {
    name,
    subtitle,
    ac: s.ac !== undefined ? { text: String(s.ac) } : null,
    initiative: s.initiativeMod !== undefined ? { text: formatSigned(s.initiativeMod) } : null,
    hp: s.hpMax !== undefined ? { text: String(s.hpMax) } : null,
    hpMax: s.hpMax ?? null,
    speed: s.speed ?? '',
    abilities,
    lines,
    traits: toFeatures(s.traits),
    actions: toFeatures(s.actions),
    bonusActions: toFeatures(s.bonusActions),
    reactions: toFeatures(s.reactions),
  };
}
