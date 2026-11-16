import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { XpPage } from '../XpPage';
import { useDmData } from '../../../hooks/useDmData';
import { DM_DATA_KEY, loadDmData, saveDmData } from '../../../storage/dm-store';
import { addImportedMember, addManualMember, createCampaign, DEFAULT_MANUAL_STATS, emptyDmData } from '../../../logic/dm-campaign';
import * as gz from '../../../logic/gzip';
import { decodeAward } from '../../../logic/dm-awards';
import { customCombatant } from '../../../logic/dm-encounter';
import { generateRandomCharacter } from '../../../logic/personal-details-generation';
import { createSeededRng } from '../../../logic/random';
import type { Character } from '../../../types/character';

const UUID = '11111111-2222-3333-4444-555555555555';

function sheet(level: number, mode: 'xp' | 'milestone', xp: number): Character {
  const base = generateRandomCharacter(createSeededRng(5));
  return {
    ...base,
    level,
    classes: base.classes ? [{ ...base.classes[0], level }] : undefined,
    advancement: { ...base.advancement, leveling: { mode, xp } },
  };
}

function seed(members: Array<{ id: string; character: Character }> = [], manualLevel?: number) {
  let d = createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 });
  for (const m of members) d = addImportedMember(d, 'c', { id: m.id, character: { ...m.character, name: m.id }, now: 1 }).data;
  if (manualLevel !== undefined) {
    d = addManualMember(d, 'c', { id: 'man', name: 'Manny', stats: { ...DEFAULT_MANUAL_STATS, level: manualLevel }, now: 1 });
  }
  saveDmData(d);
}

function Page({ onNotify = () => {}, newId = () => UUID }: { onNotify?: (t: string) => void; newId?: () => string }) {
  const dm = useDmData();
  return <XpPage dm={dm} onNotify={onNotify} newId={newId} />;
}

