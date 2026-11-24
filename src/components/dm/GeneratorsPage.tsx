import { useState } from 'react';
import { Dices } from 'lucide-react';
import { ALIGNMENTS, type Alignment } from '../../types/character';
import { CLASS_LIST, type ClassId } from '../../data/classes';
import { getSpecies, type SpeciesId } from '../../data/species';
import { NPC_TEMPLATE_LIST } from '../../data/npc-templates';
import { SHOP_TYPES } from '../../data/dm-flavor-tables';
import type { NameGender } from '../../data/name-tables';
import type { DmApi, OpenJournal } from './dmApi';
import { activeCampaign } from '../../logic/dm-campaign';
import {
  NPC_PARTS,
  dmgShopName,
  firstName,
  generateDmgTavernName,
  generateNpc,
  generateShopName,
  generateTavernName,
  npcHeadline,
  npcJournalBody,
  npcSpecies,
  rollDmgShopType,
  rerollNpcPart,
  saveNpcToJournal,
  savePlaceWithOwner,
  shopTypeById,
  type GeneratedNpc,
  type NpcPart,
} from '../../logic/dm-generators';
import { clockNow } from '../../logic/dm-mode';
import { createDefaultRng } from '../../logic/random';
import { Card } from '../shared/Card';
import { DmgGenerator, type DmgResult } from './DmgGenerator';
import type { DmgGeneratorId } from '../../logic/dmg-generators';
import { SectionHeader } from '../shared/SectionHeader';
import styles from './dm.module.css';
import gen from './generators.module.css';

interface GeneratorsPageProps {
  dm: DmApi;
  onNotify: (text: string) => void;
  onOpenCampaign: () => void;
  onOpenJournal: OpenJournal;
}

/** A generated NPC, and the journal note it was saved as (cleared when the NPC changes). */
interface NpcResult {
  npc: GeneratedNpc;
  savedId?: string;
}

interface PlaceResult {
  place: { name: string; owner: GeneratedNpc; dmgType?: string };
  /** The place's journal note (the owner's note is linked from it). */
  savedId?: string;
  /** The options in force when it was rolled, restored into the selects after a tab switch. */
  source: 'original' | 'dmg';
  trade: string;
}

type ResultProps<T> = { result: T | null; onResult: (r: T | null) => void };

type Tab = 'npc' | 'tavern' | 'shop' | DmgGeneratorId;

const TABS: { id: Tab; label: string }[] = [
  { id: 'npc', label: 'Quick NPC' },
  { id: 'tavern', label: 'Tavern' },
  { id: 'shop', label: 'Shop' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'adventure', label: 'Adventure seed' },
  { id: 'dungeon', label: 'Dungeon' },
  { id: 'npcDetails', label: 'NPC details' },
  { id: 'weather', label: 'Weather' },
  { id: 'monster', label: 'Monster behavior' },
];

const GENDER_OPTIONS: { value: NameGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'neutral', label: 'Nonbinary' },
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** The NPC as read on screen: one block per part, each with its own "Roll again". */
function NpcCard({ npc, onReroll }: { npc: GeneratedNpc; onReroll: (part: NpcPart) => void }) {
  const a = npc.appearance;
  const row = (part: NpcPart, content: React.ReactNode) => {
    const label = NPC_PARTS.find((p) => p.part === part)?.label ?? part;
    return (
      <div className={gen.part}>
        <div className={gen.partBody}>{content}</div>
        <button type="button" className={styles.btn} onClick={() => onReroll(part)} aria-label={`Roll the ${label} again`}>
          <Dices size={16} aria-hidden="true" /> Again
        </button>
      </div>
    );
  };
  return (
    <div className={gen.npc} aria-label="Generated NPC">
      <h3 className={gen.headline}>{npcHeadline(npc)}</h3>
      {row(
        'name',
        <span className={styles.muted}>
          {npc.speciesName}
          {npc.lineage ? ` (${npc.lineage})` : ''}, {npc.gender === 'neutral' ? 'nonbinary' : npc.gender}. {npc.alignment}.
        </span>,
      )}
      {row(
        'look',
        <span>
          Age {npc.age}. Height {a.height}, weight {a.weight}. {a.eyes} eyes, {a.hair.toLowerCase()} hair, {a.skin.toLowerCase()} skin.
        </span>,
      )}
      {row('description', <span>{npc.description}</span>)}
      {row('ideal', <span><strong>Ideal.</strong> {npc.ideal}</span>)}
      {row('flaw', <span><strong>Flaw.</strong> {npc.flaw}</span>)}
      {row(
        'goals',
        <span>
          <strong>Short-term goal.</strong> {npc.shortTermGoal}
          <br />
          <strong>Long-term goal.</strong> {npc.longTermGoal}
        </span>,
      )}
    </div>
  );
}

