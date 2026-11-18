/**
 * Settlement tables (Dungeon Master's Guide 2024, chapter 3, printed pages
 * 93-94). Each line is "<range> <entry>" with two-digit numbers, following the
 * random-magic-items convention. Read from the page images;
 * dmg-settlement.test.ts checks that every table covers 1..die exactly once.
 */

/** DMG 2024 p.93, Defining Traits (d20; two results share most rows). */
export const SETTLEMENT_DEFINING_TRAITS_RAW = `
01-02 Fortified outer wall
03-04 Lots of gardens, parks, and greenery
05-06 Lots of mud, filth, and litter
07-08 Sprawling cemetery
09-10 Lingering fog
11-12 Noise and smoke from smithies and forges
13 Canals and bridges
14 Cliffs on one or more sides
15-16 Clean streets and well-maintained buildings
17-18 Ancient ruins within the settlement
19-20 Impressive structure (such as a keep, temple, circle of standing stones, or ziggurat)
`;

/** DMG 2024 p.94, Claims to Fame (d20). */
export const SETTLEMENT_CLAIMS_TO_FAME_RAW = `
01 Delicious food
02 Rude people
03 Friendly folk
04 Artists or writers
05 Great hero/savior
06 Flowers
07 Seasonal festival
08 Hauntings
09 Spellcasters
10 Decadence
11 Piety
12 Gambling
13 Godlessness
14 Education
15 Wines
16 High fashion
17 Political intrigue
18 Powerful guilds
19 Patriotism
20 Ancient ruins
`;

/** DMG 2024 p.94, Current Calamities (d12). */
export const SETTLEMENT_CALAMITIES_RAW = `
01 Monsters infest the settlement.
02 A key figure died; murder is suspected.
03 War brews between rival guilds or gangs.
04 A plague or famine sparks riots.
05 Monsters attack anyone who approaches or leaves the settlement.
06 Trade disputes cause economic hardship.
07 A natural disaster threatens the settlement.
08 A prophecy of doom has residents on edge.
09 Locals are being drafted to fight in a war.
10 Political or religious strife threatens violence.
11 The settlement is under siege.
12 Scandal threatens powerful local families.
`;

/** DMG 2024 p.94, Local Leaders (d12). */
export const SETTLEMENT_LEADERS_RAW = `
01 Respected, fair, and just leader or council
02 Feared tyrant
03 Coward manipulated by others
04 Illegitimate leader causing civil unrest
05 Powerful monster
06 Mysterious, anonymous conspirators
07 Contested leadership (with open fighting)
08 Acrimonious council unable to make decisions
09 Doltish lout
10 Dying leader (with disputed succession)
11 Iron-willed and respected leader or council
12 Religious leader or council
`;

/** DMG 2024 p.93, Settlements by Size. Size is chosen, not rolled. */
export const SETTLEMENT_SIZES = [
  { size: 'Village', population: 'Up to 500', maxGp: 20 },
  { size: 'Town', population: '501-5,000', maxGp: 2000 },
  { size: 'City', population: '5,001 and higher', maxGp: 200000 },
] as const;
