/**
 * Extra Attack stacking guard (level-up gap analysis, item 2).
 *
 * PHB 2024 "Multiclassing: Extra Attack" (L2113-2116): Extra Attack from more than
 * one class does not stack; no more than two attacks unless a feature says so
 * (Fighter Two/Three Extra Attacks); Thirsting Blade adds nothing on top of Extra
 * Attack. The app shows these features as text and derives NO attacks-per-action
 * total (attacks.ts "Not modelled: Extra Attack"), so nothing can over-count. These
 * tests pin the per-class data and fail if someone starts summing the numbers.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CLASS_LIST } from '../../data/classes';

const EXPECTED: Record<string, Array<[string, number, number]>> = {
  barbarian: [['Extra Attack', 5, 2]],
  fighter: [['Extra Attack', 5, 2], ['Two Extra Attacks', 11, 3], ['Three Extra Attacks', 20, 4]],
  monk: [['Extra Attack', 5, 2]],
  paladin: [['Extra Attack', 5, 2]],
  ranger: [['Extra Attack', 5, 2]],
};

describe('Extra Attack data (PHB class tables)', () => {
  it('only Barbarian, Fighter, Monk, Paladin, Ranger carry a numeric attacks value, as listed', () => {
    const found: Record<string, Array<[string, number, number]>> = {};
    for (const cls of CLASS_LIST) {
      for (const f of cls.features) {
        const attacks = (f.mechanics as { attacks?: number } | undefined)?.attacks;
        if (attacks !== undefined) (found[cls.id] ??= []).push([f.name, f.level, attacks]);
      }
    }
    expect(found).toEqual(EXPECTED);
  });
});

describe('no code derives a summed attacks-per-action total', () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return name === '__tests__' ? [] : sources(p);
      return /\.(ts|tsx)$/.test(name) ? [p] : [];
    });
  }
  it('nothing outside the class data reads mechanics.attacks (add the PHB non-stacking rule first if it must)', () => {
    const offenders = sources(join(__dirname, '..', '..'))
      .filter((p) => !p.endsWith(join('data', 'classes.ts')))
      .filter((p) => /mechanics\??\.attacks\b|attacksPerAction/.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
