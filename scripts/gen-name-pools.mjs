/**
 * One-off generator (NOT shipped, NOT imported by the app) that produces the
 * NON-RAW name pools for src/data/name-tables.ts. Builds > 200 DISTINCT,
 * species-and-gender-appropriate invented names per (species, gender) by
 * combining species-flavoured morphemes, then emits ready-to-paste TS arrays.
 *
 * Run: node scripts/gen-name-pools.mjs
 */

const TARGET = 220; // comfortably > 200 distinct per pool

// Deterministic shuffle so regenerating is stable and reviewable.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Build DISTINCT names from prefix+suffix (optionally + connective middle),
// ordered deterministically, truncated to TARGET.
function build(seedPrefixes, suffixes, { seed = 1, middles = [''], target = TARGET } = {}) {
  const set = new Set();
  const out = [];
  const rand = mulberry32(seed);
  // Deterministic but varied ordering of the full cross product.
  const combos = [];
  for (const p of seedPrefixes) {
    for (const m of middles) {
      for (const s of suffixes) {
        combos.push(p + m + s);
      }
    }
  }
  // Shuffle combos deterministically.
  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [combos[i], combos[j]] = [combos[j], combos[i]];
  }
  for (const raw of combos) {
    const name = cap(raw.toLowerCase());
    if (name.length < 2) continue;
    if (!set.has(name)) {
      set.add(name);
      out.push(name);
      if (out.length >= target) break;
    }
  }
  if (out.length < target) {
    throw new Error(`pool short: ${out.length}/${target}`);
  }
  return out;
}

// ─── Morpheme banks per species/gender (invented, flavour-appropriate) ───────

const SP = {};

// HUMAN — Imperial / Old-World flavour.
SP.human = {
  male: build(
    ['Ald', 'Ben', 'Cass', 'Diet', 'Edm', 'Falk', 'Ger', 'Hart', 'Ivo', 'Jor', 'Kon', 'Loth', 'Magn', 'Nikl', 'Ott', 'Perr', 'Rod', 'Stef', 'Tom', 'Ulr', 'Vikt', 'Will', 'Alb', 'Dor', 'Emer', 'Godw', 'Hendr', 'Lenn', 'Rain', 'Corw', 'Alar', 'Brand'],
    ['ric', 'mund', 'ian', 'rich', 'win', 'bert', 'hart', 'olf', 'ram', 'mar', 'and', 'wold'],
    { seed: 11 },
  ),
  female: build(
    ['Adel', 'Brig', 'Carl', 'Dagn', 'Els', 'Frey', 'Gis', 'Hel', 'Isol', 'Joh', 'Kat', 'Lies', 'Marg', 'Nadj', 'Odet', 'Petr', 'Row', 'Sab', 'Thed', 'Ulr', 'Ver', 'Wilh', 'Adl', 'Cord', 'Eleo', 'Gret', 'Hedd', 'Liob', 'Romi', 'Sigr', 'Vald', 'Annel'],
    ['ind', 'itta', 'a', 'ena', 'beth', 'reda', 'wen', 'line', 'issa', 'ara', 'ild', 'una'],
    { seed: 12 },
  ),
  neutral: build(
    ['Ash', 'Bry', 'Cas', 'Dev', 'Ell', 'Frey', 'Gal', 'Hav', 'Ir', 'Jor', 'Kes', 'Lark', 'Mar', 'Nol', 'Or', 'Perr', 'Quill', 'Rees', 'Sag', 'Teag', 'Val', 'Wren', 'Ard', 'Blais', 'Cad', 'Emer', 'Holl', 'Lind', 'Rob', 'Sloan', 'Tams', 'Ver'],
    ['en', 'in', 'a', 'is', 'ric', 'well', 'et', 'ley', 'on', 'ith', 'ar', 'yn'],
    { seed: 13 },
  ),
};

