import { useState } from 'react';
import { Compass } from 'lucide-react';
import type { Character } from '../../../types/character';
import type { Breakdown } from '../../../logic/breakdown';
import type { TooltipContent } from '../../../logic/tooltip-content';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { CalculatedValue } from '../../shared/CalculatedValue';
import { ContentTooltip } from '../../shared/ContentTooltip';
import { ScrollLink } from '../../shared/ScrollLink';
import { levelingMode, canLevelUp } from '../../../logic/advancement';
import {
  advisorSuggestions,
  type AdvisorSuggestionId,
  sessionsToNextLevel,
  xpProgress,
} from '../../../logic/advancement-advisor';
import styles from './ProgressionAdvisor.module.css';

export interface ProgressionAdvisorProps {
  character: Character;
}

/** A sensible default XP-per-session rate (a planning aid, not a rulebook value). */
const DEFAULT_RATE = 100;

/**
 * The Progression Advisor panel (Stage A6c). READ-ONLY: it shows the XP-progress
 * projection (XP mode) with a progress bar, a calculated-total tooltip breaking
 * down current-level XP + XP into level and the XP-to-next, a sessions-to-next
 * planning aid with a UI rate input, and the deterministic advisor suggestions
 * as short, PHB-cited prompts. In milestone mode it shows the milestone
 * explanation and the can-level-up prompt (no XP math).
 *
 * Mirrors the WFRP source app's progression-advisor UX (a read-only "where am I
 * / what should I do next" panel on the advancement surface). Every real XP
 * award / level-up stays on the A6a controls elsewhere on the page.
 *
 * Every displayed total is a CalculatedValue breakdown (calculated-totals
 * steering); named suggestions/milestone text are ContentTooltips (content-
 * tooltips steering). No rule is computed here — all values come from
 * logic/advancement-advisor.ts and logic/advancement.ts.
 */
export function ProgressionAdvisor({ character }: ProgressionAdvisorProps) {
  const [rateInput, setRateInput] = useState(String(DEFAULT_RATE));

  const mode = levelingMode(character);
  const progress = xpProgress(character);
  const suggestions = advisorSuggestions(character);

  const rate = Number(rateInput);
  const sessions = sessionsToNextLevel(character, rate);

  // ── Milestone mode: no XP math, just the mode explanation + level-up prompt.
  if (mode !== 'xp') {
    return (
      <Card>
        <SectionHeader icon={Compass} title="Progression Advisor" />
        <p className={styles.modeNote}>
          Milestone mode: the DM grants levels at story milestones, so there is no XP progress to
          track (PHB 2024 &ldquo;Character Advancement&rdquo;).
        </p>
        {canLevelUp(character) ? (
          <p className={styles.milestonePrompt}>You can level up: use the Next Level controls below.{' '}<ScrollLink className={styles.suggestionLink} targetId="adv-section-next-level" fallbackHref="#advancement">Go to Next Level</ScrollLink></p>
        ) : (
          <p className={styles.modeNote}>You are at the level cap (20).</p>
        )}
        {/* The milestone prompt above already states the can-level-up message, so
            drop the duplicate 'can-level-up' suggestion from the list here. */}
        <SuggestionList suggestions={suggestions.filter((s) => s.id !== 'can-level-up')} />
      </Card>
    );
  }

  // ── XP mode: progress bar + calculated totals + sessions projection. ────────
  const percent = Math.round(progress.fractionToNext * 100);

  // PHB 2024 "Character Advancement" (via A6a): xp = currentLevelXp + xpIntoLevel.
  const xpBreakdown: Breakdown = {
    total: progress.currentLevelXp + progress.xpIntoLevel,
    components: [
      { label: `Level ${character.level} threshold`, value: progress.currentLevelXp },
      { label: 'XP into this level', value: progress.xpIntoLevel },
    ],
  };

  // xpToNext = nextLevelXp - (currentLevelXp + xpIntoLevel). Shown as an additive
  // breakdown toward the next threshold (null at the cap).
  const toNextBreakdown: Breakdown | null =
    progress.xpToNext === null || progress.nextLevelXp === null
      ? null
      : {
          total: progress.xpToNext,
          components: [
            { label: `Level ${character.level + 1} threshold`, value: progress.nextLevelXp },
            { label: 'Current XP', value: -(progress.currentLevelXp + progress.xpIntoLevel) },
          ],
        };

  // Sessions-to-next is a DIVISION (ceil(xpToNext ÷ rate)), not an additive sum,
  // so it is presented as a ContentTooltip rather than a CalculatedValue — a
  // summing Breakdown would violate the "components sum to total" invariant
  // (breakdown.ts: XP-to-next and a session count cannot be addends of a session
  // total). This mirrors the XP-permitted-level control on this page, which uses
  // the same ContentTooltip treatment for its threshold lookup. Not a rulebook
  // value — a planning aid at the UI-supplied rate.
  const sessionsTooltip: TooltipContent | null =
    sessions === null || progress.xpToNext === null || rate <= 0
      ? null
      : {
          title: 'Sessions to next level',
          sections: [
            {
              label: 'Formula',
              text: `ceil(XP to next ÷ XP per session) = ceil(${progress.xpToNext} ÷ ${rate}) = ${sessions}.`,
            },
            {
              label: 'Note',
              text: 'A planning aid at the XP-per-session rate you set above — not a rulebook value.',
            },
          ],
        };

  return (
    <Card>
      <SectionHeader icon={Compass} title="Progression Advisor" />

      {progress.atCap ? (
        <p className={styles.modeNote}>At the level cap (20). No further XP progress to track.</p>
      ) : (
        <>
          <div className={styles.progressRow}>
            <div
              className={styles.progressBar}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={`Progress to level ${character.level + 1}`}
            >
              <div className={styles.progressFill} style={{ width: `${percent}%` }} />
            </div>
            <span className={styles.percentLabel}>{percent}%</span>
          </div>

          <div className={styles.totalsRow}>
            <div className={styles.total}>
              <span className={styles.totalLabel}>Current XP</span>
              <CalculatedValue label="Current XP" breakdown={xpBreakdown}>
                {xpBreakdown.total}
              </CalculatedValue>
            </div>

            {toNextBreakdown && (
              <div className={styles.total}>
                <span className={styles.totalLabel}>XP to level {character.level + 1}</span>
                <CalculatedValue label="XP to next level" breakdown={toNextBreakdown}>
                  {toNextBreakdown.total}
                </CalculatedValue>
              </div>
            )}
          </div>

          {/* Sessions-to-next planning aid (not a rulebook value). */}
          <div className={styles.sessionsRow}>
            <label className={styles.rateField}>
              <span className={styles.totalLabel}>XP per session</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={rateInput}
                aria-label="XP per session"
                onChange={(e) => setRateInput(e.target.value)}
                className={styles.rateInput}
              />
            </label>
            <div className={styles.total}>
              <span className={styles.totalLabel}>Sessions to next</span>
              {sessionsTooltip ? (
                <ContentTooltip content={sessionsTooltip}>{sessions}</ContentTooltip>
              ) : (
                <span className={styles.muted}>{sessions === 0 ? '0' : '—'}</span>
              )}
            </div>
          </div>
        </>
      )}

      <SuggestionList suggestions={suggestions} />
    </Card>
  );
}

