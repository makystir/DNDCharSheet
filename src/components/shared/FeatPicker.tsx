import { useEffect, useMemo, useState } from 'react';
import type { Character } from '../../types/character';
import { allFeats, type FeatData, type FeatCategory } from '../../data/feats';
import { canTakeFeat, type FeatBlockReason } from '../../logic/feats';
import { resolveFeatTooltip } from '../../logic/tooltip-content';
import styles from './FeatPicker.module.css';

export interface FeatPickerProps {
  /** The character the eligibility gate (canTakeFeat) is evaluated against. */
  character: Character;
  /** The slot level the chosen feat will fill (shown in the title). */
  slotLevel: number;
  /**
   * Which feat categories to list. Defaults to the ASI-slot categories: Fighting
   * Style feats are chosen through the class Fighting Style feature (Advancement
   * page), not in an Ability Score Improvement slot.
   */
  categories?: FeatCategory[];
  /** Heading override (e.g. the Fighting Style pick). */
  title?: string;
  /** Called with the chosen feat id when the player selects an eligible feat. */
  onSelect: (featId: string) => void;
  onClose: () => void;
}

/** Human-readable category group headings (PHB 2024 "Parts of a Feat"). */
const CATEGORY_LABEL: Record<FeatCategory, string> = {
  origin: 'Origin Feats',
  general: 'General Feats',
  'fighting-style': 'Fighting Style Feats',
  'epic-boon': 'Epic Boon Feats',
};

/** Stable category render order. */
const CATEGORY_ORDER: FeatCategory[] = ['general', 'origin', 'fighting-style', 'epic-boon'];

/**
 * The categories offered in an Ability Score Improvement slot. Fighting Style feats
 * are included because RAW lets a level-up feat be any feat you qualify for (PHB
 * 2024 L2499, L8340) and a Fighter, Paladin or Ranger meets the Fighting Style
 * Feature prerequisite (L9068+); canTakeFeat still gates them for other classes.
 * The class Fighting Style feature has its own slot on Advancement.
 */
const ASI_SLOT_CATEGORIES: FeatCategory[] = ['general', 'origin', 'fighting-style', 'epic-boon'];

/** The reason text shown on an ineligible (disabled) feat. */
function blockReasonText(reason: FeatBlockReason | undefined, feat: FeatData): string {
  switch (reason) {
    case 'level':
      return `Requires level ${feat.prerequisite?.minLevel ?? '?'}`;
    case 'ability':
      return 'Ability score prerequisite not met';
    case 'armor-training': {
      const kind = feat.prerequisite?.armorTraining;
      return `Requires ${kind === 'shield' ? 'Shield' : (kind ?? 'armor')} training`;
    }
    case 'spellcasting':
      return feat.prerequisite?.spellcasting === 'spellcasting'
        ? 'Requires the Spellcasting feature'
        : 'Requires Spellcasting or Pact Magic';
    case 'fighting-style':
      return 'Requires a Fighting Style feature';
    case 'already-taken':
      return 'Already taken (not repeatable)';
    default:
      return 'Unavailable';
  }
}

/**
 * The feat picker modal (Stage A6b). Mirrors the SpellPicker / Picker UX
 * (ui-parity): a scroll-locked overlay + modal with a search box, items grouped
 * by category, ineligible feats shown disabled WITH their reason, and clicking
 * an eligible feat expanding to show the content-tooltip detail (category,
 * prerequisite, benefit, source from resolveFeatTooltip) plus a Select button.
 *
 * NO rule is computed here: eligibility comes from canTakeFeat and the detail
 * from resolveFeatTooltip (content-tooltips steering).
 */
export function FeatPicker({
  character,
  slotLevel,
  categories = ASI_SLOT_CATEGORIES,
  title,
  onSelect,
  onClose,
}: FeatPickerProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const searchLower = search.toLowerCase();

  // Blocking overlay: close on Escape for parity with the app's richer dialogs.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const feats = useMemo(() => allFeats(), []);

  const groups = useMemo(() => {
    return CATEGORY_ORDER.filter((c) => categories.includes(c))
      .map((category) => ({
        category,
        items: feats
          .filter((f) => f.category === category)
          .filter((f) => f.name.toLowerCase().includes(searchLower))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((g) => g.items.length > 0);
  }, [feats, searchLower, categories]);

  const handleFeatClick = (feat: FeatData, eligible: boolean) => {
    if (!eligible) return;
    if (expanded === feat.id) onSelect(feat.id);
    else setExpanded(feat.id);
  };

  const renderFeat = (feat: FeatData) => {
    const gate = canTakeFeat(character, feat.id);
    const eligible = gate.ok;
    const isExpanded = expanded === feat.id;
    const content = resolveFeatTooltip(feat.id);

    return (
      <div key={feat.id}>
        <button
          type="button"
          className={`${styles.item} ${eligible ? '' : styles.itemDisabled}`}
          onClick={() => handleFeatClick(feat, eligible)}
          aria-disabled={eligible ? undefined : 'true'}
          aria-expanded={isExpanded}
        >
          <span className={styles.featName}>{feat.name}</span>
          <span className={styles.featCategory}>{CATEGORY_LABEL[feat.category]}</span>
          {!eligible && (
            <span className={styles.blockReason}>{blockReasonText(gate.reason, feat)}</span>
          )}
        </button>
        {isExpanded && eligible && content && (
          <div className={styles.detail}>
            {content.sections.map((s, i) => (
              <div key={i} className={styles.detailRow}>
                <span className={styles.detailLabel}>{s.label}</span>
                <span className={styles.detailText}>{s.text}</span>
              </div>
            ))}
            <button type="button" className={styles.selectBtn} onClick={() => onSelect(feat.id)}>
              Select {feat.name}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? `Choose a feat for level ${slotLevel}`}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{title ?? `Choose a feat — level ${slotLevel}`}</h3>
        <input
          type="text"
          placeholder="Search feats..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.search}
          aria-label="Search feats"
          autoFocus
        />
        <div className={styles.list}>
          {groups.length === 0 ? (
            <div className={styles.emptyMessage}>No feats found</div>
          ) : (
            groups.map((group) => (
              <div
                key={group.category}
                role="group"
                aria-label={CATEGORY_LABEL[group.category]}
                className={styles.group}
              >
                <div className={styles.groupHeader} aria-hidden="true">
                  {CATEGORY_LABEL[group.category]}
                </div>
                {group.items.map(renderFeat)}
              </div>
            ))
          )}
        </div>
        <button type="button" onClick={onClose} className={styles.close}>
          Close
        </button>
      </div>
    </div>
  );
}