// DWARF — hard consonants, clan-forged syllables.
SP.dwarf = {
  male: build(
    ['Bal', 'Thor', 'Dur', 'Brok', 'Grund', 'Harb', 'Korg', 'Morg', 'Nur', 'Ors', 'Rangr', 'Thrad', 'Ulfg', 'Vond', 'Baer', 'Dwor', 'Eber', 'Fargr', 'Gard', 'Kildr', 'Osk', 'Rur', 'Takl', 'Thor', 'Trav', 'Veit', 'Adr', 'Brot', 'Darr', 'Flint', 'Grimm', 'Torb'],
    ['in', 'in', 'ak', 'dar', 'rim', 'nor', 'gar', 'li', 'mund', 'dek', 'bek', 'drin'],
    { seed: 21 },
  ),
  female: build(
    ['Amb', 'Bardr', 'Dies', 'Eld', 'Falkr', 'Gunnl', 'Helj', 'Hlin', 'Ild', 'Kath', 'Kristr', 'Liftr', 'Mardr', 'Nal', 'Orv', 'Riswy', 'Sann', 'Torb', 'Vist', 'Weryd', 'Birg', 'Dagn', 'Finel', 'Gurd', 'Hedr', 'Marast', 'Nordr', 'Ovran', 'Thesi', 'Brom', 'Gild', 'Run'],
    ['a', 'ra', 'unn', 'hild', 'eth', 'ryn', 'dis', 'gen', 'na', 'wyn', 'bera', 'la'],
    { seed: 22 },
  ),
  neutral: build(
    ['Brun', 'Dolgr', 'Fisk', 'Garn', 'Holt', 'Jarn', 'Kor', 'Lund', 'Morl', 'Narn', 'Ord', 'Prax', 'Rild', 'Snorr', 'Than', 'Urn', 'Varr', 'Wulf', 'Bram', 'Durn', 'Gorm', 'Hald', 'Krung', 'Modr', 'Orn', 'Rask', 'Stor', 'Tarn', 'Vrek', 'Brend', 'Durg', 'Flent'],
    ['', 'i', 'ok', 'ar', 'in', 'um', 'ek', 'orn', 'drak', 'gni', 'uld', 'bar'],
    { seed: 23 },
  ),
};

// ELF — flowing vowels, soft liquids.
SP.elf = {
  male: build(
    ['Adr', 'Ael', 'Aram', 'Berr', 'Carr', 'Enial', 'Erd', 'Galinn', 'Hadar', 'Hei', 'Immer', 'Ivell', 'Lauc', 'Mindar', 'Pael', 'Per', 'Quar', 'Riard', 'Sovel', 'Tham', 'Ther', 'Var', 'Aerend', 'Cael', 'Dael', 'Fael', 'Hald', 'Lind', 'Rol', 'Sythaer', 'Talies', 'Vanu'],
    ['ian', 'ior', 'is', 'ael', 'wen', 'dil', 'yn', 'ath', 'amar', 'ion', 'ar', 'eth'],
    { seed: 31 },
  ),
  female: build(
    ['Adr', 'Alth', 'Anastr', 'Andr', 'Antin', 'Bethr', 'Bir', 'Cael', 'Drusil', 'Enn', 'Felos', 'Ielen', 'Jelenn', 'Keyl', 'Leshan', 'Lia', 'Merie', 'Mial', 'Naiv', 'Quelen', 'Sar', 'Shanair', 'Theiras', 'Thia', 'Vadan', 'Valan', 'Xanaph', 'Aelrin', 'Myr', 'Silaq', 'Yila', 'Elor'],
    ['ael', 'iel', 'a', 'wen', 'yth', 'ynn', 'ara', 'issa', 'ira', 'ea', 'ana', 'elle'],
    { seed: 32 },
  ),
  neutral: build(
    ['Ael', 'Bra', 'Cael', 'Dre', 'Eryn', 'Fael', 'Glae', 'Hael', 'Ily', 'Jae', 'Kael', 'Lael', 'Myr', 'Nael', 'Oryn', 'Phae', 'Quen', 'Rae', 'Syl', 'Thael', 'Vael', 'Wyn', 'Yll', 'Aem', 'Brith', 'Cyr', 'Elow', 'Faer', 'Lyr', 'Sael', 'Thill', 'Vir'],
    ['', 'is', 'ae', 'wen', 'yl', 'orn', 'en', 'ir', 'eth', 'as', 'ya', 'il'],
    { seed: 33 },
  ),
};

