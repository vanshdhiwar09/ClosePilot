// src/reconciliation/normalize.ts
// Deterministic normalization utilities for vendor names, references, and descriptions.

/**
 * Normalizes a general string: trims, lowercases, and collapses multiple whitespaces into a single space.
 */
export function normalizeText(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Normalizes a financial reference code (e.g., invoice number, payment ref):
 * Trims, uppercases, and normalizes internal whitespace.
 */
export function normalizeReference(reference: string | undefined | null): string | undefined {
  if (!reference) return undefined;
  const trimmed = reference.trim().toUpperCase().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Normalizes a vendor or counterparty name:
 * Lowercases, strips common legal suffixes (Inc, LLC, Corp, Ltd), applies alias dictionary if provided,
 * and collapses whitespace.
 */
export function normalizeVendor(
  vendor: string | undefined | null,
  aliases?: Record<string, string>
): string | undefined {
  if (!vendor) return undefined;
  let normalized = normalizeText(vendor);
  if (!normalized) return undefined;

  // Check explicit aliases first (case-insensitive lookup)
  if (aliases) {
    const aliasMatch = aliases[normalized];
    if (aliasMatch) {
      return normalizeText(aliasMatch);
    }
  }

  // Remove common corporate suffixes for more resilient matching
  normalized = normalized
    .replace(/[,.]?\s+(inc|incorporated|llc|corp|corporation|ltd|limited|co|company)\.?$/i, "")
    .trim();

  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Tokenizes text into distinctive lowercase alphanumeric words, filtering out short stop words.
 */
const COMMON_STOP_WORDS = new Set([
  "a", "an", "the", "to", "for", "of", "and", "in", "on", "at", "by",
  "payment", "invoice", "inv", "bill", "pmt", "transfer", "wire", "ach", "fee"
]);

export function tokenizeText(text: string | undefined | null): string[] {
  if (!text) return [];
  const normalized = normalizeText(text);
  const words = normalized.split(/[^a-z0-9]+/);
  return Array.from(
    new Set(
      words.filter((w) => w.length > 1 && !COMMON_STOP_WORDS.has(w))
    )
  );
}

/**
 * Computes the number of overlapping unique tokens between two texts.
 */
export function computeTokenOverlap(
  textA: string | undefined | null,
  textB: string | undefined | null
): number {
  const tokensA = new Set(tokenizeText(textA));
  const tokensB = tokenizeText(textB);
  let overlap = 0;
  for (const token of tokensB) {
    if (tokensA.has(token)) {
      overlap += 1;
    }
  }
  return overlap;
}
