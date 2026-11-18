/**
 * Dungeon tables (Dungeon Master's Guide 2024, chapter 3, printed pages 65-67).
 * Each line is "<range> <entry>" with two-digit numbers (00 = 100), following
 * the random-magic-items convention. Read from the page images;
 * dmg-group-b-tables.test.ts checks full die coverage.
 */

/** DMG 2024 p.65, Dungeon Quirks (d100). */
export const DUNGEON_QUIRKS_RAW = `
01-02 Abandoned after internal strife devastated its population
03-04 Abandoned because the site was cursed by a god or other powerful entity
05-06 Abandoned by its original creators when a plague spread through the dungeon
07-09 Amazingly well preserved ancient city inside a dome encased in volcanic ash, submerged underwater, or entombed in desert sands
10-12 Built as a fortress guarding a mountain pass
13-15 Built as a maze, either to protect treasure from intruders or as a gauntlet where prisoners were hunted by monsters
16-18 Built as a stronghold but abandoned after it fell to invaders
19-21 Built as a treasure vault to protect powerful magic items and great wealth
22-23 Built atop a cloud
24-26 Built beneath a city in catacombs or sewers
27-29 Built beneath or on top of a mesa or several connected mesas
30-32 Built by a religious group to serve as a temple and linked to the energy of other planes of existence
33-35 Built by dwarves and decorated with enormous dwarven faces that have been defaced by its current inhabitants
36-38 Built in a volcano
39-40 Built in or among the branches of a tree
41-43 Built to house a planar portal but abandoned when creatures or energy from the other side of the portal seeped into the dungeon
44-46 Carved into a meteorite (before or after it fell to earth)
47-49 Carved into a sheer cliff face
50-52 Caverns carved by a beholder's disintegration eye ray, with unnaturally smooth walls and vertical shafts connecting different levels
53-55 Contains something that led to the downfall of its creators or inhabitants
56-58 Dug as a burrow by a monster that might still live inside
59-61 Entrance concealed behind a waterfall
62-64 Floating on the sea
65-66 Intended as a death trap to eliminate any creature that enters, perhaps to guard a treasure or to harvest souls for a necromantic rite
67-69 Intended as a tomb
70-72 Long known as the site of a great miracle or another auspicious event
73-75 Made by amphibious creatures (such as kuo-toa or aboleths), using water to protect the innermost reaches from air-breathing intruders
76-78 Made by a powerful spellcaster (perhaps a lich) as a site for magical research and experimentation
79-81 Made by giants at a vast scale
82-84 Natural caverns featuring a range of strikingly beautiful rock and crystal formations
85-87 On an island in an underground sea
88-90 On the back of a Gargantuan creature
91-93 Originally constructed as a mine but abandoned when tunnels connected to dangerous Underdark tunnels
94-96 Secreted away in a demiplane or in a pocket dimension
97-98 Slowly abandoned as its creators died out or migrated away
99-00 Transformed by multiple events or disasters over the course of centuries
`;

/** DMG 2024 p.67, States of Ruin (d6; the printed column header is "Features"). */
export const STATES_OF_RUIN_RAW = `
01 Perilous. The area is dangerously worn and prone to collapse. Any impacts or damage to the structure, including from spells and other areas of effect, have a 50 percent chance of causing a collapse.
02 Crumbling. Areas within the dungeon section are choked with rubble and have a 50 percent chance of being Difficult Terrain. Half Cover and hiding places are plentiful.
03 Neglected. One dungeon hazard (such as brown mold, green slime, or yellow mold; see "Hazards" in this chapter) is abundant.
04 Abandoned. Most of the dungeon is deserted. Dexterity (Stealth) checks have Disadvantage because any sounds stand out as unusual.
05 Secure. Ability checks made to break down doors, open locks, or carry out similar activities have Disadvantage.
06 Thriving. The dungeon is heavily populated. Any loud noises draw the attention of nearby creatures.
`;
