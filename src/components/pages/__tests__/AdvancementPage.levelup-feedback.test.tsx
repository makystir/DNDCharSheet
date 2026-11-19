import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { AdvancementPage } from '../AdvancementPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';

afterEach(cleanup);

/** Level-up feedback: a toast plus scroll/focus to the Choices Pending card when the count rises. */
function renderWithNotify(overrides: Partial<Character>) {
  const onNotify = vi.fn();
  function Harness() {
    const [character, setCharacter] = useState<Character>({ ...createCharacter('Tester'), ...overrides });
    return <AdvancementPage character={character} now={() => 1000} onChange={setCharacter} onNotify={onNotify} />;
  }
  render(<Harness />);
  return onNotify;
}

describe('AdvancementPage - level-up feedback', () => {
  it('toasts and scrolls to Choices Pending when a level-up raises the pending count', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    // Level 3 -> 4 opens a feat/ASI slot, so pending rises.
    const onNotify = renderWithNotify({ level: 3, classes: [{ id: 'fighter', level: 3, subclassId: 'champion' }] });
    expect(onNotify).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Level up (fixed HP)' }));
    expect(onNotify).toHaveBeenCalledTimes(1);
    expect(onNotify.mock.calls[0][0]).toMatch(/^Level 4\. \d+ choices? pending\.$/);
    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement).toBe(document.getElementById('adv-section-pending'));
  });

  it('does not toast when the level-up leaves nothing new pending', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const onNotify = renderWithNotify({ level: 1, classes: [{ id: 'fighter', level: 1 }] });
    fireEvent.click(screen.getByRole('button', { name: 'Level up (fixed HP)' }));
    expect(onNotify).not.toHaveBeenCalled();
  });

  it('does not let a level-up that left the count unchanged toast on a later unrelated rise', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const onNotify = vi.fn();
    let setExternal: (c: Character) => void = () => {};
    function Harness() {
      const [character, setCharacter] = useState<Character>({
        ...createCharacter('Tester'),
        level: 1,
        classes: [{ id: 'fighter', level: 1 }],
      });
      setExternal = setCharacter;
      return <AdvancementPage character={character} now={() => 1000} onChange={setCharacter} onNotify={onNotify} />;
    }
    render(<Harness />);
    // Level 1 -> 2 leaves the pending count unchanged: no toast, and the flag must not linger.
    fireEvent.click(screen.getByRole('button', { name: 'Level up (fixed HP)' }));
    expect(onNotify).not.toHaveBeenCalled();
    // An unrelated change (not the Level up button) later raises the pending count.
    act(() => {
      setExternal({ ...createCharacter('Tester'), level: 4, classes: [{ id: 'fighter', level: 4, subclassId: 'champion' }] });
    });
    expect(onNotify).not.toHaveBeenCalled();
  });
});
