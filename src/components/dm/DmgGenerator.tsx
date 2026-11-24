import { useState } from 'react';
import { Dices } from 'lucide-react';
import type { DmApi, OpenJournal } from './dmApi';
import { activeCampaign } from '../../logic/dm-campaign';
import {
  ADVENTURE_TIERS,
  DMG_GENERATOR_TITLES,
  HOOK_KINDS,
  dmgResultLines,
  rollDmgGenerator,
  rollDmgPart,
  saveDmgResultToJournal,
  settlementSize,
  type AdventureTier,
  type DmgGeneratorId,
  type DmgOptions,
  type HookKind,
  type RolledPart,
} from '../../logic/dmg-generators';
import { SETTLEMENT_SIZES } from '../../data/dmg-settlement';
import { clockNow } from '../../logic/dm-mode';
import { createDefaultRng } from '../../logic/random';
import { CalculatedValue } from '../shared/CalculatedValue';
import styles from './dm.module.css';
import gen from './generators.module.css';

/** One generator's last result. Held by the Generators page so it survives switching tabs. */
export interface DmgResult {
  parts: RolledPart[];
  /** Options that were in force when the result was rolled, so the card never disagrees with the table it came from. */
  rolledWith: DmgOptions;
  /** The journal note this exact result was saved as. Cleared when the result changes. */
  savedId?: string;
}

interface DmgGeneratorProps {
  id: DmgGeneratorId;
  dm: DmApi;
  onNotify: (text: string) => void;
  onOpenJournal: OpenJournal;
  result: DmgResult | null;
  onResult: (result: DmgResult | null) => void;
}

const BUTTON_LABELS: Record<DmgGeneratorId, string> = {
  settlement: 'Generate settlement',
  adventure: 'Generate adventure seed',
  dungeon: 'Generate dungeon',
  npcDetails: 'Generate NPC details',
  weather: 'Roll weather',
  monster: 'Generate monster behavior',
};

