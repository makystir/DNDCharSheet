/**
 * NPC detail tables (Dungeon Master's Guide 2024, chapter 3, printed pages
 * 86-88). Each line is "<range> <entry>" with two-digit numbers, following
 * the random-magic-items convention. Read from the page images;
 * dmg-group-b-tables.test.ts checks full die coverage.
 */

/** DMG 2024 p.86, NPC Appearance (d12; the printed column header is "Feature"). */
export const NPC_APPEARANCE_RAW = `
01 Distinctive jewelry
02 Flamboyant, outlandish, formal, or ragged clothes
03 Uses an elegant mobility device (wheelchair, brace, or cane)
04 Pronounced scar
05 Unusual eye color (or two different colors)
06 Tattoos or piercings
07 Birthmark
08 Unusual hair color
09 Bald, or braided beard or hair
10 Distinctive nose (large, bulbous, angular, small)
11 Distinctive posture (stooped or rigid)
12 Exceptionally beautiful or ugly
`;

/** DMG 2024 p.88, NPC Secrets (d10). */
export const NPC_SECRETS_RAW = `
01 The NPC is in disguise, concealing their identity or some aspect of their appearance.
02 The NPC is currently planning, executing, or covering up a crime.
03 The NPC (or their family) has been threatened with harm unless the NPC does something.
04 The NPC is under a magical compulsion (perhaps a Geas spell or some kind of curse) to behave in a certain way.
05 The NPC is seriously ill or in terrible pain.
06 The NPC feels responsible for someone's death or ill fortune.
07 The NPC is on the brink of financial ruin.
08 The NPC is desperately lonely or harboring an unrequited passion.
09 The NPC nurses a powerful ambition.
10 The NPC is deeply dissatisfied or unhappy.
`;
