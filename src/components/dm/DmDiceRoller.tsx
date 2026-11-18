import { useState } from 'react';
import { Dices } from 'lucide-react';
import { RollDialog } from '../shared/RollDialog';
import appStyles from '../../App.module.css';

/**
 * The floating d20 roller for the Dungeon Master workspace: the same button and
 * RollDialog the player shell uses. DM mode has no active character, so a
 * confirmed roll is not logged anywhere and the dialog just closes.
 */
export function DmDiceRoller() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={appStyles.rollFab}
        onClick={() => setOpen(true)}
        aria-label="Open dice roller"
        title="Roll a d20"
      >
        <Dices size={20} aria-hidden="true" />
      </button>
      {open && (
        <RollDialog
          label="d20 Roll"
          exhaustionLevel={0}
          hint="Pick Advantage/Disadvantage and an optional DC, then roll."
          onRoll={() => setOpen(false)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}