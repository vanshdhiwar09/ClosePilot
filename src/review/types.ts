// src/review/types.ts
// Canonical type definitions and custom errors for ClosePilot Human Review State Machine
// and Evidence-Backed Close Package.

import { z } from "zod";
import { BankTransaction } from "../schemas/bank-transaction";
import { LedgerEntry } from "../schemas/ledger-entry";
import { ReconciliationResult } from "../schemas/reconciliation-result";
import { Exception } from "../schemas/exception";
import { EvidenceItem } from "../schemas/evidence-item";
import { RuleTraceStep } from "../reconciliation/types";
import { ReconcileTransactionOutput } from "../reconciliation/pipeline";

// ==========================================
// Custom Error Hierarchy
// ==========================================

export class ReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewError";
  }
}

export class InvalidStateTransitionError extends ReviewError {
  public readonly caseId: string;
  public readonly fromState: string;
  public readonly action: string;

  constructor(caseId: string, fromState: string, action: string, detail?: string) {
    const msg = detail
      ? `Invalid state transition for case "${caseId}": cannot apply action "${action}" from state "${fromState}". ${detail}`
      : `Invalid state transition for case "${caseId}": cannot apply action "${action}" from state "${fromState}".`;
    super(msg);
    this.name = "InvalidStateTransitionError";
    this.caseId = caseId;
    this.fromState = fromState;
    this.action = action;
  }
}

export class CaseNotFoundError extends ReviewError {
  public readonly caseId: string;

  constructor(caseId: string) {
    super(`Reconciliation case not found in review session: "${caseId}"`);
    this.name = "CaseNotFoundError";
    this.caseId = caseId;
  }
}

export class InvalidEvidenceError extends ReviewError {
  public readonly evidenceId?: string;

  constructor(message: string, evidenceId?: string) {
    super(message);
    this.name = "InvalidEvidenceError";
    this.evidenceId = evidenceId;
  }
}

export class InvalidDecisionError extends ReviewError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDecisionError";
  }
}

export class UnresolvedCaseError extends ReviewError {
  public readonly caseId: string;
  public readonly currentStatus: string;

  constructor(caseId: string, currentStatus: string, detail?: string) {
    super(`Case "${caseId}" is not closed (current status: "${currentStatus}"). ${detail || ""}`);
    this.name = "UnresolvedCaseError";
    this.caseId = caseId;
    this.currentStatus = currentStatus;
  }
}

// ==========================================
// Human Review State Machine Types
// ==========================================

export type HumanReviewState =
  | "REVIEW_REQUIRED"
  | "WAITING_FOR_EVIDENCE"
  | "RESOLVED"
  | "REJECTED";

export type HumanReviewAction =
  | "APPROVE"
  | "REJECT"
  | "REQUEST_EVIDENCE"
  | "SUPPLY_EVIDENCE";

export type Reviewer = {
  id: string;
  name?: string;
  role?: string;
};

export const reviewerSchema = z.object({
  id: z.string().min(1, "Reviewer ID cannot be empty"),
  name: z.string().optional(),
  role: z.string().optional(),
});

export type HumanReviewDecision = {
  id: string;
  caseId: string;
  previousState: HumanReviewState;
  newState: HumanReviewState;
  action: HumanReviewAction;
  reason: string;
  reviewer: Reviewer;
  evidenceIds: string[];
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export const humanReviewDecisionSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  previousState: z.enum([
    "REVIEW_REQUIRED",
    "WAITING_FOR_EVIDENCE",
    "RESOLVED",
    "REJECTED",
  ]),
  newState: z.enum([
    "REVIEW_REQUIRED",
    "WAITING_FOR_EVIDENCE",
    "RESOLVED",
    "REJECTED",
  ]),
  action: z.enum(["APPROVE", "REJECT", "REQUEST_EVIDENCE", "SUPPLY_EVIDENCE"]),
  reason: z.string().min(1, "Decision reason cannot be empty"),
  reviewer: reviewerSchema,
  evidenceIds: z.array(z.string()),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type CaseReviewInput = {
  caseId: string;
  bankTransaction: BankTransaction;
  reconciliationOutput: ReconcileTransactionOutput;
  candidateLedgerEntries?: LedgerEntry[];
};

export type CaseReviewContext = {
  caseId: string;
  bankTransaction: BankTransaction;
  reconciliationOutput: ReconcileTransactionOutput;
  candidateLedgerEntries: LedgerEntry[];
  currentState: HumanReviewState | "AUTO_RESOLVED";
  isAutoResolved: boolean;
  decisionHistory: HumanReviewDecision[];
  evidence: EvidenceItem[];
  outstandingEvidenceRequests: string[];
};

export type ApplyActionParams = {
  caseId: string;
  action: HumanReviewAction;
  reviewer: Reviewer;
  reason: string;
  decisionId?: string;
  evidenceIds?: string[];
  newEvidence?: EvidenceItem[];
  metadata?: Record<string, unknown>;
};

// ==========================================
// Close Package Types
// ==========================================

export type CaseCloseStatus = "closed" | "rejected" | "unresolved";

export type CaseCloseRecord = {
  caseId: string;
  bankTransactionId: string;
  finalStatus: CaseCloseStatus;
  isClosed: boolean;
  closureReason: string;
  sourceTransaction: BankTransaction;
  reconciliationResult: ReconciliationResult;
  candidateLedgerEntries: LedgerEntry[];
  ruleTrace: RuleTraceStep[];
  exceptions: Exception[];
  evidence: EvidenceItem[];
  humanReviewState?: HumanReviewState;
  decisionHistory: HumanReviewDecision[];
  outstandingRequirements: string[];
};

export type ClosePackageSummary = {
  totalCases: number;
  automaticallyResolvedCases: number;
  humanReviewedCases: number;
  approvedCases: number;
  rejectedCases: number;
  unresolvedCases: number;
  allCasesClosed: boolean;
  totalReconciledAmount: string; // 2-decimal string computed via BigInt cents
  totalUnreconciledAmount: string; // 2-decimal string computed via BigInt cents
  exceptionCounts: Record<string, number>;
};

export type ClosePackage = {
  packageId: string;
  period: string;
  workflowVersion: string;
  generatedAt: string;
  summary: ClosePackageSummary;
  cases: CaseCloseRecord[];
  metadata: {
    engineVersion: string;
    environment: string;
  };
};
