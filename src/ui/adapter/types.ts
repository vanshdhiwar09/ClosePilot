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
