import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { OverviewNow } from '../OverviewNow';
import { createCharacter } from '../../../../storage/character-store';
import type { Character } from '../../../../types/character';

afterEach(cleanup);

// A level 1 Fighter still has Second Wind, so the empty state needs a
// character with no class resources: no class at all.
const character: Character = { ...createCharacter('Tester'), level: 1, classes: [] };

describe('Overview empty states share one markup', () => {
  it('Right now: muted paragraph in the shared empty block, footer link on its own line', () => {
    render(<OverviewNow character={character} />);
    const empty = screen.getByTestId('overview-empty');
    const text = within(empty).getByText('Nothing affecting you and nothing to track');
    expect(text.tagName).toBe('P');
    expect(within(text).queryByRole('link')).toBeNull();
    const footer = screen.getByTestId('overview-footer');
    expect(within(footer).getByRole('link', { name: 'Manage on Combat' })).toHaveAttribute('href', '#combat');
    expect(empty).not.toContainElement(footer);
  });
});
