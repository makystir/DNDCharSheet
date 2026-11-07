import { Sparkles } from 'lucide-react';
import type { Character } from '../../../types/character';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import styles from './OverviewInspiration.module.css';

export interface OverviewInspirationProps {
  character: Character;
  onChange: (next: Character) => void;
}

/**
 * Heroic Inspiration toggle. PHB 2024 "Heroic Inspiration" (Docs/PlayersHandbook.md
 * L498-501): with it, you can expend it to reroll any die right after rolling it
 * and must use the new roll; you can never have more than one; the DM awards it.
 *
 * MANUAL ONLY: the sheet never changes it on rests or any other event. This is a
 * deliberate, documented exception to the one-editor rule: it is edited here on
 * the Overview and nowhere else (Print and the share viewer show it read-only).
 */
export function OverviewInspiration({ character, onChange }: OverviewInspirationProps) {
  const has = character.heroicInspiration === true;
  return (
    <Card>
      <SectionHeader icon={Sparkles} title="Heroic Inspiration" />
      <button
        type="button"
        className={has ? `${styles.toggle} ${styles.on}` : styles.toggle}
        aria-pressed={has}
        data-testid="heroic-inspiration-toggle"
        onClick={() => onChange({ ...character, heroicInspiration: !has })}
      >
        Heroic Inspiration: {has ? 'Yes' : 'No'}
      </button>
      <p className={styles.rule}>
        Spend it to reroll any die right after rolling it, and use the new roll. You
        can never have more than one.
      </p>
      <p className={styles.note}>
        Some features grant it (e.g. Human Resourceful, Musician) — set it yourself;
        the sheet does not change it automatically.
      </p>
    </Card>
  );
}
