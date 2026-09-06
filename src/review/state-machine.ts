// src/review/state-machine.ts
// Deterministic Human Review State Machine for ClosePilot reconciliation exceptions.
// Manages transitions, auditable decision history, and evidence requirements without mutating source records.

import {
  ApplyActionParams,
  CaseCloseStatus,
  CaseNotFoundError,
  CaseReviewContext,
  CaseReviewInput,
  HumanReviewAction,
  HumanReviewDecision,
  HumanReviewState,
  InvalidDecisionError,
  InvalidEvidenceError,
  InvalidStateTransitionError,
  UnresolvedCaseError,
  humanReviewDecisionSchema,
} from "./types";
import { validateEvidenceIds } from "./evidence";
import { EvidenceItem } from "../schemas/evidence-item";

/**
 * Explicit canonical transition matrix.
 * REVIEW_REQUIRED -> APPROVE -> RESOLVED
 * REVIEW_REQUIRED -> REJECT -> REJECTED
 * REVIEW_REQUIRED -> REQUEST_EVIDENCE -> WAITING_FOR_EVIDENCE
 * WAITING_FOR_EVIDENCE -> SUPPLY_EVIDENCE -> REVIEW_REQUIRED
 */
export const VALID_TRANSITIONS: Record<
  HumanReviewState,
  Partial<Record<HumanReviewAction, HumanReviewState>>
> = {
  REVIEW_REQUIRED: {
    APPROVE: "RESOLVED",
    REJECT: "REJECTED",
    REQUEST_EVIDENCE: "WAITING_FOR_EVIDENCE",
  },
  WAITING_FOR_EVIDENCE: {
    SUPPLY_EVIDENCE: "REVIEW_REQUIRED",
  },
  RESOLVED: {},
  REJECTED: {},
};

/**
 * Checks whether an action can be applied from a given review state.
 */
export function canTransition(
  fromState: HumanReviewState,
  action: HumanReviewAction
): boolean {
  return Boolean(VALID_TRANSITIONS[fromState]?.[action]);
}

/**
 * Deterministic session managing human review cases, transitions, and auditable decisions.
 */
export class HumanReviewSession {
  private readonly cases = new Map<string, CaseReviewContext>();
  private readonly decisionIds = new Set<string>();

  constructor(inputs: CaseReviewInput[]) {
    for (const input of inputs) {
      if (this.cases.has(input.caseId)) {
        throw new Error(`Duplicate case ID in review session: "${input.caseId}"`);
      }

      const isAutoResolved =
        input.reconciliationOutput.autoResolutionAllowed &&
        input.reconciliationOutput.result.status === "matched";

      // Original objects are stored untouched.
      // Newly supplied evidence and decisions are appended to dedicated audit collections.
      const context: CaseReviewContext = {
        caseId: input.caseId,
        bankTransaction: input.bankTransaction,
        reconciliationOutput: input.reconciliationOutput,
        candidateLedgerEntries: input.candidateLedgerEntries || [],
        currentState: isAutoResolved ? "AUTO_RESOLVED" : "REVIEW_REQUIRED",
        isAutoResolved,
        decisionHistory: [],
        evidence: [...input.reconciliationOutput.evidence], // starts with original evidence
        outstandingEvidenceRequests: [],
      };

      this.cases.set(input.caseId, context);
    }
  }

  /**
   * Retrieves a read-only snapshot of a case by ID.
   */
  public getCase(caseId: string): Readonly<CaseReviewContext> {
    const ctx = this.cases.get(caseId);
    if (!ctx) {
      throw new CaseNotFoundError(caseId);
    }
    return {
      ...ctx,
      decisionHistory: [...ctx.decisionHistory],
      evidence: [...ctx.evidence],
      outstandingEvidenceRequests: [...ctx.outstandingEvidenceRequests],
    };
  }

  /**
   * Lists all cases in the review session.
   */
  public listCases(): Readonly<CaseReviewContext>[] {
    return Array.from(this.cases.keys()).map((id) => this.getCase(id));
  }

