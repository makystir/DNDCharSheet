/**
 * Currency parsing and delta application for the D&D 5.5e (2024) coin purse.
 *
 * Ported in structure from PWACharSheet's src/logic/currency.ts (the parse /
 * apply / validate / transfer pipeline survives near-verbatim). The one D&D
 * change is the denomination set: WFRP's three coins (GC/SS/D) widen to the
 * five PHB coins — Platinum, Gold, Electrum, Silver, Copper.
 *
 * PHB 2024 "Coins" (Docs/PlayersHandbook.md L9247-9272): the Coin Values table
 * lists CP = 1/100 GP, SP = 1/10 GP, EP = 1/2 GP, GP = 1 (the game's main
 * coin), PP = 10 GP. Like the source app, this module NEVER auto-converts
 * between denominations — each coin is tracked and moved by its own count only.
 */

/**
 * A currency amount / delta in the five PHB denominations.
 * PHB 2024 "Coins" (L9247-9272): Platinum, Gold, Electrum, Silver, Copper.
 * This is both the stored coin-purse shape and the delta shape (a delta may be
 * signed; a stored amount is clamped >= 0 by applyCurrencyDelta).
 */
export interface CurrencyAmount {
  pp: number;
  gp: number;
  ep: number;
  sp: number;
  cp: number;
}

/** Back-compat alias: a delta is the same five-denomination shape. */
export type CurrencyDelta = CurrencyAmount;

/** A zero amount in every denomination. */
export const ZERO_CURRENCY: CurrencyAmount = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };

/**
 * Token regex: optional sign (+ or -), integer (0–999999), case-insensitive
 * suffix (pp, gp, ep, sp, cp). Whitespace between parts is allowed.
 *
 * NOTE: 'cp'/'sp'/'ep'/'pp' are all two letters ending in 'p', and 'gp' does
 * too, so there is no prefix collision (unlike WFRP's bare 'd'); the alternation
 * is listed longest-first-safe but every suffix is exactly two characters.
 */
// PHB 2024 "Coins" (L9247-9272): denomination suffixes pp|gp|ep|sp|cp.
const TOKEN_REGEX = /([+-])?\s*(\d{1,6})\s*(pp|gp|ep|sp|cp)/gi;

/**
 * Parse a currency input string into denomination deltas.
 * Tokens: optional sign (+ or -), integer (0–999999), case-insensitive suffix
 * (pp/gp/ep/sp/cp). Multiple tokens for the same denomination are summed.
 * Returns null if no valid tokens found.
 */
// PHB 2024 "Coins" (L9247-9272): the five coin denominations.
export function parseCurrencyInput(input: string): CurrencyDelta | null {
  const delta: CurrencyDelta = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
  let foundAny = false;

  let match: RegExpExecArray | null;
  // Reset lastIndex since we reuse the regex.
  TOKEN_REGEX.lastIndex = 0;

  while ((match = TOKEN_REGEX.exec(input)) !== null) {
    const sign = match[1] === '-' ? -1 : 1;
    const value = Math.min(parseInt(match[2], 10), 999999);
    const suffix = match[3].toLowerCase();

    const amount = sign * value;

    switch (suffix) {
      case 'pp':
        delta.pp += amount;
        break;
      case 'gp':
        delta.gp += amount;
        break;
      case 'ep':
        delta.ep += amount;
        break;
      case 'sp':
        delta.sp += amount;
        break;
      case 'cp':
        delta.cp += amount;
        break;
    }

    foundAny = true;
  }

  return foundAny ? delta : null;
}

/**
 * Apply currency deltas to current values, clamping each denomination to a
 * minimum of 0. NO cross-denomination conversion (the app never converts a
 * player's coins between denominations — PHB 2024 "Coins").
 */
