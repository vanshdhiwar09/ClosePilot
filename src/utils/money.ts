// src/utils/money.ts
// Deterministic monetary arithmetic using BigInt cents.
// Floating-point arithmetic (parseFloat, Number, Math.round) is strictly prohibited.

const MONEY_REGEX = /^[+-]?(?:\d+)(?:\.\d{1,2})?$/;

/**
 * Converts a decimal monetary string into a signed BigInt representing cents.
 * e.g., "1250.00" -> 125000n, "-50.25" -> -5025n, "100" -> 10000n, "10.5" -> 1050n
 * Throws an Error if the input is malformed.
 */
export function parseCents(amount: string): bigint {
  if (typeof amount !== "string") {
    throw new Error(`Monetary amount must be a string, received: ${typeof amount}`);
  }

  const trimmed = amount.trim();
  if (!trimmed || !MONEY_REGEX.test(trimmed)) {
    throw new Error(`Invalid monetary amount format: "${amount}"`);
  }

  const isNegative = trimmed.startsWith("-");
  const cleanStr = isNegative || trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;

  const [wholeStr, fracStr = ""] = cleanStr.split(".");
  const paddedFracStr = fracStr.padEnd(2, "0");

  const whole = BigInt(wholeStr);
  const frac = BigInt(paddedFracStr);
  const totalCents = whole * 100n + frac;

  return isNegative ? -totalCents : totalCents;
}

/**
 * Formats a BigInt representing cents into a standard 2-decimal monetary string.
 * e.g., 125000n -> "1250.00", -5025n -> "-50.25", 0n -> "0.00", 5n -> "0.05", -5n -> "-0.05"
 */
export function formatCents(cents: bigint): string {
  if (typeof cents !== "bigint") {
    throw new Error(`Cents must be a bigint, received: ${typeof cents}`);
  }

  const isNegative = cents < 0n;
  const absCents = isNegative ? -cents : cents;

  const whole = absCents / 100n;
  const frac = absCents % 100n;
  const fracStr = frac < 10n ? `0${frac.toString()}` : frac.toString();

  const formatted = `${whole.toString()}.${fracStr}`;
  return isNegative && absCents !== 0n ? `-${formatted}` : formatted;
}

/**
 * Calculates absolute value of BigInt cents.
 */
export function absCents(cents: bigint): bigint {
  return cents < 0n ? -cents : cents;
}

/**
 * Adds two monetary decimal strings deterministically.
 */
export function addMoney(a: string, b: string): string {
  return formatCents(parseCents(a) + parseCents(b));
}

/**
 * Subtracts monetary string b from a deterministically (a - b).
 */
export function subtractMoney(a: string, b: string): string {
  return formatCents(parseCents(a) - parseCents(b));
}

/**
 * Returns the absolute difference between two monetary strings as a decimal string (|a - b|).
 */
export function absDifferenceMoney(a: string, b: string): string {
  return formatCents(absCents(parseCents(a) - parseCents(b)));
}

/**
 * Compares two monetary strings. Returns -1 if a < b, 1 if a > b, 0 if a === b.
 */
export function compareMoney(a: string, b: string): number {
  const diff = parseCents(a) - parseCents(b);
  if (diff < 0n) return -1;
  if (diff > 0n) return 1;
  return 0;
}

/**
 * Checks if two monetary strings represent the exact same value.
 */
export function isEqualMoney(a: string, b: string): boolean {
  return parseCents(a) === parseCents(b);
}

/**
 * Checks if a monetary string evaluates to exactly zero cents.
 */
export function isZeroMoney(amount: string): boolean {
  return parseCents(amount) === 0n;
}

/**
 * Formats a decimal string into standard currency format with commas and dollar sign ($X,XXX.XX).
 */
export function formatCurrency(amount: string): string {
  const parts = amount.split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decPart = (parts[1] || "00").padEnd(2, "0").slice(0, 2);
  return `$${intPart}.${decPart}`;
}
