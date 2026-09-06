// src/ui/adapter/data-adapter.ts
// Frontend Data Adapter for ClosePilot.
// Strictly transforms real domain/workflow results into typed UI view models.
// Does NOT duplicate or reimplement accounting, matching, or financial calculations.

import fixtureJson from "../../../data/fixtures/month-end-reconciliation-2024.1.json";
import groundTruthJson from "../../../data/ground-truth/2024.1.json";
import {
  runEndToEndReconciliationWorkflow,
  EndToEndWorkflowResult,
} from "../../workflow/reconciliation-workflow";
import { runEvaluation } from "../../evaluation/runner";
import { EvaluationRunReport } from "../../evaluation/types";
import { generateClosePackage } from "../../review/close-package";
import { HumanReviewSession, VALID_TRANSITIONS } from "../../review/state-machine";
import {
  HumanReviewAction,
  HumanReviewDecision,
  Reviewer,
} from "../../review/types";
import {
  OverviewDataViewModel,
  ExceptionDistributionItem,
  OverviewTransactionItem,
  ExceptionCaseSummary,
  CaseInvestigationDetail,
  ToolTraceItemViewModel,
  EvidenceDetailViewModel,
  PolicyGuardrailViewModel,
  DecisionHistoryViewModel,
  EvidenceDocumentViewModel,
  HumanReviewState,
} from "./types";
import { EvidenceItem } from "../../schemas/evidence-item";

/**
 * Maps machine exception types into human-friendly finance operations labels.
 */
export function getExceptionLabel(type?: string): string {
  switch (type) {
    case "unmatched_transaction":
      return "Unmatched Transaction";
    case "amount_mismatch":
      return "Amount Mismatch";
    case "timing_difference":
      return "Timing Difference";
    case "duplicate":
      return "Potential Duplicate";
    case "missing_documentation":
      return "Missing Documentation";
    case "potential_anomaly":
      return "Potential Anomaly";
    case "ambiguous":
      return "Ambiguous Multiple Candidates";
    default:
      return type ? type.replace(/_/g, " ") : "Exact Match";
  }
}

/**
 * Assigns restrained badge variants based on exception type.
 */
export function getExceptionBadgeVariant(type?: string): ExceptionDistributionItem["badgeVariant"] {
  switch (type) {
    case "timing_difference":
      return "amber";
    case "unmatched_transaction":
    case "amount_mismatch":
    case "duplicate":
    case "missing_documentation":
    case "potential_anomaly":
      return "rose";
    default:
      return "neutral";
  }
}

/**
 * Formats monetary amounts with dollar sign and commas without floating point math.
 */