const NOTES: Record<DmgGeneratorId, string> = {
  settlement:
    'Rolls the Defining Traits, Claims to Fame, Current Calamities and Local Leaders tables (Dungeon Master\u2019s Guide 2024, pp.93-94). The size is your choice and is not rolled.',
  adventure:
    'Rolls an Adventure Situation for the party\u2019s tier (pp.107-108), a hook (p.111) and an Adventure Climax (p.120).',
  dungeon: 'Rolls a Dungeon Quirk (p.65) and a State of Ruin (p.67) from the Dungeon Master\u2019s Guide 2024.',
  npcDetails: 'Rolls an NPC Appearance feature (p.86) and an NPC Secret (p.88) from the Dungeon Master\u2019s Guide 2024. Use it alongside Quick NPC.',
  weather:
    'Rolls 1d20 three times, for temperature, wind and precipitation (Dungeon Master\u2019s Guide 2024, p.38). Colder or hotter results add a 1d4 x 10 degree shift.',
  monster: 'Rolls Monster Personality and Monster Relationships (Dungeon Master\u2019s Guide 2024, p.117) for a group of monsters.',
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A generator that rolls transcribed DMG 2024 tables: options, a Generate button, a result card with per-line "Again". */
export function DmgGenerator({ id, dm, onNotify, onOpenJournal, result, onResult }: DmgGeneratorProps) {
  const campaign = activeCampaign(dm.data);
  const [size, setSize] = useState<DmgOptions['size']>('');
  const [tier, setTier] = useState<AdventureTier>('1-4');
  const [hook, setHook] = useState<HookKind>('patron');
  const parts = result?.parts ?? null;
  const rolledWith = result?.rolledWith ?? {};
  const title = DMG_GENERATOR_TITLES[id];

  const roll = () => {
    const opts: DmgOptions = { size, tier, hook };
    onResult({ parts: rollDmgGenerator(createDefaultRng(), id, opts), rolledWith: opts });
  };
  const again = (key: string) => {
    if (!result) return;
    onResult({ parts: result.parts.map((p) => (p.key === key ? rollDmgPart(createDefaultRng(), id, key, rolledWith) : p)), rolledWith });
  };
  const save = () => {
    if (!parts || !campaign) return;
    const noteId = crypto.randomUUID();
    const saved = saveDmgResultToJournal(dm.data, campaign.id, id, parts, rolledWith, noteId, clockNow());
    dm.replace(saved.data);
    onResult({ parts, rolledWith, savedId: noteId });
    onNotify(`${saved.title} saved to the journal of ${campaign.name}.`);
  };
  const sizeInfo = id === 'settlement' ? settlementSize(rolledWith.size ?? '') : undefined;

  return (
    <div className={styles.stack}>
      {id === 'settlement' && (
        <label className={styles.field} style={{ flex: '0 1 260px' }}>
          <span className={styles.fieldLabel}>Size (optional)</span>
          <select className={styles.input} value={size} onChange={(e) => setSize(e.target.value as DmgOptions['size'])}>
            <option value="">Not set</option>
            {SETTLEMENT_SIZES.map((s) => (
              <option key={s.size} value={s.size}>
                {s.size}
              </option>
            ))}
          </select>
        </label>
      )}
      {id === 'adventure' && (
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Party level</span>
            <select className={styles.input} value={tier} onChange={(e) => setTier(e.target.value as AdventureTier)}>
              {ADVENTURE_TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Kind of hook</span>
            <select className={styles.input} value={hook} onChange={(e) => setHook(e.target.value as HookKind)}>
              {HOOK_KINDS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className={styles.row}>
        <button type="button" className={styles.btnPrimary} onClick={roll}>
          {BUTTON_LABELS[id]}
        </button>
        {parts && (
          <>
            <button type="button" className={styles.btn} onClick={save} disabled={!campaign || !!result?.savedId}>
              {result?.savedId ? 'Saved' : 'Save to journal'}
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={async () =>
                onNotify((await copyText(`${title}\n${dmgResultLines(id, parts, rolledWith).join('\n')}`)) ? 'Copied.' : 'Could not copy. Select the text instead.')
              }
            >
              Copy text
            </button>
            {campaign && (
              <button type="button" className={styles.btn} onClick={() => onOpenJournal(result?.savedId)}>
                Open journal
              </button>
            )}
          </>
        )}
        {parts && !campaign && <span className={styles.muted}>Create a campaign to save results to its journal.</span>}
      </div>
      {parts && (
        <div className={gen.npc} aria-label={`Generated ${title.toLowerCase()}`}>
          <h3 className={gen.headline}>{title}</h3>
          {sizeInfo && (
            <div className={gen.part}>
              <div className={gen.partBody}>
                <strong>Size.</strong> {sizeInfo.size}, population {sizeInfo.population}. The most expensive item for sale is
                about {sizeInfo.maxGp.toLocaleString('en-US')} GP.
                <div className={styles.muted}>DMG 2024 p.93, Settlements by Size</div>
              </div>
            </div>
          )}
          {parts.map((p) => (
            <div className={gen.part} key={p.key}>
              <div className={gen.partBody}>
                <strong>{p.label}.</strong>{' '}
                {p.shift ? (
                  <>
                    <CalculatedValue label={`${p.label} shift`} breakdown={p.shift.breakdown}>
                      {p.shift.breakdown.total} degrees Fahrenheit
                    </CalculatedValue>{' '}
                    {p.shift.direction}
                  </>
                ) : (
                  p.text
                )}
                <div className={styles.muted}>
                  Rolled {p.roll}. {p.source}
                </div>
              </div>
              <button type="button" className={styles.btn} onClick={() => again(p.key)} aria-label={`Roll the ${p.label.toLowerCase()} again`}>
                <Dices size={16} aria-hidden="true" /> Again
              </button>
            </div>
          ))}
        </div>
      )}
      <p className={styles.muted}>{NOTES[id]}</p>
    </div>
  );
}