// HALFLING — warm, homely, pastoral.
SP.halfling = {
  male: build(
    ['Alt', 'And', 'Cad', 'Corr', 'Eld', 'Err', 'Finn', 'Garr', 'Lind', 'Lyl', 'Merr', 'Mil', 'Osb', 'Perr', 'Reed', 'Rosc', 'Wellb', 'Andr', 'Bobb', 'Dink', 'Fonk', 'Gerb', 'Nedd', 'Pim', 'Rigg', 'Tibb', 'Wilf', 'Abel', 'Dob', 'Flint', 'Hob', 'Tuck'],
    ['on', 'in', 'o', 'y', 'ick', 'et', 'an', 'er', 'by', 'ow', 'kin', 'el'],
    { seed: 41 },
  ),
  female: build(
    ['Andr', 'Bree', 'Call', 'Cor', 'Euph', 'Jill', 'Kith', 'Lavin', 'Lidd', 'Merl', 'Nedd', 'Pael', 'Port', 'Seraph', 'Shaen', 'Trym', 'Van', 'Vern', 'Amaryl', 'Charm', 'Dind', 'Finch', 'Gynn', 'Marig', 'Neriss', 'Popp', 'Ros', 'Tans', 'Will', 'Dais', 'Primul', 'Wren'],
    ['a', 'ie', 'y', 'ina', 'ella', 'wen', 'etta', 'ow', 'ina', 'isy', 'ild', 'et'],
    { seed: 42 },
  ),
  neutral: build(
    ['Bil', 'Cob', 'Doe', 'Fen', 'Gil', 'Hap', 'Jip', 'Kip', 'Lob', 'Mop', 'Nib', 'Oll', 'Pib', 'Quib', 'Rue', 'Sag', 'Tad', 'Vip', 'Wisp', 'Brin', 'Clove', 'Fig', 'Haz', 'Jun', 'Linn', 'Moss', 'Nutm', 'Pell', 'Sorr', 'Thist', 'Vetch', 'Berr'],
    ['', 'o', 'y', 'by', 'kin', 'et', 'in', 'le', 'er', 'ow', ' it', 'as'],
    { seed: 43 },
  ),
};

// GNOME — whimsical, tinkery clatter.
SP.gnome = {
  male: build(
    ['Alst', 'Boddyn', 'Broc', 'Burg', 'Dimb', 'Eld', 'Erk', 'Fonk', 'Frug', 'Gerb', 'Gimb', 'Glim', 'Jebed', 'Kell', 'Namfood', 'Orr', 'Roond', 'Seeb', 'Sindr', 'Warr', 'Wrenn', 'Zook', 'Bimpn', 'Crag', 'Dabbl', 'Fabl', 'Nim', 'Pock', 'Quill', 'Sneb', 'Tink', 'Wobbl'],
    ['le', 'in', 'ock', 'el', 'o', 'nook', ' bit', ' wick', 'bo', 'dle', 'ik', 'en'],
    { seed: 51 },
  ),
  female: build(
    ['Bimpn', 'Breen', 'Caram', 'Carl', 'Donell', 'Duvam', 'Ell', 'Ellyjob', 'Ellyw', 'Lill', 'Loopm', 'Loril', 'Mardn', 'Niss', 'Nyx', 'Oda', 'Orl', 'Roywy', 'Sham', 'Tan', 'Waywock', 'Zann', 'Bink', 'Fiddlew', 'Jass', 'Mabl', 'Nils', 'Pirouet', 'Quill', 'Sprock', 'Tink', 'Winnif'],
    ['a', 'ie', 'ella', 'ip', 'et', 'wick', 'ina', 'nottin', 'o', 'illa', 'y', 'ette'],
    { seed: 52 },
  ),
  neutral: build(
    ['Cog', 'Dib', 'Fizz', 'Gizm', 'Jink', 'Knack', 'Loft', 'Mote', 'Nub', 'Pip', 'Quirk', 'Ratch', 'Sprig', 'Tock', 'Twix', 'Whir', 'Zib', 'Bolt', 'Click', 'Dart', 'Flick', 'Gear', 'Hitch', 'Lace', 'Notch', 'Pin', 'Quip', 'Spark', 'Trill', 'Vex', 'Wisp', 'Zeph'],
    ['', 'o', 'et', 'ik', 'le', 'in', 'us', 'er', 'it', 'ly', 'y', 'o'],
    { seed: 53 },
  ),
};

