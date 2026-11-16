import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SWUpdateProvider } from '../../../hooks/useSWUpdate';
import { DmShell } from '../DmShell';
import { DM_DATA_KEY } from '../../../storage/dm-store';
import type { DmPage } from '../../../logic/dm-mode';
import type { DmCombatant, DmCustomMonster, DmData, DmEncounter } from '../../../types/dm';
import { MONSTER_MANUAL_2024_LIST } from '../../../data/monster-manual-2024';
import { addManualMember, createCampaign, DEFAULT_MANUAL_STATS, emptyDmData } from '../../../logic/dm-campaign';
import {
  addCombatants,
  combatantFromMember,
  combatantFromMonsterManual,
  createEncounter,
  customCombatant,
  makeCopies,
  openEncounter,
  saveEncounter,
} from '../../../logic/dm-encounter';
import { blankCustomMonster, combatantFromLibrary, fromCustom } from '../../../logic/dm-library';
import encStyles from '../encounter.module.css';

function Routed({ initial }: { initial: DmPage }) {
  const [page, setPage] = useState<DmPage>(initial);
  return (
    <SWUpdateProvider>
      <DmShell page={page} onNavigate={setPage} onOpenPlayer={() => {}} onTurnOff={() => {}} theme="dark" onThemeToggle={() => {}} />
    </SWUpdateProvider>
  );
}

let n = 0;
const nid = () => `x${++n}`;
const mm = (name: string, id: string) => combatantFromMonsterManual(MONSTER_MANUAL_2024_LIST.find((e) => e.name === name)!, id);

function seed(build: (d: DmData) => { enc: DmEncounter; customMonsters?: DmCustomMonster[] }) {
  let d = createCampaign(emptyDmData(), { id: 'c', name: 'Test', now: 1 });
  d = addManualMember(d, 'c', { id: 'm1', name: 'Borin', stats: { ...DEFAULT_MANUAL_STATS, ac: 18, hpMax: 30, hpCurrent: 30 }, now: 1 });
  const { enc, customMonsters } = build(d);
  d = openEncounter(saveEncounter(d, 'c', enc, 1), 'c', enc.id);
  if (customMonsters) d = { ...d, customMonsters };
  localStorage.setItem(DM_DATA_KEY, JSON.stringify(d));
  render(<Routed initial="encounter" />);
}

/** A running encounter: Goblin Warrior 1, Goblin Warrior 2, an Adult Red Dragon, Borin (pc) and a Custom-tab Bandit. */
function seedRunning(opts: { activeId?: string | null; status?: DmEncounter['status'] } = {}) {
  seed((d) => {
    const goblins = makeCopies(mm('Goblin Warrior', 'g'), 2, nid, false).map((c, i) => ({ ...c, id: `g${i + 1}`, initiative: 20 - i }));
    const dragon = { ...mm('Adult Red Dragon', 'dragon'), initiative: 15 };
    const pc = { ...combatantFromMember(d.campaigns[0].party[0], 'pc')!, initiative: 12 };
    const tab = { ...customCombatant('tab', { name: 'Thug', ac: 11, hpMax: 9, initiativeMod: 0 }), initiative: 10 };
    const status = opts.status ?? 'running';
    let enc = addCombatants(createEncounter('e', 'Ambush', 1), [...goblins, dragon, pc, tab]);
    enc = {
      ...enc,
      status,
      round: status === 'setup' ? 0 : 1,
      activeId: status === 'running' ? (opts.activeId === undefined ? 'g1' : opts.activeId) : null,
    };
    return { enc };
  });
}

