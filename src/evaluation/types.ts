// src/evaluation/types.ts
// Type definitions for ClosePilot evaluation runner, metrics calculation, and failure analysis.

export type FailureCategory =
  | "wrong_candidate"
  | "missed_duplicate"
  | "false_auto_close"
  | "missed_exception"
  | "spurious_exception"
  | "unnecessary_review"
  | "status_mismatch"
  | "threshold_policy"
  | "matching_rule_configuration";

export type CaseFailureAnalysis = {
  caseId: string;
  bankTransactionId: string;
  disagreementType:
    | "status_mismatch"
    | "candidate_mismatch"
    | "exception_mismatch"
    | "auto_close_violation";
  expectedOutcome: {
    status: string;
    autoResolutionAllowed: boolean;
    expectedLedgerEntryIds: string[];
    expectedExceptionTypes: string[];
  };
  predictedOutcome: {
    status: string;
    autoResolutionAllowed: boolean;
    matchedLedgerEntryIds: string[];
    actualExceptionTypes: string[];
  };
  explanation: string;
  recommendedCategory: FailureCategory;
  ruleTraceSummary: string[];
  evidenceIds: string[];
};

export type CaseEvaluationResult = {
  caseId: string;
  bankTransactionId: string;
  isAgreement: boolean;
  statusMatch: boolean;
  candidateMatch: boolean;
  exceptionMatch: boolean;
  autoResolutionMatch: boolean;
  expectedStatus: string;
  actualStatus: string;
  expectedAutoResolutionAllowed: boolean;
  actualAutoResolutionAllowed: boolean;
  expectedLedgerEntryIds: string[];
  actualMatchedLedgerEntryIds: string[];
  expectedExceptions: string[];
  actualExceptions: string[];
  durationMs: number;
  failure?: CaseFailureAnalysis;
};

export type EvaluationMetrics = {
  totalCases: number;
  totalAgreements: number;
  totalDisagreements: number;
  accuracy: number; // totalAgreements / totalCases

  // Six mandatory specification metrics:
  autoReconciliationRate: number; // eligible cases auto-resolved / all eligible cases
  matchPrecision: number; // correct auto-resolutions / all auto-resolutions
  exceptionRecall: number; // detected gt exceptions / total gt exceptions
  falseAutoCloseRate: number; // incorrect auto-resolutions / all auto-resolutions
  humanReviewLoad: number; // cases requiring review / total cases
  processingTime: {
    totalDurationMs: number;
    averageDurationPerCaseMs: number;
  };

  // Auditable raw counts backing the derived metrics
  counts: {
    eligibleCasesCount: number;
    eligibleAutoResolvedCount: number;
    allAutoResolutionsCount: number;
    correctAutoResolutionsCount: number;
    incorrectAutoResolutionsCount: number;
    groundTruthExceptionsCount: number;
    detectedExceptionsCount: number;
    humanReviewCount: number;
  };
};

export type EvaluationRunReport = {
  runId: string;
  fixtureVersion: string;
  workflowVersion: string;
  timestamp: string;
  metrics: EvaluationMetrics;
  caseResults: CaseEvaluationResult[];
  failures: CaseFailureAnalysis[];
};
