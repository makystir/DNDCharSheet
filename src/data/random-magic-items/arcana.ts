/**
 * Random Magic Items, Arcana tables (Dungeon Master's Guide 2024, printed pages
 * 326-327). Each line is "<d100 range> <item>", with 00 meaning 100. Read from
 * the page images; random-magic-items.test.ts checks that every table covers
 * 01-00 exactly once.
 */
export const ARCANA_RAW = {
  common: `
01-02 Bead of Nourishment
03-04 Bead of Refreshment
05-07 Candle of the Deep
08-10 Cloak of Billowing
11-13 Cloak of Many Fashions
14-15 Clothes of Mending
16-17 Dark Shard Amulet
18-19 Enduring Spellbook
20-21 Ersatz Eye
22-24 Hat of Vermin
25-27 Hat of Wizardry
28-29 Heward's Handy Spice Pouch
30-31 Horn of Silent Alarm
32-33 Instrument of Illusions
34-35 Instrument of Scribing
36-37 Lock of Trickery
38-40 Mystery Key
41-42 Orb of Direction
43-44 Orb of Time
45-46 Perfume of Bewitching
47-49 Pipe of Smoke Monsters
50-52 Potion of Climbing
53-55 Potion of Comprehension
56-58 Pot of Awakening
59-60 Prosthetic Limb
61-64 Rival Coin
65-66 Rope of Mending
67-68 Ruby of the War Mage
69-82 Spell Scroll (cantrip or level 1 spell)
83-84 Staff of Adornment
85-86 Staff of Birdcalls
87-89 Staff of Flowers
90-92 Talking Doll
93-94 Tankard of Sobriety
95-97 Wand of Conducting
98-00 Wand of Pyrotechnics
`,
  uncommon: `
01 Amulet of Proof against Detection and Location
02 Baba Yaga's Dancing Broom
03-05 Bag of Holding
06-07 Bag of Tricks
08 Brooch of Shielding
09 Broom of Flying
10 Cap of Water Breathing
11 Circlet of Blasting
12-13 Cloak of Protection
14 Cloak of the Manta Ray
15 Decanter of Endless Water
16 Deck of Illusions
17-18 Driftglobe
19-20 Dust of Disappearance
21 Dust of Dryness
22 Dust of Sneezing and Choking
23-24 Elemental Gem
25 Enspelled Staff (cantrip or level 1 spell)
26 Eversmoking Bottle
27 Eyes of Charming
28 Eyes of Minute Seeing
29-30 Figurine of Wondrous Power (silver raven)
31 Gem of Brightness
32 Hag Eye
33 Hat of Disguise
34 Headband of Intellect
35 Helm of Comprehending Languages
36 Helm of Telepathy
37 Immovable Rod
38 Lantern of Revealing
39 Medallion of Thoughts
40 Mithral Armor
41-42 Necklace of Adaptation
43 Oil of Slipperiness
44 Pearl of Power
45 Periapt of Health
46-47 Philter of Love
48-49 Potion of Animal Friendship
50-51 Potion of Fire Breath
52-53 Potion of Giant Strength (hill)
54-55 Potion of Growth
56-57 Potion of Poison
58-59 Potion of Resistance
60-61 Potion of Water Breathing
62 Quaal's Feather Token (anchor, fan, or tree)
63 Ring of Mind Shielding
64-65 Robe of Useful Items
66-67 Rod of the Pact Keeper, +1
68-69 Rope of Climbing
70 Saddle of the Cavalier
71-72 Sending Stones
73-74 Slippers of Spider Climbing
75-82 Spell Scroll (level 2 or 3 spell)
83 Staff of the Adder
84 Staff of the Python
85-88 Wand of Magic Detection
89-91 Wand of Magic Missiles
92-93 Wand of Secrets
94-95 Wand of the War Mage, +1
96-97 Wand of Web
98-99 Wind Fan
00 Winged Boots
`,
} as const;
