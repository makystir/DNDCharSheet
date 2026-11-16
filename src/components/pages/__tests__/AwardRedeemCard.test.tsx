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

  it('blocks a level award on a classless sheet', async () => {
    const onChange = vi.fn();
    render(<Harness initial={{ ...sheet(5, 'xp', 0), classes: [] }} onChange={onChange} />);
    await paste(await code({ kind: 'level', amount: 8 }));
    expect(await screen.findByText(/has no class/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('blocks a level award on a sheet with a manual HP maximum', async () => {
    const onChange = vi.fn();
    render(<Harness initial={sheet(5, 'xp', 0, { hpMax: 40 })} onChange={onChange} />);
    await paste(await code({ kind: 'level', amount: 8 }));
    expect(await screen.findByText(/manual Hit Point maximum/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
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

  it('drops the preview when the text is edited after Check', async () => {
    const onChange = vi.fn();
    render(<Harness initial={sheet(3, 'xp', 0)} onChange={onChange} />);
    await paste(await code({ id: 'aaaaaaaa1111' }));
    expect(await screen.findByRole('button', { name: 'Apply' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Paste an award code'), { target: { value: await code({ id: 'bbbbbbbb2222', amount: 999 }) } });
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not crash on a malformed appliedAwards value', async () => {
    const c = sheet(3, 'xp', 0);
    const bad = { ...c, advancement: { ...c.advancement, appliedAwards: 'abcdef123456' as unknown as string[] } };
    render(<Harness initial={bad} onChange={() => {}} />);
    await paste(await code({}));
    expect(await screen.findByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('warns when recorded XP is below the threshold for the current level', async () => {
    render(<Harness initial={sheet(5, 'xp', 0)} onChange={() => {}} />);
    await paste(await code({}));
    expect(await screen.findByText(/Your recorded XP \(0\) is below the level 5 threshold/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('shows "XP not tracked" for a level award on a sheet with no XP', async () => {
    render(<Harness initial={sheet(3, undefined)} onChange={() => {}} />);
    await paste(await code({ kind: 'level', amount: 5 }));
    const preview = await screen.findByTestId('award-preview');
    expect(within(preview).getByText(/XP not tracked on this sheet/)).toBeInTheDocument();
    expect(within(preview).queryByText(/current XP 0/)).not.toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: /^Level you can reach/ })).toHaveTextContent('5');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('keeps the numbers visible when an XP award is blocked on a milestone sheet', async () => {
    render(<Harness initial={sheet(5, 'milestone', 300)} onChange={() => {}} />);
    await paste(await code({ amount: 100 }));
    const preview = await screen.findByTestId('award-preview');
    expect(within(preview).getByRole('alert')).toHaveTextContent(/levels by milestone/);
    expect(within(preview).getByRole('button', { name: /^New XP/ })).toHaveTextContent('400');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('keeps the numbers visible when a level award is blocked on a multiclass sheet', async () => {
    const base = sheet(5, 'xp', 6500);
    const classes = base.classes ? [{ ...base.classes[0], level: 3 }, { ...base.classes[0], level: 2 }] : undefined;
    render(<Harness initial={{ ...base, classes }} onChange={() => {}} />);
    await paste(await code({ kind: 'level', amount: 7 }));
    const preview = await screen.findByTestId('award-preview');
    expect(within(preview).getByRole('alert')).toHaveTextContent(/more than one class/);
    expect(within(preview).getByRole('button', { name: /^Level you can reach/ })).toHaveTextContent('7');
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('blocks an XP award on an XP-mode sheet above level 1 with no recorded XP', async () => {
    const onChange = vi.fn();
    const base = sheet(5, 'xp', 0);
    const c: Character = { ...base, advancement: { ...base.advancement, leveling: { mode: 'xp' } } };
    render(<Harness initial={c} onChange={onChange} />);
    await paste(await code({ amount: 450 }));
    const preview = await screen.findByTestId('award-preview');
    expect(within(preview).getByRole('alert')).toHaveTextContent(/no XP recorded/);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
