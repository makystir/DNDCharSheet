import { useMemo, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { Ability } from '../../types/character';
import { getClass } from '../../data/classes';
import { TRINKETS, rollTrinket } from '../../data/trinkets';
import { createDefaultRng } from '../../logic/random';
import { BACKGROUND_OPTION_B_GOLD } from '../../data/backgrounds';
import type { BackgroundData } from '../../data/backgrounds';
import type { Breakdown } from '../../logic/breakdown';
import type { TooltipContent } from '../../logic/tooltip-content';
import {
  cartCopper,
  classEquipmentOptions,
  entryChoiceOptions,
  formatCopper,
  gpToCopper,
  purchaseWarnings,
  shopCatalog,
} from '../../logic/starting-equipment';
import type { Cart, ClassOptionId, ShopEntry, ShopSection } from '../../logic/starting-equipment';
import { CalculatedValue } from '../shared/CalculatedValue';
import { ContentTooltip } from '../shared/ContentTooltip';
import { SegmentedControl } from '../shared/SegmentedControl';
import styles from './CreationWizard.module.css';

export type BackgroundEquipmentChoice = 'A' | 'B';

export interface EquipmentStepProps {
  classId: string;
  background: BackgroundData | undefined;
  classOption: ClassOptionId;
  onClassOption: (id: ClassOptionId) => void;
  /** Player picks for "choose a type" entries, keyed by the entry as printed. */
  classPicks: Record<string, string>;
  onClassPick: (entry: string, name: string) => void;
  backgroundChoice: BackgroundEquipmentChoice;
  onBackgroundChoice: (choice: BackgroundEquipmentChoice) => void;
  cart: Cart;
  /** Add (+1) or remove (-1) one purchase of a shop entry. */
  onCartChange: (key: string, delta: number) => void;
  /** The trinket's d100 result (1-100), or null for none. */
  trinketRoll: number | null;
  onTrinketRoll: (roll: number | null) => void;
  /** Current ability scores, used for the Strength / Heavy warnings. */
  scores: Partial<Record<Ability, number>>;
}

const SECTION_LABEL: Record<ShopSection, string> = {
  weapon: 'Weapons',
  armor: 'Armor',
  gear: 'Gear',
};

function gpText(copper: number): string {
  return formatCopper(copper);
}

function warningContent(name: string, warnings: string[]): TooltipContent {
  return {
    title: `${name}: heads up`,
    sections: warnings.map((text) => ({ label: 'Heads up', text })),
  };
}

/**
 * Wizard "Equipment" step. PHB 2024 "Choose Starting Equipment": the class and
 * the background each give starting equipment, and any coins gained here can be
 * spent right away on gear from chapter 6. Pick a package or take the gold, then
 * buy gear from the book's price lists. Purchases the class probably cannot use
 * well are flagged, never blocked.
 */
export function EquipmentStep({
  classId,
  background,
  classOption,
  onClassOption,
  classPicks,
  onClassPick,
  backgroundChoice,
  onBackgroundChoice,
  cart,
  onCartChange,
  trinketRoll,
  onTrinketRoll,
  scores,
}: EquipmentStepProps) {
  const cls = getClass(classId);
  const options = useMemo(() => classEquipmentOptions(classId), [classId]);
  const option = options.find((o) => o.id === classOption) ?? options[0];
  const [section, setSection] = useState<ShopSection>('weapon');
  const [query, setQuery] = useState('');

  if (!cls || !option) return <p className={styles.hint}>Choose a class first.</p>;
  if (!background) return <p className={styles.hint}>Select a background first.</p>;

  const backgroundGold =
    backgroundChoice === 'A' ? background.equipment.packageGold : BACKGROUND_OPTION_B_GOLD;
  const budgetCopper = gpToCopper(option.goldGp) + gpToCopper(backgroundGold);
  const spentCopper = cartCopper(cart);
  const remainingCopper = budgetCopper - spentCopper;

  const breakdown: Breakdown = {
    total: remainingCopper / 100,
    components: [
      { label: `${cls.name} equipment gold`, value: option.goldGp },
      { label: `${background.name} equipment gold`, value: backgroundGold },
      { label: 'Spent on purchases', value: -spentCopper / 100 },
    ],
  };

  const catalog = shopCatalog();
  const byKey = new Map(catalog.map((e) => [e.key, e]));
  const needle = query.trim().toLowerCase();
  const visible = catalog.filter(
    (e) => e.section === section && (needle === '' || e.name.toLowerCase().includes(needle)),
  );

  const warningsFor = (entry: ShopEntry) => purchaseWarnings(classId, entry, scores);
  const cartLines = Object.entries(cart)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ entry: byKey.get(key), count }))
    .filter((l): l is { entry: ShopEntry; count: number } => l.entry !== undefined);
  const flagged = cartLines
    .map((l) => ({ ...l, warnings: warningsFor(l.entry) }))
    .filter((l) => l.warnings.length > 0);

  return (
    <>
      <section className={styles.equipBlock} aria-label="Class equipment">
        <h3 className={styles.guidanceTitle}>{cls.name} equipment</h3>
        <SegmentedControl
          ariaLabel="Class equipment choice"
          options={options.map((o) => ({
            value: o.id,
            label: o.entries.length === 0 ? `${o.goldGp} GP` : `Package ${o.id}`,
          }))}
          value={option.id}
          onChange={onClassOption}
        />
        {option.entries.length === 0 ? (
          <p className={styles.hint}>
            Take {option.goldGp} GP instead of a package, and buy your own gear below.
          </p>
        ) : (
          <ul className={styles.pkgList}>
            {option.entries.map((entry) => {
              const choices = entryChoiceOptions(entry);
              return (
                <li key={entry}>
                  {choices ? (
                    <label>
                      {entry}:{' '}
                      <select
                        className={styles.selectSmall}
                        aria-label={`Choose ${entry}`}
                        value={classPicks[entry] ?? ''}
                        onChange={(e) => onClassPick(entry, e.target.value)}
                      >
                        <option value="">Choose one…</option>
                        {choices.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    entry
                  )}
                </li>
              );
            })}
            <li>{option.goldGp} GP</li>
          </ul>
        )}
      </section>

      <section className={styles.equipBlock} aria-label="Background equipment">
        <h3 className={styles.guidanceTitle}>{background.name} equipment</h3>
        <SegmentedControl
          ariaLabel="Background equipment choice"
          options={[
            { value: 'A', label: 'Equipment Package' },
            { value: 'B', label: `${BACKGROUND_OPTION_B_GOLD} GP` },
          ]}
          value={backgroundChoice}
          onChange={onBackgroundChoice}
        />
        {backgroundChoice === 'A' ? (
          <ul className={styles.pkgList}>
            {background.equipment.packageItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
            <li>{background.equipment.packageGold} GP</li>
          </ul>
        ) : (
          <p className={styles.hint}>Take {BACKGROUND_OPTION_B_GOLD} GP instead of the package.</p>
        )}
      </section>

      <section className={styles.equipBlock} aria-label="Trinket">
        <h3 className={styles.guidanceTitle}>Trinket (free)</h3>
        <p className={styles.hint}>
          You can roll once on the Trinkets table to gain a Tiny trinket, a simple item lightly
          touched by mystery (PHB 2024, &quot;Trinkets&quot;). It costs nothing. Or choose one
          if your DM allows.
        </p>
        <div className={styles.trinketRow}>
          <button
            type="button"
            className={styles.rollBtn}
            disabled={trinketRoll !== null}
            onClick={() => onTrinketRoll(rollTrinket(createDefaultRng()).roll)}
          >
            Roll for a trinket (d100)
          </button>
          <select
            className={styles.select}
            aria-label="Choose a trinket"
            value={trinketRoll ?? ''}
            onChange={(e) => onTrinketRoll(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">No trinket</option>
            {TRINKETS.map((text, i) => (
              <option key={text} value={i + 1}>
                {i === 99 ? '00' : String(i + 1).padStart(2, '0')}: {text}
              </option>
            ))}
          </select>
        </div>
        {trinketRoll !== null && (
          <p className={styles.budget} role="status">
            Your trinket ({trinketRoll === 100 ? '00' : String(trinketRoll).padStart(2, '0')}):{' '}
            {TRINKETS[trinketRoll - 1]}
          </p>
        )}
      </section>

      <section className={styles.equipBlock} aria-label="Buy your own gear">
        <h3 className={styles.guidanceTitle}>Buy your own gear</h3>
        <p className={styles.hint}>
          Coins from your choices above can be spent right away (PHB 2024, &quot;Choose Starting
          Equipment&quot;). Prices are the book prices. Armor you are trained in is worn
          automatically when you finish.
        </p>
        <p className={styles.budget} role="status" aria-live="polite">
          Gold left:{' '}
          <CalculatedValue label="Gold remaining" breakdown={breakdown}>
            {gpText(remainingCopper)}
          </CalculatedValue>{' '}
          <span className={styles.hint}>
            of {gpText(budgetCopper)} (spent {gpText(spentCopper)})
          </span>
        </p>

        {flagged.length > 0 && (
          <div className={styles.warnPanel} role="alert" aria-label="Purchases you may not be able to use well">
            <strong>
              <TriangleAlert size={16} aria-hidden="true" /> You may not get much use from{' '}
              {flagged.length === 1 ? 'this purchase' : 'these purchases'}
            </strong>
            <ul>
              {flagged.map(({ entry, warnings }) => (
                <li key={entry.key}>
                  <strong>{entry.name}:</strong> {warnings.join(' ')}
                </li>
              ))}
            </ul>
            <p className={styles.hint}>
              You can still buy them. A feat, a species trait, or your DM may change things.
            </p>
          </div>
        )}

        {cartLines.length > 0 && (
          <ul className={styles.cartList} aria-label="Your purchases">
            {cartLines.map(({ entry, count }) => (
              <li key={entry.key} className={styles.cartRow}>
                <span>
                  {entry.name} × {count}
                </span>
                <span className={styles.shopCost}>{gpText(gpToCopper(entry.costGp) * count)}</span>
                <button
                  type="button"
                  className={styles.stepBtn}
                  aria-label={`Remove one ${entry.name}`}
                  onClick={() => onCartChange(entry.key, -1)}
                >
                  −
                </button>
              </li>
            ))}
          </ul>
        )}

        <SegmentedControl
          ariaLabel="Shop section"
          options={(Object.keys(SECTION_LABEL) as ShopSection[]).map((s) => ({
            value: s,
            label: SECTION_LABEL[s],
          }))}
          value={section}
          onChange={setSection}
        />
        <input
          className={styles.textInput}
          type="search"
          placeholder="Search items…"
          aria-label="Search shop"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className={styles.shopList} aria-label={`${SECTION_LABEL[section]} for sale`}>
          {visible.map((entry) => {
            const owned = cart[entry.key] ?? 0;
            const warnings = warningsFor(entry);
            const canAfford = gpToCopper(entry.costGp) <= remainingCopper;
            return (
              <li key={entry.key} className={styles.shopRow}>
                <div className={styles.shopInfo}>
                  <span className={styles.shopName}>
                    {entry.name}
                    {warnings.length > 0 && (
                      <ContentTooltip
                        content={warningContent(entry.name, warnings)}
                        ariaLabel={`Heads up about ${entry.name}`}
                        className={styles.warnBadge}
                      >
                        <TriangleAlert size={14} aria-hidden="true" /> May not suit a {cls.name}
                      </ContentTooltip>
                    )}
                  </span>
                  <span className={styles.hint}>
                    {entry.detail} · {entry.weightLb} lb
                  </span>
                </div>
                <span className={styles.shopCost}>{gpText(gpToCopper(entry.costGp))}</span>
                <div className={styles.shopButtons}>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    aria-label={`Remove one ${entry.name}`}
                    disabled={owned === 0}
                    onClick={() => onCartChange(entry.key, -1)}
                  >
                    −
                  </button>
                  <span className={styles.shopCount} aria-label={`${entry.name} owned`}>
                    {owned}
                  </span>
                  <button
                    type="button"
                    className={styles.stepBtn}
                    aria-label={`Buy one ${entry.name}`}
                    disabled={!canAfford}
                    onClick={() => onCartChange(entry.key, 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
          {visible.length === 0 && <li className={styles.hint}>Nothing matches that search.</li>}
        </ul>
      </section>
    </>
  );
}