// DRAGONBORN — draconic, hard syllables.
SP.dragonborn = {
  male: build(
    ['Arjh', 'Balas', 'Bhar', 'Don', 'Ghesh', 'Hesk', 'Kriv', 'Medr', 'Meh', 'Nad', 'Pandj', 'Patr', 'Rhog', 'Sham', 'Shed', 'Tarh', 'Tor', 'Varg', 'Barad', 'Kerk', 'Narh', 'Riv', 'Sethr', 'Thung', 'Verth', 'Zed', 'Ophin', 'Fenk', 'Daard', 'Cleth', 'Kepesh', 'Yarj'],
    ['an', 'ar', 'ash', 'in', 'esh', 'ach', 'un', 'aan', 'irr', 'ash', 'ad', 'orn'],
    { seed: 61 },
  ),
  female: build(
    ['Akr', 'Bir', 'Daar', 'Farid', 'Har', 'Havil', 'Jher', 'Kav', 'Korinn', 'Mishann', 'Nal', 'Perr', 'Raiann', 'Sor', 'Surin', 'Thav', 'Uadj', 'Vez', 'Zykr', 'Antr', 'Arav', 'Blenr', 'Chass', 'Dentr', 'Doud', 'Kaous', 'Nant', 'Pogr', 'Shest', 'Wivar', 'Zol', 'Essan'],
    ['a', 'ann', 'eth', 'ira', 'ath', 'ira', 'enn', 'ara', 'issa', 'ava', 'esh', 'ia'],
    { seed: 62 },
  ),
  neutral: build(
    ['Arix', 'Brask', 'Cindr', 'Drael', 'Esk', 'Fyrnn', 'Grath', 'Hesk', 'Irix', 'Jorn', 'Kazr', 'Lorv', 'Mord', 'Nyx', 'Orix', 'Pyrr', 'Qeth', 'Rath', 'Sarth', 'Thurn', 'Vask', 'Wyr', 'Zynn', 'Achr', 'Branx', 'Draz', 'Fenn', 'Grix', 'Kesh', 'Mirax', 'Soryn', 'Vrax'],
    ['', 'ax', 'esh', 'ir', 'oth', 'ak', 'un', 'is', 'arn', 'ex', 'or', 'ash'],
    { seed: 63 },
  ),
};

// TIEFLING — infernal roots + 'virtue' names for neutral.
SP.tiefling = {
  male: build(
    ['Akm', 'Amn', 'Barak', 'Damak', 'Ekem', 'Iad', 'Kair', 'Leuc', 'Mel', 'Mord', 'Morth', 'Pelai', 'Skam', 'Ther', 'Aza', 'Balth', 'Caim', 'Dag', 'Ezr', 'Fell', 'Gor', 'Habb', 'Ish', 'Koth', 'Lorc', 'Nesir', 'Orc', 'Valaf', 'Zep', 'Beli', 'Cadm', 'Raum'],
    ['os', 'on', 'as', 'ios', 'ech', 'ar', 'ael', 'oth', 'an', 'is', 'ux', 'eus'],
    { seed: 71 },
  ),
  female: build(
    ['Akt', 'Anak', 'Brys', 'Criell', 'Damai', 'Ea', 'Kallis', 'Leriss', 'Makar', 'Nemei', 'Orian', 'Phelai', 'Riet', 'Seer', 'Anath', 'Belaestr', 'Calmar', 'Demon', 'Ereb', 'Fiern', 'Glasy', 'Hecat', 'Lilit', 'Mazik', 'Naam', 'Raven', 'Sabri', 'Temel', 'Vesper', 'Zari', 'Cassild', 'Nyss'],
    ['a', 'is', 'ia', 'ara', 'eia', 'issa', 'ella', 'een', 'ah', 'na', 'yra', 'el'],
    { seed: 72 },
  ),
  // Neutral tieflings take 'virtue' / aspiration names (two-part concepts).
  neutral: (() => {
    const virtues = [
      'Art', 'Carrion', 'Chant', 'Creed', 'Despair', 'Excellence', 'Fear', 'Glory', 'Hope',
      'Ideal', 'Music', 'Nowhere', 'Open', 'Poetry', 'Quest', 'Random', 'Reverence', 'Sorrow',
      'Temerity', 'Torment', 'Weary', 'Ash', 'Dusk', 'Ember', 'Grief', 'Nocturne', 'Omen',
      'Rue', 'Shade', 'Vow', 'Woe', 'Zeal', 'Mercy', 'Dread', 'Solace', 'Vigil', 'Ruin',
      'Fervour', 'Patience', 'Valour', 'Wrath', 'Candle', 'Oath', 'Debt', 'Echo',
    ];
    const suffixes = ['', '-of-Dusk', '-at-Last', '-in-Shadow', '-Unbowed', '-Ever', '-the-Younger', '-of-the-Pact'];
    const set = new Set();
    const out = [];
    const rand = mulberry32(73);
    const combos = [];
    for (const v of virtues) for (const s of suffixes) combos.push(v + s);
    for (let i = combos.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [combos[i], combos[j]] = [combos[j], combos[i]];
    }
    for (const c of combos) {
      if (!set.has(c)) { set.add(c); out.push(c); if (out.length >= TARGET) break; }
    }
    if (out.length < TARGET) throw new Error(`tiefling neutral short ${out.length}`);
    return out;
  })(),
};

