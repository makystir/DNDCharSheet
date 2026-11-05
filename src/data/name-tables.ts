/**
 * ============================================================================
 *  NON-RAW FLAVOR — not from any rulebook.
 * ============================================================================
 *
 * Per-species name, colouring, and body pools for the FLAVOR generators
 * (src/logic/personal-details-generation.ts), Stage A7 PART 1.
 *
 * RULES-COMPLIANCE (rule 1 / rule 5): NONE of the data in this file is a game
 * mechanic and NONE is transcribed from a rulebook. These are invented,
 * D&D-flavoured suggestion pools in the spirit of each species' naming style;
 * a player can always override any generated value. No PHB citation applies
 * because no rule is being implemented.
 *
 * Contract (src/logic/__tests__/creation-golden.ts GENERATOR_CONTRACT): at
 * least 30 DISTINCT first names for every supported species × {male, female,
 * neutral}; eye/hair/skin pools and height/weight ranges vary by species. The
 * pools below meet or exceed that floor; a species-neutral fallback exists for
 * safety but is never needed to satisfy the contract.
 */

import type { SpeciesId } from './species';

/** The three generation genders. */
export type NameGender = 'male' | 'female' | 'neutral';

/** First-name pools per gender for one species. */
interface SpeciesNamePools {
  male: string[];
  female: string[];
  neutral: string[];
}

/** An inclusive numeric range (e.g. a height or weight band). */
export interface NumericRange {
  min: number;
  max: number;
}

/** Everything the generators draw on for one species. */
interface SpeciesFlavor {
  names: SpeciesNamePools;
  eyes: string[];
  hair: string[];
  skins: string[];
  /** Height in inches (inclusive). */
  heightInches: NumericRange;
  /** Weight in pounds (inclusive). */
  weightPounds: NumericRange;
}

// ─── Per-species pools (NON-RAW, invented flavor) ────────────────────────────

const HUMAN: SpeciesFlavor = {
  names: {
    male: [
      'Aldric', 'Benedikt', 'Cassian', 'Dietrich', 'Edmund', 'Falk', 'Gerold', 'Hartmann',
      'Ivo', 'Joric', 'Konrad', 'Lothar', 'Magnus', 'Nikolas', 'Otto', 'Perrin', 'Quinn',
      'Roderic', 'Stefan', 'Tomas', 'Ulrich', 'Viktor', 'Willem', 'Albrecht', 'Dorian',
      'Emeric', 'Godwin', 'Hendrik', 'Lennard', 'Rainer', 'Corwin', 'Alaric',
    ],
    female: [
      'Adelind', 'Brigitta', 'Carlotta', 'Dagna', 'Elsbeth', 'Freya', 'Gisela', 'Helena',
      'Isolde', 'Johanna', 'Katarin', 'Liesel', 'Margit', 'Nadja', 'Odette', 'Petra',
      'Rowena', 'Sabine', 'Theda', 'Ulrike', 'Verena', 'Wilhelmina', 'Adele', 'Cordula',
      'Eleonore', 'Gretchen', 'Hedda', 'Lioba', 'Romilda', 'Sigrun', 'Valda', 'Annelise',
    ],
    neutral: [
      'Ash', 'Bryce', 'Casel', 'Devin', 'Ellery', 'Frey', 'Gale', 'Haven', 'Ira', 'Jory',
      'Kestrel', 'Lark', 'Marin', 'Nolan', 'Oren', 'Perry', 'Quill', 'Reese', 'Sage', 'Teagan',
      'Vale', 'Wren', 'Arden', 'Blaise', 'Caden', 'Emery', 'Hollis', 'Linden', 'Robin',
      'Sloane', 'Tamsin', 'Verity',
    ],
  },
  eyes: ['brown', 'hazel', 'green', 'blue', 'grey', 'amber', 'dark brown'],
  hair: ['black', 'brown', 'auburn', 'blond', 'chestnut', 'grey', 'red', 'sandy'],
  skins: ['pale', 'fair', 'tan', 'olive', 'bronze', 'brown', 'dark brown'],
  heightInches: { min: 60, max: 78 },
  weightPounds: { min: 120, max: 260 },
};

