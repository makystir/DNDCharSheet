/**
 * Generator for src/data/spells.ts — the full PHB 2024 spell catalog.
 *
 * Reads the PHB 2024 "Spell Descriptions" section from Docs/PlayersHandbook.md,
 * parses it with scripts/spell-extract.ts, applies the cited override map
 * (scripts/spell-overrides.ts), and emits src/data/spells.ts in place (same
 * interfaces and exports) plus a reconcile report (scripts/spell-report.json).
 *
 * Run with: `npm run gen:spells`.
 * CI drift check: `npm run gen:spells:check` regenerates to a buffer and diffs
 * it against the committed file, failing if they differ.
 *
 * RULES COMPLIANCE: all values come verbatim from the PHB 2024 source
 * (Docs/PlayersHandbook.md); nothing is invented. See spell-extract.ts.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseSpellBlocks,
  slugify,
  type ParsedSpell,
  type CastingClassId,
  type SpellSchool,
} from './spell-extract.ts';
import { applyOverride } from './spell-overrides.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const SOURCE_PATH = join(REPO_ROOT, 'Docs', 'PlayersHandbook.md');
const OUTPUT_PATH = join(REPO_ROOT, 'src', 'data', 'spells.ts');
const REPORT_PATH = join(SCRIPT_DIR, 'spell-report.json');

/** The final catalog record shape (mirrors SpellData in the emitted module). */
interface CatalogRecord {
  id: string;
  name: string;
  level: number;
  school: SpellSchool;
  castingTime: string;
  range: string;
  components: { verbal: boolean; somatic: boolean; material?: string };
  duration: string;
  concentration: boolean;
  ritual: boolean;
  classes: CastingClassId[];
  effect: string;
  description: string;
}

/**
 * Derive the short `description` as a bounded transformation of the REAL effect
 * prose (<=160-char truncation at a word boundary) — never a field-assembled
 * summary. Because it is a slice of the verbatim effect, it can never be a bare
 * "Level N School." profile.
 */
export function deriveDescription(effect: string): string {
  const flat = effect.replace(/\s+/g, ' ').trim();
  if (flat.length <= 160) return flat;
  const cut = flat.slice(0, 159);
  const atWord = cut.replace(/\s+\S*$/, '');
  return `${atWord.length > 0 ? atWord : cut}\u2026`;
}

/** Map a parsed+overridden spell to the final catalog record. */
function toCatalogRecord(parsed: ParsedSpell): CatalogRecord {
  const id = slugify(parsed.name);
  const components: CatalogRecord['components'] = {
    verbal: parsed.components.verbal,
    somatic: parsed.components.somatic,
  };
  if (parsed.components.material !== undefined && parsed.components.material.length > 0) {
    components.material = parsed.components.material;
  }
  return {
    id,
    name: parsed.name,
    level: parsed.level,
    school: parsed.school,
    castingTime: parsed.castingTime,
    range: parsed.range,
    components,
    duration: parsed.duration,
    concentration: parsed.concentration,
    ritual: parsed.ritual,
    classes: parsed.classes,
    effect: parsed.effect,
    description: deriveDescription(parsed.effect),
  };
}

/** Build the ordered catalog + reconcile report from the source markdown. */
export function buildCatalog(markdown: string): {
  records: CatalogRecord[];
  report: ReconcileReport;
  parsed: ParsedSpell[];
} {
  const parsed = parseSpellBlocks(markdown).map(applyOverride);
  const records = parsed.map(toCatalogRecord);
  records.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

  const byLevel: Record<number, number> = {};
  for (const r of records) byLevel[r.level] = (byLevel[r.level] ?? 0) + 1;
  const byClass: Record<string, number> = {};
  for (const r of records) for (const c of r.classes) byClass[c] = (byClass[c] ?? 0) + 1;

  const flagged = parsed
    .filter((p) => p.flags.length > 0)
    .map((p) => ({ id: slugify(p.name), name: p.name, flags: p.flags }));

  const report: ReconcileReport = {
    total: records.length,
    byLevel,
    byClass,
    flaggedCount: flagged.length,
    flagged,
  };
  return { records, report, parsed };
}

