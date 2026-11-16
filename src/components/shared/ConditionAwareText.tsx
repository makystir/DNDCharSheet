import { Fragment } from 'react';
import { CONDITIONS } from '../../data/conditions';
import { resolveConditionTooltip } from '../../logic/tooltip-content';
import { MaybeContentTooltip } from './ContentTooltip';

/**
 * Text with a content tooltip on each token that names a condition ("Charmed, Poisoned" or
 * "Charmed; Frightened"). The original separators are kept in the output.
 */
export function ConditionAwareText({ text }: { text: string }) {
  const parts = text.split(/(\s*[,;]\s*)/);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) return <Fragment key={`sep-${i}`}>{part}</Fragment>;
        const cond = CONDITIONS.find((c) => c.name.toLowerCase() === part.trim().toLowerCase());
        return (
          <Fragment key={`${part}-${i}`}>
            {cond ? <MaybeContentTooltip content={resolveConditionTooltip(cond.id)}>{part}</MaybeContentTooltip> : part}
          </Fragment>
        );
      })}
    </>
  );
}
