import { useState } from 'react';
import { Gem } from 'lucide-react';
import type { Breakdown } from '../../logic/breakdown';
import type { DmApi } from './dmApi';
import {
  ART_OBJECTS,
  GEMSTONES,
  HOARD_TREASURE,
  INDIVIDUAL_TREASURE,
  TRADE_BARS,
  TRADE_GOODS,
  TREASURE_THEMES,
  type TreasureTheme,
} from '../../data/treasure-tables';
import { XP_BY_CR } from '../../data/xp-tables';
import { activeCampaign, memberStats } from '../../logic/dm-campaign';
import { crToNumber } from '../../logic/dm-library';
import { newNote, saveNote } from '../../logic/dm-journal';
import { clockNow } from '../../logic/dm-mode';
import {
  formMoney,
  moneyText,
  rollHoard,
  rollIndividual,
  rollItems,
  specText,
  type EncounterCrGroup,
  type FormedMoney,
  type MoneyForm,
} from '../../logic/dm-treasure';
import { createDefaultRng } from '../../logic/random';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './dm.module.css';
import tr from './treasure.module.css';

interface TreasurePageProps {
  dm: DmApi;
  onNotify: (text: string) => void;
  onOpenJournal: () => void;
  /** CRs of the monsters overcome in an encounter, handed over by the Encounter page's "Roll treasure" button. */
  encounterCrs?: EncounterCrGroup[];
}

type Tab = 'individual' | 'hoard' | 'quest' | 'items' | 'reference';

const TABS: { id: Tab; label: string }[] = [
  { id: 'individual', label: 'Individual' },
  { id: 'hoard', label: 'Hoard' },
  { id: 'quest', label: 'Quest reward' },
  { id: 'items', label: 'Gems and art' },
  { id: 'reference', label: 'Reference' },
];

const CR_CHOICES = Object.keys(XP_BY_CR);

const n = (v: number) => v.toLocaleString();

interface Outcome {
  title: string;
  /** Total money, in GP. */
  totalGp: number;
  /** How the money was rolled, as shown (for example "90 PP"). */
  moneyLabel: string;
  moneyBreakdown: Breakdown;
  magic?: { count: number; breakdown: Breakdown; dice: string };
  formed: FormedMoney;
  form: MoneyForm;
}

const FORM_KEYS = ['coins', 'bars', ...GEMSTONES.map((g) => `gems:${g.value}`), ...ART_OBJECTS.map((a) => `art:${a.value}`)];

function formOf(key: string): MoneyForm {
  if (key === 'coins' || key === 'bars') return { kind: key };
  const [kind, value] = key.split(':');
  return { kind: kind === 'gems' ? 'gems' : 'art', value: Number(value) };
}

function formLabel(key: string): string {
  if (key === 'coins') return 'Coins';
  if (key === 'bars') return 'Trade bars';
  const [kind, value] = key.split(':');
  return `${kind === 'gems' ? 'Gemstones' : 'Art objects'} worth ${n(Number(value))} GP each`;
}

const THEME_FORM: Record<TreasureTheme, string> = {
  arcana: 'gems:500',
  armaments: 'bars',
  implements: 'coins',
  relics: 'art:250',
};

function outcomeText(o: Outcome): string {
  const lines = [o.title, `Monetary treasure: ${o.moneyLabel}${o.moneyLabel.endsWith('GP') ? '' : ` (${n(o.totalGp)} GP)`}`, ...moneyText(o.formed).map((l) => `  ${l}`)];
  if (o.magic) lines.push(`Magic items: ${o.magic.count} (${o.magic.dice})`);
  return lines.join('\n');
}

