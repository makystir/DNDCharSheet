/**
 * Monster behavior tables (Dungeon Master's Guide 2024, chapter 4, printed page
 * 117). Each line is "<range> <entry>" with two-digit numbers, following the
 * random-magic-items convention. Read from the page image;
 * dmg-group-b-tables.test.ts checks full die coverage.
 */

/** DMG 2024 p.117, Monster Personality (d8). */
export const MONSTER_PERSONALITY_RAW = `
01 Cowardly; surrenders easily
02 Greedy; wants treasure
03 Boastful; makes a show of bravery but runs from danger
04 Disorderly; poorly trained and easily rattled
05 Fanatical; ready to die fighting
06 Brave; stands firm against danger
07 Jocular; taunts enemies
08 Orderly; difficult to rattle
`;

/** DMG 2024 p.117, Monster Relationships (d6). */
export const MONSTER_RELATIONSHIPS_RAW = `
01 Two monsters have a bitter rivalry; each wants the other to suffer.
02 One monster, bullied by the others, hangs back and flees at the first opportunity.
03 One monster is revered or even worshiped by the others, who will die for it.
04 One monster is admired by the group; its allies try to impress or help it.
05 One monster cares only for itself and not the rest of the group.
06 One monster bullies the others; it forces them into danger, but they want it defeated.
`;
