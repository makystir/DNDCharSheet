/**
 * Option lists for the class-feature choice pickers: id, display name, a
 * paraphrased summary and the source citation, for every choice group in
 * class-choices.ts. Pure; the UI renders these without knowing the catalogs.
 *
 * Spell Mastery (Wizard 18, PHB 2024 L7479-7483): a level 1 and a level 2 spell
 * from the spellbook with a casting time of an action. Signature Spells
 * (Wizard 20, L7489-7491): level 3 spells from the spellbook. Both are offered
 * from the Wizard spellbook only.
 */

import type { Character, ClassChoiceKey } from '../types/character';
import { SKILLS } from '../types/character';
import { getSpell } from '../data/spells';
import { INVOCATION_CATALOG } from '../data/invocations';
import { METAMAGIC_CATALOG } from '../data/metamagic';
import { MANEUVER_CATALOG } from '../data/maneuvers';
import {
  ARTISANS_TOOLS,
  BLESSED_STRIKES_OPTIONS,
  DIVINE_ORDER_OPTIONS,
  ELEMENTAL_FURY_OPTIONS,
  MUSICAL_INSTRUMENTS,
  PRIMAL_ORDER_OPTIONS,
  SUBCLASS_PICK_OPTIONS,
} from '../data/class-options';
import { choiceOptionIds, spellChoiceEligible } from './class-choices';
import { chosenLandType, landSpellIds, landTypeOptions } from './class-choice-effects';

export interface ChoiceOptionView {
  id: string;
  name: string;
  summary: string;
  source: string;
}

/** "3: Blur, Burning Hands, Fire Bolt; 5: Fireball; ..." for a land type (all rows, for the picker). */
function landSpellSummary(landId: string): string {
  const land = landTypeOptions().find((o) => o.id === landId);
  return (land?.spells ?? [])
    .map((row) => `${row.level}: ${row.spells.map((id) => getSpell(id)?.name ?? id).join(', ')}`)
    .join('; ');
}

/**
 * The chosen land's spells already granted at the Druid's level, as names (for the
 * read-only display next to the chosen land type). Empty when no land is chosen.
 */
export function landGrantedSpellNames(character: Character): string[] {
  const druid = (character.classes ?? []).find((e) => e.id === 'druid' && e.subclassId === 'land');
  if (!druid) return [];
  return landSpellIds(chosenLandType(character), druid.level).map((id) => getSpell(id)?.name ?? id);
}

const skillName = (id: string): string => SKILLS.find((s) => s.id === id)?.name ?? id;

/** The pickable options for one choice group (spell groups depend on the character). */
export function choiceOptionViews(character: Character, key: ClassChoiceKey): ChoiceOptionView[] {
  switch (key) {
    case 'sorcerer.metamagic':
      return Object.values(METAMAGIC_CATALOG).map((m) => ({
        id: m.id,
        name: m.name,
        summary: `${m.cost} Sorcery Point${m.cost === 1 ? '' : 's'}. ${m.summary}`,
        source: m.source,
      }));
    case 'warlock.invocations':
      return Object.values(INVOCATION_CATALOG).map((i) => ({
        id: i.id,
        name: i.name,
        summary: i.summary,
        source: i.source,
      }));
    case 'fighter.maneuvers':
      return Object.values(MANEUVER_CATALOG).map((m) => ({ id: m.id, name: m.name, summary: m.summary, source: m.source }));
    case 'cleric.divineOrder':
      return DIVINE_ORDER_OPTIONS.map((o) => ({ id: o.id, name: o.name, summary: o.summary, source: o.source }));
    case 'druid.primalOrder':
      return PRIMAL_ORDER_OPTIONS.map((o) => ({ id: o.id, name: o.name, summary: o.summary, source: o.source }));
    case 'cleric.blessedStrikes':
      return BLESSED_STRIKES_OPTIONS.map((o) => ({ id: o.id, name: o.name, summary: o.summary, source: o.source }));
    case 'druid.elementalFury':
      return ELEMENTAL_FURY_OPTIONS.map((o) => ({ id: o.id, name: o.name, summary: o.summary, source: o.source }));
    case 'ranger.huntersPrey':
    case 'ranger.defensiveTactics':
    case 'ranger.primalCompanion':
    case 'barbarian.aspectOfTheWilds':
    case 'sorcerer.elementalAffinity':
    case 'ranger.glamourSkill': {
      const group = {
        'ranger.huntersPrey': 'huntersPrey',
        'ranger.defensiveTactics': 'defensiveTactics',
        'ranger.primalCompanion': 'primalCompanion',
        'barbarian.aspectOfTheWilds': 'aspectOfTheWilds',
        'sorcerer.elementalAffinity': 'elementalAffinity',
        'ranger.glamourSkill': 'glamourSkill',
      } as const;
      return SUBCLASS_PICK_OPTIONS[group[key]].map((o) => ({ id: o.id, name: o.name, summary: o.summary, source: o.source }));
    }
    case 'druid.landType':
      return landTypeOptions().map((o) => ({
        id: o.id,
        name: o.name,
        summary: `Always-prepared Circle spells by Druid level: ${landSpellSummary(o.id)}.`,
        source: 'PHB 2024 "Circle of the Land: Circle of the Land Spells" (L3860-3890)',
      }));
    case 'fighter.studentOfWarTool':
      return ARTISANS_TOOLS.map((t) => ({ id: t.id, name: t.name, summary: "Artisan's Tools proficiency.", source: t.source }));
    case 'bard.multiclassInstrument':
      return MUSICAL_INSTRUMENTS.map((t) => ({ id: t.id, name: t.name, summary: 'Musical Instrument proficiency.', source: t.source }));
    case 'barbarian.primalKnowledge':
    case 'fighter.studentOfWarSkill':
    case 'bard.loreSkills':
      return (choiceOptionIds(key) ?? []).map((id) => ({
        id,
        name: skillName(id),
        summary: 'Skill proficiency.',
        source: 'PHB 2024',
      }));
    case 'wizard.spellMastery':
    case 'wizard.signatureSpells': {
      const book = character.spellcasting?.byClass?.wizard?.spellbook ?? [];
      return book.flatMap((id) => {
        const spell = getSpell(id);
        if (!spell || !spellChoiceEligible(key, spell.level, spell.castingTime)) return [];
        return [{ id: spell.id, name: spell.name, summary: `Level ${spell.level} spell in your spellbook.`, source: 'PHB 2024 Wizard' }];
      });
    }
  }
}