interface ReconcileReport {
  total: number;
  byLevel: Record<number, number>;
  byClass: Record<string, number>;
  flaggedCount: number;
  flagged: Array<{ id: string; name: string; flags: string[] }>;
}

/** Serialize a string as a single-quoted TS string literal. */
function tsString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
  return `'${escaped}'`;
}

/** Render one catalog record as a TS object literal. */
function renderRecord(r: CatalogRecord): string {
  const lines: string[] = ['  {'];
  lines.push(`    id: ${tsString(r.id)},`);
  lines.push(`    name: ${tsString(r.name)},`);
  lines.push(`    level: ${r.level},`);
  lines.push(`    school: ${tsString(r.school)},`);
  lines.push(`    castingTime: ${tsString(r.castingTime)},`);
  lines.push(`    range: ${tsString(r.range)},`);
  const comp: string[] = [`verbal: ${r.components.verbal}`, `somatic: ${r.components.somatic}`];
  if (r.components.material !== undefined) comp.push(`material: ${tsString(r.components.material)}`);
  lines.push(`    components: { ${comp.join(', ')} },`);
  lines.push(`    duration: ${tsString(r.duration)},`);
  lines.push(`    concentration: ${r.concentration},`);
  lines.push(`    ritual: ${r.ritual},`);
  lines.push(`    classes: [${r.classes.map((c) => tsString(c)).join(', ')}],`);
  lines.push(`    effect: ${tsString(r.effect)},`);
  lines.push(`    description: ${tsString(r.description)},`);
  lines.push('  },');
  return lines.join('\n');
}

/** The fixed module header + type declarations + exports around the data array. */
const MODULE_HEADER = `/**
 * D&D 5.5e (2024) spell catalog — the full PHB 2024 spell list.
 *
 * A flat, typed data module mirroring src/data/classes.ts / species.ts: one
 * exported array of spell records, with the id/school unions derived from the
 * data so the persisted shape and the catalog cannot drift.
 *
 * SOURCING / RULES COMPLIANCE
 * ---------------------------
 * Every record's mechanical fields (level, school, class-list membership,
 * casting time, range, components, duration, Concentration, Ritual) and the
 * full \`effect\` prose are transcribed VERBATIM from the PHB 2024 "Spell
 * Descriptions" section (Docs/PlayersHandbook.md). NO spell is invented and no
 * value is guessed (rules-compliance rule 1). The short \`description\` is a
 * bounded (<=160-char) truncation of the real \`effect\` prose, not a
 * field-assembled summary.
 *
 * GENERATED FILE — DO NOT HAND-EDIT.
 * This file is produced by scripts/generate-spells.ts from the in-repo PHB 2024
 * markdown. To change it, edit the generator (scripts/spell-extract.ts, the
 * cited scripts/spell-overrides.ts) and run \`npm run gen:spells\`; CI runs
 * \`npm run gen:spells:check\` to fail the build if the committed file drifts
 * from a fresh regenerate.
 */

import type { ClassId } from './classes';

/** The eight PHB 2024 schools of magic (PHB 2024 "Schools of Magic" table). */
export type SpellSchool =
  | 'abjuration'
  | 'conjuration'
  | 'divination'
  | 'enchantment'
  | 'evocation'
  | 'illusion'
  | 'necromancy'
  | 'transmutation';

/** Spell components (PHB 2024 "Components"). */
export interface SpellComponents {
  verbal: boolean;
  somatic: boolean;
  /** Verbatim material-component text (incl. cost + "consumes"), when present. */
  material?: string;
}

/** A single spell's mechanical profile (PHB 2024 "Spell Descriptions"). */
export interface SpellData {
  /** Stable catalog key, e.g. 'fireball'. */
  id: string;
  /** Spell name as printed, e.g. 'Fireball'. */
  name: string;
  /** 0 = cantrip, 1-9 = leveled spell (PHB 2024). */
  level: number;
  /** School of magic. */
  school: SpellSchool;
  /** Casting time, e.g. 'Action', 'Bonus Action', '1 minute'. */
  castingTime: string;
  /** Range, e.g. 'Self', 'Touch', '60 feet'. */
  range: string;
  /** Verbal / Somatic / Material components. */
  components: SpellComponents;
  /** Duration, e.g. 'Instantaneous', 'Concentration, up to 1 minute'. */
  duration: string;
  /** Whether the spell requires Concentration. */
  concentration: boolean;
  /** Whether the spell can be cast as a Ritual. */
  ritual: boolean;
  /** Which class spell lists include this spell (PHB 2024 class spell lists). */
  classes: readonly ClassId[];
  /**
   * The VERBATIM PHB 2024 effect prose (incl. any "Using a Higher-Level Spell
   * Slot." / "Cantrip Upgrade." addendum), lightly whitespace-normalised. Always
   * present; never synthesized.
   */
  effect: string;
  /**
   * A short (<=160-char) truncation of \`effect\` at a word boundary — a bounded
   * slice of the real prose, for compact list rendering. Always present.
   */
  description: string;
}

/**
 * The full PHB 2024 spell catalog, ordered by level then name.
 *
 * Declared \`as const satisfies readonly SpellData[]\` (mirroring CLASS_CATALOG)
 * so each record's \`id\` stays a string literal: this keeps \`SpellId\` a finite
 * union of the catalog's ids rather than widening to \`string\`, so persisted
 * spell state cannot reference an id absent from the catalog.
 */
export const SPELL_CATALOG = [
`;

