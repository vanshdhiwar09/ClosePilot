// src/ui/adapter/types.ts
// Typed view models for ClosePilot frontend components.
// Strictly presentation-ready data transformed from canonical backend results.

export type WorkflowStepId = "ingest" | "match" | "investigate" | "resolve" | "report";

export type PeriodSummary = {
  periodId: string;
  periodName: string;
  workflowStatus: string;
  activeStep: WorkflowStepId;
  generatedAt: string;
};

export type OverviewKpis = {
  agreementAccuracy: string;      // e.g. "100.0%"
  agreementDetail: string;        // e.g. "8/8 verified agreement"
  falseAutoCloseRate: string;     // e.g. "0.0%"
  falseAutoCloseDetail: string;   // e.g. "Zero false closures"
  autoResolvedCount: number;      // 1
  autoResolvedAmount: string;     // "$1,250.00"
  humanReviewCount: number;       // 7
  humanReviewRatio: string;       // "7/8"
  totalCases: number;             // 8
};

export type FinancialSummary = {
  totalReconciledAmount: string;    // "$1,250.00"
  totalUnreconciledAmount: string;  // "$21,300.00"
  bankTransactionsCount: number;   // 8
  ledgerEntriesCount: number;      // 10
  supportingDocumentsCount: number;// 6
};

export type ExceptionDistributionItem = {
  type: string;
  label: string;
  count: number;
  badgeVariant: "emerald" | "amber" | "rose" | "indigo" | "neutral";
};

export type OverviewTransactionItem = {
  caseId: string;
  bankTxId: string;
  date: string;
  vendor: string;
  reference: string;
  amount: string;
  status: "auto_resolved" | "human_review" | "investigating" | "open";
  statusLabel: string;
  exceptionType?: string;
  exceptionLabel?: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  evidenceCount: number;
  recommendationAction?: string;
  recommendationReason?: string;
};

export type OverviewDataViewModel = {
  period: PeriodSummary;
  kpis: OverviewKpis;
  financials: FinancialSummary;
  exceptionsDistribution: ExceptionDistributionItem[];
  transactions: OverviewTransactionItem[];
};

// ==========================================
// Phase 7B: Exceptions & Investigation Types
// ==========================================

export type HumanReviewState =
  | "REVIEW_REQUIRED"
  | "WAITING_FOR_EVIDENCE"
  | "RESOLVED"
  | "REJECTED"
  | "AUTO_RESOLVED";

export type HumanReviewAction =
  | "APPROVE"
  | "REJECT"
  | "REQUEST_EVIDENCE"
  | "SUPPLY_EVIDENCE";

export type ExceptionCaseSummary = {
  caseId: string;
  bankTxId: string;
  date: string;
  counterparty: string;
  description: string;
  reference: string;
  amount: string;
  rawAmount: number;
  currency: string;
  exceptionType?: string;
  exceptionLabel: string;
  severity: "low" | "medium" | "high" | "critical";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reviewStatus: HumanReviewState;
  reviewStatusLabel: string;
  investigationOutcome: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  recommendationAction: string;
  recommendationReason: string;
  evidenceCount: number;
  toolCallsCount: number;
  isFlagship: boolean;
};

export type ToolTraceItemViewModel = {
  toolName: string;
  status: "completed" | "failed" | "skipped";
  durationMs: number;
  timestamp: string;
  sanitizedInput: Record<string, unknown>;
  outputSummary?: string;
};

export type EvidenceDetailViewModel = {
  id: string;
  kind: string;
  sourceId: string;
  locator: string;
  description?: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type PolicyGuardrailViewModel = {
  policyRule: string;
  isPermitted: boolean;
  policyReason: string;
  forcedHumanReview: boolean;
  timestamp: string;
};

export type DecisionHistoryViewModel = {
  id: string;
  action: HumanReviewAction;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;
  reason: string;
  timestamp: string;
  fromState: string;
  toState: string;
};

export type CaseInvestigationDetail = {
  summary: ExceptionCaseSummary;
  flaggedReason: {
    code: string;
    description: string;
    technicalDetails?: string;
    ruleTriggered?: string;
  };
  investigation: {
    investigationId: string;
    runId: string;
    outcome: string;
    summary: string;
    rootCause: string;
    recommendation: {
      action: string;
      suggestedReason: string;
      targetLedgerEntryId?: string;
      requiredEvidenceTypes?: string[];
    };
    confidence: "HIGH" | "MEDIUM" | "LOW";
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    requiresHumanReview: boolean;
    investigatedAt: string;
  };
  policyEvaluations: PolicyGuardrailViewModel[];
  toolCalls: ToolTraceItemViewModel[];
  traceEvents: Array<{
    eventType: string;
    timestamp: string;
    label: string;
  }>;
  evidence: EvidenceDetailViewModel[];
  candidateEntries: Array<{
    id: string;
    date: string;
    amount: string;
    reference?: string;
    account: string;
  }>;
  decisionHistory: DecisionHistoryViewModel[];
  allowedActions: HumanReviewAction[];
};

export interface EvidenceDocumentViewModel {
  id: string;
  name: string;
  vendor: string;
  amount: string;
  date: string;
  type: string;
  linkedCases: string[];
}
