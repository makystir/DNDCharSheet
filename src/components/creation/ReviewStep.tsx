import type { ReactNode } from 'react';
import type { Character, InventoryItem, SpellcastingState } from '../../types/character';
import { ABILITIES, ABILITY_NAMES, SKILLS } from '../../types/character';
import { getClass } from '../../data/classes';
import { getSpecies } from '../../data/species';
import { getBackground } from '../../data/backgrounds';
import { getFeat } from '../../data/feats';
import { getWeapon } from '../../data/weapons';
import { getArmor } from '../../data/armor';
import { getEquipment } from '../../data/equipment';
import type { SpellId } from '../../data/spells';
import { primaryClass } from '../../logic/classes';
import { abilityModifier, proficiencyBonusBreakdown } from '../../logic/abilities';
import { formatSigned, type Breakdown } from '../../logic/breakdown';
import { abilityScoreBreakdown, effectiveAbilityScores } from '../../logic/feats';
import { savingThrowProficiency } from '../../logic/saving-throws';
import { effectiveSkillTraining } from '../../logic/skills';
import { characterArmorClassBreakdown } from '../../logic/armor-class';
import { characterHitPointMaxBreakdown, hitPointMaxOf } from '../../logic/hit-points-state';
import { initiativeBreakdown } from '../../logic/initiative';
import { passivePerceptionBreakdown } from '../../logic/passive-checks';
import { speedBreakdown } from '../../logic/species';
import { knownLanguages } from '../../logic/languages';
import { formatCopper, purseToCopper } from '../../logic/starting-equipment';
import { pendingFeaturePicks, pendingSetupChoices } from '../../logic/starting-choices';
import type { FeaturePickItem, PendingItem } from '../../logic/starting-choices';
import {
  resolveArmorTooltip,
  resolveFeatTooltip,
  resolveItemTooltip,
  resolveLanguageTooltip,
  resolveSaveTooltip,
  resolveSkillTooltip,
  resolveSpeciesTraitTooltip,
  resolveWeaponTooltip,
} from '../../logic/tooltip-content';
import { CalculatedValue } from '../shared/CalculatedValue';
import { MaybeContentTooltip } from '../shared/ContentTooltip';
import { SpellNameList } from '../shared/SpellName';
import { formatLanguage } from '../pages/sheet-helpers';
import styles from './CreationWizard.module.css';

/** The wizard steps a Review section can send the player back to. */
export type ReviewEditTarget =
  | 'class'
  | 'background'
  | 'species'
  | 'skills'
  | 'abilities'
  | 'spells'
  | 'details'
  | 'equipment';

export interface ReviewStepProps {
  /** The character as it would be created if the player pressed Finish now. */
  character: Character;
  /** Jump back to the step that owns a section. Omitted, no Edit links show. */
  onEdit?: (target: ReviewEditTarget) => void;
}

const PENDING_LABEL: Record<PendingItem['kind'] | FeaturePickItem['kind'], string> = {
  'class-skills': 'class skills',
  cantrips: 'cantrips',
  spellbook: 'spellbook spells',
  prepared: 'prepared spells',
  expertise: 'Expertise skills',
  languages: 'feature languages',
};

const itemName = (item: InventoryItem): string =>
  item.name ??
  (item.catalogId
    ? (getWeapon(item.catalogId)?.name ?? getArmor(item.catalogId)?.name ?? getEquipment(item.catalogId)?.name)
    : undefined) ??
  'Item';

const itemTooltip = (item: InventoryItem) =>
  resolveWeaponTooltip(item) ?? resolveArmorTooltip(item) ?? resolveItemTooltip(item);

/**
 * Wizard "Review" step: the character as it will be created, laid out like a
 * first look at the sheet. The numbers a player uses first (Hit Points, Armor
 * Class, Speed, Initiative, Passive Perception, Proficiency Bonus) lead, then
 * abilities, proficiencies, origin (feat, species traits, languages), spells,
 * equipment and gold, details, and the "Still open" list. Every number carries
 * its breakdown tooltip and every named rule its content tooltip. Each section
 * has an Edit link back to the step that owns it. Nothing here blocks Finish.
 */