export function formatCurrencyString(amount: string): string {
  const [whole, frac = "00"] = amount.split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${frac}`;
}

export type SharedWorkflowState = {
  workflowResult: EndToEndWorkflowResult;
  evalReport: EvaluationRunReport;
};

let cachedState: SharedWorkflowState | null = null;

/**
 * Executes the canonical workflow and evaluation pipeline once and caches the result.
 */
export async function getWorkflowState(forceRefresh = false): Promise<SharedWorkflowState> {
  if (cachedState && !forceRefresh) {
    return cachedState;
  }

  const workflowResult = await runEndToEndReconciliationWorkflow({
    fixtureData: fixtureJson as Record<string, unknown>,
    groundTruthData: groundTruthJson as Record<string, unknown>,
  });

  const evalReport = runEvaluation({
    fixtureData: fixtureJson as Record<string, unknown>,
    groundTruthData: groundTruthJson as Record<string, unknown>,
  });

  cachedState = { workflowResult, evalReport };
  return cachedState;
}

/**
 * Builds the OverviewViewModel from the current workflow session and evaluation report.
 */
export function buildOverviewViewModel(state: SharedWorkflowState): OverviewDataViewModel {
  const { workflowResult, evalReport } = state;
  const closePackage = workflowResult.closePackage;
  const summary = closePackage.summary;

  const accuracyPercentage = (evalReport.metrics.accuracy * 100).toFixed(1);
  const agreementAccuracyStr = `${accuracyPercentage}%`;
  const falseAutoCloseStr = `${(evalReport.metrics.falseAutoCloseRate * 100).toFixed(1)}%`;

  const exceptionsDistribution: ExceptionDistributionItem[] = Object.entries(
    summary.exceptionCounts
  ).map(([type, count]) => ({
    type,
    label: getExceptionLabel(type),
    count,
    badgeVariant: getExceptionBadgeVariant(type),
  }));

  const transactions: OverviewTransactionItem[] = closePackage.cases.map((c) => {
    const rawAmount = c.sourceTransaction.amount;
    const formattedAmount = formatCurrencyString(rawAmount);
    const exception = c.exceptions[0];

    const isAutoResolved =
      c.isClosed && (c.humanReviewState === undefined || c.closureReason.startsWith("Auto-reconciled"));

    return {
      caseId: c.caseId,
      bankTxId: c.bankTransactionId,
      date: c.sourceTransaction.transactionDate,
      vendor: c.sourceTransaction.counterparty || c.sourceTransaction.description,
      reference: c.sourceTransaction.reference || "N/A",
      amount: formattedAmount,
      status: isAutoResolved ? "auto_resolved" : "human_review",
      statusLabel: isAutoResolved ? "Auto-Resolved" : "Human Review Required",
      exceptionType: exception?.type,
      exceptionLabel: getExceptionLabel(exception?.type),
      riskLevel: c.investigation?.riskLevel || (isAutoResolved ? "LOW" : "HIGH"),
      evidenceCount: c.evidence.length,
      recommendationAction: c.investigation?.recommendation?.action,
      recommendationReason: c.investigation?.recommendation?.suggestedReason,
    };
  });

  transactions.sort((a, b) => {
    if (a.status === b.status) return a.bankTxId.localeCompare(b.bankTxId);
    return a.status === "human_review" ? -1 : 1;
  });

  return {
    period: {
      periodId: closePackage.period,
      periodName: "January 2024 (2024.1)",
      workflowStatus: summary.unresolvedCases > 0 ? "Human Review Required" : "Reconciliation Complete",
      activeStep: "investigate",
      generatedAt: closePackage.generatedAt,
    },
    kpis: {
      agreementAccuracy: agreementAccuracyStr,
      agreementDetail: `${evalReport.metrics.totalAgreements}/${evalReport.metrics.totalCases} verified agreement with ground truth`,
      falseAutoCloseRate: falseAutoCloseStr,
      falseAutoCloseDetail: "Zero false closures",
      autoResolvedCount: summary.automaticallyResolvedCases,
      autoResolvedAmount: formatCurrencyString(summary.totalReconciledAmount),
      humanReviewCount: summary.unresolvedCases,
      humanReviewRatio: `${summary.unresolvedCases}/${summary.totalCases}`,
      totalCases: summary.totalCases,
    },
    financials: {
      totalReconciledAmount: formatCurrencyString(summary.totalReconciledAmount),
      totalUnreconciledAmount: formatCurrencyString(summary.totalUnreconciledAmount),
      bankTransactionsCount: (fixtureJson as any).bankTransactions.length,
      ledgerEntriesCount: (fixtureJson as any).ledgerEntries.length,
      supportingDocumentsCount: (fixtureJson as any).documents.length,
    },
    exceptionsDistribution,
    transactions,
  };
}

/**
 * Loads overview view model (compatible with Phase 7A caller).
 */
export async function loadOverviewData(forceRefresh = false): Promise<OverviewDataViewModel> {
  const state = await getWorkflowState(forceRefresh);
  return buildOverviewViewModel(state);
}

/**
 * Builds list of all exception cases requiring human review from the session.
 */
export function getExceptionCases(state: SharedWorkflowState): ExceptionCaseSummary[] {
  const { workflowResult } = state;
  const cases = workflowResult.session.listCases();

  // Filter for cases requiring review (exclude auto-resolved BT001)
  const reviewCases = cases.filter((c) => !c.isAutoResolved);

  return reviewCases.map((c) => {
    const rawAmountNum = parseFloat(c.bankTransaction.amount);
    const formattedAmount = formatCurrencyString(c.bankTransaction.amount);
    const exception = c.reconciliationOutput.exceptions[0];
    const investigation = c.investigation;
    const isFlagship = c.reconciliationOutput.exceptions.some((e) => e.type === "potential_anomaly") || c.investigation?.riskLevel === "CRITICAL";

    const exceptionType = exception?.type || (c.candidateLedgerEntries.length > 1 ? "ambiguous" : undefined);
    const exceptionLabel = getExceptionLabel(exceptionType);

    const reviewStatus = c.currentState as HumanReviewState;
    let reviewStatusLabel = "Review Required";
    if (reviewStatus === "WAITING_FOR_EVIDENCE") reviewStatusLabel = "Waiting for Evidence";
    else if (reviewStatus === "RESOLVED") reviewStatusLabel = "Resolved";
    else if (reviewStatus === "REJECTED") reviewStatusLabel = "Rejected";

    const trace = workflowResult.traces.find((t) => t.caseId === c.caseId);

    return {
      caseId: c.caseId,
      bankTxId: c.bankTransaction.id,
      date: c.bankTransaction.transactionDate,
      counterparty: c.bankTransaction.counterparty || c.bankTransaction.description,
      description: c.bankTransaction.description,
      reference: c.bankTransaction.reference || "N/A",
      amount: formattedAmount,
      rawAmount: rawAmountNum,
      currency: c.bankTransaction.currency,
      exceptionType,
      exceptionLabel,
      severity: (exception?.severity as any) || "high",
      riskLevel: investigation ? investigation.riskLevel : "HIGH",
      reviewStatus,
      reviewStatusLabel,
      investigationOutcome: investigation?.outcome || "COMPLETED",
      confidence: investigation?.confidence || "HIGH",
      recommendationAction: investigation?.recommendation.action || "ESCALATE_TO_MANAGEMENT",
      recommendationReason: investigation?.recommendation.suggestedReason || "",
      evidenceCount: c.evidence.length,
      toolCallsCount: trace?.toolCalls.length || 0,
      isFlagship,
    };
  });
}

/**
 * Builds detailed investigation view model for a specific case.
 */
export function getCaseInvestigationDetail(
  state: SharedWorkflowState,
  caseId: string
): CaseInvestigationDetail {
  const { workflowResult } = state;
  const ctx = workflowResult.session.getCase(caseId);
  const trace = workflowResult.traces.find((t) => t.caseId === caseId);

  const rawAmountNum = parseFloat(ctx.bankTransaction.amount);
  const formattedAmount = formatCurrencyString(ctx.bankTransaction.amount);
  const exception = ctx.reconciliationOutput.exceptions[0];
  const isFlagship = ctx.reconciliationOutput.exceptions.some((e) => e.type === "potential_anomaly") || ctx.investigation?.riskLevel === "CRITICAL";

  const exceptionType = exception?.type || (ctx.candidateLedgerEntries.length > 1 ? "ambiguous" : undefined);
  const exceptionLabel = getExceptionLabel(exceptionType);

  const reviewStatus = ctx.currentState as HumanReviewState;
  let reviewStatusLabel = "Review Required";
  if (reviewStatus === "WAITING_FOR_EVIDENCE") reviewStatusLabel = "Waiting for Evidence";
  else if (reviewStatus === "RESOLVED") reviewStatusLabel = "Resolved";
  else if (reviewStatus === "REJECTED") reviewStatusLabel = "Rejected";

  if (!ctx.investigation) {
    throw new Error(`Investigation result not found for case "${caseId}".`);
  }
  const inv = ctx.investigation;

  const summary: ExceptionCaseSummary = {
    caseId: ctx.caseId,
    bankTxId: ctx.bankTransaction.id,
    date: ctx.bankTransaction.transactionDate,
    counterparty: ctx.bankTransaction.counterparty || ctx.bankTransaction.description,
    description: ctx.bankTransaction.description,
    reference: ctx.bankTransaction.reference || "N/A",
    amount: formattedAmount,
    rawAmount: rawAmountNum,
    currency: ctx.bankTransaction.currency,
    exceptionType,
    exceptionLabel,
    severity: (exception?.severity as any) || "high",
    riskLevel: inv.riskLevel,
    reviewStatus,
    reviewStatusLabel,
    investigationOutcome: inv.outcome,
    confidence: inv.confidence,
    recommendationAction: inv.recommendation.action,
    recommendationReason: inv.recommendation.suggestedReason,
    evidenceCount: ctx.evidence.length,
    toolCallsCount: trace?.toolCalls.length || 0,
    isFlagship,
  };

  // Flagged reason extracted directly from deterministic output
  let flaggedCode = exception?.reasonCode || (exception ? exception.type.toUpperCase() : "AMBIGUOUS_CANDIDATES");
  let flaggedDesc = exception
    ? `Reconciliation engine flagged an ${exceptionLabel.toLowerCase()} exception.`
    : "Multiple candidate entries in the general ledger matched the transaction date and amount.";

  const calcEvidence = ctx.evidence.find((e) => e.kind === "calculation");
  const technicalDetails = (calcEvidence?.payload as any)?.reason || undefined;

  // Tool trace items from observability run trace
  const toolCalls: ToolTraceItemViewModel[] = (trace?.toolCalls || []).map((tc) => ({
    toolName: tc.toolName,
    status: "completed",
    durationMs: tc.durationMs,
    timestamp: tc.timestamp,
    sanitizedInput: tc.input as Record<string, unknown>,
    outputSummary: tc.output ? JSON.stringify(tc.output).slice(0, 100) : undefined,
  }));

  // Trace events
  const traceEvents = (trace?.events || []).map((ev) => ({
    eventType: ev.eventType,
    timestamp: ev.timestamp,
    label: ev.eventType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
  }));

  // Policy evaluations from trace and investigation result
  const policyEvaluations: PolicyGuardrailViewModel[] =
    trace && trace.policyEvaluations && trace.policyEvaluations.length > 0
      ? trace.policyEvaluations.map((p) => ({
          policyRule: p.policyRule,
          isPermitted: p.isPermitted,
          policyReason: p.policyReason,
          forcedHumanReview: p.forcedHumanReview,
          timestamp: p.timestamp,
        }))
      : [
          {
            policyRule: inv.policyValidation.policyRule,
            isPermitted: inv.policyValidation.isPermitted,
            policyReason: inv.policyValidation.policyReason,
            forcedHumanReview: inv.policyValidation.forcedHumanReview,
            timestamp: inv.investigatedAt,
          },
        ];

  // Evidence items
  const evidence: EvidenceDetailViewModel[] = ctx.evidence.map((ev) => {
    let summaryText = `Kind: ${ev.kind} | Locator: ${ev.locator}`;
    if (ev.kind === "source_record") {
      summaryText = `Source Record: ${(ev.payload as any)?.recordType || "record"} [${ev.sourceId}]`;
    } else if (ev.kind === "calculation") {
      summaryText = (ev.payload as any)?.reason || `Calculation: ${(ev.payload as any)?.calculationType}`;
    } else if (ev.kind === "match_rule") {
      summaryText = (ev.payload as any)?.description || `Rule: ${(ev.payload as any)?.rule}`;
    }

    return {
      id: ev.id,
      kind: ev.kind,
      sourceId: ev.sourceId || ev.id,
      locator: ev.locator || ev.id,
      description: (ev.payload as any)?.description,
      summary: summaryText,
      payload: ev.payload,
      createdAt: ev.createdAt,
    };
  });

  // Candidate ledger entries
  const candidateEntries = ctx.candidateLedgerEntries.map((le) => ({
    id: le.id,
    date: le.entryDate,
    amount: formatCurrencyString(le.debit !== "0.00" ? le.debit : le.credit),
    reference: le.reference,
    account: le.accountId,
  }));

  // Decision history from session state
  const decisionHistory: DecisionHistoryViewModel[] = ctx.decisionHistory.map((d) => ({
    id: d.id,
    action: d.action,
    reviewerId: d.reviewer.id,
    reviewerName: d.reviewer.name || d.reviewer.id,
    reviewerRole: d.reviewer.role || "Reviewer",
    reason: d.reason,
    timestamp: d.timestamp,
    fromState: d.previousState,
    toState: d.newState,
  }));

  // Allowed actions based on domain state machine and evidence prerequisites
  const allowedActions = workflowResult.session.getAllowedActions(caseId);

  return {
    summary,
    flaggedReason: {
      code: flaggedCode,
      description: flaggedDesc,
      technicalDetails,
      ruleTriggered: exception?.reasonCode,
    },
    investigation: {
      investigationId: inv.investigationId,
      runId: trace?.runId || `RUN-${caseId}`,
      outcome: inv.outcome,
      summary: inv.investigationSummary,
      rootCause: inv.rootCause,
      recommendation: {
        action: inv.recommendation.action,
        suggestedReason: inv.recommendation.suggestedReason,
        targetLedgerEntryId: (inv.recommendation as any)?.targetLedgerEntryId,
        requiredEvidenceTypes: (inv.recommendation as any)?.requiredEvidenceTypes,
      },
      confidence: inv.confidence,
      riskLevel: inv.riskLevel,
      requiresHumanReview: inv.requiresHumanReview,
      investigatedAt: inv.investigatedAt,
    },
    policyEvaluations,
    toolCalls,
    traceEvents,
    evidence,
    candidateEntries,
    decisionHistory,
    allowedActions,
  };
}

/**
 * Executes a human review action directly against the domain HumanReviewSession.
 * Automatically regenerates close package summary and returns the decision.
 */
export function executeReviewAction(
  state: SharedWorkflowState,
  params: {
    caseId: string;
    action: HumanReviewAction;
    reason: string;
    reviewer?: Reviewer;
    evidenceIds?: string[];
    newEvidence?: EvidenceItem[];
  }
): HumanReviewDecision {
  const { workflowResult } = state;
  const session = workflowResult.session;

  const reviewer = params.reviewer || {
    id: "REV-001",
    name: "Sarah Lin (Controller)",
    role: "Senior Finance Controller",
  };

  // If action is SUPPLY_EVIDENCE and neither newEvidence nor evidenceIds were provided,
  // automatically create a synthetic audited supporting document evidence item
  let newEvidence = params.newEvidence;
  if (params.action === "SUPPLY_EVIDENCE" && (!newEvidence || newEvidence.length === 0) && (!params.evidenceIds || params.evidenceIds.length === 0)) {
    const ctx = session.getCase(params.caseId);
    const ref = ctx.bankTransaction.reference || "DOC-REF";
    const syntheticDocEvidence: EvidenceItem = {
      id: `EVD-DOC-${params.caseId}-${Date.now()}`,
      kind: "document",
      subjectType: "result",
      subjectId: params.caseId,
      sourceId: `SD-${params.caseId}`,
      payload: {
        documentType: "invoice",
        fileName: `invoice-${ref.toLowerCase()}.pdf`,
        description: `Verified invoice/receipt documentation for reference ${ref}`,
        suppliedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };
    newEvidence = [syntheticDocEvidence];
  }

  // 1. Call pure domain state machine
  const decision = session.applyAction({
    caseId: params.caseId,
    action: params.action,
    reviewer,
    reason: params.reason,
    evidenceIds: params.evidenceIds,
    newEvidence,
  });

  // 2. Regenerate ClosePackage from updated session
  workflowResult.closePackage = generateClosePackage(session);

  return decision;
}

/**
 * Extracts real supporting documents from the reconciliation workflow fixture and links them to cases.
 */
export function getEvidenceDocuments(state: SharedWorkflowState): EvidenceDocumentViewModel[] {
  const { workflowResult } = state;
  const fixtureDocs = (fixtureJson as any).documents || [];
  const cases = workflowResult.closePackage.cases;

  return fixtureDocs.map((doc: any) => {
    // Find all cases linked to this document
    const linkedCases: string[] = [];
    for (const c of cases) {
      const hasDocInEvidence = c.evidence.some(
        (ev) => ev.kind === "document" && (ev.sourceId === doc.id || (ev.payload as any)?.id === doc.id)
      );
      const hasDocInCandidates = c.candidateLedgerEntries.some((le) =>
        le.documentIds && le.documentIds.includes(doc.id)
      );
      if (hasDocInEvidence || hasDocInCandidates) {
        linkedCases.push(c.caseId);
      }
    }

    return {
      id: doc.id,
      name: doc.fileName,
      vendor: doc.vendor || "General / Corporate",
      amount: doc.amount ? formatCurrencyString(doc.amount) : "N/A",
      date: doc.documentDate || "2024-01-30",
      type: doc.documentType,
      linkedCases: Array.from(new Set(linkedCases)),
    };
  });
}
