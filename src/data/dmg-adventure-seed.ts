/**
 * Adventure seed tables (Dungeon Master's Guide 2024, chapter 4, printed pages
 * 107-108 Adventure Situations, 111 Hooks, 120 Adventure Climax). Each line is
 * "<range> <entry>" with two-digit numbers, following the random-magic-items
 * convention. Read from the page images; dmg-adventure-seed.test.ts checks that
 * every table covers 1..die exactly once. Line breaks and hyphenation in the
 * printed columns are joined.
 */

/** DMG 2024 p.107, Levels 1-4 Adventure Situations (d20). */
export const SITUATIONS_L1_4_RAW = `
01 A dragon wyrmling has gathered a band of kobolds to help it amass a hoard.
02 Wererats living in a city's sewers plot to take control of the governing council.
03 Bandit activity signals efforts to revive an evil cult long ago driven from the region.
04 A pack of gnolls is rampaging dangerously close to local farmlands.
05 A rivalry between two merchant families escalates from mischief to mayhem.
06 A new sinkhole has revealed a long-buried dungeon thought to hold treasure.
07 Miners discovered an underground ruin and were captured by monsters living there.
08 An innocent person is being framed for the crimes of a shape-shifting monster.
09 Ghouls are venturing out of the catacombs at night.
10 A notorious criminal hides from the law in an old ruin or abandoned mine.
11 A contagion in a forest is causing spiders to grow massive and become aggressive.
12 To take revenge against a village for an imagined slight, a necromancer has been animating the corpses in the village cemetery.
13 An evil cult is spreading in a village. Those who oppose the cult are marked for sacrifice.
14 An abandoned house on the edge of town is haunted by Undead because of a cursed item in the house.
15 Creatures from the Feywild enter the world and cause mischief and misfortune among villagers and their livestock.
16 A hag's curse is making animals unusually aggressive.
17 Bullies have appointed themselves the village militia and are extorting money and food from villagers.
18 After a local fisher pulls a grotesque statue from the sea, aquatic monsters start attacking the waterfront at night.
19 The ruins on the hill near the village lie under a curse, so people don't go there\u2014except a scholar who wants to study the ruins.
20 A new captain has taken charge of a band of pirates or bandits and started raiding more frequently.
`;

/** DMG 2024 p.107, Levels 5-10 Adventure Situations (d20). */
export const SITUATIONS_L5_10_RAW = `
01 A group of cultists has summoned a demon to wreak havoc in the city.
02 A rebel lures monsters to the cause with the promise of looting the king's treasury.
03 An evil Artifact has transformed a forest into a dismal swamp full of horrific monsters.
04 An Aberration living in the Underdark sends minions to capture people from the surface to turn those people into new minions.
05 A monster (perhaps a devil, slaad, or hag) is impersonating a prominent noble to throw the realm into civil war.
06 A master thief plans to steal royal regalia.
07 A golem intended to serve as a protector has gone berserk and captured its creator.
08 A conspiracy of spies, assassins, and necromancers schemes to overthrow a ruler.
09 After establishing a lair, a young dragon is trying to earn the fear and respect of other creatures living nearby.
10 The approach of a lone giant alarms the people of a town, but the giant is simply looking for a place to live in peace.
11 An enormous monster on display in a menagerie breaks free and goes on a rampage.
12 A coven of hags steals cherished memories from travelers.
13 A villain seeks powerful magic in an ancient ruin, hoping to use it to conquer the region.
14 A scheming aristocrat hosts a masquerade ball, which many guests see as an opportunity to advance their own agendas. At least one shape-shifting monster also attends.
15 A ship carrying a valuable treasure or an evil Artifact sinks in a storm or monster attack.
16 A natural disaster was actually caused by magic gone awry or a cult's villainous plans.
17 A secretive cult uses spies to heighten tensions between two rival nations, hoping to provoke a war that will weaken both.
18 Rebels or forces of an enemy nation have kidnapped an important noble.
19 The descendants of a displaced people want to reclaim their ancestral city, which is now inhabited by monsters.
20 A renowned group of adventurers never returned from an expedition to a famous ruin.
`;

/** DMG 2024 p.108, Levels 11-16 Adventure Situations (d12). */
export const SITUATIONS_L11_16_RAW = `
01 A portal to the Abyss opens in a cursed location and spews demons into the world.
02 A band of hunting giants has driven its prey\u2014enormous beasts\u2014into pastureland.
03 An adult dragon's lair is transforming an expanse into an environment inhospitable to the other creatures living there.
04 A long-lost journal describes an incredible journey to a hidden subterranean realm full of magical wonders.
05 Cultists hope to persuade a dragon to undergo the rite that will transform it into a dracolich.
06 The ruler of the realm is sending an emissary to a hostile neighbor to negotiate a truce, and the emissary needs protection.
07 A castle or city has been drawn into another plane of existence.
08 A storm tears across the land, with a mysterious flying citadel in the eye of the storm.
09 Two parts of a magic item are in the hands of bitter enemies; the third piece is lost.
10 Evil cultists gather from around the world to summon a monstrous god or alien entity.
11 A tyrannical ruler outlaws the use of magic without official sanction. A secret society of spellcasters seeks to oust the tyrant.
12 During a drought, low water levels in a lake reveal previously unknown ancient ruins that contain a powerful evil.
`;

