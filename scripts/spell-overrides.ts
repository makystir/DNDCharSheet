/**
 * Cited manual corrections for spell records the OCR mangles beyond clean
 * recovery. Each entry carries a PHB citation per rules-compliance rule 7.
 *
 * Overrides are merged LAST in the generator (scripts/generate-spells.ts), keyed
 * by the id the parser would otherwise produce from the mangled source, and they
 * may correct the `name` (and therefore the id) or patch a field. Keeping these
 * explicit and cited means every departure from the raw source is reviewable
 * rather than hand-edited into the generated blob.
 */

import type { ParsedSpell } from './spell-extract.ts';
import { slugify } from './spell-extract.ts';

/** A correction keyed by the parser-produced id (pre-override). */
export interface SpellOverride {
  /** Corrected name (and, via slugify, corrected id). */
  name?: string;
  /** Field patches, applied over the parsed values. */
  patch?: Partial<Omit<ParsedSpell, 'name' | 'flags'>>;
  /** Why this override exists, with a PHB citation. */
  reason: string;
}

/**
 * Keyed by the id the parser derives from the OCR-mangled source BEFORE any
 * correction. "FINd THe PATí Level 6 Divination (...)" title-cases to
 * "Find The Patí" -> slug 'find-the-pat' (the trailing 'í' is dropped by
 * slugify), so that is the key; the override restores the real name.
 */
