import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLASS_CATALOG } from '../classes';
import { FEATURE_TURN_OPTIONS } from '../feature-turn-options';
import { TURN_OPTION_GOLDEN } from './turn-options-golden';

const PHB = join(process.cwd(), 'Docs', 'PlayersHandbook.md');

const golden = TURN_OPTION_GOLDEN.map(([cls, sub, feature, line, phrase]) => ({
  key: `${cls}|${sub}|${feature}`,
  line,
  activation: phrase === 'Bonus Action' ? 'bonus-action' : 'action',
  phrase,
}));

const data = Object.entries(FEATURE_TURN_OPTIONS).flatMap(([key, options]) =>
  options.map((o) => ({ key, line: o.phbLine, activation: o.activation })),
);

const sig = (r: { key: string; line: number; activation: string }) => `${r.key}@${r.line}:${r.activation}`;

describe('feature turn options oracle', () => {
  it('the data matches the golden exactly (no missing, no extra, same activation and line)', () => {
    expect(data.map(sig).sort()).toEqual(golden.map(sig).sort());
  });

  it('every entry names a real feature of that class or subclass', () => {
    for (const { key } of golden) {
      const [cls, sub, feature] = key.split('|');
      const data = CLASS_CATALOG[cls as keyof typeof CLASS_CATALOG];
      expect(data, key).toBeDefined();
      const features = sub === '' ? data.features : data.subclasses.find((s) => s.id === sub)?.features;
      expect(features, key).toBeDefined();
      expect(features!.some((f) => f.name === feature), key).toBe(true);
    }
  });

  it('every option has a name, and no option is a Reaction (those live on mechanics.activation)', () => {
    for (const [key, options] of Object.entries(FEATURE_TURN_OPTIONS)) {
      for (const o of options) {
        expect(o.name.trim().length, key).toBeGreaterThan(0);
        expect(['action', 'bonus-action'], key).toContain(o.activation);
      }
    }
  });

  it.skipIf(!existsSync(PHB))('the cited PHB line prints the activation words', () => {
    const lines = readFileSync(PHB, 'utf8').split('\n');
    for (const g of golden) {
      const text = lines[g.line - 1] ?? '';
      const re = g.phrase === 'Bonus Action' ? /Bonus Action/ : /Magic action/;
      expect(re.test(text), `${g.key} L${g.line}: ${text.slice(0, 80)}`).toBe(true);
    }
  });
});