const DWARF: SpeciesFlavor = {
  names: {
    male: [
      'Balin', 'Thorin', 'Durin', 'Brokk', 'Grundin', 'Harbek', 'Korgan', 'Morgran',
      'Nural', 'Orsik', 'Rangrim', 'Thradin', 'Ulfgar', 'Vondal', 'Baern', 'Dworic',
      'Eberk', 'Fargrim', 'Gardain', 'Kildrak', 'Oskar', 'Rurik', 'Taklinn', 'Thorek',
      'Travok', 'Veit', 'Adrik', 'Brottor', 'Darrak', 'Flint', 'Grimm', 'Torbec',
    ],
    female: [
      'Amber', 'Bardryn', 'Diesa', 'Eldeth', 'Falkrunn', 'Gunnloda', 'Helja', 'Hlin',
      'Ilde', 'Kathra', 'Kristryd', 'Liftrasa', 'Mardred', 'Nalaed', 'Orva', 'Riswynn',
      'Sannl', 'Torbera', 'Vistra', 'Werydd', 'Birgen', 'Dagnal', 'Finellen', 'Gurdis',
      'Hedril', 'Marastyr', 'Nordra', 'Ovranna', 'Thesild', 'Bromma', 'Gilda', 'Runa',
    ],
    neutral: [
      'Brun', 'Dolgrin', 'Fisk', 'Garn', 'Holt', 'Jarn', 'Kor', 'Lund', 'Morl', 'Narn',
      'Ord', 'Prax', 'Rild', 'Snorri', 'Thane', 'Urn', 'Varr', 'Wulf', 'Bram', 'Durn',
      'Gorm', 'Hald', 'Krung', 'Modr', 'Orn', 'Rask', 'Stor', 'Tarn', 'Vrek', 'Brend',
      'Durgan', 'Flent',
    ],
  },
  eyes: ['deep brown', 'hazel', 'grey', 'green', 'steel blue', 'amber'],
  hair: ['black', 'brown', 'auburn', 'iron-grey', 'copper-red', 'white', 'rust'],
  skins: ['ruddy', 'tan', 'bronze', 'brown', 'deep brown', 'ash-grey'],
  heightInches: { min: 48, max: 58 },
  weightPounds: { min: 150, max: 220 },
};

const ELF: SpeciesFlavor = {
  names: {
    male: [
      'Adran', 'Aelar', 'Aramil', 'Berrian', 'Carric', 'Enialis', 'Erdan', 'Galinndan',
      'Hadarai', 'Heian', 'Immeral', 'Ivellios', 'Laucian', 'Mindartis', 'Paelias',
      'Peren', 'Quarion', 'Riardon', 'Soveliss', 'Thamior', 'Theren', 'Varis', 'Aerendyl',
      'Caelynn', 'Daelan', 'Faelar', 'Haldir', 'Lindal', 'Rolen', 'Sythaeryn', 'Taliesin',
      'Vanuath',
    ],
    female: [
      'Adrie', 'Althaea', 'Anastrianna', 'Andraste', 'Antinua', 'Bethrynna', 'Birel',
      'Caelynn', 'Drusilia', 'Enna', 'Felosial', 'Ielenia', 'Jelenneth', 'Keyleth',
      'Leshanna', 'Lia', 'Meriele', 'Mialee', 'Naivara', 'Quelenna', 'Sariel', 'Shanairra',
      'Theirastra', 'Thia', 'Vadania', 'Valanthe', 'Xanaphia', 'Aelrindel', 'Myriel',
      'Silaqui', 'Yilaana', 'Elora',
    ],
    neutral: [
      'Aelle', 'Brae', 'Cael', 'Dre', 'Eryn', 'Fael', 'Glae', 'Hael', 'Ilye', 'Jae',
      'Kaelis', 'Lael', 'Myr', 'Nael', 'Oryn', 'Phae', 'Quen', 'Rae', 'Syl', 'Thael',
      'Vael', 'Wyn', 'Ylla', 'Aemor', 'Brith', 'Cyrae', 'Elowen', 'Faeryl', 'Lyr',
      'Sael', 'Thillae', 'Vire',
    ],
  },
  eyes: ['emerald green', 'violet', 'silver', 'pale blue', 'golden', 'grey', 'copper'],
  hair: ['silver', 'golden', 'raven black', 'auburn', 'white', 'copper', 'ashen'],
  skins: ['pale', 'fair', 'coppery', 'tawny', 'bronze', 'alabaster'],
  heightInches: { min: 60, max: 74 },
  weightPounds: { min: 100, max: 160 },
};