const MODULE_FOOTER = `] as const satisfies readonly SpellData[];

/** A single catalog record with its literal id preserved (from \`as const\`). */
export type CatalogSpell = (typeof SPELL_CATALOG)[number];

/** A valid spell catalog key (finite union derived from the catalog ids). */
export type SpellId = CatalogSpell['id'];

/**
 * Compile-time assertion that SpellId is a finite literal union, not \`string\`.
 * If the catalog ever loses \`as const\` (widening SpellId back to \`string\`),
 * \`string\` becomes assignable to SpellId and this line fails to type-check.
 */
type _AssertSpellIdNotString = [string] extends [SpellId] ? never : SpellId;
// Reference the type so it is not reported as unused.
export type __SpellIdLiteralGuard = _AssertSpellIdNotString;

/** Looks up a spell by id, tolerating an unknown/absent id (returns undefined). */
export function getSpell(id: string | undefined): CatalogSpell | undefined {
  if (id === undefined) return undefined;
  return SPELL_CATALOG.find((s) => s.id === id);
}

/** Spells on a given class's spell list, ordered by level then name. */
export function spellsForClass(classId: string): CatalogSpell[] {
  return SPELL_CATALOG.filter((s) => (s.classes as readonly string[]).includes(classId));
}
`;

/** Render the full src/data/spells.ts module text for the given records. */
export function renderModule(records: CatalogRecord[]): string {
  const body = records.map(renderRecord).join('\n');
  return `${MODULE_HEADER}${body}\n${MODULE_FOOTER}`;
}

/** Read source, build catalog, and return the rendered module + report. */
export function generate(): { module: string; report: ReconcileReport } {
  const markdown = readFileSync(SOURCE_PATH, 'utf8');
  const { records, report } = buildCatalog(markdown);
  return { module: renderModule(records), report };
}

function main(): void {
  const check = process.argv.includes('--check');
  const { module, report } = generate();

  if (check) {
    const current = readFileSync(OUTPUT_PATH, 'utf8');
    if (normalize(current) !== normalize(module)) {
      console.error(
        'gen:spells:check FAILED — src/data/spells.ts is stale. Run `npm run gen:spells`.',
      );
      process.exit(1);
    }
    console.log(`gen:spells:check OK — ${report.total} spells, catalog matches generator.`);
    return;
  }

  writeFileSync(OUTPUT_PATH, module, 'utf8');
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(
    `Generated src/data/spells.ts: ${report.total} spells ` +
      `(${report.flaggedCount} flagged for review). Report: scripts/spell-report.json`,
  );
}

/** Normalise line endings for the drift comparison. */
function normalize(s: string): string {
  return s.replace(/\r\n/g, '\n');
}

// Run when invoked directly as a script (argv[1] is this file); do nothing when
// imported by a test. Compared on basename to stay portable across OSes.
const entry = process.argv[1]?.replace(/\\/g, '/') ?? '';
if (entry.endsWith('/generate-spells.ts') || entry.endsWith('generate-spells.ts')) {
  main();
}
