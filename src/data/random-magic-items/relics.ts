/**
 * Random Magic Items, Relics tables (Dungeon Master's Guide 2024, printed pages
 * 330-331). Each line is "<d100 range> <item>", with 00 meaning 100. Read from
 * the page images; random-magic-items.test.ts checks that every table covers
 * 01-00 exactly once.
 */
export const RELICS_RAW = {
  common: `
01-08 Ear Horn of Hearing
09-28 Potion of Healing
29-36 Pot of Awakening
37-44 Ruby of the War Mage
45-52 Shield of Expression
53-60 Smoldering Armor
61-80 Spell Scroll (cantrip or level 1 spell)
81-90 Staff of Adornment
91-00 Staff of Flowers
`,
  uncommon: `
01-05 Enspelled Staff (cantrip or level 1 spell)
06-10 Keoghtom's Ointment
11-15 Mariner's Armor
16-20 Nature's Mantle
21-25 Pearl of Power
26-30 Periapt of Health
31-35 Periapt of Wound Closure
36-40 Potion of Animal Friendship
41-55 Potion of Healing (greater)
56-60 Potion of Resistance
61-65 Ring of Water Walking
66-70 Sending Stones
71-80 Spell Scroll (level 2 or 3 spell)
81-85 Staff of the Adder
86-90 Staff of the Python
91-95 Wand of Magic Detection
96-00 Wand of the War Mage, +1
`,
  rare: `
01-03 Amulet of Health
04-07 Armor, +1
08-09 Bowl of Commanding Water Elementals
10-11 Brazier of Commanding Fire Elementals
12-13 Censer of Controlling Air Elementals
14-16 Elixir of Health
17-19 Enspelled Staff (level 2 or 3 spell)
20-22 Horn of Blasting
23-25 Horn of Valhalla (brass or silver)
26-28 Ioun Stone (reserve or sustenance)
29-31 Mace of Disruption
32-34 Mace of Smiting
35-37 Mace of Terror
38-40 Necklace of Prayer Beads
41-43 Periapt of Proof against Poison
44-51 Potion of Healing (superior)
52-54 Ring of Animal Influence
55-58 Ring of Resistance
59-61 Ring of Spell Storing
62-65 Scroll of Protection
66-73 Spell Scroll (level 4 or 5 spell)
74-76 Staff of Charming
77-79 Staff of Healing
80-82 Staff of Swarming Insects
83-85 Staff of the Woodlands
86-88 Staff of Withering
89-90 Stone of Controlling Earth Elementals
91-93 Tentacle Rod
94-96 Wand of Paralysis
97-00 Wand of the War Mage, +2
`,
  veryRare: `
01-05 Armor, +2
06-10 Candle of Invocation
11-15 Cauldron of Rebirth
16-20 Enspelled Staff (level 4 or 5 spell)
21-25 Horn of Valhalla (bronze)
26-30 Ioun Stone (insight)
31-35 Manual of Bodily Health
36-43 Potion of Healing (supreme)
44-50 Potion of Vitality
51-55 Rod of Alertness
56-65 Spell Scroll (level 6, 7, or 8 spell)
66-70 Spirit Board
71-75 Staff of Fire
76-80 Staff of Frost
81-85 Staff of Striking
86-90 Staff of Thunder and Lightning
91-95 Tome of Understanding
96-00 Wand of the War Mage, +3
`,
  legendary: `
01-08 Armor of Invulnerability
09-18 Armor, +3
19-27 Enspelled Staff (level 6, 7, or 8 spell)
28-36 Holy Avenger
37-45 Horn of Valhalla (iron)
46-54 Rod of Resurrection
55-63 Scarab of Protection
64-72 Scroll of Titan Summoning
73-80 Spell Scroll (level 9 spell)
81-90 Talisman of Pure Good
91-00 Talisman of Ultimate Evil
`,
} as const;

