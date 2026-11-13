import { useState } from 'react';
import { Swords, Trash2 } from 'lucide-react';
import type { Character } from '../../../types/character';
import { getFeat } from '../../../data/feats';
import { applyFightingStyle, fightingStyleSlots, removeFeat } from '../../../logic/feats';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { ContentTooltip } from '../../shared/ContentTooltip';
import { resolveFeatTooltip } from '../../../logic/tooltip-content';
import { FeatPicker } from '../../shared/FeatPicker';
import styles from './FeatSlotsSection.module.css';

export interface FightingStyleSectionProps {
  character: Character;
  onChange: (next: Character) => void;
  /** Injected clock for the log timestamps (deterministic in tests). */
  now?: () => number;
}

/**
 * The Fighting Style feat pick for each class that has the Fighting Style
 * feature (Fighter 1, Paladin 2, Ranger 2 — PHB 2024 class feature tables).
 * Fighting Style feats are not offered in Ability Score Improvement slots; this
 * is where the class feature's pick lives. A pick can be swapped (a Fighter may
 * change it on gaining a Fighter level) or removed. Renders nothing for a
 * character without the feature.
 *
 * The Paladin "Blessed Warrior" and Ranger "Druidic Warrior" alternatives
 * are not modelled here. A subclass "Additional Fighting Style" (Champion) adds a
 * second row for its class.
 */
export function FightingStyleSection({ character, onChange, now = Date.now }: FightingStyleSectionProps) {
  // The class whose Fighting Style pick is open.
  const [pickingClass, setPickingClass] = useState<string | null>(null);

  const slots = fightingStyleSlots(character);
  if (slots.length === 0) return null;

  const pickingSlot = slots.find((s) => s.key === pickingClass);

  return (
    <Card id="adv-section-fighting-style">
      <SectionHeader icon={Swords} title="Fighting Style" />
      <ul className={styles.slotList}>
        {slots.map((slot) => {
          const feat = slot.filled ? getFeat(slot.filled.featId) : undefined;
          const content = feat ? resolveFeatTooltip(feat.id) : null;
          // Distinguishes a subclass slot (e.g. Champion) from the class's own slot.
          const slotName = slot.subclassFeature ? `${slot.className} ${slot.subclassFeature}` : slot.className;
          return (
            <li key={slot.key} className={styles.slot}>
              <span className={styles.slotLevel}>
                {slot.className} {slot.featureLevel}{slot.subclassFeature ? ` (${slot.subclassFeature})` : ''}
              </span>
              {slot.filled && feat ? (
                <div className={styles.filled}>
                  <span className={styles.featName}>
                    {content ? <ContentTooltip content={content}>{feat.name}</ContentTooltip> : feat.name}
                  </span>
                  <button
                    type="button"
                    className={styles.chooseBtn}
                    onClick={() => setPickingClass(slot.key)}
                    aria-label={`Change ${slotName} Fighting Style`}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => onChange(removeFeat(character, 0, now(), feat.id))}
                    aria-label={`Remove ${slotName} Fighting Style ${feat.name}`}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.chooseBtn}
                  onClick={() => setPickingClass(slot.key)}
                  aria-label={`Choose a Fighting Style feat for ${slotName}`}
                >
                  Choose a Fighting Style feat…
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {pickingSlot !== undefined && (
        <FeatPicker
          character={character}
          slotLevel={pickingSlot.featureLevel}
          categories={['fighting-style']}
          title={`Choose a Fighting Style feat — ${pickingSlot.className}${pickingSlot.subclassFeature ? ` (${pickingSlot.subclassFeature})` : ''}`}
          onSelect={(featId) => {
            setPickingClass(null);
            onChange(applyFightingStyle(character, pickingSlot.key, featId, now()));
          }}
          onClose={() => setPickingClass(null)}
        />
      )}
    </Card>
  );
}