export function ReviewStep({ character, onEdit }: ReviewStepProps) {
  const cls = getClass(primaryClass(character)?.id);
  const species = getSpecies(character.species?.id);
  const background = getBackground(character.backgroundSelection?.id);
  const feat = background ? getFeat(background.originFeatId) : undefined;
  const scores = effectiveAbilityScores(character);
  const pending: (PendingItem | FeaturePickItem)[] = [
    ...pendingSetupChoices(character),
    ...pendingFeaturePicks(character),
  ];

  const savingThrows = ABILITIES.filter((a) => savingThrowProficiency(character, a).proficient);
  const skills = SKILLS.map((s) => ({ skill: s, training: effectiveSkillTraining(character, s.id) })).filter(
    (r) => r.training.proficient,
  );
  const languages = knownLanguages(character);

  const sc: SpellcastingState = character.spellcasting ?? {};
  const spells = cls ? sc.byClass?.[cls.id as keyof NonNullable<SpellcastingState['byClass']>] : undefined;
  const spellGroups: { label: string; ids: SpellId[] | undefined }[] = [
    { label: 'Cantrips', ids: spells?.cantrips },
    { label: 'Spellbook', ids: spells?.spellbook },
    { label: 'Prepared', ids: spells?.prepared },
  ].filter((g) => (g.ids ?? []).length > 0);

  const hasHp = hitPointMaxOf(character) !== undefined;
  const ac = characterArmorClassBreakdown(character);
  const speed = speedBreakdown(character);
  const init = initiativeBreakdown(scores, character.initiativeBonus);
  const pp = passivePerceptionBreakdown(character);
  const pb = proficiencyBonusBreakdown(character.level);
  const purse = character.coins ? formatCopper(purseToCopper(character.coins)) : '0 GP';
  const inventory = character.inventory ?? [];
  const wornIds = new Set([character.equipped?.armorItemId, character.equipped?.shieldItemId].filter(Boolean));

  const section = (title: string, target: ReviewEditTarget | null, children: ReactNode) => (
    <section className={styles.reviewSection} aria-label={title}>
      <div className={styles.reviewHead}>
        <h3 className={styles.guidanceTitle}>{title}</h3>
        {onEdit && target && (
          <button
            type="button"
            className={styles.bgChoose}
            aria-label={`Edit ${title.toLowerCase()}`}
            onClick={() => onEdit(target)}
          >
            Edit
          </button>
        )}
      </div>
      {children}
    </section>
  );

  const details = [
    character.alignment ? `Alignment: ${character.alignment}` : null,
    character.age ? `Age: ${character.age}` : null,
    character.height ? `Height: ${character.height}` : null,
    character.weight ? `Weight: ${character.weight}` : null,
    character.eyes ? `Eyes: ${character.eyes}` : null,
    character.hair ? `Hair: ${character.hair}` : null,
    character.skin ? `Skin: ${character.skin}` : null,
    character.faith ? `Faith: ${character.faith}` : null,
  ].filter((x): x is string => x !== null);

  return (
    <div className={styles.grantedPanel} aria-label="Character summary">
      <div className={styles.reviewHead}>
        <h3 className={styles.guidanceTitle}>{character.name || 'Unnamed character'}</h3>
        {onEdit && (
          <button type="button" className={styles.bgChoose} aria-label="Edit name" onClick={() => onEdit('details')}>
            Edit
          </button>
        )}
      </div>
      <p className={styles.hint}>
        Level 1{' '}
        {[species?.name, cls?.name, background ? `${background.name} background` : undefined]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {section(
        'At a glance',
        null,
        <dl className={styles.reviewStats} data-testid="review-glance">
          <div>
            <dt>Hit Points</dt>
            <dd>
              {hasHp ? <CalculatedValue label="Hit Point Maximum" breakdown={characterHitPointMaxBreakdown(character)} /> : '-'}
            </dd>
          </div>
          <div>
            <dt>Armor Class</dt>
            <dd>
              <CalculatedValue label="Armor Class" breakdown={ac} />
            </dd>
          </div>
          <div>
            <dt>Speed</dt>
            <dd>
              <CalculatedValue label="Speed" breakdown={speed}>
                {speed.total} ft
              </CalculatedValue>
            </dd>
          </div>
          <div>
            <dt>Initiative</dt>
            <dd>
              <CalculatedValue label="Initiative" breakdown={init}>
                {formatSigned(init.total)}
              </CalculatedValue>
            </dd>
          </div>
          <div>
            <dt>Passive Perception</dt>
            <dd>
              <CalculatedValue label="Passive Perception" breakdown={pp} />
            </dd>
          </div>
          <div>
            <dt>Proficiency Bonus</dt>
            <dd>
              <CalculatedValue label="Proficiency Bonus" breakdown={pb}>
                {formatSigned(pb.total)}
              </CalculatedValue>
            </dd>
          </div>
        </dl>,
      )}

      {section(
        'Ability scores',
        'abilities',
        <ul className={styles.grantedList} aria-label="Ability scores">
          {ABILITIES.map((ability) => {
            const mod = abilityModifier(scores[ability]);
            const modBreakdown: Breakdown = {
              total: mod,
              components: [{ label: 'From score', value: mod }],
              note: `Score ${scores[ability]}`,
            };
            return (
              <li key={ability}>
                {ABILITY_NAMES[ability]}{' '}
                <CalculatedValue label={`${ABILITY_NAMES[ability]} Score`} breakdown={abilityScoreBreakdown(character, ability)}>
                  {scores[ability]}
                </CalculatedValue>{' '}
                (
                <CalculatedValue label={`${ABILITY_NAMES[ability]} Modifier`} breakdown={modBreakdown}>
                  {formatSigned(mod)}
                </CalculatedValue>
                )
              </li>
            );
          })}
        </ul>,
      )}

      {section(
        'Proficiencies',
        'skills',
        <>
          <p className={styles.hint} data-testid="review-saves">
            Saving throws:{' '}
            {savingThrows.length > 0
              ? savingThrows.map((a, i) => (
                  <span key={a}>
                    {i > 0 && ' & '}
                    <MaybeContentTooltip content={resolveSaveTooltip(a, character)} ariaLabel={`About ${ABILITY_NAMES[a]} saving throw`}>
                      {ABILITY_NAMES[a]}
                    </MaybeContentTooltip>
                  </span>
                ))
              : 'None'}
          </p>
          <ul className={styles.grantedList} aria-label="Skill proficiencies">
            {skills.length === 0 && <li>None</li>}
            {skills.map(({ skill, training }) => (
              <li key={skill.id}>
                <MaybeContentTooltip content={resolveSkillTooltip(skill.id, character)} ariaLabel={`About ${skill.name}`}>
                  {skill.name}
                </MaybeContentTooltip>
                {training.sourceLabel ? ` (${training.sourceLabel})` : ''}
              </li>
            ))}
          </ul>
          {cls && (
            <p className={styles.hint}>
              {cls.armorTraining.length > 0 ? `Armor: ${cls.armorTraining.join(', ')}. ` : ''}
              {cls.weaponProficiencies.length > 0 ? `Weapons: ${cls.weaponProficiencies.join(', ')}.` : ''}
            </p>
          )}
        </>,
      )}

      {section(
        'Origin',
        'background',
        <ul className={styles.grantedList} aria-label="Origin">
          {feat && (
            <li>
              Origin feat:{' '}
              <MaybeContentTooltip content={resolveFeatTooltip(feat.id)} ariaLabel={`About ${feat.name}`}>
                {feat.name}
              </MaybeContentTooltip>
            </li>
          )}
          {species && (
            <li>
              {species.name} traits:{' '}
              {species.traits.map((t, i) => (
                <span key={t.name}>
                  {i > 0 && ', '}
                  <MaybeContentTooltip content={resolveSpeciesTraitTooltip(t, species.name)} ariaLabel={`About ${t.name}`}>
                    {t.name}
                  </MaybeContentTooltip>
                </span>
              ))}
            </li>
          )}
          <li data-testid="review-languages">
            Languages:{' '}
            {languages.map((l, i) => (
              <span key={l}>
                {i > 0 && ', '}
                <MaybeContentTooltip content={resolveLanguageTooltip(l)} ariaLabel={`About ${formatLanguage(l)}`}>
                  {formatLanguage(l)}
                </MaybeContentTooltip>
              </span>
            ))}
          </li>
        </ul>,
      )}

      {spellGroups.length > 0 &&
        section(
          'Spells',
          'spells',
          <ul className={styles.grantedList} aria-label="Spells chosen">
            {spellGroups.map((g) => (
              <li key={g.label}>
                {g.label}: <SpellNameList ids={g.ids ?? []} />
              </li>
            ))}
          </ul>,
        )}

      {section(
        'Equipment',
        'equipment',
        <>
          <p className={styles.hint} data-testid="review-gold">
            Coins: {purse}
          </p>
          <ul className={styles.grantedList} aria-label="Equipment">
            {inventory.length === 0 && <li>None</li>}
            {inventory.map((item) => (
              <li key={item.id}>
                <MaybeContentTooltip content={itemTooltip(item)} ariaLabel={`About ${itemName(item)}`}>
                  {itemName(item)}
                </MaybeContentTooltip>
                {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                {wornIds.has(item.id) ? ' (worn)' : ''}
              </li>
            ))}
          </ul>
        </>,
      )}

      {section(
        'Details',
        'details',
        <>
          <p className={styles.hint} data-testid="review-details">
            {details.length > 0 ? details.join(' · ') : 'Nothing filled in yet. That is fine; you can add it on the sheet.'}
          </p>
          {character.personality && <p className={styles.hint}>{character.personality}</p>}
        </>,
      )}

      <h3 className={styles.guidanceTitle}>Still open</h3>
      {pending.length === 0 ? (
        <p className={styles.hint} data-testid="review-open">
          Everything is set.
        </p>
      ) : (
        <div data-testid="review-open">
          <ul className={styles.grantedList} aria-label="Still open">
            {pending.map((item) => (
              <li key={`${item.kind}-${item.classId ?? ''}`}>
                {item.className ? `${item.className}: ` : ''}
                {PENDING_LABEL[item.kind]}: {item.have} of {item.need}
              </li>
            ))}
          </ul>
          <p className={styles.hint}>You can finish these any time — the Overview will remind you.</p>
        </div>
      )}
    </div>
  );
}