// ORC — guttural, strong stops.
SP.orc = {
  male: build(
    ['Dench', 'Feng', 'Gell', 'Henk', 'Holg', 'Imsh', 'Keth', 'Krusk', 'Mhurr', 'Ront', 'Shump', 'Thokk', 'Grish', 'Narak', 'Orth', 'Ruak', 'Thar', 'Umog', 'Varg', 'Zorg', 'Brugh', 'Dorn', 'Grumb', 'Hakk', 'Lushg', 'Morg', 'Nazgr', 'Rend', 'Skarr', 'Thrag', 'Ugs', 'Wogr'],
    ['', 'ar', 'ur', 'ok', 'ash', 'nak', 'gor', 'uk', 'rim', 'grim', 'az', 'og'],
    { seed: 81 },
  ),
  female: build(
    ['Bagg', 'Em', 'Eng', 'Kans', 'Myev', 'Neeg', 'Ovak', 'Ownk', 'Shauth', 'Suth', 'Vol', 'Vol', 'Yevel', 'Arh', 'Bak', 'Drenn', 'Grish', 'Haruc', 'Lorg', 'Myar', 'Nagh', 'Olom', 'Rolg', 'Shelur', 'Thurg', 'Urag', 'Veshk', 'Wurg', 'Zogg', 'Brakk', 'Ghael', 'Nurz'],
    ['a', 'i', 'na', 'ha', 'ka', 'ra', 'ga', 'da', 'sha', 'ua', 'ela', 'uk'],
    { seed: 82 },
  ),
  neutral: build(
    ['Agr', 'Bor', 'Dug', 'Grol', 'Hesh', 'Kraal', 'Lurg', 'Mok', 'Narg', 'Oru', 'Pazk', 'Ruk', 'Sarg', 'Torg', 'Ug', 'Vrak', 'Wog', 'Zar', 'Brug', 'Durk', 'Gnash', 'Hurn', 'Kazg', 'Murg', 'Nok', 'Orug', 'Raz', 'Snarl', 'Thokk', 'Ugr', 'Vog', 'Zugol'],
    ['', 'a', 'uk', 'or', 'ash', 'nak', 'gor', 'ug', 'gol', 'az', 'rim', 'ok'],
    { seed: 83 },
  ),
};

// GOLIATH — stony, highland, open vowels.
SP.goliath = {
  male: build(
    ['Auk', 'Egl', 'Gae', 'Gauth', 'Ilik', 'Keoth', 'Kuor', 'Lo-K', 'Mann', 'Mavei', 'Nall', 'Oril', 'Paav', 'Peth', 'Thal', 'Thoth', 'Uth', 'Vaun', 'Vim', 'Aur', 'Bhan', 'Dav', 'Gennu', 'Haruk', 'Kavak', 'Loak', 'Mokak', 'Nok', 'Thomuk', 'Vaun', 'Wuth', 'Zan'],
    ['an', 'ath', 'ak', 'uk', 'eo', 'ea', 'o', 'ai', 'al', 'ku', 'am', 'oi'],
    { seed: 91 },
  ),
  female: build(
    ['Akann', 'Arkel', 'Baukk', 'Elann', 'Guot', 'Ilm', 'Kaiv', 'Kset', 'Lav', 'Makil', 'Melir', 'Nall', 'Oliral', 'Pumil', 'Sauak', 'Thal', 'Uthin', 'Vaun', 'Velth', 'Anab', 'Bhuk', 'Ellak', 'Gael', 'Kallar', 'Luak', 'Min', 'Orill', 'Puav', 'Shiv', 'Thol', 'Uvak', 'Welon'],
    ['i', 'a', 'ni', 'li', 'ri', 'ki', 'na', 'vi', 'ti', 'o', 'ui', 'e'],
    { seed: 92 },
  ),
  neutral: build(
    ['Aak', 'Bael', 'Cho', 'Dukk', 'Ekk', 'Guar', 'Huon', 'Iro', 'Kael', 'Lok', 'Mar', 'Noa', 'Ozak', 'Pael', 'Rak', 'Seo', 'Tul', 'Ukk', 'Vael', 'Wael', 'Yuk', 'Zaak', 'Bar', 'Dak', 'Eki', 'Gar', 'Maak', 'Oru', 'Sul', 'Thar', 'Vun', 'Oth'],
    ['', 'o', 'u', 'i', 'a', 'ku', 'ri', 'li', 'na', 'ha', 'ro', 'ai'],
    { seed: 93 },
  ),
};