const HALFLING: SpeciesFlavor = {
  names: {
    male: [
      'Alton', 'Ander', 'Cade', 'Corrin', 'Eldon', 'Errich', 'Finnan', 'Garret', 'Lindal',
      'Lyle', 'Merric', 'Milo', 'Osborn', 'Perrin', 'Reed', 'Roscoe', 'Wellby', 'Andry',
      'Bobbin', 'Dink', 'Fonkin', 'Gerbo', 'Nedda', 'Pim', 'Riggs', 'Tibbet', 'Wilfer',
      'Abel', 'Dob', 'Flint', 'Hob', 'Tucker',
    ],
    female: [
      'Andry', 'Bree', 'Callie', 'Cora', 'Euphemia', 'Jillian', 'Kithri', 'Lavinia',
      'Lidda', 'Merla', 'Nedda', 'Paela', 'Portia', 'Seraphina', 'Shaena', 'Trym',
      'Vani', 'Verna', 'Amaryllis', 'Charmaine', 'Dindy', 'Finch', 'Gynnie', 'Marigold',
      'Nerissa', 'Poppy', 'Rosie', 'Tansy', 'Willow', 'Daisy', 'Primula', 'Wren',
    ],
    neutral: [
      'Bil', 'Cob', 'Doe', 'Fen', 'Gil', 'Hap', 'Jip', 'Kip', 'Lob', 'Mop', 'Nib',
      'Oll', 'Pib', 'Quib', 'Rue', 'Sage', 'Tad', 'Vip', 'Wisp', 'Brin', 'Clove',
      'Fig', 'Hazel', 'Juni', 'Linny', 'Moss', 'Nutmeg', 'Pell', 'Sorrel', 'Thistle',
      'Vetch', 'Berry',
    ],
  },
  eyes: ['brown', 'hazel', 'green', 'warm brown', 'amber', 'grey'],
  hair: ['brown', 'sandy', 'chestnut', 'curly black', 'auburn', 'honey'],
  skins: ['ruddy', 'tan', 'freckled', 'fair', 'warm brown', 'olive'],
  heightInches: { min: 34, max: 42 },
  weightPounds: { min: 35, max: 48 },
};

const GNOME: SpeciesFlavor = {
  names: {
    male: [
      'Alston', 'Boddynock', 'Brocc', 'Burgell', 'Dimble', 'Eldon', 'Erky', 'Fonkin',
      'Frug', 'Gerbo', 'Gimble', 'Glim', 'Jebeddo', 'Kellen', 'Namfoodle', 'Orryn',
      'Roondar', 'Seebo', 'Sindri', 'Warryn', 'Wrenn', 'Zook', 'Bimpnottin', 'Cragol',
      'Dabbledob', 'Fablen', 'Nim', 'Pock', 'Quill', 'Snebin', 'Tinker', 'Wobble',
    ],
    female: [
      'Bimpnottin', 'Breena', 'Caramip', 'Carlin', 'Donella', 'Duvamil', 'Ella', 'Ellyjobell',
      'Ellywick', 'Lilli', 'Loopmottin', 'Lorilla', 'Mardnab', 'Nissa', 'Nyx', 'Oda',
      'Orla', 'Roywyn', 'Shamil', 'Tana', 'Waywocket', 'Zanna', 'Binka', 'Fiddlewick',
      'Jassa', 'Mabli', 'Nilsa', 'Pirouette', 'Quilla', 'Sprocket', 'Tinka', 'Winnifer',
    ],
    neutral: [
      'Cog', 'Dib', 'Fizz', 'Gizmo', 'Jink', 'Knack', 'Loft', 'Mote', 'Nub', 'Pip',
      'Quirk', 'Ratchet', 'Sprig', 'Tock', 'Twix', 'Whir', 'Zib', 'Bolt', 'Click',
      'Dart', 'Flick', 'Gear', 'Hitch', 'Lace', 'Notch', 'Pin', 'Quip', 'Spark',
      'Trill', 'Vex', 'Wisp', 'Zephyr',
    ],
  },
  eyes: ['bright blue', 'green', 'hazel', 'amber', 'violet', 'copper'],
  hair: ['brown', 'auburn', 'white', 'ginger', 'chestnut', 'sandy', 'wild grey'],
  skins: ['tan', 'ruddy', 'fair', 'olive', 'warm brown', 'wood-brown'],
  heightInches: { min: 36, max: 44 },
  weightPounds: { min: 35, max: 50 },
};

