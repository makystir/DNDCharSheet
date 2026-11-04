/**
 * The 13 damage types of the 2024 rules.
 *
 * PHB 2024 Rules Glossary "Damage Types" table (Docs/PlayersHandbook.md
 * L20899-20914). Damage types have no rules of their own; other rules, such as
 * Resistance, Vulnerability and Immunity, key off them (L1109). The Take
 * Damage panel uses the type only as a label; Resistance / Vulnerability /
 * Immunity are toggled per damage instance.
 */
export const DAMAGE_TYPES = [
  'Acid',
  'Bludgeoning',
  'Cold',
  'Fire',
  'Force',
  'Lightning',
  'Necrotic',
  'Piercing',
  'Poison',
  'Psychic',
  'Radiant',
  'Slashing',
  'Thunder',
] as const;

export type DamageType = (typeof DAMAGE_TYPES)[number];
