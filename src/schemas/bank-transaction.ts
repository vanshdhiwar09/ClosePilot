// src/schemas/bank-transaction.ts
// TypeScript types and Zod runtime validation for BankTransaction
// Monetary amounts are decimal strings; no floating-point.

import { z } from "zod";

export type BankTransaction = z.infer<typeof bankTransactionSchema>;

export const bankTransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  transactionDate: z.string(),
  postedDate: z.string().optional(),
  amount: z.string(), // decimal string, no floating-point
  currency: z.string(),
  direction: z.enum(["debit", "credit"]),
  description: z.string(),
  counterparty: z.string().optional(),
  reference: z.string().optional(),
  source: z.literal("synthetic_bank"),
  sourceRecordId: z.string(),
  schemaVersion: z.literal("1"),
  ingestedAt: z.string(),
  rawHash: z.string(),
});

// Normalized comparison fields (derived, not stored in raw input)
export const normalizeBankTransaction = (raw: BankTransaction) => ({
  id: raw.id,
  accountId: raw.accountId,
  currency: raw.currency,
  amount: raw.amount,
  transactionDate: raw.transactionDate,
  postedDate: raw.postedDate,
  direction: raw.direction,
  description: raw.description,
  counterparty: raw.counterparty,
  reference: raw.reference,
  // Normalized vendor/description for comparison
  normalizedDescription: raw.description.toLowerCase().trim(),
  normalizedReference: raw.reference ? raw.reference.toUpperCase().trim() : undefined,
});