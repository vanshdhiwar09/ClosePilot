// src/schemas/reconciliation-result.ts
// TypeScript types and Zod runtime validation for ReconciliationResult

import { z } from "zod";

export type ReconciliationResult = z.infer<typeof reconciliationResultSchema>;

export const reconciliationResultSchema = z.object({
  id: z.string(),
  bankTransactionId: z.string(),
  candidateLedgerEntryIds: z.array(z.string()),
  matchedLedgerEntryIds: z.array(z.string()),
  status: z.enum(["matched", "exception", "review_required"]),
  matchMethod: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  amountDifference: z.string(), // decimal string, always present
  evidenceIds: z.array(z.string()),
  exceptionIds: z.array(z.string()),
  workflowVersion: z.string(),
  createdAt: z.string(),
});