/**
 * Where each suggestion can be acted on. A suggestion that names an action gets a
 * link to the place that does it: another page (`href`) or a section of this
 * page (`targetId`, scrolled to and focused). 'pb-increases-next' only informs,
 * with nothing to do, so it has no link.
 */
type SuggestionLink =
  | { href: string; text: string }
  | { targetId: string; text: string };

const SUGGESTION_LINKS: Partial<Record<AdvisorSuggestionId, SuggestionLink>> = {
  // The Subclass select is on the Character page's Class & Features tab.
  'choose-subclass': { href: '#character/build', text: 'Choose on Class & Features' },
  // Feats are picked in the Feats & Ability Score Improvements section below.
  'pending-feat-slot': { targetId: 'adv-section-feats', text: 'Choose in Feats & ASIs' },
  // Levels are applied from the Next Level section below.
  'can-level-up': { targetId: 'adv-section-next-level', text: 'Go to Next Level' },
  'level-earned-unapplied': { targetId: 'adv-section-next-level', text: 'Go to Next Level' },
};

function SuggestionAction({ id }: { id: AdvisorSuggestionId }) {
  const link = SUGGESTION_LINKS[id];
  if (!link) return null;
  return (
    <>
      {' '}
      {'targetId' in link ? (
        <ScrollLink
          className={styles.suggestionLink}
          targetId={link.targetId}
          fallbackHref="#advancement"
        >
          {link.text}
        </ScrollLink>
      ) : (
        <a className={styles.suggestionLink} href={link.href}>
          {link.text}
        </a>
      )}
    </>
  );
}
/** The deterministic suggestion prompts as a list of cited ContentTooltips. */
function SuggestionList({ suggestions }: { suggestions: ReturnType<typeof advisorSuggestions> }) {
  if (suggestions.length === 0) {
    return <p className={styles.modeNote}>No suggestions right now.</p>;
  }
  return (
    <ul className={styles.suggestionList} aria-label="Advisor suggestions">
      {suggestions.map((s) => (
        <li key={s.id} className={styles.suggestionItem}>
          <ContentTooltip content={s.content}>{s.title}</ContentTooltip>
          <SuggestionAction id={s.id} />
        </li>
      ))}
    </ul>
  );
}
