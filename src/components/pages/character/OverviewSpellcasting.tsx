import { Sparkles } from 'lucide-react';
import type { Character } from '../../../types/character';
import {
  anySpellcaster,
  perClassSpellcasting,
  spellAttackBreakdown,
  spellSaveDcBreakdown,
} from '../../../logic/spellcasting';
import { formatSigned } from '../../../logic/breakdown';
import type { Breakdown } from '../../../logic/breakdown';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { CalculatedValue } from '../../shared/CalculatedValue';
import { SpellSlotSummary } from '../../combat/SpellSlotSummary';
import styles from './OverviewSpellcasting.module.css';

export interface OverviewSpellcastingProps {
  character: Character;
}

interface Row {
  key: string;
  className?: string;
  saveDc: Breakdown;
  attack: Breakdown;
}

/**
 * Read-only spellcasting summary (casters only). Spell Save DC and Spell Attack
 * come from logic/spellcasting; with two or more casting classes each class gets
 * its own row (perClassSpellcasting). Slots reuse the Combat SpellSlotSummary.
 * Renders nothing for a non-caster. Spells are managed on the Spells page.
 */
export function OverviewSpellcasting({ character }: OverviewSpellcastingProps) {
  if (!anySpellcaster(character)) return null;

  const perClass = perClassSpellcasting(character);
  let rows: Row[];
  if (perClass.length >= 2) {
    rows = perClass.map((c) => ({
      key: c.classId,
      className: c.className,
      saveDc: c.saveDc,
      attack: c.attack,
    }));
  } else {
    const saveDc = spellSaveDcBreakdown(character);
    const attack = spellAttackBreakdown(character);
    rows = saveDc && attack ? [{ key: 'single', saveDc, attack }] : [];
  }

  return (
    <div className={styles.wrap} data-testid="overview-spellcasting">
      <Card>
        <SectionHeader icon={Sparkles} title="Spellcasting" />
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={row.key} className={styles.row} data-testid="overview-spell-row">
              {row.className && <span className={styles.className}>{row.className}</span>}
              <span className={styles.stat}>
                <span className={styles.statLabel}>Spell Save DC</span>
                <CalculatedValue
                  label={`${row.className ? `${row.className} ` : ''}Spell Save DC`}
                  breakdown={row.saveDc}
                />
              </span>
              <span className={styles.stat}>
                <span className={styles.statLabel}>Spell Attack</span>
                <CalculatedValue
                  label={`${row.className ? `${row.className} ` : ''}Spell Attack`}
                  breakdown={row.attack}
                >
                  {formatSigned(row.attack.total)}
                </CalculatedValue>
              </span>
            </li>
          ))}
        </ul>
        <a className={styles.manage} href="#spells">
          Manage spells
        </a>
      </Card>
      <SpellSlotSummary character={character} />
    </div>
  );
}
