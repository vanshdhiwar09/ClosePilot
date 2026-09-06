// src/schemas/ledger-entry.ts
// TypeScript types and Zod runtime validation for LedgerEntry
// Monetary amounts are decimal strings; no floating-point.

import { z } from "zod";
import { subtractMoney } from "../utils/money";

export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export const ledgerEntrySchema = z.object({
  id: z.string(),
  accountId: z.string(),
  entryDate: z.string(),
  postingDate: z.string().optional(),
  debit: z.string(), // decimal string
  credit: z.string(), // decimal string
  currency: z.string(),
  vendor: z.string().optional(),
  memo: z.string().optional(),
  reference: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  source: z.enum(["synthetic_ledger", "synthetic_subledger"]),
  sourceRecordId: z.string(),
  schemaVersion: z.literal("1"),
  ingestedAt: z.string(),
  rawHash: z.string(),
});

// Derived signed amount: debit - credit (computed deterministically via BigInt cents)
export const getLedgerSignedAmount = (entry: LedgerEntry): string => {
  return subtractMoney(entry.debit, entry.credit);
};

// Normalized comparison fields
export const normalizeLedgerEntry = (entry: LedgerEntry) => ({
  id: entry.id,
  accountId: entry.accountId,
  currency: entry.currency,
  signedAmount: getLedgerSignedAmount(entry),
  entryDate: entry.entryDate,
  postingDate: entry.postingDate,
  vendor: entry.vendor,
  memo: entry.memo,
  reference: entry.reference,
  normalizedVendor: entry.vendor ? entry.vendor.toLowerCase().trim() : undefined,
  normalizedReference: entry.reference ? entry.reference.toUpperCase().trim() : undefined,
});