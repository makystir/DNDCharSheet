import { useId, useState } from 'react';
import type { Character } from '../../../types/character';
import { ALIGNMENTS } from '../../../types/character';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { EditableField } from '../../shared/EditableField';
import { ContentTooltip } from '../../shared/ContentTooltip';
import type { TooltipContent } from '../../../logic/tooltip-content';
import { CharacterPortrait } from '../../shared/CharacterPortrait';
import { DEITY_LIST } from '../../../data/deities';
import { getBackground } from '../../../data/backgrounds';
import { srdBadge } from '../sheet-helpers';
import { User, Sparkles } from 'lucide-react';
import { PortraitPromptDialog } from '../../shared/PortraitPromptDialog';
import type { NameGender } from '../../../data/name-tables';
import {
  generateName,
  generateAppearance,
  generateAge,
  generatePersonality,
} from '../../../logic/personal-details-generation';
import { createDefaultRng } from '../../../logic/random';
import styles from './PersonalDetailsSection.module.css';

interface PersonalDetailsSectionProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Object URL for the portrait, or '' for none (owned by the shell's usePortrait). */
  portraitURL: string;
  onPortraitUpload: (file: File) => void;
  onPortraitRemove: () => void;
}

/**
 * Portrait + Personal Details card for the Character page Overview sub-tab.
 * Ported in structure/UX from the WFRP PersonalDetailsSection, re-themed to D&D
 * tokens and stripped of every WFRP-specific field (Career / Career Level /
 * Career Path / Status) and the random Generate panel.
 *
 * These are all free-text identity fields (plus a fixed Alignment select) — no
 * game rule, no derived value, so nothing here needs a CalculatedValue
 * breakdown tooltip. The single `name` field is bound to `character.name` (the
 * one source of truth); there is no duplicate name control on Overview.
 *
 * Stage A7 PART 3 adds a gender selector and per-field "roll" (🎲) buttons that
 * fill a field from the FEAT-001 flavor generators, honoring the character's
 * current species + gender. The generated values are NON-RAW flavor and stay
 * fully editable; rolling is non-destructive (it only fills the one field).
 */