// AASIMAR — celestial, 'el'/'iel' theophoric endings.
SP.aasimar = {
  male: build(
    ['Arib', 'Caeld', 'Dav', 'El', 'Fael', 'Gadr', 'Haz', 'Ithur', 'Joph', 'Kem', 'Lah', 'Mic', 'Nathan', 'Or', 'Phen', 'Raz', 'Sam', 'Tur', 'Ur', 'Valo', 'Zachar', 'Bar', 'Cassi', 'Dum', 'Em', 'Gavr', 'Hadr', 'Lum', 'Pen', 'Sar', 'Tham', 'Zur'],
    ['iel', 'ael', 'el', 'ael', 'iah', 'eth', 'ion', 'ariel', 'uel', 'iel', 'as', 'ah'],
    { seed: 101 },
  ),
  female: build(
    ['Amar', 'Beath', 'Celest', 'Dawn', 'Elen', 'Faeral', 'Glor', 'Han', 'Illi', 'Jael', 'Kael', 'Lum', 'Mireill', 'Nael', 'Oph', 'Pelai', 'Radi', 'Seraph', 'Thess', 'Uri', 'Valor', 'Zar', 'Aurel', 'Briell', 'Cal', 'El', 'Gael', 'Lir', 'Nur', 'Seraphi', 'Thelm', 'Vess'],
    ['iel', 'iah', 'a', 'elle', 'ine', 'ina', 'wen', 'ael', 'ella', 'iel', 'ora', 'ah'],
    { seed: 102 },
  ),
  neutral: build(
    ['Aur', 'Beam', 'Cael', 'Dawn', 'Emb', 'Grac', 'Hal', 'Ir', 'Lux', 'Merc', 'Noor', 'Orie', 'Peac', 'Quill', 'Ray', 'Solac', 'True', 'Vesp', 'Zeal', 'Astr', 'Celes', 'Dov', 'Elan', 'Faith', 'Gleam', 'Lum', 'Prism', 'Radi', 'Ser', 'Virt', 'Wand', 'Zenit'],
    ['', 'el', 'a', 'iel', 'en', 'ir', 'us', 'ael', 'ia', 'eth', 'o', 'an'],
    { seed: 103 },
  ),
};

// ─── Emit TS ──────────────────────────────────────────────────────────────

function fmtArray(arr, indent) {
  // 6 names per line.
  const pad = ' '.repeat(indent);
  const lines = [];
  for (let i = 0; i < arr.length; i += 6) {
    const chunk = arr.slice(i, i + 6).map((n) => `'${n.replace(/'/g, "\\'")}'`);
    lines.push(pad + chunk.join(', ') + ',');
  }
  return lines.join('\n');
}

// Validate every pool before emitting.
const speciesOrder = ['human', 'dwarf', 'elf', 'halfling', 'gnome', 'dragonborn', 'tiefling', 'orc', 'goliath', 'aasimar'];
for (const sp of speciesOrder) {
  for (const g of ['male', 'female', 'neutral']) {
    const uniq = new Set(SP[sp][g]);
    if (uniq.size < 201) throw new Error(`${sp}/${g} only ${uniq.size} distinct`);
    if (uniq.size !== SP[sp][g].length) throw new Error(`${sp}/${g} has duplicates`);
  }
}

// Emit just the NAME-POOL CONSTANTS block (the part that is regenerated). The
// hand-maintained scaffolding of name-tables.ts (types, appearance pools, age
// ranges, accessors) is written separately and references these constants.
const CONST_HEADER = `// --- NAME POOLS (NON-RAW, generated by scripts/gen-name-pools.mjs) ------------
// > 200 DISTINCT invented names per (species, gender). Regenerate with:
//   node scripts/gen-name-pools.mjs  (prints this whole block)
// Do NOT hand-edit individual names; edit the morpheme banks in the script and
// regenerate so distinctness and the > 200 floor stay guaranteed.`;

let names = CONST_HEADER + '\n\n';
for (const sp of speciesOrder) {
  const u = sp.toUpperCase();
  names += `const ${u}_NAMES: SpeciesNamePools = {\n`;
  for (const g of ['male', 'female', 'neutral']) {
    const pool = SP[sp][g];
    names += `  // ${pool.length} distinct\n`;
    names += `  ${g}: [\n${fmtArray(pool, 4)}\n  ],\n`;
  }
  names += `};\n\n`;
}

