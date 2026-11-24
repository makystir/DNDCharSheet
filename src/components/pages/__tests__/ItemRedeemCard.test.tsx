import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InventoryPage } from '../InventoryPage';
import type { Character } from '../../../types/character';
import { createCharacter } from '../../../storage/character-store';
import { resolveMagicItem } from '../../../logic/magic-item-resolve';
import { encodeItemCode } from '../../../logic/dm-item-codes';

function renderInventory() {
  let latest: Character = { ...createCharacter('Tester'), inventory: [{ id: 'keep', kind: 'equipment', name: 'Rope', quantity: 1 }] };
  function Harness() {
    const [c, setC] = useState(latest);
    return (
      <InventoryPage
        character={c}
        onChange={(n) => {
          latest = n;
          setC(n);
        }}
      />
    );
  }
  render(<Harness />);
  return { get: () => latest };
}

describe('ItemRedeemCard', () => {
  it('adds a checked item to the inventory', async () => {
    const enc = await encodeItemCode(resolveMagicItem('Handy Haversack'));
    if (!enc.ok) throw new Error(enc.error);
    const sheet = renderInventory();
    fireEvent.change(screen.getByLabelText('Paste an item code'), { target: { value: enc.code } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await screen.findByTestId('item-preview');
    fireEvent.click(screen.getByRole('button', { name: 'Add to inventory' }));
    expect(sheet.get().inventory).toHaveLength(2);
    expect(sheet.get().inventory![1].name).toBe('Handy Haversack');
    expect(screen.getByText('Handy Haversack added to your inventory.')).toBeTruthy();
  });

  it('shows an error for a corrupt code and leaves the inventory unchanged', async () => {
    const sheet = renderInventory();
    fireEvent.change(screen.getByLabelText('Paste an item code'), { target: { value: 'ITEM-@@@@' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByTestId('item-preview')).toBeNull();
    expect(sheet.get().inventory).toHaveLength(1);
  });
});