const DRAGONBORN: SpeciesFlavor = {
  names: {
    male: [
      'Arjhan', 'Balasar', 'Bharash', 'Donaar', 'Ghesh', 'Heskan', 'Kriv', 'Medrash',
      'Mehen', 'Nadarr', 'Pandjed', 'Patrin', 'Rhogar', 'Shamash', 'Shedinn', 'Tarhun',
      'Torinn', 'Vargach', 'Baradad', 'Kerkad', 'Narhik', 'Rivaan', 'Sethrak', 'Thungar',
      'Verthisathurgiesh', 'Zedaar', 'Ophinshtalajiir', 'Fenkenkabradon', 'Daardendrian',
      'Clethtinthiallor', 'Kepeshkmolik', 'Yarjerit',
    ],
    female: [
      'Akra', 'Biri', 'Daar', 'Farideh', 'Harann', 'Havilar', 'Jheri', 'Kava', 'Korinn',
      'Mishann', 'Nala', 'Perra', 'Raiann', 'Sora', 'Surina', 'Thava', 'Uadjit', 'Vezera',
      'Zykroff', 'Antrara', 'Arava', 'Blenryth', 'Chassath', 'Dentratha', 'Doudra',
      'Kahousehold', 'Nantari', 'Pogranix', 'Shestandeliath', 'Wivarra', 'Zola', 'Essana',
    ],
    neutral: [
      'Arix', 'Brask', 'Cindra', 'Drael', 'Esk', 'Fyrnn', 'Grath', 'Hesk', 'Irix', 'Jorn',
      'Kazra', 'Lorvax', 'Mord', 'Nyx', 'Orix', 'Pyrr', 'Qeth', 'Rath', 'Sarth', 'Thurn',
      'Vask', 'Wyr', 'Zynn', 'Achra', 'Branx', 'Draz', 'Fenn', 'Grix', 'Kesh', 'Mirax',
      'Soryn', 'Vrax',
    ],
  },
  eyes: ['gold', 'silver', 'red', 'bright green', 'amber', 'copper', 'black'],
  hair: ['none (crest horns)', 'none', 'spined crest', 'frilled crest'],
  skins: ['brass scales', 'bronze scales', 'copper scales', 'gold scales', 'red scales',
    'blue scales', 'green scales', 'white scales', 'black scales', 'silver scales'],
  heightInches: { min: 66, max: 80 },
  weightPounds: { min: 200, max: 340 },
};

const TIEFLING: SpeciesFlavor = {
  names: {
    male: [
      'Akmenos', 'Amnon', 'Barakas', 'Damakos', 'Ekemon', 'Iados', 'Kairon', 'Leucis',
      'Melech', 'Mordai', 'Morthos', 'Pelaios', 'Skamos', 'Therai', 'Azael', 'Balthazar',
      'Caim', 'Dagon', 'Ezra', 'Fell', 'Gorath', 'Habbuk', 'Ishan', 'Kothar', 'Lorcan',
      'Nesirah', 'Orcus', 'Valafar', 'Zepar', 'Belial', 'Cadmus', 'Raum',
    ],
    female: [
      'Akta', 'Anakis', 'Bryseis', 'Criella', 'Damaia', 'Ea', 'Kallista', 'Lerissa',
      'Makaria', 'Nemeia', 'Orianna', 'Phelaia', 'Rieta', 'Seere', 'Anathema', 'Belaestra',
      'Calmaria', 'Demona', 'Erebos', 'Fierna', 'Glasya', 'Hecate', 'Lilith', 'Mazikeen',
      'Naamah', 'Ravenna', 'Sabriel', 'Temeluchus', 'Vespera', 'Zariel', 'Cassilda', 'Nyssa',
    ],
    neutral: [
      'Art', 'Carrion', 'Chant', 'Creed', 'Despair', 'Excellence', 'Fear', 'Glory', 'Hope',
      'Ideal', 'Music', 'Nowhere', 'Open', 'Poetry', 'Quest', 'Random', 'Reverence', 'Sorrow',
      'Temerity', 'Torment', 'Weary', 'Ash', 'Dusk', 'Ember', 'Grief', 'Nocturne', 'Omen',
      'Rue', 'Shade', 'Vow', 'Woe', 'Zeal',
    ],
  },
  eyes: ['solid black', 'solid red', 'solid gold', 'solid silver', 'solid white', 'violet', 'burning orange'],
  hair: ['crimson', 'jet black', 'deep purple', 'dark blue', 'burgundy', 'white', 'ember-red'],
  skins: ['crimson red', 'dusky', 'deep purple', 'ruddy brown', 'ashen', 'pale rose', 'burnished bronze'],
  heightInches: { min: 60, max: 76 },
  weightPounds: { min: 120, max: 240 },
};