/** Quick NPC: pick what you know, leave the rest random, roll parts again, save to the journal. */
function NpcGenerator({ dm, onNotify, onOpenJournal, result: current, onResult }: Omit<GeneratorsPageProps, 'onOpenCampaign'> & ResultProps<NpcResult>) {
  const campaign = activeCampaign(dm.data);
  const [species, setSpecies] = useState<SpeciesId | ''>('');
  const [gender, setGender] = useState<NameGender | ''>('');
  const [alignment, setAlignment] = useState<Alignment | ''>('');
  const [classId, setClassId] = useState<ClassId | ''>('');
  const [role, setRole] = useState('');
  const npc = current?.npc ?? null;
  const [templateId, setTemplateId] = useState('');

  const roll = () =>
    onResult({
      npc: generateNpc(createDefaultRng(), {
        species: species || undefined,
        gender: gender || undefined,
        alignment: alignment || undefined,
        classId: classId || undefined,
        role,
      }),
    });

  const save = () => {
    if (!npc || !campaign) return;
    const now = clockNow();
    const template = NPC_TEMPLATE_LIST.find((t) => t.id === templateId);
    const statBlock = template ? { name: template.name, source: `Monster Manual 2024, p.${template.page}` } : undefined;
    const noteId = crypto.randomUUID();
    const result = saveNpcToJournal(dm.data, campaign.id, npc, { npc: noteId }, now, statBlock);
    dm.replace(result.data);
    onResult({ npc, savedId: noteId });
    onNotify(`${result.title} saved to the journal of ${campaign.name}.`);
  };

  return (
    <div className={styles.stack}>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Species</span>
          <select className={styles.input} value={species} onChange={(e) => setSpecies(e.target.value as SpeciesId | '')}>
            <option value="">Any</option>
            {npcSpecies().map((id) => (
              <option key={id} value={id}>
                {getSpecies(id)?.name ?? id}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Gender</span>
          <select className={styles.input} value={gender} onChange={(e) => setGender(e.target.value as NameGender | '')}>
            <option value="">Any</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Alignment</span>
          <select className={styles.input} value={alignment} onChange={(e) => setAlignment(e.target.value as Alignment | '')}>
            <option value="">Any</option>
            {ALIGNMENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Class flavor (how they carry themselves)</span>
          <select className={styles.input} value={classId} onChange={(e) => setClassId(e.target.value as ClassId | '')}>
            <option value="">None</option>
            {CLASS_LIST.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Role, in your words (optional)</span>
          <input
            className={styles.input}
            value={role}
            maxLength={60}
            onChange={(e) => setRole(e.target.value)}
            placeholder="For example: blacksmith"
          />
        </label>
      </div>
      <div className={styles.row}>
        <button type="button" className={styles.btnPrimary} onClick={roll}>
          Generate NPC
        </button>
        {npc && (
          <>
            <button type="button" className={styles.btn} onClick={save} disabled={!campaign || !!current?.savedId}>
              {current?.savedId ? 'Saved' : 'Save to journal'}
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={async () => onNotify((await copyText(`${npcHeadline(npc)}\n${npcJournalBody(npc)}`)) ? 'Copied.' : 'Could not copy. Select the text instead.')}
            >
              Copy text
            </button>
            {campaign && (
              <button type="button" className={styles.btn} onClick={() => onOpenJournal(current?.savedId)}>
                Open journal
              </button>
            )}
          </>
        )}
        {npc && !campaign && <span className={styles.muted}>Create a campaign to save NPCs to its journal.</span>}
      </div>
      {npc && (
        <div className={styles.stack}>
          <label className={styles.field} style={{ maxWidth: 420 }}>
            <span className={styles.fieldLabel}>Use as a stat block (optional)</span>
            <select className={styles.input} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">None</option>
              {NPC_TEMPLATE_LIST.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (CR {t.stats.cr ?? '?'})
                </option>
              ))}
            </select>
          </label>
          <span className={styles.muted}>
            Picks an existing Monster Manual NPC stat block. The journal entry names it, and the same block is in the Library
            for combat. The generated NPC gets no stats of its own.
          </span>
        </div>
      )}
      {npc && <NpcCard npc={npc} onReroll={(part) => onResult({ npc: rerollNpcPart(createDefaultRng(), npc, part) })} />}
      <p className={styles.muted}>
        Names, looks and the description come from the same generators as the character wizard. Class flavor only changes how
        the description reads. It gives the NPC no class features, and the species is not a stat block.
      </p>
    </div>
  );
}

/** A tavern or a shop: a name and an owner, saved to the journal as two linked entries. */
function PlaceGenerator({ kind, dm, onNotify, onOpenJournal, result: current, onResult }: { kind: 'tavern' | 'shop' } & Omit<GeneratorsPageProps, 'onOpenCampaign'> & ResultProps<PlaceResult>) {
  const campaign = activeCampaign(dm.data);
  const [trade, setTrade] = useState(current?.trade ?? SHOP_TYPES[0].id);
  // 'original' uses this app's word lists; 'dmg' uses the DMG 2024 p.94 tables.
  const [source, setSource] = useState<'original' | 'dmg'>(current?.source ?? 'original');
  const place = current?.place ?? null;
  const dmg = source === 'dmg';
  const withOpts = (r: Omit<PlaceResult, 'source' | 'trade'>): PlaceResult => ({ ...r, source, trade });

  const rollOwner = (role: string) => generateNpc(createDefaultRng(), { role: role.toLowerCase() });
  const ownerRole = (tradeLabel: string) => (kind === 'tavern' ? 'innkeeper' : tradeLabel);

  /** Names a place for an owner. A DMG shop name is built from the rolled DMG shop type. */
  const build = (owner: GeneratedNpc, dmgType?: string) => {
    const rng = createDefaultRng();
    if (kind === 'tavern') return { owner, name: dmg ? generateDmgTavernName(rng) : generateTavernName(rng) };
    if (dmg) return { owner, dmgType, name: dmgShopName(dmgType ?? '', firstName(owner.name)) };
    return { owner, name: generateShopName(rng, trade, firstName(owner.name)) };
  };

  const roll = () => {
    const dmgType = kind === 'shop' && dmg ? rollDmgShopType(createDefaultRng()) : undefined;
    onResult(withOpts({ place: build(rollOwner(ownerRole(dmgType ?? shopTypeById(trade).label)), dmgType) }));
  };

  const newName = () => {
    if (!place) return;
    const dmgType = kind === 'shop' && dmg ? rollDmgShopType(createDefaultRng()) : undefined;
    onResult(withOpts({ place: build(place.owner, dmgType) }));
  };

  const newOwner = () => {
    const owner = rollOwner(ownerRole(place?.dmgType ?? shopTypeById(trade).label));
    if (!place) return;
    onResult(withOpts({ place: kind === 'tavern' ? { ...place, owner } : build(owner, place.dmgType) }));
  };

  const save = () => {
    if (!place || !campaign) return;
    const now = clockNow();
    const placeId = crypto.randomUUID();
    const result = savePlaceWithOwner(
      dm.data,
      campaign.id,
      { kind, name: place.name, trade: kind === 'shop' ? (place.dmgType ?? shopTypeById(trade).label) : undefined },
      place.owner,
      { place: placeId, owner: crypto.randomUUID() },
      now,
    );
    dm.replace(result.data);
    onResult({ place, savedId: placeId, source: current?.source ?? source, trade: current?.trade ?? trade });
    onNotify(`${result.placeTitle} and its owner ${result.ownerTitle} saved to the journal.`);
  };

  return (
    <div className={styles.stack}>
      <label className={styles.field} style={{ flex: '0 1 260px' }}>
        <span className={styles.fieldLabel}>Name source</span>
        <select className={styles.input} value={source} onChange={(e) => setSource(e.target.value as 'original' | 'dmg')}>
          <option value="original">Original word lists</option>
          <option value="dmg">{kind === 'tavern' ? 'DMG Tavern Names table (p.94)' : 'DMG Random Shops table (p.94)'}</option>
        </select>
      </label>
      {kind === 'shop' && !dmg && (
        <label className={styles.field} style={{ flex: '0 1 260px' }}>
          <span className={styles.fieldLabel}>Kind of shop</span>
          <select className={styles.input} value={trade} onChange={(e) => setTrade(e.target.value)}>
            {SHOP_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className={styles.row}>
        <button type="button" className={styles.btnPrimary} onClick={roll}>
          {kind === 'tavern' ? 'Generate tavern' : 'Generate shop'}
        </button>
        {place && (
          <>
            <button type="button" className={styles.btn} onClick={newName}>
              New name
            </button>
            <button type="button" className={styles.btn} onClick={newOwner}>
              New owner
            </button>
            <button type="button" className={styles.btn} onClick={save} disabled={!campaign || !!current?.savedId}>
              {current?.savedId ? 'Saved' : 'Save to journal'}
            </button>
            {campaign && (
              <button type="button" className={styles.btn} onClick={() => onOpenJournal(current?.savedId)}>
                Open journal
              </button>
            )}
          </>
        )}
        {place && !campaign && <span className={styles.muted}>Create a campaign to save to its journal.</span>}
      </div>
      {place && (
        <div className={gen.npc} aria-label={kind === 'tavern' ? 'Generated tavern' : 'Generated shop'}>
          <h3 className={gen.headline} data-testid="place-name">
            {place.name}
          </h3>
          <span className={styles.muted}>
            {kind === 'tavern' ? 'A tavern' : `A ${(place.dmgType ?? shopTypeById(trade).label).toLowerCase()}`}, owned by {npcHeadline(place.owner)}.
          </span>
          <NpcCard
            npc={place.owner}
            onReroll={(part) => onResult(withOpts({ place: { ...place, owner: rerollNpcPart(createDefaultRng(), place.owner, part) } }))}
          />
        </div>
      )}
      <p className={styles.muted}>
        The names are made from word lists written for this app, not taken from a rulebook. Saving adds the owner and the{' '}
        {kind === 'tavern' ? 'tavern' : 'shop'} to the journal as two entries that link to each other.
      </p>
    </div>
  );
}

/** Tools for improvising: an NPC, a tavern, a shop, and the Dungeon Master's Guide 2024 tables. */
export function GeneratorsPage({ dm, onNotify, onOpenCampaign, onOpenJournal }: GeneratorsPageProps) {
  const [tab, setTab] = useState<Tab>('npc');
  // Each generator's last result lives here, so it survives switching tabs (and its saved-note id travels with it).
  const [npcResult, setNpcResult] = useState<NpcResult | null>(null);
  const [placeResults, setPlaceResults] = useState<Partial<Record<'tavern' | 'shop', PlaceResult>>>({});
  const [dmgResults, setDmgResults] = useState<Partial<Record<DmgGeneratorId, DmgResult>>>({});
  const campaign = activeCampaign(dm.data);
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Generators</h1>
          <div className={styles.muted}>
            {campaign ? campaign.name : 'No campaign yet'}
            {!campaign && (
              <>
                {' '}
                <button type="button" className={styles.btn} onClick={onOpenCampaign}>
                  Go to Campaign
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <Card>
        <SectionHeader icon={Dices} title="Improvise" />
        <div className={styles.tabs} role="tablist" aria-label="Generator">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? styles.tabActive : styles.tab}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          {tab === 'npc' && <NpcGenerator dm={dm} onNotify={onNotify} onOpenJournal={onOpenJournal} result={npcResult} onResult={setNpcResult} />}
          {tab === 'tavern' && (
            <PlaceGenerator key="tavern" kind="tavern" dm={dm} onNotify={onNotify} onOpenJournal={onOpenJournal} result={placeResults.tavern ?? null} onResult={(r) => setPlaceResults((cur) => ({ ...cur, tavern: r ?? undefined }))} />
          )}
          {tab === 'shop' && (
            <PlaceGenerator key="shop" kind="shop" dm={dm} onNotify={onNotify} onOpenJournal={onOpenJournal} result={placeResults.shop ?? null} onResult={(r) => setPlaceResults((cur) => ({ ...cur, shop: r ?? undefined }))} />
          )}
          {tab !== 'npc' && tab !== 'tavern' && tab !== 'shop' && (
            <DmgGenerator
              key={tab}
              id={tab}
              dm={dm}
              onNotify={onNotify}
              onOpenJournal={onOpenJournal}
              result={dmgResults[tab] ?? null}
              onResult={(r) => setDmgResults((cur) => ({ ...cur, [tab]: r ?? undefined }))}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