/** DMG 2024 p.108, Levels 17-20 Adventure Situations (d10). */
export const SITUATIONS_L17_20_RAW = `
01 An ancient dragon is scheming to destroy a god and take the god's place in the pantheon. The dragon's minions are searching for Artifacts that can summon and weaken this god.
02 A band of giants drove away a metallic dragon and took over the dragon's lair, and the dragon wants to reclaim the lair.
03 An ancient hero returns from the dead to prepare the world for the return of an equally ancient monster.
04 An ancient Artifact has the power to defeat or imprison a rampaging titan.
05 A god of agriculture is angry, causing rivers to dry up and crops to wither.
06 An Artifact belonging to a god falls into mortal hands.
07 A titan imprisoned in the Underdark begins to break free, causing terrible earthquakes that are only a hint of the destruction that the titan will cause if it is released.
08 A lich tries to exterminate any spellcasters that approach the lich's level of power.
09 A holy temple was built around a portal leading to one of the Lower Planes to prevent any evil from passing through in either direction. Now the temple has come under siege from both directions.
10 Five ancient metallic dragons lair in the Pillars of Creation. If all these dragons are killed, the world will collapse into chaos. One has just been slain.
`;

/** DMG 2024 p.111, Patron Hooks (d6). */
export const PATRON_HOOKS_RAW = `
01 A town crier announces that someone is hoping to hire adventurers.
02 Someone the characters want to impress or need a favor from asks them to deal with the adventure situation.
03 When the characters arrive in a new city, they find a job board where someone has posted in search of adventurers.
04 A wealthy patron who is aware of the adventurers' accomplishments writes to them, offering to pay them for their talents.
05 A citizen in need, who has learned of the adventurers' accomplishments and kindness, travels miles to find them and implore them for help.
06 The adventurers are arrested (on valid or invented charges) and offered a chance to escape punishment by completing a quest.
`;

/** DMG 2024 p.111, Supernatural Hooks (d6). */
export const SUPERNATURAL_HOOKS_RAW = `
01 The characters all have a vivid dream that foreshadows elements of the adventure.
02 While preparing spells, one character receives a quest from a god or patron.
03 A fortune teller's reading for one of the characters points to a quest and offers hints about challenges that lie ahead.
04 Flames, clouds, smoke, or huge flocks of birds take distinct shapes that portend the adventure situation.
05 Animals or animated objects speak clearly to direct the adventurers toward the situation.
06 Someone who died returns as a ghost and haunts the characters. The ghost prompts the characters to investigate the cause of the ghost's death and put it to rest.
`;

/** DMG 2024 p.111, Happenstance Hooks (d6). */
export const HAPPENSTANCE_HOOKS_RAW = `
01 The characters find a letter describing the adventure situation.
02 The characters are on an unrelated quest, such as searching for a particular magic item, that leads them into the adventure situation.
03 The adventure situation disrupts a festival or ceremony that the characters are attending.
04 A magical mishap places the characters in the adventure situation.
05 While traveling in a caravan or aboard a ship, the characters befriend an NPC who has news about the adventure situation.
06 The characters are attacked after being mistaken for another group of adventurers. They learn about the adventure situation from a clue left behind by their attackers.
`;

/** DMG 2024 p.120, Adventure Climax (d10). */
export const ADVENTURE_CLIMAX_RAW = `
01 The adventurers confront a villain and a group of minions in a battle to the finish.
02 The adventurers chase a villain while dodging obstacles designed to thwart them, leading to a final confrontation in the villain's refuge.
03 The actions of the adventurers or a villain result in a cataclysmic event that the adventurers must escape.
04 The adventurers race to the site where a villain is bringing a master plan to its conclusion, arriving just as that plan is about to be completed.
05 A villain and two or three lieutenants perform separate rites in a large room. The adventurers must disrupt all the rites.
06 An ally betrays the adventurers as they're about to achieve their goal. (Use this climax carefully, and don't overuse it.)
07 A portal opens to another plane of existence. Creatures on the other side spill out, forcing the adventurers to close the portal while dealing with a villain at the same time.
08 The dungeon begins to collapse while a villain attempts to escape in the chaos.
09 The adventurers must choose whether to pursue a fleeing villain or save an NPC they care about or a group of innocents.
10 Just when the characters think the main threat is defeated, it transforms into a different monster or a more powerful form.
`;
