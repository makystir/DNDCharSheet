import { useId } from 'react';
import type { Character } from '../../../types/character';
import { ALIGNMENTS } from '../../../types/character';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { EditableField } from '../../shared/EditableField';
import { CharacterPortrait } from '../../shared/CharacterPortrait';
import { User } from 'lucide-react';
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
  const personalityId = useId();

  const setField = (field: keyof Character, value: string) =>
    onChange({ ...character, [field]: value });

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
            <EditableField
              label="Character name"
              value={character.name}
              type="text"
              mode="tap-to-edit"
              onSave={(v) => onChange({ ...character, name: String(v) })}
            />

            <div className={styles.selectWrapper}>
              <label className={styles.selectLabel} htmlFor={alignmentId}>
                Alignment
              </label>
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
            </div>

            <EditableField
              label="Faith / Deity"
              value={character.faith ?? ''}
              onSave={(v) => setField('faith', String(v))}
            />
            <EditableField
              label="Sex"
              value={character.sex ?? ''}
              onSave={(v) => setField('sex', String(v))}
            />
            <EditableField
              label="Age"
              value={character.age ?? ''}
              onSave={(v) => setField('age', String(v))}
            />
            <EditableField
              label="Height"
              value={character.height ?? ''}
              onSave={(v) => setField('height', String(v))}
            />
            <EditableField
              label="Weight"
              value={character.weight ?? ''}
              onSave={(v) => setField('weight', String(v))}
            />
            <EditableField
              label="Eyes"
              value={character.eyes ?? ''}
              onSave={(v) => setField('eyes', String(v))}
            />
            <EditableField
              label="Hair"
              value={character.hair ?? ''}
              onSave={(v) => setField('hair', String(v))}
            />
            <EditableField
              label="Skin"
              value={character.skin ?? ''}
              onSave={(v) => setField('skin', String(v))}
            />
            {/* Free text only this stage. The 2024 Background MECHANICS
                (ability increases, skill/tool proficiencies, origin feat —
                PHB 2024 "Backgrounds") are a LATER stage, deliberately NOT here. */}
            <EditableField
              label="Background"
              value={character.background ?? ''}
              onSave={(v) => setField('background', String(v))}
            />
          </div>

          <div className={styles.personalityField}>
            <label className={styles.selectLabel} htmlFor={personalityId}>
              Personality
            </label>
            <textarea
              id={personalityId}
              className={styles.textarea}
              value={character.personality ?? ''}
              rows={4}
              onChange={(e) => setField('personality', e.target.value)}
            />
          </div>
        </Card>
      </div>
    </section>
  );
}
