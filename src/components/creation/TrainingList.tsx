import { trainingTooltip } from '../../logic/creation-guidance';
import { MaybeContentTooltip } from '../shared/ContentTooltip';

/**
 * A class's armor-training or weapon-proficiency entries ("Light armor",
 * "Shields", "Martial weapons"), each explaining what it means on hover or tap.
 */
export function TrainingList({ entries }: { entries: readonly string[] }) {
  return (
    <>
      {entries.map((entry, i) => (
        <span key={entry}>
          {i > 0 && ', '}
          <MaybeContentTooltip content={trainingTooltip(entry)} ariaLabel={`About ${entry}`}>
            {entry}
          </MaybeContentTooltip>
        </span>
      ))}
    </>
  );
}
