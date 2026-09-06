// src/review/evidence.ts
// Evidence validation and audit-evidence creation for the human review state machine.

import { EvidenceItem, evidenceItemSchema } from "../schemas/evidence-item";
import { InvalidEvidenceError } from "./types";

/**
 * Validates that all referenced evidence IDs exist in the available evidence set.
 * Throws InvalidEvidenceError explicitly if any ID is missing.
 */
export function validateEvidenceIds(
  evidenceIds: string[],
  availableEvidence: EvidenceItem[],
  caseId: string
): void {
  if (!evidenceIds || evidenceIds.length === 0) {
    return;
  }

  const availableSet = new Set(availableEvidence.map((e) => e.id));
  for (const evId of evidenceIds) {
    if (!availableSet.has(evId)) {
      throw new InvalidEvidenceError(
        `Referenced evidence ID "${evId}" does not exist for case "${caseId}". Available evidence IDs: [${Array.from(availableSet).join(", ")}]`,
        evId
      );
    }
  }
}

/**
 * Creates an auditable EvidenceItem conforming to canonical evidenceItemSchema.
 */
export function createAuditEvidenceItem(params: {
  caseId: string;
  description: string;
  payload: Record<string, unknown>;
  kind?: EvidenceItem["kind"];
  id?: string;
  sourceId?: string;
}): EvidenceItem {
  const id = params.id || `EVD-AUDIT-${params.caseId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const item: EvidenceItem = {
    id,
    kind: params.kind || "human_decision",
    subjectType: "review",
    subjectId: params.caseId,
    sourceId: params.sourceId,
    payload: {
      description: params.description,
      ...params.payload,
    },
    createdAt: new Date().toISOString(),
  };

  // Validate against canonical schema
  return evidenceItemSchema.parse(item);
}
