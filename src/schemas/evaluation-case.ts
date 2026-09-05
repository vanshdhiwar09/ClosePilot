// src/schemas/evaluation-case.ts
// TypeScript types and Zod runtime validation for EvaluationCase

import { z } from "zod";

export type EvaluationCase = z.infer<typeof evaluationCaseSchema>;

export const evaluationCaseSchema = z.object({
  id: z.string(),
  fixtureVersion: z.string(),
  bankTransactionId: z.string(),
  expectedLedgerEntryIds: z.array(z.string()),
  expectedStatus: z.enum(["matched", "exception", "review_required"]),
  expectedExceptionTypes: z
    .array(
      z.enum([
        "unmatched_transaction",
        "amount_mismatch",
        "timing_difference",
        "duplicate",
        "missing_documentation",
        "potential_anomaly",
      ])
    )
    .optional(),
  expectedAutoResolutionAllowed: z.boolean(),
  notes: z.string().optional(),
});

export const isReviewRequired = (
  status: EvaluationCase["expectedStatus"]
): status is "review_required" => status === "review_required";
export const isMatched = (
  status: EvaluationCase["expectedStatus"]
): status is "matched" => status === "matched";
export const isException = (
  status: EvaluationCase["expectedStatus"]
): status is "exception" => status === "exception";