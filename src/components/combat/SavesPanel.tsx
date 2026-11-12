import { useState } from 'react';
import { Dices } from 'lucide-react';
import type { Ability, Character } from '../../types/character';
import { ABILITIES, ABILITY_ABBR, ABILITY_NAMES } from '../../types/character';
import { allSavingThrowBreakdowns, savingThrowProficiency } from '../../logic/saving-throws';
import { saveConditionEffects } from '../../logic/save-conditions';
import { exhaustionLevelOf } from '../../logic/conditions';
import { formatSigned } from '../../logic/breakdown';
import { resolveSaveTooltip } from '../../logic/tooltip-content';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import { RollPrompt, type RollPromptResult } from '../shared/RollPrompt';
import styles from './SavesPanel.module.css';

export interface SavesPanelProps {
  character: Character;
}

interface LastResult {
  ability: Ability;
  natural: number;
  total: number;
  mode: RollPromptResult['mode'];
}

/**
 * The six saving throws as one-tap rolls for the Combat page, as a compact row
 * of six chips (three per row on a phone). Each tile shows the
 * bonus (with its breakdown tooltip), flags what the character's conditions do to
 * that save (an automatic failure, or Disadvantage), and rolls through the shared
 * RollPrompt, which honors the manual-dice setting and adds the Exhaustion penalty.
 *
 * No rule is computed here: the bonus comes from logic/saving-throws.ts and the
 * condition effects from logic/save-conditions.ts. The panel never compares a roll
 * to a DC; the DM tells the player whether it succeeded.
 */
export function SavesPanel({ character }: SavesPanelProps) {
  const [rolling, setRolling] = useState<Ability | null>(null);
  const [last, setLast] = useState<LastResult | null>(null);

  const withExhaustion = allSavingThrowBreakdowns(character);
  const withoutExhaustion = allSavingThrowBreakdowns(character, { exhaustion: false });
  const concentrating = character.concentration !== undefined;

  const resolve = (ability: Ability, result: RollPromptResult) => {
    setRolling(null);
    setLast({ ability, natural: result.natural, total: result.total, mode: result.mode });
  };

  const rollingEffects = rolling ? saveConditionEffects(character, rolling) : null;

  return (
    <Card>
      <SectionHeader icon={Dices} title="Saving Throws" />
      <div className={styles.grid}>
        {ABILITIES.map((ability) => {
          const name = ABILITY_NAMES[ability];
          const breakdown = withExhaustion[ability];
          const fx = saveConditionEffects(character, ability);
          const prof = savingThrowProficiency(character, ability);
          const autoFail = fx.autoFailFrom.length > 0;
          return (
            <div key={ability} className={styles.tile} data-testid={`save-${ability}`}>
              <span className={styles.name}>
                <MaybeContentTooltip
                  content={resolveSaveTooltip(ability, character)}
                  ariaLabel={`About ${name} saving throw`}
                >
                  {ABILITY_ABBR[ability]}
                </MaybeContentTooltip>
                {prof.proficient && (
                  <span className={styles.prof} title="Proficient">
                    Prof
                  </span>
                )}
              </span>
              <span className={styles.bonus}>
                <CalculatedValue label={`${name} Save`} breakdown={breakdown}>
                  {formatSigned(breakdown.total)}
                </CalculatedValue>
              </span>
              {autoFail && (
                <span className={styles.warn}>Auto-fail ({fx.autoFailFrom.join(', ')})</span>
              )}
              {!autoFail && fx.disadvantageFrom.length > 0 && (
                <span className={styles.warn}>Disadvantage ({fx.disadvantageFrom.join(', ')})</span>
              )}
              {ability === 'con' && concentrating && (
                <span className={styles.note}>Use for a Concentration check</span>
              )}
              <button
                type="button"
                className={styles.rollBtn}
                aria-label={`Roll ${name} saving throw`}
                onClick={() => setRolling(ability)}
              >
                <Dices size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      <p className={styles.result} role="status" aria-live="polite" data-testid="save-result">
        {last
          ? `${ABILITY_NAMES[last.ability]} save: ${last.total} (rolled ${last.natural}${
              last.mode === 'advantage' ? ', Advantage' : last.mode === 'disadvantage' ? ', Disadvantage' : ''
            })`
          : ''}
      </p>

      {rolling && rollingEffects && (
        <RollPrompt
          title={`${ABILITY_NAMES[rolling]} saving throw`}
          exhaustionLevel={exhaustionLevelOf(character)}
          modifiers={withoutExhaustion[rolling].components}
          initialMode={
            rollingEffects.autoFailFrom.length === 0 && rollingEffects.disadvantageFrom.length > 0
              ? 'disadvantage'
              : 'normal'
          }
          hint={
            rollingEffects.autoFailFrom.length > 0
              ? `${rollingEffects.autoFailFrom.join(', ')}: you automatically fail ${ABILITY_NAMES[rolling]} saving throws.`
              : rollingEffects.disadvantageFrom.length > 0
                ? `${rollingEffects.disadvantageFrom.join(', ')}: Disadvantage on ${ABILITY_NAMES[rolling]} saving throws.`
                : undefined
          }
          confirmLabel="Done"
          onResolve={(r) => resolve(rolling, r)}
          onClose={() => setRolling(null)}
        />
      )}
    </Card>
  );
}
