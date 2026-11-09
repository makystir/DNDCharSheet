import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { SpellName, SpellNameList } from '../SpellName';
import { SpellPickList } from '../SpellPickList';
import { SPELL_CATALOG, spellsForClass } from '../../../data/spells';
import type { SpellId } from '../../../data/spells';

afterEach(cleanup);

describe('SpellName', () => {
  it('shows the spell tooltip with its casting stats on hover', () => {
    render(<SpellName id="fireball" />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Fireball' }));
    const tip = screen.getByRole('tooltip');
    expect(within(tip).getByText('Level 3 Evocation')).toBeInTheDocument();
    expect(within(tip).getByText('Casting time')).toBeInTheDocument();
    expect(within(tip).getByText('Range')).toBeInTheDocument();
    expect(within(tip).getByText('Duration')).toBeInTheDocument();
  });

  it('falls back to plain text for a spell that is not in the catalog', () => {
    render(<SpellName id="not-a-spell" />);
    expect(screen.getByText('not-a-spell')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('gives every catalog spell a tooltip', () => {
    for (const spell of SPELL_CATALOG) {
      const { unmount } = render(<SpellName id={spell.id} />);
      expect(screen.getByRole('button', { name: spell.name }), spell.id).toBeInTheDocument();
      unmount();
    }
  });

  it('SpellNameList renders a tooltip trigger for each name, comma separated', () => {
    render(<p data-testid="list"><SpellNameList ids={['fireball', 'shield']} /></p>);
    expect(screen.getByRole('button', { name: 'Fireball' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shield' })).toBeInTheDocument();
    expect(screen.getByTestId('list')).toHaveTextContent('Fireball, Shield');
  });
});

describe('spell pick list names', () => {
  const spells = spellsForClass('cleric').filter((s) => s.level === 1).slice(0, 3);

  it('opens the tooltip from the name without toggling the checkbox', () => {
    const onToggle = vi.fn();
    render(
      <SpellPickList
        spells={spells}
        selectedIds={[] as SpellId[]}
        atCap={false}
        onToggle={onToggle}
      />,
    );
    const first = spells[0];
    fireEvent.click(screen.getByRole('button', { name: first.name }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: new RegExp(`^${first.name}`) })).not.toBeChecked();
  });

  it('still toggles from the checkbox itself', () => {
    const onToggle = vi.fn();
    render(
      <SpellPickList spells={spells} selectedIds={[] as SpellId[]} atCap={false} onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(`^${spells[0].name}`) }));
    expect(onToggle).toHaveBeenCalledWith(spells[0].id, true);
  });
});
