// src/schemas/evidence-item.ts
// TypeScript types and Zod runtime validation for EvidenceItem

import { z } from "zod";

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

export const evidenceItemSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "source_record",
    "match_rule",
    "calculation",
    "document",
    "validation",
    "human_decision",
    "agent_summary",
  ]),
  subjectType: z.enum(["result", "exception", "review"]),
  subjectId: z.string(),
  sourceId: z.string().optional(),
  locator: z.string().optional(),
  contentHash: z.string().optional(),
  payload: z.record(z.unknown()),
  createdAt: z.string(),
});