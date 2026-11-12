/**
 * Class and subclass features you use as an ACTION or a BONUS ACTION, for the
 * Combat page's "On your turn" card (Reactions are tagged separately, on the
 * feature's `mechanics.activation`, see logic/reactions.ts).
 *
 * Only features whose PHB 2024 text says how they are used are listed: "As a
 * Bonus Action ..." / "As a Magic action ..." / "... as a Bonus Action". A
 * Magic action is an action (PHB 2024 "Actions" table, L590-605), so it is
 * listed as an action. Each entry cites the line it was read from. Features that
 * ride on another action (Action Surge, Sacred Weapon, Vow of Enmity, Rage of the
 * Wilds options, Metamagic) and class choices (maneuvers, invocations) are not
 * listed here.
 *
 * Key: `${classId}|${subclassId or ''}|${feature name}`. An independent golden
 * (src/data/__tests__/turn-options-golden.ts) pins every entry.
 */

export type TurnActivation = 'action' | 'bonus-action';

export interface FeatureTurnOption {
  /** What the player does, e.g. 'Rage' or 'Channel Divinity: Turn Undead'. */
  name: string;
  activation: TurnActivation;
  /** Docs/PlayersHandbook.md line the activation was read from. */
  phbLine: number;
}

const BA = 'bonus-action' as const;
const ACT = 'action' as const;

function o(name: string, activation: TurnActivation, phbLine: number): FeatureTurnOption {
  return { name, activation, phbLine };
}