  /**
   * Retrieves all auditable decisions made across the session or for a specific case.
   */
  public getDecisions(caseId?: string): ReadonlyArray<HumanReviewDecision> {
    if (caseId) {
      return this.getCase(caseId).decisionHistory;
    }
    const allDecisions: HumanReviewDecision[] = [];
    for (const ctx of this.cases.values()) {
      allDecisions.push(...ctx.decisionHistory);
    }
    return allDecisions.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Applies an explicit human review action to a case.
   * Enforces transition constraints, validates evidence, creates append-only decision audit,
   * and prevents arbitrary state mutation.
   */
  public applyAction(params: ApplyActionParams): HumanReviewDecision {
    const ctx = this.cases.get(params.caseId);
    if (!ctx) {
      throw new CaseNotFoundError(params.caseId);
    }

    if (ctx.isAutoResolved) {
      throw new InvalidStateTransitionError(
        params.caseId,
        "AUTO_RESOLVED",
        params.action,
        "Case was automatically reconciled by the pipeline and does not require human review."
      );
    }

    const currentState = ctx.currentState as HumanReviewState;

    // Terminal states cannot transition further
    if (currentState === "RESOLVED" || currentState === "REJECTED") {
      throw new InvalidStateTransitionError(
        params.caseId,
        currentState,
        params.action,
        `Cannot transition from terminal state "${currentState}".`
      );
    }

    const nextState = VALID_TRANSITIONS[currentState]?.[params.action];
    if (!nextState) {
      let detail = `Allowed actions from "${currentState}": [${Object.keys(VALID_TRANSITIONS[currentState] || {}).join(", ")}]`;
      if (currentState === "WAITING_FOR_EVIDENCE" && params.action === "APPROVE") {
        detail = "A case requiring evidence cannot be approved until evidence is supplied via SUPPLY_EVIDENCE.";
      }
      throw new InvalidStateTransitionError(params.caseId, currentState, params.action, detail);
    }

    // Validate reason and reviewer
    if (!params.reason || params.reason.trim().length === 0) {
      throw new InvalidDecisionError(`Decision reason cannot be empty for action "${params.action}".`);
    }
    if (!params.reviewer || !params.reviewer.id || params.reviewer.id.trim().length === 0) {
      throw new InvalidDecisionError("Reviewer ID cannot be empty.");
    }

    // Validate decision ID uniqueness if supplied
    const decisionId =
      params.decisionId ||
      `DEC-${params.caseId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    if (this.decisionIds.has(decisionId)) {
      throw new InvalidDecisionError(`Duplicate decision ID: "${decisionId}".`);
    }

    // Handle evidence validation and additions
    const newlyAddedEvidence: EvidenceItem[] = [];
    if (params.newEvidence && params.newEvidence.length > 0) {
      for (const ev of params.newEvidence) {
        newlyAddedEvidence.push(ev);
      }
    }

    // Combine available evidence (original + previously added + new)
    const allAvailableEvidence = [...ctx.evidence, ...newlyAddedEvidence];

    // Validate referenced evidence IDs
    const referencedEvidenceIds = params.evidenceIds || [];
    validateEvidenceIds(referencedEvidenceIds, allAvailableEvidence, params.caseId);

    // Specific action logic
    if (params.action === "SUPPLY_EVIDENCE") {
      if (newlyAddedEvidence.length === 0 && referencedEvidenceIds.length === 0) {
        throw new InvalidEvidenceError(
          `SUPPLY_EVIDENCE requires providing either new evidence items or referencing valid existing evidence IDs for case "${params.caseId}".`
        );
      }
      // Add newly supplied evidence to case evidence pool without mutating original evidence
      for (const ev of newlyAddedEvidence) {
        ctx.evidence.push(ev);
      }
      // Satisfy outstanding evidence requests
      ctx.outstandingEvidenceRequests = [];
    } else if (params.action === "REQUEST_EVIDENCE") {
      ctx.outstandingEvidenceRequests.push(params.reason);
    } else if (params.action === "APPROVE") {
      if (ctx.outstandingEvidenceRequests.length > 0) {
        throw new InvalidStateTransitionError(
          params.caseId,
          currentState,
          params.action,
          `Cannot approve case with outstanding evidence requests: ${ctx.outstandingEvidenceRequests.join("; ")}`
        );
      }
    }

    // Collect all evidence IDs associated with this decision
    const decisionEvidenceIds = Array.from(
      new Set([...referencedEvidenceIds, ...newlyAddedEvidence.map((e) => e.id)])
    );

    // Build immutable decision record
    const decision: HumanReviewDecision = {
      id: decisionId,
      caseId: params.caseId,
      previousState: currentState,
      newState: nextState,
      action: params.action,
      reason: params.reason,
      reviewer: params.reviewer,
      evidenceIds: decisionEvidenceIds,
      timestamp: new Date().toISOString(),
      metadata: params.metadata,
    };

    // Validate decision structure via Zod
    humanReviewDecisionSchema.parse(decision);

    // Record decision and transition state
    this.decisionIds.add(decisionId);
    ctx.decisionHistory.push(decision);
    ctx.currentState = nextState;

    return decision;
  }

  /**
   * Deterministically determines if a case is finally closed/resolved.
   * A case is closed ONLY when:
   * 1. It was auto-resolved with high confidence and no exceptions, OR
   * 2. It was approved by a human reviewer (RESOLVED) and has no outstanding evidence requirements.
   */
  public isCaseClosed(caseId: string): boolean {
    const statusInfo = this.getCaseCloseStatus(caseId);
    return statusInfo.isClosed;
  }

  /**
   * Asserts that a case is closed; throws UnresolvedCaseError if unresolved or rejected.
   */
  public assertCaseClosed(caseId: string): void {
    const status = this.getCaseCloseStatus(caseId);
    if (!status.isClosed) {
      throw new UnresolvedCaseError(caseId, status.finalStatus, status.closureReason);
    }
  }

  /**
   * Returns complete final close status and narrative explanation for a case.
   */
  public getCaseCloseStatus(caseId: string): {
    finalStatus: CaseCloseStatus;
    isClosed: boolean;
    closureReason: string;
    outstandingRequirements: string[];
  } {
    const ctx = this.cases.get(caseId);
    if (!ctx) {
      throw new CaseNotFoundError(caseId);
    }

    if (ctx.isAutoResolved) {
      const matchMethod = ctx.reconciliationOutput.result.matchMethod;
      const matchedEntries = ctx.reconciliationOutput.result.matchedLedgerEntryIds.join(", ");
      return {
        finalStatus: "closed",
        isClosed: true,
        closureReason: `Auto-reconciled: High-confidence ${matchMethod} matched ledger entry [${matchedEntries}] with zero exceptions.`,
        outstandingRequirements: [],
      };
    }

    const state = ctx.currentState as HumanReviewState;

    if (state === "RESOLVED") {
      const approvalDecision = [...ctx.decisionHistory]
        .reverse()
        .find((d) => d.action === "APPROVE");
      const reason = approvalDecision?.reason || "Approved by reviewer.";
      const reviewer = approvalDecision?.reviewer.id || "unknown";
      return {
        finalStatus: "closed",
        isClosed: true,
        closureReason: `Resolved by human reviewer approval: ${reason} (Reviewer: ${reviewer}). All required evidence verified.`,
        outstandingRequirements: [],
      };
    }

    if (state === "REJECTED") {
      const rejectDecision = [...ctx.decisionHistory]
        .reverse()
        .find((d) => d.action === "REJECT");
      const reason = rejectDecision?.reason || "Rejected by reviewer.";
      const reviewer = rejectDecision?.reviewer.id || "unknown";
      return {
        finalStatus: "rejected",
        isClosed: false,
        closureReason: `Rejected by human reviewer: ${reason} (Reviewer: ${reviewer}). Case remains unclosed.`,
        outstandingRequirements: [],
      };
    }

    if (state === "WAITING_FOR_EVIDENCE") {
      const requests = ctx.outstandingEvidenceRequests.length > 0
        ? ctx.outstandingEvidenceRequests
        : ["Requested evidence must be provided before review can continue."];
      return {
        finalStatus: "unresolved",
        isClosed: false,
        closureReason: `Unresolved: Case is awaiting required evidence (${requests.join("; ")}).`,
        outstandingRequirements: requests,
      };
    }

    // Default for REVIEW_REQUIRED
    const exceptions = ctx.reconciliationOutput.exceptions.map((e) => e.type);
    const exDesc = exceptions.length > 0 ? `Exceptions detected: [${exceptions.join(", ")}]` : "Review required by policy";
    return {
      finalStatus: "unresolved",
      isClosed: false,
      closureReason: `Unresolved: Human review is required before this case can be closed. ${exDesc}.`,
      outstandingRequirements: ["Pending human review decision (APPROVE or REJECT)"],
    };
  }
}