function typeAmount(value: string) {
  fireEvent.click(screen.getByRole('tab', { name: 'Noncombat' }));
  fireEvent.change(screen.getByLabelText('Difficulty of the challenge'), { target: { value: 'typed' } });
  fireEvent.change(screen.getByLabelText('XP per character'), { target: { value } });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Party XP page', () => {
  it('shows each member new XP and the level they can reach, with breakdown tooltips', () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 2600) }]);
    render(<Page />);
    typeAmount('100');
    expect(screen.getByRole('columnheader', { name: 'Level you can reach' })).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /Ann/ });
    expect(within(row).getByRole('button', { name: /^Ann: new XP:/ })).toHaveTextContent('2,700');
    expect(within(row).getByRole('button', { name: /^Ann: level you can reach:/ })).toHaveTextContent('4');
    expect(within(row).getByText('Levels up')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Party total XP/ })).toHaveTextContent('100');
  });

  it('marks milestone sheets as blocked and counts 0 XP for them in the party total', () => {
    seed([{ id: 'Bea', character: sheet(5, 'milestone', 0) }]);
    render(<Page />);
    typeAmount('100');
    expect(screen.getByText(/this sheet levels by milestone/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Party total XP/ })).toHaveTextContent(/^0$/);
  });

  it('marks an XP-mode sheet with no recorded XP as blocked', () => {
    const c = sheet(5, 'xp', 0);
    seed([{ id: 'Cy', character: { ...c, advancement: { ...c.advancement, leveling: { mode: 'xp' } } } }]);
    render(<Page />);
    typeAmount('100');
    expect(screen.getByText(/uses XP leveling but has no XP recorded/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Party total XP/ })).toHaveTextContent(/^0$/);
  });

  it('shows the known XP for a manual member and counts it in the party total', () => {
    seed([], 4);
    render(<Page />);
    typeAmount('100');
    expect(screen.getAllByText('XP not tracked').length).toBeGreaterThan(0);
    const row = screen.getByRole('row', { name: /Manny/ });
    expect(within(row).getByRole('button', { name: /^Manny: XP added:/ })).toHaveTextContent('100');
    expect(screen.getByRole('button', { name: /Party total XP/ })).toHaveTextContent('100');
  });

  it('shows the direct level result for a manual member on a level award', () => {
    seed([], 4);
    render(<Page />);
    fireEvent.click(screen.getByRole('tab', { name: 'Level' }));
    fireEvent.change(screen.getByLabelText('Target level'), { target: { value: '6' } });
    const row = screen.getByRole('row', { name: /Manny/ });
    expect(within(row).getByRole('button', { name: /^Manny: level you can reach:/ })).toHaveTextContent('6');
    expect(within(row).getByText('Levels up')).toBeInTheDocument();
  });

  it('hides the code and does not mint a second award when the draft changes', async () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 0) }]);
    render(<Page />);
    typeAmount('50');
    const create = screen.getByRole('button', { name: 'Create code' });
    fireEvent.click(create);
    fireEvent.click(create);
    await screen.findByLabelText('Award code');
    await waitFor(() => expect(loadDmData().campaigns[0].awards).toHaveLength(1));
    fireEvent.change(screen.getByLabelText('Label (optional)'), { target: { value: 'Changed' } });
    expect(screen.queryByLabelText('Award code')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('XP per character'), { target: { value: '60' } });
    expect(screen.queryByLabelText('Award code')).not.toBeInTheDocument();
  });

  it('creates a code that decodes to the shown award, and keeps history across a remount', async () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 2600) }]);
    const first = render(<Page />);
    typeAmount('150');
    fireEvent.change(screen.getByLabelText('Label (optional)'), { target: { value: 'Crypt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    const code = await screen.findByLabelText('Award code');
    const decoded = await decodeAward((code as HTMLTextAreaElement).value);
    expect(decoded).toEqual({ ok: true, award: { kind: 'xp', amount: 150, id: '111111112222', label: 'Crypt' } });
    await waitFor(() => expect(loadDmData().campaigns[0].awards).toHaveLength(1));
    expect(JSON.parse(localStorage.getItem(DM_DATA_KEY)!).campaigns[0].awards[0].label).toBe('Crypt');
    first.unmount();

    render(<Page />);
    expect(screen.getByText(/Crypt · 150 XP/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show code' }));
    const again = await screen.findByLabelText('Award code');
    expect((again as HTMLTextAreaElement).value).toBe((code as HTMLTextAreaElement).value);
  });

  it('names a code reopened from history and keeps it when the form is edited', async () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 0) }]);
    const first = render(<Page />);
    typeAmount('150');
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    await screen.findByLabelText('Award code');
    await waitFor(() => expect(loadDmData().campaigns[0].awards).toHaveLength(1));
    first.unmount();
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: 'Show code' }));
    await screen.findByLabelText('Award code');
    expect(screen.getByTestId('shown-award')).toHaveTextContent('Past award: Award · 150 XP');
    // The form now describes a different award; the shown code still names its own.
    fireEvent.change(screen.getByLabelText('Label (optional)'), { target: { value: 'Edited' } });
    expect(screen.getByLabelText('Award code')).toBeInTheDocument();
    expect(screen.getByTestId('shown-award')).toHaveTextContent('Past award: Award · 150 XP');
  });

  it('does not reuse a created code when another encounter with the same XP is picked', async () => {
    const mon = (id: string) => ({ ...customCombatant(id, { name: id, ac: 10, hpMax: 10, initiativeMod: 0 }), xp: 100 });
    let d = createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 });
    d = addImportedMember(d, 'c', { id: 'Ann', character: { ...sheet(3, 'xp', 0), name: 'Ann' }, now: 1 }).data;
    const enc = (id: string) => ({ id, name: id, status: 'ended' as const, round: 0, activeId: null, combatants: [{ ...mon(`${id}-orc`), kind: 'monster' as const, xpCounts: true }], log: [], createdAt: 1, updatedAt: 1 });
    d = { ...d, campaigns: d.campaigns.map((c) => ({ ...c, encounters: [enc('e1'), enc('e2')] })) };
    saveDmData(d);
    let i = 0;
    render(<Page newId={() => `0000000000${++i}-aaaa-bbbb-cccc-dddddddddddd`} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    await screen.findByLabelText('Award code');
    fireEvent.change(screen.getByLabelText('Encounter'), { target: { value: 'e1' } });
    expect(screen.queryByLabelText('Award code')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    await waitFor(() => expect(loadDmData().campaigns[0].awards).toHaveLength(2));
    const [a, b] = loadDmData().campaigns[0].awards!;
    expect(a.id).not.toBe(b.id);
  });

  it('defaults the fight form to the active encounter, then the newest one', async () => {
    const mon = (id: string, xp: number) => ({ ...customCombatant(id, { name: id, ac: 10, hpMax: 10, initiativeMod: 0 }), xp, kind: 'monster' as const, xpCounts: true });
    const enc = (id: string, xp: number) => ({ id, name: id, status: 'ended' as const, round: 0, activeId: null, combatants: [mon(`${id}-orc`, xp)], log: [], createdAt: 1, updatedAt: 1 });
    const build = (activeEncounterId: string | null) => {
      let d = createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 });
      d = addImportedMember(d, 'c', { id: 'Ann', character: { ...sheet(3, 'xp', 0), name: 'Ann' }, now: 1 }).data;
      d = { ...d, campaigns: d.campaigns.map((c) => ({ ...c, activeEncounterId, encounters: [enc('e1', 100), enc('e2', 200), enc('e3', 300)] })) };
      saveDmData(d);
    };
    build('e2');
    const first = render(<Page />);
    expect(screen.getByLabelText('Encounter')).toHaveValue('e2');
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    const code = await screen.findByLabelText('Award code');
    expect(await decodeAward((code as HTMLTextAreaElement).value)).toMatchObject({ ok: true, award: { kind: 'xp', amount: 200 } });
    first.unmount();
    localStorage.clear();
    build(null);
    render(<Page />);
    expect(screen.getByLabelText('Encounter')).toHaveValue('e3');
  });

  it('hides the previous code while a history code is requested, and when that request fails', async () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 0) }]);
    render(<Page />);
    typeAmount('50');
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    await screen.findByLabelText('Award code');
    await waitFor(() => expect(loadDmData().campaigns[0].awards).toHaveLength(1));
    vi.spyOn(gz, 'isGzipSupported').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Show code' }));
    await waitFor(() => expect(screen.queryByLabelText('Award code')).not.toBeInTheDocument());
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
  it('rejects an invalid sharer count instead of coercing it', () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 0) }]);
    render(<Page />);
    for (const bad of ['0', '-2', '1.5']) {
      fireEvent.change(screen.getByLabelText('Characters sharing the XP'), { target: { value: bad } });
      expect(screen.getByRole('alert')).toHaveTextContent(/sharing the XP must be a whole number/);
      expect(screen.getByRole('button', { name: 'Create code' })).toBeDisabled();
    }
  });
  it('rejects a sharer count below the number of party members shown', () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 0) }, { id: 'Bo', character: sheet(3, 'xp', 0) }]);
    render(<Page />);
    fireEvent.change(screen.getByLabelText('Characters sharing the XP'), { target: { value: '1' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot be fewer than the 2 party members/);
    expect(screen.getByRole('button', { name: 'Create code' })).toBeDisabled();
  });

  it('hides the party XP total on a level award', () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 0) }]);
    render(<Page />);
    fireEvent.click(screen.getByRole('tab', { name: 'Level' }));
    expect(screen.queryByRole('button', { name: /Party total XP/ })).not.toBeInTheDocument();
  });

  it('lets the DM create a second award with identical values, with its own ID', async () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 0) }]);
    let i = 0;
    render(<Page newId={() => `0000000000${++i}-aaaa-bbbb-cccc-dddddddddddd`} />);
    typeAmount('50');
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    await screen.findByLabelText('Award code');
    fireEvent.click(screen.getByRole('button', { name: 'Create another award with these values' }));
    await waitFor(() => expect(loadDmData().campaigns[0].awards).toHaveLength(2));
    const [a, b] = loadDmData().campaigns[0].awards!;
    expect(a.id).not.toBe(b.id);
    expect(a.amount).toBe(b.amount);
  });

  it('creates a level award without needing XP', async () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 0) }]);
    render(<Page />);
    fireEvent.click(screen.getByRole('tab', { name: 'Level' }));
    fireEvent.change(screen.getByLabelText('Target level'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    const code = (await screen.findByLabelText('Award code')) as HTMLTextAreaElement;
    const decoded = await decodeAward(code.value);
    expect(decoded.ok && decoded.award.kind === 'level' && decoded.award.amount === 6).toBe(true);
  });

  it('disables Create for an invalid amount', () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 0) }]);
    render(<Page />);
    typeAmount('0');
    expect(screen.getByRole('button', { name: 'Create code' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/whole number/);
  });

  it('says there is no XP to award for a fight with nothing counted', () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 0) }]);
    render(<Page />);
    fireEvent.click(screen.getByRole('tab', { name: 'Fight' }));
    expect(screen.getByRole('button', { name: 'Create code' })).toBeDisabled();
  });

  it('copies the code once, and falls back to a hand-copy notice when copying fails', async () => {
    seed([{ id: 'Ann', character: sheet(3, 'xp', 0) }]);
    const onNotify = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<Page onNotify={onNotify} />);
    typeAmount('50');
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    const code = (await screen.findByLabelText('Award code')) as HTMLTextAreaElement;
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(onNotify).toHaveBeenCalledWith('Code copied'));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(code.value);

    writeText.mockRejectedValue(new Error('denied'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(onNotify).toHaveBeenCalledWith('Select the code and copy it by hand'));
  });

  it('still creates a code with no campaign', async () => {
    render(<Page />);
    typeAmount('50');
    fireEvent.click(screen.getByRole('button', { name: 'Create code' }));
    expect(await screen.findByLabelText('Award code')).toBeInTheDocument();
  });
});