const ORC: SpeciesFlavor = {
  names: {
    male: [
      'Dench', 'Feng', 'Gell', 'Henk', 'Holg', 'Imsh', 'Keth', 'Krusk', 'Mhurren', 'Ront',
      'Shump', 'Thokk', 'Grish', 'Narak', 'Ortha', 'Ruak', 'Thar', 'Umog', 'Varg', 'Zorga',
      'Brughor', 'Dorn', 'Grumbar', 'Hakk', 'Lushgar', 'Morg', 'Nazgrel', 'Rendar', 'Skarr',
      'Thrag', 'Ugsar', 'Wogrim',
    ],
    female: [
      'Baggi', 'Emen', 'Engong', 'Kansif', 'Myev', 'Neega', 'Ovak', 'Ownka', 'Shautha',
      'Sutha', 'Vola', 'Volen', 'Yevelda', 'Arha', 'Baka', 'Drenna', 'Grisha', 'Haruuc',
      'Lorga', 'Myar', 'Nagha', 'Oloma', 'Rolga', 'Shelur', 'Thurga', 'Uraga', 'Veshka',
      'Wurga', 'Zogga', 'Brakka', 'Ghaela', 'Nurza',
    ],
    neutral: [
      'Agra', 'Bor', 'Dug', 'Grol', 'Hesh', 'Kraal', 'Lurg', 'Mok', 'Narg', 'Oru', 'Pazk',
      'Ruk', 'Sarg', 'Torg', 'Ug', 'Vrak', 'Wog', 'Zar', 'Brug', 'Durk', 'Gnash', 'Hurn',
      'Kazg', 'Murg', 'Nok', 'Orug', 'Raz', 'Snarl', 'Thokku', 'Ugra', 'Vog', 'Zugol',
    ],
  },
  eyes: ['red', 'yellow', 'amber', 'dark brown', 'green', 'grey'],
  hair: ['black', 'dark brown', 'coarse grey', 'bristly black', 'none', 'iron-grey'],
  skins: ['grey-green', 'olive', 'ashen grey', 'dusky green', 'slate grey', 'tan-green'],
  heightInches: { min: 66, max: 82 },
  weightPounds: { min: 180, max: 320 },
};

const GOLIATH: SpeciesFlavor = {
  names: {
    male: [
      'Aukan', 'Eglath', 'Gae-Al', 'Gauthak', 'Ilikan', 'Keothi', 'Kuori', 'Lo-Kag',
      'Manneo', 'Maveith', 'Nalla', 'Orilo', 'Paavu', 'Pethani', 'Thalai', 'Thotham',
      'Uthal', 'Vaunea', 'Vimak', 'Aurok', 'Bhani', 'Davek', 'Gennuk', 'Haruk', 'Kavaki',
      'Loak', 'Mokako', 'Noki', 'Thomuk', 'Vauno', 'Wuthak', 'Zanak',
    ],
    female: [
      'Akanni', 'Arkeli', 'Baukkni', 'Elanni', 'Guotin', 'Ilma', 'Kaiva', 'Kseti', 'Lavi',
      'Makili', 'Meliri', 'Nalla', 'Olirali', 'Pumili', 'Sauakki', 'Thalai', 'Uthini',
      'Vauni', 'Veltha', 'Anaba', 'Bhuka', 'Ellaki', 'Gaelo', 'Kallari', 'Luaki', 'Minu',
      'Orilli', 'Puave', 'Shivi', 'Tholi', 'Uvaki', 'Weloni',
    ],
    neutral: [
      'Aak', 'Bael', 'Cho', 'Dukko', 'Ekk', 'Guar', 'Huon', 'Iro', 'Kael', 'Loki', 'Maru',
      'Noa', 'Ozak', 'Pael', 'Raku', 'Seo', 'Tuli', 'Ukko', 'Vael', 'Wael', 'Yuki', 'Zaak',
      'Baro', 'Daku', 'Eki', 'Garo', 'Kael-o', 'Mako', 'Oru', 'Suli', 'Tharo', 'Vuno',
    ],
  },
  eyes: ['pale grey', 'icy blue', 'stone grey', 'amber', 'pale green', 'slate'],
  hair: ['black', 'dark brown', 'none', 'grey', 'bound topknot', 'braided black'],
  skins: ['stone grey', 'slate', 'pale brown', 'patterned grey', 'lithoderm-mottled', 'ash'],
  heightInches: { min: 84, max: 96 },
  weightPounds: { min: 280, max: 420 },
};

