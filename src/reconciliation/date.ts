// src/reconciliation/date.ts
// Deterministic calendar date calculations without timezone or floating-point ambiguity.

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/**
 * Parses an ISO YYYY-MM-DD date into UTC midnight milliseconds.
 * Throws an Error if the date string is malformed.
 */
export function parseDateUTC(dateStr: string): number {
  if (typeof dateStr !== "string" || !DATE_REGEX.test(dateStr)) {
    throw new Error(`Invalid date format (expected YYYY-MM-DD): "${dateStr}"`);
  }
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid calendar date values: "${dateStr}"`);
  }

  return Date.UTC(year, month - 1, day);
}

/**
 * Calculates the absolute difference in whole calendar days between two YYYY-MM-DD date strings.
 */
export function calculateDateDifferenceDays(dateStrA: string, dateStrB: string): number {
  const utcA = parseDateUTC(dateStrA);
  const utcB = parseDateUTC(dateStrB);
  const diffMs = Math.abs(utcA - utcB);
  return Math.floor(diffMs / MS_PER_DAY);
}

/**
 * Checks if two dates fall within a specified inclusive calendar day window.
 */
export function isWithinDateWindow(
  dateStrA: string,
  dateStrB: string,
  maxDays: number
): boolean {
  if (maxDays < 0) {
    throw new Error(`maxDays must be non-negative, received: ${maxDays}`);
  }
  return calculateDateDifferenceDays(dateStrA, dateStrB) <= maxDays;
}