// ─── Per-species appearance + body + age data (NON-RAW, hand-authored) ───────
// Age bands are INVENTED NON-RAW flavour (the PHB has no age table): a plausible
// ADULT band that respects each species' established lifespan. Clearly labelled
// not-from-the-rulebook; the player can always override.
const FLAVOR = {
  human: {
    eyes: ['brown', 'hazel', 'green', 'blue', 'grey', 'amber', 'dark brown'],
    hair: ['black', 'brown', 'auburn', 'blond', 'chestnut', 'grey', 'red', 'sandy'],
    skins: ['pale', 'fair', 'tan', 'olive', 'bronze', 'brown', 'dark brown'],
    heightInches: [60, 78], weightPounds: [120, 260],
    ageYears: [18, 70], // humans: short-lived; young adult to venerable
  },
  dwarf: {
    eyes: ['deep brown', 'hazel', 'grey', 'green', 'steel blue', 'amber'],
    hair: ['black', 'brown', 'auburn', 'iron-grey', 'copper-red', 'white', 'rust'],
    skins: ['ruddy', 'tan', 'bronze', 'brown', 'deep brown', 'ash-grey'],
    heightInches: [48, 58], weightPounds: [150, 220],
    ageYears: [40, 350], // dwarves: adult ~50, live ~350
  },
  elf: {
    eyes: ['emerald green', 'violet', 'silver', 'pale blue', 'golden', 'grey', 'copper'],
    hair: ['silver', 'golden', 'raven black', 'auburn', 'white', 'copper', 'ashen'],
    skins: ['pale', 'fair', 'coppery', 'tawny', 'bronze', 'alabaster'],
    heightInches: [60, 74], weightPounds: [100, 160],
    ageYears: [100, 700], // elves: very long-lived (adult ~100, up to ~750)
  },
  halfling: {
    eyes: ['brown', 'hazel', 'green', 'warm brown', 'amber', 'grey'],
    hair: ['brown', 'sandy', 'chestnut', 'curly black', 'auburn', 'honey'],
    skins: ['ruddy', 'tan', 'freckled', 'fair', 'warm brown', 'olive'],
    heightInches: [34, 42], weightPounds: [35, 48],
    ageYears: [20, 140], // halflings: adult ~20, live ~150
  },
  gnome: {
    eyes: ['bright blue', 'green', 'hazel', 'amber', 'violet', 'copper'],
    hair: ['brown', 'auburn', 'white', 'ginger', 'chestnut', 'sandy', 'wild grey'],
    skins: ['tan', 'ruddy', 'fair', 'olive', 'warm brown', 'wood-brown'],
    heightInches: [36, 44], weightPounds: [35, 50],
    ageYears: [40, 450], // gnomes: adult ~40, live 350-500
  },
  dragonborn: {
    eyes: ['gold', 'silver', 'red', 'bright green', 'amber', 'copper', 'black'],
    hair: ['none (crest horns)', 'none', 'spined crest', 'frilled crest'],
    skins: ['brass scales', 'bronze scales', 'copper scales', 'gold scales', 'red scales',
      'blue scales', 'green scales', 'white scales', 'black scales', 'silver scales'],
    heightInches: [66, 80], weightPounds: [200, 340],
    ageYears: [15, 80], // dragonborn: mature fast (~15), live ~80
  },
  tiefling: {
    eyes: ['solid black', 'solid red', 'solid gold', 'solid silver', 'solid white', 'violet', 'burning orange'],
    hair: ['crimson', 'jet black', 'deep purple', 'dark blue', 'burgundy', 'white', 'ember-red'],
    skins: ['crimson red', 'dusky', 'deep purple', 'ruddy brown', 'ashen', 'pale rose', 'burnished bronze'],
    heightInches: [60, 76], weightPounds: [120, 240],
    ageYears: [18, 90], // tieflings: human-like, live a little longer (~90+)
  },
  orc: {
    eyes: ['red', 'yellow', 'amber', 'dark brown', 'green', 'grey'],
    hair: ['black', 'dark brown', 'coarse grey', 'bristly black', 'none', 'iron-grey'],
    skins: ['grey-green', 'olive', 'ashen grey', 'dusky green', 'slate grey', 'tan-green'],
    heightInches: [66, 82], weightPounds: [180, 320],
    ageYears: [14, 60], // orcs: mature early, shorter-lived
  },
  goliath: {
    eyes: ['pale grey', 'icy blue', 'stone grey', 'amber', 'pale green', 'slate'],
    hair: ['black', 'dark brown', 'none', 'grey', 'bound topknot', 'braided black'],
    skins: ['stone grey', 'slate', 'pale brown', 'patterned grey', 'lithoderm-mottled', 'ash'],
    heightInches: [84, 96], weightPounds: [280, 420],
    ageYears: [18, 80], // goliaths: human-like lifespan
  },
  aasimar: {
    eyes: ['luminous gold', 'silver', 'pale blue', 'glowing white', 'warm amber', 'violet'],
    hair: ['golden', 'silver-white', 'platinum', 'copper', 'raven black with sheen', 'pale blond'],
    skins: ['silver-flecked', 'opalescent', 'coppery', 'fair with a faint glow', 'bronze', 'pale'],
    heightInches: [60, 76], weightPounds: [120, 240],
    ageYears: [18, 160], // aasimar: human base, celestial touch extends it
  },
};