/** Roll treasure from the DMG tables, take it as coins, gems, art or bars, and save it to the journal. */
export function TreasurePage({ dm, onNotify, onOpenJournal, encounterCrs }: TreasurePageProps) {
  const campaign = activeCampaign(dm.data);
  const partyLevels = (campaign?.party ?? []).flatMap((m) => {
    const s = memberStats(m);
    return s ? [s.level] : [];
  });
  const defaultLevel = partyLevels.length > 0 ? Math.floor(partyLevels.reduce((a, b) => a + b, 0) / partyLevels.length) : 1;

  const [tab, setTab] = useState<Tab>('individual');
  const [cr, setCr] = useState(encounterCrs?.[0]?.cr ?? '1');
  const [creatures, setCreatures] = useState(String(encounterCrs?.[0]?.count ?? 1));
  const [average, setAverage] = useState(false);
  const [twice, setTwice] = useState(false);
  const [level, setLevel] = useState(String(defaultLevel));
  const [theme, setTheme] = useState<TreasureTheme | ''>('');
  const [formChoice, setFormChoice] = useState('coins');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const [itemKind, setItemKind] = useState<'gems' | 'art'>('gems');
  const [itemValue, setItemValue] = useState('100');
  const [itemCount, setItemCount] = useState('3');
  const [items, setItems] = useState<FormedMoney | null>(null);

  /** The text last saved to the journal, so the Open journal action shows only beside what was saved. */
  const [savedBody, setSavedBody] = useState<string | null>(null);

  const levelNum = Math.min(20, Math.max(1, Math.trunc(Number(level)) || 1));

  const finish = (partial: Omit<Outcome, 'formed' | 'form'>, key: string) => {
    const form = formOf(key);
    setOutcome({ ...partial, form, formed: formMoney(createDefaultRng(), partial.totalGp, form) });
  };

  const rollIndividualTreasure = () => {
    const count = Math.max(1, Math.trunc(Number(creatures)) || 1);
    const r = rollIndividual(createDefaultRng(), crToNumber(cr) ?? 0, count, average);
    finish(
      {
        title: `Individual treasure, ${r.row.label}${r.creatures > 1 ? `, ${r.creatures} creatures` : ''}`,
        totalGp: r.valueGp,
        moneyLabel: `${n(r.coins)} ${r.coin}`,
        moneyBreakdown: r.roll.breakdown,
      },
      formChoice,
    );
  };

  const rollHoardTreasure = (asQuest: boolean) => {
    const level0 = asQuest ? levelNum : (crToNumber(cr) ?? 0);
    const h = rollHoard(createDefaultRng(), level0, { repeats: twice && !asQuest ? 2 : 1, useAverage: average });
    const moneyBreakdown: Breakdown =
      h.repeats === 1
        ? h.money[0].breakdown
        : {
            total: h.totalGp,
            components: h.money.map((m, i) => ({ label: `Roll ${i + 1}: ${specText(h.row.dice)}`, value: m.total })),
            note: 'A creature fond of treasure: the table is rolled twice.',
          };
    const magicBreakdown: Breakdown =
      h.repeats === 1
        ? h.items[0].breakdown
        : { total: h.magicItems, components: h.items.map((m, i) => ({ label: `Roll ${i + 1}: ${h.row.magicItemsText}`, value: m.total })) };
    finish(
      {
        title: asQuest ? `Quest reward, level ${levelNum} (${h.row.label} row)` : `Treasure hoard, ${h.row.label}${h.repeats === 2 ? ', rolled twice' : ''}`,
        totalGp: h.totalGp,
        moneyLabel: `${n(h.totalGp)} GP`,
        moneyBreakdown,
        magic: { count: h.magicItems, breakdown: magicBreakdown, dice: h.row.magicItemsText },
      },
      formChoice,
    );
  };

  const reform = (key: string) => {
    setFormChoice(key);
    setOutcome((cur) => (cur ? { ...cur, form: formOf(key), formed: formMoney(createDefaultRng(), cur.totalGp, formOf(key)) } : cur));
  };

  const pickTheme = (value: TreasureTheme | '') => {
    setTheme(value);
    if (value) reform(THEME_FORM[value]);
  };

  const rollGemsOrArt = () => {
    setItems(rollItems(createDefaultRng(), itemKind, Number(itemValue), Number(itemCount)));
  };

  const saveToJournal = (title: string, body: string) => {
    if (!campaign) return;
    const now = clockNow();
    const base = newNote(campaign.journal, { id: crypto.randomUUID(), kind: 'note', now, title: `Treasure: ${title}` });
    dm.update((d) => saveNote(d, campaign.id, { ...base, body }, now));
    setSavedBody(body);
    onNotify(`Saved to the journal as "${base.title}".`);
  };

  const tiers = itemKind === 'gems' ? GEMSTONES : ART_OBJECTS;
  const themeInfo = TREASURE_THEMES.find((t) => t.id === theme);

  const moneyForm = (
    <label className={styles.field} style={{ flex: '0 1 280px' }}>
      <span className={styles.fieldLabel}>Take the money as</span>
      <select className={styles.input} value={formChoice} onChange={(e) => reform(e.target.value)}>
        {FORM_KEYS.map((k) => (
          <option key={k} value={k}>
            {formLabel(k)}
          </option>
        ))}
      </select>
    </label>
  );

  const averageBox = (
    <label className={styles.row}>
      <input type="checkbox" checked={average} onChange={(e) => setAverage(e.target.checked)} />
      <span>Use the average instead of rolling</span>
    </label>
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Treasure</h1>
          <div className={styles.muted}>Dungeon Master's Guide 2024, chapters 4 and 7</div>
        </div>
      </div>

      {encounterCrs && encounterCrs.length > 0 && (
        <Card>
          <div className={styles.stack} data-testid="encounter-crs">
            <strong>From the encounter</strong>
            <span className={styles.muted}>
              Creatures the party overcame. Individual treasure: one roll for a group of the same CR, times the number of
              creatures. Hoard: the table for the CR of the group's leader. You choose which to roll.
            </span>
            {encounterCrs.map((g) => (
              <div key={g.cr} className={styles.row}>
                <span>
                  CR {g.cr}: {g.count} {g.count === 1 ? 'creature' : 'creatures'}
                </span>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    setTab('individual');
                    setCr(g.cr);
                    setCreatures(String(g.count));
                    setOutcome(null);
                  }}
                >
                  Individual treasure for CR {g.cr}
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    setTab('hoard');
                    setCr(g.cr);
                    setOutcome(null);
                  }}
                >
                  Hoard for CR {g.cr}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionHeader icon={Gem} title="Roll treasure" />
        <div className={styles.tabs} role="tablist" aria-label="Kind of treasure">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? styles.tabActive : styles.tab}
              onClick={() => {
                setTab(t.id);
                setOutcome(null);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.stack} style={{ marginTop: 16 }}>
          {(tab === 'individual' || tab === 'hoard') && (
            <div className={styles.row}>
              <label className={styles.field} style={{ flex: '0 1 160px' }}>
                <span className={styles.fieldLabel}>{tab === 'hoard' ? "Monster's (or leader's) CR" : "Monster's CR"}</span>
                <select className={styles.input} value={cr} onChange={(e) => setCr(e.target.value)}>
                  {CR_CHOICES.map((c) => (
                    <option key={c} value={c}>
                      CR {c}
                    </option>
                  ))}
                </select>
              </label>
              {tab === 'individual' && (
                <label className={styles.field} style={{ flex: '0 1 160px' }}>
                  <span className={styles.fieldLabel}>Creatures in the group</span>
                  <input className={styles.input} type="number" min={1} max={1000} value={creatures} onChange={(e) => setCreatures(e.target.value)} />
                </label>
              )}
              {tab === 'hoard' && (
                <label className={styles.row}>
                  <input type="checkbox" checked={twice} onChange={(e) => setTwice(e.target.checked)} />
                  <span>Fond of treasure, such as a dragon (roll twice)</span>
                </label>
              )}
            </div>
          )}

          {tab === 'quest' && (
            <label className={styles.field} style={{ flex: '0 1 200px' }}>
              <span className={styles.fieldLabel}>Characters' level</span>
              <input className={styles.input} type="number" min={1} max={20} value={level} onChange={(e) => setLevel(e.target.value)} />
            </label>
          )}

          {(tab === 'individual' || tab === 'hoard' || tab === 'quest') && (
            <>
              <div className={styles.row}>
                {moneyForm}
                {(tab === 'hoard' || tab === 'quest') && (
                  <label className={styles.field} style={{ flex: '0 1 220px' }}>
                    <span className={styles.fieldLabel}>Treasure theme (optional)</span>
                    <select className={styles.input} value={theme} onChange={(e) => pickTheme(e.target.value as TreasureTheme | '')}>
                      <option value="">No theme</option>
                      {TREASURE_THEMES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {themeInfo && (tab === 'hoard' || tab === 'quest') && (
                <p className={styles.muted}>
                  {themeInfo.name}: {themeInfo.treasure}. Choosing a theme only suggests a form for the money.
                </p>
              )}
              <div className={styles.row}>
                {averageBox}
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => (tab === 'individual' ? rollIndividualTreasure() : rollHoardTreasure(tab === 'quest'))}
                >
                  {average ? 'Use the average' : 'Roll'}
                </button>
              </div>
            </>
          )}

          {tab === 'items' && (
            <>
              <div className={styles.row}>
                <label className={styles.field} style={{ flex: '0 1 160px' }}>
                  <span className={styles.fieldLabel}>Kind</span>
                  <select
                    className={styles.input}
                    value={itemKind}
                    onChange={(e) => {
                      const k = e.target.value as 'gems' | 'art';
                      setItemKind(k);
                      setItemValue(String((k === 'gems' ? GEMSTONES : ART_OBJECTS)[0].value));
                      setItems(null);
                    }}
                  >
                    <option value="gems">Gemstones</option>
                    <option value="art">Art objects</option>
                  </select>
                </label>
                <label className={styles.field} style={{ flex: '0 1 200px' }}>
                  <span className={styles.fieldLabel}>Worth each</span>
                  <select className={styles.input} value={itemValue} onChange={(e) => setItemValue(e.target.value)}>
                    {tiers.map((t) => (
                      <option key={t.value} value={t.value}>
                        {n(t.value)} GP
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field} style={{ flex: '0 1 120px' }}>
                  <span className={styles.fieldLabel}>How many</span>
                  <input className={styles.input} type="number" min={1} max={500} value={itemCount} onChange={(e) => setItemCount(e.target.value)} />
                </label>
                <button type="button" className={styles.btnPrimary} style={{ alignSelf: 'flex-end' }} onClick={rollGemsOrArt}>
                  Roll
                </button>
              </div>
              {items && (
                <div className={tr.result} aria-label="Rolled items">
                  <ul className={tr.lines}>
                    {moneyText({ ...items, leftoverGp: 0 }).filter((l) => !l.startsWith('0 GP')).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                  <div className={styles.row}>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={!campaign}
                      onClick={() =>
                        saveToJournal(
                          `${itemKind === 'gems' ? 'gemstones' : 'art objects'}`,
                          moneyText({ ...items, leftoverGp: 0 }).filter((l) => !l.startsWith('0 GP')).join('\n'),
                        )
                      }
                    >
                      Save to journal
                    </button>
                    {savedBody !== null && savedBody === moneyText({ ...items, leftoverGp: 0 }).filter((l) => !l.startsWith('0 GP')).join('\n') && (
                      <button type="button" className={styles.btn} onClick={onOpenJournal}>
                        Open journal
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'reference' && (
            <div className={styles.stack}>
              <h3 className={tr.heading}>Random Individual Treasure</h3>
              <table className={tr.table}>
                <thead>
                  <tr>
                    <th scope="col">CR</th>
                    <th scope="col">Treasure</th>
                  </tr>
                </thead>
                <tbody>
                  {INDIVIDUAL_TREASURE.map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      <td>
                        {specText(r.dice)} ({n(r.printedAverage)}) {r.coin}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className={tr.heading}>Random Treasure Hoard</h3>
              <table className={tr.table}>
                <thead>
                  <tr>
                    <th scope="col">CR</th>
                    <th scope="col">Monetary treasure</th>
                    <th scope="col">Magic items</th>
                  </tr>
                </thead>
                <tbody>
                  {HOARD_TREASURE.map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      <td>
                        {specText(r.dice)} ({n(r.printedAverage)}) GP
                      </td>
                      <td>{r.magicItemsText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className={tr.heading}>Treasure themes</h3>
              <table className={tr.table}>
                <tbody>
                  {TREASURE_THEMES.map((t) => (
                    <tr key={t.id}>
                      <th scope="row">{t.name}</th>
                      <td>{t.treasure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className={tr.heading}>Trade bars</h3>
              <table className={tr.table}>
                <tbody>
                  {TRADE_BARS.map((b) => (
                    <tr key={b.name}>
                      <th scope="row">{b.name}</th>
                      <td>{b.valueGp} GP</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3 className={tr.heading}>Trade goods</h3>
              <table className={tr.table}>
                <tbody>
                  {TRADE_GOODS.map((g) => (
                    <tr key={g.goods}>
                      <th scope="row">{g.cost}</th>
                      <td>{g.goods}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.muted}>
                A Platinum Piece is worth 10 GP, and fifty coins of any kind weigh a pound. The book says to roll about one hoard
                per game session. Hoard money for CR 11-16 and the CR 5-10 magic item count are read from a scan: check them
                against your book.
              </p>
            </div>
          )}
        </div>
      </Card>

      {outcome && tab !== 'items' && tab !== 'reference' && (
        <Card>
          <div className={tr.result} aria-label="Treasure result">
            <h2 className={tr.heading}>{outcome.title}</h2>
            <div className={styles.summaryGrid}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Monetary treasure</span>
                <span className={styles.statValue} data-testid="money">
                  <CalculatedValue label="Monetary treasure" breakdown={outcome.moneyBreakdown}>
                    {outcome.moneyLabel}
                  </CalculatedValue>
                </span>
                {!outcome.moneyLabel.endsWith('GP') && <span className={styles.muted}>{n(outcome.totalGp)} GP in all</span>}
              </div>
              {outcome.magic && (
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Magic items</span>
                  <span className={styles.statValue} data-testid="magic">
                    <CalculatedValue label="Magic items" breakdown={outcome.magic.breakdown}>
                      {outcome.magic.count}
                    </CalculatedValue>
                  </span>
                  <span className={styles.muted}>{outcome.magic.dice}</span>
                </div>
              )}
            </div>
            <ul className={tr.lines} aria-label="Form of the money">
              {moneyText(outcome.formed).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            {outcome.magic && outcome.magic.count > 0 && (
              <p className={styles.muted}>
                Choose the magic items yourself (the rarity and kind that suit your party), or use the guidance in "Awarding Magic
                Items" in the Dungeon Master's Guide. This app does not roll magic items yet.
              </p>
            )}
            <div className={styles.row}>
              <button type="button" className={styles.btn} disabled={!campaign} onClick={() => saveToJournal(outcome.title, outcomeText(outcome))}>
                Save to journal
              </button>
              {savedBody !== null && savedBody === outcomeText(outcome) && (
                <button type="button" className={styles.btn} onClick={onOpenJournal}>
                  Open journal
                </button>
              )}
              {!campaign && <span className={styles.muted}>Create a campaign to save to its journal.</span>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
