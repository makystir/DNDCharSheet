/**
 * Random Magic Items, Implements tables (Dungeon Master's Guide 2024, printed pages
 * 329-330). Each line is "<d100 range> <item>", with 00 meaning 100. Read from
 * the page images; random-magic-items.test.ts checks that every table covers
 * 01-00 exactly once.
 */
export const IMPLEMENTS_RAW = {
  common: `
01-02 Bead of Nourishment
03-04 Bead of Refreshment
05-06 Boots of False Tracks
07-08 Candle of the Deep
09-10 Charlatan's Die
11-13 Cloak of Many Fashions
14-15 Clockwork Amulet
16-17 Ear Horn of Hearing
18-19 Ersatz Eye
20-21 Heward's Handy Spice Pouch
22-23 Horn of Silent Alarm
24-25 Instrument of Illusions
26-27 Instrument of Scribing
28-29 Lock of Trickery
30-32 Moon-Touched Sword
33-34 Mystery Key
35-36 Orb of Direction
37-38 Orb of Time
39-40 Perfume of Bewitching
41-42 Pipe of Smoke Monsters
43-44 Pole of Angling
45-46 Pole of Collapsing
47-52 Potion of Climbing
53-58 Potion of Comprehension
59-74 Potion of Healing
75-76 Prosthetic Limb
77-78 Rope of Mending
79-80 Staff of Birdcalls
81-82 Sylvan Talon
83-84 Talking Doll
85-86 Tankard of Sobriety
87-90 Veteran's Cane
91-93 Walloping Ammunition
94-96 Wand of Conducting
97-00 Wand of Pyrotechnics
`,
  uncommon: `
01-02 Alchemy Jug
03-06 Ammunition, +1
07-10 Bag of Holding
11-12 Boots of Elvenkind
13-14 Boots of Striding and Springing
15-16 Boots of the Winterlands
17-18 Broom of Flying
19-20 Cap of Water Breathing
21-22 Cloak of Elvenkind
23-24 Cloak of Protection
25-26 Cloak of the Manta Ray
27 Decanter of Endless Water
28-30 Driftglobe
31-32 Dust of Disappearance
33-34 Dust of Dryness
35-36 Dust of Sneezing and Choking
37-38 Enspelled Weapon (cantrip or level 1 spell)
39-40 Eyes of Minute Seeing
41-42 Eyes of the Eagle
43-44 Gloves of Missile Snaring
45-46 Gloves of Swimming and Climbing
47-48 Gloves of Thievery
49-50 Goggles of Night
51 Hag Eye
52-54 Helm of Comprehending Languages
55 Immovable Rod
56-57 Instrument of the Bards (Doss lute, Fochlucan bandore, or Mac-Fuirmidh cittern)
58-59 Lantern of Revealing
60-61 Nature's Mantle
62-63 Oil of Slipperiness
64-65 Pipes of Haunting
66-67 Pipes of the Sewers
68-71 Potion of Growth
72-80 Potion of Healing (greater)
81-84 Potion of Water Breathing
85-86 Quaal's Feather Token (anchor, fan, or tree)
87-88 Ring of Jumping
89-90 Ring of Swimming
91-92 Ring of Warmth
93-94 Robe of Useful Items
95-96 Rope of Climbing
97-98 Stone of Good Luck
99-00 Wand of Secrets
`,
  rare: `
01-04 Ammunition, +2
05-08 Bag of Beans
09-12 Belt of Dwarvenkind
13-16 Boots of Levitation
17-20 Boots of Speed
21-24 Chime of Opening
25-28 Dimensional Shackles
29-32 Enspelled Weapon (level 2 or 3 spell)
33-36 Folding Boat
37-40 Glamoured Studded Leather
41-44 Heward's Handy Haversack
45-48 Horseshoes of Speed
49-52 Instrument of the Bards (Canaith mandolin or Cli lyre)
53-56 Ioun Stone (awareness)
57-60 Portable Hole
61-64 Potion of Diminution
65-68 Potion of Gaseous Form
69-76 Potion of Healing (superior)
77-80 Quaal's Feather Token (bird, swan boat, or whip)
81-84 Ring of Evasion
85-88 Ring of Free Action
89-92 Rope of Entanglement
93-96 Staff of Healing
97-00 Wand of Enemy Detection
`,
  veryRare: `
01-07 Ammunition, +3
08-14 Bag of Devouring
15-21 Carpet of Flying
22-28 Enspelled Weapon (level 4 or 5 spell)
29-35 Horseshoes of a Zephyr
36-42 Instrument of the Bards (Anstruth harp)
43-49 Ioun Stone (agility)
50-56 Lute of Thunderous Thumping
57-63 Manual of Quickness of Action
64-70 Nolzur's Marvelous Pigments
71-77 Potion of Flying
78-86 Potion of Healing (supreme)
87-93 Potion of Speed
94-00 Tome of Leadership and Influence
`,
  legendary: `
01-17 Enspelled Weapon (level 6, 7, or 8 spell)
18-34 Instrument of the Bards (Ollamh harp)
35-54 Sovereign Glue
55-70 Sphere of Annihilation
71-83 Talisman of the Sphere
84-00 Universal Solvent
`,
} as const;