const AASIMAR: SpeciesFlavor = {
  names: {
    male: [
      'Aribeth', 'Caeldan', 'Davael', 'Eliel', 'Faelor', 'Gadriel', 'Haziel', 'Ithuriel',
      'Jophiel', 'Kemuel', 'Lahash', 'Micael', 'Nathaniel', 'Oriel', 'Pheniel', 'Raziel',
      'Samiel', 'Turiel', 'Uriel', 'Valoel', 'Zachariel', 'Barael', 'Cassiel', 'Dumah',
      'Emael', 'Gavriel', 'Hadriel', 'Lumiel', 'Peniel', 'Sariel', 'Thamiel', 'Zuriel',
    ],
    female: [
      'Amariel', 'Beatha', 'Celestine', 'Dawnelle', 'Elenwe', 'Faeralyn', 'Gloriel',
      'Haniel', 'Illiana', 'Jaelle', 'Kaeliel', 'Lumina', 'Mireille', 'Naeliah', 'Ophelia',
      'Pelaiah', 'Radiella', 'Seraphine', 'Thessaly', 'Urielle', 'Valora', 'Zariah',
      'Aurelia', 'Brielle', 'Caliah', 'Elael', 'Gaela', 'Liriel', 'Nuriel', 'Seraphiel',
      'Thelmae', 'Vessaly',
    ],
    neutral: [
      'Aurel', 'Beam', 'Cael', 'Dawn', 'Ember', 'Grace', 'Halo', 'Iris', 'Lux', 'Mercy',
      'Noor', 'Oriel', 'Peace', 'Quill', 'Ray', 'Solace', 'True', 'Vesper', 'Zeal', 'Astra',
      'Celest', 'Dove', 'Elan', 'Faith', 'Gleam', 'Lumen', 'Prism', 'Radiant', 'Seren',
      'Virtue', 'Wander', 'Zenith',
    ],
  },
  eyes: ['luminous gold', 'silver', 'pale blue', 'glowing white', 'warm amber', 'violet'],
  hair: ['golden', 'silver-white', 'platinum', 'copper', 'raven black with sheen', 'pale blond'],
  skins: ['silver-flecked', 'opalescent', 'coppery', 'fair with a faint glow', 'bronze', 'pale'],
  heightInches: { min: 60, max: 76 },
  weightPounds: { min: 120, max: 240 },
};

/** The flavor table keyed by SpeciesId. Every supported species is present. */
const SPECIES_FLAVOR: Record<SpeciesId, SpeciesFlavor> = {
  aasimar: AASIMAR,
  dragonborn: DRAGONBORN,
  dwarf: DWARF,
  elf: ELF,
  gnome: GNOME,
  goliath: GOLIATH,
  halfling: HALFLING,
  human: HUMAN,
  orc: ORC,
  tiefling: TIEFLING,
};

/**
 * A species-neutral fallback pool (NON-RAW). Used only if an accessor is ever
 * called with an unknown species id; every supported species has its own pools
 * so the GENERATOR_CONTRACT never relies on this.
 */
const FALLBACK: SpeciesFlavor = HUMAN;

function flavorFor(species: SpeciesId): SpeciesFlavor {
  return SPECIES_FLAVOR[species] ?? FALLBACK;
}

// ─── Typed accessors ─────────────────────────────────────────────────────────

/** First-name pool for a (species, gender) combination (NON-RAW flavor). */
export function firstNamesFor(species: SpeciesId, gender: NameGender): string[] {
  return flavorFor(species).names[gender];
}

/** Eye-colour pool for a species (NON-RAW flavor). */
export function eyeColorsFor(species: SpeciesId): string[] {
  return flavorFor(species).eyes;
}

/** Hair pool for a species (NON-RAW flavor). */
export function hairColorsFor(species: SpeciesId): string[] {
  return flavorFor(species).hair;
}

/** Skin pool for a species (NON-RAW flavor). */
export function skinsFor(species: SpeciesId): string[] {
  return flavorFor(species).skins;
}

/** Height range (inches, inclusive) for a species (NON-RAW flavor). */
export function heightRangeFor(species: SpeciesId): NumericRange {
  return flavorFor(species).heightInches;
}

/** Weight range (pounds, inclusive) for a species (NON-RAW flavor). */
export function weightRangeFor(species: SpeciesId): NumericRange {
  return flavorFor(species).weightPounds;
}
