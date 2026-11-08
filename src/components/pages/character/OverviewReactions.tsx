import { useState } from 'react';
import { Zap } from 'lucide-react';
import type { Character } from '../../../types/character';
import {
  availableReactions,
  isReactionBlocked,
  isReactionSpent,
} from '../../../logic/reactions';
import type { ReactionEntry, ReactionKind, ReactionUnavailable } from '../../../logic/reactions';
import type { TooltipContent } from '../../../logic/tooltip-content';
import { Card } from '../../shared/Card';
import { MaybeContentTooltip } from '../../shared/ContentTooltip';
import { resolveSpellTooltip } from '../../../logic/tooltip-content';
import { SPELL_CATALOG } from '../../../data/spells';
import { SectionHeader } from '../../shared/SectionHeader';
import { OverviewEmpty, OverviewFooter } from './OverviewShared';
import styles from './OverviewReactions.module.css';

/** Tooltip for a reaction: the full spell tooltip for spells, else its origin, effect and source. */
function reactionTooltip(entry: ReactionEntry): TooltipContent | null {
  if (entry.kind === 'spell') {
    const spell = SPELL_CATALOG.find((s) => s.name === entry.name);
    const tip = spell ? resolveSpellTooltip(spell.id) : null;
    if (tip) return tip;
  }
  const sections: TooltipContent['sections'] = [];
  if (entry.origin) sections.push({ label: 'From', text: entry.origin });
  sections.push({ label: 'Effect', text: entry.summary });
  if (entry.source) sections.push({ label: 'Source', text: entry.source });
  return { title: entry.name, sections };
}

export interface OverviewReactionsProps {
  character: Character;
}

const KIND_LABEL: Record<ReactionKind, string> = {
  universal: 'Universal',
  'class-feature': 'Class feature',
  'subclass-feature': 'Subclass feature',
  feat: 'Feat',
  'fighting-style': 'Fighting Style feat',
  species: 'Species',
  'class-choice': 'Class choice',
  spell: 'Spell',
};

const REASON_TEXT: Record<ReactionUnavailable, string> = {
  incapacitated: 'Incapacitated',
  spent: 'Reaction already used',
  'no-uses': 'No uses left',
  'no-slot': 'No spell slot available',
};

/** One-line text that expands on demand (keyboard accessible button). */
function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <p className={expanded ? styles.text : `${styles.text} ${styles.clamped}`}>{text}</p>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </>
  );
}

function statusText(character: Character): string {
  if (isReactionBlocked(character)) return "Can't take Reactions (Incapacitated)";
  if (isReactionSpent(character)) return 'Reaction used this round';
  return 'Reaction available';
}

/**
 * Read-only mirror of the Reactions the character has access to. All
 * availability logic lives in logic/reactions; the Reaction-used flag is managed
 * on Combat.
 */
export function OverviewReactions({ character }: OverviewReactionsProps) {
  const entries = availableReactions(character);
  return (
    <Card>
      <SectionHeader icon={Zap} title="Reactions" />
      <p className={styles.status} role="status" data-testid="overview-reaction-status">
        {statusText(character)}
      </p>
      {entries.length === 0 ? (
        <OverviewEmpty text="No reactions available" />
      ) : (
        <ul className={styles.list}>
          {entries.map((entry: ReactionEntry) => (
            <li
              key={`${entry.kind}-${entry.name}`}
              className={entry.unavailable ? `${styles.item} ${styles.unavailable}` : styles.item}
              data-testid="overview-reaction"
            >
              <span className={styles.head}>
                <span className={styles.name}>
                  <MaybeContentTooltip content={reactionTooltip(entry)}>{entry.name}</MaybeContentTooltip>
                </span>
                <span className={styles.tag}>
                  {KIND_LABEL[entry.kind]}
                  {entry.origin ? ` \u00B7 ${entry.origin}` : ''}
                  {entry.spellLevel !== undefined ? ` \u00B7 Level ${entry.spellLevel}` : ''}
                </span>
                {entry.unavailable && (
                  <span className={styles.reason}>{REASON_TEXT[entry.unavailable]}</span>
                )}
              </span>
              <ExpandableText text={entry.summary} />
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>Absorb Elements and the Ready action are not listed.</p>
      <OverviewFooter links={[{ href: '#combat', text: 'Reaction used? Manage on Combat' }]} />
    </Card>
  );
}
