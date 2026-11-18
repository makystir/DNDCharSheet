/**
 * Weather tables (Dungeon Master's Guide 2024, chapter 2, printed page 38).
 * Per the text, roll 1d20 three times: temperature, wind, and precipitation.
 * Wind and precipitation share one printed table (the rows are shared, but each
 * is rolled separately). Read from the page image; dmg-group-b-tables.test.ts
 * checks that each d20 table covers 1-20 exactly once.
 */

export interface WeatherTemperatureRow {
  lo: number;
  hi: number;
  /** Printed result text. */
  text: string;
  /** For colder/hotter rows, the printed "1d4 x 10 degrees Fahrenheit" modifier. */
  shift?: { direction: 'colder' | 'hotter'; dice: '1d4'; multiplier: 10 };
}

export interface WeatherWindPrecipRow {
  lo: number;
  hi: number;
  wind: string;
  precipitation: string;
}

/** DMG 2024 p.38, Weather: Temperature (d20). */
export const WEATHER_TEMPERATURE: readonly WeatherTemperatureRow[] = [
  { lo: 1, hi: 14, text: 'Normal for the season' },
  {
    lo: 15,
    hi: 17,
    text: '1d4 x 10 degrees Fahrenheit colder',
    shift: { direction: 'colder', dice: '1d4', multiplier: 10 },
  },
  {
    lo: 18,
    hi: 20,
    text: '1d4 x 10 degrees Fahrenheit hotter',
    shift: { direction: 'hotter', dice: '1d4', multiplier: 10 },
  },
];

/** DMG 2024 p.38, Weather: Wind and Precipitation (d20, rolled separately for each). */
export const WEATHER_WIND_PRECIPITATION: readonly WeatherWindPrecipRow[] = [
  { lo: 1, hi: 12, wind: 'None', precipitation: 'None' },
  { lo: 13, hi: 17, wind: 'Light', precipitation: 'Light rain or light snowfall' },
  { lo: 18, hi: 20, wind: 'Strong', precipitation: 'Heavy rain or heavy snowfall' },
];