// PHB 2024 "Coins" (L9247-9272): denominations tracked independently, no auto-convert.
export function applyCurrencyDelta(current: CurrencyDelta, delta: CurrencyDelta): CurrencyDelta {
  return {
    pp: Math.max(0, current.pp + delta.pp),
    gp: Math.max(0, current.gp + delta.gp),
    ep: Math.max(0, current.ep + delta.ep),
    sp: Math.max(0, current.sp + delta.sp),
    cp: Math.max(0, current.cp + delta.cp),
  };
}

/**
 * Validate that applying a delta to the current amount would not produce a
 * negative balance in any denomination. Returns true if the delta is safe to
 * apply, false if it would drive any denomination below 0.
 */
// PHB 2024 "Coins" (L9247-9272): each denomination validated independently.
export function validateDelta(current: CurrencyDelta, delta: CurrencyDelta): boolean {
  return (
    current.pp + delta.pp >= 0 &&
    current.gp + delta.gp >= 0 &&
    current.ep + delta.ep >= 0 &&
    current.sp + delta.sp >= 0 &&
    current.cp + delta.cp >= 0
  );
}

/**
 * Validate that a ledger entry amount is positive (strictly greater than zero).
 * Returns true only when the total across all denominations is positive.
 */
// PHB 2024 "Coins" (L9247-9272): positivity across the five denominations.
export function isValidLedgerAmount(amount: CurrencyDelta): boolean {
  return amount.pp + amount.gp + amount.ep + amount.sp + amount.cp > 0;
}

/** Why a transfer was rejected. Discriminates the failure branch of TransferResult. */
export type TransferFailureReason = 'zero-amount' | 'insufficient-funds';

/** Result of transferFunds: either the two new balances, or a typed failure. */
export type TransferResult =
  | { ok: true; source: CurrencyAmount; destination: CurrencyAmount }
  | { ok: false; reason: TransferFailureReason };

/**
 * Move `amount` from `source` to `destination`, per denomination.
 *
 * Ported from PWACharSheet's transferFunds as a GENERAL two-pool transfer. The
 * WFRP "estate/Treasury" second pool is dropped this stage — no Treasury UI is
 * wired — but the function is kept intact because it is denomination-agnostic
 * and may be reused by a later multi-pool stage. Each denomination moves by
 * exactly its own counted amount — NO cross-denomination conversion (PHB 2024
 * "Coins": the app never auto-converts between coin types).
 *
 * Validation order matters — zero is checked before funds:
 *  - Zero/empty amount (total <= 0) → { ok: false, reason: 'zero-amount' }.
 *  - Source cannot cover `amount` in every denomination →
 *    { ok: false, reason: 'insufficient-funds' } (applying −amount to source
 *    must stay >= 0 — reuses validateDelta against the negated amount).
 *
 * On success returns source − amount and destination + amount per denomination
 * via applyCurrencyDelta. Pure: never mutates its arguments.
 */
// PHB 2024 "Coins" (L9247-9272): per-denomination move, no auto-conversion.
export function transferFunds(
  source: CurrencyAmount,
  destination: CurrencyAmount,
  amount: CurrencyAmount,
): TransferResult {
  // Zero-check first: reuse the ledger-amount positivity rule.
  if (!isValidLedgerAmount(amount)) {
    return { ok: false, reason: 'zero-amount' };
  }

  // Coverage check: applying −amount to source must not go below zero in any
  // denomination — reuse the negative-balance guard against the negated amount.
  const negatedAmount: CurrencyAmount = {
    pp: -amount.pp,
    gp: -amount.gp,
    ep: -amount.ep,
    sp: -amount.sp,
    cp: -amount.cp,
  };
  if (!validateDelta(source, negatedAmount)) {
    return { ok: false, reason: 'insufficient-funds' };
  }

  // Balance math: single source of truth for the arithmetic.
  return {
    ok: true,
    source: applyCurrencyDelta(source, negatedAmount),
    destination: applyCurrencyDelta(destination, amount),
  };
}
