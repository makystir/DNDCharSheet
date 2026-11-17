/**
 * Random Magic Items, Armaments tables (Dungeon Master's Guide 2024, printed pages
 * 328-329). Each line is "<d100 range> <item>", with 00 meaning 100. Read from
 * the page images; random-magic-items.test.ts checks that every table covers
 * 01-00 exactly once.
 */
export const ARMAMENTS_RAW = {
  common: `
01-10 Armor of Gleaming
11-20 Cast-Off Armor
21-30 Dread Helm
31-40 Moon-Touched Sword
41-50 Shield of Expression
51-60 Silvered Weapon
61-70 Smoldering Armor
71-80 Sylvan Talon
81-90 Veteran's Cane
91-00 Walloping Ammunition
`,
  uncommon: `
01-04 Adamantine Armor
05-08 Adamantine Weapon
09-13 Ammunition, +1
14-18 Bracers of Archery
19-23 Enspelled Armor (cantrip or level 1 spell)
24-28 Enspelled Weapon (cantrip or level 1 spell)
29-33 Gauntlets of Ogre Power
34-38 Javelin of Lightning
39-43 Mariner's Armor
44-48 Mithral Armor
49-53 Potion of Giant Strength (hill)
54-58 Potion of Pugilism
59-62 Quiver of Ehlonna
63-66 Saddle of the Cavalier
67-71 Sentinel Shield
72-76 Shield, +1
77-81 Sword of Vengeance
82-85 Trident of Fish Command
86-90 Weapon, +1
91-95 Weapon of Warning
96-00 Wraps of Unarmed Power, +1
`,
  rare: `
01-03 Ammunition, +2
04-07 Armor, +1
08-10 Armor of Resistance
11-13 Armor of Vulnerability
14-15 Arrow-Catching Shield
16-18 Belt of Giant Strength (hill)
19-20 Berserker Axe
21-22 Daern's Instant Fortress
23-25 Dagger of Venom
26-28 Dragon Slayer
29-31 Elven Chain
32-34 Enspelled Armor (level 2 or 3 spell)
35-37 Enspelled Weapon (level 2 or 3 spell)
38-40 Flame Tongue
41-43 Giant Slayer
44-46 Horn of Blasting
47-48 Horn of Valhalla (brass or silver)
49-51 Ioun Stone (protection)
52-54 Mace of Disruption
55-57 Mace of Smiting
58-60 Mace of Terror
61-63 Potion of Giant Strength (fire)
64-66 Potion of Giant Strength (frost or stone)
67-69 Potion of Heroism
70-72 Potion of Invulnerability
73-75 Ring of Protection
76-78 Ring of the Ram
79-81 Shield, +2
82-84 Shield of Missile Attraction
85-86 Sun Blade
87-88 Sword of Life Stealing
89-90 Sword of Wounding
91-92 Tentacle Rod
93-94 Vicious Weapon
95-97 Weapon, +2
98-00 Wraps of Unarmed Power, +2
`,
  veryRare: `
01-03 Ammunition, +3
04-06 Ammunition of Slaying
07-09 Animated Shield
10-12 Armor, +2
13-14 Belt of Giant Strength (fire)
15-17 Belt of Giant Strength (frost or stone)
18-19 Dancing Sword
20-22 Demon Armor
23-25 Dragon Scale Mail
26-28 Dwarven Plate
29-31 Dwarven Thrower
32-34 Energy Bow
35-37 Enspelled Armor (level 4 or 5 spell)
38-40 Enspelled Weapon (level 4 or 5 spell)
41-43 Executioner's Axe
44-46 Frost Brand
47-49 Horn of Valhalla (bronze)
50-52 Ioun Stone (strength)
53-55 Lute of Thunderous Thumping
56-58 Manual of Gainful Exercise
59-61 Nine Lives Stealer
62-64 Oathbow
65-68 Oil of Sharpness
69-72 Potion of Giant Strength (cloud)
73-75 Quarterstaff of the Acrobat
76-78 Scimitar of Speed
79-82 Shield, +3
83-85 Shield of the Cavalier
86-88 Spellguard Shield
89-91 Sword of Sharpness
92-94 Thunderous Greatclub
95-97 Weapon, +3
98-00 Wraps of Unarmed Power, +3
`,
  legendary: `
01-06 Armor, +3
07-12 Armor of Invulnerability
13-18 Belt of Giant Strength (cloud)
19-21 Belt of Giant Strength (storm)
22-27 Defender
28-33 Efreeti Chain
34-39 Enspelled Armor (level 6, 7, or 8 spell)
40-45 Enspelled Weapon (level 6, 7, or 8 spell)
46-51 Hammer of Thunderbolts
52-56 Holy Avenger
57-62 Horn of Valhalla (iron)
63-68 Luck Blade
69-72 Moonblade
73-78 Plate Armor of Etherealness
79-87 Potion of Giant Strength (storm)
88-90 Rod of Lordly Might
91-95 Sword of Answering
96-00 Vorpal Sword
`,
} as const;

