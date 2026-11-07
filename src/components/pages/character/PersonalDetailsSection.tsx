import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import type { Character } from '../../../types/character';
import { ALIGNMENTS } from '../../../types/character';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { EditableField } from '../../shared/EditableField';
import { ContentTooltip } from '../../shared/ContentTooltip';
import type { TooltipContent } from '../../../logic/tooltip-content';
import { CharacterPortrait } from '../../shared/CharacterPortrait';
import { DEITY_LIST } from '../../../data/deities';
import { SPECIES_LIST } from '../../../data/species';
import type { SpeciesChoiceSpec } from '../../../data/species';
import { resolveSize, resolveSpecies } from '../../../logic/species';
import { SIZE_LABELS, choiceOptions } from '../sheet-helpers';
import { getBackground } from '../../../data/backgrounds';
import { User } from 'lucide-react';
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
  /** Select a species (empty string clears it); owned by the page. */
  onSpeciesChange: (raw: string) => void;
  /** Write one species sub-choice field (empty string unsets it); owned by the page. */
  onSpeciesChoiceChange: (field: SpeciesChoiceSpec['field'], raw: string) => void;
}

interface RollButtonProps {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}

/** The fixed-size 🎲 button that ends every field's control row. */
function RollButton({ label, title, onClick, disabled }: RollButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.rollSlot} ${styles.rollBtn}`}
      data-roll-slot="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
    >
      🎲
    </button>
  );
}

/**
 * An empty slot the same size as a RollButton, for fields with nothing to roll
 * (Gender), so every input in the grid ends at the same x position.
 */
function RollSlotPlaceholder() {
  return <span className={styles.rollSlot} data-roll-slot="placeholder" aria-hidden="true" />;
}

/**
 * One grid cell: the field (label above its single-line control) followed by
 * the roll slot. Every cell has this exact shape so labels, controls and roll
 * buttons line up across each row.
 */
function FieldCell({ field, roll, testId }: { field: ReactNode; roll: ReactNode; testId: string }) {
  return (
    <div className={styles.cell} data-testid={testId}>
      <div className={styles.cellMain}>{field}</div>
      {roll}
    </div>
  );
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
 *
 * LAYOUT: a strict, even grid (5 columns wide, then 3, 2, 1 as the card
 * narrows). Each cell is label + ONE control row (single-line control that
 * flexes + a fixed roll slot, reserved even when there is nothing to roll), so
 * every control has the same height and ends at the same x. Background spans
 * the full row; Personality sits below the grid at full width.
 */
export function PersonalDetailsSection({
  character,
  onChange,
  portraitURL,
  onPortraitUpload,
  onPortraitRemove,
  onSpeciesChange,
  onSpeciesChoiceChange,
}: PersonalDetailsSectionProps) {
  const headerId = useId();
  const alignmentId = useId();
  const genderId = useId();
  const faithId = useId();
  const speciesSelectId = useId();
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
  const needSpecies = 'Choose a species first';

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

  // P5: the wizard-selected background (read-only) sits under the free-text
  // Background field here on Overview, so "Background" means one thing in one
  // place. Identity/flavor only — background MECHANICS remain a deferred stage.
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

  // A tap-to-edit text field in the grid's shared single-line control style.
  const textField = (label: string, value: string, onSave: (v: string) => void) => (
    <EditableField
      label={label}
      value={value}
      type="text"
      mode="tap-to-edit"
      singleLine
      controlClassName={styles.control}
      onSave={(v) => onSave(String(v))}
    />
  );

  const appearanceCell = (
    field: 'height' | 'weight' | 'eyes' | 'hair' | 'skin',
    label: string,
    rollTitle: string,
  ) => (
    <FieldCell
      key={field}
      testId={`pd-field-${field}`}
      field={textField(label, character[field] ?? '', (v) => setField(field, v))}
      roll={
        <RollButton
          label={`Roll ${field}`}
          title={canGenerate ? rollTitle : needSpecies}
          onClick={() => rollAppearanceField(field)}
          disabled={!canGenerate}
        />
      }
    />
  );

  // Species + its sub-choices + Size. The species editor lives here (the only
  // one on the sheet). Size is a sub-choice select when the species offers
  // Small/Medium (it appears among the species' choices); otherwise it is the
  // fixed read-only size (PHB 2024 "Parts of a Species").
  const selectedSpecies = resolveSpecies(character);
  const resolvedSize = resolveSize(character);
  const hasSizeChoice = selectedSpecies?.choices?.some((c) => c.field === 'size') ?? false;

  const alignmentLabel = character.alignment ?? '';
  const genderLabel =
    character.gender === undefined
      ? ''
      : character.gender.charAt(0).toUpperCase() + character.gender.slice(1);

  return (
    <section aria-labelledby={headerId} className={styles.section}>
      <div className={styles.identityRow}>
        <CharacterPortrait
          portrait={portraitURL}
          characterName={character.name}
          onUpload={onPortraitUpload}
          onRemove={onPortraitRemove}
          onGeneratePrompt={() => setShowPromptDialog(true)}
        />
        <div className={styles.detailsColumn}>
          <Card>
            <SectionHeader icon={User} title="Personal Details" titleId={headerId} />
            <div className={styles.fieldsContainer}>
              <div className={styles.fieldGrid} data-testid="personal-details-grid">
                {/* Row 1: Name, Gender, Alignment, Faith / Deity, Age.
                    Keep the accessible name "Character name" — it is the single
                    source of truth on character.name (no duplicate name field). */}
                <FieldCell
                  testId="pd-field-name"
                  field={textField('Character name', character.name, (v) =>
                    onChange({ ...character, name: v }),
                  )}
                  roll={
                    <RollButton
                      label="Roll name"
                      title={canGenerate ? 'Roll a name for the current species + gender' : needSpecies}
                      onClick={rollName}
                      disabled={!canGenerate}
                    />
                  }
                />

                <FieldCell
                  testId="pd-field-gender"
                  field={
                    <>
                      <span className={styles.labelRow}>
                        <label className={styles.fieldLabel} htmlFor={genderId}>
                          Gender
                        </label>
                      </span>
                      <select
                        id={genderId}
                        className={`${styles.control} ${styles.select}`}
                        value={character.gender ?? ''}
                        aria-label="Gender"
                        title={genderLabel || undefined}
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
                    </>
                  }
                  roll={<RollSlotPlaceholder />}
                />

                <FieldCell
                  testId="pd-field-alignment"
                  field={
                    <>
                      <span className={styles.labelRow}>
                        <label className={styles.fieldLabel} htmlFor={alignmentId}>
                          Alignment
                        </label>
                      </span>
                      <select
                        id={alignmentId}
                        className={`${styles.control} ${styles.select}`}
                        value={character.alignment ?? ''}
                        aria-label="Alignment"
                        title={alignmentLabel || undefined}
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
                    </>
                  }
                  roll={<RollButton label="Roll alignment" title="Roll alignment" onClick={rollAlignment} />}
                />

                {/* Faith / Deity is a COMBO: a <datalist> of the 27 Gods of
                    Greyhawk suggestions plus free text, so homebrew / other-setting
                    deities are not blocked. The stored value is the deity name
                    string. A 🎲 picks a random catalog deity; when the value
                    matches a catalog deity, an ℹ hint (inline with the label)
                    shows its overview. */}
                <FieldCell
                  testId="pd-field-faith"
                  field={
                    <>
                      <span className={styles.labelRow} data-testid="pd-faith-label-row">
                        <label className={styles.fieldLabel} htmlFor={faithId}>
                          Faith / Deity
                        </label>
                        {deityHint && (
                          <ContentTooltip content={deityHint} className={styles.deityHintTrigger}>
                            <span aria-label={`About ${matchedDeity!.name}`}>ℹ</span>
                          </ContentTooltip>
                        )}
                      </span>
                      <input
                        id={faithId}
                        type="text"
                        className={`${styles.control} ${styles.comboInput}`}
                        list={faithListId}
                        value={character.faith ?? ''}
                        aria-label="Faith / Deity"
                        title={character.faith || undefined}
                        placeholder="Deity name or homebrew"
                        onChange={(e) => setField('faith', e.target.value)}
                      />
                      <datalist id={faithListId}>
                        {DEITY_LIST.map((d) => (
                          <option key={d.id} value={d.name}>
                            {d.epithet}
                          </option>
                        ))}
                      </datalist>
                    </>
                  }
                  roll={<RollButton label="Roll deity" title="Roll a random deity" onClick={rollFaith} />}
                />

                <FieldCell
                  testId="pd-field-age"
                  field={textField('Age', character.age ?? '', (v) => setField('age', v))}
                  roll={
                    <RollButton
                      label="Roll age"
                      title={canGenerate ? 'Roll an age for the current species' : needSpecies}
                      onClick={rollAge}
                      disabled={!canGenerate}
                    />
                  }
                />

                {/* Row 2: Height, Weight, Eyes, Hair, Skin. */}
                {appearanceCell('height', 'Height', 'Roll height for the current species')}
                {appearanceCell('weight', 'Weight', 'Roll weight for the current species')}
                {appearanceCell('eyes', 'Eyes', 'Roll eye colour for the current species')}
                {appearanceCell('hair', 'Hair', 'Roll hair for the current species')}
                {appearanceCell('skin', 'Skin', 'Roll skin for the current species')}

                {/* Row 3: Species, its sub-choices, and Size. */}
                <FieldCell
                  testId="pd-field-species"
                  field={
                    <>
                      <span className={styles.labelRow}>
                        <label className={styles.fieldLabel} htmlFor={speciesSelectId}>
                          Species
                        </label>
                      </span>
                      <select
                        id={speciesSelectId}
                        className={`${styles.control} ${styles.select}`}
                        value={character.species?.id ?? ''}
                        aria-label="Species"
                        onChange={(e) => onSpeciesChange(e.target.value)}
                      >
                        <option value="">— None —</option>
                        {SPECIES_LIST.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </>
                  }
                  roll={<RollSlotPlaceholder />}
                />

                {selectedSpecies?.choices?.map((spec) => {
                  const value = (character.species?.[spec.field] as string | undefined) ?? '';
                  const selectId = `species-choice-${spec.field}`;
                  return (
                    <FieldCell
                      key={spec.field}
                      testId={`pd-field-species-${spec.field}`}
                      field={
                        <>
                          <span className={styles.labelRow}>
                            <label className={styles.fieldLabel} htmlFor={selectId}>
                              {spec.label}
                            </label>
                          </span>
                          <select
                            id={selectId}
                            className={`${styles.control} ${styles.select}`}
                            value={value}
                            aria-label={spec.label}
                            onChange={(e) => onSpeciesChoiceChange(spec.field, e.target.value)}
                          >
                            <option value="">choose…</option>
                            {choiceOptions(spec).map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                                {o.note ? ` (${o.note})` : ''}
                              </option>
                            ))}
                          </select>
                        </>
                      }
                      roll={<RollSlotPlaceholder />}
                    />
                  );
                })}

                {!hasSizeChoice && (
                  <FieldCell
                    testId="pd-field-size"
                    field={
                      <>
                        <span className={styles.labelRow}>
                          <span className={styles.fieldLabel}>Size</span>
                        </span>
                        <span className={styles.control} data-testid="pd-size-value">
                          {resolvedSize ? SIZE_LABELS[resolvedSize] : '—'}
                        </span>
                      </>
                    }
                    roll={<RollSlotPlaceholder />}
                  />
                )}

                {/* Row 4: Background spans the full row. Free text, with the
                    wizard-selected background name shown read-only beneath it
                    (P5). The 2024 Background MECHANICS (ability increases,
                    skill/tool proficiencies, origin feat — PHB 2024
                    "Backgrounds") are a LATER stage, deliberately NOT here. */}
                <div className={`${styles.cell} ${styles.cellFull}`} data-testid="pd-field-background">
                  <div className={styles.cellMain}>
                    {textField('Background', character.background ?? '', (v) =>
                      setField('background', v),
                    )}
                    {selectedBackground && (
                      <span className={styles.backgroundSelection} data-testid="pd-selected-background">
                        Selected background: {selectedBackground.name}
                      </span>
                    )}
                  </div>
                  <RollSlotPlaceholder />
                </div>
              </div>

              <div className={styles.personalityField}>
                <div className={styles.personalityHeader}>
                  <label className={styles.fieldLabel} htmlFor={personalityId}>
                    Personality
                  </label>
                  <RollButton
                    label="Roll personality"
                    title="Roll a personality trait"
                    onClick={rollPersonality}
                  />
                </div>
                <textarea
                  id={personalityId}
                  className={styles.textarea}
                  value={character.personality ?? ''}
                  rows={4}
                  onChange={(e) => setField('personality', e.target.value)}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
      {showPromptDialog && (
        <PortraitPromptDialog character={character} onClose={() => setShowPromptDialog(false)} />
      )}
    </section>
  );
}