export const SPELL_OVERRIDES: Record<string, SpellOverride> = {
  // PHB 2024 p.294 (Spell Descriptions: Mending, Level 0 Transmutation). The
  // source Components echo ("V, S, M (two lodestones)") was OCR-mangled to
  // "ponerter V. S M (tve lodesteres)" and leaked into the effect prose (and so
  // into the derived description). The real material ("two lodestones") is
  // already parsed into components, so strip the garbage prefix and start the
  // effect at the real prose (rules-compliance rule 6; no mechanics invented).
  mending: {
    patch: {
      effect:
        'This spell repairs a single break or tear in an object you touch, such as a broken chain link, two halves of a broken key, a torn cloak, or a leaking wineskin. As long as the break or tear is no larger than 1 foot in any dimension, you mend it, leaving no trace of the former damage.\n\nThis spell can physically repair a magic item, but it can\'t restore magic to such an object.',
    },
    reason:
      'PHB 2024 p.294: OCR-mangled Components echo "ponerter V. S M (tve lodesteres)" leaked into Mending\'s effect/description; stripped so prose starts at the real text.',
  },
  // PHB 2024 p.273: Find the Path (Level 6 Divination). Source OCR renders the
  // name as "FINd THe PATí"; title-casing + slugify yields 'find-the-pat'.
  'find-the-pat': {
    name: 'Find the Path',
    reason: 'PHB 2024 p.273: OCR mangled the name "FINd THe PATí" -> "Find the Path".',
  },
  // OCR dropped the space between the two words of each name below; the
  // level/school/fields and effect prose are intact — only the name needs the
  // space restored. Cited to the PHB 2024 Spell Descriptions entry for each.
  // PHB 2024 p.240: Animal Friendship (Level 1 Enchantment).
  animalfriendship: {
    name: 'Animal Friendship',
    reason: 'PHB 2024 p.240: OCR glued the name "ANIMALFRIENDSHIP" -> "Animal Friendship".',
  },
  // PHB 2024 p.262: Detect Magic (Level 1 Divination, Ritual).
  detectmagic: {
    name: 'Detect Magic',
    reason: 'PHB 2024 p.262: OCR glued the name "DETECTMAGIC" -> "Detect Magic".',
  },
  // PHB 2024 p.268: Elemental Weapon (Level 3 Transmutation).
  elementalweapon: {
    name: 'Elemental Weapon',
    reason: 'PHB 2024 p.268: OCR glued the name "ELEMENTALWEAPON" -> "Elemental Weapon".',
  },
  // PHB 2024 p.245: Arcane Gate (Level 6 Conjuration).
  arcanegate: {
    name: 'Arcane Gate',
    reason: 'PHB 2024 p.245: OCR glued the name "ARCANEGATE" -> "Arcane Gate".',
  },
  // PHB 2024 p.256: Conjure Fey (Level 6 Conjuration).
  conjurefey: {
    name: 'Conjure Fey',
    reason: 'PHB 2024 p.256: OCR glued the name "CONJUREFEY" -> "Conjure Fey".',
  },
  // PHB 2024 p.294: Magic Jar (Level 6 Necromancy). OCR glued the name
  // "MAGICJAR" -> "Magic Jar", AND the two-column source scrambled the effect
  // prose: it fused "On a successful save, the" + "When the spell ends, the
  // container is destroyed." into one broken sentence and stranded the
  // "target resists your efforts..." clause as an orphan paragraph. The effect
  // below reconstructs the verbatim PHB 2024 prose in its correct paragraph
  // order (rules-compliance rules 1/6; no mechanics invented) — the orphan
  // fragment rejoins "On a successful save, the", and "When the spell ends, the
  // container is destroyed." is restored as its own closing sentence.
  magicjar: {
    name: 'Magic Jar',
    patch: {
      effect:
        'Your body falls into a catatonic state as your soul leaves it and enters the container you used for the spell\'s Material component. While your soul inhabits the container, you are aware of your surroundings as if you were in the container\'s space. You can\'t move or take Reactions. The only action you can take is to project your soul up to 100 feet out of the container, either returning to your living body (and ending the spell) or attempting to possess a Humanoid\'s body.\n\nYou can attempt to possess any Humanoid within 100 feet of you that you can see (creatures warded by a Protection from Evil and Good or Magic Circle spell can\'t be possessed). The target makes a Charisma saving throw. On a failed save, your soul enters the target\'s body, and the target\'s soul becomes trapped in the container. On a successful save, the target resists your efforts to possess it, and you can\'t attempt to possess it again for 24 hours.\n\nOnce you possess a creature\'s body, you control it. Your Hit Points, Hit Point Dice, Strength, Dexterity, Constitution, Speed, and senses are replaced by the creature\'s. You otherwise keep your game statistics.\n\nMeanwhile, the possessed creature\'s soul can perceive from the container using its own senses, but it can\'t move and it is Incapacitated.\n\nWhile possessing a body, you can take a Magic action to return from the host body to the container if it is within 100 feet of you, returning the host creature\'s soul to its body. If the host body dies while you\'re in it, the creature dies, and you make a Charisma saving throw against your own spellcasting DC. On a success, you return to the container if it is within 100 feet of you. Otherwise, you die.\n\nIf the container is destroyed or the spell ends, your soul returns to your body. If your body is more than 100 feet away from you or if your body is dead, you die. If another creature\'s soul is in the container when it is destroyed, the creature\'s soul returns to its body if the body is alive and within 100 feet. Otherwise, that creature dies.\n\nWhen the spell ends, the container is destroyed.',
    },
    reason:
      'PHB 2024 p.294: OCR glued the name "MAGICJAR" -> "Magic Jar"; two-column scramble fused "On a successful save, the...When the spell ends" and stranded the "target resists..." clause; effect reconstructed verbatim in correct paragraph order.',
  },
  // PHB 2024 p.297: Mirror Image (Level 2 Illusion).
  mirrorimage: {
    name: 'Mirror Image',
    reason: 'PHB 2024 p.297: OCR glued the name "MIRRORIMAGE" -> "Mirror Image".',
  },
  // Mixed-case OCR mangling of the name; title-casing recovers it but the slug
  // of the raw mixed-case form is the override key. Cited to the PHB entry.
  // PHB 2024 p.252: Charm Monster (Level 4 Enchantment). "CHarm MOnSTER".
  'charm-monster': {
    name: 'Charm Monster',
    reason: 'PHB 2024 p.252: OCR mangled "CHarm MOnSTER" -> "Charm Monster".',
  },
  // PHB 2024 p.252: Charm Person (Level 1 Enchantment). "CHarm Person".
  'charm-person': {
    name: 'Charm Person',
    reason: 'PHB 2024 p.252: OCR mangled "CHarm Person" -> "Charm Person".',
  },

  // Two-column OCR scramble: the source prints two spell headers together and
  // then INTERLEAVES their stat blocks and effect prose, so the parser assigns
  // the first field/effect block to the wrong spell. The two affected pairs are
  // Insect Plague/Invisibility and Sacred Flame/Scorching Ray. Each record below
  // patches the stat-block fields and carries the VERBATIM effect prose from the
  // PHB entry (rules-compliance rule 1/6); no value is invented. The
  // level/school/class-list come correctly from the (clean) header signature.

  // PHB 2024 p.243: Arms of Hadar (Level 1 Conjuration). The two-column source
  // spliced the upcast line INTO the main sentence ("...takes 2d6 Necrotic
  // damage Using a Higher-Level Spell Slot. ...") and stranded the tail ("and
  // can't take Reactions until the start of its next turn. On a successful save,
  // ...") as a separate paragraph that begins mid-sentence. The effect below
  // restores the verbatim prose in correct order: the full main paragraph, then
  // the upcast addendum folded in as its own paragraph (rules-compliance
  // rules 1/6; verbatim, nothing invented). Caught by the splice/orphan oracle.
  'arms-of-hadar': {
    patch: {
      effect:
        'Invoking Hadar, you cause tendrils to erupt from yourself. Each creature in a 10-foot Emanation originating from you makes a Strength saving throw. On a failed save, a target takes 2d6 Necrotic damage and can\'t take Reactions until the start of its next turn. On a successful save, a target takes half as much damage only.\n\nUsing a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 1.',
    },
    reason:
      'PHB 2024 p.243: two-column OCR scramble spliced Arms of Hadar\'s upcast line into its main sentence and stranded the tail; effect reconstructed verbatim in correct order.',
  },
  // PHB 2024 p.311: Protection from Evil and Good (Level 1 Abjuration). An image
  // caption ("A HUMAN CLERIC CASTS RAISE DEAD...") OCR'd straight into the middle
  // of the effect, splitting "...have Disadvantage on attack rolls" from
  // "against the target. ..." (which was stranded as a mid-sentence paragraph).
  // The effect below removes the caption and restores the single verbatim
  // paragraph (rules-compliance rules 1/6; no mechanics invented). Caught by the
  // splice/orphan oracle.
  'protection-from-evil-and-good': {
    patch: {
      effect:
        'Until the spell ends, one willing creature you touch is protected against creatures that are Aberrations, Celestials, Elementals, Fey, Fiends, or Undead. The protection grants several benefits. Creatures of those types have Disadvantage on attack rolls against the target. The target also can\'t be possessed by or gain the Charmed or Frightened conditions from them. If the target is already possessed, Charmed, or Frightened by such a creature, the target has Advantage on any new saving throw against the relevant effect.',
    },
    reason:
      'PHB 2024 p.311: an image caption ("A HUMAN CLERIC CASTS RAISE DEAD...") OCR\'d into the middle of the effect, splitting the sentence; caption removed and verbatim prose restored.',
  },
  // PHB 2024 p.279: Giant Insect (Level 4 Conjuration). GROUP B (embedded stat
  // block) — but its PLAYER-FACING prose is itself spliced: the second paragraph
  // was cut at "...it takes its turn immediately after yours. It" and its tail
  // ("obeys your verbal commands...avoid danger.") plus the upcast line were
  // stranded AFTER the embedded Giant Insect stat block. Per the deferred-noise
  // carve-out we do NOT transcribe the embedded stat block this pass, but the
  // spliced PROSE is the in-scope defect class, so this override restores ONLY
  // the player-facing prose (the two intro paragraphs with the "It ... obeys
  // your verbal commands..." sentence made whole, then the upcast line), omitting
  // the embedded stat block (tracked follow-up). Verbatim prose; nothing invented
  // (rules-compliance rules 1/6).
  'giant-insect': {
    patch: {
      effect:
        'You summon a giant centipede, spider, or wasp (chosen when you cast the spell). It manifests in an unoccupied space you can see within range and uses the Giant Insect stat block. The form you choose determines certain details in its stat block. The creature disappears when it drops to 0 Hit Points or when the spell ends.\n\nThe creature is an ally to you and your allies. In combat, the creature shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required by you). If you don\'t issue any, it takes the Dodge action and uses its movement to avoid danger.\n\nUsing a Higher-Level Spell Slot. Use the spell slot\'s level for the spell\'s level in the stat block.',
    },
    reason:
      'PHB 2024 p.279: Giant Insect\'s player-facing prose was spliced ("...after yours. It" cut from "obeys your verbal commands...") across its embedded stat block; restored the prose only + upcast, leaving the embedded stat block as the deferred OCR follow-up (not transcribed this pass).',
  },
  // PHB 2024 p.320: Staggering Smite (Level 4 Enchantment). Text-bleed from the
  // adjacent Steel Wind Strike (p.320) appended two foreign paragraphs ("...
  // melee spell ttack against each target. On a hit, a target takes 6d10 Force
  // damage." + the teleport line) after Staggering Smite's real prose+upcast.
  // Staggering Smite's own effect (the extra 4d6 Psychic + Stunned, and the
  // upcast line) is intact; the override drops ONLY the foreign Steel Wind
  // Strike bleed, carrying Staggering Smite's verbatim prose (rules-compliance
  // rules 1/6). Caught by the splice/orphan oracle.
  'staggering-smite': {
    patch: {
      effect:
        'The target takes an extra 4d6 Psychic damage from the attack, and the target must succeed on a Wisdom saving throw or have the Stunned condition until the end of your next turn.\n\nUsing a Higher-Level Spell Slot. The extra damage increases by 1d6 for each spell slot level above 4.',
    },
    reason:
      'PHB 2024 p.320: text-bleed from Steel Wind Strike appended foreign paragraphs to Staggering Smite; dropped the bleed, kept Staggering Smite\'s verbatim prose + upcast.',
  },
  // PHB 2024 p.338: Wall of Force (Level 5 Evocation). Text-bleed from Vitriolic
  // Sphere (p.337) appended two foreign paragraphs ("explodes in a 20-foot-
  // radius Sphere...10d4 Acid damage..." + a "Using a Higher-Level Spell Slot"
  // line) after Wall of Force's real prose. Wall of Force has NO upcast line of
  // its own, so the override keeps only its two verbatim paragraphs and drops
  // the Vitriolic Sphere bleed. The source's own OCR glyphs in this prose
  // ("speil", "ethereai") are carried verbatim per the deferred-noise carve-out
  // (not force-normalized). Caught by the splice/orphan oracle.
  'wall-of-force': {
    patch: {
      effect:
        'An Invisible wall of force springs into existence at a point you choose within range. The wall appears in any orientation you choose, as a horizontal or vertical barrier or at an angle. It can be free floating or resting on a solid surface. You can form it into a hemispherical dome or a globe with a radius of up to 10 feet, or you can shape a flat surface made up of ten 10-foot-by-10-foot panels. Each panel must be contiguous with another panel. In any form, the wall is 1/4 inch thick and lasts for the duration. If the wall cuts through a creature\'s space when it appears, the creature is pushed to one side of the wall (you choose which side).\n\nNothing can physically pass through the wall. It is immune to all damage and can\'t be dispelled by Dispel Magic. A Disintegrate speil destroys the wall instantly, however. The wall also extends into the Ethereal Plane and blocks ethereai travel through the wall.',
    },
    reason:
      'PHB 2024 p.338: text-bleed from Vitriolic Sphere appended foreign paragraphs to Wall of Force; dropped the bleed, kept Wall of Force\'s verbatim prose (its own "speil"/"ethereai" OCR glyphs carried per the deferred-noise carve-out).',
  },
  // PHB 2024 p.283: Hallow (Level 5 Abjuration). A single sentence in the
  // "Darkness" extra-effect entry was split across a paragraph break ("...Normal
  // light, as" / "well as magical light ... can't illuminate the area."). The
  // override rejoins the sentence; all other prose (incl. the source's own OCR
  // glyphs "teleportarion") is carried verbatim per the deferred-noise carve-out
  // (rules-compliance rules 1/6). Caught by the splice/orphan oracle.
  hallow: {
    patch: {
      effect:
        'You touch a point and infuse an area around it with holy or unholy power. The area can have a radius up to 60 feet, and the spell fails if the radius includes an area already under the effect of Hallow. The affected area has the following effects.\n\nHallowed Ward. Choose any of these creature types: Aberration, Celestial, Elemental, Fey, Fiend, or Undead. Creatures of the chosen types can\'t willingly enter the area, and any creature that is possessed by or that has the Charmed or Frightened condition from such creatures isn\'t possessed, Charmed, or Frightened by them while in the area.\n\nExtra Effect. You bind an extra effect to the area from the list below:\n\nCourage. Creatures of any types you choose can\'t gain the Frightened condition while in the area. Darkness. Darkness fills the area. Normal light, as well as magical light created by spells of a level lower than this spell, can\'t illuminate the area.\n\nDaylight. Bright light fills the area. Magical Darkness created by spells of a level lower than this spell can\'t extinguish the light.\n\nPeaceful Rest. Dead bodies interred in the area can\'t be turned into Undead.\n\nExtradimensional Interference. Creatures of any types you choose can\'t enter or exit the area using teleportarion or interplanar travel.\n\nFear. Creatures of any types you choose have the Frightened condition while in the area.\n\nResistance. Creatures of any types you choose have Resistance to one damage type of your choice while in the area.\n\nTongues. Creatures of any types you choose can communicate with any other creature in the area even if they don\'t share a common language.\n\nSilence. No sound can emanate from within the area, and no sound can reach into it.\n\nVulnerability. Creatures of any types you choose have Vulnerability to one damage type of your choice while in the area.',
    },
    reason:
      'PHB 2024 p.283: Hallow\'s "Darkness" extra-effect sentence was split across a paragraph break; rejoined ("...Normal light, as well as magical light..."), other prose carried verbatim (incl. source "teleportarion" glyph per the deferred-noise carve-out).',
  },
  // PHB 2024 p.288: Insect Plague (Level 5 Conjuration).
  'insect-plague': {
    patch: {
      castingTime: 'Action',
      range: '300 feet',
      components: { verbal: true, somatic: true, material: 'a locust' },
      duration: 'Concentration, up to 10 minutes',
      concentration: true,
      ritual: false,
      effect:
        "Swarming locusts fill a 20-foot-radius Sphere centered on a point you choose within range. The Sphere remains for the duration, and its area is Lightly Obscured and Difficult Terrain.\n\nWhen the swarm appears, each creature in it makes a Constitution saving throw, taking 4d10 Piercing damage on a failed save or half as much damage on a successful one. A creature also makes this save when it enters the spell's area for the first time on a turn or ends its turn there. A creature makes this save only once per turn.\n\nUsing a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 5.",
    },
    reason:
      'PHB 2024 p.288: two-column OCR scramble merged Insect Plague with Invisibility; fields + verbatim effect restored.',
  },
  // PHB 2024 p.289: Invisibility (Level 2 Illusion).
  invisibility: {
    patch: {
      castingTime: 'Action',
      range: 'Touch',
      components: { verbal: true, somatic: true, material: 'an eyelash in gum arabic' },
      duration: 'Concentration, up to 1 hour',
      concentration: true,
      ritual: false,
      effect:
        'A creature you touch has the Invisible condition until the spell ends. The spell ends early immediately after the target makes an attack roll, deals damage, or casts a spell.\n\nUsing a Higher-Level Spell Slot. You can target one additional creature for each spell slot level above 2.',
    },
    reason:
      'PHB 2024 p.289: two-column OCR scramble merged Invisibility with Insect Plague; fields + verbatim effect restored.',
  },
  // PHB 2024 p.313: Sacred Flame (Evocation Cantrip).
  'sacred-flame': {
    patch: {
      castingTime: 'Action',
      range: '60 feet',
      components: { verbal: true, somatic: true },
      duration: 'Instantaneous',
      concentration: false,
      ritual: false,
      effect:
        'Flame-like radiance descends on a creature that you can see within range. The target must succeed on a Dexterity saving throw or take 1d8 Radiant damage. The target gains no benefit from Half Cover or Three-Quarters Cover for this save.\n\nCantrip Upgrade. The damage increases by 1d8 when you reach levels 5 (2d8), 11 (3d8), and 17 (4d8).',
    },
    reason:
      'PHB 2024 p.313: two-column OCR scramble merged Sacred Flame with Scorching Ray; fields + verbatim effect restored.',
  },
  // PHB 2024 p.315: Scorching Ray (Level 2 Evocation).
  'scorching-ray': {
    patch: {
      castingTime: 'Action',
      range: '120 feet',
      components: { verbal: true, somatic: true },
      duration: 'Instantaneous',
      concentration: false,
      ritual: false,
      // The two-column scramble also displaced Scorching Ray's upcast line: the
      // verbatim "Using a Higher-Level Spell Slot. You create one additional ray
      // for each spell slot level above 2." prints at Docs/PlayersHandbook.md
      // ~L15869 (adrift inside the Sanctuary block) and belongs to Scorching Ray
      // — it is folded back into the effect here per the project decision to
      // carry upcast text in `effect` (rules-compliance rule 1/6; verbatim).
      effect:
        'You hurl three fiery rays. You can hurl them at one target within range or at several. Make a ranged spell attack for each ray. On a hit, the target takes 2d6 Fire damage.\n\nUsing a Higher-Level Spell Slot. You create one additional ray for each spell slot level above 2.',
    },
    reason:
      'PHB 2024 p.315: two-column OCR scramble merged Scorching Ray with Sacred Flame; fields + verbatim effect restored.',
  },
  // PHB 2024 p.316: Summon Undead (Level 3 Necromancy). GROUP B (embedded stat
  // block) — unlike Giant Insect, Option A keeps the embedded Undead Spirit stat
  // block as verbatim text but de-garbles its OCR noise. The source scrambled
  // the block: the ability-grid header printed as "MOD SAVE IAOD SAVE t.1O0
  // SAVE" (three MOD/SAVE column groups), the ability rows used an 'l' glyph for
  // '1' ("+l" -> "+1") and "Wts 10" for "WIS 10", and the Incorporeal Passage
  // (Ghostly Only) trait sentence was SPLIT — its tail ("...were Difficult
  // Terrain. If it ends its turn inside an object, ...1d10 Force damage for every
  // 5 feet traveled.") was stranded as a paragraph BEFORE the ability table while
  // its head ("Incorporeal Passage (Ghostly Only). The spirit can move through
  // other creatures and objects as if they") sat later under TRAITS. The effect
  // below restores the verbatim PHB stat block in correct order: AC/HP line, the
  // de-garbled ability grid, Speed/Immunities/Senses-Languages-CR, TRAITS (with
  // the Incorporeal Passage sentence rejoined), then ACTIONS. Only OCR glyphs are
  // fixed and the split sentence rejoined; no mechanic is invented or changed
  // (rules-compliance rules 1/6; every number verified against PHB p.316).
  'summon-undead': {
    patch: {
      effect:
        'You call forth an Undead spirit. It manifests in an unoccupied space that you can see within range and uses the Undead Spirit stat block. When you cast the spell, choose the creature\'s form: Ghostly, Putrid, or Skeletal. The spirit resembles an Undead creature with the chosen form, which determines certain details in its stat block. The creature disappears when it drops to 0 Hit Points or when the spell ends.\n\nThe creature is an ally to you and your allies. In combat, the creature shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required by you). If you don\'t issue any, it takes the Dodge action and uses its movement to avoid danger.\n\nUsing a Higher-Level Spell Slot. Use the spell slot\'s level for the spell\'s level in the stat block.\n\n## UNDEAD SPIRIT\n\nMedium Undead, Neutral\n\nAC 11 + the spell\'s level HP 30 (Ghostly and Putrid only) or 20 (Skeletal only) + 10 for each spell level above 3\n\nMOD SAVE MOD SAVE MOD SAVE\nSTR 12 +1 +1 DEX 16 +3 +3 CON 15 +2 +2\nINT 4 -3 -3 WIS 10 +0 +0 CHA 9 -1 -1\n\nSpeed 30 ft.; Fly 40 ft. (hover; Ghostly only)\n\nImmunities Necrotic, Poison; Exhaustion, Frightened, Paralyzed, Poisoned\n\nSenses Darkvision 60 ft., Passive Perception 10 Languages Understands the languages you know CR None (XP 0; PB equals your Proficiency Bonus)\n\n## TRAITS\n\nFestering Aura (Putrid Only). Constitution Saving Throw: DC equals your spell save DC, any creature (other than you) that starts its turn within a 5-foot Emanation originating from the spirit. Failure: The creature has the Poisoned condition until the start of its next turn.\n\nIncorporeal Passage (Ghostly Only). The spirit can move through other creatures and objects as if they were Difficult Terrain. If it ends its turn inside an object, it is shunted to the nearest unoccupied space and takes 1d10 Force damage for every 5 feet traveled.\n\n## ACTIONS\n\nMultiattack. The spirit makes a number of attacks equal to half this spell\'s level (round down).\n\nDeathly Touch (Ghostly Only). Melee Attack Roll: Bonus equals your spell attack modifier, reach 5 ft. Hit: 1d8 + 3 + the spell\'s level Necrotic damage, and the target has the Frightened condition until the end of its next turn.\n\nGrave Bolt (Skeletal Only). Ranged Attack Roll: Bonus equals your spell attack modifier, range 150 ft. Hit: 2d4 + 3 + the spell\'s level Necrotic damage.\n\nRotting Claw (Putrid Only). Melee Attack Roll: Bonus equals your spell attack modifier, reach 5 ft. Hit: 1d6 + 3 + the spell\'s level Slashing damage. If the target has the Poisoned condition, it has the Paralyzed condition until the end of its next turn.',
    },
    reason:
      'PHB 2024 p.316: de-garbled the embedded Undead Spirit stat block in Summon Undead\'s effect — fixed the ability-grid header ("MOD SAVE IAOD SAVE t.1O0 SAVE" -> three "MOD SAVE" groups), digit glyphs ("+l" -> "+1") and "Wts 10" -> "WIS 10", and rejoined the Incorporeal Passage (Ghostly Only) trait sentence with its orphaned tail in correct order; verbatim, no mechanics changed.',
  },
  // PHB 2024 p.312: Reincarnate (Level 5 Necromancy). The embedded d10 species
  // roll table was OCR-scrambled: the two-column header printed as "ldlO Species
  // ldlO Species" (should be "1d10 Species" column headers), the row index 1 as
  // "l Aasimar", and "9 Ore" instead of "9 Orc". Per Option A this stays inline
  // text; the override de-garbles the glyphs only and keeps the surrounding prose
  // verbatim. Species list/numbering verified against PHB p.312: 1 Aasimar,
  // 2 Dragonborn, 3 Dwarf, 4 Elf, 5 Gnome, 6 Goliath, 7 Halfling, 8 Human,
  // 9 Orc, 10 Tiefling (rules-compliance rules 1/6; no mechanics invented).
  reincarnate: {
    patch: {
      effect:
        'You touch a dead Humanoid or a piece of one. If the creature has been dead no longer than 10 days, the spell forms a new body for it and calls the soul to enter that body. Roll 1d10 and consult the table below to determine the body\'s species, or the DM chooses another playable species.\n\n1d10 Species 1d10 Species\n1 Aasimar 6 Goliath\n2 Dragonborn 7 Halfling\n3 Dwarf 8 Human\n4 Elf 9 Orc\n5 Gnome 10 Tiefling\n\nThe reincarnated creature makes any choices that a species\' description offers, and the creature recalls its former life. It retains the capabilities it had in its original form, except it loses the traits of its previous species and gains the traits of its new one.',
    },
    reason:
      'PHB 2024 p.312: de-garbled Reincarnate\'s embedded d10 species table — "ldlO Species" -> "1d10 Species" headers, "l Aasimar" -> "1 Aasimar", and "9 Ore" -> "9 Orc"; kept inline (Option A) with surrounding prose verbatim.',
  },
};

/** Apply the override for a parsed spell, returning the corrected record. */
export function applyOverride(spell: ParsedSpell): ParsedSpell {
  const key = slugify(spell.name);
  const override = SPELL_OVERRIDES[key];
  if (!override) return spell;
  // When a field patch is applied it supersedes the parser's (scrambled) values,
  // so the stale reconcile flags (missing-field/empty-effect/unbalanced-paren)
  // no longer apply; keep only the cited override note. A name-only override
  // preserves the parser's flags.
  const baseFlags = override.patch ? [] : spell.flags;
  const corrected: ParsedSpell = {
    ...spell,
    ...(override.patch ?? {}),
    name: override.name ?? spell.name,
    flags: [...baseFlags, `override:${override.reason}`],
  };
  return corrected;
}