function strArr(a, indent) {
  const pad = ' '.repeat(indent);
  const items = a.map((s) => `'${s.replace(/'/g, "\\'")}'`);
  // Wrap long lines.
  const lines = [];
  let cur = '';
  for (const it of items) {
    if ((cur + it).length > 90) { lines.push(pad + cur.trimEnd()); cur = ''; }
    cur += it + ', ';
  }
  if (cur.trim()) lines.push(pad + cur.trimEnd());
  return lines.join('\n');
}

let flavorBlock = '// ─── Per-species colouring, body, and age pools (NON-RAW, invented) ───────────\n\n';
for (const sp of speciesOrder) {
  const f = FLAVOR[sp];
  const u = sp.toUpperCase();
  flavorBlock += `const ${u}: SpeciesFlavor = {\n`;
  flavorBlock += `  names: ${u}_NAMES,\n`;
  flavorBlock += `  eyes: [\n${strArr(f.eyes, 4)}\n  ],\n`;
  flavorBlock += `  hair: [\n${strArr(f.hair, 4)}\n  ],\n`;
  flavorBlock += `  skins: [\n${strArr(f.skins, 4)}\n  ],\n`;
  flavorBlock += `  heightInches: { min: ${f.heightInches[0]}, max: ${f.heightInches[1]} },\n`;
  flavorBlock += `  weightPounds: { min: ${f.weightPounds[0]}, max: ${f.weightPounds[1]} },\n`;
  flavorBlock += `  ageYears: { min: ${f.ageYears[0]}, max: ${f.ageYears[1]} },\n`;
  flavorBlock += `};\n\n`;
}

// ─── Assemble the full name-tables.ts file ───────────────────────────────────

const FILE_HEADER = `/**
 * ============================================================================
 *  NON-RAW FLAVOR — not from any rulebook.
 * ============================================================================
 *
 * Per-species name, colouring, body, and AGE pools for the FLAVOR generators
 * (src/logic/personal-details-generation.ts), Stage A7.
 *
 * RULES-COMPLIANCE (rule 1 / rule 5): NONE of the data in this file is a game
 * mechanic and NONE is transcribed from a rulebook. These are invented,
 * D&D-flavoured suggestion pools in the spirit of each species' naming style;
 * a player can always override any generated value. No PHB citation applies
 * because no rule is being implemented. In particular, the AGE ranges are
 * invented NON-RAW flavour: the PHB 2024 has no age table, so each species'
 * band is a plausible ADULT span that merely respects that species' lifespan,
 * clearly labelled not-from-the-rulebook (rules-compliance rule 1).
 *
 * Contract (src/logic/__tests__/creation-golden.ts GENERATOR_CONTRACT): MORE
 * THAN 200 DISTINCT first names for every supported species × {male, female,
 * neutral}; eye/hair/skin pools and height/weight/age ranges vary by species.
 * The name arrays are GENERATED by scripts/gen-name-pools.mjs (edit the
 * morpheme banks there and regenerate — do not hand-edit individual names, so
 * the distinctness and > 200 floor stay guaranteed). A species-neutral fallback
 * exists for safety but is never needed to satisfy the contract.
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

/** An inclusive numeric range (e.g. a height, weight, or age band). */
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
  /** Age in years (inclusive). NON-RAW: invented plausible adult band. */
  ageYears: NumericRange;
}

`;

const FILE_FOOTER = `/** The flavor table keyed by SpeciesId. Every supported species is present. */
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

/**
 * Age range (years, inclusive) for a species (NON-RAW flavor). The PHB has no
 * age table, so this is an invented plausible adult band per species.
 */
export function ageRangeFor(species: SpeciesId): NumericRange {
  return flavorFor(species).ageYears;
}
`;

const full = FILE_HEADER + names + flavorBlock + FILE_FOOTER;

import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../src/data/name-tables.ts', import.meta.url), full, 'utf8');
process.stdout.write(`OK: wrote src/data/name-tables.ts (${full.length} chars)\n`);