const drawer = () => screen.queryByRole('complementary', { name: 'Stat block' });
const show = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Show stat block for ${name}` }));
const toggleFollow = () => fireEvent.click(within(drawer()!).getByRole('checkbox', { name: 'Follow the active turn' }));
const drawerNext = () => fireEvent.click(within(drawer()!).getByRole('button', { name: 'Next turn' }));

beforeEach(() => localStorage.clear());

describe('Stat block drawer on the Encounter page', () => {
  it('opens, replaces, and closes with Close and Escape', () => {
    seedRunning();
    show('Goblin Warrior 2');
    const d = drawer()!;
    expect(d).toBeInTheDocument();
    expect(within(d).getByRole('article', { name: 'Goblin Warrior stat block' })).toBeInTheDocument();
    expect(within(d).getByText('AC 15, HP 10/10', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide stat block for Goblin Warrior 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Show stat block for Goblin Warrior 1' })).toHaveAttribute('aria-pressed', 'false');

    show('Adult Red Dragon');
    expect(within(drawer()!).getByRole('article', { name: 'Adult Red Dragon stat block' })).toBeInTheDocument();
    expect(within(drawer()!).getByRole('region', { name: 'Legendary Actions' })).toBeInTheDocument();
    expect(screen.getAllByRole('complementary', { name: 'Stat block' })).toHaveLength(1);

    fireEvent.click(within(drawer()!).getByRole('button', { name: 'Close' }));
    expect(drawer()).toBeNull();

    show('Goblin Warrior 1');
    fireEvent.keyDown(within(drawer()!).getByRole('button', { name: 'Close' }), { key: 'Escape' });
    expect(drawer()).toBeNull();

    show('Goblin Warrior 1');
    fireEvent.click(screen.getByRole('button', { name: 'Hide stat block for Goblin Warrior 1' }));
    expect(drawer()).toBeNull();
  });

  it('has no control for party members or Custom-tab combatants', () => {
    seedRunning();
    expect(screen.queryByRole('button', { name: 'Show stat block for Borin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show stat block for Thug' })).toBeNull();
  });

  it('uses the drawer and page layout classes', () => {
    seedRunning();
    show('Goblin Warrior 1');
    expect(drawer()).toHaveClass(encStyles.drawer);
    const page = screen.getByRole('heading', { name: 'Ambush' }).closest(`.${encStyles.withDrawer}`);
    expect(page).not.toBeNull();
    expect(page).toHaveClass(encStyles.withSheet);
  });

  it('closes when the open combatant is removed', () => {
    seed(() => ({ enc: addCombatants(createEncounter('e', 'Ambush', 1), [{ ...mm('Goblin Warrior', 'g1'), name: 'Goblin A' }, { ...mm('Goblin Warrior', 'g2'), name: 'Goblin B' }]) }));
    show('Goblin A');
    expect(drawer()).not.toBeNull();
    const cards = screen.getAllByTestId('combatant-card');
    fireEvent.click(within(cards[0]).getByRole('button', { name: /^Show more for/ }));
    fireEvent.click(within(cards[0]).getByRole('button', { name: 'Remove from encounter' }));
    expect(screen.getAllByTestId('combatant-card')).toHaveLength(1);
    expect(drawer()).toBeNull();
  });

  it('opens on an ended encounter and for a defeated combatant', () => {
    seed(() => {
      const dead = mm('Goblin Warrior', 'g1');
      dead.hp = { ...dead.hp, hp: 0, dead: true };
      const enc = addCombatants(createEncounter('e', 'Ambush', 1), [dead]);
      return { enc: { ...enc, status: 'ended', round: 2 } };
    });
    show('Goblin Warrior');
    expect(within(drawer()!).getByRole('article', { name: 'Goblin Warrior stat block' })).toBeInTheDocument();
    expect(within(drawer()!).queryByRole('button', { name: 'Next turn' })).toBeNull();
  });

  it('opens a legacy combatant by its label, and shows the empty message for a legacy custom one', () => {
    seed(() => {
      const { libraryKey: _k, ...legacy } = mm('Bandit', 'b');
      void _k;
      const oldCustom: DmCombatant = { ...customCombatant('oc', { name: 'Goblin', ac: 12, hpMax: 7, initiativeMod: 0 }), sourceLabel: 'Goblin (custom)', name: 'Old Goblin' };
      return { enc: addCombatants(createEncounter('e', 'Ambush', 1), [legacy, oldCustom]) };
    });
    show('Bandit');
    expect(within(drawer()!).getByRole('article', { name: 'Bandit stat block' })).toBeInTheDocument();
    show('Old Goblin');
    expect(within(drawer()!).getByText(/No stat block is linked to this combatant/)).toBeInTheDocument();
  });

  it('keeps the snapshot of a custom monster that was edited, then deleted', () => {
    const ogre: DmCustomMonster = { ...blankCustomMonster('ogre', 1), name: 'Ogre', ac: 11 };
    const c = combatantFromLibrary(fromCustom(ogre), 'o1')!;
    const enc = addCombatants(createEncounter('e', 'Ambush', 1), [c], [ogre]);
    seed(() => ({ enc, customMonsters: [{ ...ogre, name: 'Ogre', ac: 19, updatedAt: 9 }] }));
    show('Ogre');
    const d = drawer()!;
    expect(within(d).getByTestId('stat-block-note')).toHaveTextContent(/edited in the library after it was added/);
    expect(within(d).getByRole('article', { name: 'Ogre stat block' })).toHaveTextContent('AC 11');
  });

  it('shows the deleted note when the custom monster is gone', () => {
    const ogre: DmCustomMonster = { ...blankCustomMonster('ogre', 1), name: 'Ogre', ac: 11 };
    const enc = addCombatants(createEncounter('e', 'Ambush', 1), [combatantFromLibrary(fromCustom(ogre), 'o1')!], [ogre]);
    seed(() => ({ enc, customMonsters: [] }));
    show('Ogre');
    expect(within(drawer()!).getByTestId('stat-block-note')).toHaveTextContent(/deleted from the library after it was added/);
    expect(within(drawer()!).getByRole('article', { name: 'Ogre stat block' })).toBeInTheDocument();
  });
});

describe('Follow the active turn', () => {
  it('switches the shown creature on Next turn from the drawer header', () => {
    seedRunning();
    show('Goblin Warrior 2');
    toggleFollow();
    // Following: Goblin Warrior 1 is active.
    expect(screen.getByRole('button', { name: 'Hide stat block for Goblin Warrior 1' })).toHaveAttribute('aria-pressed', 'true');
    drawerNext();
    expect(screen.getByRole('button', { name: 'Hide stat block for Goblin Warrior 2' })).toBeInTheDocument();
    drawerNext();
    expect(within(drawer()!).getByRole('article', { name: 'Adult Red Dragon stat block' })).toBeInTheDocument();
  });

  it('keeps the last creature with a note when a party member or Custom-tab combatant is active', () => {
    seedRunning({ activeId: 'dragon' });
    show('Goblin Warrior 1');
    toggleFollow();
    expect(within(drawer()!).getByRole('article', { name: 'Adult Red Dragon stat block' })).toBeInTheDocument();
    drawerNext(); // Borin (pc)
    expect(within(drawer()!).getByRole('article', { name: 'Adult Red Dragon stat block' })).toBeInTheDocument();
    expect(within(drawer()!).getByTestId('stat-block-note')).toHaveTextContent('Active combatant has no stat block');
    drawerNext(); // Thug (Custom tab)
    expect(within(drawer()!).getByTestId('stat-block-note')).toHaveTextContent('Active combatant has no stat block');
    expect(within(drawer()!).getByRole('article', { name: 'Adult Red Dragon stat block' })).toBeInTheDocument();
  });

  it('stays mounted with "No active turn" when there is no active combatant', () => {
    seedRunning({ activeId: null });
    show('Goblin Warrior 1');
    toggleFollow();
    expect(drawer()).not.toBeNull();
    expect(within(drawer()!).getByTestId('stat-block-note')).toHaveTextContent('No active turn');
    expect(within(drawer()!).getByRole('checkbox', { name: 'Follow the active turn' })).toBeChecked();
    expect(within(drawer()!).getByRole('article', { name: 'Goblin Warrior stat block' })).toBeInTheDocument();
  });

  it('turning follow off leaves the last shown creature open', () => {
    seedRunning();
    show('Adult Red Dragon');
    toggleFollow();
    expect(screen.getByRole('button', { name: 'Hide stat block for Goblin Warrior 1' })).toBeInTheDocument();
    toggleFollow();
    expect(screen.getByRole('button', { name: 'Hide stat block for Goblin Warrior 1' })).toHaveAttribute('aria-pressed', 'true');
    drawerNext();
    // Not following: still Goblin Warrior 1.
    expect(screen.getByRole('button', { name: 'Hide stat block for Goblin Warrior 1' })).toBeInTheDocument();
  });

  it('leaves a placeholder with the toggle and Close when the last shown creature is removed', () => {
    seedRunning({ activeId: 'pc' });
    show('Goblin Warrior 1');
    toggleFollow();
    expect(within(drawer()!).getByTestId('stat-block-note')).toHaveTextContent('Active combatant has no stat block');
    const card = screen.getAllByTestId('combatant-card').find((el) => within(el).queryByText('Goblin Warrior 1'))!;
    fireEvent.click(within(card).getByRole('button', { name: /^Show more for/ }));
    fireEvent.click(within(card).getByRole('button', { name: 'Remove from encounter' }));
    const d = drawer()!;
    expect(d).not.toBeNull();
    expect(within(d).getByText('Waiting for a combatant with a stat block')).toBeInTheDocument();
    expect(within(d).getByRole('checkbox', { name: 'Follow the active turn' })).toBeChecked();
    fireEvent.click(within(d).getByRole('button', { name: 'Close' }));
    expect(drawer()).toBeNull();
  });
});
