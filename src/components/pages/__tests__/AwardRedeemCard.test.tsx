import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AwardRedeemCard } from '../advancement/AwardRedeemCard';
import { encodeAward, type AwardPayload } from '../../../logic/dm-awards';
import { characterXp } from '../../../logic/advancement';
import { generateRandomCharacter } from '../../../logic/personal-details-generation';
import { createSeededRng } from '../../../logic/random';
import type { Character } from '../../../types/character';

function sheet(level: number, mode: 'xp' | 'milestone' | undefined, xp = 0, extra: Partial<Character> = {}): Character {
  const base = generateRandomCharacter(createSeededRng(9));
  const advancement = { ...base.advancement };
  delete advancement.appliedAwards;
  if (mode === undefined) delete advancement.leveling;
  else advancement.leveling = { mode, xp };
  return {
    ...base,
    level,
    classes: base.classes ? [{ ...base.classes[0], level }] : undefined,
    advancement,
    ...extra,
  };
}

async function code(award: Partial<AwardPayload>): Promise<string> {
  const r = await encodeAward({ kind: 'xp', amount: 100, id: 'abcdef123456', label: '', ...award });
  if (!r.ok) throw new Error(r.error);
  return r.code;
}

function Harness({ initial, onChange }: { initial: Character; onChange: (c: Character) => void }) {
  const [c, setC] = useState(initial);
  return (
    <AwardRedeemCard
      character={c}
      onChange={(next) => {
        onChange(next);
        setC(next);
      }}
      now={() => 1000}
    />
  );
}

async function paste(value: string) {
  fireEvent.change(screen.getByLabelText('Paste an award code'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Check' }));
}

describe('AwardRedeemCard', () => {
  it('explains bad codes', async () => {
    render(<Harness initial={sheet(3, 'xp')} onChange={() => {}} />);
    await paste('');
    expect(await screen.findByRole('alert')).toHaveTextContent('Paste an award code.');
    await paste('hello');
    expect(await screen.findByText(/not an award code/)).toBeInTheDocument();
    await paste('https://x.test/#view/abc');
    expect(await screen.findByText(/character share link/)).toBeInTheDocument();
    await paste('AWARD-@@@');
    expect(await screen.findByText(/not valid/)).toBeInTheDocument();
  });

  it('previews an XP award with "Level you can reach" and applies it once', async () => {
    const onChange = vi.fn();
    render(<Harness initial={sheet(3, 'xp', 2600)} onChange={onChange} />);
    await paste(await code({ amount: 100, label: 'Crypt' }));
    const preview = await screen.findByTestId('award-preview');
    expect(within(preview).getByText(/Level you can reach/)).toBeInTheDocument();
    expect(within(preview).getByText(/Leveling up is still done on the Advancement page/)).toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: /^New XP/ })).toHaveTextContent('2,700');
    expect(within(preview).getByRole('button', { name: /^Level you can reach/ })).toHaveTextContent('4');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(characterXp(onChange.mock.calls[0][0])).toBe(2700);
    expect(screen.getByText('Award applied.')).toBeInTheDocument();
    expect(screen.queryByTestId('award-preview')).not.toBeInTheDocument();
  });

  it('refuses the same code a second time', async () => {
    const onChange = vi.fn();
    render(<Harness initial={sheet(3, 'xp', 0)} onChange={onChange} />);
    const c = await code({});
    await paste(c);
    fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));
    await paste(c);
    expect(await screen.findByText('You already applied this award.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('leaves the character alone on Cancel', async () => {
    const onChange = vi.fn();
    render(<Harness initial={sheet(3, 'xp', 0)} onChange={onChange} />);
    await paste(await code({}));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('award-preview')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('previews a level award with its own sentence and sets the level', async () => {
    const onChange = vi.fn();
    render(<Harness initial={sheet(3, 'milestone')} onChange={onChange} />);
    await paste(await code({ kind: 'level', amount: 6 }));
    const preview = await screen.findByTestId('award-preview');
    expect(within(preview).getByText(/Level you can reach/)).toBeInTheDocument();
    expect(within(preview).getByText('Applying this sets your level directly.')).toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: /^Level you can reach/ })).toHaveTextContent('6');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange.mock.calls[0][0].level).toBe(6);
  });

  it('blocks a level award on a multiclass sheet', async () => {
    const base = sheet(5, 'xp', 0);
    const first = base.classes![0];
    const multi = { ...base, classes: [{ ...first, level: 4 }, { ...first, level: 1 }] };
    const onChange = vi.fn();
    render(<Harness initial={multi} onChange={onChange} />);
    await paste(await code({ kind: 'level', amount: 8 }));
    expect(await screen.findByText(/more than one class/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveAttribute('aria-disabled', 'true');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('blocks an XP award on a milestone sheet', async () => {
    const onChange = vi.fn();
    render(<Harness initial={sheet(5, 'milestone')} onChange={onChange} />);
    await paste(await code({}));
    expect(await screen.findByText(/levels by milestone/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('warns when recorded XP is below the threshold for the current level', async () => {
    render(<Harness initial={sheet(5, 'xp', 0)} onChange={() => {}} />);
    await paste(await code({}));
    expect(await screen.findByText(/Your recorded XP \(0\) is below the level 5 threshold/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });
});
