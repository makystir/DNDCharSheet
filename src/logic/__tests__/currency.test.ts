import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  type CurrencyAmount,
  ZERO_CURRENCY,
  parseCurrencyInput,
  applyCurrencyDelta,
  validateDelta,
  isValidLedgerAmount,
  transferFunds,
} from '../currency';

function amount(partial: Partial<CurrencyAmount>): CurrencyAmount {
  return { ...ZERO_CURRENCY, ...partial };
}

describe('parseCurrencyInput', () => {
  it('parses a single signed token in each denomination', () => {
    expect(parseCurrencyInput('+2pp')).toEqual(amount({ pp: 2 }));
    expect(parseCurrencyInput('+2gp')).toEqual(amount({ gp: 2 }));
    expect(parseCurrencyInput('+2ep')).toEqual(amount({ ep: 2 }));
    expect(parseCurrencyInput('+2sp')).toEqual(amount({ sp: 2 }));
    expect(parseCurrencyInput('+2cp')).toEqual(amount({ cp: 2 }));
  });

  it('is case-insensitive and tolerant of whitespace', () => {
    expect(parseCurrencyInput('+2 GP -5 SP +10 CP')).toEqual(
      amount({ gp: 2, sp: -5, cp: 10 }),
    );
    expect(parseCurrencyInput('  3Pp   4cP ')).toEqual(amount({ pp: 3, cp: 4 }));
  });

  it('sums multiple tokens of the same denomination (signed)', () => {
    expect(parseCurrencyInput('+5gp +3gp -2gp')).toEqual(amount({ gp: 6 }));
  });

  it('parses a full five-denomination signed multi-token string', () => {
    expect(parseCurrencyInput('-1pp +2gp +3ep -4sp +5cp')).toEqual(
      amount({ pp: -1, gp: 2, ep: 3, sp: -4, cp: 5 }),
    );
  });

  it('treats a bare number sign as + when absent', () => {
    expect(parseCurrencyInput('7gp')).toEqual(amount({ gp: 7 }));
  });

  it('accepts the maximum six-digit token value (999999) unchanged', () => {
    // The token regex matches 1–6 digits, and each matched value is clamped at
    // 999999 (Math.min). A six-digit max passes through unchanged.
    expect(parseCurrencyInput('999999gp')).toEqual(amount({ gp: 999999 }));
  });

  it('returns null when there are no valid tokens', () => {
    expect(parseCurrencyInput('')).toBeNull();
    expect(parseCurrencyInput('hello')).toBeNull();
    expect(parseCurrencyInput('+5')).toBeNull(); // no denomination suffix
    expect(parseCurrencyInput('5xp')).toBeNull(); // unknown suffix
  });
});

describe('applyCurrencyDelta', () => {
  it('adds per denomination', () => {
    expect(applyCurrencyDelta(amount({ gp: 10, sp: 5 }), amount({ gp: 2, sp: -3 }))).toEqual(
      amount({ gp: 12, sp: 2 }),
    );
  });

  it('clamps each denomination at 0 and never cross-converts', () => {
    // sp goes negative → clamped to 0; gp is NOT reduced to "pay" for it.
    const result = applyCurrencyDelta(amount({ gp: 5, sp: 2 }), amount({ sp: -10 }));
    expect(result).toEqual(amount({ gp: 5, sp: 0 }));
  });

  it('clamps every denomination independently', () => {
    const result = applyCurrencyDelta(ZERO_CURRENCY, {
      pp: -1,
      gp: -1,
      ep: -1,
      sp: -1,
      cp: -1,
    });
    expect(result).toEqual(ZERO_CURRENCY);
  });

  it('property: no denomination ever goes below 0', () => {
    const coin = fc.integer({ min: 0, max: 100000 });
    const d = fc.integer({ min: -100000, max: 100000 });
    fc.assert(
      fc.property(coin, coin, coin, coin, coin, d, d, d, d, d, (pp, gp, ep, sp, cp, a, b, c, e, f) => {
        const r = applyCurrencyDelta(amount({ pp, gp, ep, sp, cp }), amount({ pp: a, gp: b, ep: c, sp: e, cp: f }));
        expect(r.pp).toBeGreaterThanOrEqual(0);
        expect(r.gp).toBeGreaterThanOrEqual(0);
        expect(r.ep).toBeGreaterThanOrEqual(0);
        expect(r.sp).toBeGreaterThanOrEqual(0);
        expect(r.cp).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

describe('validateDelta', () => {
  it('is true when every denomination stays >= 0', () => {
    expect(validateDelta(amount({ gp: 5, sp: 5 }), amount({ gp: -5, sp: -5 }))).toBe(true);
  });

  it('is false when any denomination would go negative', () => {
    expect(validateDelta(amount({ gp: 5 }), amount({ gp: -6 }))).toBe(false);
    expect(validateDelta(amount({ gp: 5, cp: 0 }), amount({ cp: -1 }))).toBe(false);
  });
});

describe('isValidLedgerAmount', () => {
  it('is true only when the total across denominations is strictly positive', () => {
    expect(isValidLedgerAmount(amount({ gp: 1 }))).toBe(true);
    expect(isValidLedgerAmount(amount({ cp: 1 }))).toBe(true);
    expect(isValidLedgerAmount(ZERO_CURRENCY)).toBe(false);
    // A zero net (e.g. +1gp -1gp already summed) is not positive.
    expect(isValidLedgerAmount(amount({ gp: 1, sp: -10 }))).toBe(false);
  });
});

describe('transferFunds', () => {
  it('moves each denomination from source to destination without conversion', () => {
    const result = transferFunds(
      amount({ pp: 1, gp: 10, sp: 5 }),
      amount({ gp: 1 }),
      amount({ gp: 4, sp: 2 }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toEqual(amount({ pp: 1, gp: 6, sp: 3 }));
      expect(result.destination).toEqual(amount({ gp: 5, sp: 2 }));
    }
  });

  it('rejects a zero amount before checking funds', () => {
    const result = transferFunds(ZERO_CURRENCY, ZERO_CURRENCY, ZERO_CURRENCY);
    expect(result).toEqual({ ok: false, reason: 'zero-amount' });
  });

  it('rejects when the source cannot cover the amount in any denomination', () => {
    const result = transferFunds(amount({ gp: 3 }), ZERO_CURRENCY, amount({ gp: 4 }));
    expect(result).toEqual({ ok: false, reason: 'insufficient-funds' });
  });

  it('does not mutate its arguments', () => {
    const source = amount({ gp: 10 });
    const dest = amount({ gp: 0 });
    const amt = amount({ gp: 5 });
    transferFunds(source, dest, amt);
    expect(source).toEqual(amount({ gp: 10 }));
    expect(dest).toEqual(amount({ gp: 0 }));
    expect(amt).toEqual(amount({ gp: 5 }));
  });

  it('property: successful transfer conserves total coins per denomination', () => {
    const coin = fc.integer({ min: 0, max: 10000 });
    fc.assert(
      fc.property(coin, coin, coin, (srcGp, dstGp, moveGp) => {
        const source = amount({ gp: srcGp });
        const dest = amount({ gp: dstGp });
        const amt = amount({ gp: moveGp });
        const result = transferFunds(source, dest, amt);
        if (result.ok) {
          expect(result.source.gp + result.destination.gp).toBe(srcGp + dstGp);
        }
      }),
    );
  });
});