export const FEATURE_TURN_OPTIONS: Readonly<Record<string, readonly FeatureTurnOption[]>> = {
  // ─── Barbarian ─────────────────────────────────────────────────────────────
  'barbarian||Rage': [o('Rage', BA, 2426)],
  'barbarian|berserker|Intimidating Presence': [o('Intimidating Presence', BA, 2571)],
  'barbarian|worldTree|Travel Along the Tree': [o('Travel Along the Tree', BA, 2635)],
  'barbarian|zealot|Warrior of the Gods': [o('Warrior of the Gods', BA, 2649)],
  'barbarian|zealot|Zealous Presence': [o('Zealous Presence', BA, 2661)],
  // ─── Bard ──────────────────────────────────────────────────────────────────
  'bard||Bardic Inspiration': [o('Bardic Inspiration', BA, 2733)],
  'bard|glamour|Mantle of Inspiration': [o('Mantle of Inspiration', BA, 3031)],
  'bard|glamour|Mantle of Majesty': [o('Mantle of Majesty', BA, 3037)],
  'bard|glamour|Unbreakable Majesty': [o('Unbreakable Majesty', BA, 3047)],
  'bard|valor|Battle Magic': [o('Battle Magic (weapon attack after an action spell)', BA, 3103)],
  // ─── Cleric ────────────────────────────────────────────────────────────────
  'cleric||Channel Divinity': [
    o('Channel Divinity: Divine Spark', ACT, 3246),
    o('Channel Divinity: Turn Undead', ACT, 3248),
  ],
  'cleric||Divine Intervention': [o('Divine Intervention', ACT, 3270)],
  'cleric|life|Preserve Life': [o('Preserve Life', ACT, 3434)],
  'cleric|light|Radiance of the Dawn': [o('Radiance of the Dawn', ACT, 3469)],
  'cleric|light|Corona of Light': [o('Corona of Light', ACT, 3483)],
  'cleric|trickery|Blessing of the Trickster': [o('Blessing of the Trickster', ACT, 3497)],
  'cleric|trickery|Invoke Duplicity': [o('Invoke Duplicity (create or move the illusion)', BA, 3501)],
  'cleric|war|War Priest': [o('War Priest attack', BA, 3559)],
  // ─── Druid ─────────────────────────────────────────────────────────────────
  'druid||Wild Shape': [o('Wild Shape (or leave the form)', BA, 3676)],
  'druid||Wild Companion': [o('Wild Companion', ACT, 3706)],
  "druid|land|Land's Aid": [o("Land's Aid", ACT, 3898)],
  "druid|land|Nature's Sanctuary": [o("Nature's Sanctuary", ACT, 3925), o("Nature's Sanctuary: move the Cube", BA, 3927)],
  'druid|moon|Moonlight Step': [o('Moonlight Step', BA, 3970)],
  'druid|sea|Wrath of the Sea': [o('Wrath of the Sea', BA, 4003)],
  'druid|stars|Starry Form': [o('Starry Form', BA, 4052)],
  // ─── Fighter ───────────────────────────────────────────────────────────────
  'fighter||Second Wind': [o('Second Wind', BA, 4116)],
  'fighter|battleMaster|Know Your Enemy': [o('Know Your Enemy', BA, 4253)],
  'fighter|eldritchKnight|War Bond': [o('War Bond: summon your weapon', BA, 4394)],
  'fighter|psiWarrior|Psionic Power': [o('Psionic Power: Telekinetic Movement', ACT, 4443)],
  'fighter|psiWarrior|Telekinetic Adept': [o('Telekinetic Adept: Psi-Powered Leap', BA, 4451)],
  'fighter|psiWarrior|Bulwark of Force': [o('Bulwark of Force', BA, 4461)],
  'fighter|psiWarrior|Telekinetic Master': [o('Telekinetic Master: weapon attack', BA, 4467)],
  // ─── Monk ──────────────────────────────────────────────────────────────────
  'monk||Martial Arts': [o('Martial Arts: Unarmed Strike', BA, 4524)],
  "monk||Monk's Focus": [
    o('Flurry of Blows', BA, 4575),
    o('Patient Defense', BA, 4577),
    o('Step of the Wind', BA, 4579),
  ],
  'monk|elements|Elemental Burst': [o('Elemental Burst', ACT, 4763)],
  'monk|mercy|Hand of Healing': [o('Hand of Healing', ACT, 4687)],
  'monk|mercy|Hand of Ultimate Mercy': [o('Hand of Ultimate Mercy', ACT, 4707)],
  'monk|openHand|Wholeness of Body': [o('Wholeness of Body', BA, 4795)],
  'monk|shadow|Shadow Step': [o('Shadow Step', BA, 4729)],
  'monk|shadow|Cloak of Shadows': [o('Cloak of Shadows', ACT, 4735)],
  // ─── Paladin ───────────────────────────────────────────────────────────────
  'paladin||Lay On Hands': [o('Lay On Hands', BA, 4857)],
  'paladin||Channel Divinity': [o('Channel Divinity: Divine Sense', BA, 4926)],
  'paladin||Abjure Foes': [o('Abjure Foes', ACT, 4954)],
  'paladin|devotion|Holy Nimbus': [o('Holy Nimbus', BA, 5145)],
  'paladin|glory|Peerless Athlete': [o('Peerless Athlete', BA, 5185)],
  'paladin|glory|Living Legend': [o('Living Legend', BA, 5201)],
  "paladin|ancients|Nature's Wrath": [o("Nature's Wrath", ACT, 5223)],
  'paladin|ancients|Elder Champion': [o('Elder Champion', BA, 5253)],
  'paladin|vengeance|Avenging Angel': [o('Avenging Angel', BA, 5303)],
  // ─── Ranger ────────────────────────────────────────────────────────────────
  'ranger||Tireless': [o('Tireless: Temporary Hit Points', ACT, 5446)],
  "ranger||Nature's Veil": [o("Nature's Veil", BA, 5456)],
  'ranger|beastMaster|Primal Companion': [o('Primal Companion: command the beast', BA, 5587)],
  // ─── Rogue ─────────────────────────────────────────────────────────────────
  'rogue||Cunning Action': [o('Cunning Action: Dash, Disengage or Hide', BA, 5935)],
  'rogue||Steady Aim': [o('Steady Aim', BA, 5943)],
  'rogue|arcaneTrickster|Mage Hand Legerdemain': [o('Mage Hand Legerdemain: cast or control the hand', BA, 6052)],
  'rogue|soulknife|Psionic Power': [o('Psionic Power: Psychic Whispers', ACT, 6131)],
  'rogue|soulknife|Psychic Blades': [o('Psychic Blades: second blade attack', BA, 6151)],
  'rogue|soulknife|Soul Blades': [o('Soul Blades: Psychic Teleportation', BA, 6159)],
  'rogue|soulknife|Psychic Veil': [o('Psychic Veil', ACT, 6165)],
  'rogue|thief|Fast Hands': [o('Fast Hands: Utilize or use a magic item', BA, 6181)],
  // ─── Sorcerer ──────────────────────────────────────────────────────────────
  'sorcerer||Innate Sorcery': [o('Innate Sorcery', BA, 6310)],
  'sorcerer||Font of Magic': [o('Font of Magic: create a spell slot', BA, 6327)],
  'sorcerer|aberrant|Telepathic Speech': [o('Telepathic Speech', BA, 6555)],
  'sorcerer|aberrant|Revelation in Flesh': [o('Revelation in Flesh', BA, 6571)],
  'sorcerer|aberrant|Warping Implosion': [o('Warping Implosion', ACT, 6583)],
  'sorcerer|clockwork|Bastion of Law': [o('Bastion of Law', ACT, 6628)],
  'sorcerer|clockwork|Trance of Order': [o('Trance of Order', BA, 6634)],
  'sorcerer|clockwork|Clockwork Cavalcade': [o('Clockwork Cavalcade', ACT, 6640)],
  'sorcerer|draconic|Dragon Wings': [o('Dragon Wings', BA, 6685)],
  // ─── Warlock ───────────────────────────────────────────────────────────────
  'warlock|celestial|Healing Light': [o('Healing Light', BA, 7256)],
  'warlock|greatOldOne|Awakened Mind': [o('Awakened Mind', BA, 7317)],
  // ─── Wizard ────────────────────────────────────────────────────────────────
  'wizard|abjurer|Arcane Ward': [o('Arcane Ward: restore the ward', BA, 7668)],
  'wizard|abjurer|Spell Breaker': [o('Spell Breaker: cast Dispel Magic', BA, 7678)],
  'wizard|diviner|The Third Eye': [o('The Third Eye', BA, 7712)],
  'wizard|illusionist|Improved Illusions': [o('Improved Illusions: cast Minor Illusion', BA, 7770)],
};

/** The turn options of one feature (empty when it has none). */
export function featureTurnOptions(
  classId: string,
  subclassId: string | undefined,
  featureName: string,
): readonly FeatureTurnOption[] {
  return FEATURE_TURN_OPTIONS[`${classId}|${subclassId ?? ''}|${featureName}`] ?? [];
}
