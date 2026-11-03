/**
 * Pure, testable PHB 2024 spell-description extraction logic.
 *
 * This module turns the "Spell Descriptions" section of Docs/PlayersHandbook.md
 * into structured records. It is deliberately side-effect free so the unit tests
 * (scripts/__tests__/spell-extract.test.ts) and the generator
 * (scripts/generate-spells.ts) can both import it.
 *
 * RULES COMPLIANCE: the source of truth is the PHB 2024 "Spell Descriptions"
 * section (Docs/PlayersHandbook.md, lines ~10845-17851). Every mechanical value
 * and the `effect` prose is carried VERBATIM from that source (lightly
 * whitespace/hyphen-normalised); nothing is invented or guessed
 * (rules-compliance rule 1 / rule 6). Systematic OCR corruptions in the source
 * are repaired structurally (see normaliseLines) and a tiny cited override map
 * (scripts/spell-overrides.ts) fixes the handful of records the OCR mangles
 * beyond recovery.
 */

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

/** The casting classes whose spell lists this catalog models (PHB 2024). */
export const CASTING_CLASSES = [
  'bard',
  'cleric',
  'druid',
  'paladin',
  'ranger',
  'sorcerer',
  'warlock',
  'wizard',
] as const;
export type CastingClassId = (typeof CASTING_CLASSES)[number];

const SCHOOL_WORDS: Record<string, SpellSchool> = {
  abjuration: 'abjuration',
  conjuration: 'conjuration',
  divination: 'divination',
  enchantment: 'enchantment',
  evocation: 'evocation',
  illusion: 'illusion',
  necromancy: 'necromancy',
  transmutation: 'transmutation',
};

/** The four labelled stat-block fields, in their canonical spelling. */
const FIELD_LABELS = ['Casting Time', 'Range', 'Components', 'Duration'] as const;

/** Structured components parsed from the `Components:` value. */
export interface ParsedComponents {
  verbal: boolean;
  somatic: boolean;
  material?: string;
}

/** A single parsed spell block, before mapping to the catalog shape. */
export interface ParsedSpell {
  name: string;
  level: number;
  school: SpellSchool;
  classes: CastingClassId[];
  castingTime: string;
  range: string;
  components: ParsedComponents;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  effect: string;
  /** Reconcile flags (odd variant matched, suspicious field, OCR glyph, etc.). */
  flags: string[];
}

/**
 * Convert a spell name to its stable kebab-case catalog id.
 *
 * Verified to reproduce every one of the 386 previously-shipped ids (apostrophe
 * cases such as "Hunter's Mark" -> 'hunter-s-mark' and "Mordenkainen's Sword" ->
 * 'mordenkainen-s-sword', and slashes "Antipathy/Sympathy" -> 'antipathy-sympathy'
 * fall out of the single rule below). ID STABILITY is required because ids are
 * persisted in Character.spellcasting and hard-coded in src/logic/spellcasting.ts.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Repair the systematic OCR label corruptions and formatting noise before block
 * analysis, and return the cleaned lines of the Spell Descriptions section.
 *
 * - strips Markdown table pipes and `|---|` separator rows (variant D);
 * - drops image refs and triple-backtick fence markers (keeping inner content);
 * - repairs `CastingTime:` -> `Casting Time:` and `Comp_onents:` -> `Components:`
 *   (and other `Comp[_ ]?onents` spellings);
 * - collapses an OCR-duplicated level/school echo on a single physical line.
 */
