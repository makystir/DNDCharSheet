/**
 * Tavern Names and Random Shops (Dungeon Master's Guide 2024, chapter 3,
 * printed page 94). Each line is "<range> <entry>" with two-digit numbers,
 * following the random-magic-items convention. Read from the page image;
 * dmg-tavern-shop.test.ts checks full d20 coverage.
 */

/** DMG 2024 p.94, Tavern Names: First Part (d20). Rolled separately from the second part. */
export const TAVERN_FIRST_PART_RAW = `
01 The Golden
02 The Silver
03 The Beardless
04 The Laughing
05 The Dancing
06 The Gilded
07 The Stumbling
08 The Wolf and
09 The Fallen
10 The Leering
11 The Drunken
12 The Wine and
13 The Roaring
14 The Frowning
15 The Barrel and
16 The Thirsty
17 The Wandering
18 The Barking
19 The Happy
20 The Witch and
`;

/** DMG 2024 p.94, Tavern Names: Second Part (d20). */
export const TAVERN_SECOND_PART_RAW = `
01 Lyre
02 Dolphin
03 Dwarf
04 Pegasus
05 Hut
06 Rose
07 Stag
08 Duck
09 Lamb
10 Demon
11 Goat
12 Spirit
13 Horde
14 Jester
15 Bucket
16 Crow
17 Satyr
18 Dog
19 Spider
20 Dragon
`;

/** DMG 2024 p.94, Random Shops: Type (d20; printed as two side-by-side columns, 1-10 and 11-20). */
export const RANDOM_SHOPS_RAW = `
01 Pawnshop
02 Apothecary
03 Grocer
04 Delicatessen
05 Potter
06 Undertaker
07 Bookstore
08 Moneylender
09 Armorer
10 Chandler
11 Smithy
12 Carpenter
13 Weaver
14 Jeweler
15 Baker
16 Mapmaker
17 Tailor
18 Ropemaker
19 Mason
20 Scribe
`;
