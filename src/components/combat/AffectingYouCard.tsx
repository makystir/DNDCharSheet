import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Character } from '../../types/character';
import { trackedEffects } from '../../logic/combat-effects';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { AddButton } from '../shared/AddButton';
import { exhaustionLevelOf } from '../../logic/conditions';
import { derivedConditionIds } from '../../logic/hit-points-state';
import { ActiveConditions } from './ActiveConditions';
import { EffectsCard } from './EffectsCard';
import styles from './ActiveConditions.module.css';

export interface AffectingYouCardProps {
  character: Character;
  onChange: (next: Character) => void;
}

/**
 * "Affecting you": the character's conditions (including Exhaustion and the ones
 * it has at 0 HP) and the effects it is tracking (Bless, Rage...), in one card.
 * With nothing to show it is a single line plus the Add Condition and Track
 * effect buttons, so it costs almost no space on the Combat page.
 */
export function AffectingYouCard({ character, onChange }: AffectingYouCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [effectFormOpen, setEffectFormOpen] = useState(false);
  // Nothing stored, no Exhaustion, nothing from 0 HP, and no tracked effect.
  const empty =
    (character.conditions ?? []).length === 0 &&
    exhaustionLevelOf(character) === 0 &&
    derivedConditionIds(character).length === 0 &&
    trackedEffects(character).length === 0;

  return (
    <Card>
      <SectionHeader
        icon={AlertTriangle}
        title="Affecting you"
        action={
          <div className={styles.headerActions}>
            <AddButton label="Add Condition" onClick={() => setPickerOpen(true)} />
            <AddButton label="Track effect" onClick={() => setEffectFormOpen(true)} />
          </div>
        }
      />
      {empty && !effectFormOpen && (
        <p className={styles.emptyLine} data-testid="affecting-you-empty">
          No conditions or tracked effects.
        </p>
      )}
      <ActiveConditions
        character={character}
        onChange={onChange}
        pickerOpen={pickerOpen}
        onClosePicker={() => setPickerOpen(false)}
      />
      <EffectsCard
        character={character}
        onChange={onChange}
        formOpen={effectFormOpen}
        onCloseForm={() => setEffectFormOpen(false)}
      />
    </Card>
  );
}
