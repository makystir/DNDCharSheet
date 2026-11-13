/**
 * Species-flavoured prompts for the character description generator (flavor
 * only, no mechanic; written for this app). Each PHB 2024 species gets
 * heritage sentences (how the character's people shaped them), formative
 * pasts, mannerisms and goals; species with a lineage or ancestry choice
 * (Dragonborn, Elf, Gnome, Goliath, Tiefling) also get lines for each one.
 * Same tokens as description-class-tables.ts ({N}, {their}, {Their}, {them},
 * {themself}); never a subject pronoun before a verb.
 */

export type DescriptionSpeciesId =
  | "aasimar"
  | "dragonborn"
  | "dwarf"
  | "elf"
  | "gnome"
  | "goliath"
  | "halfling"
  | "human"
  | "orc"
  | "tiefling";

export interface SpeciesDescriptionTables {
  /** How the character's people and heritage show in them. */
  heritages: readonly string[];
  /** Formative events tied to the species. */
  pasts: readonly string[];
  manners: readonly string[];
  shortTermGoals: readonly string[];
  longTermGoals: readonly string[];
  /** Lines for each lineage / ancestry id (the species sub-choice). */
  lineages?: Record<string, readonly string[]>;
}

export const SPECIES_DESCRIPTION_TABLES: Record<DescriptionSpeciesId, SpeciesDescriptionTables> = {
  aasimar: {
    heritages: [
      "A faint radiance clings to {them}, a reminder of the celestial spark in {their} blood.",
      "{N} still dreams of the angelic guide who first spoke to {them} as a child.",
      "Strangers sometimes feel calmer near {them} without knowing why.",
      "{N} has spent years wondering what the heavens expect of an aasimar like {them}.",
      "{Their} eyes catch the light a moment longer than anyone else's.",
      "A celestial heritage is a gift {N} has learned to carry quietly.",
      "{N} hides the glow of {their} heritage in crowds and lets it shine in dark places.",
      "Some days the celestial blood feels like a calling; on others, like a burden.",
      "{N} was raised by parents who never quite knew what to make of their luminous child.",
      "Temples have tried to claim {them} as a living sign more than once.",
    ],
    pasts: [
      "{Their} celestial guide went silent one night, and {N} has been searching for a reason ever since.",
      "A crowd once mistook {them} for a saint and would not let {them} leave.",
      "{N} first manifested {their} radiance while shielding a younger sibling from harm.",
      "A fiend once recognized the light in {them} and swore to snuff it out.",
      "{N} spent a childhood being told to keep {their} glow hidden from the neighbors.",
    ],
    manners: [
      "When {N} is moved, a soft light gathers at {their} fingertips.",
      "{N} speaks with a gentle certainty that people find hard to argue with.",
      "{Their} voice carries a faint resonance, like a bell heard from far away.",
      "{N} has a habit of looking up at the sky before making a decision.",
      "{N} is unnervingly calm in the face of death.",
    ],
    shortTermGoals: [
      "Hear from {their} silent celestial guide again.",
      "Find another aasimar who understands what {N} has been through.",
      "Learn what the strange halo dream keeps trying to show {them}.",
      "Prove to a doubtful temple that {their} radiance is a blessing, not a trick.",
    ],
    longTermGoals: [
      "Discover the celestial being whose blood runs in {their} veins.",
      "Fulfil the purpose {their} guide hinted at but never explained.",
      "Become a beacon that others can follow through dark times.",
      "Stand against the fiend who swore to put out {their} light.",
      "Find a place where {N} can simply be a person, not a sign.",
    ],
  },
  dragonborn: {
    heritages: [
      "{N} carries {their} draconic ancestry with fierce, scaled pride.",
      "Clan honor matters to {them} as much as personal glory.",
      "{N} was raised on stories of a draconic forebear whose deeds still echo.",
      "The breath of {their} ancestors is a gift {N} treats with respect.",
      "{N} believes every dragonborn must earn {their} place in the clan's history.",
      "Scales, horns and a rumbling voice make {them} hard to overlook, and {N} has stopped trying to be.",
      "{N} measures {themself} against the legends of {their} clan and always finds room to grow.",
      "{N} was taught that a dragonborn without a clan is a story without an ending.",
      "Other people see a dragon when they look at {them}; {N} sees a family name to uphold.",
      "{N} keeps the old draconic tongue alive, even when nobody else understands it.",
    ],
    pasts: [
      "{Their} clan cast {them} out after a failure that still stings.",
      "{N} once met a true dragon and walked away with {their} life and a story.",
      "A rival clan shamed {their} family name, and {N} has sworn to restore it.",
      "{N} was the first in {their} family to leave the clan lands in three generations.",
      "{N} breathed {their} first gout of draconic power during a desperate fight and has never forgotten the taste of it.",
    ],
    manners: [
      "A low rumble rises in {their} chest when {N} is annoyed.",
      "{N} bares {their} teeth when smiling, which strangers rarely find reassuring.",
      "{Their} scales catch the firelight in a way that makes children stare.",
      "{N} speaks formally, as if every word were a vow.",
      "{N} touches {their} chest in a clan salute when greeting elders.",
    ],
    shortTermGoals: [
      "Win back the respect of {their} clan elders.",
      "Find the lair of the dragon {their} clan descends from.",
      "Settle an old insult against {their} family's name.",
      "Recover a clan heirloom lost in a raid.",
    ],
    longTermGoals: [
      "Found a new clan that welcomes the outcast and the lost.",
      "Earn a deed great enough to be carved into the clan's history.",
      "Reunite the scattered dragonborn of {their} bloodline.",
      "Face a dragon of {their} own ancestry as an equal.",
      "Restore the honor of {their} family name for generations to come.",
    ],
    lineages: {
      black: [
        "{N} has the black dragon's patience for waiting in the dark, and its sharp tongue.",
        "Like the black dragons of the swamps, {N} has learned that silence can be a weapon.",
      ],
      blue: [
        "The blue dragon's love of order and lightning-quick temper both run in {them}.",
        "{N} carries the blue dragon's pride, crackling just beneath the surface.",
      ],
      brass: [
        "{N} has the brass dragon's love of conversation and can talk until the sun goes down.",
        "Like the brass dragons of the desert, {N} is curious about every traveller.",
      ],
      bronze: [
        "{N} shares the bronze dragon's sense of duty and its fondness for the sea.",
        "The bronze dragon's call to protect the weak echoes strongly in {them}.",
      ],
      copper: [
        "{N} has the copper dragon's sense of humor and its love of a clever prank.",
        "Like the copper dragons, {N} loves a riddle more than a fight.",
      ],
      gold: [
        "{N} carries the gold dragon's wisdom and quiet authority.",
        "The gold dragon's sense of justice burns bright in {them}.",
      ],
      green: [
        "{N} has the green dragon's gift for scheming and courtly deception.",
        "Like the green dragons of the deep woods, {N} rarely says what {N} truly means.",
      ],
      red: [
        "{N} has the red dragon's burning ambition and its hoarder's eye.",
        "The red dragon's fury smoulders in {them}, waiting for a spark.",
      ],
      silver: [
        "{N} shares the silver dragon's fondness for people and their stories.",
        "The silver dragon's kindness and courage shine through {them}.",
      ],
      white: [
        "{N} carries the white dragon's hunter's instinct and its endurance of cold.",
        "Like the white dragons of the frozen north, {N} remembers every slight.",
      ],
    },
  },
  dwarf: {
    heritages: [
      "{N} judges a person the way a dwarf judges stone: by what holds up under pressure.",
      "A dwarf's memory is long, and {their} grudges are longer.",
      "{N} grew up among the deep halls, where every carving tells a family story.",
      "Clan, craft and honor are the three pillars {N} was raised on.",
      "{N} feels most at home with solid rock overhead.",
      "{N} was taught that a promise is carved in stone, never written in sand.",
      "{N} can tell good steel from bad by the ring it makes.",
      "The beard, the braids and the clan beads all tell a story, and {N} knows every chapter.",
      "{N} carries the stubbornness of the mountains and the warmth of a forge.",
      "{N} has never trusted anything that cannot survive a hammer blow.",
    ],
    pasts: [
      "{Their} clan hold fell to something from the deep, and {N} was among the last to leave.",
      "{N} apprenticed at the great forges and still bears the burns to prove it.",
      "A grudge recorded in {their} family's ledger has waited three generations for {N} to settle it.",
      "{N} once spent a month lost in the deep tunnels, guided only by the feel of the stone.",
      "{N} was the first in the clan to choose adventure over the family craft, and the arguments still echo.",
    ],
    manners: [
      "{N} taps the walls of every new place, listening to the stone.",
      "{N} strokes {their} beard or braids when deep in thought.",
      "{Their} laugh is a deep rumble that shakes the tankards.",
      "{N} grumbles about every meal and finishes every plate.",
      "{N} inspects the stonework of every building before entering.",
    ],
    shortTermGoals: [
      "Settle an entry in {their} clan's book of grudges.",
      "Recover an ancestral axe lost in a fallen hold.",
      "Find a vein of rare ore said to lie beneath a haunted mountain.",
      "Brew an ale worthy of {their} grandmother's recipe.",
    ],
    longTermGoals: [
      "Reclaim {their} clan's fallen hold from the darkness that took it.",
      "Forge a masterwork that will be spoken of for a thousand years.",
      "See every grudge in the family ledger settled, one way or another.",
      "Become an elder whose counsel the whole clan seeks.",
      "Carve {their} deeds into the great hall beside {their} ancestors.",
    ],
  },
  elf: {
    heritages: [
      "{N} has lived long enough to see empires rise and fade, and is unimpressed by most of them.",
      "The elven trance leaves {them} with memories that are not entirely {their} own.",
      "{N} moves through the world with the patience of someone who expects to live for centuries.",
      "Elven grace comes naturally to {them}; elven patience took longer.",
      "{N} remembers names, faces and slights for longer than most mortals live.",
      "{N} finds the short lives of other peoples both beautiful and heartbreaking.",
      "Music, starlight and old songs feel more real to {them} than any city.",
      "{N} was raised among elders who considered a century a short time.",
      "{N} tries not to grow too attached to short-lived friends, and always fails.",
      "{N} sees the world in long arcs, while everyone else rushes past.",
    ],
    pasts: [
      "{N} spent {their} first century barely leaving the forest, and the outside world still surprises {them}.",
      "{N} watched a beloved friend of another people grow old while {N} stayed young.",
      "An ancient elven feud between two houses still shapes who {N} trusts.",
      "During one long trance, {N} relived an ancestor's memory of a terrible battle.",
      "{N} left the elven lands in search of something {N} could not name.",
    ],
    manners: [
      "{N} pauses so long before answering that people wonder if {N} heard.",
      "{N} hums elven melodies older than most kingdoms.",
      "{Their} movements are so quiet that people jump when {N} speaks.",
      "{N} has a habit of gazing at the stars as if reading a map.",
      "{N} speaks of events from decades ago as though they happened last week.",
    ],
    shortTermGoals: [
      "Find a friend from {their} youth who left the elven lands long ago.",
      "Recover a song lost from {their} family's memory.",
      "See a human city change over a single season, just to understand it.",
      "Learn why {their} trance memories have started to show a stranger's face.",
    ],
    longTermGoals: [
      "Witness the rebirth of a fallen elven city.",
      "Leave a legacy that outlives even {their} long life.",
      "End an elven feud that has lasted for centuries.",
      "Learn to live fully among the short-lived peoples without fear of loss.",
      "Find the ancient grove where {their} line began.",
    ],
    lineages: {
      drow: [
        "As a drow, {N} grew up beneath the earth, where trust is a rare and costly thing.",
        "{N} carries the drow's sharp eyes and a wariness of anyone who smiles too easily.",
        "{N} left the cities of the Underdark behind, but the shadows still follow.",
      ],
      highElf: [
        "As a high elf, {N} was raised among libraries, towers and very long debates.",
        "{N} has a high elf's love of magic and a high elf's impatience with ignorance.",
        "Courtly manners from the high elven cities are hard for {them} to shake.",
      ],
      woodElf: [
        "As a wood elf, {N} grew up among the treetops and still prefers branches to beds.",
        "{N} has the wood elf's quick feet and a deep distrust of cities.",
        "The forest taught {them}, as a wood elf, to listen more than to speak.",
      ],
    },
  },
  gnome: {
    heritages: [
      "{N} approaches life with the boundless curiosity gnomes are famous for.",
      "Gnomish ingenuity means {N} always has a gadget, a plan and a backup plan.",
      "{N} finds wonder in small things that bigger folk walk straight past.",
      "Gnomes live long and laugh often, and {N} intends to do both.",
      "{N} has never met a problem that could not be solved with enough tinkering.",
      "{N} treats every day as an experiment with an unknown result.",
      "A gnome's sense of humor is a survival tool, and {N} keeps that tool sharp.",
      "{N} names every invention and mourns every one that explodes.",
      "{N} was raised in a burrow full of clocks, songs and arguments.",
      "Being small has taught {them} to think big.",
    ],
    pasts: [
      "{N} once built a device that worked perfectly, once, and has been trying to rebuild it ever since.",
      "{Their} family workshop burned down in an experiment nobody talks about.",
      "{N} spent a summer living with a family of badgers and learned their language, after a fashion.",
      "A prank {N} pulled as a youth became a village legend.",
      "{N} left the gnomish warrens to see what the big folk had been doing wrong.",
    ],
    manners: [
      "{N} talks very fast when excited and even faster when nervous.",
      "{N} carries a pocketful of springs, screws and odd little parts.",
      "{Their} eyes light up at the sight of any mechanism.",
      "{N} laughs at {their} own jokes before reaching the punchline.",
      "{N} tinkers with something small whenever {their} hands are idle.",
    ],
    shortTermGoals: [
      "Finish an invention that is only one part away from working.",
      "Find a rare gear said to come from an ancient clockwork city.",
      "Win a contest of inventors in a nearby city.",
      "Get a patent, or at least a witness, for {their} latest creation.",
    ],
    longTermGoals: [
      "Build a marvel the whole world will talk about.",
      "Found a workshop where any curious mind is welcome.",
      "Discover a secret of magic or engineering no one has found before.",
      "Write the definitive book of gnomish jokes.",
      "Live long enough to see every one of {their} inventions work at least once.",
    ],
    lineages: {
      forest: [
        "As a forest gnome, {N} grew up among woodland creatures and talks to them like old friends.",
        "{N} has a forest gnome's gift for illusions and a fondness for hiding in plain sight.",
        "The deep woods taught {them}, as a forest gnome, to love quiet mischief.",
      ],
      rock: [
        "As a rock gnome, {N} cannot resist taking apart anything with moving parts.",
        "{N} has a rock gnome's love of clockwork and carries a tiny device everywhere.",
        "The workshops of the rock gnomes taught {them} that every failure is a lesson.",
      ],
    },
  },
  goliath: {
    heritages: [
      "{N} carries the blood of giants and the competitive spirit of the high peaks.",
      "Every day is a contest to {them}, and the opponent is usually {their} own last best effort.",
      "{N} grew up where the air is thin and only the strong reach the summit.",
      "Goliath fairness runs deep in {them}: everyone deserves a chance, and no one gets a free win.",
      "{N} keeps careful track of {their} own deeds and is always trying to top them.",
      "Towering over most folk has taught {them} to be careful with doorways and gentle with children.",
      "{N} believes a life without challenge is a life wasted.",
      "{N} was raised on tales of {their} giant ancestors and wants to be worthy of them.",
      "{N} has a mountain dweller's respect for weather, rock and endurance.",
      "{N} sees every failure as one more step up the slope.",
    ],
    pasts: [
      "{N} once climbed a peak no goliath of {their} clan had ever conquered.",
      "{N} lost a great contest of strength and has trained every day since.",
      "{Their} tribe moved on while {N} was injured, and {N} had to find {their} own way down the mountain.",
      "{N} carried a wounded clanmate across a glacier and earned a place of honor for it.",
      "A giant once spoke to {them} as kin, and {N} has never forgotten it.",
    ],
    manners: [
      "{N} keeps score of everything: miles walked, foes faced, meals eaten.",
      "{N} ducks under every doorway out of long habit.",
      "{Their} handshake is careful, as if afraid of crushing fingers.",
      "{N} challenges friends to friendly contests at every chance.",
      "{N} stands very still, like a boulder on a slope, when listening.",
    ],
    shortTermGoals: [
      "Win a contest of strength against a famous champion.",
      "Climb a mountain no one in the region has summited.",
      "Beat {their} own record for the longest day's march.",
      "Find the giant who once spoke to {them} as kin.",
    ],
    longTermGoals: [
      "Prove {themself} worthy of {their} giant ancestors.",
      "Become the greatest champion {their} tribe has ever known.",
      "Find the ancient giant ruins where {their} bloodline began.",
      "Climb the tallest mountain in the world.",
      "Lead {their} tribe through the hardest winter of the age.",
    ],
    lineages: {
      cloud: [
        "{N}'s cloud giant ancestry shows in a dreamy gaze and a habit of vanishing mid-conversation.",
        "The cloud giants in {their} blood make {them} restless whenever the sky is clear.",
      ],
      fire: [
        "{N}'s fire giant ancestry gives {them} a smith's eye and a short fuse.",
        "The fire giants in {their} blood make {them} happiest beside a roaring forge.",
      ],
      frost: [
        "{N}'s frost giant ancestry leaves {them} at ease in snow that would freeze anyone else.",
        "The frost giants in {their} blood make {them} love a long, hard winter.",
      ],
      hill: [
        "{N}'s hill giant ancestry shows in a booming laugh and a bottomless appetite.",
        "The hill giants in {their} blood make {them} cheerful, stubborn and hard to knock down.",
      ],
      stone: [
        "{N}'s stone giant ancestry gives {them} a sculptor's patience and a quiet way of speaking.",
        "The stone giants in {their} blood make {them} feel most at peace among cliffs and caves.",
      ],
      storm: [
        "{N}'s storm giant ancestry makes {them} brood like thunderclouds before a squall.",
        "The storm giants in {their} blood make {them} feel truly alive in a storm.",
      ],
    },
  },
  halfling: {
    heritages: [
      "{N} believes there is no trouble a good meal and a warm hearth cannot soften.",
      "Halfling luck seems to follow {them} everywhere, and {N} is careful not to brag about it.",
      "{N} grew up in a close community where everyone knew everyone's business.",
      "Small in stature and large in heart, {N} has never let size decide anything.",
      "{N} has a halfling's knack for slipping through crowds unnoticed.",
      "Comfort matters to {them}, but so does a friend in need.",
      "{N} was raised on second breakfasts and long stories by the fire.",
      "Being underestimated is one of {their} favorite advantages.",
      "{N} has never met a stranger, only friends {N} has not fed yet.",
      "{N} carries the halfling belief that the world is mostly good, with some unfortunate exceptions.",
    ],
    pasts: [
      "{N} was the first halfling in {their} village to see the ocean, and has been wandering since.",
      "A lucky stumble once saved {their} life during a goblin raid.",
      "{Their} family's inn hosted adventurers every night, and {N} listened to every tale.",
      "{N} hid an entire family of refugees in a pantry during a war.",
      "{N} left home after a misunderstanding involving a pie contest and a very angry mayor.",
    ],
    manners: [
      "{N} always has a snack tucked away somewhere.",
      "{N} sits with {their} feet up whenever possible.",
      "{Their} cheerful whistling announces {their} arrival long before {N} appears.",
      "{N} offers advice on cooking whether anyone asks or not.",
      "{N} has a quick, nervous grin that disarms almost anyone.",
    ],
    shortTermGoals: [
      "Find the ingredients for a legendary family recipe.",
      "Send a letter home to reassure {their} worried relatives.",
      "Repay the farmer who hid {them} from bandits.",
      "Win back a lucky pipe lost in a game of riddles.",
    ],
    longTermGoals: [
      "Return home with stories worth telling for three generations.",
      "Open the coziest inn in the realm.",
      "Prove that a halfling can be a hero of the great songs.",
      "Build a village where nobody ever goes hungry.",
      "See every wonder of the world and still be home for supper, eventually.",
    ],
  },
  human: {
    heritages: [
      "Like many humans, {N} burns bright with ambition, knowing life is short.",
      "{N} has the human knack for adapting to almost anything.",
      "{N} grew up in a bustling human city full of every kind of people.",
      "Humans are restless, and {N} is more restless than most.",
      "{N} believes a short life is no excuse for a small one.",
      "{N} was raised in a farming town and still measures time by harvests.",
      "{N} has the human habit of making plans for a future that might never come.",
      "{N} comes from a long line of ordinary folk and intends to be the first extraordinary one.",
      "{N} has a human's talent for finding common ground with strangers.",
      "{N} knows that the years are few and means to make each one count.",
    ],
    pasts: [
      "{N} grew up in a frontier town that was swallowed by a growing kingdom.",
      "{Their} parents worked themselves to the bone so {N} could have a better life.",
      "{N} survived a war that took {their} home and most of {their} friends.",
      "{N} spent years in service to a noble family before striking out alone.",
      "{N} has moved so many times that no place quite feels like home.",
    ],
    manners: [
      "{N} talks with {their} hands and rarely sits still.",
      "{N} picks up local slang within a day of arriving anywhere.",
      "{Their} face shows every emotion before {N} can hide it.",
      "{N} makes friends quickly and forgets enemies slowly.",
      "{N} always seems to be in a hurry, even when there is no rush.",
    ],
    shortTermGoals: [
      "Make enough coin to send something home to family.",
      "Learn a skill no one in {their} home village has ever mastered.",
      "Find a place where {N} can finally put down roots.",
      "Reconnect with an estranged sibling in another city.",
    ],
    longTermGoals: [
      "Build a legacy that will outlast {their} short life.",
      "Rise from humble beginnings to a seat of real power.",
      "Found a town where people of every kind live as neighbors.",
      "Leave {their} children a better world than the one {N} was born into.",
      "Achieve in one lifetime what others take centuries to do.",
    ],
  },
  orc: {
    heritages: [
      "{N} carries the relentless endurance of the orcs and never stays down for long.",
      "Orc tenacity runs in {their} blood: {N} keeps going long after others quit.",
      "{N} has spent years proving that an orc is far more than people expect.",
      "{N} was raised on stories of orc heroes who stood against impossible odds.",
      "Strength and loyalty matter to {them} more than pretty words.",
      "{N} has a deep respect for the wild places where orcs once roamed freely.",
      "People see the tusks first; {N} makes sure they remember the deeds.",
      "{N} was taught that every scar is a lesson and every lesson is a gift.",
      "{N} feels a fierce kinship with anyone who has had to fight to be accepted.",
      "{N} believes endurance is the truest form of strength.",
    ],
    pasts: [
      "{N} grew up in a frontier town where orcs were tolerated but never trusted.",
      "{Their} tribe was scattered by war, and {N} carries its memory in songs and tattoos.",
      "{N} once kept fighting through wounds that should have stopped {them}, and saved a caravan.",
      "{N} was raised by a human family who never let {them} feel different.",
      "A rival tribe challenged {their} family's honor, and {N} answered in single combat.",
    ],
    manners: [
      "{N} grins widely, tusks and all, when {N} is truly happy.",
      "{N} speaks bluntly and expects the same in return.",
      "{Their} voice drops to a growl when {N} is protecting a friend.",
      "{N} eats with gusto and laughs with even more.",
      "{N} touches a tribal token whenever danger looms.",
    ],
    shortTermGoals: [
      "Earn the trust of a town that fears orcs.",
      "Track down the warband that scattered {their} tribe.",
      "Win a contest of endurance against a famous champion.",
      "Find a lost tribal relic said to be held by collectors in a far-off city.",
    ],
    longTermGoals: [
      "Reunite the scattered members of {their} tribe.",
      "Change how the people of the realm see orcs, one deed at a time.",
      "Become a chieftain known for wisdom as well as strength.",
      "Build a home where orcs and other peoples live as equals.",
      "Earn a place in the songs of orc heroes.",
    ],
  },
  tiefling: {
    heritages: [
      "{N} carries a fiendish legacy that {N} never asked for and refuses to be ruled by.",
      "Horns and a tail draw stares wherever {N} goes, and {N} has learned to stare back.",
      "{N} has spent a lifetime proving that heritage is not destiny.",
      "The whispers of {their} fiendish ancestry are something {N} has learned to ignore, mostly.",
      "{N} has a tiefling's resilience, forged by years of suspicion from strangers.",
      "{N} knows how it feels to be judged before speaking a word, and refuses to judge others that way.",
      "{N} was raised by a family that loved {them} fiercely and warned {them} constantly.",
      "{N} has turned the stares of strangers into a kind of stage presence.",
      "Being a tiefling has taught {them} that trust must be earned in both directions.",
      "{N} sometimes wonders which ancestor made the bargain that marked {their} bloodline.",
    ],
    pasts: [
      "A mob once chased {them} out of a town for being a tiefling, and {N} has never been back.",
      "{N} discovered the name of the fiend tied to {their} bloodline in an old family journal.",
      "{N} was the only tiefling in {their} village and the bravest child there.",
      "A priest refused {them} entry to a temple, and {N} has been wrestling with faith ever since.",
      "{N} made {their} first friend by saving a child who had been taught to fear tieflings.",
    ],
    manners: [
      "{Their} tail twitches when {N} is irritated, which {N} wishes it would not.",
      "{N} has a theatrical way of speaking that makes every sentence sound like a performance.",
      "{Their} eyes glint in the dark, and {N} enjoys the effect a little too much.",
      "{N} keeps {their} horns polished and decorated.",
      "{N} smiles slowly, as if sharing a secret with the whole room.",
    ],
    shortTermGoals: [
      "Learn the true name of the fiend tied to {their} bloodline.",
      "Win over a town that refuses to serve tieflings.",
      "Find a tiefling elder who knows the history of {their} line.",
      "Prove {their} innocence of a crime blamed on {them} because of {their} horns.",
    ],
    longTermGoals: [
      "Break the hold of {their} fiendish ancestor over the bloodline.",
      "Become a hero that no one can look at and see only a fiend.",
      "Find a home where tieflings are welcomed without question.",
      "Confront the fiend whose bargain marked {their} family.",
      "Change how the world sees every tiefling who comes after.",
    ],
    lineages: {
      abyssal: [
        "{N}'s Abyssal legacy stirs a wild, chaotic streak that is hard to tame.",
        "The demons of the Abyss echo in {their} blood as a restless, reckless hunger.",
      ],
      chthonic: [
        "{N}'s Chthonic legacy leaves a chill around {them} and a strange calm near the dead.",
        "The shadow of the lower planes' death-realms clings to {them} like mist.",
      ],
      infernal: [
        "{N}'s Infernal legacy gives {them} a devil's talent for contracts and fine print.",
        "The devils of the Nine Hells left {them} a sharp mind and an ember-bright temper.",
      ],
    },
  },
};
