// src/schemas/human-review.ts
// TypeScript types and Zod runtime validation for HumanReview

import { z } from "zod";

export type HumanReview = z.infer<typeof humanReviewSchema>;

export const humanReviewSchema = z.object({
  id: z.string(),
  resultId: z.string(),
  state: z.enum([
    "queued",
    "claimed",
    "approved",
    "rejected",
    "needs_information",
    "escalated",
  ]),
  reviewerId: z.string().optional(),
  decision: z
    .enum([
      "approve_match",
      "reject_match",
      "classify_timing",
      "mark_duplicate",
      "request_evidence",
      "escalate",
    ])
    .optional(),
  rationale: z.string().optional(),
  evidenceIds: z.array(z.string()),
  createdAt: z.string(),
  decidedAt: z.string().optional(),
});