import { Hourglass } from 'lucide-react';
import type { Character } from '../../../types/character';
import { characterResources, usesUnitLabel } from '../../../logic/resources';
import { Card } from '../../shared/Card';
import { SectionHeader } from '../../shared/SectionHeader';
import { CalculatedValue } from '../../shared/CalculatedValue';
import { OverviewEmpty, OverviewFooter } from './OverviewShared';
import styles from './OverviewResources.module.css';

export interface OverviewResourcesProps {
  character: Character;
}

const MANAGE_LINK = { href: '#combat', text: 'Manage on Combat' };

/**
 * Read-only mirror of the limited-use feature trackers. Spending and regaining
 * happen on Combat (one-editor rule); this card has no inputs or buttons.
 */
export function OverviewResources({ character }: OverviewResourcesProps) {
  const states = characterResources(character);
  return (
    <Card>
      <SectionHeader icon={Hourglass} title="Resources" />
      {states.length === 0 ? (
        <OverviewEmpty text="No limited-use features yet" link={MANAGE_LINK} />
      ) : (
        <>
          <ul className={styles.list} aria-label="Limited-use features">
            {states.map((state) => (
              <li key={state.id} className={styles.row} data-testid="overview-resource">
                <span className={styles.name}>{state.name}</span>
                <span className={styles.count}>
                  {state.remaining} /{' '}
                  <CalculatedValue label={`${state.name} maximum`} breakdown={state.maxBreakdown}>
                    {state.max}
                  </CalculatedValue>{' '}
                  {usesUnitLabel(state, state.max)}
                </span>
              </li>
            ))}
          </ul>
          <OverviewFooter links={[MANAGE_LINK]} />
        </>
      )}
    </Card>
  );
}
