import { useState } from 'react';
import { render } from '@testing-library/react';
import { PeopleTab } from '../PeopleTab';
import type { PeopleFilter } from '../PeopleTab';
import type { Character } from '../../../types/character';
import { undoStub } from './helpers';
import { Stateful } from './Stateful';

/**
 * Render the People tab with real character and filter state, like the page
 * provides. `latest.current` follows every emitted character.
 */
export function renderPeople(
  initial: Character,
  { latest, filter = 'all', rng }: { latest?: { current: Character }; filter?: PeopleFilter; rng?: () => number } = {},
) {
  if (latest) latest.current = initial;
  const onState = latest
    ? (c: Character) => {
        latest.current = c;
      }
    : undefined;

  function Harness() {
    const [shown, setShown] = useState<PeopleFilter>(filter);
    return (
      <Stateful initial={initial} onState={onState}>
        {(character, onChange) => (
          <PeopleTab character={character} onChange={onChange} undo={undoStub()} filter={shown} onFilterChange={setShown} rng={rng} />
        )}
      </Stateful>
    );
  }

  return render(<Harness />);
}