export function PersonalDetailsSection({
  character,
  onChange,
  portraitURL,
  onPortraitUpload,
  onPortraitRemove,
}: PersonalDetailsSectionProps) {
  const headerId = useId();
  const alignmentId = useId();
  const genderId = useId();
  const faithId = useId();
  const faithListId = useId();
  const personalityId = useId();
  const [showPromptDialog, setShowPromptDialog] = useState(false);

  const setField = (field: keyof Character, value: string) =>
    onChange({ ...character, [field]: value });

  // The generators need a concrete species + gender. Species gates the roll
  // buttons (the pools are per-species); gender defaults to 'neutral' until set.
  const speciesId = character.species?.id;
  const gender: NameGender = character.gender ?? 'neutral';
  const canGenerate = speciesId !== undefined;

  const rollName = () => {
    if (!speciesId) return;
    onChange({ ...character, name: generateName(speciesId, gender, createDefaultRng()) });
  };
  // Roll a single appearance field (eyes/hair/skin/height/weight) from the
  // species+gender pools without disturbing the others (non-destructive).
  const rollAppearanceField = (field: 'eyes' | 'hair' | 'skin' | 'height' | 'weight') => {
    if (!speciesId) return;
    const a = generateAppearance(speciesId, gender, createDefaultRng());
    onChange({ ...character, [field]: a[field] });
  };
  // Roll an age for the current species from its NON-RAW age band.
  const rollAge = () => {
    if (!speciesId) return;
    onChange({ ...character, age: generateAge(speciesId, createDefaultRng()) });
  };
  const rollPersonality = () =>
    onChange({ ...character, personality: generatePersonality(createDefaultRng()) });
  const rollAlignment = () => {
    const next = ALIGNMENTS[Math.floor(createDefaultRng()() * ALIGNMENTS.length)];
    onChange({ ...character, alignment: next });
  };
  // Pick a random deity NAME from the Gods of Greyhawk catalog (free text stays
  // allowed; this only fills the field with a canonical suggestion).
  const rollFaith = () => {
    const next = DEITY_LIST[Math.floor(createDefaultRng()() * DEITY_LIST.length)];
    onChange({ ...character, faith: next.name });
  };

  // P5: the wizard-selected background (read-only) now sits beside the
  // free-text Background field here on Overview, so "Background" means one thing
  // in one place (it previously showed on the Species sub-tab). Identity/flavor
  // only — background MECHANICS remain a deferred stage.
  const selectedBackground = getBackground(character.backgroundSelection?.id);

  // When the current faith value matches a catalog deity, surface its overview
  // (epithet, home plane, typical worshipers, symbol) as an informational hint.
  const matchedDeity = DEITY_LIST.find(
    (d) => d.name.toLowerCase() === (character.faith ?? '').trim().toLowerCase(),
  );
  const deityHint: TooltipContent | undefined = matchedDeity && {
    title: `${matchedDeity.name}${matchedDeity.epithet ? `, ${matchedDeity.epithet}` : ''}`,
    sections: [
      { label: 'Home Plane', text: matchedDeity.homePlane },
      { label: 'Typical Worshipers', text: matchedDeity.worshipers },
      { label: 'Symbol', text: matchedDeity.symbol },
    ],
  };

  return (
    <section aria-labelledby={headerId} className={styles.section}>
      <div className={styles.identityRow}>
        <CharacterPortrait
          portrait={portraitURL}
          characterName={character.name}
          onUpload={onPortraitUpload}
          onRemove={onPortraitRemove}
        />
        <Card style={{ flex: 1, minWidth: 0 }}>
          <SectionHeader icon={User} title="Personal Details" titleId={headerId} />
          <div className={styles.gridAutoFill}>
            {/* Keep the accessible name "Character name" — it is the single
                source of truth on character.name (no duplicate name field). */}
            <div className={styles.fieldWithRoll}>
              <EditableField
                label="Character name"
                value={character.name}
                type="text"
                mode="tap-to-edit"
                onSave={(v) => onChange({ ...character, name: String(v) })}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className={styles.rollBtn}
                onClick={rollName}
                disabled={!canGenerate}
                aria-label="Roll name"
                title={canGenerate ? 'Roll a name for the current species + gender' : 'Choose a species first'}
              >
                🎲
              </button>
            </div>

            <div className={styles.selectWrapper}>
              <label className={styles.selectLabel} htmlFor={genderId}>
                Gender
              </label>
              <select
                id={genderId}
                className={styles.select}
                value={character.gender ?? ''}
                aria-label="Gender"
                onChange={(e) => {
                  const next = { ...character };
                  if (e.target.value === '') delete next.gender;
                  else next.gender = e.target.value as Character['gender'];
                  onChange(next);
                }}
              >
                <option value="">— Unset —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>

            <div className={styles.selectWrapper}>
              <label className={styles.selectLabel} htmlFor={alignmentId}>
                Alignment
              </label>
              <div className={styles.fieldWithRoll}>
                <select
                  id={alignmentId}
                  className={styles.select}
                  value={character.alignment ?? ''}
                  aria-label="Alignment"
                  onChange={(e) => {
                    const next = { ...character };
                    if (e.target.value === '') {
                      delete next.alignment;
                    } else {
                      next.alignment = e.target.value as Character['alignment'];
                    }
                    onChange(next);
                  }}
                >
                  <option value="">— None —</option>
                  {ALIGNMENTS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.rollBtn}
                  onClick={rollAlignment}
                  aria-label="Roll alignment"
                  title="Roll alignment"
                >
                  🎲
                </button>
              </div>
            </div>

            {/* Faith / Deity is a COMBO: a <datalist> of the 27 Gods of
                Greyhawk suggestions plus free text, so homebrew / other-setting
                deities are not blocked. The stored value is the deity name
                string. A 🎲 picks a random catalog deity; when the value matches
                a catalog deity, an ℹ hint shows its overview. */}
            <div className={styles.selectWrapper}>
              <div className={styles.personalityHeader}>
                <label className={styles.selectLabel} htmlFor={faithId}>
                  Faith / Deity
                </label>
                {deityHint && (
                  <ContentTooltip content={deityHint} className={styles.deityHintTrigger}>
                    <span aria-label={`About ${matchedDeity!.name}`}>ℹ</span>
                  </ContentTooltip>
                )}
              </div>
              <div className={styles.fieldWithRoll}>
                <input
                  id={faithId}
                  type="text"
                  className={styles.comboInput}
                  list={faithListId}
                  value={character.faith ?? ''}
                  aria-label="Faith / Deity"
                  placeholder="Deity name or homebrew"
                  onChange={(e) => setField('faith', e.target.value)}
                  style={{ flex: 1 }}
                />
                <datalist id={faithListId}>
                  {DEITY_LIST.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.epithet}
                    </option>
                  ))}
                </datalist>
                <button
                  type="button"
                  className={styles.rollBtn}
                  onClick={rollFaith}
                  aria-label="Roll deity"
                  title="Roll a random deity"
                >
                  🎲
                </button>
              </div>
            </div>
            <div className={styles.fieldWithRoll}>
              <EditableField
                label="Age"
                value={character.age ?? ''}
                onSave={(v) => setField('age', String(v))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className={styles.rollBtn}
                onClick={rollAge}
                disabled={!canGenerate}
                aria-label="Roll age"
                title={canGenerate ? 'Roll an age for the current species' : 'Choose a species first'}
              >
                🎲
              </button>
            </div>
            <div className={styles.fieldWithRoll}>
              <EditableField
                label="Height"
                value={character.height ?? ''}
                onSave={(v) => setField('height', String(v))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className={styles.rollBtn}
                onClick={() => rollAppearanceField('height')}
                disabled={!canGenerate}
                aria-label="Roll height"
                title={canGenerate ? 'Roll height for the current species' : 'Choose a species first'}
              >
                🎲
              </button>
            </div>
            <div className={styles.fieldWithRoll}>
              <EditableField
                label="Weight"
                value={character.weight ?? ''}
                onSave={(v) => setField('weight', String(v))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className={styles.rollBtn}
                onClick={() => rollAppearanceField('weight')}
                disabled={!canGenerate}
                aria-label="Roll weight"
                title={canGenerate ? 'Roll weight for the current species' : 'Choose a species first'}
              >
                🎲
              </button>
            </div>
            <div className={styles.fieldWithRoll}>
              <EditableField
                label="Eyes"
                value={character.eyes ?? ''}
                onSave={(v) => setField('eyes', String(v))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className={styles.rollBtn}
                onClick={() => rollAppearanceField('eyes')}
                disabled={!canGenerate}
                aria-label="Roll eyes"
                title={canGenerate ? 'Roll eye colour for the current species' : 'Choose a species first'}
              >
                🎲
              </button>
            </div>
            <div className={styles.fieldWithRoll}>
              <EditableField
                label="Hair"
                value={character.hair ?? ''}
                onSave={(v) => setField('hair', String(v))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className={styles.rollBtn}
                onClick={() => rollAppearanceField('hair')}
                disabled={!canGenerate}
                aria-label="Roll hair"
                title={canGenerate ? 'Roll hair for the current species' : 'Choose a species first'}
              >
                🎲
              </button>
            </div>
            <div className={styles.fieldWithRoll}>
              <EditableField
                label="Skin"
                value={character.skin ?? ''}
                onSave={(v) => setField('skin', String(v))}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className={styles.rollBtn}
                onClick={() => rollAppearanceField('skin')}
                disabled={!canGenerate}
                aria-label="Roll skin"
                title={canGenerate ? 'Roll skin for the current species' : 'Choose a species first'}
              >
                🎲
              </button>
            </div>
            {/* Free text only this stage, with the wizard-selected background
                shown read-only beside it (P5). The 2024 Background MECHANICS
                (ability increases, skill/tool proficiencies, origin feat —
                PHB 2024 "Backgrounds") are a LATER stage, deliberately NOT here. */}
            <div className={styles.backgroundField}>
              <EditableField
                label="Background"
                value={character.background ?? ''}
                onSave={(v) => setField('background', String(v))}
              />
              {selectedBackground && (
                <span className={styles.backgroundSelection}>
                  Selected: {selectedBackground.name}
                  <span
                    className={styles.backgroundBadge}
                    title={srdBadge(selectedBackground.srd).title}
                  >
                    {' '}
                    {srdBadge(selectedBackground.srd).text}
                  </span>
                </span>
              )}
            </div>
          </div>

          <div className={styles.personalityField}>
            <div className={styles.personalityHeader}>
              <label className={styles.selectLabel} htmlFor={personalityId}>
                Personality
              </label>
              <button
                type="button"
                className={styles.rollBtn}
                onClick={rollPersonality}
                aria-label="Roll personality"
                title="Roll a personality trait"
              >
                🎲
              </button>
            </div>
            <textarea
              id={personalityId}
              className={styles.textarea}
              value={character.personality ?? ''}
              rows={4}
              onChange={(e) => setField('personality', e.target.value)}
            />
          </div>
          <div className={styles.promptRow}>
            <button
              type="button"
              className={styles.promptBtn}
              onClick={() => setShowPromptDialog(true)}
            >
              <Sparkles size={14} aria-hidden="true" />
              Generate portrait prompt
            </button>
          </div>
        </Card>
      </div>
      {showPromptDialog && (
        <PortraitPromptDialog character={character} onClose={() => setShowPromptDialog(false)} />
      )}
    </section>
  );
}
