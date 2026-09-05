// src/schemas/exception.ts
// TypeScript types and Zod runtime validation for Exception

import { z } from "zod";

export type Exception = z.infer<typeof exceptionSchema>;

export const exceptionSchema = z.object({
  id: z.string(),
  resultId: z.string(),
  type: z.enum([
    "unmatched_transaction",
    "amount_mismatch",
    "timing_difference",
    "duplicate",
    "missing_documentation",
    "potential_anomaly",
  ]),
  severity: z.enum(["low", "medium", "high"]),
  status: z.enum(["open", "in_review", "resolved", "dismissed"]),
  reasonCode: z.string(),
  evidenceIds: z.array(z.string()),
  createdAt: z.string(),
});