export function normaliseLines(markdown: string): string[] {
  const rawLines = markdown.split(/\r?\n/);
  const out: string[] = [];
  for (let line of rawLines) {
    // Drop fence markers but keep their inner content (FIND THE PATH's header is
    // wrapped in a ``` fence; stat blocks inside effects are kept as prose).
    if (/^\s*```/.test(line)) continue;
    // Drop image references entirely.
    if (/^\s*!\[Image\]/.test(line)) continue;

    // Table rows: drop pure separator rows, else strip the surrounding pipes and
    // collapse interior pipes to spaces so a tabled spell reads like a plain one.
    const trimmed = line.trim();
    if (/^\|[-\s|]+\|?$/.test(trimmed)) continue;
    if (trimmed.startsWith('|')) {
      line = trimmed.replace(/^\|/, '').replace(/\|$/, '').replace(/\|/g, ' ');
    }

    // Repair OCR label corruptions (systematic, safe).
    line = line.replace(/CastingTime:/g, 'Casting Time:');
    line = line.replace(/Comp[_ ]?onents:/g, 'Components:');

    // Collapse a line that echoes the level/school signature twice (variant B).
    line = collapseDuplicatedSignature(line);

    out.push(line);
  }
  return out;
}

const SCHOOL_ALTERNATION =
  '(?:Abjuration|Conjuration|Divination|Enchantment|Evocation|Illusion|Necromancy|Transmutation)';
// Signature core: "Level N <School>", "<School> Cantrip", or the OCR-reversed
// "Cantrip <School>" (e.g. Sorcerous Burst's "Cantrip Evocation").
const LEVEL_SCHOOL_CORE = `(?:Level [1-9] ${SCHOOL_ALTERNATION}|${SCHOOL_ALTERNATION} Cantrip|Cantrip ${SCHOOL_ALTERNATION})`;

/**
 * Collapse an OCR-duplicated level/school run on one physical line, e.g.
 * "Level 4 Abjuration (...) Level 4 Abjuration (...)" -> the single run. Also
 * collapses a duplicated bare name echo "## BANISHMENT BANISHMENT".
 */
function collapseDuplicatedSignature(line: string): string {
  // Duplicated "Level N School (list) Level N School (list)" — keep the first.
  const dupLevel = new RegExp(
    `^(##\\s+)?(${LEVEL_SCHOOL_CORE}\\s*\\([^)]*\\))\\s+\\2(.*)$`,
  );
  const m = line.match(dupLevel);
  if (m) {
    const prefix = m[1] ?? '';
    const rest = m[3] ?? '';
    return `${prefix}${m[2]}${rest}`;
  }
  // Duplicated bare name, with or without a heading marker:
  // "## BANISHMENT BANISHMENT" or "SORCEROUS BURST SORCEROUS BURST".
  const dupName = line.match(/^(##\s+)?([A-Z][A-Z'/]+(?:\s[A-Z][A-Z'/]+)*)\s+\2\s*$/);
  if (dupName) return `${dupName[1] ?? ''}${dupName[2]}`;
  return line;
}

/**
 * A level/school signature, e.g. "Level 2 Transmutation (Sorcerer, Wizard)" or
 * "Evocation Cantrip (Sorcerer, Wizard)". The class list in parentheses is
 * required (it is what distinguishes a real header from body prose mentioning a
 * "level 8 or lower spell", per the blueprint's false-positive note).
 */
const SIGNATURE_RE = new RegExp(`(${LEVEL_SCHOOL_CORE})\\s*\\(([^)]*)\\)`);

/** A full header: an optional preceding NAME then the signature. */
interface HeaderMatch {
  name: string;
  level: number;
  school: SpellSchool;
  classes: CastingClassId[];
  /** Any text on the header line(s) AFTER the class-list parenthesis. */
  remainder: string;
  flags: string[];
}

/** Parse the level token into a numeric level (0 for a cantrip). */
function parseLevel(levelToken: string): number {
  const m = levelToken.match(/Level ([1-9])/);
  if (m) return Number(m[1]);
  return 0; // "<School> Cantrip"
}

function parseSchool(signature: string): SpellSchool {
  const lower = signature.toLowerCase();
  for (const word of Object.keys(SCHOOL_WORDS)) {
    if (lower.includes(word)) return SCHOOL_WORDS[word];
  }
  throw new Error(`No school found in signature: ${signature}`);
}

function parseClasses(classList: string): { classes: CastingClassId[]; flags: string[] } {
  const flags: string[] = [];
  const tokens = classList
    .split(/[,/]/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  const classes: CastingClassId[] = [];
  for (const t of tokens) {
    const match = (CASTING_CLASSES as readonly string[]).find((c) => c === t);
    if (match) {
      if (!classes.includes(match as CastingClassId)) classes.push(match as CastingClassId);
    } else {
      flags.push(`unknown-class-token:${t}`);
    }
  }
  return { classes, flags };
}

/**
 * Normalise a name: title-case it from the ALL-CAPS source, preserving
 * apostrophes and slashes. OCR-mangled names (mixed case / stray glyphs) are
 * corrected via the override map, not here.
 */
/**
 * Small words kept lowercase in the middle of a title (never the first word),
 * matching the PHB spell-name convention ("Ray of Frost", "Spare the Dying",
 * "Detect Evil and Good", "Protection from Energy"). Verified to reproduce every
 * one of the 386 previously-shipped spell NAMES exactly, so the displayed name
 * stays stable.
 */
const TITLE_SMALL_WORDS = new Set([
  'of', 'the', 'and', 'or', 'from', 'to', 'with', 'a', 'an', 'in', 'on', 'via',
]);

function titleCaseName(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  const words = cleaned.split(' ');
  return words
    .map((word, wordIndex) =>
      word
        .split('/')
        .map((part) => {
          if (part.length === 0) return part;
          const lower = part.toLowerCase();
          // A small word stays lowercase unless it is the first word of the name.
          if (wordIndex > 0 && TITLE_SMALL_WORDS.has(lower)) return lower;
          return part[0].toUpperCase() + part.slice(1).toLowerCase();
        })
        .join('/'),
    )
    .join(' ');
}

const FIELD_LABEL_RE = /(Casting\s*Time|Range|Components?|Duration):/i;

/** A candidate name line: `## NAME` or a bare name-only line (no field label). */
function nameOnLine(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  const heading = trimmed.match(/^##\s+(.*)$/);
  const candidate = heading ? heading[1].trim() : trimmed;
  if (candidate.length === 0) return null;
  if (FIELD_LABEL_RE.test(candidate)) return null;
  if (SIGNATURE_RE.test(candidate)) return null; // signature-bearing lines handled separately
  if (!isNameToken(candidate)) return null;
  return candidate;
}

/**
 * A spell-name token. Accepts the clean ALL-CAPS form and OCR variants:
 * mixed-case ("CHarm Person"), stray glyphs, and glued words ("ANIMALFRIENDSHIP").
 * Rejects stray noise and field labels. The heuristic: the line is short, made
 * of letters/spaces/apostrophes/slashes/a few stray glyphs, dominated by capital
 * letters, and not a sentence (no trailing period, not many lowercase words).
 */
function isNameToken(s: string): boolean {
  const t = s.trim();
  if (t.length === 0 || t.length > 48) return false;
  if (FIELD_LABEL_RE.test(t)) return false;
  // Allowed characters only: Unicode letters (OCR occasionally leaves a stray
  // accented glyph in an all-caps name, e.g. "PATí"), spaces, apostrophe,
  // slash, hyphen. This still rejects the stray OCR junk lines (punctuation
  // runs, "r,", "v ---"). Such mangled names are corrected by the override map.
  if (!/^[\p{L}][\p{L} '/-]*$/u.test(t)) return false;
  // Starts with a capital and is not a sentence (no 7+ words). Spell names are
  // short titles. Mixed-case OCR mangling (e.g. "CHarm MOnSTER", "Hex") is
  // tolerated because the caller only treats a name line as a header when a
  // level/school signature follows it, and such mangled names are corrected by
  // the cited override map.
  if (!/^[A-Z]/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 6) return false;
  return true;
}

/**
 * A stray OCR-noise line (punctuation runs, dashes, a stray "-", figure
 * fragments) that can sit between a `## NAME` heading and its signature line
 * (e.g. POLYMORPH / MOVE EARTH). Junk = contains no word of 3+ letters.
 */
function isJunkLine(t: string): boolean {
  // A material cost tail like "250+GP)" has no 3-letter word but is NOT junk —
  // it is the scrambled close of a material parenthesis. Preserve any line that
  // contains a cost/consume fragment ending in a close paren.
  if (/\)/.test(t) && /(GP|consumes?)\b/i.test(t)) return false;
  return !/[A-Za-z]{3,}/.test(t);
}

function buildHeader(
  rawName: string,
  sig: RegExpMatchArray,
  sigLine: string,
): HeaderMatch {
  const flags: string[] = [];
  const levelToken = sig[1];
  const classList = sig[2];
  const level = parseLevel(levelToken);
  const school = parseSchool(levelToken);
  const { classes, flags: classFlags } = parseClasses(classList);
  flags.push(...classFlags);
  // Remainder = whatever follows the class-list parenthesis on the signature line.
  const sigEnd = (sig.index ?? 0) + sig[0].length;
  const remainder = sigLine.slice(sigEnd).trim();
  return { name: titleCaseName(rawName), level, school, classes, remainder, flags };
}

/**
 * Split a run of text that may cram several labelled fields on one physical line
 * into a map of label -> value. Handles the "all four on one line" cram
 * (variant C) by splitting on the known labels.
 */
function splitFields(text: string): Array<{ label: string; value: string }> {
  const labelAlternation = FIELD_LABELS.map((l) =>
    l.replace(/ /g, '\\s*').replace(/^Components$/, 'Components?'),
  ).join('|');
  const labelRe = new RegExp(`(${labelAlternation}):`, 'g');
  // Record each label match: where the label starts, and where its value starts.
  const marks: Array<{ label: string; labelStart: number; valueStart: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(text)) !== null) {
    marks.push({
      label: canonLabel(m[1]),
      labelStart: m.index,
      valueStart: m.index + m[0].length,
    });
  }
  const result: Array<{ label: string; value: string }> = [];
  for (let k = 0; k < marks.length; k++) {
    const start = marks[k].valueStart;
    // The value runs up to the start of the NEXT label (or end of text).
    const end = k + 1 < marks.length ? marks[k + 1].labelStart : text.length;
    result.push({ label: marks[k].label, value: text.slice(start, end).trim() });
  }
  return result;
}

function canonLabel(raw: string): string {
  const normalised = raw.replace(/\s+/g, ' ').trim();
  if (/casting\s*time/i.test(normalised)) return 'Casting Time';
  if (/range/i.test(normalised)) return 'Range';
  if (/components?/i.test(normalised)) return 'Components';
  if (/duration/i.test(normalised)) return 'Duration';
  return normalised;
}

/** Parse the `Components:` value into structured verbal/somatic/material. */
function parseComponents(value: string): { components: ParsedComponents; flags: string[] } {
  const flags: string[] = [];
  const parenIdx = value.indexOf('(');
  const letters = (parenIdx === -1 ? value : value.slice(0, parenIdx)).toUpperCase();
  const verbal = /\bV\b/.test(letters);
  const somatic = /\bS\b/.test(letters);
  const hasMaterial = /\bM\b/.test(letters);
  let material: string | undefined;
  if (parenIdx !== -1) {
    const close = value.lastIndexOf(')');
    if (close > parenIdx) {
      material = value.slice(parenIdx + 1, close).replace(/\s+/g, ' ').trim();
    } else {
      material = value.slice(parenIdx + 1).replace(/\s+/g, ' ').trim();
      flags.push('unbalanced-material-paren');
    }
  }
  if (hasMaterial && material === undefined) flags.push('material-letter-without-paren');
  return { components: { verbal, somatic, material }, flags };
}

/**
 * Lightly normalise whitespace/hyphenation in carried prose (never synthesize),
 * and drop stray OCR-noise lines (e.g. "r,", "v ---", bare punctuation runs)
 * that sit between blocks. A line is kept only if it contains a real word
 * (two+ consecutive letters); everything carried is otherwise verbatim.
 */
function normaliseProse(text: string): string {
  const kept = text
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (t.length === 0) return true; // preserve paragraph breaks
      return /[A-Za-z]{2,}/.test(t);
    })
    .join('\n');
  return kept
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse the whole Spell Descriptions markdown into structured spell blocks.
 *
 * Block detection is by the NAME+level/school SIGNATURE (variant E), not by the
 * Markdown `##` heading, which is the single rule that fixes the text-bleed
 * between adjacent spells (Dispel Magic <- Dissonant Whispers).
 */
export function parseSpellBlocks(markdown: string): ParsedSpell[] {
  const section = sliceSection(markdown);
  const lines = normaliseLines(section);

  // 1) Anchor on every SIGNATURE line (the reliable block delimiter). For each
  //    signature we resolve the spell NAME, which is either inline on the same
  //    line before the signature, or on the nearest preceding name line (a
  //    `## NAME` heading or a bare name-only line) looking back a few lines past
  //    any interleaved field lines (variant: MAGE HAND / RAY OF SICKNESS put a
  //    field line between the name and the signature).
  interface Anchor {
    nameLine: number; // index of the line the block begins at (name or signature)
    sigLine: number;
    header: HeaderMatch;
  }
  const anchors: Anchor[] = [];

  for (let i = 0; i < lines.length; i++) {
    const sig = lines[i].match(SIGNATURE_RE);
    if (!sig) continue;

    // (a) Inline: "NAME <signature> ...". Name precedes the signature on this line.
    const before = lines[i].slice(0, sig.index).replace(/^##\s+/, '').trim();
    if (before.length > 0 && isNameToken(before)) {
      anchors.push({ nameLine: i, sigLine: i, header: buildHeader(before, sig, lines[i]) });
      continue;
    }

    // (b) Name on a preceding line. Walk back over blank/field lines (up to a
    //     small window) to the nearest name line.
    let nameIdx = -1;
    for (let j = i - 1, steps = 0; j >= 0 && steps < 6; j--, steps++) {
      const t = lines[j].trim();
      if (t.length === 0) continue;
      if (FIELD_LABEL_RE.test(t)) continue; // field line between name and signature
      const name = nameOnLine(lines[j]);
      if (name) {
        nameIdx = j;
        break;
      }
      if (isJunkLine(t)) continue; // stray OCR noise between name and signature
      // A real prose line (the previous block's effect) — stop looking back.
      break;
    }
    if (nameIdx !== -1) {
      const name = nameOnLine(lines[nameIdx])!;
      anchors.push({ nameLine: nameIdx, sigLine: i, header: buildHeader(name, sig, lines[i]) });
    }
  }

  // 2) Each block runs from its name line to the line before the next block's
  //    name line. Field lines that appeared BEFORE the signature (variant MAGE
  //    HAND) are inside [nameLine, next) so buildSpell still sees them.
  const spells: ParsedSpell[] = [];
  for (let a = 0; a < anchors.length; a++) {
    const { nameLine, sigLine, header } = anchors[a];
    const blockEnd = a + 1 < anchors.length ? anchors[a + 1].nameLine : lines.length;
    // Body = everything in the block except the name line and the signature line
    // itself; collect field lines and prose from both (name..sig) and (sig..end).
    const body: string[] = [];
    for (let k = nameLine + 1; k < blockEnd; k++) {
      if (k === sigLine) continue;
      body.push(lines[k]);
    }
    spells.push(buildSpell(header, body));
  }
  return spells;
}

/** Slice out the Spell Descriptions section (lines ~10845-17851). */
export function sliceSection(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s+SPELL DESCRIPTIONS/.test(l));
  if (start === -1) throw new Error('Could not find "## SPELL DESCRIPTIONS" heading');
  const end = lines.findIndex((l, i) => i > start && /^##\s+THE MULTIVERSE/.test(l));
  const sliceEnd = end === -1 ? lines.length : end;
  return lines.slice(start + 1, sliceEnd).join('\n');
}

/** Build a ParsedSpell from a detected header and its body lines. */
function buildSpell(header: HeaderMatch, bodyLines: string[]): ParsedSpell {
  const flags = [...header.flags];

  // The field text is: the header line remainder (fields crammed after the
  // class list) + body lines, up to where the effect prose begins. We collect
  // lines into the field region until all four fields are seen (Components may
  // wrap across lines until its parenthesis balances), then the rest is effect.
  // Build the field map by walking the body. Each field-label line contributes
  // one or more label->value pairs (a crammed line carries several). The special
  // case is a Components value whose material parenthesis is left OPEN at the end
  // of its line (variant: Revivify / Resurrection / Augury): its value continues
  // on following lines until the paren balances. An intervening field-label line
  // (e.g. a Duration line printed BETWEEN the two halves of the material, as in
  // Augury) is captured as its own field and NOT folded into the material.
  const fieldMap = new Map<string, string>();
  const setField = (label: string, value: string): void => {
    if (!fieldMap.has(label)) fieldMap.set(label, value.trim());
  };

  const seed: string[] = [];
  if (header.remainder.length > 0 && FIELD_LABEL_RE.test(header.remainder)) {
    seed.push(header.remainder);
  }
  const scan: string[] = [...seed, ...bodyLines];

  // We scan the WHOLE block (not stopping at the first prose line), pulling out
  // every field-label line wherever it appears and treating everything else as
  // prose in source order. This tolerates the handful of blocks where a field
  // line follows the first prose paragraph (e.g. Storm of Vengeance prints its
  // effect before its stat block) or where fields are interleaved. A Components
  // value whose material parenthesis is left OPEN continues onto following
  // non-field lines until it balances (Revivify/Resurrection/Augury).
  const proseParts: string[] = [];
  let openComponents: { value: string; joined: number } | null = null;
  let pendingOpenComponents: string | null = null;
  // A legitimate wrapped material value closes within a line or two (Revivify,
  // Resurrection, Augury). If the parenthesis has not balanced after this many
  // continuation lines, the source is scrambled (the close was printed before
  // the open, or lost); give up rather than swallow the effect prose. Such
  // records are flagged and handled by the cited override map.
  const MAX_MATERIAL_CONTINUATION = 3;

  for (let i = 0; i < scan.length; i++) {
    const trimmed = scan[i].trim();

    if (openComponents) {
      if (trimmed.length === 0 || isJunkLine(trimmed)) continue;
      if (FIELD_LABEL_RE.test(trimmed)) {
        // A field line printed in the middle of the wrapping material. Any text
        // before its first label is the material close fragment (Summon
        // Elemental prints "...400+ GP)" glued ahead of "Duration:"); append it
        // to the open material. Then record the line's fields.
        const firstLabel = trimmed.search(FIELD_LABEL_RE);
        if (firstLabel > 0) {
          const prefix = trimmed.slice(0, firstLabel).trim();
          if (prefix.length > 0) {
            openComponents.value += ` ${prefix}`;
            if (balancedParens(openComponents.value)) {
              setField('Components', openComponents.value);
              openComponents = null;
            }
          }
        }
        for (const f of splitFields(trimmed)) setField(f.label, f.value);
        continue;
      }
      // A legitimate material continuation is a SHORT phrase that closes (or
      // moves toward closing) the parenthesis — not a prose sentence. If the
      // next line looks like effect prose (long, or a sentence ending in a
      // period that does not close the paren), stop joining so we never swallow
      // the effect; the post-loop repair pass will reunite a close fragment that
      // was scrambled onto another line.
      // A legitimate material continuation is a SHORT phrase (a cost tail).
      // A long line — even one containing parentheses like "(Perception)" — is
      // effect prose, not a material continuation.
      const looksLikeProse = trimmed.length > 50;
      if (looksLikeProse) {
        // This line is effect prose, not a material continuation. Leave the
        // Components value OPEN (unbalanced) for the post-loop repair pass, and
        // keep this line as prose.
        pendingOpenComponents = openComponents.value;
        openComponents = null;
        proseParts.push(trimmed);
        continue;
      }
      openComponents.value += ` ${trimmed}`;
      openComponents.joined += 1;
      if (balancedParens(openComponents.value)) {
        setField('Components', openComponents.value);
        openComponents = null;
      } else if (openComponents.joined >= MAX_MATERIAL_CONTINUATION) {
        pendingOpenComponents = openComponents.value;
        openComponents = null;
      }
      continue;
    }

    if (trimmed.length === 0) {
      if (proseParts.length > 0) proseParts.push('');
      continue;
    }
    if (isJunkLine(trimmed)) continue;

    if (FIELD_LABEL_RE.test(trimmed)) {
      // Text printed BEFORE the first field label on this line is a scrambled
      // fragment (e.g. Summon Elemental's "...worth 400+ GP)" printed ahead of a
      // glued "Duration:"). Offer it to the repair pass as a candidate close.
      const firstLabel = trimmed.search(FIELD_LABEL_RE);
      if (firstLabel > 0) {
        const prefix = trimmed.slice(0, firstLabel).trim();
        if (prefix.length > 0 && !isJunkLine(prefix)) proseParts.push(prefix);
      }
      const parts = splitFields(trimmed);
      for (let p = 0; p < parts.length; p++) {
        const { label, value } = parts[p];
        const isLastOnLine = p === parts.length - 1;
        if (label === 'Components' && isLastOnLine && !balancedParens(value)) {
          openComponents = { value, joined: 0 };
        } else {
          setField(label, value);
        }
      }
      continue;
    }

    // A prose line.
    proseParts.push(trimmed);
  }

  // Reconcile any Components value whose material parenthesis is still open. In
  // the scrambled two-column blocks the CLOSE fragment was printed on a separate
  // line (before OR after the open, e.g. Continual Flame, Symbol, Mordenkainen's
  // Sword). Find the prose fragment that, appended, BALANCES the parenthesis and
  // carries material vocabulary, splice it into the material, and remove it from
  // the effect. This recovers the material verbatim without a hand-edit.
  const unbalancedOpen = openComponents?.value ?? pendingOpenComponents;
  if (unbalancedOpen) {
    const repaired = repairScrambledMaterial(unbalancedOpen, proseParts);
    if (repaired) {
      fieldMap.set('Components', repaired.material.trim());
      proseParts.splice(repaired.index, 1);
    } else {
      setField('Components', unbalancedOpen);
      flags.push('unbalanced-material-paren');
    }
  }

  const rawCasting = fieldMap.get('Casting Time') ?? '';
  const rangeVal = fieldMap.get('Range') ?? '';
  const componentsVal = fieldMap.get('Components') ?? '';
  const duration = tidyFieldValue(fieldMap.get('Duration') ?? '');

  // Ritual lives inside Casting Time ("... or Ritual"); strip the suffix.
  const ritual = /\bor Ritual\b/i.test(rawCasting);
  const castingTime = tidyFieldValue(rawCasting.replace(/\s*or Ritual\b/i, '').trim());

  const range = tidyFieldValue(rangeVal);
  const { components, flags: compFlags } = parseComponents(componentsVal);
  flags.push(...compFlags);

  const concentration = /^Concentration/i.test(duration);

  for (const label of FIELD_LABELS) {
    if (!fieldMap.has(label) || (fieldMap.get(label) ?? '').length === 0) {
      flags.push(`missing-field:${label}`);
    }
  }

  const effect = normaliseProse(proseParts.join('\n'));
  if (effect.length === 0) flags.push('empty-effect');
  if (effect.length < 40) flags.push('short-effect');
  if (/\b(ld\d|[0-9]o\b|O-foot)/.test(effect)) flags.push('possible-ocr-digit-glyph');

  return {
    name: header.name,
    level: header.level,
    school: header.school,
    classes: header.classes,
    castingTime,
    range,
    components,
    duration,
    concentration,
    ritual,
    effect,
    flags,
  };
}

/**
 * Repair a scrambled material value whose closing parenthesis was printed on a
 * separate prose line (the two-column OCR scramble). Searches proseParts for the
 * fragment that balances the open value; returns the merged material and the
 * index of the fragment to drop from the effect, or null if none fits.
 */
function repairScrambledMaterial(
  openValue: string,
  proseParts: string[],
): { material: string; index: number } | null {
  for (let i = 0; i < proseParts.length; i++) {
    const frag = proseParts[i].trim();
    if (frag.length === 0 || !frag.includes(')')) continue;
    // A material close fragment is SHORT (a cost tail), not a prose sentence.
    if (frag.length > 60) continue;
    // It reads like the tail of a material clause: a cost (digits + GP), a
    // "which/worth/inside ..." continuation, or a bare close — never a sentence.
    const headBeforeClose = frag.slice(0, frag.indexOf(')'));
    const looksLikeMaterialTail =
      /\bGP\b/.test(headBeforeClose) ||
      /^(which|worth|inside|that|the spell consumes)\b/i.test(frag) ||
      /^\d/.test(frag);
    if (!looksLikeMaterialTail) continue;
    const combined = `${openValue} ${headBeforeClose})`;
    if (balancedParens(combined)) {
      // Keep only up to the first close paren of the fragment; anything after it
      // on that line is separate (e.g. a glued Duration) and handled elsewhere.
      return { material: combined, index: i };
    }
  }
  return null;
}

/**
 * Collapse whitespace in a short field value (range/duration/casting time) and
 * repair the systematic OCR glue of a number directly against its unit
 * ("100feet" -> "100 feet", "1round" -> "1 round"). This is a safe, purely
 * structural fix: the digits and unit are carried unchanged, only the missing
 * space is restored.
 */
function tidyFieldValue(v: string): string {
  return v
    .replace(/\s+/g, ' ')
    .replace(/(\d)(feet|foot|mile|miles|round|rounds|minute|minutes|hour|hours|day|days)\b/gi, '$1 $2')
    // OCR glue of "up to" against the number ("up to1 minute" -> "up to 1 minute").
    .replace(/\bto(\d)/gi, 'to $1')
    .trim();
}

function balancedParens(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
  }
  return depth === 0;
}
